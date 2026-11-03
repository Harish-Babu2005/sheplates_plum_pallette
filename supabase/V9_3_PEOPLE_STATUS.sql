-- V9.3 — People and Statuses.
--
--  1. Customers follow customers (vendors were already followable).
--  2. Customers find each other by handle, anywhere, and see people nearby on the map.
--  3. Customer shorts become STATUSES: a photo or a video of up to 30 seconds that
--     vanishes after 24 hours and can be viewed once by each person.
--
-- Privacy rules, enforced here and not only in the app
--   * Being on the map is OPT-IN (social_profiles.discoverable, default off). Turning it on stores
--     a COARSE position (rounded to a 0.005 degree grid, roughly 550 m), never the exact pin.
--     Turning it off deletes that position. Nobody can read it directly: only the functions below
--     return it, and distances are rounded to the nearest half kilometre.
--   * Finding a person by handle shows only handle, bio and follower count. A handle is public.
--   * A status is seen only by people who follow its author, or by people nearby when the author
--     is discoverable. Each person sees it once; after that it is gone for them. Statuses cannot
--     be read from the table by anyone but their author.
--   * Expired statuses disappear from every read at the 24 hour mark. Rows and files are then
--     cleaned up by claim_expired_statuses() (the author's own app) and purge_expired_statuses()
--     (a scheduled job with the service key).
--
-- Additive and safe to re-run. Needs V8_3 (social_profiles) and V9_1 (current_app_role is older).

create or replace function public.distance_km(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns double precision language sql immutable as $$
  select 6371 * 2 * asin(least(1, sqrt(power(sin(radians(b_lat - a_lat) / 2), 2) + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2))))
$$;

-- ------------------------------------------------------------------ people
alter table public.social_profiles add column if not exists discoverable boolean not null default false;
alter table public.social_profiles add column if not exists map_lat numeric;
alter table public.social_profiles add column if not exists map_lng numeric;
create index if not exists social_profiles_discoverable_idx on public.social_profiles(discoverable) where discoverable;

create table if not exists public.customer_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists customer_follows_followee_idx on public.customer_follows(followee_id);
alter table public.customer_follows enable row level security;
-- You can read the follows you are part of. Writes go through follow_person()/unfollow_person() only.
drop policy if exists customer_follows_read on public.customer_follows;
create policy customer_follows_read on public.customer_follows for select using (follower_id = auth.uid() or followee_id = auth.uid() or public.current_app_role() in ('operations', 'admin'));

create or replace function public.follow_person(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.current_app_role() <> 'customer' then raise exception 'Sign in as a customer to follow people'; end if;
  if p_user = auth.uid() then raise exception 'You cannot follow yourself'; end if;
  if not exists (select 1 from public.profiles where id = p_user and role = 'customer') then raise exception 'That person was not found'; end if;
  if (select count(*) from public.customer_follows where follower_id = auth.uid()) >= 1000 then raise exception 'You can follow up to 1,000 people'; end if;
  insert into public.customer_follows(follower_id, followee_id) values (auth.uid(), p_user) on conflict do nothing;
end;
$$;
create or replace function public.unfollow_person(p_user uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.customer_follows where follower_id = auth.uid() and followee_id = p_user
$$;

-- Opt in or out of the map. Only a coarse position is ever stored.
create or replace function public.set_discoverable(p_on boolean, p_lat double precision default null, p_lng double precision default null) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.current_app_role() <> 'customer' then raise exception 'Sign in as a customer'; end if;
  perform public.ensure_social_profile(null);
  if p_on then
    if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Set your delivery location first so people nearby can find you'; end if;
    update public.social_profiles set discoverable = true, map_lat = round(p_lat::numeric / 0.005) * 0.005, map_lng = round(p_lng::numeric / 0.005) * 0.005, updated_at = now() where user_id = auth.uid();
  else
    update public.social_profiles set discoverable = false, map_lat = null, map_lng = null, updated_at = now() where user_id = auth.uid();
  end if;
  return p_on;
end;
$$;

-- Find a customer by handle (prefix match, two letters or more). Public identity only.
create or replace function public.search_people(p_query text, p_limit int default 20)
returns table (user_id uuid, handle text, bio text, following boolean, follower_count bigint, discoverable boolean)
language sql stable security definer set search_path = public as $$
  select sp.user_id, sp.handle, sp.bio,
    exists (select 1 from public.customer_follows f where f.follower_id = auth.uid() and f.followee_id = sp.user_id),
    (select count(*) from public.customer_follows f where f.followee_id = sp.user_id),
    sp.discoverable
  from public.social_profiles sp join public.profiles p on p.id = sp.user_id
  where auth.uid() is not null and p.role = 'customer' and sp.user_id <> auth.uid()
    and char_length(ltrim(trim(coalesce(p_query, '')), '@')) >= 2
    and starts_with(sp.handle, lower(ltrim(trim(p_query), '@')))
  order by (sp.handle = lower(ltrim(trim(p_query), '@'))) desc, sp.handle
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

create or replace function public.list_people(p_kind text)
returns table (user_id uuid, handle text, bio text, following boolean)
language sql stable security definer set search_path = public as $$
  select sp.user_id, sp.handle, sp.bio,
    exists (select 1 from public.customer_follows f2 where f2.follower_id = auth.uid() and f2.followee_id = sp.user_id)
  from public.customer_follows f
  join public.social_profiles sp on sp.user_id = case when p_kind = 'followers' then f.follower_id else f.followee_id end
  where auth.uid() is not null and case when p_kind = 'followers' then f.followee_id else f.follower_id end = auth.uid()
  order by f.created_at desc
  limit 200
$$;

create or replace function public.my_follow_counts() returns table (followers bigint, following bigint)
language sql stable security definer set search_path = public as $$
  select (select count(*) from public.customer_follows where followee_id = auth.uid()),
         (select count(*) from public.customer_follows where follower_id = auth.uid())
$$;

-- ------------------------------------------------------------------ statuses
create table if not exists public.customer_statuses (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('photo', 'video')),
  media_url text not null,
  thumb_url text,
  caption text not null default '' check (char_length(caption) <= 200),
  vendor_id uuid references public.vendors(id) on delete set null,
  duration_s numeric(5,2),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  constraint customer_statuses_video_length check (kind = 'photo' or (duration_s is not null and duration_s > 0 and duration_s <= 30)),
  constraint customer_statuses_ttl check (expires_at <= created_at + interval '24 hours 1 minute')
);
create index if not exists customer_statuses_author_idx on public.customer_statuses(author_id, created_at desc);
create index if not exists customer_statuses_expiry_idx on public.customer_statuses(expires_at);

create table if not exists public.status_views (
  status_id uuid not null references public.customer_statuses(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (status_id, viewer_id)
);
create table if not exists public.status_likes (
  status_id uuid not null references public.customer_statuses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (status_id, user_id)
);

alter table public.customer_statuses enable row level security;
alter table public.status_views enable row level security;
alter table public.status_likes enable row level security;
-- The author sees their own statuses (and can delete them); staff can moderate. Everyone else goes through status_feed().
drop policy if exists customer_statuses_author_read on public.customer_statuses;
create policy customer_statuses_author_read on public.customer_statuses for select using (author_id = auth.uid() or public.current_app_role() in ('operations', 'admin'));
drop policy if exists customer_statuses_author_delete on public.customer_statuses;
create policy customer_statuses_author_delete on public.customer_statuses for delete using (author_id = auth.uid() or public.current_app_role() in ('operations', 'admin'));
drop policy if exists status_views_own on public.status_views;
create policy status_views_own on public.status_views for select using (viewer_id = auth.uid());
drop policy if exists status_likes_own on public.status_likes;
create policy status_likes_own on public.status_likes for select using (user_id = auth.uid());

-- People who chose to be on the map, within a radius of the caller. Positions are coarse; distances are to the nearest 0.5 km.
create or replace function public.people_nearby(p_lat double precision, p_lng double precision, p_radius_km numeric default 5, p_query text default null, p_limit int default 60)
returns table (user_id uuid, handle text, bio text, following boolean, follower_count bigint, dist_km numeric, pin_lat numeric, pin_lng numeric, has_status boolean)
language sql stable security definer set search_path = public as $$
  with d as (
    select sp.user_id as uid, sp.handle as h, sp.bio as b, sp.map_lat, sp.map_lng,
      public.distance_km(p_lat, p_lng, sp.map_lat::double precision, sp.map_lng::double precision) as dist
    from public.social_profiles sp join public.profiles p on p.id = sp.user_id
    where auth.uid() is not null and p.role = 'customer' and sp.discoverable and sp.map_lat is not null and sp.map_lng is not null and sp.user_id <> auth.uid()
  )
  select d.uid, d.h, d.b,
    exists (select 1 from public.customer_follows f where f.follower_id = auth.uid() and f.followee_id = d.uid),
    (select count(*) from public.customer_follows f where f.followee_id = d.uid),
    (round(d.dist * 2) / 2)::numeric, d.map_lat, d.map_lng,
    exists (select 1 from public.customer_statuses s where s.author_id = d.uid and s.expires_at > now()
            and not exists (select 1 from public.status_views v where v.status_id = s.id and v.viewer_id = auth.uid()))
  from d
  where d.dist <= least(p_radius_km::double precision, 30)
    and (coalesce(trim(p_query), '') = '' or starts_with(d.h, lower(ltrim(trim(p_query), '@'))))
  order by d.dist
  limit least(greatest(coalesce(p_limit, 60), 1), 100)
$$;

create or replace function public.post_status(p_kind text, p_media_url text, p_thumb_url text, p_caption text, p_vendor_id uuid default null, p_duration_s numeric default null)
returns public.customer_statuses
language plpgsql security definer set search_path = public as $$
declare created public.customer_statuses;
begin
  if auth.uid() is null or public.current_app_role() <> 'customer' then raise exception 'Sign in as a customer to post a status'; end if;
  perform public.ensure_social_profile(null);
  if p_kind not in ('photo', 'video') then raise exception 'A status is a photo or a video'; end if;
  if p_media_url is null or p_media_url !~ '^https?://' then raise exception 'The upload is missing'; end if;
  if p_kind = 'video' and (p_duration_s is null or p_duration_s <= 0 or p_duration_s > 30) then raise exception 'A video status can be at most 30 seconds'; end if;
  if (select count(*) from public.customer_statuses where author_id = auth.uid() and expires_at > now()) >= 10 then raise exception 'You have 10 active statuses. They disappear after 24 hours'; end if;
  insert into public.customer_statuses(author_id, kind, media_url, thumb_url, caption, vendor_id, duration_s)
  values (auth.uid(), p_kind, p_media_url, p_thumb_url, left(coalesce(p_caption, ''), 200), p_vendor_id, case when p_kind = 'video' then p_duration_s end)
  returning * into created;
  return created;
end;
$$;

-- What the caller may watch right now: unexpired, not their own, not already viewed, and either from someone
-- they follow or from a discoverable person within the radius. View-once: a viewed status is not returned again.
create or replace function public.status_feed(p_lat double precision default null, p_lng double precision default null, p_radius_km numeric default 5)
returns table (status_id uuid, author_id uuid, handle text, kind text, media_url text, thumb_url text, caption text, vendor_id uuid, vendor_name text,
  duration_s numeric, created_at timestamptz, expires_at timestamptz, like_count bigint, liked boolean, source text, dist_km numeric)
language sql stable security definer set search_path = public as $$
  select s.id, s.author_id, sp.handle, s.kind, s.media_url, s.thumb_url, s.caption, s.vendor_id, v.name, s.duration_s, s.created_at, s.expires_at,
    (select count(*) from public.status_likes l where l.status_id = s.id),
    exists (select 1 from public.status_likes l where l.status_id = s.id and l.user_id = auth.uid()),
    case when f.followee_id is not null then 'following' else 'nearby' end,
    case when sp.discoverable and sp.map_lat is not null and p_lat is not null and p_lng is not null
         then (round(public.distance_km(p_lat, p_lng, sp.map_lat::double precision, sp.map_lng::double precision) * 2) / 2)::numeric end
  from public.customer_statuses s
  join public.social_profiles sp on sp.user_id = s.author_id
  left join public.vendors v on v.id = s.vendor_id
  left join public.customer_follows f on f.follower_id = auth.uid() and f.followee_id = s.author_id
  where auth.uid() is not null and s.author_id <> auth.uid() and s.expires_at > now()
    and not exists (select 1 from public.status_views sv where sv.status_id = s.id and sv.viewer_id = auth.uid())
    and (f.followee_id is not null
         or (sp.discoverable and sp.map_lat is not null and p_lat is not null and p_lng is not null
             and public.distance_km(p_lat, p_lng, sp.map_lat::double precision, sp.map_lng::double precision) <= least(p_radius_km::double precision, 30)))
  order by s.created_at desc
  limit 200
$$;

create or replace function public.mark_status_viewed(p_status uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.status_views(status_id, viewer_id)
  select s.id, auth.uid() from public.customer_statuses s where s.id = p_status and s.expires_at > now() and s.author_id <> auth.uid() and auth.uid() is not null
  on conflict do nothing
$$;

create or replace function public.like_status(p_status uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if not exists (select 1 from public.customer_statuses where id = p_status and expires_at > now() and author_id <> auth.uid()) then raise exception 'That status is no longer available'; end if;
  if p_on then insert into public.status_likes(status_id, user_id) values (p_status, auth.uid()) on conflict do nothing;
  else delete from public.status_likes where status_id = p_status and user_id = auth.uid(); end if;
end;
$$;

create or replace function public.my_statuses()
returns table (id uuid, kind text, media_url text, thumb_url text, caption text, vendor_id uuid, duration_s numeric, created_at timestamptz, expires_at timestamptz, view_count bigint, like_count bigint)
language sql stable security definer set search_path = public as $$
  select s.id, s.kind, s.media_url, s.thumb_url, s.caption, s.vendor_id, s.duration_s, s.created_at, s.expires_at,
    (select count(*) from public.status_views v where v.status_id = s.id), (select count(*) from public.status_likes l where l.status_id = s.id)
  from public.customer_statuses s where s.author_id = auth.uid() and s.expires_at > now() order by s.created_at
$$;

-- Who has seen a status: the author only.
create or replace function public.status_viewers(p_status uuid)
returns table (handle text, viewed_at timestamptz, liked boolean)
language sql stable security definer set search_path = public as $$
  select sp.handle, v.viewed_at, exists (select 1 from public.status_likes l where l.status_id = v.status_id and l.user_id = v.viewer_id)
  from public.status_views v
  join public.customer_statuses s on s.id = v.status_id and s.author_id = auth.uid()
  join public.social_profiles sp on sp.user_id = v.viewer_id
  where v.status_id = p_status order by v.viewed_at desc limit 200
$$;

-- Housekeeping. The caller's own expired rows are deleted and their file addresses returned so the app can remove the files.
create or replace function public.claim_expired_statuses() returns table (m_url text, t_url text)
language plpgsql security definer set search_path = public as $$
begin
  return query with gone as (delete from public.customer_statuses cs where cs.author_id = auth.uid() and cs.expires_at <= now() returning cs.media_url as mu, cs.thumb_url as tu) select gone.mu, gone.tu from gone;
end;
$$;
-- The scheduled job (service key) removes everyone's expired rows.
create or replace function public.purge_expired_statuses() returns table (m_url text, t_url text)
language plpgsql security definer set search_path = public as $$
begin
  return query with gone as (delete from public.customer_statuses cs where cs.expires_at <= now() returning cs.media_url as mu, cs.thumb_url as tu) select gone.mu, gone.tu from gone;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'follow_person(uuid)', 'unfollow_person(uuid)', 'set_discoverable(boolean, double precision, double precision)', 'search_people(text, int)',
    'people_nearby(double precision, double precision, numeric, text, int)', 'list_people(text)', 'my_follow_counts()',
    'post_status(text, text, text, text, uuid, numeric)', 'status_feed(double precision, double precision, numeric)', 'mark_status_viewed(uuid)',
    'like_status(uuid, boolean)', 'my_statuses()', 'status_viewers(uuid)', 'claim_expired_statuses()', 'purge_expired_statuses()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.purge_expired_statuses() from authenticated;
grant execute on function public.purge_expired_statuses() to service_role;

-- ------------------------------------------------------------------ storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('status-media', 'status-media', true, 31457280, array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists status_media_read on storage.objects;
create policy status_media_read on storage.objects for select using (bucket_id = 'status-media');
drop policy if exists status_media_insert on storage.objects;
create policy status_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'status-media' and (storage.foldername(name))[1] = auth.uid()::text and public.current_app_role() = 'customer');
drop policy if exists status_media_delete on storage.objects;
create policy status_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'status-media' and ((storage.foldername(name))[1] = auth.uid()::text or public.current_app_role() in ('operations', 'admin')));
