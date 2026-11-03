-- Private customer accounts require approval before a customer follow is created.
alter table public.social_profiles
  add column if not exists private_account boolean not null default false;

create table if not exists public.customer_follow_requests (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (requester_id, recipient_id),
  check (requester_id <> recipient_id)
);
create index if not exists customer_follow_requests_recipient_idx
  on public.customer_follow_requests(recipient_id, created_at desc);
alter table public.customer_follow_requests enable row level security;
drop policy if exists customer_follow_requests_read on public.customer_follow_requests;
create policy customer_follow_requests_read on public.customer_follow_requests for select
  using (requester_id = auth.uid() or recipient_id = auth.uid());

create or replace function public.my_private_account() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select sp.private_account from public.social_profiles sp where sp.user_id = auth.uid()), false)
$$;

create or replace function public.set_private_account(p_private boolean) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.current_app_role() <> 'customer' then
    raise exception 'Sign in as a customer to change account privacy';
  end if;
  perform public.ensure_social_profile(null);
  update public.social_profiles set private_account = p_private, updated_at = now() where user_id = auth.uid();
  return p_private;
end;
$$;

drop function if exists public.follow_person(uuid);
create function public.follow_person(p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  target_is_private boolean;
begin
  if auth.uid() is null or public.current_app_role() <> 'customer' then raise exception 'Sign in as a customer to follow people'; end if;
  if p_user = auth.uid() then raise exception 'You cannot follow yourself'; end if;
  if not exists (select 1 from public.profiles where id = p_user and role = 'customer') then raise exception 'That person was not found'; end if;
  if exists (select 1 from public.customer_follows where follower_id = auth.uid() and followee_id = p_user) then return 'following'; end if;
  select sp.private_account into target_is_private from public.social_profiles sp where sp.user_id = p_user;
  if coalesce(target_is_private, false) then
    insert into public.customer_follow_requests(requester_id, recipient_id)
      values (auth.uid(), p_user) on conflict do nothing;
    return 'requested';
  end if;
  if (select count(*) from public.customer_follows where follower_id = auth.uid()) >= 1000 then raise exception 'You can follow up to 1,000 people'; end if;
  insert into public.customer_follows(follower_id, followee_id) values (auth.uid(), p_user) on conflict do nothing;
  return 'following';
end;
$$;

create or replace function public.unfollow_person(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.customer_follows where follower_id = auth.uid() and followee_id = p_user;
  delete from public.customer_follow_requests where requester_id = auth.uid() and recipient_id = p_user;
end;
$$;

create or replace function public.respond_follow_request(p_user uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.current_app_role() <> 'customer' then raise exception 'Sign in as a customer to manage follow requests'; end if;
  if not exists (select 1 from public.customer_follow_requests where requester_id = p_user and recipient_id = auth.uid()) then
    raise exception 'This follow request is no longer available';
  end if;
  if p_accept then
    if (select count(*) from public.customer_follows where follower_id = p_user) >= 1000 then raise exception 'This customer has reached the follow limit'; end if;
    insert into public.customer_follows(follower_id, followee_id) values (p_user, auth.uid()) on conflict do nothing;
  end if;
  delete from public.customer_follow_requests where requester_id = p_user and recipient_id = auth.uid();
end;
$$;

create or replace function public.list_follow_requests()
returns table (user_id uuid, handle text, bio text)
language sql stable security definer set search_path = public as $$
  select sp.user_id, sp.handle, sp.bio
  from public.customer_follow_requests r
  join public.social_profiles sp on sp.user_id = r.requester_id
  where r.recipient_id = auth.uid()
  order by r.created_at desc
  limit 200
$$;

create or replace function public.list_outgoing_follow_requests()
returns table (user_id uuid)
language sql stable security definer set search_path = public as $$
  select r.recipient_id from public.customer_follow_requests r where r.requester_id = auth.uid()
$$;

drop function if exists public.search_people(text, integer);
create function public.search_people(p_query text, p_limit int default 20)
returns table (user_id uuid, handle text, bio text, following boolean, requested boolean, private_account boolean, follower_count bigint, discoverable boolean)
language sql stable security definer set search_path = public as $$
  select sp.user_id, sp.handle, sp.bio,
    exists (select 1 from public.customer_follows f where f.follower_id = auth.uid() and f.followee_id = sp.user_id),
    exists (select 1 from public.customer_follow_requests r where r.requester_id = auth.uid() and r.recipient_id = sp.user_id),
    sp.private_account,
    (select count(*) from public.customer_follows f where f.followee_id = sp.user_id),
    sp.discoverable
  from public.social_profiles sp join public.profiles p on p.id = sp.user_id
  where auth.uid() is not null and p.role = 'customer' and sp.user_id <> auth.uid()
    and char_length(ltrim(trim(coalesce(p_query, '')), '@')) >= 2
    and starts_with(sp.handle, lower(ltrim(trim(p_query), '@')))
  order by (sp.handle = lower(ltrim(trim(p_query), '@'))) desc, sp.handle
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

drop function if exists public.people_nearby(double precision, double precision, numeric, text, integer);
create function public.people_nearby(p_lat double precision, p_lng double precision, p_radius_km numeric default 5, p_query text default null, p_limit int default 60)
returns table (user_id uuid, handle text, bio text, following boolean, requested boolean, private_account boolean, follower_count bigint, dist_km numeric, pin_lat numeric, pin_lng numeric, has_status boolean)
language sql stable security definer set search_path = public as $$
  with d as (
    select sp.user_id as uid, sp.handle as h, sp.bio as b, sp.map_lat, sp.map_lng, sp.private_account,
      public.distance_km(p_lat, p_lng, sp.map_lat::double precision, sp.map_lng::double precision) as dist
    from public.social_profiles sp join public.profiles p on p.id = sp.user_id
    where auth.uid() is not null and p.role = 'customer' and sp.discoverable and sp.map_lat is not null and sp.map_lng is not null and sp.user_id <> auth.uid()
  )
  select d.uid, d.h, d.b,
    exists (select 1 from public.customer_follows f where f.follower_id = auth.uid() and f.followee_id = d.uid),
    exists (select 1 from public.customer_follow_requests r where r.requester_id = auth.uid() and r.recipient_id = d.uid),
    d.private_account,
    (select count(*) from public.customer_follows f where f.followee_id = d.uid),
    (round(d.dist * 2) / 2)::numeric, d.map_lat, d.map_lng,
    exists (select 1 from public.customer_statuses s where s.author_id = d.uid and s.expires_at > now()
            and not exists (select 1 from public.status_views v where v.status_id = s.id and v.viewer_id = auth.uid())
            and (not d.private_account or exists (select 1 from public.customer_follows f where f.follower_id = auth.uid() and f.followee_id = d.uid)))
  from d
  where d.dist <= least(p_radius_km::double precision, 30)
    and (coalesce(trim(p_query), '') = '' or starts_with(d.h, lower(ltrim(trim(p_query), '@'))))
  order by d.dist
  limit least(greatest(coalesce(p_limit, 60), 1), 100)
$$;

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
         or (not sp.private_account and sp.discoverable and sp.map_lat is not null and p_lat is not null and p_lng is not null
             and public.distance_km(p_lat, p_lng, sp.map_lat::double precision, sp.map_lng::double precision) <= least(p_radius_km::double precision, 30)))
  order by s.created_at desc
  limit 200
$$;

revoke all on function public.my_private_account() from public, anon;
revoke all on function public.set_private_account(boolean) from public, anon;
revoke all on function public.follow_person(uuid) from public, anon;
revoke all on function public.unfollow_person(uuid) from public, anon;
revoke all on function public.respond_follow_request(uuid, boolean) from public, anon;
revoke all on function public.list_follow_requests() from public, anon;
revoke all on function public.list_outgoing_follow_requests() from public, anon;
revoke all on function public.search_people(text, integer) from public, anon;
revoke all on function public.people_nearby(double precision, double precision, numeric, text, integer) from public, anon;
grant execute on function public.my_private_account() to authenticated;
grant execute on function public.set_private_account(boolean) to authenticated;
grant execute on function public.follow_person(uuid) to authenticated;
grant execute on function public.unfollow_person(uuid) to authenticated;
grant execute on function public.respond_follow_request(uuid, boolean) to authenticated;
grant execute on function public.list_follow_requests() to authenticated;
grant execute on function public.list_outgoing_follow_requests() to authenticated;
grant execute on function public.search_people(text, integer) to authenticated;
grant execute on function public.people_nearby(double precision, double precision, numeric, text, integer) to authenticated;
