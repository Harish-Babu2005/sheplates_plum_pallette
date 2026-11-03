// Live RFQ (monthly requirement) data layer. Every rule lives in the database
// (supabase/V9_1_RFQ_LIVE.sql): Package 3 only, matching inside each vendor's own radius,
// sealed vendor prices, and the customer choosing the winner. These functions only call it.
import { getSupabaseBrowserClient } from "@/lib/supabase";

export type RfqItem = { id: string; name: string; quantity: number; unit: string; brand?: string };
export type CustomerRfqDocument = { id: string; fileName: string; contentType?: string; createdAt: string; url: string };
export type RfqQuoteSummary = { id: string; vendorId: string; vendorName: string; status: string; coveragePercent: number; total: number; deliveryFee: number; validUntil?: string };
export type CustomerRfq = {
  id: string; title: string; locality: string; deliveryDate: string; quoteDeadline: string; fulfilment: string; status: string;
  invited: number; items: RfqItem[]; documents: CustomerRfqDocument[]; quotes: RfqQuoteSummary[]; awardedQuoteId?: string | null; order?: { number: string; total: number; status: string };
};
export type VendorRfq = {
  id: string; title: string; locality: string; deliveryDate: string; quoteDeadline: string; fulfilment: string; status: string; items: RfqItem[];
  myQuote?: { id: string; status: string; total: number; deliveryFee: number; lines: Record<string, { available: boolean; unitPrice: number }> };
};
export type PublishInput = { title: string; locality: string; latitude: number; longitude: number; deliveryDate: string; closingDate: string; fulfilment?: "vendor_delivery" | "self_pickup"; items: { name: string; quantity: number; unit: string; brand?: string }[] };
export type QuoteLine = { requirementItemId: string; available: boolean; unitPrice: number };

function client() {
  const sb = getSupabaseBrowserClient();
  if (!sb) throw new Error("Live account access is not available in this deployment.");
  return sb;
}
const num = (v: unknown) => Number(v ?? 0);
const mapItem = (r: Record<string, unknown>): RfqItem => ({ id: String(r.id), name: String(r.product_name), quantity: num(r.quantity), unit: String(r.unit), brand: (r.preferred_brand as string | null) || undefined });

export function closingToIso(day: string) { return new Date(`${day}T23:59:59`).toISOString(); }
export function rfqIsOpen(r: { status: string; quoteDeadline: string }) { return ["quoting", "quotes_received"].includes(r.status) && new Date(r.quoteDeadline).getTime() >= Date.now(); }
export const rfqStatusLabel = (status: string) => status === "quoting" ? "Waiting for quotes" : status === "quotes_received" ? "Quotes received" : status === "awarded" ? "Awarded" : status === "closed" ? "Closed" : status;

/** The customer publishes an RFQ; the database matches it to Package 3 vendors that cover the pin. */
export async function publishRequirement(input: PublishInput): Promise<{ id: string; invited: number }> {
  const res = await client().rpc("publish_requirement", {
    p_title: input.title, p_locality: input.locality, p_lat: input.latitude, p_lng: input.longitude, p_delivery_date: input.deliveryDate,
    p_fulfilment: input.fulfilment || "vendor_delivery", p_quote_deadline: closingToIso(input.closingDate), p_items: input.items.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, brand: i.brand && i.brand !== "Any" ? i.brand : "" })),
  }).single();
  if (res.error || !res.data) throw new Error(res.error?.message || "The RFQ could not be published");
  const row = res.data as { req_id: string; invited: number };
  return { id: row.req_id, invited: row.invited };
}

