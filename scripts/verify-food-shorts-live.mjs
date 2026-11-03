// Live check of supabase/V8_4_FOOD_SHORTS.sql with throwaway users (deleted at the end).
// Run: node --env-file=.env.local scripts/verify-food-shorts-live.mjs
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, svc, opts);
const tag = "zz-shorts-" + Date.now().toString(36);
const results = []; const check = (name, ok, extra = "") => { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  [" + extra + "]" : "")); };
const created = { users: [], vendors: [], shorts: [], files: [] };
async function mkUser(role, name) {
  const email = `${tag}-${name}@sheplates.test`, password = "Zz-test-123456";
  const u = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role } });
  if (u.error) throw u.error; created.users.push(u.data.user.id);
  await admin.from("profiles").upsert({ id: u.data.user.id, full_name: name, role }, { onConflict: "id" });
  const client = createClient(url, anon, opts); const s = await client.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  return { id: u.data.user.id, client };
}
async function mkVendor(ownerId, name, lat, lng, radius, verified = true) {
  const v = await admin.from("vendors").insert({ owner_id: ownerId, name, category: "Bakery", locality: "Test", latitude: lat, longitude: lng, service_radius_km: radius, verification_status: verified ? "verified" : "submitted", operational_status: verified ? "active" : "inactive", marketplace_visible: verified }).select("id").single();
  if (v.error) throw v.error; created.vendors.push(v.data.id);
  await admin.from("profiles").update({ vendor_id: v.data.id }).eq("id", ownerId);
  return v.data.id;
}
const ORIGIN = { lat: 11.0383, lng: 76.9781 };            // customer pin (RS Puram)
const NEAR = { lat: 11.0420, lng: 76.9800 };               // about 0.45 km from the customer
const FAR = { lat: 10.9983, lng: 76.9331 };                // about 6.8 km from the customer
try {
  const vendorA = await mkUser("vendor", "vendorA"), vendorB = await mkUser("vendor", "vendorB"), customer = await mkUser("customer", "cust");
  const vidA = await mkVendor(vendorA.id, "Test Bakery Near", NEAR.lat, NEAR.lng, 10);
  await mkVendor(vendorB.id, "Test Farm Far", FAR.lat, FAR.lng, 10);

  // ---- storage rules ----
  const bytes = new Blob([new Uint8Array(2048)], { type: "video/webm" });
  const upA = await vendorA.client.storage.from("food-shorts").upload(`${vendorA.id}/t1.webm`, bytes, { contentType: "video/webm" });
  check("vendor can upload video into own folder", !upA.error, upA.error?.message); if (!upA.error) created.files.push(`${vendorA.id}/t1.webm`);
  const upOther = await vendorA.client.storage.from("food-shorts").upload(`${vendorB.id}/steal.webm`, bytes, { contentType: "video/webm" });
  check("vendor cannot upload into another user's folder", !!upOther.error, upOther.error?.message);
  const upCust = await customer.client.storage.from("food-shorts").upload(`${customer.id}/c.webm`, bytes, { contentType: "video/webm" });
  check("customer cannot upload to food-shorts", !!upCust.error, upCust.error?.message);
  const upType = await vendorA.client.storage.from("food-shorts").upload(`${vendorA.id}/bad.exe`, new Blob(["x"], { type: "application/x-msdownload" }), { contentType: "application/x-msdownload" });
  check("wrong file type is refused by the bucket", !!upType.error, upType.error?.message);
  const pub = vendorA.client.storage.from("food-shorts").getPublicUrl(`${vendorA.id}/t1.webm`).data.publicUrl;
  const head = await fetch(pub); check("uploaded video is publicly readable", head.ok, String(head.status));

  // ---- create_food_short rules ----
  const mk = (c, o = {}) => c.rpc("create_food_short", { p_title: "Fresh batch", p_caption: "hello", p_video_url: pub, p_thumb_url: null, p_duration_s: 20, p_reach_km: 5, p_product_id: null, ...o }).single();
  const ok = await mk(vendorA.client); check("vendor creates a short (20 s, reach 5 km)", !ok.error && ok.data?.reach_km == 5, ok.error?.message); const shortA = ok.data?.id; if (shortA) created.shorts.push(shortA);
  const long = await mk(vendorA.client, { p_duration_s: 31 }); check("31 second video is refused", !!long.error && /30 seconds/.test(long.error.message), long.error?.message);
  const zero = await mk(vendorA.client, { p_duration_s: 0 }); check("0 second video is refused", !!zero.error, zero.error?.message);
  const notVendor = await mk(customer.client); check("a customer cannot create a short", !!notVendor.error && /vendor/i.test(notVendor.error.message), notVendor.error?.message);
  const noUrl = await mk(vendorA.client, { p_video_url: "javascript:alert(1)" }); check("non-http video url refused", !!noUrl.error, noUrl.error?.message);
  const badProd = await mk(vendorA.client, { p_product_id: "00000000-0000-0000-0000-000000000001" }); check("a product that is not yours is refused", !!badProd.error, badProd.error?.message);
  const direct = await vendorA.client.from("food_shorts").insert({ vendor_id: vidA, title: "x", video_url: pub, duration_s: 45, reach_km: 5 }); check("table check blocks a 45 s insert made directly", !!direct.error, direct.error?.message);
  const reach0 = await mk(vendorA.client, { p_title: "Clamp test", p_reach_km: 100 }); check("reach above 30 km is clamped to 30", !reach0.error && reach0.data?.reach_km == 30, reach0.error?.message); if (reach0.data?.id) created.shorts.push(reach0.data.id);

  // vendor B (far vendor): reach 5 and 10
  const bShort5 = await mk(vendorB.client, { p_title: "Far reach 5", p_reach_km: 5 }); created.shorts.push(bShort5.data.id);
  const bShort10 = await mk(vendorB.client, { p_title: "Far reach 10", p_reach_km: 10 }); created.shorts.push(bShort10.data.id);

  // ---- the distance rule ----
  const near = async (lat, lng, radius) => { const r = await customer.client.rpc("nearby_food_shorts", { p_lat: lat, p_lng: lng, p_radius_km: radius, p_limit: 100 }); if (r.error) throw r.error; return r.data.map((x) => x.title + "@" + Number(x.distance_km).toFixed(1)); };
  const nearIds = async (lat, lng, radius) => { const r = await customer.client.rpc("nearby_food_shorts", { p_lat: lat, p_lng: lng, p_radius_km: radius, p_limit: 100 }); return (r.data || []).map((x) => x.id); };
  const titles = (rows) => rows.map((s) => s.split("@")[0]);
  const at5 = await near(ORIGIN.lat, ORIGIN.lng, 5); check("customer 0.5 km from near vendor sees its short (radius 5)", titles(at5).includes("Fresh batch"), at5.join(", "));
  check("customer does NOT see the far vendor at radius 5", !titles(at5).some((t) => t.startsWith("Far")), at5.join(", "));
  const at10 = await near(ORIGIN.lat, ORIGIN.lng, 10); check("radius 10 shows far vendor's reach-10 short", titles(at10).includes("Far reach 10"), at10.join(", "));
  check("radius 10 still hides far vendor's reach-5 short (vendor limited it)", !titles(at10).includes("Far reach 5"), at10.join(", "));
  const at30 = await near(ORIGIN.lat, ORIGIN.lng, 30); check("radius 30 still hides the reach-5 short", !titles(at30).includes("Far reach 5"), at30.join(", "));
  const at1 = await near(ORIGIN.lat, ORIGIN.lng, 1); check("radius 1 km still shows the 0.45 km vendor", titles(at1).includes("Fresh batch"), at1.join(", "));
  const farOnly = await near(NEAR.lat + 0.2, NEAR.lng, 30); check("a customer 22 km away sees only the short whose reach is 30 km (clamped one)", titles(farOnly).join("|") === "Clamp test", farOnly.join(", "));
  const anonRpc = await createClient(url, anon, opts).rpc("nearby_food_shorts", { p_lat: ORIGIN.lat, p_lng: ORIGIN.lng, p_radius_km: 30, p_limit: 10 }); check("signed-out visitor gets no shorts from the feed function", !anonRpc.error ? (anonRpc.data || []).length === 0 : true, anonRpc.error?.message || `rows=${anonRpc.data?.length}`);

  // ---- RLS: nobody reads the table directly except the owner and staff ----
  const custRead = await customer.client.from("food_shorts").select("id"); check("customer reading the table directly gets nothing", !custRead.error && custRead.data.length === 0, `rows=${custRead.data?.length}`);
  const ownRead = await vendorA.client.from("food_shorts").select("id,view_count,food_short_likes(count)"); check("vendor sees only their own shorts", !ownRead.error && ownRead.data.length === 2, `rows=${ownRead.data?.length}`);
  const bUpdate = await vendorB.client.from("food_shorts").update({ status: "hidden" }).eq("id", shortA).select("id"); check("another vendor cannot hide my short", !bUpdate.error && (bUpdate.data || []).length === 0, `rows=${bUpdate.data?.length}`);
  const bDelete = await vendorB.client.from("food_shorts").delete().eq("id", shortA).select("id"); check("another vendor cannot delete my short", (bDelete.data || []).length === 0);

  // ---- hide / likes / views / vendor not live ----
  const hide = await vendorA.client.from("food_shorts").update({ status: "hidden" }).eq("id", shortA).select("id"); check("owner hides own short", (hide.data || []).length === 1, hide.error?.message);
  const afterHide = await nearIds(ORIGIN.lat, ORIGIN.lng, 5); check("hidden short disappears for customers", !afterHide.includes(shortA));
  await vendorA.client.from("food_shorts").update({ status: "active" }).eq("id", shortA);
  const like = await customer.client.from("food_short_likes").insert({ short_id: shortA, user_id: customer.id }); check("customer likes a short", !like.error, like.error?.message);
  const likeAs = await customer.client.from("food_short_likes").insert({ short_id: shortA, user_id: vendorB.id }); check("cannot like as someone else", !!likeAs.error, likeAs.error?.message);
  await customer.client.rpc("record_short_view", { p_short_id: shortA }); await customer.client.rpc("record_short_view", { p_short_id: shortA });
  const stats = await customer.client.rpc("nearby_food_shorts", { p_lat: ORIGIN.lat, p_lng: ORIGIN.lng, p_radius_km: 5, p_limit: 20 }); const row = (stats.data || []).find((x) => x.id === shortA);
  check("like count and liked flag come back", row && Number(row.like_count) === 1 && row.liked === true, JSON.stringify(row && { likes: row.like_count, liked: row.liked, views: row.view_count }));
  check("views counted", row && row.view_count >= 2, String(row?.view_count));
  await admin.from("vendors").update({ verification_status: "submitted", operational_status: "inactive" }).eq("id", vidA);
  const notLive = await nearIds(ORIGIN.lat, ORIGIN.lng, 5); check("an unverified/inactive vendor's shorts are not shown", !notLive.includes(shortA));
  await admin.from("vendors").update({ verification_status: "verified", operational_status: "active" }).eq("id", vidA);

  // ---- daily cap ----
  let capHit = ""; for (let i = 0; i < 12; i++) { const r = await mk(vendorA.client, { p_title: "cap " + i }); if (r.error) { capHit = r.error.message; break; } created.shorts.push(r.data.id); }
  check("daily cap of 10 shorts is enforced", /Daily limit/.test(capHit), capHit);
} catch (e) { console.log("SCRIPT ERROR", e); results.push(false); }
finally {
  if (created.files.length) await admin.storage.from("food-shorts").remove(created.files);
  for (const id of created.users) { const l = await admin.storage.from("food-shorts").list(id); if (l.data?.length) await admin.storage.from("food-shorts").remove(l.data.map((f) => `${id}/${f.name}`)); }
  await admin.from("food_shorts").delete().in("vendor_id", created.vendors);
  await admin.from("profiles").update({ vendor_id: null }).in("id", created.users);
  await admin.from("vendors").delete().in("id", created.vendors);
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
  const left = await admin.from("vendors").select("id").in("id", created.vendors); console.log("cleanup: vendors left =", left.data?.length, "| users deleted =", created.users.length);
  console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
}
