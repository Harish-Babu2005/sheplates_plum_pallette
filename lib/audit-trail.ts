// Audit trail helpers for Operations and Super Admin. Backed by supabase/V9_14_AUDIT_VIEWS_AND_VENDOR_NOTES.sql.
import { getSupabaseBrowserClient, isLiveSupabaseMode } from "@/lib/supabase";

export type TrailEvent = { id: string; actor: string; action: string; detail: string; at: string };

const LABELS: Record<string, string> = {
  viewed_customer_details: "Viewed customer details",
  sent_vendor_note: "Sent a note to a vendor",
  created_team_user: "Created a team user",
  invited_vendor: "Invited a vendor by email",
};
const label = (action: string) => LABELS[action] || action.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

function friendly(message: string) {
  return /function .* does not exist|schema cache/i.test(message) ? "This needs a database update. Apply supabase/V9_14_AUDIT_VIEWS_AND_VENDOR_NOTES.sql first." : message;
}

/** Latest events from the database audit table (live mode only). */
export async function loadAuditTrail(limit = 200): Promise<TrailEvent[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb || !isLiveSupabaseMode()) return [];
  const res = await sb.rpc("audit_trail", { p_limit: limit });
  if (res.error) throw new Error(friendly(res.error.message));
  return ((res.data || []) as { id: number; created_at: string; actor_name: string; actor_role: string | null; action: string; entity_type: string; entity_id: string; detail: Record<string, unknown> }[]).map((row) => ({
    id: `db-${row.id}`,
    actor: `${row.actor_name}${row.actor_role ? ` · ${row.actor_role}` : ""}`,
    action: label(row.action),
    detail: [row.entity_type, row.entity_id, ...Object.values(row.detail || {}).map(String)].filter(Boolean).join(" · "),
    at: new Date(row.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
  }));
}

/** Records that a staff member opened a customer's details. Best effort: viewing is never blocked by a logging failure. */
export async function logCustomerView(email: string, context: string): Promise<void> {
  const sb = getSupabaseBrowserClient();
  if (!sb || !isLiveSupabaseMode()) return;
  const res = await sb.rpc("log_customer_data_view", { p_customer: email, p_context: context });
  if (res.error) console.warn("Could not record the customer view", friendly(res.error.message));
}

export async function sendVendorNote(vendorId: string, note: string): Promise<void> {
  const sb = getSupabaseBrowserClient();
  if (!sb) throw new Error("The live database is not connected");
  const res = await sb.rpc("send_vendor_note", { p_vendor: vendorId, p_note: note });
  if (res.error) throw new Error(friendly(res.error.message));
}

/** Operations and Super Admin: send a vendor an invitation email so they can set a password and onboard. */
export async function inviteVendorByEmail(input: { email: string; name: string; businessName: string }, accessToken: string): Promise<void> {
  const res = await fetch("/api/admin/invite-vendor", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(input) });
  const json = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new Error(json.error || "The invitation could not be sent");
}
