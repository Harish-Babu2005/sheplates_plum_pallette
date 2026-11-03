-- ShePlates: all pending database changes in one file. Safe to run more than once.
-- Runs, in order: V9_4 people privacy, V9_5 shop link, V9_6 followed Food Shorts, V9_7 private accounts,
-- V9_8 follow notifications and vendor followers, V9_10 order delivery address.
-- If one statement fails, everything is rolled back and nothing is half applied.

begin;

-- =================================================================== V9_4_PEOPLE_PRIVACY
-- V9_4 People privacy hardening. Run after V9_3_PEOPLE_STATUS.sql. Safe to re-run.
-- social_profiles is readable by every signed-in user (handles are public), which also exposed the coarse map
-- position of everyone who is on the map, with no distance limit. From now on:
--   * map_lat, map_lng and discoverable cannot be read directly; people_nearby() / status_feed() (with the
--     radius cap) are the only way to see where someone is, and my_discoverable() tells you your own setting.
--   * they cannot be written directly either: set_discoverable() is the only way, and it snaps the position
--     to the ~550 m grid.
create or replace function public.my_discoverable() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select discoverable from public.social_profiles where user_id = auth.uid()), false)
$$;
revoke all on function public.my_discoverable() from public, anon;
grant execute on function public.my_discoverable() to authenticated;

revoke select, insert, update on public.social_profiles from anon, authenticated;
grant select (user_id, handle, bio, created_at, updated_at) on public.social_profiles to anon, authenticated;
grant insert (user_id, handle, bio) on public.social_profiles to authenticated;
grant update (handle, bio, updated_at) on public.social_profiles to authenticated;


-- =================================================================== V9_5_FOOD_SHORT_SHOP_LINK
-- Add an optional customer-facing shop link to Food Shorts.
alter table public.food_shorts
  add column if not exists shop_link text
  check (shop_link is null or (char_length(shop_link) <= 2048 and shop_link ~* '^https?://'));

-- The customer feed returns the link only for shorts already visible to that customer.
drop function if exists public.nearby_food_shorts(double precision, double precision, numeric, integer);
create function public.nearby_food_shorts(
  p_lat double precision, p_lng double precision, p_radius_km numeric default 30, p_limit int default 60
) returns table (
  id uuid, vendor_id uuid, vendor_name text, vendor_category text, product_id uuid, shop_link text,
  title text, caption text, video_url text, thumb_url text, duration_s numeric, reach_km numeric,
  view_count int, like_count bigint, liked boolean, created_at timestamptz, distance_km double precision
)
language sql stable security definer set search_path = public as $$
  with d as (
    select s.*, v.name as vendor_name, v.category as vendor_category,
      6371 * 2 * asin(least(1, sqrt(
        power(sin(radians(v.latitude::double precision - p_lat) / 2), 2)
        + cos(radians(p_lat)) * cos(radians(v.latitude::double precision))
        * power(sin(radians(v.longitude::double precision - p_lng) / 2), 2)
      ))) as dist
    from public.food_shorts s
    join public.vendors v on v.id = s.vendor_id
    where s.status = 'active'
      and v.verification_status = 'verified'
      and v.operational_status = 'active'
      and v.marketplace_visible
      and v.latitude is not null and v.longitude is not null
  )
  select d.id, d.vendor_id, d.vendor_name, d.vendor_category, d.product_id, d.shop_link,
    d.title, d.caption, d.video_url, d.thumb_url, d.duration_s, d.reach_km, d.view_count,
    (select count(*) from public.food_short_likes l where l.short_id = d.id),
    exists (select 1 from public.food_short_likes l where l.short_id = d.id and l.user_id = auth.uid()),
    d.created_at, d.dist
  from d
  where auth.uid() is not null and d.dist <= least(d.reach_km::double precision, p_radius_km::double precision)
  order by d.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 100);
$$;
revoke all on function public.nearby_food_shorts(double precision, double precision, numeric, integer) from public;
grant execute on function public.nearby_food_shorts(double precision, double precision, numeric, integer) to authenticated;

drop function if exists public.create_food_short(text, text, text, text, numeric, numeric, uuid);
create function public.create_food_short(
  p_title text, p_caption text, p_video_url text, p_thumb_url text,
  p_duration_s numeric, p_reach_km numeric, p_product_id uuid default null, p_shop_link text default null
) returns public.food_shorts
language plpgsql security definer set search_path = public as $$
declare
  v public.vendors;
  created public.food_shorts;
  reach numeric;
  shop_link_value text;
