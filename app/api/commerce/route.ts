import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateDeliveryVerificationCode, hashDeliveryVerificationCode } from "@/lib/third-party-delivery.mjs";

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

function errorDetails(error: unknown) {
  if (error instanceof Error) return { message: error.message, code: "" };
  if (typeof error === "object" && error !== null) {
    const value = error as { message?: unknown; code?: unknown };
    return {
      message: typeof value.message === "string" ? value.message : "",
      code: typeof value.code === "string" ? value.code : "",
    };
  }
  return { message: "", code: "" };
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

function recurrence(value: string) {
  const v = value.toLowerCase();
  return ["once", "daily", "weekly", "custom"].includes(v) ? v : "once";
}

function fulfilment(value: string) {
  if (/third[\s-]*party/i.test(value)) return "third_party_delivery";
  return /pickup/i.test(value) ? "self_pickup" : "vendor_delivery";
}

function resolveFulfilmentMode(vendor: { delivery_enabled?: boolean | null; pickup_enabled?: boolean | null } | null | undefined, requestedMode: string) {
  const deliveryEnabled = vendor?.delivery_enabled !== false;
  const pickupEnabled = vendor?.pickup_enabled === true;
  const requested = fulfilment(requestedMode);
  if (requested === "third_party_delivery") return requested;
  if (requested === "self_pickup" && pickupEnabled) return "self_pickup";
  if (requested === "vendor_delivery" && deliveryEnabled) return "vendor_delivery";
  if (deliveryEnabled) return "vendor_delivery";
  if (pickupEnabled) return "self_pickup";
  return null;
}

const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function timeToMinutes(timeStr: string): number {
  const parts = String(timeStr || "").split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function slotsOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(startB) < timeToMinutes(endA);
}

function addDays(dateISO: string, days: number) { const date = new Date(`${dateISO}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function isFutureDate(dateISO: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return false;
  const parsed = new Date(`${dateISO}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dateISO && dateISO > new Date().toISOString().slice(0, 10);
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
    if (mode === "daily" || (mode === "weekly" && day === new Date(`${start}T12:00:00Z`).getUTCDay()) || (mode === "custom" && (schedule.weekdays || []).includes(day))) out.push(cursor);
  }
  return out.length ? out : [start];
}

async function serviceableProductsForCustomer(admin: AdminClient, customerId: string) {
  const { data: preference } = await admin.from("customer_preferences").select("latitude,longitude").eq("customer_id", customerId).maybeSingle();
  const latitude = Number(preference?.latitude);
  const longitude = Number(preference?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return new Map<string, Record<string, unknown>>();
  const marketplace = await admin.rpc("marketplace_menu_nearby", { customer_lat: latitude, customer_lng: longitude });
  if (marketplace.error) throw marketplace.error;
  const rows = (marketplace.data || []) as Array<Record<string, unknown>>;
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const id = String(row.item_id || "");
    if (id) byId.set(id, row);
  }
  return byId;
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
  let deliverySlots: unknown[] = [];
  try {
    const slotsQuery = admin.from("vendor_delivery_slots")
      .select("id,vendor_id,slot_name,start_time,end_time,is_active,created_at,updated_at")
      .order("start_time");
    if (role === "vendor" && profile.vendor_id) {
      slotsQuery.eq("vendor_id", profile.vendor_id);
    } else if (role === "customer") {
      slotsQuery.eq("is_active", true);
    }
    const slotsResult = await slotsQuery;
    if (!slotsResult.error) {
      deliverySlots = slotsResult.data || [];
    }
  } catch {
    deliverySlots = [];
  }

  return { orders: orders.data || [], schedules: schedules.data || [], staff, assignments, cart, cartItems,
    thirdPartyDeliveries: deliveryRequests.data || [],
    thirdPartyDeliveryAvailable: !deliveryMigrationMissing,
    deliverySlots,
  };
}

export async function GET(request: Request) {
  const ctx = await identity(request);
  if (!ctx) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  try {
    return NextResponse.json(await commerceSnapshot(ctx));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Commerce data is unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ctx = await identity(request);
  if (!ctx) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action || "");
  const { admin, profile } = ctx;
  try {
    if (action === "sync_cart") {
      if (profile.role !== "customer") return NextResponse.json({ error: "Customer access required." }, { status: 403 });
      const requested = Array.isArray(body.items) ? body.items.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
      const allowed = await serviceableProductsForCustomer(admin, profile.id);
      const normalized: Array<{ productId: string; vendorId: string; quantity: number; unit: string; unitPrice: number }> = [];
      for (const item of requested.slice(0, 100)) {
        const productId = String(item.productId || item.menuItemId || "");
        const row = allowed.get(productId);
        if (!row) continue;
        const quantity = Math.max(0.001, Number(item.quantity || 1));
        const stock = Number(row.stock_quantity || 0);
        if (!Number.isFinite(quantity) || quantity <= 0 || stock <= 0) continue;
        normalized.push({ productId, vendorId: String(row.vendor_id), quantity: Math.min(quantity, stock), unit: String(row.unit || "pack"), unitPrice: Math.max(0, Number(row.customer_price || 0)) });
      }
      const draft = await draftCartForCustomer(admin, profile.id);
      let cartId = draft.cart?.id ? String(draft.cart.id) : "";
      if (!cartId) {
        const created = await admin.from("commerce_carts").insert({ customer_id: profile.id, status: "draft", created_by: String(body.createdBy || "customer") === "she_agent" ? "she_agent" : "customer" }).select("id").single();
        if (created.error) throw created.error;
        cartId = created.data.id;
      }
      const removed = await admin.from("commerce_cart_items").delete().eq("cart_id", cartId);
      if (removed.error) throw removed.error;
      if (normalized.length) {
        const added = await admin.from("commerce_cart_items").insert(normalized.map((item) => ({ cart_id: cartId, menu_item_id: item.productId, vendor_id: item.vendorId, quantity: item.quantity, unit: item.unit, unit_price: item.unitPrice })));
        if (added.error) throw added.error;
      }
      await admin.from("commerce_carts").update({ updated_at: new Date().toISOString(), created_by: String(body.createdBy || "customer") === "she_agent" ? "she_agent" : "customer" }).eq("id", cartId);
      return NextResponse.json({ ok: true, snapshot: await commerceSnapshot(ctx) });
    }

    if (action === "checkout_cart") {
      if (profile.role !== "customer") return NextResponse.json({ error: "Customer access required." }, { status: 403 });
      const deliveryAddress = String(body.deliveryAddress || "").trim();
      if (!deliveryAddress) return NextResponse.json({ error: "Choose or enter a delivery address before checkout." }, { status: 400 });
      const requestedMode = String(body.mode || "Vendor delivery");
      const isThirdParty = fulfilment(requestedMode) === "third_party_delivery";
      const customerNotes = String(body.deliveryInstructions || "").trim();
      if (isThirdParty && (!customerNotes || customerNotes.length > 1000)) {
        return NextResponse.json({ error: "Enter delivery instructions (up to 1,000 characters) for third-party delivery." }, { status: 400 });
      }
      const draft = await draftCartForCustomer(admin, profile.id);
      const cartId = draft.cart?.id ? String(draft.cart.id) : "";
      if (!cartId || !draft.items.length) return NextResponse.json({ error: "Your cart is empty." }, { status: 409 });
      const productIds = [...new Set(draft.items.map((item) => String(item.menu_item_id)))];
      const products = await admin.from("vendor_menu_items").select("id,vendor_id,name,unit,vendor_base_price,active,stock_quantity").in("id", productIds);
      if (products.error) throw products.error;
      const productMap = new Map((products.data || []).map((item) => [String(item.id), item]));
      const grouped = new Map<string, Array<Record<string, unknown>>>();
      for (const item of draft.items) {
        const product = productMap.get(String(item.menu_item_id));
        if (!product || !product.active || Number(product.stock_quantity || 0) <= 0) continue;
        const list = grouped.get(String(product.vendor_id)) || [];
        list.push({ ...item, product });
        grouped.set(String(product.vendor_id), list);
      }
      if (!grouped.size) return NextResponse.json({ error: "The items in your cart are no longer available." }, { status: 409 });
      const scheduledDate = String(body.scheduledDate || addDays(new Date().toISOString().slice(0,10), 1));
      if (!isFutureDate(scheduledDate)) return NextResponse.json({ error: "Choose a delivery date after today." }, { status: 400 });
      const scheduledSlot = String(body.slot || "07:00–08:00 AM");
      const orderIds: string[] = [];
      for (const [vendorId, items] of grouped.entries()) {
        const vendor = await admin.from("vendors").select("delivery_enabled,pickup_enabled").eq("id", vendorId).maybeSingle();
        const fulfilmentMode = resolveFulfilmentMode(vendor.data, requestedMode);
        if (!fulfilmentMode) return NextResponse.json({ error: "This vendor does not currently support delivery or pickup." }, { status: 409 });
        let vendorBaseTotal = 0; let customerTotal = 0;
        const orderItems = items.map((item) => {
          const product = item.product as Record<string, unknown>;
          const quantity = Math.max(0.001, Number(item.quantity || 1));
          const base = Math.max(0, Number(product.vendor_base_price || 0));
          const price = Math.max(0, Number(item.unit_price || base));
          vendorBaseTotal += base * quantity; customerTotal += price * quantity;
          return { product_name: String(product.name || "Product"), quantity, unit: String(item.unit || product.unit || "pack"), vendor_base_price: base, markup_percent: base > 0 ? Math.max(0, ((price / base) - 1) * 100) : 0, customer_price: price };
        });
        const inserted = await admin.from("orders").insert({ order_number: orderNumber(), customer_id: profile.id, vendor_id: vendorId, vendor_base_total: vendorBaseTotal, markup_total: Math.max(0, customerTotal - vendorBaseTotal), tax_amount: 0, delivery_fee: 0, customer_total: customerTotal, delivery_address: deliveryAddress, fulfilment_mode: fulfilmentMode, scheduled_date: scheduledDate, scheduled_slot: scheduledSlot, status: "awarded" }).select("id,order_number").single();
        if (inserted.error) throw inserted.error;
        orderIds.push(inserted.data.id);
        if (fulfilmentMode === "third_party_delivery") {
          const requestInsert = await admin.from("third_party_delivery_requests").insert({
            order_id: inserted.data.id, customer_id: profile.id, vendor_id: vendorId, customer_notes: customerNotes,
          });
          if (requestInsert.error) throw requestInsert.error;
        }
        const itemInsert = await admin.from("order_items").insert(orderItems.map((item) => ({ order_id: inserted.data.id, ...item })));
        if (itemInsert.error) throw itemInsert.error;
        const payment = await admin.from("payments").insert({ order_id: inserted.data.id, customer_id: profile.id, amount: customerTotal, status: "pending", provider: "checkout" });
        if (payment.error) throw payment.error;
        await admin.from("notifications").insert({ recipient_id: profile.id, kind: "payment", title: "Complete payment", body: `${inserted.data.order_number} is ready for payment.`, entity_type: "order", entity_id: inserted.data.id });
      }
      await admin.from("commerce_carts").update({ status: "converted", updated_at: new Date().toISOString() }).eq("id", cartId).eq("customer_id", profile.id);
      return NextResponse.json({ ok: true, orderIds, snapshot: await commerceSnapshot(ctx) });
    }

    if (action === "create_schedule") {
      if (profile.role !== "customer") return NextResponse.json({ error: "Customer access required." }, { status: 403 });
      const productId = String(body.productId || "");
      const { data: product, error: productError } = await admin.from("vendor_menu_items").select("id,vendor_id,name,unit,vendor_base_price,active,stock_quantity").eq("id", productId).maybeSingle();
      if (productError || !product || !product.active || Number(product.stock_quantity) <= 0) return NextResponse.json({ error: "This product is no longer available." }, { status: 409 });
      const vendorRow = await admin.from("vendors").select("delivery_enabled,pickup_enabled").eq("id", product.vendor_id).maybeSingle();
      const fulfilmentMode = resolveFulfilmentMode(vendorRow.data, String(body.mode || "Vendor delivery"));
      if (!fulfilmentMode) return NextResponse.json({ error: "This vendor does not currently support delivery or pickup." }, { status: 409 });
      const requestedRecurrence = recurrence(String(body.recurrence || "once"));
      const customerNotes = String(body.deliveryInstructions || "").trim();
      if (fulfilmentMode === "third_party_delivery" && requestedRecurrence !== "once") {
        return NextResponse.json({ error: "Third-party delivery is available for one-time plans only." }, { status: 400 });
      }
      if (fulfilmentMode === "third_party_delivery" && (!customerNotes || customerNotes.length > 1000)) {
        return NextResponse.json({ error: "Enter delivery instructions (up to 1,000 characters) for third-party delivery." }, { status: 400 });
      }
      const quantity = Math.max(0.001, Number(body.quantity || 1));
      const customerPrice = Math.max(0, Number(body.customerPrice || product.vendor_base_price));
      const startDate = String(body.startDate || "");
      const endDate = body.endDate ? String(body.endDate) : "";
      if (!isFutureDate(startDate)) return NextResponse.json({ error: "Choose a first delivery date after today." }, { status: 400 });
      if (endDate && (!isFutureDate(endDate) || endDate < startDate)) return NextResponse.json({ error: "Choose an end date on or after the first delivery date." }, { status: 400 });
      const scheduleInsert = await admin.from("product_schedules").insert({
        customer_id: profile.id, vendor_id: product.vendor_id, menu_item_id: product.id,
        start_date: startDate, end_date: endDate || null,
        recurrence: requestedRecurrence,
        weekdays: Array.isArray(body.weekdays) ? body.weekdays.map((d) => weekdayMap[String(d)]).filter((n) => Number.isInteger(n)) : [],
        scheduled_slot: String(body.slot || "Vendor to confirm"), quantity, unit: String(body.unit || product.unit),
        fulfilment_mode: fulfilmentMode, status: "awaiting_payment",
        whatsapp_reminder_enabled: fulfilmentMode === "third_party_delivery" ? false : body.whatsappReminder !== false,
      }).select("id").single();
      if (scheduleInsert.error) throw scheduleInsert.error;
      const orderInsert = await admin.from("orders").insert({
        order_number: orderNumber(), schedule_id: scheduleInsert.data.id, customer_id: profile.id, vendor_id: product.vendor_id,
        vendor_base_total: Number(product.vendor_base_price) * quantity, markup_total: Math.max(0, customerPrice - Number(product.vendor_base_price)) * quantity,
        tax_amount: 0, delivery_fee: 0, customer_total: Number(body.perDeliveryTotal || customerPrice * quantity),
        fulfilment_mode: fulfilmentMode, scheduled_date: startDate,
        scheduled_slot: String(body.slot || "Vendor to confirm"), status: "awarded",
      }).select("id,order_number").single();
      if (orderInsert.error) throw orderInsert.error;
      if (fulfilmentMode === "third_party_delivery") {
        const requestInsert = await admin.from("third_party_delivery_requests").insert({
          order_id: orderInsert.data.id, customer_id: profile.id, vendor_id: String(product.vendor_id), customer_notes: customerNotes,
        });
        if (requestInsert.error) throw requestInsert.error;
      }
      const itemInsert = await admin.from("order_items").insert({
        order_id: orderInsert.data.id, product_name: product.name, quantity, unit: String(body.unit || product.unit),
        vendor_base_price: Number(product.vendor_base_price), markup_percent: Number(product.vendor_base_price) > 0 ? Math.max(0, ((customerPrice / Number(product.vendor_base_price)) - 1) * 100) : 0,
        customer_price: customerPrice,
      });
      if (itemInsert.error) throw itemInsert.error;
      await admin.from("payments").insert({ order_id: orderInsert.data.id, customer_id: profile.id, amount: Number(body.total || customerPrice * quantity), status: "pending", provider: "checkout" });
      await admin.from("notifications").insert({ recipient_id: profile.id, kind: "payment", title: "Complete payment", body: `${product.name} is reserved for ${startDate}. Complete payment to send the order to the vendor.`, entity_type: "order", entity_id: orderInsert.data.id });
      await admin.from("communication_outbox").insert({ recipient_id: profile.id, channel: "in_app", template_key: "payment_reminder", payload: { orderId: orderInsert.data.id, orderNumber: orderInsert.data.order_number }, scheduled_for: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
      return NextResponse.json({ ok: true, scheduleId: scheduleInsert.data.id, orderId: orderInsert.data.id, orderNumber: orderInsert.data.order_number });
    }

    if (action === "mark_paid") {
      if (process.env.NEXT_PUBLIC_DEMO_MODE === "false") {
        return NextResponse.json({ error: "Direct payment marking is disabled in live mode. Please complete checkout via Razorpay." }, { status: 403 });
      }
      if (profile.role !== "customer") return NextResponse.json({ error: "Customer access required." }, { status: 403 });
      const orderId = String(body.orderId || "");
      const { data: order } = await admin.from("orders").select("id,order_number,schedule_id,customer_id,vendor_id,customer_total,scheduled_date,scheduled_slot,fulfilment_mode,vendor_base_total,markup_total,tax_amount,delivery_fee,order_items(product_name,quantity,unit,vendor_base_price,markup_percent,customer_price),product_schedules(start_date,end_date,recurrence,weekdays)").eq("id", orderId).eq("customer_id", profile.id).maybeSingle();
      if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
      const rawSchedule = Array.isArray(order.product_schedules) ? order.product_schedules[0] : order.product_schedules;
      if (order.fulfilment_mode === "third_party_delivery" && rawSchedule && String(rawSchedule.recurrence) !== "once") {
        return NextResponse.json({ error: "Third-party delivery is available for one-time plans only." }, { status: 400 });
      }
      const updated = await admin.from("payments").update({ status: "paid", provider: String(body.method || "checkout").toLowerCase(), provider_reference: String(body.reference || `SIM-${Date.now()}`), updated_at: new Date().toISOString() }).eq("order_id", order.id).eq("customer_id", profile.id);
      if (updated.error) throw updated.error;
      await admin.from("orders").update({ status: "confirmed", updated_at: new Date().toISOString() }).eq("id", order.id);
      if (order.schedule_id) await admin.from("product_schedules").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", order.schedule_id).eq("status", "awaiting_payment");
      const dates = rawSchedule ? scheduleDates(rawSchedule as { start_date: string; end_date?: string | null; recurrence: string; weekdays?: number[] | null }) : [String(order.scheduled_date)];
      const firstItem = Array.isArray(order.order_items) ? order.order_items[0] : order.order_items;
      const remainingDates = dates.filter((date) => date !== String(order.scheduled_date));
      for (const date of remainingDates) {
        const duplicate = await admin.from("orders").select("id").eq("schedule_id", order.schedule_id).eq("scheduled_date", date).maybeSingle();
        if (duplicate.data?.id) continue;
        const created = await admin.from("orders").insert({
          order_number: orderNumber(), schedule_id: order.schedule_id, customer_id: order.customer_id, vendor_id: order.vendor_id,
          vendor_base_total: Number(order.vendor_base_total || 0), markup_total: Number(order.markup_total || 0), tax_amount: Number(order.tax_amount || 0), delivery_fee: Number(order.delivery_fee || 0),
          customer_total: Number(order.customer_total || 0), fulfilment_mode: order.fulfilment_mode, scheduled_date: date, scheduled_slot: order.scheduled_slot, status: "confirmed",
        }).select("id").single();
        if (created.error) throw created.error;
        if (firstItem) {
          const item = firstItem as Record<string, unknown>;
          await admin.from("order_items").insert({ order_id: created.data.id, product_name: String(item.product_name || "Scheduled item"), quantity: Number(item.quantity || 1), unit: String(item.unit || "pack"), vendor_base_price: Number(item.vendor_base_price || 0), markup_percent: Number(item.markup_percent || 0), customer_price: Number(item.customer_price || 0) });
        }
        await admin.from("payments").insert({ order_id: created.data.id, customer_id: profile.id, amount: 0, status: "paid", provider: "schedule_prepaid", provider_reference: `COVERED-${order.id}` });
      }
      const { data: vendor } = await admin.from("vendors").select("owner_id,name").eq("id", order.vendor_id).maybeSingle();
      if (vendor?.owner_id) await admin.from("notifications").insert({ recipient_id: vendor.owner_id, kind: "new_order", title: "New paid order", body: `${order.order_number} is confirmed for ${order.scheduled_date}.`, entity_type: "order", entity_id: order.id });
      await admin.from("notifications").insert({ recipient_id: profile.id, kind: "payment", title: "Payment confirmed", body: `${order.order_number} is confirmed and has been sent to the vendor.`, entity_type: "order", entity_id: order.id });
      await admin.from("communication_outbox").update({ status: "cancelled" }).eq("recipient_id", profile.id).eq("template_key", "payment_reminder").contains("payload", { orderId: order.id }).eq("status", "queued");
      return NextResponse.json({ ok: true, snapshot: await commerceSnapshot(ctx) });
    }

    if (action === "accept_third_party_delivery") {
      if (profile.role !== "vendor" || !profile.vendor_id) return NextResponse.json({ error: "Vendor access required." }, { status: 403 });
      const accepted = await ctx.caller.rpc("accept_third_party_delivery", { p_order_id: String(body.orderId || "") });
      if (accepted.error) throw accepted.error;
      const result = accepted.data as { ok?: boolean; error?: string; status?: string } | null;
      if (!result?.ok) {
        const messages: Record<string, { message: string; status: number }> = {
          unauthorized: { message: "Vendor access required.", status: 403 },
          not_found: { message: "Third-party delivery request not found for this store.", status: 404 },
          payment_required: { message: "The customer must complete payment before this request can be accepted.", status: 409 },
          not_pending: { message: "This delivery request can no longer be accepted.", status: 409 },
        };
        const failure = messages[String(result?.error || "")] || { message: "The delivery request could not be accepted.", status: 409 };
        return NextResponse.json({ error: failure.message }, { status: failure.status });
      }
      return NextResponse.json({ ok: true, status: "accepted" });
    }

    if (action === "issue_third_party_delivery_code") {
      if (profile.role !== "customer") return NextResponse.json({ error: "Customer access required." }, { status: 403 });
      const orderId = String(body.orderId || "");
      const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!secret) return NextResponse.json({ error: "Secure code service is unavailable." }, { status: 503 });
      const code = generateDeliveryVerificationCode();
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const issued = await ctx.caller.rpc("issue_third_party_delivery_code", {
        p_order_id: orderId,
        p_code_hash: hashDeliveryVerificationCode(orderId, code, secret),
        p_code_expires_at: expiresAt,
      });
      if (issued.error) throw issued.error;
      const result = issued.data as { ok?: boolean; error?: string } | null;
      if (!result?.ok) {
        const messages: Record<string, { message: string; status: number }> = {
          unauthorized: { message: "Customer access required.", status: 403 },
          not_found: { message: "Third-party delivery request not found.", status: 404 },
          not_accepted: { message: "Wait for the vendor to accept this delivery request before requesting a code.", status: 409 },
          attempt_limit: { message: "This delivery request has reached its verification-attempt limit.", status: 429 },
          issue_limit: { message: "This delivery request has reached its code-issue limit.", status: 429 },
          invalid_code_request: { message: "A secure code could not be issued. Please try again.", status: 400 },
        };
        const failure = messages[String(result?.error || "")] || { message: "A delivery code could not be issued.", status: 409 };
        return NextResponse.json({ error: failure.message }, { status: failure.status });
      }
      return NextResponse.json({ ok: true, code, expiresAt });
    }

    if (action === "verify_third_party_delivery_code") {
      if (profile.role !== "vendor" || !profile.vendor_id) return NextResponse.json({ error: "Vendor access required." }, { status: 403 });
      const orderId = String(body.orderId || "");
      const code = String(body.code || "").trim();
      if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter the six-digit customer handover code." }, { status: 400 });
      const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!secret) return NextResponse.json({ error: "Secure code service is unavailable." }, { status: 503 });
      const verified = await ctx.caller.rpc("verify_third_party_delivery_code", {
        p_order_id: orderId,
        p_code_hash: hashDeliveryVerificationCode(orderId, code, secret),
      });
      if (verified.error) throw verified.error;
      const result = verified.data as { ok?: boolean; error?: string; remaining_attempts?: number } | null;
      if (!result?.ok) {
        const messages: Record<string, { message: string; status: number }> = {
          unauthorized: { message: "Vendor access required.", status: 403 },
          not_found: { message: "Third-party delivery request not found for this store.", status: 404 },
          already_delivered: { message: "This order has already been delivered.", status: 409 },
          attempt_limit: { message: "Verification is locked after five incorrect attempts.", status: 429 },
          code_not_issued: { message: "The customer has not issued a delivery code yet.", status: 409 },
          expired: { message: "This delivery code has expired. Ask the customer to issue a new code.", status: 410 },
          invalid_code: { message: `The code is incorrect. ${result?.remaining_attempts ?? 0} attempt(s) remain.`, status: 400 },
        };
        const failure = messages[String(result?.error || "")] || { message: "The delivery code could not be verified.", status: 409 };
        return NextResponse.json({ error: failure.message }, { status: failure.status });
      }
      return NextResponse.json({ ok: true, status: "delivered" });
    }

    if (action === "notify_nutrition_review") {
      if (profile.role !== "vendor" || !profile.vendor_id) return NextResponse.json({ error: "Vendor access required." }, { status: 403 });
      const productId = String(body.productId || "");
      const productName = String(body.productName || "Product").trim() || "Product";
      const reason = String(body.reason || "Nutrition is not yet verified.").slice(0, 500);
      const { data: product } = await admin.from("vendor_menu_items").select("id,vendor_id,name").eq("id", productId).eq("vendor_id", profile.vendor_id).maybeSingle();
      if (!product) return NextResponse.json({ error: "Product not found for this store." }, { status: 404 });
      // The status column is added by the v6.1 migration. Ignore the update error so a
      // missing migration never blocks the vendor from selling the product.
      await admin.from("vendor_menu_items").update({ nutrition_status: "pending_review", nutrition_note: reason, updated_at: new Date().toISOString() }).eq("id", productId).eq("vendor_id", profile.vendor_id);
      const { data: operators } = await admin.from("profiles").select("id").eq("role", "operations");
      const rows = (operators || []).map((operator) => ({
        recipient_id: operator.id, kind: "nutrition_review", title: "Nutrition review needed",
        body: `${productName} needs a nutrition review. ${reason}`, entity_type: "product", entity_id: productId,
      }));
      if (rows.length) {
        const notified = await admin.from("notifications").insert(rows);
        if (notified.error) throw notified.error;
      }
      return NextResponse.json({ ok: true, notified: rows.length });
    }


    if (action === "update_order_status") {
      if (!(["vendor", "operations", "admin"] as Role[]).includes(profile.role)) return NextResponse.json({ error: "Not authorised." }, { status: 403 });
      const orderId = String(body.orderId || "");
      // Cancellation is disabled for new order-status updates. Keep historical
      // cancellation records untouched, but reject cancellation statuses (and
      // any unrecognized status) at the API boundary.
      const statusMap: Record<string, string> = {
        Scheduled: "awarded",
        Confirmed: "confirmed",
        Preparing: "preparing",
        Ready: "ready",
        "Out for delivery": "out_for_delivery",
        "Ready for pickup": "ready_for_pickup",
        Completed: "completed",
      };
      const requestedStatus = String(body.status || "").trim();
      const nextStatus = statusMap[requestedStatus] || requestedStatus.toLowerCase().replace(/[ -]+/g, "_");
      const allowedStatuses = new Set([
        "awarded",
        "confirmed",
        "preparing",
        "ready",
        "out_for_delivery",
        "ready_for_pickup",
        "completed",
      ]);
      if (!allowedStatuses.has(nextStatus)) {
        return NextResponse.json({ error: "Cancellation and unsupported order statuses are disabled." }, { status: 400 });
      }
      const { data: order } = await admin.from("orders").select("id,vendor_id,customer_id,order_number,fulfilment_mode,scheduled_date").eq("id", orderId).maybeSingle();
      if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
      if (profile.role === "vendor" && order.vendor_id !== profile.vendor_id) return NextResponse.json({ error: "This order belongs to another store." }, { status: 403 });
      if (order.fulfilment_mode === "third_party_delivery" && nextStatus === "completed") {
        return NextResponse.json({ error: "Third-party orders can only be marked delivered after the handover code is verified." }, { status: 409 });
      }
      const deliveryStatuses = new Set(["preparing", "ready", "out_for_delivery", "ready_for_pickup", "completed", "delivered"]);
      if (deliveryStatuses.has(nextStatus) && order.scheduled_date && isFutureDate(order.scheduled_date)) {
        return NextResponse.json({ error: `This order is scheduled for ${order.scheduled_date}. Delivery actions are only allowed on or after the delivery date.` }, { status: 400 });
      }
      const updated = await admin.from("orders").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", orderId);
      if (updated.error) throw updated.error;
      await admin.from("notifications").insert({ recipient_id: order.customer_id, kind: "order", title: `Order ${String(body.status || "updated").toLowerCase()}`, body: `${order.order_number} is now ${String(body.status || "updated").toLowerCase()}.`, entity_type: "order", entity_id: orderId });
      return NextResponse.json({ ok: true });
    }

    if (action === "reschedule_order") {
      if (profile.role !== "customer") return NextResponse.json({ error: "Customer access required." }, { status: 403 });
      const orderId = String(body.orderId || "");
      const { data: order } = await admin.from("orders").select("id,customer_id,vendor_id,order_number").eq("id", orderId).eq("customer_id", profile.id).maybeSingle();
      if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
      const updated = await admin.from("orders").update({ scheduled_date: String(body.date || ""), scheduled_slot: String(body.slot || ""), updated_at: new Date().toISOString() }).eq("id", orderId);
      if (updated.error) throw updated.error;
      const { data: vendor } = await admin.from("vendors").select("owner_id").eq("id", order.vendor_id).maybeSingle();
      if (vendor?.owner_id) await admin.from("notifications").insert({ recipient_id: vendor.owner_id, kind: "order", title: "Customer rescheduled order", body: `${order.order_number} moved to ${String(body.date || "")} · ${String(body.slot || "")}.`, entity_type: "order", entity_id: orderId });
      return NextResponse.json({ ok: true });
    }

    if (action === "save_staff") {
      if (profile.role !== "vendor" || !profile.vendor_id) return NextResponse.json({ error: "Vendor access required." }, { status: 403 });
      const staffId = body.staffId ? String(body.staffId) : "";
      const row = { vendor_id: profile.vendor_id, full_name: String(body.name || "").trim(), phone: String(body.phone || "").trim(), active: body.active !== false, updated_at: new Date().toISOString() };
      if (!row.full_name || !row.phone) return NextResponse.json({ error: "Name and phone are required." }, { status: 400 });
      const result = staffId ? await admin.from("vendor_delivery_staff").update(row).eq("id", staffId).eq("vendor_id", profile.vendor_id).select("id").single() : await admin.from("vendor_delivery_staff").insert(row).select("id").single();
      if (result.error) throw result.error;
      return NextResponse.json({ ok: true, id: result.data.id });
    }

    if (action === "delete_staff") {
      if (profile.role !== "vendor" || !profile.vendor_id) return NextResponse.json({ error: "Vendor access required." }, { status: 403 });
      const staffId = String(body.staffId || "");
      await admin.from("delivery_assignments").delete().eq("delivery_staff_id", staffId).eq("vendor_id", profile.vendor_id);
      const deleted = await admin.from("vendor_delivery_staff").delete().eq("id", staffId).eq("vendor_id", profile.vendor_id);
      if (deleted.error) throw deleted.error;
      return NextResponse.json({ ok: true });
    }

    if (action === "assign_staff") {
      if (!(["vendor", "operations", "admin"] as Role[]).includes(profile.role)) return NextResponse.json({ error: "Not authorised." }, { status: 403 });
      const orderId = String(body.orderId || "");
      const staffId = String(body.staffId || "");
      const { data: order } = await admin.from("orders").select("id,vendor_id,customer_id").eq("id", orderId).maybeSingle();
      if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
      if (profile.role === "vendor" && order.vendor_id !== profile.vendor_id) return NextResponse.json({ error: "This order belongs to another store." }, { status: 403 });
      await admin.from("delivery_assignments").delete().eq("order_id", orderId);
      if (staffId) {
        const { data: staff } = await admin.from("vendor_delivery_staff").select("id,vendor_id,full_name").eq("id", staffId).eq("vendor_id", order.vendor_id).maybeSingle();
        if (!staff) return NextResponse.json({ error: "Delivery person not found for this store." }, { status: 400 });
        const inserted = await admin.from("delivery_assignments").insert({ order_id: orderId, vendor_id: order.vendor_id, delivery_staff_id: staffId, assigned_by: profile.id });
        if (inserted.error) throw inserted.error;
        await admin.from("notifications").insert({ recipient_id: order.customer_id, kind: "delivery", title: "Delivery person assigned", body: `${staff.full_name} has been assigned to your order.`, entity_type: "order", entity_id: orderId });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "resubmit_verification") {
      if (profile.role !== "vendor" || !profile.vendor_id) return NextResponse.json({ error: "Vendor access required." }, { status: 403 });
      const documentNumber = String(body.documentNumber || "").trim();
      const expiryDate = body.expiryDate ? String(body.expiryDate) : null;
      const { data: existing } = await admin.from("vendor_documents").select("id").eq("vendor_id", profile.vendor_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existing?.id) await admin.from("vendor_documents").update({ document_number: documentNumber, expiry_date: expiryDate, verification_status: "submitted", updated_at: new Date().toISOString() }).eq("id", existing.id);
      else await admin.from("vendor_documents").insert({ vendor_id: profile.vendor_id, document_type: "fssai", document_number: documentNumber, storage_path: "pending-upload", expiry_date: expiryDate, verification_status: "submitted" });
      await admin.from("vendors").update({ verification_status: "submitted", operational_status: "inactive", marketplace_visible: false, updated_at: new Date().toISOString() }).eq("id", profile.vendor_id);
      const { data: ops } = await admin.from("profiles").select("id").in("role", ["operations", "admin"]);
      if (ops?.length) await admin.from("notifications").insert(ops.map((p) => ({ recipient_id: p.id, kind: "verification", title: "Vendor resubmitted verification", body: `${profile.full_name || "A vendor"} updated certification details for review.`, entity_type: "vendor", entity_id: profile.vendor_id })));
      return NextResponse.json({ ok: true });
    }

    if (action === "save_outlet_certificate") {
      if (profile.role !== "vendor" || !profile.vendor_id) return NextResponse.json({ error: "Vendor access required." }, { status: 403 });
      const outletId = String(body.outletId || "");
      const result = await admin.from("vendor_outlets").update({ certificate_number: String(body.certificateNumber || "") || null, certificate_expiry: body.certificateExpiry ? String(body.certificateExpiry) : null, updated_at: new Date().toISOString() }).eq("id", outletId).eq("vendor_id", profile.vendor_id);
      if (result.error) throw result.error;
      return NextResponse.json({ ok: true });
    }

    if (action === "save_delivery_slot") {
      if (profile.role !== "vendor" || !profile.vendor_id) return NextResponse.json({ error: "Vendor access required." }, { status: 403 });
      const slotName = String(body.slotName || "").trim();
      if (!slotName) return NextResponse.json({ error: "Slot name is required." }, { status: 400 });
      if (slotName.length > 80) return NextResponse.json({ error: "Slot name cannot exceed 80 characters." }, { status: 400 });

      const startTime = String(body.startTime || "").trim().slice(0, 5);
      const endTime = String(body.endTime || "").trim().slice(0, 5);
      if (!startTime) return NextResponse.json({ error: "Start time is required." }, { status: 400 });
      if (!endTime) return NextResponse.json({ error: "End time is required." }, { status: 400 });

      if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
        return NextResponse.json({ error: "End time must be later than start time." }, { status: 400 });
      }

      const slotId = body.slotId ? String(body.slotId) : "";
      const isActive = body.isActive !== false;

      // Duplicate name check
      const { data: existingSlots } = await admin.from("vendor_delivery_slots")
        .select("id,slot_name,start_time,end_time,is_active")
        .eq("vendor_id", profile.vendor_id);

      const allSlots = existingSlots || [];
      const duplicateName = allSlots.find(
        (s) => s.id !== slotId && String(s.slot_name).trim().toLowerCase() === slotName.toLowerCase()
      );
      if (duplicateName) {
        return NextResponse.json({ error: `A delivery slot named "${duplicateName.slot_name}" already exists for your store.` }, { status: 400 });
      }

      // Overlap check for active slots
      if (isActive) {
        const conflicting = allSlots.find(
          (s) => s.id !== slotId && s.is_active && slotsOverlap(startTime, endTime, String(s.start_time), String(s.end_time))
        );
        if (conflicting) {
          return NextResponse.json({
            error: `This time window overlaps with active slot "${conflicting.slot_name}" (${String(conflicting.start_time).slice(0, 5)} - ${String(conflicting.end_time).slice(0, 5)}).`,
          }, { status: 400 });
        }
      }

      const row = {
        vendor_id: profile.vendor_id,
        slot_name: slotName,
        start_time: startTime,
        end_time: endTime,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };

      const result = slotId
        ? await admin.from("vendor_delivery_slots").update(row).eq("id", slotId).eq("vendor_id", profile.vendor_id).select("id").single()
        : await admin.from("vendor_delivery_slots").insert(row).select("id").single();

      if (result.error) throw result.error;
      return NextResponse.json({ ok: true, id: result.data.id, snapshot: await commerceSnapshot(ctx) });
    }

    if (action === "delete_delivery_slot") {
      if (profile.role !== "vendor" || !profile.vendor_id) return NextResponse.json({ error: "Vendor access required." }, { status: 403 });
      const slotId = String(body.slotId || "");
      if (!slotId) return NextResponse.json({ error: "Slot ID required." }, { status: 400 });
      const deleted = await admin.from("vendor_delivery_slots").delete().eq("id", slotId).eq("vendor_id", profile.vendor_id);
      if (deleted.error) throw deleted.error;
      return NextResponse.json({ ok: true, snapshot: await commerceSnapshot(ctx) });
    }

    if (action === "toggle_delivery_slot") {
      if (profile.role !== "vendor" || !profile.vendor_id) return NextResponse.json({ error: "Vendor access required." }, { status: 403 });
      const slotId = String(body.slotId || "");
      if (!slotId) return NextResponse.json({ error: "Slot ID required." }, { status: 400 });
      const active = Boolean(body.active);

      if (active) {
        const { data: targetSlot } = await admin.from("vendor_delivery_slots").select("*").eq("id", slotId).eq("vendor_id", profile.vendor_id).maybeSingle();
        if (!targetSlot) return NextResponse.json({ error: "Slot not found." }, { status: 404 });
        const { data: otherSlots } = await admin.from("vendor_delivery_slots").select("*").eq("vendor_id", profile.vendor_id).eq("is_active", true).neq("id", slotId);
        const conflicting = (otherSlots || []).find((s) => slotsOverlap(String(targetSlot.start_time), String(targetSlot.end_time), String(s.start_time), String(s.end_time)));
        if (conflicting) {
          return NextResponse.json({
            error: `Cannot activate: overlaps with active slot "${conflicting.slot_name}" (${String(conflicting.start_time).slice(0, 5)} - ${String(conflicting.end_time).slice(0, 5)}).`,
          }, { status: 400 });
        }
      }

      const updated = await admin.from("vendor_delivery_slots").update({ is_active: active, updated_at: new Date().toISOString() }).eq("id", slotId).eq("vendor_id", profile.vendor_id);
      if (updated.error) throw updated.error;
      return NextResponse.json({ ok: true, snapshot: await commerceSnapshot(ctx) });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    const { message } = errorDetails(error);
    return NextResponse.json({ error: message || "The request could not be completed." }, { status: 500 });
  }
}