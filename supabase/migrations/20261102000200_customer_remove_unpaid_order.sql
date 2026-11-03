BEGIN;

CREATE OR REPLACE FUNCTION public.customer_remove_unpaid_order(p_order uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  order_row public.orders;
BEGIN
  IF auth.uid() IS NULL OR public.current_app_role() IS DISTINCT FROM 'customer'::public.app_role THEN
    RAISE EXCEPTION 'Customer access required';
  END IF;

  SELECT * INTO order_row
  FROM public.orders
  WHERE id = p_order AND customer_id = auth.uid()
  FOR UPDATE;

  IF order_row.id IS NULL THEN RAISE EXCEPTION 'Unpaid order not found'; END IF;
  IF order_row.status <> 'awarded' THEN RAISE EXCEPTION 'This order can no longer be removed'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.payments
    WHERE order_id = p_order AND customer_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.payments
    WHERE order_id = p_order AND customer_id = auth.uid() AND status <> 'pending'
  ) THEN
    RAISE EXCEPTION 'This order is no longer unpaid and cannot be removed';
  END IF;

  UPDATE public.orders
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_order AND customer_id = auth.uid();

  IF order_row.schedule_id IS NOT NULL THEN
    UPDATE public.product_schedules
    SET status = 'cancelled', updated_at = now()
    WHERE id = order_row.schedule_id
      AND customer_id = auth.uid()
      AND status = 'awaiting_payment';
  END IF;

  UPDATE public.communication_outbox
  SET status = 'cancelled'
  WHERE recipient_id = auth.uid()
    AND template_key = 'payment_reminder'
    AND payload @> jsonb_build_object('orderId', p_order::text)
    AND status = 'queued';
END
$function$;

REVOKE ALL ON FUNCTION public.customer_remove_unpaid_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_remove_unpaid_order(uuid) TO authenticated;

COMMIT;
