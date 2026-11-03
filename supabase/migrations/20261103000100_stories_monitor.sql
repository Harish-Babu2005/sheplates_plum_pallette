-- Stories monitor: customers can report a status, and Operations / Super Admin can review reported statuses
-- and vendor Food Shorts in one place, remove what breaks the community rules and tell the author why.
--
-- Additive and safe to re-run. Needs V9_3_PEOPLE_STATUS.sql (customer_statuses, social_profiles) and
-- V8_4_FOOD_SHORTS.sql (food_shorts). Nothing here changes how statuses or shorts are shown to customers.
--
-- Access: the two new tables have row level security on and NO policies, so they cannot be read or written
-- directly. Everything goes through the security-definer functions below, each of which checks the caller's role.

create table if not exists public.status_reports (
  id uuid primary key default gen_random_uuid(),
  status_id uuid not null references public.customer_statuses(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  unique (status_id, reporter_id)
);
create index if not exists status_reports_status_idx on public.status_reports(status_id);
alter table public.status_reports enable row level security;

create table if not exists public.status_moderation_log (
  id uuid primary key default gen_random_uuid(),
  status_id uuid,
  author_id uuid references public.profiles(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('removed', 'kept')),
  reason text not null default '',
  caption text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists status_moderation_log_created_idx on public.status_moderation_log(created_at desc);
alter table public.status_moderation_log enable row level security;

-- A customer reports somebody else's live status. One report per person per status.
create or replace function public.report_status(p_status uuid, p_reason text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.current_app_role() <> 'customer' then raise exception 'Sign in as a customer to report a status'; end if;
  if not exists (select 1 from public.customer_statuses s where s.id = p_status and s.expires_at > now()) then raise exception 'That status is no longer available'; end if;
  if exists (select 1 from public.customer_statuses s where s.id = p_status and s.author_id = auth.uid()) then raise exception 'You cannot report your own status'; end if;
  insert into public.status_reports(status_id, reporter_id, reason)
  values (p_status, auth.uid(), left(coalesce(p_reason, ''), 300))
  on conflict (status_id, reporter_id) do nothing;
end;
$$;

create or replace function public.assert_stories_staff() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or public.current_app_role() not in ('operations', 'admin') then raise exception 'Only Operations or Super Admin can use the Stories monitor'; end if;
end;
$$;

-- The four numbers on top of the page.
create or replace function public.stories_monitor_summary()
returns table (live_statuses bigint, reported bigint, removed_this_week bigint, food_shorts_live bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_stories_staff();
  return query select
    (select count(*) from public.customer_statuses s where s.expires_at > now()),
    (select count(distinct r.status_id) from public.status_reports r join public.customer_statuses s on s.id = r.status_id where s.expires_at > now()),
    (select count(*) from public.status_moderation_log l where l.action = 'removed' and l.created_at > now() - interval '7 days'),
    (select count(*) from public.food_shorts f where f.status = 'active');
end;
$$;

-- Live customer statuses for review. p_filter: 'reported' (default), 'newest' or 'most_viewed'.
create or replace function public.monitor_statuses(p_filter text default 'reported')
returns table (id uuid, kind text, media_url text, thumb_url text, caption text, author_handle text, created_at timestamptz, expires_at timestamptz, report_count bigint, view_count bigint, last_reason text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_stories_staff();
  return query
  select s.id, s.kind, s.media_url, s.thumb_url, s.caption,
         coalesce(sp.handle, 'unknown') as author_handle, s.created_at, s.expires_at,
         (select count(*) from public.status_reports r where r.status_id = s.id) as report_count,
         (select count(*) from public.status_views v where v.status_id = s.id) as view_count,
         (select r.reason from public.status_reports r where r.status_id = s.id and r.reason <> '' order by r.created_at desc limit 1) as last_reason
  from public.customer_statuses s
  left join public.social_profiles sp on sp.user_id = s.author_id
  where s.expires_at > now()
    and (p_filter <> 'reported' or exists (select 1 from public.status_reports r where r.status_id = s.id))
  order by case when p_filter = 'most_viewed' then (select count(*) from public.status_views v where v.status_id = s.id) end desc nulls last,
           case when p_filter = 'reported' then (select count(*) from public.status_reports r where r.status_id = s.id) end desc nulls last,
           s.created_at desc
  limit 60;
end;
$$;

-- Remove a status at once, tell the author why, and return the file addresses so the app can delete the files.
create or replace function public.remove_status(p_status uuid, p_reason text)
returns table (m_url text, t_url text)
language plpgsql security definer set search_path = public as $$
declare target public.customer_statuses; why text := left(coalesce(nullif(btrim(p_reason), ''), 'It broke the community rules'), 200);
begin
  perform public.assert_stories_staff();
  select * into target from public.customer_statuses where id = p_status;
  if not found then raise exception 'That status was not found'; end if;
  insert into public.status_moderation_log(status_id, author_id, actor_id, action, reason, caption) values (target.id, target.author_id, auth.uid(), 'removed', why, left(target.caption, 200));
  insert into public.notifications(recipient_id, kind, title, body, entity_type, entity_id)
  values (target.author_id, 'general', 'Your status was removed', 'We removed your status because: ' || why, 'status', target.id::text);
  delete from public.customer_statuses where id = p_status;
  return query select target.media_url, target.thumb_url;
end;
$$;

-- Keep a reported status: the reports are cleared and the decision is logged.
create or replace function public.keep_status(p_status uuid) returns void
language plpgsql security definer set search_path = public as $$
declare target public.customer_statuses;
begin
  perform public.assert_stories_staff();
  select * into target from public.customer_statuses where id = p_status;
  if not found then return; end if;
  insert into public.status_moderation_log(status_id, author_id, actor_id, action, reason, caption) values (target.id, target.author_id, auth.uid(), 'kept', 'Reviewed and kept', left(target.caption, 200));
  delete from public.status_reports where status_id = p_status;
end;
$$;

-- Vendor Food Shorts for review.
create or replace function public.monitor_food_shorts()
returns table (id uuid, vendor_name text, title text, caption text, thumb_url text, video_url text, duration_s numeric, view_count int, status text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_stories_staff();
  return query
  select f.id, v.name, f.title, f.caption, f.thumb_url, f.video_url, f.duration_s, f.view_count, f.status, f.created_at
  from public.food_shorts f join public.vendors v on v.id = f.vendor_id
  where f.status in ('active', 'hidden')
  order by f.created_at desc limit 60;
end;
$$;

-- Staff can hide or remove a Food Short. 'removed' hides it for good; 'active' brings a hidden one back.
create or replace function public.set_food_short_status(p_short uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_stories_staff();
  if p_status not in ('active', 'hidden', 'removed') then raise exception 'Choose active, hidden or removed'; end if;
  update public.food_shorts set status = p_status, updated_at = now() where id = p_short;
end;
$$;

revoke all on function public.report_status(uuid, text), public.assert_stories_staff(), public.stories_monitor_summary(), public.monitor_statuses(text), public.remove_status(uuid, text), public.keep_status(uuid), public.monitor_food_shorts(), public.set_food_short_status(uuid, text) from public;
grant execute on function public.report_status(uuid, text), public.stories_monitor_summary(), public.monitor_statuses(text), public.remove_status(uuid, text), public.keep_status(uuid), public.monitor_food_shorts(), public.set_food_short_status(uuid, text) to authenticated;
