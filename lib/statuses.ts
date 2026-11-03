// Customer statuses: a photo or a video of up to 30 seconds that disappears after 24 hours and can be
// watched once by each person. Like an Instagram status, not a profile gallery: nothing here is a
// permanent record of what a customer uploaded.
//   remote — supabase/V9_3_PEOPLE_STATUS.sql (who may watch, expiry and view-once are decided by the database).
//   local  — browser storage (video in IndexedDB), used in demo mode or until the migration is applied.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient, isLiveSupabaseMode } from "@/lib/supabase";
import { compressImage } from "@/lib/social";
import { deleteLocalVideo, loadLocalVideoUrl, saveLocalVideo } from "@/lib/food-shorts-media";
import { checkVideoFile } from "@/lib/food-shorts-rules";
import { MAX_ACTIVE_STATUSES, checkStatusVideoSeconds, groupStatuses, isStatusActive, statusExpiry, statusVisibleTo, STATUS_TTL_MS, type Pin } from "@/lib/people-rules";
import { localPersonId, type PeopleApi, type PeopleUser } from "@/lib/people";

export type Status = {
  id: string; authorId: string; handle: string; kind: "photo" | "video"; mediaUrl?: string; thumbUrl?: string; caption: string;
  vendorId?: string | null; vendorName?: string; durationS?: number; createdAt: string; expiresAt: string; likeCount: number; liked: boolean;
  source: "following" | "nearby"; distanceKm?: number; sample?: boolean; mediaKey?: string; emoji?: string; viewed?: boolean;
};
export type MyStatus = Status & { viewCount: number };
export type StatusViewer = { handle: string; viewedAt: string; liked: boolean };
export type PostStatusInput = { kind: "photo" | "video"; file: File; thumbDataUrl?: string; durationS?: number; caption: string; vendorId?: string | null };

const KEY = "sheplates-statuses-v1";
// Ids watched on this device. The database is the record, but a page that is closed or reloaded the moment a
// status ends could drop the request, so this keeps a watched status out of the rail until the database agrees.
const SEEN_KEY = "sheplates-status-seen-v1";
const STATUS_INITIAL_TIME = Date.now();
function readSeen(): string[] { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch { return []; } }
function rememberSeen(id: string) { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...readSeen(), id])].slice(-300))); } catch { /* ignore */ } }
type LocalStatus = Omit<Status, "liked" | "likeCount" | "source" | "handle"> & { handle: string };
type Store = { statuses: LocalStatus[]; views: Record<string, string[]>; likes: Record<string, string[]> };
const EMPTY: Store = { statuses: [], views: {}, likes: {} };
function readStore(): Store { try { const raw = localStorage.getItem(KEY); return raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY }; } catch { return { ...EMPTY }; } }
function writeStore(s: Store) {
  // video object URLs never persist; the file itself lives in IndexedDB
  const statuses = s.statuses.map((x) => (x.kind === "video" ? { ...x, mediaUrl: undefined } : x));
  try { localStorage.setItem(KEY, JSON.stringify({ ...s, statuses })); } catch { /* storage full: keep working in memory */ }
}

// Sample statuses for the sample people, so a fresh demo is not empty. They are created relative to "now" so they never expire.
const SAMPLE_STATUSES: { person: string; ageHours: number; caption: string; emoji: string }[] = [
  { person: "sample-priya", ageHours: 3, caption: "Idli and filter coffee before work", emoji: "🥞" },
  { person: "sample-priya", ageHours: 1, caption: "Chutney trio, all home made", emoji: "🥣" },
  { person: "sample-arjun", ageHours: 5, caption: "Sunday biryani from @MeenasHomeKitchen", emoji: "🍛" },
  { person: "sample-divya", ageHours: 8, caption: "Fresh bread from the corner bakery", emoji: "🍞" },
  { person: "sample-karan", ageHours: 2, caption: "Post workout bowl", emoji: "🥗" },
  { person: "sample-meena", ageHours: 12, caption: "Banana cake test batch", emoji: "🍰" },
];

