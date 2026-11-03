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