export async function loadCustomerRfqs(): Promise<CustomerRfq[]> {
  const sb = client();
  const res = await sb.from("customer_requirements").select("id,title,locality,delivery_date,fulfilment_mode,quote_deadline,status,invited_count,awarded_quote_id,created_at,requirement_items(id,product_name,quantity,unit,preferred_brand),customer_requirement_files(id,file_name,storage_path,content_type,created_at)").order("created_at", { ascending: false }).limit(40);
  if (res.error) throw new Error(res.error.message);
  const rows = (res.data || []) as unknown as Record<string, unknown>[];
  const quotes = await Promise.all(rows.map(async (r) => {
    const q = await sb.rpc("customer_quote_comparison", { target_requirement: r.id });
    return ((q.data || []) as Record<string, unknown>[]).map((x): RfqQuoteSummary => ({ id: String(x.quote_id), vendorId: String(x.vendor_id), vendorName: String(x.vendor_name), status: String(x.quote_status), coveragePercent: num(x.coverage_percent), total: num(x.customer_total), deliveryFee: num(x.delivery_fee), validUntil: (x.valid_until as string | null) || undefined }));
  }));
  const documents = await Promise.all(rows.map(async (r) => Promise.all(
    ((r.customer_requirement_files || []) as Record<string, unknown>[]).map(async (file): Promise<CustomerRfqDocument> => {
      const path = String(file.storage_path || "");
      if (!path) throw new Error("A saved RFQ document is missing its storage path.");
      const signed = await sb.storage.from("customer-requirements").createSignedUrl(path, 3600);
      if (signed.error) throw new Error(signed.error.message);
      return {
        id: String(file.id),
        fileName: String(file.file_name),
        contentType: (file.content_type as string | null) || undefined,
        createdAt: String(file.created_at),
        url: signed.data.signedUrl,
      };
    }),
  )));
  const awardedIds = rows.filter((r) => r.status === "awarded").map((r) => String(r.id));
  const orders = awardedIds.length ? await sb.from("orders").select("requirement_id,order_number,customer_total,status").in("requirement_id", awardedIds) : { data: [] as Record<string, unknown>[] };
  return rows.map((r, i) => {
    const order = ((orders.data || []) as Record<string, unknown>[]).find((o) => o.requirement_id === r.id);
    return {
      id: String(r.id), title: String(r.title), locality: String(r.locality), deliveryDate: String(r.delivery_date), quoteDeadline: String(r.quote_deadline), fulfilment: String(r.fulfilment_mode), status: String(r.status),
      invited: num(r.invited_count), items: ((r.requirement_items || []) as Record<string, unknown>[]).map(mapItem), documents: documents[i], quotes: quotes[i], awardedQuoteId: (r.awarded_quote_id as string | null) || null,
      order: order ? { number: String(order.order_number), total: num(order.customer_total), status: String(order.status) } : undefined,
    };
  });
}

export async function uploadCustomerRfqDocument(requirementId: string, file: File): Promise<void> {
  if (file.size === 0) throw new Error("Choose a non-empty document to upload.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Each document must be 20 MB or smaller.");
  const sb = client();
  const auth = await sb.auth.getUser();
  if (auth.error) throw new Error(auth.error.message);
  if (!auth.data.user) throw new Error("Sign in again before uploading a document.");
  const fileName = file.name.replace(/[\\/]/g, "-").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
  if (!fileName) throw new Error("The selected document has an invalid file name.");
  const storagePath = `${auth.data.user.id}/${requirementId}/${crypto.randomUUID()}-${fileName}`;
  const storage = sb.storage.from("customer-requirements");
  const uploaded = await storage.upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (uploaded.error) throw new Error(uploaded.error.message);

  const saved = await sb.from("customer_requirement_files").insert({
    requirement_id: requirementId,
    storage_path: storagePath,
    file_name: file.name,
    content_type: file.type || null,
    uploaded_by: auth.data.user.id,
  });
  if (saved.error) {
    const removed = await storage.remove([storagePath]);
    if (removed.error) throw new Error(`${saved.error.message} The uploaded file could not be removed: ${removed.error.message}`);
    throw new Error(saved.error.message);
  }
}

