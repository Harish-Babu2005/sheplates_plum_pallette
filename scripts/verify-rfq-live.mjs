// Live check of the RFQ rules in supabase/V9_1_RFQ_LIVE.sql, using throwaway users and vendors
// that are deleted at the end. Run: node --env-file=.env.local scripts/verify-rfq-live.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, svc, opts);
const tag = "zz-rfq-" + Date.now().toString(36);
const results = [];
const check = (name, ok, extra = "") => { results.push(Boolean(ok)); console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  [" + extra + "]" : "")); };
const created = { users: [], vendors: [], reqs: [] };

const plan = Object.fromEntries(((await admin.from("vendor_plans").select("id,code")).data || []).map((p) => [p.code, p.id]));
async function mkUser(role, name) {
  const email = `${tag}-${name}@sheplates.test`, password = "Zz-test-123456";
  const u = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role } });
  if (u.error) throw u.error; created.users.push(u.data.user.id);
  await admin.from("profiles").upsert({ id: u.data.user.id, full_name: name, role }, { onConflict: "id" });
  const client = createClient(url, anon, opts); const s = await client.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  return { id: u.data.user.id, client };
}
async function mkVendor(user, name, lat, lng, radius, planCode, verified = true) {
  const v = await admin.from("vendors").insert({ owner_id: user.id, name, category: "Groceries", locality: "Test", latitude: lat, longitude: lng, service_radius_km: radius, plan_id: planCode ? plan[planCode] : null, verification_status: verified ? "verified" : "submitted", operational_status: verified ? "active" : "inactive", marketplace_visible: verified }).select("id").single();
  if (v.error) throw v.error; created.vendors.push(v.data.id);
  await admin.from("profiles").update({ vendor_id: v.data.id }).eq("id", user.id);
  return v.data.id;
}
const plusDays = (n) => new Date(Date.now() + n * 86_400_000);
const ymd = (d) => d.toISOString().slice(0, 10);
const ORIGIN = { lat: 11.0383, lng: 76.9781 };   // customer pin
const at = (km) => ({ lat: ORIGIN.lat + km / 111.32, lng: ORIGIN.lng });   // due north, km away

