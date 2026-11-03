-- V8.3 — Social layer: vendor follows, Food Stories posts (photo / food trial),
-- likes, saves, comments, reports and public social profiles.
--
-- Design notes
--   * Posting limits (10 photos / 5 food trials per rolling 7 days) can't be
--     expressed in RLS, so nobody inserts into public.posts directly — the
--     create_post() function counts, enforces the limit and inserts, all in one
--     transaction, using auth.uid() (never a client-supplied author).
--   * Diet, allergies and addresses live in customer_preferences and are never
--     read by anything in this file: a social profile is only handle + bio.
--   * posts carries denormalised author_name/author_handle so a public feed can
--     render without granting anyone read access to other users' profiles rows.
--   * Reviews stay purchase-gated and are NOT part of this migration.
-- Additive only. Reuses public.profiles / vendors / vendor_menu_items and
-- public.current_app_role().

create table if not exists public.social_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  bio text not null default '' check (char_length(bio) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, vendor_id)
);
create index if not exists vendor_follows_vendor_idx on public.vendor_follows(vendor_id);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  author_handle text not null,
  kind text not null check (kind in ('photo', 'trial')),
  caption text not null default '' check (char_length(caption) <= 500),
  image_url text,
  vendor_id uuid references public.vendors(id) on delete set null,
  product_id uuid references public.vendor_menu_items(id) on delete set null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists posts_created_idx on public.posts(created_at desc);
create index if not exists posts_author_idx on public.posts(author_id, created_at desc);
create index if not exists posts_vendor_idx on public.posts(vendor_id, created_at desc);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_saves (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null,
  body text not null check (char_length(body) between 1 and 300),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments(post_id, created_at);

create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 300),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

alter table public.social_profiles enable row level security;
alter table public.vendor_follows enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_saves enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_reports enable row level security;

-- Handles/bios are public by design; only the owner writes them.
create policy social_profiles_read on public.social_profiles for select using (true);
create policy social_profiles_owner_write on public.social_profiles for insert with check (user_id = auth.uid());
create policy social_profiles_owner_update on public.social_profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A customer sees only their own follows; the vendor (and ops/admin) can see who follows them.
create policy vendor_follows_read on public.vendor_follows for select using (
  follower_id = auth.uid()
  or public.current_app_role() in ('operations', 'admin')
  or exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_id = auth.uid())
);
create policy vendor_follows_insert on public.vendor_follows for insert with check (follower_id = auth.uid());
create policy vendor_follows_delete on public.vendor_follows for delete using (follower_id = auth.uid());

-- Posts: public feed minus anything moderated away. No insert policy on
-- purpose — create_post() below is the only way in.
create policy posts_read on public.posts for select using (
  hidden = false or author_id = auth.uid() or public.current_app_role() in ('operations', 'admin')
);
create policy posts_author_delete on public.posts for delete using (author_id = auth.uid());
create policy posts_moderate on public.posts for update using (public.current_app_role() in ('operations', 'admin'))
  with check (public.current_app_role() in ('operations', 'admin'));

create policy post_likes_read on public.post_likes for select using (true);
create policy post_likes_insert on public.post_likes for insert with check (user_id = auth.uid());
create policy post_likes_delete on public.post_likes for delete using (user_id = auth.uid());

create policy post_saves_read on public.post_saves for select using (user_id = auth.uid());
create policy post_saves_insert on public.post_saves for insert with check (user_id = auth.uid());
create policy post_saves_delete on public.post_saves for delete using (user_id = auth.uid());

create policy post_comments_read on public.post_comments for select using (
  hidden = false or author_id = auth.uid() or public.current_app_role() in ('operations', 'admin')
);
create policy post_comments_insert on public.post_comments for insert with check (author_id = auth.uid());
create policy post_comments_delete on public.post_comments for delete using (author_id = auth.uid());
create policy post_comments_moderate on public.post_comments for update using (public.current_app_role() in ('operations', 'admin'))
  with check (public.current_app_role() in ('operations', 'admin'));

create policy post_reports_insert on public.post_reports for insert with check (reporter_id = auth.uid());
create policy post_reports_read on public.post_reports for select using (public.current_app_role() in ('operations', 'admin'));

-- Creates the caller's social profile on first use, deriving a handle from
-- their name; safe to call repeatedly.
create or replace function public.ensure_social_profile(p_handle text default null)
returns public.social_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.social_profiles;
  v_base text;
  v_handle text;
begin
  if v_uid is null then raise exception 'Sign in required' using errcode = '28000'; end if;
  select * into v_row from public.social_profiles where user_id = v_uid;
  if found then return v_row; end if;
  v_base := lower(regexp_replace(coalesce(p_handle, (select full_name from public.profiles where id = v_uid), 'foodie'), '[^a-zA-Z0-9]+', '', 'g'));
  if char_length(v_base) < 3 then v_base := 'foodie'; end if;
  v_handle := left(v_base, 16) || substr(replace(v_uid::text, '-', ''), 1, 4);
  insert into public.social_profiles (user_id, handle) values (v_uid, v_handle)
    on conflict (user_id) do nothing;
  select * into v_row from public.social_profiles where user_id = v_uid;
  return v_row;
end;
$$;
grant execute on function public.ensure_social_profile(text) to authenticated;

-- The only write path for posts: enforces 10 photos / 5 food trials per
-- rolling 7 days server-side, and stamps the author from the JWT.
create or replace function public.create_post(
  p_kind text, p_caption text, p_image_url text, p_vendor_id uuid default null, p_product_id uuid default null
)
returns public.posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int;
  v_used int;
  v_profile public.social_profiles;
  v_name text;
  v_post public.posts;
begin
  if v_uid is null then raise exception 'Sign in required' using errcode = '28000'; end if;
  if p_kind not in ('photo', 'trial') then raise exception 'Unknown post type' using errcode = '22023'; end if;
  if p_kind = 'photo' and (p_image_url is null or p_image_url = '') then raise exception 'A food photo needs an image' using errcode = '22023'; end if;
  v_limit := case p_kind when 'photo' then 10 else 5 end;
  select count(*) into v_used from public.posts
    where author_id = v_uid and kind = p_kind and created_at > now() - interval '7 days';
  if v_used >= v_limit then
    raise exception 'Weekly limit reached: % % per week', v_limit, case p_kind when 'photo' then 'photos' else 'food trials' end using errcode = 'P0001';
  end if;
  v_profile := public.ensure_social_profile(null);
  select coalesce(full_name, 'ShePlates member') into v_name from public.profiles where id = v_uid;
  insert into public.posts (author_id, author_name, author_handle, kind, caption, image_url, vendor_id, product_id)
    values (v_uid, v_name, v_profile.handle, p_kind, coalesce(p_caption, ''), nullif(p_image_url, ''), p_vendor_id, p_product_id)
    returning * into v_post;
  return v_post;
end;
$$;
grant execute on function public.create_post(text, text, text, uuid, uuid) to authenticated;

-- Public bucket for post images; authenticated users write only inside their own uid folder.
insert into storage.buckets (id, name, public) values ('post-media', 'post-media', true) on conflict (id) do nothing;
create policy post_media_read on storage.objects for select using (bucket_id = 'post-media');
create policy post_media_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy post_media_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
