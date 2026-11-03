// Live check of supabase/V9_2_LIVE_CAMPAIGNS.sql with throwaway users (deleted at the end).
// Run: node --env-file=.env.local scripts/verify-campaigns-live.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, svc, opts);
const tag = "zz-camp-" + Date.now().toString(36);
const results = [];
const check = (name, ok, extra = "") => { results.push(Boolean(ok)); console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  [" + extra + "]" : "")); };
const created = { users: [], campaigns: [], vendors: [], orders: [] };

async function mkUser(role, name) {
  const email = `${tag}-${name}@sheplates.test`, password = "Zz-test-123456";
  const u = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role: role === "vendor" ? "vendor" : "customer" } });
  if (u.error) throw u.error; created.users.push(u.data.user.id);
  await admin.from("profiles").upsert({ id: u.data.user.id, full_name: name, role }, { onConflict: "id" });
  const client = createClient(url, anon, opts); const s = await client.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  return { id: u.data.user.id, client };
}
const hours = (h) => new Date(Date.now() + h * 3_600_000).toISOString();
const base = (o = {}) => ({ name: `${tag} ${o.headline || "c"}`, audience: "All customers", offer: "Offer", channel: "In-app", status: "active", headline: "Headline", subline: "Sub", emoji: "🎉", cta_label: "Shop now", target_type: "none", segment: "everyone", priority: 0, ...o });
async function add(client, o) { const r = await client.from("marketing_campaigns").insert(base(o)).select("id").single(); if (r.data?.id) created.campaigns.push(r.data.id); return r; }
const adminAdd = async (o) => { const r = await admin.from("marketing_campaigns").insert(base(o)).select("id").single(); if (r.error) throw r.error; created.campaigns.push(r.data.id); return r.data.id; };