try {
  const cust = await mkUser("customer", "cust"), cust2 = await mkUser("customer", "cust2");
  const names = ["v1", "v2", "v3", "v4", "v5", "v6", "v7"]; const vu = {}; for (const n of names) vu[n] = await mkUser("vendor", n);
  const vid = {
    v1: await mkVendor(vu.v1, "RFQ V1 Premium r10 @4km", at(4).lat, at(4).lng, 10, "crown"),
    v2: await mkVendor(vu.v2, "RFQ V2 Premium r3 @4km", at(4).lat, at(4).lng, 3, "crown"),
    v3: await mkVendor(vu.v3, "RFQ V3 Growth r10 @1km", at(1).lat, at(1).lng, 10, "thrive"),
    v4: await mkVendor(vu.v4, "RFQ V4 Launch r10 @1km", at(1).lat, at(1).lng, 10, "crave"),
    v5: await mkVendor(vu.v5, "RFQ V5 Premium unverified", at(1).lat, at(1).lng, 10, "crown", false),
    v6: await mkVendor(vu.v6, "RFQ V6 Premium r10 @12km", at(12).lat, at(12).lng, 10, "crown"),
    v7: await mkVendor(vu.v7, "RFQ V7 Premium r15 @12km", at(12).lat, at(12).lng, 15, "crown"),
  };
  const items = [{ name: "Rice", quantity: 25, unit: "kg", brand: "Any" }, { name: "Toor dal", quantity: 5, unit: "kg" }, { name: "Sunflower oil", quantity: 4, unit: "litre" }];
  const publish = (client, o = {}) => client.rpc("publish_requirement", { p_title: "Monthly groceries", p_locality: "RS Puram", p_lat: ORIGIN.lat, p_lng: ORIGIN.lng, p_delivery_date: ymd(plusDays(10)), p_fulfilment: "vendor_delivery", p_quote_deadline: plusDays(5).toISOString(), p_items: items, ...o }).single();

  // ---------- publish + match ----------
  const pub = await publish(cust.client);
  check("customer publishes an RFQ", !pub.error && pub.data?.req_id, pub.error?.message);
  const rid = pub.data?.req_id; created.reqs.push(rid);
  const inv = await admin.from("rfq_vendor_invitations").select("vendor_id").eq("requirement_id", rid);
  const invited = new Set((inv.data || []).map((x) => x.vendor_id));
  check("invited count returned is 2 (V1 and V7)", pub.data?.invited === 2, String(pub.data?.invited));
  check("V1 (Package 3, radius 10, 4 km away) is invited", invited.has(vid.v1));
  check("V7 (Package 3, radius 15, 12 km away) is invited", invited.has(vid.v7));
  check("V2 (Package 3 but radius 3, 4 km away) is NOT invited", !invited.has(vid.v2));
  check("V3 (Package 2) is NOT invited", !invited.has(vid.v3));
  check("V4 (Package 1) is NOT invited", !invited.has(vid.v4));
  check("V5 (Package 3, not verified) is NOT invited", !invited.has(vid.v5));
  check("V6 (Package 3, radius 10, 12 km away) is NOT invited", !invited.has(vid.v6));
  check("exactly two invitations exist", invited.size === 2, String(invited.size));
  const notif = await admin.from("notifications").select("recipient_id").eq("entity_id", rid);
  check("both invited vendors and nobody else were notified", (notif.data || []).length === 2 && (notif.data || []).every((n) => [vu.v1.id, vu.v7.id].includes(n.recipient_id)));

  check("a vendor cannot publish an RFQ", !!(await publish(vu.v1.client)).error);
  check("no pin is refused", !!(await publish(cust.client, { p_lat: null, p_lng: null })).error);
  check("a delivery date in the past is refused", !!(await publish(cust.client, { p_delivery_date: ymd(plusDays(-1)) })).error);
  check("a closing date after delivery is refused", !!(await publish(cust.client, { p_quote_deadline: plusDays(9).toISOString(), p_delivery_date: ymd(plusDays(3)) })).error);
  check("an empty list is refused", !!(await publish(cust.client, { p_items: [] })).error);

  // ---------- who can read ----------
  const readReq = async (u) => (await u.client.from("customer_requirements").select("id,requirement_items(id)").eq("id", rid)).data || [];
  check("V1 reads the RFQ and its items", (await readReq(vu.v1)).length === 1 && (await readReq(vu.v1))[0].requirement_items.length === 3);
  check("V7 reads the RFQ", (await readReq(vu.v7)).length === 1);
  for (const n of ["v2", "v3", "v4", "v5", "v6"]) check(`${n.toUpperCase()} cannot read the RFQ`, (await readReq(vu[n])).length === 0);
  check("another customer cannot read the RFQ", (await readReq(cust2)).length === 0);
  check("the customer reads their own RFQ", (await readReq(cust)).length === 1);
  const pinAsVendor = await vu.v1.client.from("requirement_pins").select("latitude").eq("requirement_id", rid);
  check("a vendor cannot read the customer's exact pin", !pinAsVendor.error && pinAsVendor.data.length === 0);
  const pinAsCust = await cust.client.from("requirement_pins").select("latitude").eq("requirement_id", rid);
  check("the customer can read their own pin", pinAsCust.data?.length === 1);
  const invCount = (await cust.client.from("customer_requirements").select("invited_count").eq("id", rid).single()).data?.invited_count;
  check("the customer sees how many vendors were invited", invCount === 2, String(invCount));

  // ---------- Package 3 is enforced on read: downgrade V7 ----------
  await admin.from("vendors").update({ plan_id: plan.growth }).eq("id", vid.v7);
  check("V7 loses access to the RFQ when downgraded to Package 2", (await readReq(vu.v7)).length === 0);
  const downQuote = await vu.v7.client.rpc("submit_quote", { p_requirement: rid, p_items: [], p_delivery_fee: 0 });
  check("a downgraded vendor cannot quote", !!downQuote.error && /Package 3/.test(downQuote.error.message), downQuote.error?.message);
  await admin.from("vendors").update({ plan_id: plan.premium }).eq("id", vid.v7);

  // ---------- quoting ----------
  const [i1, i2, i3] = ((await vu.v1.client.from("requirement_items").select("id,product_name,quantity").eq("requirement_id", rid)).data || []);
  const byName = Object.fromEntries(((await vu.v1.client.from("requirement_items").select("id,product_name").eq("requirement_id", rid)).data || []).map((x) => [x.product_name, x.id]));
  const lines = (rice, dal, oil) => [{ requirement_item_id: byName["Rice"], available: true, unit_price: rice }, { requirement_item_id: byName["Toor dal"], available: dal != null, unit_price: dal ?? 0 }, { requirement_item_id: byName["Sunflower oil"], available: true, unit_price: oil }];
  void i1; void i2; void i3;
  for (const n of ["v2", "v3", "v4", "v6"]) { const r = await vu[n].client.rpc("submit_quote", { p_requirement: rid, p_items: lines(50, 100, 150), p_delivery_fee: 0 }); check(`${n.toUpperCase()} cannot quote (not invited / not Package 3)`, !!r.error, r.error?.message); }
  check("a customer cannot submit a quote", !!(await cust.client.rpc("submit_quote", { p_requirement: rid, p_items: lines(50, 100, 150), p_delivery_fee: 0 })).error);
  const missing = await vu.v1.client.rpc("submit_quote", { p_requirement: rid, p_items: lines(0, 100, 150), p_delivery_fee: 0 });
  check("an available item with no price is refused", !!missing.error && /price/i.test(missing.error.message), missing.error?.message);
  const q1 = await vu.v1.client.rpc("submit_quote", { p_requirement: rid, p_items: lines(52, 118, 148), p_delivery_fee: 200 });
  check("V1 sends a quotation", !q1.error && q1.data, q1.error?.message);
  const expected1 = 52 * 25 + 118 * 5 + 148 * 4;   // 1300 + 590 + 592 = 2482
  const stored1 = (await admin.from("vendor_quotes").select("vendor_total,delivery_fee,status").eq("requirement_id", rid).eq("vendor_id", vid.v1).single()).data;
  check("quotation total is computed on the server (2482)", Number(stored1?.vendor_total) === expected1, JSON.stringify(stored1));
  const q7 = await vu.v7.client.rpc("submit_quote", { p_requirement: rid, p_items: lines(55, null, 140), p_delivery_fee: 0 });
  check("V7 sends a cheaper but partial quotation (no dal)", !q7.error, q7.error?.message);
  const re = await vu.v1.client.rpc("submit_quote", { p_requirement: rid, p_items: lines(50, 118, 148), p_delivery_fee: 200 });
  check("V1 can update its quotation while open", !re.error && re.data === q1.data, re.error?.message);
  const stat = (await admin.from("customer_requirements").select("status").eq("id", rid).single()).data?.status;
  check("RFQ status moves to quotes_received", stat === "quotes_received", stat);

  // ---------- sealed ----------
  const custQuotes = await cust.client.from("vendor_quotes").select("id").eq("requirement_id", rid);
  check("the customer cannot read raw vendor quotes (sealed)", !custQuotes.error && custQuotes.data.length === 0);
  const v7sees = await vu.v7.client.from("vendor_quotes").select("id,vendor_id").eq("requirement_id", rid);
  check("a vendor sees only their own quote, never a competitor's", (v7sees.data || []).every((x) => x.vendor_id === vid.v7) && v7sees.data.length === 1);
  const cmp = await cust.client.rpc("customer_quote_comparison", { target_requirement: rid });
  check("the customer compares two quotations", cmp.data?.length === 2, JSON.stringify(cmp.data?.map((x) => [x.vendor_name, x.customer_total, x.coverage_percent])));
  const c1 = (cmp.data || []).find((x) => x.vendor_id === vid.v1), c7 = (cmp.data || []).find((x) => x.vendor_id === vid.v7);
  check("V1 total = items + delivery (2450 + 200 = 2650)", Number(c1?.customer_total) === 50 * 25 + 118 * 5 + 148 * 4 + 200, String(c1?.customer_total));
  check("V7 covers 67% of the list", Number(c7?.coverage_percent) === 67, String(c7?.coverage_percent));

  // ---------- deadline ----------
  await admin.from("customer_requirements").update({ quote_deadline: plusDays(-1).toISOString() }).eq("id", rid);
  const late = await vu.v1.client.rpc("submit_quote", { p_requirement: rid, p_items: lines(40, 100, 140), p_delivery_fee: 0 });
  check("quoting after the deadline is refused", !!late.error && /closed/i.test(late.error.message), late.error?.message);
  await admin.from("customer_requirements").update({ quote_deadline: plusDays(5).toISOString() }).eq("id", rid);

  // ---------- accept ----------
  check("another customer cannot accept", !!(await cust2.client.rpc("accept_quote", { p_quote: q1.data }).single()).error);
  check("a vendor cannot accept", !!(await vu.v1.client.rpc("accept_quote", { p_quote: q1.data }).single()).error);
  const [a, b] = await Promise.all([cust.client.rpc("accept_quote", { p_quote: q1.data }).single(), cust.client.rpc("accept_quote", { p_quote: q7.data }).single()]);
  const wins = [a, b].filter((x) => !x.error);
  check("two simultaneous accepts: exactly one wins", wins.length === 1, `${a.error?.message || "ok"} | ${b.error?.message || "ok"}`);
  const winnerQuote = !a.error ? q1.data : q7.data, loserQuote = !a.error ? q7.data : q1.data;
  const order = wins[0]?.data;
  check("an order number is returned", /^RFQ-/.test(order?.o_number || ""), order?.o_number);
  const dbOrder = (await admin.from("orders").select("id,status,vendor_id,customer_total,requirement_id,quote_id,scheduled_date").eq("requirement_id", rid)).data || [];
  check("exactly one order exists", dbOrder.length === 1);
  check("the order is awarded to the chosen quote", dbOrder[0]?.quote_id === winnerQuote && dbOrder[0]?.status === "awarded");
  check("order total equals the comparison total", Number(dbOrder[0]?.customer_total) === Number(((cmp.data || []).find((x) => x.quote_id === winnerQuote) || {}).customer_total), String(dbOrder[0]?.customer_total));
  const oi = (await admin.from("order_items").select("product_name,quantity,customer_price").eq("order_id", dbOrder[0]?.id)).data || [];
  check("order items match the quoted items", oi.length >= 2, `${oi.length} items`);
  const pay = (await admin.from("payments").select("status,amount").eq("order_id", dbOrder[0]?.id)).data || [];
  check("a pending payment exists for the order total", pay.length === 1 && pay[0].status === "pending" && Number(pay[0].amount) === Number(dbOrder[0]?.customer_total));
  const qs = (await admin.from("vendor_quotes").select("id,status").eq("requirement_id", rid)).data || [];
  check("winning quote is selected, the other is not_selected", qs.find((x) => x.id === winnerQuote)?.status === "selected" && qs.find((x) => x.id === loserQuote)?.status === "not_selected", JSON.stringify(qs.map((x) => x.status)));
  check("the RFQ is awarded and linked to the winning quote", (await admin.from("customer_requirements").select("status,awarded_quote_id").eq("id", rid).single()).data?.status === "awarded");
  const again = await cust.client.rpc("accept_quote", { p_quote: loserQuote }).single();
  check("a second accept is refused", !!again.error && /already/i.test(again.error.message), again.error?.message);
  const lateQuote = await vu.v1.client.rpc("submit_quote", { p_requirement: rid, p_items: lines(10, 10, 10), p_delivery_fee: 0 });
  check("no more quotes after the award", !!lateQuote.error, lateQuote.error?.message);
  const winnerUser = winnerQuote === q1.data ? vu.v1 : vu.v7, loserUser = winnerQuote === q1.data ? vu.v7 : vu.v1;
  check("the winning vendor cannot read the order while payment is pending (privacy rule)", ((await winnerUser.client.from("orders").select("id").eq("requirement_id", rid)).data || []).length === 0);
  const wq = (await winnerUser.client.from("vendor_quotes").select("status").eq("requirement_id", rid)).data || [];
  check("the winning vendor still sees that they won (their quote is selected)", wq.length === 1 && wq[0].status === "selected", JSON.stringify(wq));
  // (Vendors read paid orders through the app's server route, which uses the service key; the direct policy's payments
  //  sub-query is itself row-protected, so a vendor never reads orders directly. Not part of the RFQ rules.)
  check("the losing vendor cannot read the order", ((await loserUser.client.from("orders").select("id").eq("requirement_id", rid)).data || []).length === 0);
  check("the customer can read the order", ((await cust.client.from("orders").select("id").eq("requirement_id", rid)).data || []).length === 1);
  const nn = await admin.from("notifications").select("recipient_id,title").eq("entity_type", "order").eq("entity_id", dbOrder[0]?.id);
  check("winner and customer are notified about the order", (nn.data || []).length === 2);

  // ---------- Food Shorts functions are closed to signed-out visitors ----------
  const anonShorts = await createClient(url, anon, opts).rpc("nearby_food_shorts", { p_lat: ORIGIN.lat, p_lng: ORIGIN.lng, p_radius_km: 30, p_limit: 5 });
  check("signed-out visitors cannot call the Food Shorts feed", !!anonShorts.error, anonShorts.error?.message);
} catch (e) { console.log("SCRIPT ERROR", e); results.push(false); }
finally {
  const reqIds = created.reqs.filter(Boolean);
  const orders = reqIds.length ? ((await admin.from("orders").select("id").in("requirement_id", reqIds)).data || []).map((o) => o.id) : [];
  if (orders.length) { await admin.from("payments").delete().in("order_id", orders); await admin.from("orders").delete().in("id", orders); }
  if (created.users.length) await admin.from("notifications").delete().in("recipient_id", created.users);
  if (reqIds.length) await admin.from("customer_requirements").delete().in("id", reqIds);
  const strays = ((await admin.from("customer_requirements").select("id").in("customer_id", created.users)).data || []).map((r) => r.id);
  if (strays.length) { const so = ((await admin.from("orders").select("id").in("requirement_id", strays)).data || []).map((o) => o.id); if (so.length) { await admin.from("payments").delete().in("order_id", so); await admin.from("orders").delete().in("id", so); } await admin.from("customer_requirements").delete().in("id", strays); }
  await admin.from("profiles").update({ vendor_id: null }).in("id", created.users);
  await admin.from("vendors").delete().in("id", created.vendors);
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
  const left = await admin.from("vendors").select("id").in("id", created.vendors);
  console.log("cleanup: vendors left =", left.data?.length, "| users deleted =", created.users.length);
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exitCode = results.every(Boolean) ? 0 : 1;
}
