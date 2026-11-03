// Live check of supabase/V9_3_PEOPLE_STATUS.sql with throwaway users (deleted at the end).
// Run: node --env-file=.env.local scripts/verify-people-status-live.mjs
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, svc, opts);
const tag = "zz-people-" + Date.now().toString(36);
const results = []; const check = (name, ok, extra = "") => { results.push(ok); console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  [" + extra + "]" : "")); };
const created = { users: [], files: [] };
async function mkUser(role, name) {
  const email = `${tag}-${name}@sheplates.test`, password = "Zz-test-123456";
  const u = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name, role } });
  if (u.error) throw u.error; created.users.push(u.data.user.id);
  await admin.from("profiles").upsert({ id: u.data.user.id, full_name: name, role }, { onConflict: "id" });
  const client = createClient(url, anon, opts); const s = await client.auth.signInWithPassword({ email, password }); if (s.error) throw s.error;
  const sp = await client.rpc("ensure_social_profile", { p_handle: null }); if (sp.error) throw sp.error;
  const handle = (await admin.from("social_profiles").select("handle").eq("user_id", u.data.user.id).single()).data.handle;
  return { id: u.data.user.id, client, handle };
}
const ORIGIN = { lat: 11.0383247, lng: 76.9780717 };     // exact pin (RS Puram)
const north = (km) => ({ lat: ORIGIN.lat + km / 111.32, lng: ORIGIN.lng });
const PHOTO = "https://example.com/a.jpg";
try {
  const a = await mkUser("customer", "ann"), b = await mkUser("customer", "bea"), c = await mkUser("customer", "cat"), v = await mkUser("vendor", "vik");

  // ---------- follow / search ----------
  check("follow a customer", !(await a.client.rpc("follow_person", { p_user: b.id })).error);
  check("cannot follow yourself", !!(await a.client.rpc("follow_person", { p_user: a.id })).error);
  const counts = (await a.client.rpc("my_follow_counts").single()).data; check("following count is 1", Number(counts.following) === 1, JSON.stringify(counts));
  const bCounts = (await b.client.rpc("my_follow_counts").single()).data; check("the other person has 1 follower", Number(bCounts.followers) === 1, JSON.stringify(bCounts));
  const direct = await a.client.from("customer_follows").insert({ follower_id: a.id, followee_id: c.id }); check("follows can only be written through the function", !!direct.error, direct.error?.message);
  const list = (await a.client.rpc("list_people", { p_kind: "following" })).data || []; check("following list holds bea", list.length === 1 && list[0].user_id === b.id);
  const flist = (await b.client.rpc("list_people", { p_kind: "followers" })).data || []; check("followers list holds ann", flist.length === 1 && flist[0].user_id === a.id);
  const one = await a.client.rpc("search_people", { p_query: b.handle.slice(0, 1) }); check("search needs two characters", (one.data || []).length === 0);
  const found = await a.client.rpc("search_people", { p_query: "@" + b.handle.slice(0, 6).toUpperCase() }); check("search by handle prefix, case and @ ignored", (found.data || []).some((r) => r.user_id === b.id && r.following === true), JSON.stringify(found.error));
  check("search never returns yourself", !(found.data || []).some((r) => r.user_id === a.id));
  check("search returns no location", !(found.data || []).some((r) => "pin_lat" in r || "dist_km" in r));
  check("unfollow", !(await a.client.rpc("unfollow_person", { p_user: b.id })).error && Number((await a.client.rpc("my_follow_counts").single()).data.following) === 0);
  await a.client.rpc("follow_person", { p_user: b.id });

  // ---------- map presence is opt in and coarse ----------
  const none = (await a.client.rpc("people_nearby", { p_lat: ORIGIN.lat, p_lng: ORIGIN.lng, p_radius_km: 30 })).data || []; check("nobody is on the map by default", none.length === 0, String(none.length));
  const on = await b.client.rpc("set_discoverable", { p_on: true, p_lat: north(2).lat, p_lng: north(2).lng }); check("bea switches the map on", !on.error, on.error?.message);
  const stored = (await admin.from("social_profiles").select("map_lat,map_lng,discoverable").eq("user_id", b.id).single()).data;
  check("only a coarse position is stored (0.005 grid)", Math.abs(Math.round(stored.map_lat / 0.005) * 0.005 - stored.map_lat) < 1e-6 && Math.abs(stored.map_lat - north(2).lat) > 1e-9, JSON.stringify(stored));
  const nearA = (await a.client.rpc("people_nearby", { p_lat: ORIGIN.lat, p_lng: ORIGIN.lng, p_radius_km: 5 })).data || [];
  check("ann sees bea within 5 km", nearA.some((r) => r.user_id === b.id));
  check("distance is to the nearest half km", nearA.every((r) => Number(r.dist_km) * 2 === Math.round(Number(r.dist_km) * 2)), nearA.map((r) => r.dist_km).join(","));
  const near1 = (await a.client.rpc("people_nearby", { p_lat: ORIGIN.lat, p_lng: ORIGIN.lng, p_radius_km: 1 })).data || []; check("not within 1 km", near1.length === 0);
  const filtered = (await a.client.rpc("people_nearby", { p_lat: ORIGIN.lat, p_lng: ORIGIN.lng, p_radius_km: 5, p_query: "zzzzqq" })).data || []; check("handle filter narrows the map", filtered.length === 0);
  const far = (await a.client.rpc("people_nearby", { p_lat: north(60).lat, p_lng: ORIGIN.lng, p_radius_km: 99 })).data || []; check("radius is capped at 30 km", far.length === 0);
  const asVendor = (await v.client.rpc("people_nearby", { p_lat: ORIGIN.lat, p_lng: ORIGIN.lng, p_radius_km: 5 })).data || []; check("vendors are never on the people map", !asVendor.some((r) => r.user_id === v.id));
  check("map switch needs a position", !!(await c.client.rpc("set_discoverable", { p_on: true, p_lat: null, p_lng: null })).error);
  const rawRead = await a.client.from("social_profiles").select("map_lat,map_lng,discoverable").eq("user_id", b.id); check("map position cannot be read straight from the table", !!rawRead.error || !(rawRead.data || []).some((r) => r.map_lat != null), rawRead.error?.message || JSON.stringify(rawRead.data));
  check("handle and bio stay readable", !(await a.client.from("social_profiles").select("handle,bio").eq("user_id", b.id).single()).error);
  const selfWrite = await b.client.from("social_profiles").update({ discoverable: true, map_lat: 11.0383247, map_lng: 76.9780717 }).eq("user_id", b.id); check("the map position cannot be written straight to the table", !!selfWrite.error, selfWrite.error?.message);
  check("my_discoverable() reports your own setting", (await b.client.rpc("my_discoverable")).data === true && (await c.client.rpc("my_discoverable")).data === false);
  check("handle and bio can still be edited", !(await b.client.from("social_profiles").update({ bio: "hello", updated_at: new Date().toISOString() }).eq("user_id", b.id)).error);

  // ---------- statuses ----------
  const post = (cl, o = {}) => cl.rpc("post_status", { p_kind: "photo", p_media_url: PHOTO, p_thumb_url: null, p_caption: "lunch", p_vendor_id: null, p_duration_s: null, ...o }).single();
  const s1 = await post(b.client); check("customer posts a status", !s1.error && !!s1.data?.id, s1.error?.message);
  const hours = (new Date(s1.data.expires_at) - new Date(s1.data.created_at)) / 3_600_000; check("it expires 24 hours after it was posted", Math.abs(hours - 24) < 0.01, String(hours));
  check("a vendor cannot post a status", !!(await post(v.client)).error);
  check("a video longer than 30 s is refused", !!(await post(b.client, { p_kind: "video", p_duration_s: 31 })).error);
  check("a video needs its length", !!(await post(b.client, { p_kind: "video" })).error);
  const longTtl = await admin.from("customer_statuses").insert({ author_id: b.id, kind: "photo", media_url: PHOTO, expires_at: new Date(Date.now() + 48 * 3_600_000).toISOString() }); check("the table refuses a status that would last longer than 24 h", !!longTtl.error, longTtl.error?.message);

  const feedA = (await a.client.rpc("status_feed", { p_lat: ORIGIN.lat, p_lng: ORIGIN.lng, p_radius_km: 5 })).data || [];
  check("ann (follows bea) sees the status", feedA.some((r) => r.status_id === s1.data.id && r.source === "following"));
  const feedC = (await c.client.rpc("status_feed", { p_lat: ORIGIN.lat, p_lng: ORIGIN.lng, p_radius_km: 5 })).data || [];
  check("cat (not following, within 5 km of a map-visible bea) sees it as nearby", feedC.some((r) => r.status_id === s1.data.id && r.source === "nearby"));
  const feedCfar = (await c.client.rpc("status_feed", { p_lat: north(10).lat, p_lng: ORIGIN.lng, p_radius_km: 5 })).data || []; check("cat 8 km from bea with radius 5 does not see it", !feedCfar.some((r) => r.status_id === s1.data.id));
  const feedCnopin = (await c.client.rpc("status_feed", {})).data || []; check("without a position only followed people appear", !feedCnopin.some((r) => r.status_id === s1.data.id));
  check("the author does not see her own status in the feed", !((await b.client.rpc("status_feed", { p_lat: ORIGIN.lat, p_lng: ORIGIN.lng, p_radius_km: 5 })).data || []).some((r) => r.status_id === s1.data.id));
  const rawStatus = await c.client.from("customer_statuses").select("id").eq("id", s1.data.id); check("a stranger cannot read the table directly", (rawStatus.data || []).length === 0);

  // view once
  check("ann marks it viewed", !(await a.client.rpc("mark_status_viewed", { p_status: s1.data.id })).error);
  const again = (await a.client.rpc("status_feed", { p_lat: ORIGIN.lat, p_lng: ORIGIN.lng, p_radius_km: 5 })).data || []; check("view-once: it is not offered to ann again", !again.some((r) => r.status_id === s1.data.id));
  const stillC = (await c.client.rpc("status_feed", { p_lat: ORIGIN.lat, p_lng: ORIGIN.lng, p_radius_km: 5 })).data || []; check("but cat can still watch it", stillC.some((r) => r.status_id === s1.data.id));
  const mark2 = await a.client.rpc("mark_status_viewed", { p_status: s1.data.id }); check("viewing twice does not error", !mark2.error);
  check("the author's view count is 1", Number(((await b.client.rpc("my_statuses")).data || []).find((r) => r.id === s1.data.id)?.view_count) === 1);
  check("a like is recorded", !(await c.client.rpc("like_status", { p_status: s1.data.id, p_on: true })).error && Number(((await b.client.rpc("my_statuses")).data || []).find((r) => r.id === s1.data.id)?.like_count) === 1);
  const viewers = (await b.client.rpc("status_viewers", { p_status: s1.data.id })).data || []; check("the author sees who watched", viewers.length === 1 && viewers[0].handle === a.handle, JSON.stringify(viewers));
  check("others cannot list the viewers", ((await a.client.rpc("status_viewers", { p_status: s1.data.id })).data || []).length === 0);
  const hasStatusFlag = (await c.client.rpc("people_nearby", { p_lat: ORIGIN.lat, p_lng: ORIGIN.lng, p_radius_km: 5 })).data || []; check("people_nearby flags people with an unwatched status", hasStatusFlag.find((r) => r.user_id === b.id)?.has_status === true);

  // switching the map off hides her from strangers but not from followers
  await b.client.rpc("set_discoverable", { p_on: false });
  const offC = (await c.client.rpc("status_feed", { p_lat: ORIGIN.lat, p_lng: ORIGIN.lng, p_radius_km: 5 })).data || []; check("map off: strangers no longer see her status", !offC.some((r) => r.status_id === s1.data.id));
  check("map off: her stored position is cleared", (await admin.from("social_profiles").select("map_lat,map_lng").eq("user_id", b.id).single()).data.map_lat === null);

  // ---------- expiry ----------
  const old = await admin.from("customer_statuses").insert({ author_id: b.id, kind: "photo", media_url: "https://example.com/old.jpg", caption: "old", created_at: new Date(Date.now() - 25 * 3_600_000).toISOString(), expires_at: new Date(Date.now() - 3_600_000).toISOString() }).select("id").single();
  check("an expired status can be set up for the test", !old.error, old.error?.message);
  const feedOld = (await a.client.rpc("status_feed", { p_lat: ORIGIN.lat, p_lng: ORIGIN.lng, p_radius_km: 5 })).data || []; check("an expired status is not in the feed", !feedOld.some((r) => r.status_id === old.data?.id));
  check("an expired status is not in the author's list", !((await b.client.rpc("my_statuses")).data || []).some((r) => r.id === old.data?.id));
  const claimed = await b.client.rpc("claim_expired_statuses"); check("the author's app claims expired rows for cleanup", !claimed.error && (claimed.data || []).some((r) => r.m_url === "https://example.com/old.jpg"), claimed.error?.message);
  check("claiming leaves live statuses alone", ((await b.client.rpc("my_statuses")).data || []).some((r) => r.id === s1.data.id));
  const old2 = await admin.from("customer_statuses").insert({ author_id: b.id, kind: "photo", media_url: "https://example.com/old2.jpg", created_at: new Date(Date.now() - 26 * 3_600_000).toISOString(), expires_at: new Date(Date.now() - 2 * 3_600_000).toISOString() }).select("id").single();
  const purgeAsUser = await a.client.rpc("purge_expired_statuses"); check("customers cannot run the scheduled purge", !!purgeAsUser.error, purgeAsUser.error?.message);
  const purged = await admin.rpc("purge_expired_statuses"); check("the scheduled purge removes everyone's expired rows", !purged.error && (purged.data || []).some((r) => r.m_url === "https://example.com/old2.jpg") && !(await admin.from("customer_statuses").select("id").eq("id", old2.data.id)).data?.length, purged.error?.message);

  // ---------- storage ----------
  const bytes = new Blob([new Uint8Array(1024)], { type: "image/jpeg" });
  const upB = await b.client.storage.from("status-media").upload(`${b.id}/t.jpg`, bytes, { contentType: "image/jpeg" }); check("customer uploads into own folder", !upB.error, upB.error?.message); if (!upB.error) created.files.push(`${b.id}/t.jpg`);
  check("customer cannot upload into someone else's folder", !!(await b.client.storage.from("status-media").upload(`${a.id}/x.jpg`, bytes, { contentType: "image/jpeg" })).error);
  check("a vendor cannot upload statuses", !!(await v.client.storage.from("status-media").upload(`${v.id}/x.jpg`, bytes, { contentType: "image/jpeg" })).error);
  check("wrong file type refused", !!(await b.client.storage.from("status-media").upload(`${b.id}/x.exe`, new Blob(["x"], { type: "application/x-msdownload" }), { contentType: "application/x-msdownload" })).error);

  // ---------- deleting ----------
  check("the author deletes her status", !(await b.client.from("customer_statuses").delete().eq("id", s1.data.id)).error && ((await b.client.rpc("my_statuses")).data || []).every((r) => r.id !== s1.data.id));
} catch (e) { console.error("ERROR", e); results.push(false); }
finally {
  if (created.files.length) await admin.storage.from("status-media").remove(created.files);
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
  const passed = results.filter(Boolean).length; console.log(`\n${passed}/${results.length} passed`); process.exit(passed === results.length ? 0 : 1);
}