type FeedRow = { status_id: string; author_id: string; handle: string; kind: "photo" | "video"; media_url: string; thumb_url: string | null; caption: string; vendor_id: string | null; vendor_name: string | null; duration_s: number | string | null; created_at: string; expires_at: string; like_count: number | string; liked: boolean; source: "following" | "nearby"; dist_km: number | string | null };
type MineRow = { id: string; kind: "photo" | "video"; media_url: string; thumb_url: string | null; caption: string; vendor_id: string | null; duration_s: number | string | null; created_at: string; expires_at: string; view_count: number | string; like_count: number | string };

export function useStatuses(user: PeopleUser & { handle: string }, people: PeopleApi, radiusKm: number, vendors: { id: string; businessName: string }[]) {
  const [mode, setMode] = useState<"loading" | "remote" | "local">("loading");
  const [remoteFeed, setRemoteFeed] = useState<Status[]>([]);
  const [remoteMine, setRemoteMine] = useState<MyStatus[]>([]);
  const [store, setStore] = useState<Store>(EMPTY);
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [clock, setClock] = useState(STATUS_INITIAL_TIME);
  const storeRef = useRef(store);
  useEffect(() => { storeRef.current = store; }, [store]);
  const { email, userId, role } = user;
  const myLocalId = localPersonId(email || "");
  const pin: Pin | null = people.viewerPin;

  useEffect(() => { const t = window.setInterval(() => setClock(Date.now()), 30_000); return () => window.clearInterval(t); }, []);

  const loadRemote = useCallback(async () => {
    const sb = getSupabaseBrowserClient(); if (!sb) return;
    const [feed, mine] = await Promise.all([
      sb.rpc("status_feed", { p_lat: pin?.lat ?? null, p_lng: pin?.lng ?? null, p_radius_km: radiusKm }),
      sb.rpc("my_statuses"),
    ]);
    if (!feed.error) setRemoteFeed(((feed.data || []) as FeedRow[]).map((r) => ({
      id: r.status_id, authorId: r.author_id, handle: r.handle, kind: r.kind, mediaUrl: r.media_url, thumbUrl: r.thumb_url || undefined, caption: r.caption, vendorId: r.vendor_id, vendorName: r.vendor_name || undefined,
      durationS: r.duration_s != null ? Number(r.duration_s) : undefined, createdAt: r.created_at, expiresAt: r.expires_at, likeCount: Number(r.like_count), liked: Boolean(r.liked), source: r.source, distanceKm: r.dist_km != null ? Number(r.dist_km) : undefined,
    })));
    if (!mine.error) setRemoteMine(((mine.data || []) as MineRow[]).map((r) => ({
      id: r.id, authorId: userId || "", handle: user.handle, kind: r.kind, mediaUrl: r.media_url, thumbUrl: r.thumb_url || undefined, caption: r.caption, vendorId: r.vendor_id, durationS: r.duration_s != null ? Number(r.duration_s) : undefined,
      createdAt: r.created_at, expiresAt: r.expires_at, likeCount: Number(r.like_count), liked: false, source: "following" as const, viewCount: Number(r.view_count),
    })));
  }, [pin?.lat, pin?.lng, radiusKm, userId, user.handle]);

  // choose the back-end once per signed-in customer, and tidy up this customer's own expired statuses
  useEffect(() => {
    if (!email || role !== "customer") return;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) setStore(readStore()); });
    (async () => {
      const sb = getSupabaseBrowserClient();
      if (!sb || !isLiveSupabaseMode() || !userId) { if (!cancelled) setMode("local"); return; }
      const probe = await sb.rpc("my_statuses");
      if (probe.error) { if (!cancelled) setMode("local"); return; }   // V9_3_PEOPLE_STATUS.sql not applied yet
      if (!cancelled) setMode("remote");
      const gone = await sb.rpc("claim_expired_statuses");
      const paths = ((gone.data || []) as { m_url: string | null; t_url: string | null }[]).flatMap((r) => [r.m_url, r.t_url]).flatMap((u) => { const m = u?.split("/status-media/")[1]; return m ? [decodeURIComponent(m)] : []; });
      if (paths.length) await sb.storage.from("status-media").remove(paths);
    })().catch(() => { if (!cancelled) setMode("local"); });
    return () => { cancelled = true; };
  }, [email, userId, role]);

  useEffect(() => {
    if (mode !== "remote") return;
    const initial = window.setTimeout(() => void loadRemote(), 0);
    return () => window.clearTimeout(initial);
  }, [mode, loadRemote]);
  useEffect(() => { if (mode !== "remote") return; const t = window.setInterval(() => void loadRemote(), 60_000); return () => window.clearInterval(t); }, [mode, loadRemote]);

  // local back-end: resolve stored videos
  useEffect(() => {
    if (mode !== "local") return;
    let cancelled = false;
    store.statuses.forEach((s) => { const key = s.mediaKey; if (!key || videoUrls[key]) return; void loadLocalVideoUrl(key).then((url) => { if (url && !cancelled) setVideoUrls((c) => (c[key] ? c : { ...c, [key]: url })); }); });
    return () => { cancelled = true; };
  }, [mode, store.statuses, videoUrls]);

  const persist = useCallback((next: Store) => { setStore(next); writeStore(next); }, []);

  // ---------------- what the customer can watch ----------------
  const feedItems = useMemo<Status[]>(() => {
    if (mode === "remote") {
      const seen = new Set(readSeen());
      return remoteFeed.filter((s) => isStatusActive(s, clock) && !seen.has(s.id));
    }
    if (mode !== "local") return [];
    const viewed = new Set(store.views[email.toLowerCase()] || []);
    const liked = new Set(store.likes[email.toLowerCase()] || []);
    const people_ = new Map(people.localPeople.map((p) => [p.id, p]));
    const sampleRows: Status[] = SAMPLE_STATUSES.map((s, i) => {
      const person = people_.get(s.person); if (!person) return null;
      const createdAt = new Date(STATUS_INITIAL_TIME - s.ageHours * 3_600_000).toISOString();
      return { id: `sample-status-${s.person}-${i}`, authorId: s.person, handle: person.handle, kind: "photo" as const, caption: s.caption, thumbUrl: undefined, createdAt, expiresAt: statusExpiry(new Date(createdAt).getTime()), likeCount: 3 + i, liked: false, source: "nearby" as const, distanceKm: person.distanceKm, sample: true, emoji: s.emoji };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
    const real: Status[] = store.statuses.filter((s) => s.authorId !== myLocalId).map((s) => ({ ...s, mediaUrl: s.kind === "video" ? (s.mediaKey ? videoUrls[s.mediaKey] : undefined) : s.mediaUrl, likeCount: Object.values(store.likes).filter((ids) => ids.includes(s.id)).length, liked: false, source: "nearby" as const }));
    return [...sampleRows, ...real].flatMap((s) => {
      const person = people_.get(s.authorId);
      const following = people.followingIds.has(s.authorId);
      const visible = statusVisibleTo({ authorId: s.authorId, viewerId: myLocalId, expiresAt: s.expiresAt, viewerFollowsAuthor: following, authorDiscoverable: Boolean(person?.discoverable), authorPrivateAccount: Boolean(person?.privateAccount), authorPin: person?.pin ?? null, viewerPin: pin, radiusKm, alreadyViewed: viewed.has(s.id) }, clock);
      if (!visible) return [];
      return [{ ...s, handle: person?.handle || s.handle, source: following ? "following" as const : "nearby" as const, distanceKm: person?.distanceKm, liked: liked.has(s.id), viewed: viewed.has(s.id), vendorName: s.vendorId ? vendors.find((v) => v.id === s.vendorId)?.businessName : undefined }];
    });
  }, [mode, remoteFeed, store, videoUrls, clock, people.localPeople, people.followingIds, pin, radiusKm, myLocalId, email, vendors]);

  const groups = useMemo(() => groupStatuses(feedItems.map((s) => ({ ...s, authorId: s.authorId }))), [feedItems]);

  const mine = useMemo<MyStatus[]>(() => {
    const tagged = (s: MyStatus): MyStatus => (s.vendorId ? { ...s, vendorName: vendors.find((v) => v.id === s.vendorId)?.businessName } : s);
    if (mode === "remote") return remoteMine.filter((s) => isStatusActive(s, clock)).map(tagged);
    if (mode !== "local") return [];
    return store.statuses.filter((s) => s.authorId === myLocalId && isStatusActive(s, clock)).map((s) => ({
      ...s, mediaUrl: s.kind === "video" ? (s.mediaKey ? videoUrls[s.mediaKey] : undefined) : s.mediaUrl, liked: false, source: "following" as const,
      likeCount: Object.values(store.likes).filter((ids) => ids.includes(s.id)).length, viewCount: Object.values(store.views).filter((ids) => ids.includes(s.id)).length,
    })).map(tagged).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [mode, remoteMine, store, videoUrls, clock, myLocalId, vendors]);

  // ---------------- actions ----------------
  const post = useCallback(async (input: PostStatusInput): Promise<void> => {
    if (mine.length >= MAX_ACTIVE_STATUSES) throw new Error(`You have ${MAX_ACTIVE_STATUSES} active statuses. They disappear after 24 hours`);
    if (input.kind === "video") {
      const fileCheck = checkVideoFile(input.file); if (!fileCheck.ok) throw new Error(fileCheck.message);
      const lengthProblem = checkStatusVideoSeconds(input.durationS ?? 0); if (lengthProblem) throw new Error(lengthProblem);
    }
    const caption = input.caption.trim().slice(0, 200);
    if (mode === "remote") {
      const sb = getSupabaseBrowserClient(); if (!sb || !userId) throw new Error("Sign in again to post");
      const base = `${userId}/${Date.now().toString(36)}`;
      let mediaPath = "", thumbPath = "";
      if (input.kind === "photo") {
        const dataUrl = await compressImage(input.file, 1080, 0.82); const blob = await (await fetch(dataUrl)).blob();
        mediaPath = `${base}.jpg`; const up = await sb.storage.from("status-media").upload(mediaPath, blob, { contentType: "image/jpeg" }); if (up.error) throw new Error(up.error.message);
      } else {
        const ext = input.file.type === "video/webm" ? "webm" : input.file.type === "video/quicktime" ? "mov" : "mp4";
        mediaPath = `${base}.${ext}`; const up = await sb.storage.from("status-media").upload(mediaPath, input.file, { contentType: input.file.type }); if (up.error) throw new Error(up.error.message);
        if (input.thumbDataUrl) { thumbPath = `${base}-t.jpg`; await sb.storage.from("status-media").upload(thumbPath, await (await fetch(input.thumbDataUrl)).blob(), { contentType: "image/jpeg" }); }
      }
      const url = (path: string) => sb.storage.from("status-media").getPublicUrl(path).data.publicUrl;
      const res = await sb.rpc("post_status", { p_kind: input.kind, p_media_url: url(mediaPath), p_thumb_url: thumbPath ? url(thumbPath) : null, p_caption: caption, p_vendor_id: input.vendorId || null, p_duration_s: input.kind === "video" ? input.durationS : null }).single();
      if (res.error) { await sb.storage.from("status-media").remove([mediaPath, thumbPath].filter(Boolean)); throw new Error(res.error.message); }
      await loadRemote();
      return;
    }
    const id = `local-status-${Date.now().toString(36)}`; const createdAt = new Date().toISOString();
    let status: LocalStatus;
    if (input.kind === "photo") status = { id, authorId: myLocalId, handle: user.handle, kind: "photo", mediaUrl: await compressImage(input.file, 720, 0.7), caption, vendorId: input.vendorId || null, createdAt, expiresAt: statusExpiry(Date.now()) };
    else {
      await saveLocalVideo(id, input.file); setVideoUrls((c) => ({ ...c, [id]: URL.createObjectURL(input.file) }));
      status = { id, authorId: myLocalId, handle: user.handle, kind: "video", mediaKey: id, thumbUrl: input.thumbDataUrl, caption, vendorId: input.vendorId || null, durationS: input.durationS, createdAt, expiresAt: statusExpiry(Date.now()) };
    }
    persist({ ...storeRef.current, statuses: [...storeRef.current.statuses, status] });
  }, [mode, mine.length, userId, myLocalId, user.handle, persist, loadRemote]);

  /** Counts as seen: from now on it is gone from this person's rail (view-once). */
  const markViewed = useCallback((id: string) => {
    if (mode === "remote") {
      rememberSeen(id);
      setRemoteFeed((list) => list.filter((s) => s.id !== id));
      void getSupabaseBrowserClient()?.rpc("mark_status_viewed", { p_status: id }).then((res) => { if (res?.error) console.warn("Could not record the view", res.error.message); });
      return;
    }
    const key = email.toLowerCase(); const current = storeRef.current;
    if ((current.views[key] || []).includes(id)) return;
    persist({ ...current, views: { ...current.views, [key]: [...(current.views[key] || []), id] } });
  }, [mode, email, persist]);

  const toggleLike = useCallback(async (id: string, on: boolean) => {
    if (mode === "remote") {
      const res = await getSupabaseBrowserClient()?.rpc("like_status", { p_status: id, p_on: on });
      if (res?.error) throw new Error(res.error.message);
      setRemoteFeed((list) => list.map((s) => (s.id === id ? { ...s, liked: on, likeCount: Math.max(0, s.likeCount + (on ? 1 : -1)) } : s)));
      return;
    }
    const key = email.toLowerCase(); const current = storeRef.current; const mineLikes = current.likes[key] || [];
    persist({ ...current, likes: { ...current.likes, [key]: on ? [...new Set([...mineLikes, id])] : mineLikes.filter((x) => x !== id) } });
  }, [mode, email, persist]);

  const remove = useCallback(async (id: string) => {
    if (mode === "remote") {
      const sb = getSupabaseBrowserClient(); const target = remoteMine.find((s) => s.id === id);
      const res = await sb?.from("customer_statuses").delete().eq("id", id); if (res?.error) throw new Error(res.error.message);
      const paths = [target?.mediaUrl, target?.thumbUrl].flatMap((u) => { const m = u?.split("/status-media/")[1]; return m ? [decodeURIComponent(m)] : []; });
      if (paths.length) await sb?.storage.from("status-media").remove(paths);
      setRemoteMine((list) => list.filter((s) => s.id !== id));
      return;
    }
    const target = storeRef.current.statuses.find((s) => s.id === id); if (target?.mediaKey && target.kind === "video") void deleteLocalVideo(target.mediaKey);
    persist({ ...storeRef.current, statuses: storeRef.current.statuses.filter((s) => s.id !== id) });
  }, [mode, remoteMine, persist]);

  const viewers = useCallback(async (id: string): Promise<StatusViewer[]> => {
    if (mode === "remote") {
      const res = await getSupabaseBrowserClient()?.rpc("status_viewers", { p_status: id });
      return ((res?.data || []) as { handle: string; viewed_at: string; liked: boolean }[]).map((r) => ({ handle: r.handle, viewedAt: r.viewed_at, liked: r.liked }));
    }
    const out: StatusViewer[] = [];
    for (const [who, ids] of Object.entries(storeRef.current.views)) if (ids.includes(id)) out.push({ handle: who.split("@")[0], viewedAt: new Date().toISOString(), liked: (storeRef.current.likes[who] || []).includes(id) });
    return out;
  }, [mode]);

  // A customer reports somebody else's status. Remote: stored for Operations (V9_13_STORIES_MONITOR.sql). Local demo: nothing to send.
  const report = useCallback(async (id: string, reason: string) => {
    if (mode !== "remote") return;
    const res = await getSupabaseBrowserClient()?.rpc("report_status", { p_status: id, p_reason: reason });
    if (res?.error) throw new Error(/function .* does not exist|schema cache/i.test(res.error.message) ? "Reporting is not switched on yet" : res.error.message);
  }, [mode]);

  return { mode, groups, mine, post, markViewed, toggleLike, remove, viewers, report, refresh: loadRemote, ttlHours: STATUS_TTL_MS / 3_600_000 };
}

export type StatusesApi = ReturnType<typeof useStatuses>;
