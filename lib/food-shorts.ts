// Food Shorts data layer — one hook, two interchangeable back-ends (same pattern as lib/social.ts):
//   remote — Supabase tables, functions and the food-shorts storage bucket from
//            supabase/V8_4_FOOD_SHORTS.sql. Customers read through nearby_food_shorts(),
//            which applies the distance rule and followed-vendor access on the server.
//   local  — browser storage (+ IndexedDB for video), used automatically while that migration
//            hasn't been applied or Supabase isn't configured. The same rules are applied in the
//            browser so the feature is fully demonstrable. Flagged sample clips (no video) keep a
//            fresh install from looking empty; they never reach the database.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient, isLiveSupabaseMode } from "@/lib/supabase";
import { MAX_SHORTS_PER_DAY, checkVideoDuration, checkVideoFile, defaultReachKm, haversineKm, shortVisibleAtDistance, type ShortStatus } from "@/lib/food-shorts-rules";
import { deleteLocalVideo, loadLocalVideoUrl, saveLocalVideo } from "@/lib/food-shorts-media";

export type FoodShort = {
  id: string; vendorId: string; vendorName: string; vendorCategory: string; productId?: string | null;
  title: string; caption: string; shopLink?: string | null; videoUrl?: string; thumbUrl?: string; durationS: number; reachKm: number;
  status: ShortStatus; viewCount: number; likeCount: number; createdAt: string; distanceKm?: number; sample?: boolean;
  videoKey?: string;
};
export type ShortsVendor = { id: string; businessName: string; category: string; latitude?: number; longitude?: number; radiusKm: number; verification?: string; operational?: string };
export type ShortsUser = { email: string; name: string; userId?: string; role?: string; vendorId?: string };
export type ViewerPin = { latitude?: number; longitude?: number };
export type PublishInput = { title: string; caption: string; file: File; thumbDataUrl: string; durationS: number; reachKm: number; productId?: string | null; shopLink?: string };

const KEY = "sheplates-food-shorts-v1";
type LocalStore = { shorts: FoodShort[]; likes: Record<string, string[]>; views: Record<string, number> };
const EMPTY: LocalStore = { shorts: [], likes: {}, views: {} };

function readStore(): LocalStore {
  try { const raw = localStorage.getItem(KEY); return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY }; } catch { return { ...EMPTY }; }
}
function writeStore(store: LocalStore) {
  // never persist object URLs — they die with the page
  const clean = { ...store, shorts: store.shorts.map(({ videoUrl, ...rest }) => { void videoUrl; return rest; }) };
  try { localStorage.setItem(KEY, JSON.stringify(clean)); } catch { /* storage full: keep working in memory */ }
}

const SAMPLE_TITLES: Record<string, string[]> = {
  Bakery: ["Fresh croissants out of the oven", "Today's bread bake"],
  "Home food": ["Lunch boxes being packed", "Sunday special in the making"],
  "Milk & dairy": ["Morning milk run", "Fresh paneer, made today"],
  Vegetables: ["Farm-fresh pick of the day", "Crates just arrived"],
  "Meat & fish": ["Today's fresh catch", "Cut and packed this morning"],
  Groceries: ["New stock on the shelf", "Weekly staples restocked"],
};
function sampleShorts(vendors: ShortsVendor[]): FoodShort[] {
  return vendors.filter((v) => Number.isFinite(v.latitude) && Number.isFinite(v.longitude)).slice(0, 8).map((vendor, index) => {
    const titles = SAMPLE_TITLES[vendor.category] || ["Behind the scenes at the shop"];
    return {
      id: `sample-short-${vendor.id}`, vendorId: vendor.id, vendorName: vendor.businessName, vendorCategory: vendor.category,
      title: titles[index % titles.length], caption: "Sample clip. Real shorts from vendors appear here.", durationS: 12 + ((index * 5) % 17),
      reachKm: defaultReachKm(vendor.radiusKm), status: "active" as const, viewCount: 40 + index * 17, likeCount: 6 + index * 3,
      createdAt: new Date(Date.now() - (index * 2 + 1) * 3_600_000).toISOString(), sample: true,
    };
  });
}