export async function acceptQuote(quoteId: string): Promise<{ orderId: string; orderNumber: string; total: number }> {
  const res = await client().rpc("accept_quote", { p_quote: quoteId }).single();
  if (res.error || !res.data) throw new Error(res.error?.message || "The quotation could not be accepted");
  const row = res.data as { o_id: string; o_number: string; o_total: number | string };
  return { orderId: row.o_id, orderNumber: row.o_number, total: num(row.o_total) };
}

/** RFQs sent to this vendor. Rows the database hides (plan lost Package 3, not invited) simply do not come back. */
export async function loadVendorRfqs(vendorId: string): Promise<VendorRfq[]> {
  const sb = client();
  const inv = await sb.from("rfq_vendor_invitations").select("status,invited_at,customer_requirements(id,title,locality,delivery_date,fulfilment_mode,quote_deadline,status,requirement_items(id,product_name,quantity,unit,preferred_brand))").eq("vendor_id", vendorId).order("invited_at", { ascending: false }).limit(40);
  if (inv.error) throw new Error(inv.error.message);
  const quotes = await sb.from("vendor_quotes").select("id,requirement_id,status,vendor_total,delivery_fee,vendor_quote_items(requirement_item_id,available,vendor_unit_price)").eq("vendor_id", vendorId);
  const mine = (quotes.data || []) as unknown as Record<string, unknown>[];
  return ((inv.data || []) as unknown as { customer_requirements: Record<string, unknown> | null }[]).flatMap((row) => {
    const r = row.customer_requirements; if (!r) return [];
    const q = mine.find((x) => x.requirement_id === r.id);
    const lines: Record<string, { available: boolean; unitPrice: number }> = {};
    for (const li of ((q?.vendor_quote_items || []) as Record<string, unknown>[])) lines[String(li.requirement_item_id)] = { available: Boolean(li.available), unitPrice: num(li.vendor_unit_price) };
    return [{
      id: String(r.id), title: String(r.title), locality: String(r.locality), deliveryDate: String(r.delivery_date), quoteDeadline: String(r.quote_deadline), fulfilment: String(r.fulfilment_mode), status: String(r.status),
      items: ((r.requirement_items || []) as Record<string, unknown>[]).map(mapItem),
      myQuote: q ? { id: String(q.id), status: String(q.status), total: num(q.vendor_total), deliveryFee: num(q.delivery_fee), lines } : undefined,
    } satisfies VendorRfq];
  });
}

export async function submitQuote(requirementId: string, lines: QuoteLine[], deliveryFee: number): Promise<string> {
  const res = await client().rpc("submit_quote", { p_requirement: requirementId, p_items: lines.map((l) => ({ requirement_item_id: l.requirementItemId, available: l.available, unit_price: l.unitPrice })), p_delivery_fee: deliveryFee, p_valid_until: null });
  if (res.error) throw new Error(res.error.message);
  return String(res.data);
}

/** Operations and admin: every RFQ with its quote count. */
export async function loadOpsRfqs(): Promise<{ id: string; title: string; locality: string; status: string; invited: number; quotes: number; deliveryDate: string; items: number }[]> {
  const sb = client();
  const res = await sb.from("customer_requirements").select("id,title,locality,status,invited_count,delivery_date,requirement_items(id)").order("created_at", { ascending: false }).limit(60);
  if (res.error) throw new Error(res.error.message);
  const rows = (res.data || []) as unknown as Record<string, unknown>[];
  const q = await sb.from("vendor_quotes").select("requirement_id,status").neq("status", "draft");
  const counts = new Map<string, number>(); for (const x of ((q.data || []) as Record<string, unknown>[])) counts.set(String(x.requirement_id), (counts.get(String(x.requirement_id)) || 0) + 1);
  return rows.map((r) => ({ id: String(r.id), title: String(r.title), locality: String(r.locality), status: String(r.status), invited: num(r.invited_count), quotes: counts.get(String(r.id)) || 0, deliveryDate: String(r.delivery_date), items: ((r.requirement_items || []) as unknown[]).length }));
}