begin
  select * into v from public.vendors where owner_id = auth.uid() order by created_at limit 1;
  if v.id is null then raise exception 'Only a vendor can post a Food Short'; end if;
  if p_duration_s is null or p_duration_s <= 0 or p_duration_s > 30 then raise exception 'A Food Short can be at most 30 seconds'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Give the short a title'; end if;
  if p_video_url is null or p_video_url !~ '^https?://' then raise exception 'The video upload is missing'; end if;
  if (select count(*) from public.food_shorts where vendor_id = v.id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Daily limit reached: 10 Food Shorts per day';
  end if;
  if p_product_id is not null and not exists (select 1 from public.vendor_menu_items where id = p_product_id and vendor_id = v.id) then
    raise exception 'That product does not belong to your store';
  end if;
  shop_link_value := nullif(trim(p_shop_link), '');
  if shop_link_value is not null and (char_length(shop_link_value) > 2048 or shop_link_value !~* '^https?://') then
    raise exception 'Shop links must be valid http:// or https:// URLs';
  end if;
  reach := least(30, greatest(1, coalesce(p_reach_km, v.service_radius_km, 5)));
  insert into public.food_shorts(vendor_id, product_id, shop_link, title, caption, video_url, thumb_url, duration_s, reach_km)
  values (v.id, p_product_id, shop_link_value, left(trim(p_title), 80), left(coalesce(p_caption, ''), 300), p_video_url, p_thumb_url, p_duration_s, reach)
  returning * into created;
  return created;
end;
$$;
revoke all on function public.create_food_short(text, text, text, text, numeric, numeric, uuid, text) from public;
grant execute on function public.create_food_short(text, text, text, text, numeric, numeric, uuid, text) to authenticated;


-- =================================================================== V9_6_FOLLOWED_FOOD_SHORTS
-- Customers can see active shorts from followed vendors even without a saved
-- delivery pin or when they are outside the vendor's nearby reach.
alter table public.food_shorts
  add column if not exists shop_link text
  check (shop_link is null or (char_length(shop_link) <= 2048 and shop_link ~* '^https?://'));

drop function if exists public.nearby_food_shorts(double precision, double precision, numeric, integer);
create function public.nearby_food_shorts(
  p_lat double precision, p_lng double precision, p_radius_km numeric default 30, p_limit int default 60
) returns table (
  id uuid, vendor_id uuid, vendor_name text, vendor_category text, product_id uuid, shop_link text,
  title text, caption text, video_url text, thumb_url text, duration_s numeric, reach_km numeric,
  view_count int, like_count bigint, liked boolean, created_at timestamptz, distance_km double precision
)
language sql stable security definer set search_path = public as $$
  with d as (
    select s.*, v.name as vendor_name, v.category as vendor_category,
      case
        when p_lat is not null and p_lng is not null and v.latitude is not null and v.longitude is not null
        then 6371 * 2 * asin(least(1, sqrt(
          power(sin(radians(v.latitude::double precision - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(v.latitude::double precision))
          * power(sin(radians(v.longitude::double precision - p_lng) / 2), 2)
        )))
        else null
      end as dist
    from public.food_shorts s
    join public.vendors v on v.id = s.vendor_id
    where s.status = 'active'
      and v.verification_status = 'verified'
      and v.operational_status = 'active'
      and v.marketplace_visible
  )
  select d.id, d.vendor_id, d.vendor_name, d.vendor_category, d.product_id, d.shop_link,
    d.title, d.caption, d.video_url, d.thumb_url, d.duration_s, d.reach_km, d.view_count,
    (select count(*) from public.food_short_likes l where l.short_id = d.id),
    exists (select 1 from public.food_short_likes l where l.short_id = d.id and l.user_id = auth.uid()),
    d.created_at, d.dist
  from d
  where auth.uid() is not null and (
    (d.dist is not null and d.dist <= least(d.reach_km::double precision, p_radius_km::double precision))
    or exists (
      select 1 from public.vendor_follows f
      where f.follower_id = auth.uid() and f.vendor_id = d.vendor_id
    )
  )
  order by d.created_at desc
  limit least(greatest(coalesce(p_limit, 60), 1), 100);
$$;
revoke all on function public.nearby_food_shorts(double precision, double precision, numeric, integer) from public;
grant execute on function public.nearby_food_shorts(double precision, double precision, numeric, integer) to authenticated;


-- =================================================================== V9_7_PRIVATE_CUSTOMER_ACCOUNTS
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


-- =================================================================== V9_8_FOLLOW_NOTIFICATIONS
-- Notify customers about private-account follow requests and vendors about new followers.

create or replace function public.follow_person(p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  target_is_private boolean;
  inserted_count integer;
begin
  if auth.uid() is null or public.current_app_role() <> 'customer' then
    raise exception 'Sign in as a customer to follow people';
  end if;
  if p_user = auth.uid() then raise exception 'You cannot follow yourself'; end if;
  if not exists (select 1 from public.profiles where id = p_user and role = 'customer') then
    raise exception 'That person was not found';
  end if;
  if exists (select 1 from public.customer_follows where follower_id = auth.uid() and followee_id = p_user) then
    return 'following';
  end if;

  select sp.private_account into target_is_private
  from public.social_profiles sp where sp.user_id = p_user;
  if coalesce(target_is_private, false) then
    insert into public.customer_follow_requests(requester_id, recipient_id)
    values (auth.uid(), p_user) on conflict do nothing;
    get diagnostics inserted_count = row_count;
    if inserted_count > 0 then
      insert into public.notifications(recipient_id, kind, title, body, entity_type, entity_id)
      select p_user, 'follow_request', 'New follow request', '@' || sp.handle || ' wants to follow your private account.',
        'customer_follow_request', auth.uid()::text
      from public.social_profiles sp where sp.user_id = auth.uid();
    end if;
    return 'requested';
  end if;

  if (select count(*) from public.customer_follows where follower_id = auth.uid()) >= 1000 then
    raise exception 'You can follow up to 1,000 people';
  end if;
  insert into public.customer_follows(follower_id, followee_id)
  values (auth.uid(), p_user) on conflict do nothing;
  return 'following';
end;
$$;

create or replace function public.unfollow_person(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.customer_follows where follower_id = auth.uid() and followee_id = p_user;
  delete from public.customer_follow_requests where requester_id = auth.uid() and recipient_id = p_user;
  update public.notifications set read_at = now()
  where recipient_id = p_user and kind = 'follow_request'
    and entity_type = 'customer_follow_request' and entity_id = auth.uid()::text and read_at is null;
end;
$$;

create or replace function public.respond_follow_request(p_user uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.current_app_role() <> 'customer' then
    raise exception 'Sign in as a customer to manage follow requests';
  end if;
  if not exists (
    select 1 from public.customer_follow_requests
    where requester_id = p_user and recipient_id = auth.uid()
  ) then
    raise exception 'This follow request is no longer available';
  end if;
  if p_accept then
    if (select count(*) from public.customer_follows where follower_id = p_user) >= 1000 then
      raise exception 'This customer has reached the follow limit';
    end if;
    insert into public.customer_follows(follower_id, followee_id)
    values (p_user, auth.uid()) on conflict do nothing;
    insert into public.notifications(recipient_id, kind, title, body, entity_type, entity_id)
    select p_user, 'follow_request_accepted', 'Follow request accepted',
      '@' || coalesce(sp.handle, 'A customer') || ' accepted your follow request.',
      'customer_follow_request_accepted', auth.uid()::text
    from public.profiles p
    left join public.social_profiles sp on sp.user_id = p.id
    where p.id = auth.uid();
  end if;
  delete from public.customer_follow_requests where requester_id = p_user and recipient_id = auth.uid();
  update public.notifications set read_at = now()
  where recipient_id = auth.uid() and kind = 'follow_request'
    and entity_type = 'customer_follow_request' and entity_id = p_user::text and read_at is null;
end;
$$;

create or replace function public.follow_vendor(p_vendor uuid, p_follow boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  vendor_owner uuid;
  inserted_count integer;
begin
  if auth.uid() is null or public.current_app_role() <> 'customer' then
    raise exception 'Sign in as a customer to follow vendors';
  end if;
  select v.owner_id into vendor_owner from public.vendors v where v.id = p_vendor;
  if vendor_owner is null then raise exception 'That vendor was not found'; end if;

  if p_follow then
    insert into public.vendor_follows(follower_id, vendor_id)
    values (auth.uid(), p_vendor) on conflict do nothing;
    get diagnostics inserted_count = row_count;
    if inserted_count > 0 then
      insert into public.notifications(recipient_id, kind, title, body, entity_type, entity_id)
      select vendor_owner, 'vendor_follower', 'New customer follower',
        '@' || sp.handle || ' started following your store.',
        'vendor_follower', p_vendor::text
      from public.social_profiles sp where sp.user_id = auth.uid();
    end if;
  else
    delete from public.vendor_follows where follower_id = auth.uid() and vendor_id = p_vendor;
  end if;
end;
$$;

create or replace function public.list_vendor_followers(p_vendor uuid)
returns table (user_id uuid, handle text, bio text, followed_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.vendors v where v.id = p_vendor and v.owner_id = auth.uid()
  ) then
    raise exception 'Only this vendor can view its customer followers';
  end if;
  return query
  select f.follower_id, coalesce(sp.handle, 'customer'), coalesce(sp.bio, ''), f.created_at
  from public.vendor_follows f
  left join public.social_profiles sp on sp.user_id = f.follower_id
  where f.vendor_id = p_vendor
  order by f.created_at desc
  limit 500;
end;
$$;

revoke all on function public.follow_person(uuid) from public, anon;
revoke all on function public.unfollow_person(uuid) from public, anon;
revoke all on function public.respond_follow_request(uuid, boolean) from public, anon;
revoke all on function public.follow_vendor(uuid, boolean) from public, anon;
revoke all on function public.list_vendor_followers(uuid) from public, anon;
grant execute on function public.follow_person(uuid) to authenticated;
grant execute on function public.unfollow_person(uuid) to authenticated;
grant execute on function public.respond_follow_request(uuid, boolean) to authenticated;
grant execute on function public.follow_vendor(uuid, boolean) to authenticated;
grant execute on function public.list_vendor_followers(uuid) to authenticated;


-- =================================================================== V9_10_ORDER_DELIVERY_ADDRESS
alter table public.orders
  add column if not exists delivery_address text;

commit;