type RemoteRow = {
  id: string; vendor_id: string; vendor_name?: string; vendor_category?: string; product_id: string | null; shop_link?: string | null; title: string; caption: string;
  video_url: string; thumb_url: string | null; duration_s: number | string; reach_km: number | string; status?: ShortStatus; view_count: number;
  like_count?: number | string; liked?: boolean; created_at: string; distance_km?: number; food_short_likes?: { count: number }[];
};
const mapRemote = (r: RemoteRow, vendorName = ""): FoodShort => ({
  id: r.id, vendorId: r.vendor_id, vendorName: r.vendor_name || vendorName, vendorCategory: r.vendor_category || "", productId: r.product_id,
  title: r.title, caption: r.caption, shopLink: r.shop_link, videoUrl: r.video_url, thumbUrl: r.thumb_url || undefined, durationS: Number(r.duration_s), reachKm: Number(r.reach_km),
  status: r.status || "active", viewCount: r.view_count, likeCount: Number(r.like_count ?? r.food_short_likes?.[0]?.count ?? 0), createdAt: r.created_at, distanceKm: r.distance_km,
});

export function useFoodShorts(user: ShortsUser, vendors: ShortsVendor[], viewer: ViewerPin) {
  const [mode, setMode] = useState<"loading" | "remote" | "local">("loading");
  const [remoteFeed, setRemoteFeed] = useState<FoodShort[]>([]);
  const [feedError, setFeedError] = useState("");
  const [remoteMine, setRemoteMine] = useState<FoodShort[]>([]);
  const [remoteLiked, setRemoteLiked] = useState<string[]>([]);
  const [store, setStore] = useState<LocalStore>(EMPTY);
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const viewedRef = useRef<Set<string>>(new Set());
  const storeRef = useRef(store);
  useEffect(() => { storeRef.current = store; }, [store]);
  const { userId, role, vendorId, email } = user;
  const lat = viewer.latitude, lng = viewer.longitude;
  const pinOk = Number.isFinite(lat) && Number.isFinite(lng);
  const vendorKey = vendors.map((v) => v.id).join("|");

  // pick the back-end once per signed-in user
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setStore(readStore()); });
    (async () => {
      const sb = getSupabaseBrowserClient();
      if (!sb || !isLiveSupabaseMode() || !userId) { if (!cancelled) setMode("local"); return; }
      const probe = await sb.from("food_shorts").select("id").limit(1);
      if (!cancelled) setMode(probe.error ? "local" : "remote"); // V8_4_FOOD_SHORTS.sql not applied yet -> local
    })().catch(() => { if (!cancelled) setMode("local"); });
    return () => { cancelled = true; };
  }, [email, userId]);

  const refresh = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (mode !== "remote" || !sb) return;
    if (role === "customer") {
      const res = await sb.rpc("nearby_food_shorts", { p_lat: lat ?? null, p_lng: lng ?? null, p_radius_km: 30, p_limit: 100 });
      if (res.error) {
        console.error("Food Shorts feed refresh failed", res.error);
        setFeedError(res.error.message);
      } else {
        setFeedError("");
        const rows = (res.data || []) as RemoteRow[];
        setRemoteFeed(rows.map((r) => mapRemote(r)));
        setRemoteLiked(rows.filter((r) => r.liked).map((r) => r.id));
      }
    }
    if (role === "vendor" && vendorId) {
      const res = await sb.rpc("vendor_food_shorts");
      if (res.error) {
        console.error("Vendor Food Shorts refresh failed", res.error);
        setFeedError(res.error.message);
      } else {
        setFeedError("");
        const name = vendors.find((v) => v.id === vendorId)?.businessName || "";
        setRemoteMine(((res.data || []) as RemoteRow[]).map((r) => mapRemote(r, name)));
      }
    }
  }, [mode, role, vendorId, lat, lng, vendors]);
  useEffect(() => { const initial = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(initial); }, [refresh]);

  useEffect(() => {
    if (mode !== "remote" || (role !== "customer" && role !== "vendor")) return;
    const refreshOnFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    const interval = window.setInterval(() => void refresh(), 30_000);
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [mode, role, refresh]);

  useEffect(() => {
    if (mode !== "local") return;
    const syncLocalShorts = (event: StorageEvent) => {
      if (event.key === KEY) setStore(readStore());
    };
    window.addEventListener("storage", syncLocalShorts);
    return () => window.removeEventListener("storage", syncLocalShorts);
  }, [mode]);

  // resolve stored (IndexedDB) videos to playable URLs
  useEffect(() => {
    if (mode !== "local") return;
    let cancelled = false;
    store.shorts.forEach((s) => {
      const key = s.videoKey; if (!key || videoUrls[key]) return;
      void loadLocalVideoUrl(key).then((url) => { if (url && !cancelled) setVideoUrls((c) => (c[key] ? c : { ...c, [key]: url })); });
    });
    return () => { cancelled = true; };
  }, [mode, store.shorts, videoUrls]);

  const samples = useMemo(() => (mode === "local" && role === "customer" ? sampleShorts(vendors) : []), [mode, role, vendorKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const vendorById = useCallback((id: string) => vendors.find((v) => v.id === id), [vendors]);
  const vendorLive = (v?: ShortsVendor) => Boolean(v && v.verification === "Verified" && v.operational === "Active");

  /** Shorts this customer may see inside `radiusKm`, each with its distance. */
  const nearby = useCallback((radiusKm: number): FoodShort[] => {
    if (!pinOk) return [];
    if (mode === "remote") return remoteFeed.filter((s) => shortVisibleAtDistance(s, s.distanceKm, radiusKm));
    const all = [...store.shorts.map((s) => ({ ...s, videoUrl: s.videoKey ? videoUrls[s.videoKey] : s.videoUrl })), ...samples];
    return all.flatMap((s) => {
      const v = vendorById(s.vendorId);
      if (!v || !vendorLive(v) || !Number.isFinite(v.latitude) || !Number.isFinite(v.longitude)) return [];
      const distanceKm = haversineKm(lat as number, lng as number, v.latitude as number, v.longitude as number);
      const likeBonus = store.likes ? Object.values(store.likes).filter((ids) => ids.includes(s.id)).length : 0;
      const views = store.views[s.id] || 0;
      return shortVisibleAtDistance(s, distanceKm, radiusKm) ? [{ ...s, vendorName: v.businessName, vendorCategory: v.category, distanceKm, likeCount: s.likeCount + likeBonus, viewCount: s.viewCount + views }] : [];
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [pinOk, mode, remoteFeed, store, videoUrls, samples, vendorById, lat, lng]);

  const forVendor = useCallback((id: string, radiusKm: number) => nearby(radiusKm).filter((s) => s.vendorId === id), [nearby]);

  const following = useCallback((vendorIds: string[]): FoodShort[] => {
    if (!vendorIds.length) return [];
    const followed = new Set(vendorIds);
    if (mode === "remote") return remoteFeed.filter((short) => followed.has(short.vendorId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return store.shorts
      .filter((short) => followed.has(short.vendorId) && short.status === "active")
      .flatMap((short) => {
        const vendor = vendorById(short.vendorId);
        if (!vendor || vendor.verification !== "Verified" || vendor.operational !== "Active") return [];
        return [{
          ...short,
          videoUrl: short.videoKey ? videoUrls[short.videoKey] : short.videoUrl,
          vendorName: vendor.businessName,
          vendorCategory: vendor.category,
          likeCount: short.likeCount + Object.values(store.likes).filter((ids) => ids.includes(short.id)).length,
          viewCount: short.viewCount + (store.views[short.id] || 0),
        }];
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [mode, remoteFeed, store, vendorById, videoUrls]);

  const mine = useMemo<FoodShort[]>(() => {
    if (role !== "vendor" || !vendorId) return [];
    if (mode === "remote") return remoteMine;
    return store.shorts.filter((s) => s.vendorId === vendorId && s.status !== "removed").map((s) => ({ ...s, videoUrl: s.videoKey ? videoUrls[s.videoKey] : s.videoUrl, viewCount: s.viewCount + (store.views[s.id] || 0), likeCount: s.likeCount + Object.values(store.likes).filter((ids) => ids.includes(s.id)).length }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [role, vendorId, mode, remoteMine, store, videoUrls]);

  const liked = useMemo(() => (mode === "remote" ? remoteLiked : store.likes[email.toLowerCase()] || []), [mode, remoteLiked, store.likes, email]);

  const persist = useCallback((next: LocalStore) => { setStore(next); writeStore(next); }, []);

  const publish = useCallback(async (input: PublishInput): Promise<FoodShort> => {
    if (role !== "vendor" || !vendorId) throw new Error("Only a vendor can post a Food Short");
    const fileCheck = checkVideoFile(input.file); if (!fileCheck.ok) throw new Error(fileCheck.message);
    const lengthCheck = checkVideoDuration(input.durationS); if (!lengthCheck.ok) throw new Error(lengthCheck.message);
    if (!input.title.trim()) throw new Error("Give the short a title");
    const shopLink = input.shopLink?.trim();
    if (shopLink) {
      let parsedShopLink: URL;
      try { parsedShopLink = new URL(shopLink); } catch { throw new Error("Enter a valid shop link beginning with https://"); }
      if (!["https:", "http:"].includes(parsedShopLink.protocol)) throw new Error("Shop links must use http:// or https://");
    }
    const today = mine.filter((s) => Date.now() - new Date(s.createdAt).getTime() < 86_400_000).length;
    if (today >= MAX_SHORTS_PER_DAY) throw new Error(`Daily limit reached: ${MAX_SHORTS_PER_DAY} Food Shorts per day`);
    const vendorName = vendorById(vendorId)?.businessName || "";
    if (mode === "remote") {
      const sb = getSupabaseBrowserClient(); if (!sb || !userId) throw new Error("Sign in again to post");
      const base = `${userId}/${Date.now().toString(36)}`;
      const ext = input.file.type === "video/webm" ? "webm" : input.file.type === "video/quicktime" ? "mov" : "mp4";
      const videoPath = `${base}.${ext}`, thumbPath = `${base}.jpg`;
      const up = await sb.storage.from("food-shorts").upload(videoPath, input.file, { contentType: input.file.type });
      if (up.error) throw new Error(up.error.message);
      const thumbBlob = await (await fetch(input.thumbDataUrl)).blob();
      await sb.storage.from("food-shorts").upload(thumbPath, thumbBlob, { contentType: "image/jpeg" });
      const videoUrl = sb.storage.from("food-shorts").getPublicUrl(videoPath).data.publicUrl;
      const thumbUrl = sb.storage.from("food-shorts").getPublicUrl(thumbPath).data.publicUrl;
      const res = await sb.rpc("create_food_short", { p_title: input.title, p_caption: input.caption, p_video_url: videoUrl, p_thumb_url: thumbUrl, p_duration_s: input.durationS, p_reach_km: input.reachKm, p_product_id: input.productId || null, p_shop_link: shopLink || null }).single();
      if (res.error || !res.data) { await sb.storage.from("food-shorts").remove([videoPath, thumbPath]); throw new Error(res.error?.message || "The short could not be published"); }
      const short = mapRemote(res.data as RemoteRow, vendorName);
      setRemoteMine((c) => [short, ...c]);
      return short;
    }
    const id = `local-short-${Date.now().toString(36)}`;
    await saveLocalVideo(id, input.file);
    const url = URL.createObjectURL(input.file);
    setVideoUrls((c) => ({ ...c, [id]: url }));
    const short: FoodShort = { id, vendorId, vendorName, vendorCategory: vendorById(vendorId)?.category || "", productId: input.productId || null, title: input.title.trim().slice(0, 80), caption: input.caption.trim().slice(0, 300), shopLink: shopLink || null, thumbUrl: input.thumbDataUrl, durationS: input.durationS, reachKm: input.reachKm, status: "active", viewCount: 0, likeCount: 0, createdAt: new Date().toISOString(), videoKey: id };
    persist({ ...storeRef.current, shorts: [short, ...storeRef.current.shorts] });
    return short;
  }, [role, vendorId, mine, mode, userId, vendorById, persist]);

  const setStatus = useCallback(async (id: string, status: "active" | "hidden") => {
    if (mode === "remote") {
      const sb = getSupabaseBrowserClient(); const res = await sb?.from("food_shorts").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      if (res?.error) throw new Error(res.error.message);
      setRemoteMine((c) => c.map((s) => (s.id === id ? { ...s, status } : s)));
    } else persist({ ...storeRef.current, shorts: storeRef.current.shorts.map((s) => (s.id === id ? { ...s, status } : s)) });
  }, [mode, persist]);

  const remove = useCallback(async (id: string) => {
    if (mode === "remote") {
      const sb = getSupabaseBrowserClient(); const target = remoteMine.find((s) => s.id === id);
      const res = await sb?.from("food_shorts").delete().eq("id", id); if (res?.error) throw new Error(res.error.message);
      const paths = [target?.videoUrl, target?.thumbUrl].flatMap((u) => { const m = u?.split("/food-shorts/")[1]; return m ? [decodeURIComponent(m)] : []; });
      if (paths.length) await sb?.storage.from("food-shorts").remove(paths);
      setRemoteMine((c) => c.filter((s) => s.id !== id));
    } else {
      const target = storeRef.current.shorts.find((s) => s.id === id); if (target?.videoKey) void deleteLocalVideo(target.videoKey);
      persist({ ...storeRef.current, shorts: storeRef.current.shorts.filter((s) => s.id !== id) });
    }
  }, [mode, remoteMine, persist]);

  const toggleLike = useCallback(async (id: string) => {
    const has = liked.includes(id);
    if (mode === "remote" && userId) {
      const sb = getSupabaseBrowserClient();
      setRemoteLiked((c) => (has ? c.filter((x) => x !== id) : [...c, id]));
      setRemoteFeed((c) => c.map((s) => (s.id === id ? { ...s, likeCount: Math.max(0, s.likeCount + (has ? -1 : 1)) } : s)));
      const res = has ? await sb?.from("food_short_likes").delete().eq("short_id", id).eq("user_id", userId) : await sb?.from("food_short_likes").insert({ short_id: id, user_id: userId });
      if (res?.error) { void refresh(); throw new Error(res.error.message); }
      return;
    }
    const key = email.toLowerCase(), current = storeRef.current;
    const mineLikes = current.likes[key] || [];
    persist({ ...current, likes: { ...current.likes, [key]: has ? mineLikes.filter((x) => x !== id) : [...mineLikes, id] } });
  }, [liked, mode, userId, email, persist, refresh]);

  const recordView = useCallback(async (id: string) => {
    if (role !== "customer" || viewedRef.current.has(id) || id.startsWith("sample-")) return;
    viewedRef.current.add(id);
    if (mode === "remote") {
      try {
        const sb = getSupabaseBrowserClient();
        if (!sb) throw new Error("Food Shorts service is unavailable");
        const res = await sb.rpc("record_short_view", { p_short_id: id });
        if (res.error) throw new Error(res.error.message);
        if (typeof res.data === "number") {
          setRemoteFeed((current) => current.map((short) => short.id === id ? { ...short, viewCount: res.data } : short));
        }
      } catch (error) {
        viewedRef.current.delete(id);
        console.error("Food Short view could not be recorded", error);
        throw error;
      }
      return;
    }
    const current = storeRef.current; persist({ ...current, views: { ...current.views, [id]: (current.views[id] || 0) + 1 } });
  }, [role, mode, persist]);

  return { mode, nearby, following, forVendor, mine, liked, feedError, publish, setStatus, remove, toggleLike, recordView, refresh };
}

export type ShortsApi = ReturnType<typeof useFoodShorts>;
