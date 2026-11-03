-- OPTIONAL ONE-TIME RESET for V2.1 test data before testing the V3 empty flow.
-- Keeps Supabase Auth users and public.profiles. Deletes business/transaction data.
-- Run after V3_UPGRADE.sql. Review the target project before executing.

begin;
delete from public.communication_outbox;
delete from public.support_ticket_messages;
delete from public.support_tickets;
delete from public.delivery_tracking_events;
delete from public.commerce_cart_items;
delete from public.commerce_carts;
delete from public.vendor_outlets;
delete from public.customer_addresses;
delete from public.agent_messages;
delete from public.agent_conversations;
delete from public.push_subscriptions;
delete from public.notifications;
delete from public.delivery_assignments;
delete from public.vendor_delivery_staff;
delete from public.vendor_daily_service_settings;
delete from public.payment_reversals;
delete from public.cancellation_requests;
delete from public.payments;
delete from public.order_items;
delete from public.orders;
delete from public.product_schedules;
delete from public.vendor_quote_items;
delete from public.vendor_quotes;
delete from public.rfq_vendor_invitations;
delete from public.requirement_items;
delete from public.customer_requirement_files;
delete from public.customer_requirements;
delete from public.vendor_item_markups;
delete from public.vendor_menu_items;
delete from public.vendor_documents;
update public.profiles set vendor_id=null where vendor_id is not null;
delete from public.vendors;
delete from public.customer_preferences;
delete from public.ai_actions;
delete from public.audit_logs;
commit;
