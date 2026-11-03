import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

type Role = "customer" | "vendor" | "operations" | "admin";

function clients(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !service || !token) return null;
  return {
    token,
    caller: createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }),
    admin: createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } }),
  };
}

type AdminClient = NonNullable<ReturnType<typeof clients>>["admin"];

function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function identity(request: Request) {
  const c = clients(request);
  if (!c) return null;
  const { data: authData } = await c.caller.auth.getUser(c.token);
  if (!authData.user) return null;
  const { data: profile } = await c.caller.from("profiles").select("id,full_name,role,vendor_id").eq("id", authData.user.id).maybeSingle();
  if (!profile) return null;
  return { ...c, user: authData.user, profile: profile as { id: string; full_name: string; role: Role; vendor_id: string | null } };
}

function orderNumber() {
  return `SP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function addDays(dateISO: string, days: number) {
  const date = new Date(`${dateISO}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function scheduleDates(schedule: { start_date: string; end_date?: string | null; recurrence: string; weekdays?: number[] | null }) {
  const start = String(schedule.start_date);
  const mode = String(schedule.recurrence || "once");
  if (mode === "once") return [start];
  const defaultHorizon = mode === "daily" ? 29 : mode === "weekly" ? 27 : 27;
  const end = schedule.end_date ? String(schedule.end_date) : addDays(start, defaultHorizon);
  const out: string[] = [];
  for (let cursor = start, guard = 0; cursor <= end && guard < 366; cursor = addDays(cursor, 1), guard++) {
    const day = new Date(`${cursor}T12:00:00Z`).getUTCDay();
    if (mode === "daily" || (mode === "weekly" && day === new Date(`${start}T12:00:00Z`).getUTCDay()) || (mode === "custom" && (schedule.weekdays || []).includes(day))) {
      out.push(cursor);
    }
  }
  return out.length ? out : [start];
}

async function draftCartForCustomer(admin: AdminClient, customerId: string) {
  const cart = await admin.from("commerce_carts").select("id,status,created_by,created_at,updated_at").eq("customer_id", customerId).eq("status", "draft").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (cart.error) throw cart.error;
  if (!cart.data) return { cart: null, items: [] as Array<Record<string, unknown>> };
  const items = await admin.from("commerce_cart_items").select("id,cart_id,menu_item_id,vendor_id,quantity,unit,unit_price,created_at").eq("cart_id", cart.data.id).order("created_at", { ascending: true });
  if (items.error) throw items.error;
  return { cart: cart.data as Record<string, unknown>, items: (items.data || []) as Array<Record<string, unknown>> };
}

async function commerceSnapshot(ctx: Awaited<ReturnType<typeof identity>>) {
  if (!ctx) throw new Error("Unauthorised");
  const { admin, profile } = ctx;
  const role = profile.role;
  const orderQuery = admin.from("orders").select("id,order_number,schedule_id,customer_id,vendor_id,vendor_base_total,markup_total,tax_amount,delivery_fee,customer_total,delivery_address,fulfilment_mode,scheduled_date,scheduled_slot,status,tracking_latitude,tracking_longitude,cancellation_fee,created_at,order_items(id,product_name,quantity,unit,vendor_base_price,customer_price),payments(id,amount,status,provider,provider_reference,created_at)").order("scheduled_date", { ascending: true }).limit(500);
  if (role === "customer") orderQuery.eq("customer_id", profile.id);
  if (role === "vendor") {
    if (!profile.vendor_id) return { orders: [], schedules: [], staff: [], assignments: [] };
    orderQuery.eq("vendor_id", profile.vendor_id);
  }
  const schedulesQuery = admin.from("product_schedules").select("id,customer_id,vendor_id,menu_item_id,start_date,end_date,recurrence,weekdays,scheduled_slot,quantity,unit,fulfilment_mode,status,next_delivery_at,whatsapp_reminder_enabled,created_at").order("start_date", { ascending: true }).limit(500);
  if (role === "customer") schedulesQuery.eq("customer_id", profile.id);
  if (role === "vendor" && profile.vendor_id) schedulesQuery.eq("vendor_id", profile.vendor_id);

  const [orders, schedules] = await Promise.all([orderQuery, schedulesQuery]);
  if (orders.error) throw orders.error;
  if (schedules.error) throw schedules.error;
  const orderIds = (orders.data || []).map((order) => String(order.id));
  const deliveryRequests = await admin.from("third_party_delivery_requests")
    .select("order_id,customer_id,vendor_id,customer_notes,status,accepted_at,code_expires_at,code_issued_count,delivered_at,created_at,updated_at")
    .in("order_id", orderIds);
  const deliveryMigrationMissing = Boolean(deliveryRequests.error && (
    deliveryRequests.error.code === "42P01" ||
    deliveryRequests.error.code === "PGRST205" ||
    /third_party_delivery_requests.*(does not exist|not found)|could not find the table .*third_party_delivery_requests/i.test(deliveryRequests.error.message || "")
  ));
  if (deliveryRequests.error && !deliveryMigrationMissing) throw deliveryRequests.error;

  let staff: unknown[] = [];
  let assignments: Array<{ delivery_staff_id?: unknown; [key: string]: unknown }> = [];
  if (role === "vendor" && profile.vendor_id) {
    const [staffResult, assignmentResult] = await Promise.all([
      admin.from("vendor_delivery_staff").select("id,vendor_id,full_name,phone,active,created_at,updated_at").eq("vendor_id", profile.vendor_id).order("created_at"),
      admin.from("delivery_assignments").select("id,order_id,vendor_id,delivery_staff_id,assigned_at,completed_at").eq("vendor_id", profile.vendor_id),
    ]);
    if (staffResult.error) throw staffResult.error;
    if (assignmentResult.error) throw assignmentResult.error;
    staff = staffResult.data || [];
    assignments = assignmentResult.data || [];
  } else if (role === "customer" && orders.data?.length) {
    const customerOrderIds = orders.data.map((order) => String(order.id));
    const assignmentResult = await admin.from("delivery_assignments")
      .select("id,order_id,vendor_id,delivery_staff_id,assigned_at,completed_at")
      .in("order_id", customerOrderIds);
    if (assignmentResult.error) throw assignmentResult.error;
    assignments = assignmentResult.data || [];
    const assignedStaffIds = [...new Set(assignments.map((assignment) => String(assignment.delivery_staff_id)))];
    if (assignedStaffIds.length) {
      const staffResult = await admin.from("vendor_delivery_staff")
        .select("id,vendor_id,full_name,phone,active")
        .in("id", assignedStaffIds);
      if (staffResult.error) throw staffResult.error;
      staff = staffResult.data || [];
    }
  } else if (role === "operations" || role === "admin") {
    const [staffResult, assignmentResult] = await Promise.all([
      admin.from("vendor_delivery_staff").select("id,vendor_id,full_name,phone,active,created_at,updated_at").order("created_at"),
      admin.from("delivery_assignments").select("id,order_id,vendor_id,delivery_staff_id,assigned_at,completed_at"),
    ]);
    if (!staffResult.error) staff = staffResult.data || [];
    if (!assignmentResult.error) assignments = assignmentResult.data || [];
  }
  let cart: Record<string, unknown> | null = null;
  let cartItems: Array<Record<string, unknown>> = [];
  if (role === "customer") {
    const draft = await draftCartForCustomer(admin, profile.id);
    cart = draft.cart;
    cartItems = draft.items;
  }
  return {
    orders: orders.data || [], schedules: schedules.data || [], staff, assignments, cart, cartItems,
    thirdPartyDeliveries: deliveryRequests.data || [],
    thirdPartyDeliveryAvailable: !deliveryMigrationMissing,
  };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function POST(request: Request) {
  const ctx = await identity(request);
  if (!ctx) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const { admin, profile } = ctx;

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");

    // -----------------------------------------------------------------------------------
    // ACTION: create_order
    // -----------------------------------------------------------------------------------
    if (action === "create_order") {
      if (profile.role !== "customer") {
        return NextResponse.json({ error: "Customer access required." }, { status: 403 });
      }

      const orderId = String(body.orderId || "").trim();
      if (!orderId) {
        return NextResponse.json({ error: "Missing order ID." }, { status: 400 });
      }

      // Retrieve order and verify ownership
      const { data: order, error: orderError } = await admin
        .from("orders")
        .select("id,order_number,schedule_id,customer_id,vendor_id,vendor_base_total,markup_total,tax_amount,delivery_fee,customer_total,scheduled_date,scheduled_slot,status")
        .eq("id", orderId)
        .eq("customer_id", profile.id)
        .maybeSingle();

      if (orderError || !order) {
        return NextResponse.json({ error: "Order not found." }, { status: 404 });
      }

      // Check pending payment
      const { data: payment, error: paymentError } = await admin
        .from("payments")
        .select("id,amount,status,provider,provider_reference,created_at")
        .eq("order_id", order.id)
        .eq("customer_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paymentError) throw paymentError;
      if (!payment) {
        return NextResponse.json({ error: "No payment record found for this order." }, { status: 404 });
      }
      if (order.status === "cancelled") {
        return NextResponse.json({ error: "This unpaid order was removed and can no longer be paid." }, { status: 409 });
      }
      if (payment.status === "paid" || order.status === "confirmed") {
        return NextResponse.json({ error: "This order has already been paid and confirmed." }, { status: 400 });
      }
      if (order.scheduled_date < todayInIndia()) {
        return NextResponse.json({
          error: `The scheduled date (${order.scheduled_date}) has already passed, so this order can no longer be paid.`,
        }, { status: 409 });
      }

      // Trusted pricing recalculation from DB
      let totalPayableRupees = 0;

      if (order.schedule_id) {
        const { data: schedule, error: schedError } = await admin
          .from("product_schedules")
          .select("id,menu_item_id,start_date,end_date,recurrence,weekdays,quantity,unit,status")
          .eq("id", order.schedule_id)
          .eq("customer_id", profile.id)
          .maybeSingle();

        if (schedError || !schedule) {
          return NextResponse.json({ error: "Associated schedule record not found." }, { status: 404 });
        }

        // Fetch vendor base price from vendor_menu_items
        const { data: menuItem, error: menuError } = await admin
          .from("vendor_menu_items")
          .select("id,vendor_base_price,active,stock_quantity")
          .eq("id", schedule.menu_item_id)
          .maybeSingle();

        if (menuError || !menuItem || !menuItem.active || Number(menuItem.stock_quantity) <= 0) {
          return NextResponse.json({ error: "This menu item is no longer available." }, { status: 409 });
        }

        // Fetch operations markup from vendor_item_markups
        const { data: markupData } = await admin
          .from("vendor_item_markups")
          .select("markup_percent")
          .eq("menu_item_id", menuItem.id)
          .maybeSingle();

        const basePrice = Math.max(0, Number(menuItem.vendor_base_price || 0));
        const markupPercent = Math.max(0, Number(markupData?.markup_percent || 0));
        const customerUnitPrice = Math.round(basePrice * (1 + markupPercent / 100) * 100) / 100;
        const quantity = Math.max(0.001, Number(schedule.quantity || 1));
        const perDeliveryTotal = Math.round(customerUnitPrice * quantity * 100) / 100;

        const dates = scheduleDates(schedule as { start_date: string; end_date?: string | null; recurrence: string; weekdays?: number[] | null });
        const occurrences = Math.max(1, dates.length);

        totalPayableRupees = Math.round(perDeliveryTotal * occurrences * 100) / 100;

        // Sync order and payment with trusted recalculated amounts
        await admin.from("orders").update({
          vendor_base_total: Math.round(basePrice * quantity * 100) / 100,
          markup_total: Math.round(Math.max(0, perDeliveryTotal - (basePrice * quantity)) * 100) / 100,
          customer_total: perDeliveryTotal,
          updated_at: new Date().toISOString(),
        }).eq("id", order.id);

        await admin.from("payments").update({
          amount: totalPayableRupees,
          updated_at: new Date().toISOString(),
        }).eq("id", payment.id);
      } else {
        // Cart / Non-schedule Order
        const { data: items, error: itemsError } = await admin
          .from("order_items")
          .select("id,product_name,quantity,unit,vendor_base_price,markup_percent,customer_price")
          .eq("order_id", order.id);

        if (itemsError || !items || !items.length) {
          return NextResponse.json({ error: "No items found in this order." }, { status: 400 });
        }

        let calculatedBaseTotal = 0;
        let calculatedCustomerTotal = 0;

        for (const item of items) {
          const qty = Math.max(0.001, Number(item.quantity || 1));
          // Look up current product and markup
          const { data: prod } = await admin
            .from("vendor_menu_items")
            .select("id,vendor_base_price")
            .eq("vendor_id", order.vendor_id)
            .eq("name", item.product_name)
            .maybeSingle();

          const base = Number(prod?.vendor_base_price ?? item.vendor_base_price ?? 0);
          let markup = Number(item.markup_percent ?? 0);
          if (prod?.id) {
            const { data: mkp } = await admin
              .from("vendor_item_markups")
              .select("markup_percent")
              .eq("menu_item_id", prod.id)
              .maybeSingle();
            if (mkp?.markup_percent !== undefined) markup = Number(mkp.markup_percent);
          }
          const unitPrice = Math.round(base * (1 + markup / 100) * 100) / 100;
          calculatedBaseTotal += base * qty;
          calculatedCustomerTotal += unitPrice * qty;
        }

        totalPayableRupees = Math.round(calculatedCustomerTotal * 100) / 100;

        await admin.from("orders").update({
          vendor_base_total: Math.round(calculatedBaseTotal * 100) / 100,
          markup_total: Math.round(Math.max(0, calculatedCustomerTotal - calculatedBaseTotal) * 100) / 100,
          customer_total: totalPayableRupees,
          updated_at: new Date().toISOString(),
        }).eq("id", order.id);

        await admin.from("payments").update({
          amount: totalPayableRupees,
          updated_at: new Date().toISOString(),
        }).eq("id", payment.id);
      }

      const totalPaise = Math.round(totalPayableRupees * 100);
      if (totalPaise < 100) {
        return NextResponse.json({ error: "Payable amount must be at least ₹1.00." }, { status: 400 });
      }

      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keyId || !keySecret) {
        return NextResponse.json({ error: "Razorpay payment gateway is not configured on the server." }, { status: 500 });
      }

      // Safe idempotency: If payment already has a Razorpay order reference, check if it can be reused
      const existingRzpOrderId = payment.provider_reference?.startsWith("order_") ? payment.provider_reference : null;
      if (existingRzpOrderId) {
        try {
          const checkRes = await fetch(`https://api.razorpay.com/v1/orders/${existingRzpOrderId}`, {
            headers: {
              Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
            },
          });
          if (checkRes.ok) {
            const existingOrder = await checkRes.json();
            if (
              existingOrder &&
              (existingOrder.status === "created" || existingOrder.status === "attempted") &&
              Number(existingOrder.amount) === totalPaise
            ) {
              return NextResponse.json({
                ok: true,
                keyId,
                razorpayOrderId: existingOrder.id,
                amount: totalPaise,
                currency: "INR",
                orderNumber: order.order_number,
                orderId: order.id,
                customer: {
                  name: profile.full_name || "",
                  email: ctx.user.email || "",
                },
                description: `ShePlates Order ${order.order_number}`,
              });
            }
          }
        } catch {
          // If check fails, fall through to creating a fresh Razorpay order
        }
      }

      // Create Razorpay order via official REST API
      const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: totalPaise,
          currency: "INR",
          receipt: order.order_number,
          notes: {
            order_id: order.id,
            customer_id: profile.id,
            schedule_id: order.schedule_id || "",
          },
        }),
      });

      if (!rzpRes.ok) {
        const errData = await rzpRes.json().catch(() => ({}));
        const message = errData?.error?.description || "Unable to initiate Razorpay transaction.";
        return NextResponse.json({ error: message }, { status: 502 });
      }

      const rzpOrder = await rzpRes.json();

      // Store Razorpay order ID in payments record
      await admin.from("payments").update({
        provider: "razorpay",
        provider_reference: rzpOrder.id,
        updated_at: new Date().toISOString(),
      }).eq("id", payment.id);

      return NextResponse.json({
        ok: true,
        keyId,
        razorpayOrderId: rzpOrder.id,
        amount: totalPaise,
        currency: "INR",
        orderNumber: order.order_number,
        orderId: order.id,
        customer: {
          name: profile.full_name || "",
          email: ctx.user.email || "",
        },
        description: `ShePlates Order ${order.order_number}`,
      });
    }

    // -----------------------------------------------------------------------------------
    // ACTION: verify_payment
    // -----------------------------------------------------------------------------------
    if (action === "verify_payment") {
      if (profile.role !== "customer") {
        return NextResponse.json({ error: "Customer access required." }, { status: 403 });
      }

      const orderId = String(body.orderId || "").trim();
      const razorpayOrderId = String(body.razorpay_order_id || "").trim();
      const razorpayPaymentId = String(body.razorpay_payment_id || "").trim();
      const razorpaySignature = String(body.razorpay_signature || "").trim();

      if (!orderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return NextResponse.json({ error: "Missing required payment verification details." }, { status: 400 });
      }

      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        return NextResponse.json({ error: "Razorpay secret key is not configured on the server." }, { status: 500 });
      }

      // Verify HMAC SHA-256 signature
      const expectedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      const isValid = timingSafeEqualHex(expectedSignature, razorpaySignature);
      if (!isValid) {
        return NextResponse.json({ error: "Payment verification failed: invalid signature." }, { status: 400 });
      }

      // Find order and pending payment
      const { data: order, error: orderError } = await admin
        .from("orders")
        .select("id,order_number,schedule_id,customer_id,vendor_id,customer_total,scheduled_date,scheduled_slot,fulfilment_mode,vendor_base_total,markup_total,tax_amount,delivery_fee,status,order_items(product_name,quantity,unit,vendor_base_price,markup_percent,customer_price),product_schedules(start_date,end_date,recurrence,weekdays)")
        .eq("id", orderId)
        .eq("customer_id", profile.id)
        .maybeSingle();

      if (orderError || !order) {
        return NextResponse.json({ error: "Order not found." }, { status: 404 });
      }

      // Find payment record
      const { data: payment, error: paymentError } = await admin
        .from("payments")
        .select("id,status,provider_reference")
        .eq("order_id", order.id)
        .eq("customer_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paymentError || !payment) {
        return NextResponse.json({ error: "Payment record not found." }, { status: 404 });
      }

      if (order.status === "cancelled") {
        return NextResponse.json({ error: "This unpaid order was removed and can no longer be paid." }, { status: 409 });
      }

      // If already paid, return existing snapshot idempotently
      if (payment.status === "paid" && order.status === "confirmed") {
        return NextResponse.json({ ok: true, orderId: order.id, snapshot: await commerceSnapshot(ctx) });
      }

      // Atomically update payment to paid with razorpay_payment_id
      const paymentUpdate = await admin.from("payments").update({
        status: "paid",
        provider: "razorpay",
        provider_reference: razorpayPaymentId,
        updated_at: new Date().toISOString(),
      }).eq("id", payment.id);

      if (paymentUpdate.error) throw paymentUpdate.error;

      // Update primary order to confirmed
      const orderUpdate = await admin.from("orders").update({
        status: "confirmed",
        updated_at: new Date().toISOString(),
      }).eq("id", order.id);

      if (orderUpdate.error) throw orderUpdate.error;

      // If linked to a product schedule, activate schedule and generate remaining delivery orders
      const rawSchedule = Array.isArray(order.product_schedules) ? order.product_schedules[0] : order.product_schedules;
      if (order.schedule_id) {
        await admin.from("product_schedules").update({
          status: "active",
          updated_at: new Date().toISOString(),
        }).eq("id", order.schedule_id).eq("status", "awaiting_payment");
      }

      if (rawSchedule && order.schedule_id) {
        const dates = scheduleDates(rawSchedule as { start_date: string; end_date?: string | null; recurrence: string; weekdays?: number[] | null });
        const firstItem = Array.isArray(order.order_items) ? order.order_items[0] : order.order_items;
        const remainingDates = dates.filter((d) => d !== String(order.scheduled_date));

        for (const date of remainingDates) {
          const duplicate = await admin.from("orders").select("id").eq("schedule_id", order.schedule_id).eq("scheduled_date", date).maybeSingle();
          if (duplicate.data?.id) continue;

          const created = await admin.from("orders").insert({
            order_number: orderNumber(),
            schedule_id: order.schedule_id,
            customer_id: order.customer_id,
            vendor_id: order.vendor_id,
            vendor_base_total: Number(order.vendor_base_total || 0),
            markup_total: Number(order.markup_total || 0),
            tax_amount: Number(order.tax_amount || 0),
            delivery_fee: Number(order.delivery_fee || 0),
            customer_total: Number(order.customer_total || 0),
            fulfilment_mode: order.fulfilment_mode,
            scheduled_date: date,
            scheduled_slot: order.scheduled_slot,
            status: "confirmed",
          }).select("id").single();

          if (created.error) throw created.error;

          if (firstItem) {
            const item = firstItem as Record<string, unknown>;
            await admin.from("order_items").insert({
              order_id: created.data.id,
              product_name: String(item.product_name || "Scheduled item"),
              quantity: Number(item.quantity || 1),
              unit: String(item.unit || "pack"),
              vendor_base_price: Number(item.vendor_base_price || 0),
              markup_percent: Number(item.markup_percent || 0),
              customer_price: Number(item.customer_price || 0),
            });
          }

          await admin.from("payments").insert({
            order_id: created.data.id,
            customer_id: profile.id,
            amount: 0,
            status: "paid",
            provider: "schedule_prepaid",
            provider_reference: `COVERED-${order.id}`,
          });
        }
      }

      // Notifications & Outbox updates
      const { data: vendor } = await admin.from("vendors").select("owner_id,name").eq("id", order.vendor_id).maybeSingle();
      if (vendor?.owner_id) {
        await admin.from("notifications").insert({
          recipient_id: vendor.owner_id,
          kind: "new_order",
          title: "New paid order",
          body: `${order.order_number} is confirmed for ${order.scheduled_date}.`,
          entity_type: "order",
          entity_id: order.id,
        });
      }

      await admin.from("notifications").insert({
        recipient_id: profile.id,
        kind: "payment",
        title: "Payment confirmed",
        body: `${order.order_number} is confirmed via Razorpay and sent to the vendor.`,
        entity_type: "order",
        entity_id: order.id,
      });

      await admin.from("communication_outbox").update({
        status: "cancelled",
      }).eq("recipient_id", profile.id).eq("template_key", "payment_reminder").contains("payload", { orderId: order.id }).eq("status", "queued");

      return NextResponse.json({
        ok: true,
        orderId: order.id,
        snapshot: await commerceSnapshot(ctx),
      });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Payment processing failed.",
    }, { status: 500 });
  }
}