try {
  const boss = await mkUser("admin", "boss"), ops = await mkUser("operations", "ops"), newbie = await mkUser("customer", "newbie"), regular = await mkUser("customer", "regular"), vend = await mkUser("vendor", "vend");
  const feed = async (u) => ((await u.client.rpc("live_campaigns")).data || []);
  const names = (rows) => rows.filter((r) => r.name.startsWith(tag)).map((r) => r.headline);

  // a returning customer needs one past order
  const v = await admin.from("vendors").insert({ owner_id: vend.id, name: tag + " vendor", category: "Bakery", locality: "T", verification_status: "verified", operational_status: "active", marketplace_visible: true }).select("id").single();
  created.vendors.push(v.data.id);
  const o = await admin.from("orders").insert({ order_number: tag.toUpperCase(), customer_id: regular.id, vendor_id: v.data.id, vendor_base_total: 100, customer_total: 110, fulfilment_mode: "vendor_delivery", scheduled_date: new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10), scheduled_slot: "x", status: "confirmed" }).select("id").single();
  if (o.error) throw o.error; created.orders.push(o.data.id);

  // ---------- who can write ----------
  const asAdmin = await add(boss.client, { headline: "Admin draft", status: "draft" });
  check("an admin can create a campaign", !asAdmin.error, asAdmin.error?.message);
  const byOps = await add(ops.client, { headline: "Ops try" });
  const byCust = await add(newbie.client, { headline: "Customer try" });
  check("operations cannot create a campaign", !!byOps.error);
  check("a customer cannot create a campaign", !!byCust.error);
  check("operations can read campaigns", ((await ops.client.from("marketing_campaigns").select("id").eq("id", asAdmin.data?.id)).data || []).length === 1);
  check("a customer cannot read the campaigns table", ((await newbie.client.from("marketing_campaigns").select("id")).data || []).length === 0);
  const custUpdate = await newbie.client.from("marketing_campaigns").update({ status: "active" }).eq("id", asAdmin.data?.id).select("id");
  check("a customer cannot change a campaign", (custUpdate.data || []).length === 0);

  // ---------- going live ----------
  check("a draft is not shown to customers", !names(await feed(newbie)).includes("Admin draft"));
  const noHeadline = await adminAddSafe({ headline: "  ", status: "active" });
  check("a campaign cannot go live without a headline", !!noHeadline.error, noHeadline.error?.message);
  const badWindow = await adminAddSafe({ headline: "Bad window", status: "active", starts_at: hours(5), ends_at: hours(2) });
  check("an end before the start is refused", !!badWindow.error, badWindow.error?.message);
  const badTarget = await adminAddSafe({ headline: "Bad target", target_type: "teleport" });
  check("an unknown button target is refused", !!badTarget.error, badTarget.error?.message);

  const live = await boss.client.from("marketing_campaigns").update({ status: "active", headline: "Admin live" }).eq("id", asAdmin.data?.id).select("id");
  check("the admin sets it live", (live.data || []).length === 1, live.error?.message);
  const seen = await feed(newbie);
  const row = seen.find((r) => r.headline === "Admin live");
  check("a customer now sees the live campaign with its banner fields", row && row.cta_label === "Shop now" && row.emoji === "🎉" && row.subline === "Sub", JSON.stringify(row && { h: row.headline, cta: row.cta_label }));
  check("the feed leaves out internal fields (audience, rationale, counters)", row && !("audience" in row) && !("ai_rationale" in row) && !("view_count" in row));
  check("operations and vendors also get the feed function without error", !(await ops.client.rpc("live_campaigns")).error && !(await vend.client.rpc("live_campaigns")).error);
  const signedOut = await createClient(url, anon, opts).rpc("live_campaigns");
  check("a signed-out visitor cannot read campaigns", !!signedOut.error, signedOut.error?.message);

  // ---------- pause / schedule / end ----------
  await boss.client.from("marketing_campaigns").update({ status: "paused" }).eq("id", asAdmin.data?.id);
  check("paused campaigns disappear at once", !names(await feed(newbie)).includes("Admin live"));
  await boss.client.from("marketing_campaigns").update({ status: "active" }).eq("id", asAdmin.data?.id);
  check("and return when set live again", names(await feed(newbie)).includes("Admin live"));
  await adminAdd({ headline: "Starts later", starts_at: hours(3), ends_at: hours(9) });
  await adminAdd({ headline: "Already ended", starts_at: hours(-9), ends_at: hours(-1) });
  const w = names(await feed(newbie));
  check("a future start is not shown yet", !w.includes("Starts later"));
  check("an ended campaign is not shown", !w.includes("Already ended"));
  const t0 = await adminAdd({ headline: "Window open", starts_at: hours(-2), ends_at: hours(2) });
  check("inside its dates it is shown", names(await feed(newbie)).includes("Window open"));
  await admin.from("marketing_campaigns").update({ ends_at: hours(-0.01), starts_at: hours(-3) }).eq("id", t0);
  check("the moment its end passes it disappears", !names(await feed(newbie)).includes("Window open"));

  // ---------- audience ----------
  await adminAdd({ headline: "For new", segment: "new_customers" });
  await adminAdd({ headline: "For returning", segment: "returning_customers" });
  const forNew = names(await feed(newbie)), forReg = names(await feed(regular));
  check("a customer with no orders sees the new-customer campaign only", forNew.includes("For new") && !forNew.includes("For returning"), forNew.join(", "));
  check("a customer with an order sees the returning-customer campaign only", forReg.includes("For returning") && !forReg.includes("For new"), forReg.join(", "));
  check("everyone-campaigns reach both", forNew.includes("Admin live") && forReg.includes("Admin live"));

  // ---------- priority and the cap of six ----------
  for (let i = 0; i < 8; i++) await adminAdd({ headline: `Rank ${i}`, priority: i });
  const ranked = (await feed(newbie)).filter((r) => r.name.startsWith(tag));
  check("customers see at most six campaigns", ranked.length === 6, String(ranked.length));
  check("highest priority first", ranked[0]?.headline === "Rank 7" && ranked[1]?.headline === "Rank 6", ranked.map((r) => r.headline).join(", "));

  // ---------- counters ----------
  const before = (await admin.from("marketing_campaigns").select("view_count,click_count").eq("id", asAdmin.data?.id).single()).data;
  await newbie.client.rpc("record_campaign_event", { p_campaign: asAdmin.data?.id, p_kind: "view" });
  await newbie.client.rpc("record_campaign_event", { p_campaign: asAdmin.data?.id, p_kind: "view" });
  await regular.client.rpc("record_campaign_event", { p_campaign: asAdmin.data?.id, p_kind: "click" });
  await newbie.client.rpc("record_campaign_event", { p_campaign: asAdmin.data?.id, p_kind: "hack" });
  const after = (await admin.from("marketing_campaigns").select("view_count,click_count").eq("id", asAdmin.data?.id).single()).data;
  check("two views and one tap are counted", after.view_count === before.view_count + 2 && after.click_count === before.click_count + 1, JSON.stringify({ before, after }));
  const draftId = (await admin.from("marketing_campaigns").select("id").eq("id", asAdmin.data?.id).single()).data.id;
  await boss.client.from("marketing_campaigns").update({ status: "paused" }).eq("id", draftId);
  await newbie.client.rpc("record_campaign_event", { p_campaign: draftId, p_kind: "view" });
  const paused = (await admin.from("marketing_campaigns").select("view_count").eq("id", draftId).single()).data;
  check("views on a paused campaign are not counted", paused.view_count === after.view_count, String(paused.view_count));
  const anonEvent = await createClient(url, anon, opts).rpc("record_campaign_event", { p_campaign: draftId, p_kind: "view" });
  check("a signed-out visitor cannot count events", !!anonEvent.error, anonEvent.error?.message);
  check("the admin can read the results", ((await boss.client.from("marketing_campaigns").select("view_count,click_count").eq("id", draftId)).data || []).length === 1);

  async function adminAddSafe(o) { const r = await admin.from("marketing_campaigns").insert(base(o)).select("id").single(); if (r.data?.id) created.campaigns.push(r.data.id); return r; }
} catch (e) { console.log("SCRIPT ERROR", e); results.push(false); }
finally {
  if (created.campaigns.length) await admin.from("marketing_campaigns").delete().in("id", created.campaigns);
  await admin.from("marketing_campaigns").delete().like("name", `${tag}%`);
  if (created.orders.length) await admin.from("orders").delete().in("id", created.orders);
  if (created.vendors.length) await admin.from("vendors").delete().in("id", created.vendors);
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
  const left = await admin.from("marketing_campaigns").select("id").like("name", `${tag}%`);
  console.log("cleanup: campaigns left =", left.data?.length, "| users deleted =", created.users.length);
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
  process.exitCode = results.every(Boolean) ? 0 : 1;
}
