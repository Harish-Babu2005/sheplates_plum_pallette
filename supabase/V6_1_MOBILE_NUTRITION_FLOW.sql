-- ShePlates v6.1 — mobile flow + optional nutrition review
-- Safe to run after the existing v5 production migration.

alter table if exists public.vendor_menu_items
  add column if not exists nutrition_status text not null default 'pending_review',
  add column if not exists nutrition_confidence numeric(5,2),
  add column if not exists nutrition_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vendor_menu_items_nutrition_status_check'
  ) then
    alter table public.vendor_menu_items
      add constraint vendor_menu_items_nutrition_status_check
      check (nutrition_status in ('verified','estimated','pending_review'));
  end if;
end $$;

update public.vendor_menu_items
set nutrition_status = case
  when coalesce(calories_per_unit,0) > 0
    and coalesce(protein_g,0) + coalesce(carbs_g,0) + coalesce(fat_g,0) > 0
    then case when nutrition_status = 'verified' then 'verified' else 'estimated' end
  else 'pending_review'
end
where nutrition_status is null
   or nutrition_status not in ('verified','estimated','pending_review');

create index if not exists vendor_menu_items_nutrition_status_idx
  on public.vendor_menu_items (vendor_id, nutrition_status);

comment on column public.vendor_menu_items.nutrition_status is
  'Nutrition workflow state. Products may be published while pending_review; Operations should verify later.';
comment on column public.vendor_menu_items.nutrition_confidence is
  'Optional confidence score for an assisted nutrition estimate.';
comment on column public.vendor_menu_items.nutrition_note is
  'Human/assistant note describing the nutrition source or why review is required.';
