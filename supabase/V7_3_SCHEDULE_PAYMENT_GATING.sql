-- V7.3 — schedules must not read as "active" before the first payment clears.
-- Previously `create_schedule` inserted status='active' immediately; customers only
-- avoided seeing an unpaid schedule because the client happened to filter "My schedule"
-- by order.payment. This adds a real 'awaiting_payment' state to the schedule row itself
-- so any future server-side or vendor/ops view that reads product_schedules.status
-- directly reflects the truth. app/api/commerce/route.ts now inserts schedules as
-- 'awaiting_payment' and flips them to 'active' inside the mark_paid action.

alter table public.product_schedules drop constraint if exists product_schedules_status_check;
alter table public.product_schedules add constraint product_schedules_status_check
  check (status in ('awaiting_payment','active','paused','completed','cancelled'));
