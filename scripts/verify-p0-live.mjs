// Live check of P0 Connect, the four plans and plan-gated Food Drops against the real database and the running app.
// Needs V9_12_ALL_PENDING_MIGRATIONS.sql applied. Creates throwaway users and one throwaway vendor, and removes them at the end.
//
//   node --env-file=.env.local scripts/verify-p0-live.mjs            (app on http://localhost:5173)
//   BASE_URL=http://localhost:5190 node --env-file=.env.local scripts/verify-p0-live.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const base = process.env.BASE_URL || "http://localhost:5173";
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, svc, opts);
const tag = "zz-p0-" + Date.now().toString(36);
const password = "Zz-test-123456";
const LOC = { lat: 11.0183, lng: 76.9725 };
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(ok ? "  ✔" : "  ✖", name, ok ? "" : `— ${extra}`); };

const users = {};
async function mkUser(key, role) {
  const email = `${tag}-${key}@sheplates.test`;
  const u = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: key, role } });
  if (u.error) throw u.error;
  await admin.from("profiles").upsert({ id: u.data.user.id, full_name: key, role }, { onConflict: "id" });
  const client = createClient(url, anon, opts);
  const s = await client.auth.signInWithPassword({ email, password });
  if (s.error) throw s.error;
  users[key] = { id: u.data.user.id, email, client, token: s.data.session.access_token };
}
const api = async (who, method, body) => {
  const r = await fetch(`${base}/api/p0/vendors`, { method, headers: { Authorization: `Bearer ${users[who].token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

let vendorId = null, ownedVendorId = null;
try {
  console.log("setup");
  await mkUser("admin", "admin"); await mkUser("creator", "operations"); await mkUser("reviewer", "operations"); await mkUser("customer", "customer"); await mkUser("owner", "vendor");
  const probe = await admin.from("vendors").select("vendor_kind").limit(1);
  if (probe.error) throw new Error("The P0 SQL has not been applied yet: " + probe.error.message);
  const plans = (await admin.from("vendor_plans").select("code,monthly_price").order("monthly_price")).data;
  console.log("plans");
  check("plans are Taster 499, Crave 699, Thrive 799, Crown 999", JSON.stringify(plans.map((p) => [p.code, Number(p.monthly_price)])) === JSON.stringify([["taster", 499], ["crave", 699], ["thrive", 799], ["crown", 999]]), JSON.stringify(plans));

  console.log("permissions and creation through the app API");
  const noRights = await api("creator", "GET");
  check("Operations with no P0 rights is refused", noRights.status === 403, JSON.stringify(noRights));
  const grant = (profileId, permissions) => api("admin", "POST", { action: "permissions", profileId, permissions });
  check("Super Admin grants create/cancel/reactivate/upgrade/upload to one Operations user", (await grant(users.creator.id, { can_create: true, can_cancel: true, can_reactivate: true, can_upgrade: true, can_upload: true })).status === 200);
  check("…and review only to another", (await grant(users.reviewer.id, { can_review: true })).status === 200);
  check("an Operations user cannot grant rights", (await api("creator", "POST", { action: "permissions", profileId: users.reviewer.id, permissions: { can_create: true } })).status === 403);
  check("the reviewer cannot create", (await api("reviewer", "POST", { action: "create", name: "x" })).status === 403);
  const created = await api("creator", "POST", { action: "create", name: `${tag} Tiffin`, category: "Home food", description: "test", locality: "Ganapathy", address: "1 Main Rd", latitude: LOC.lat, longitude: LOC.lng, serviceRadiusKm: 5, contactName: "Asha", contactPhone: "9000000001", whatsappNumber: "+919000000001", durationHours: 7, fssaiRequired: false });
  vendorId = created.json.vendorId;
  check("the creator makes a P0 vendor", [200, 201].includes(created.status) && !!vendorId, JSON.stringify(created));
  check("it appears in the creator's P0 list", (await api("creator", "GET")).json.vendors?.some((v) => v.id === vendorId));

  console.log("approval and what customers see");
  const near = () => users.customer.client.rpc("connect_vendors_nearby", { customer_lat: LOC.lat, customer_lng: LOC.lng });
  check("hidden from customers before approval", ((await near()).data || []).every((r) => r.vendor_id !== vendorId));
  check("the creator cannot approve (no review right)", (await api("creator", "POST", { action: "review", vendorId, decision: "verified" })).status === 403);
  await admin.from("p0_vendor_permissions").update({ can_review: true }).eq("profile_id", users.creator.id);
  const selfRpc = await users.creator.client.rpc("review_vendor_and_notify", { target_vendor: vendorId, decision: "verified", review_note: "self" });
  check("even with the review right, the creator cannot approve their own vendor", !!selfRpc.error && /creator/i.test(selfRpc.error.message), selfRpc.error?.message);
  await admin.from("p0_vendor_permissions").update({ can_review: false }).eq("profile_id", users.creator.id);
  const ok = await api("reviewer", "POST", { action: "review", vendorId, decision: "verified" });
  check("a different Operations user with the review right approves", ok.status === 200, JSON.stringify(ok));
  const listed = (await near()).data || [];
  const mine = listed.find((r) => r.vendor_id === vendorId);
  check("customers now find it, with its WhatsApp number", mine?.whatsapp_number === "+919000000001" && mine.vendor_kind === "p0_connect", JSON.stringify(mine));
  check("a visitor outside the radius does not", ((await users.customer.client.rpc("connect_vendors_nearby", { customer_lat: 11.5, customer_lng: 77.5 })).data || []).every((r) => r.vendor_id !== vendorId));
  const guest = createClient(url, anon, opts);
  check("a signed-out visitor can browse the listing", ((await guest.rpc("connect_vendors_nearby", { customer_lat: LOC.lat, customer_lng: LOC.lng })).data || []).some((r) => r.vendor_id === vendorId));
  check("it is not in the product marketplace", ((await users.customer.client.rpc("marketplace_menu_nearby", { customer_lat: LOC.lat, customer_lng: LOC.lng })).data || []).every((r) => r.vendor_id !== vendorId));
  check("a customer's WhatsApp tap is recorded", !(await users.customer.client.rpc("track_vendor_whatsapp_click", { target_vendor_id: vendorId, click_source: "map" })).error);
  check("a signed-out visitor's tap is refused", !!(await guest.rpc("track_vendor_whatsapp_click", { target_vendor_id: vendorId, click_source: "map" })).error);
  check("the tap was stored once", (await admin.from("vendor_whatsapp_click_events").select("id").eq("vendor_id", vendorId)).data?.length === 1);

  console.log("cancel, reactivate");
  check("cancel needs the cancel right", (await api("reviewer", "POST", { action: "cancel", vendorId })).status === 403);
  check("the creator cancels", (await api("creator", "POST", { action: "cancel", vendorId })).status === 200);
  check("a cancelled vendor disappears", ((await near()).data || []).every((r) => r.vendor_id !== vendorId));
  check("and cannot be tapped", !!(await users.customer.client.rpc("track_vendor_whatsapp_click", { target_vendor_id: vendorId, click_source: "map" })).error);
  check("the creator reactivates it", (await api("creator", "POST", { action: "reactivate", vendorId })).status === 200);
  check("it is listed again", ((await near()).data || []).some((r) => r.vendor_id === vendorId));

  console.log("upgrade to a paid plan");
  const bad = await admin.rpc("p0_start_upgrade_invitation", { p_actor: users.creator.id, p_vendor: vendorId, p_plan_code: "premium", p_email: users.owner.email });
  check("old plan names are refused", !!bad.error && /Crave, Thrive or Crown/.test(bad.error.message), bad.error?.message);
  const inv = await admin.rpc("p0_start_upgrade_invitation", { p_actor: users.creator.id, p_vendor: vendorId, p_plan_code: "thrive", p_email: users.owner.email });
  check("an invitation for Thrive starts", !inv.error, inv.error?.message);
  await admin.rpc("p0_mark_upgrade_invitation", { p_actor: users.creator.id, p_invitation: inv.data, p_delivery_status: "sent", p_provider_user_id: users.owner.id });
  const stranger = await fetch(`${base}/api/p0/upgrade/complete`, { method: "POST", headers: { Authorization: `Bearer ${users.customer.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ invitationId: inv.data }) });
  check("someone else cannot complete the invitation", stranger.status === 409, String(stranger.status));
  const doneRes = await fetch(`${base}/api/p0/upgrade/complete`, { method: "POST", headers: { Authorization: `Bearer ${users.owner.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ invitationId: inv.data }) });
  check("the invited vendor completes the upgrade through the app", doneRes.status === 200, await doneRes.text());
  const after = (await admin.from("vendors").select("vendor_kind,owner_id,connect_enabled,whatsapp_number,vendor_plans(code)").eq("id", vendorId).single()).data;
  check("it is now one subscription vendor on Thrive, owned by the invitee, Connect off", after.vendor_kind === "subscription" && after.owner_id === users.owner.id && !after.connect_enabled && after.whatsapp_number === null && after.vendor_plans?.code === "thrive", JSON.stringify(after));
  check("it no longer shows as a Connect listing", ((await near()).data || []).every((r) => r.vendor_id !== vendorId));
  ownedVendorId = vendorId;

  console.log("Food Drops follow the plan");
  await admin.from("vendors").update({ verification_status: "verified", operational_status: "active", marketplace_visible: true }).eq("id", vendorId);
  const item = await admin.from("vendor_menu_items").insert({ vendor_id: vendorId, name: "Thali", category: "Home food", unit: "plate", vendor_base_price: 100 }).select("id").single();
  const setPlan = async (code) => admin.from("vendors").update({ plan_id: (await admin.from("vendor_plans").select("id").eq("code", code).single()).data.id }).eq("id", vendorId);
  const drop = (title) => users.owner.client.from("food_drops").insert({ vendor_id: vendorId, product_id: item.data.id, title, drop_price: 60, original_price: 100, total_quantity: 5, remaining_quantity: 5, ends_at: new Date(Date.now() + 3600e3).toISOString() }).select("id,starts_at,ends_at").single();
  await setPlan("crave");
  check("a Crave vendor cannot publish a Food Drop", !!(await drop("crave")).error);
  await setPlan("thrive");
  const ok2 = await drop("thrive");
  check("a Thrive vendor can", !ok2.error, ok2.error?.message);
  if (!ok2.error) {
    const ends = new Date(ok2.data.ends_at), starts = new Date(ok2.data.starts_at);
    const istMidnight = new Date(ends.getTime() + 330 * 60e3);
    check("the drop closes at midnight IST and lasts at most until then", istMidnight.getUTCHours() === 0 && istMidnight.getUTCMinutes() === 0 && ends > starts, `${starts.toISOString()} → ${ends.toISOString()}`);
    await admin.from("food_drops").update({ starts_at: new Date(Date.now() - 7200e3).toISOString(), ends_at: new Date(Date.now() - 60e3).toISOString() }).eq("id", ok2.data.id);
    check("once its evening is over it cannot be claimed", !!(await users.customer.client.rpc("claim_food_drop", { p_drop_id: ok2.data.id, p_quantity: 1 })).error);
  }
} catch (e) {
  fail++; console.log("  ✖ stopped early:", e.message);
} finally {
  console.log("cleanup");
  if (vendorId) {
    await admin.from("food_drops").delete().eq("vendor_id", vendorId);
    await admin.from("vendor_menu_items").delete().eq("vendor_id", vendorId);
    await admin.from("p0_upgrade_invitations").delete().eq("vendor_id", vendorId);
    await admin.from("p0_vendor_history").delete().eq("vendor_id", vendorId);
    await admin.from("vendor_whatsapp_click_events").delete().eq("vendor_id", vendorId);
    await admin.from("profiles").update({ vendor_id: null }).eq("vendor_id", vendorId);
    await admin.from("vendors").delete().eq("id", vendorId);
  }
  for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
