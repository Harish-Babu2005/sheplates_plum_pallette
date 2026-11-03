// Social layer for the customer portal: Food Stories (photo + food-trial posts),
// likes / saves / comments, vendor follows and the public social profile.
//
// Two interchangeable back-ends behind one hook:
//   remote — Supabase tables from supabase/V8_3_SOCIAL.sql (shared by every user).
//   local  — browser storage, used automatically while that migration hasn't been
//            applied (or Supabase isn't configured), so the UI is fully usable and
//            demonstrable. Local mode also shows clearly-flagged sample posts so a
//            fresh install doesn't look empty; sample posts never reach the database.
// Posting limits are enforced by the database function create_post() in remote
// mode; local mode mirrors the same numbers so behaviour matches.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient, isLiveSupabaseMode } from "@/lib/supabase";

const SOCIAL_INITIAL_TIME = Date.now();

export type PostKind = "photo" | "trial";
export type SocialPost = {
  id: string; authorId: string; authorName: string; authorHandle: string; kind: PostKind;
  caption: string; imageUrl?: string; vendorId?: string | null; productId?: string | null;
  createdAt: string; likeCount: number; commentCount: number; sample?: boolean;
};
export type SocialComment = { id: string; postId: string; authorName: string; body: string; createdAt: string };
export type SocialProfile = { handle: string; bio: string };
export const WEEKLY_LIMITS: Record<PostKind, number> = { photo: 10, trial: 5 };

export type SocialUser = { email: string; name: string; userId?: string };
type SeedVendor = { id: string; businessName: string; category: string };
type SeedProduct = { id: string; vendorId: string; name: string; category: string; imageUrl?: string };

const POSTS_KEY = "sheplates-social-posts-v1";
const userKey = (email: string) => `sheplates-social-user-v1:${email.toLowerCase()}`;
const DAY = 86_400_000;

type LocalPosts = { posts: SocialPost[]; comments: Record<string, SocialComment[]>; likeBonus: Record<string, number> };
type LocalUser = { liked: string[]; saved: string[]; followed: string[]; reported: string[]; profile: SocialProfile };
export type VendorFollower = { id: string; handle: string; bio: string };
const LOCAL_VENDOR_FOLLOWERS_KEY = "sheplates-social-vendor-followers-v1";

function readLocalVendorFollowers(): Record<string, VendorFollower[]> {
  try { return JSON.parse(localStorage.getItem(LOCAL_VENDOR_FOLLOWERS_KEY) || "{}"); } catch { return {}; }
}
function writeLocalVendorFollowers(value: Record<string, VendorFollower[]>) {
  try { localStorage.setItem(LOCAL_VENDOR_FOLLOWERS_KEY, JSON.stringify(value)); } catch { /* storage full: keep the in-memory follow state */ }
}

export async function loadVendorFollowers(vendorId: string): Promise<VendorFollower[]> {
  const supabase = getSupabaseBrowserClient();
  if (supabase && isLiveSupabaseMode()) {
    const result = await supabase.rpc("list_vendor_followers", { p_vendor: vendorId });
    if (result.error) throw new Error(result.error.message);
    return ((result.data || []) as Array<{ user_id: string; handle: string; bio: string }>).map((row) => ({
      id: row.user_id, handle: row.handle, bio: row.bio || "",
    }));
  }
  return readLocalVendorFollowers()[vendorId] || [];
}

function readJson<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? { ...fallback, ...JSON.parse(raw) } : fallback; } catch { return fallback; }
}
function writeJson(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full / blocked — keep working in memory */ } }

export function defaultHandle(name: string, email: string) {
  const base = (name || email.split("@")[0]).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16);
  return base.length >= 3 ? base : `foodie${Math.abs(hash(email)) % 1000}`;
}
function hash(text: string) { let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0; return h; }

/** Deterministic sample feed built from whatever vendors/products are on screen. */
function sampleFeed(vendors: SeedVendor[], products: SeedProduct[]): SocialPost[] {
  if (!vendors.length) return [];
  const authors = [
    { name: "Priya S", handle: "priya_eats" }, { name: "Arjun K", handle: "arjun.k" }, { name: "Divya R", handle: "divya_r" },
    { name: "Raj", handle: "rajfoodie" }, { name: "Meena T", handle: "meena.t" }, { name: "Karan M", handle: "karan_m" },
  ];
  const lines = [
    (p: string, v: string) => `Tried the ${p} from @${v} — worth every bite!`,
    (_p: string, v: string) => `Breakfast at @${v} this morning. Fresh and still warm.`,
    (p: string) => `Sunday lunch sorted: ${p}. Packed with care.`,
    (p: string, v: string) => `${p} from @${v} again. Our household's regular now.`,
  ];
  return vendors.slice(0, 8).map((vendor, index) => {
    const product = products.find((p) => p.vendorId === vendor.id);
    const author = authors[index % authors.length];
    const seed = Math.abs(hash(vendor.id));
    const kind: PostKind = index % 2 === 0 ? "trial" : "photo";
    return {
      id: `sample-${vendor.id}`, authorId: `sample-${author.handle}`, authorName: author.name, authorHandle: author.handle, kind,
      caption: lines[index % lines.length](product?.name || "the daily special", vendor.businessName.replace(/\s+/g, "")),
      imageUrl: product?.imageUrl, vendorId: vendor.id, productId: product?.id ?? null,
      createdAt: new Date(Date.now() - (index * 3 + 1) * 3_600_000).toISOString(),
      likeCount: 24 + (seed % 140), commentCount: seed % 9, sample: true,
    };
  });
}

export async function compressImage(file: File, maxDim = 1080, quality = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error("The photo could not be read")); r.readAsDataURL(file); });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error("That file is not a usable image")); i.src = dataUrl; });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this photo.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

type RemotePostRow = {
  id: string; author_id: string; author_name: string; author_handle: string; kind: PostKind; caption: string;
  image_url: string | null; vendor_id: string | null; product_id: string | null; created_at: string;
  post_likes?: { count: number }[]; post_comments?: { count: number }[];
};
const POST_COLUMNS = "id,author_id,author_name,author_handle,kind,caption,image_url,vendor_id,product_id,created_at,post_likes(count),post_comments(count)";
const mapRemote = (row: RemotePostRow): SocialPost => ({
  id: row.id, authorId: row.author_id, authorName: row.author_name, authorHandle: row.author_handle, kind: row.kind, caption: row.caption,
  imageUrl: row.image_url || undefined, vendorId: row.vendor_id, productId: row.product_id, createdAt: row.created_at,
  likeCount: row.post_likes?.[0]?.count ?? 0, commentCount: row.post_comments?.[0]?.count ?? 0,
});

export type CreatePostInput = { kind: PostKind; caption: string; imageDataUrl?: string; vendorId?: string | null; productId?: string | null };

export function useSocial(user: SocialUser, vendors: SeedVendor[], products: SeedProduct[]) {
  const [now, setNow] = useState(SOCIAL_INITIAL_TIME);
  const [mode, setMode] = useState<"loading" | "remote" | "local">("loading");
  const [remotePosts, setRemotePosts] = useState<SocialPost[]>([]);
  const [localPosts, setLocalPosts] = useState<LocalPosts>({ posts: [], comments: {}, likeBonus: {} });
  const [me, setMe] = useState<LocalUser>({ liked: [], saved: [], followed: [], reported: [], profile: { handle: defaultHandle(user.name, user.email), bio: "" } });
  const meRef = useRef(me);
  useEffect(() => { meRef.current = me; }, [me]);
  const userId = user.userId;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user.email) return; // signed out — nothing to load
    let cancelled = false;
    const stored = readJson<LocalUser>(userKey(user.email), { liked: [], saved: [], followed: [], reported: [], profile: { handle: defaultHandle(user.name, user.email), bio: "" } });
    if (!isLiveSupabaseMode()) {
      const registry = readLocalVendorFollowers();
      const follower = { id: `local-${user.email.toLowerCase()}`, handle: stored.profile.handle || defaultHandle(user.name, user.email), bio: stored.profile.bio };
      for (const vendorId of stored.followed) {
        registry[vendorId] = [...(registry[vendorId] || []).filter((item) => item.id !== follower.id), follower];
      }
      writeLocalVendorFollowers(registry);
    }
    queueMicrotask(() => {
      if (cancelled) return;
      setMe(stored);
      setLocalPosts(readJson<LocalPosts>(POSTS_KEY, { posts: [], comments: {}, likeBonus: {} }));
    });
    (async () => {
      const sb = getSupabaseBrowserClient();
      if (!sb || !isLiveSupabaseMode() || !userId) { if (!cancelled) setMode("local"); return; }
      const probe = await sb.from("posts").select("id").limit(1);
      if (probe.error) { if (!cancelled) setMode("local"); return; } // V8_3_SOCIAL.sql not applied yet
      const [profile, posts, likes, saves, follows] = await Promise.all([
        sb.rpc("ensure_social_profile", { p_handle: null }).single(),
        sb.from("posts").select(POST_COLUMNS).order("created_at", { ascending: false }).limit(80),
        sb.from("post_likes").select("post_id").eq("user_id", userId),
        sb.from("post_saves").select("post_id").eq("user_id", userId),
        sb.from("vendor_follows").select("vendor_id").eq("follower_id", userId),
      ]);
      if (cancelled) return;
      const profileRow = profile.data as { handle: string; bio: string } | null;
      setMe({
        liked: (likes.data || []).map((r) => r.post_id as string), saved: (saves.data || []).map((r) => r.post_id as string),
        followed: (follows.data || []).map((r) => r.vendor_id as string), reported: [],
        profile: profileRow ? { handle: profileRow.handle, bio: profileRow.bio } : stored.profile,
      });
      setRemotePosts(((posts.data || []) as unknown as RemotePostRow[]).map(mapRemote));
      setMode("remote");
    })().catch(() => { if (!cancelled) setMode("local"); });
    return () => { cancelled = true; };
  }, [user.email, user.name, userId]);

  const samples = useMemo(() => (mode === "local" ? sampleFeed(vendors, products) : []), [mode, vendors, products]);
  const posts = useMemo(() => {
    const base = mode === "remote" ? remotePosts : [...localPosts.posts.map((p) => ({ ...p, likeCount: p.likeCount + (localPosts.likeBonus[p.id] || 0) })), ...samples.map((p) => ({ ...p, likeCount: p.likeCount + (localPosts.likeBonus[p.id] || 0) }))];
    return base.filter((p) => !me.reported.includes(p.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [mode, remotePosts, localPosts, samples, me.reported]);

  const myId = mode === "remote" ? userId || "" : `local-${user.email.toLowerCase()}`;
  const usage = useMemo(() => {
    const since = now - 7 * DAY;
    const mine = posts.filter((p) => p.authorId === myId && new Date(p.createdAt).getTime() > since);
    return { photo: mine.filter((p) => p.kind === "photo").length, trial: mine.filter((p) => p.kind === "trial").length };
  }, [posts, myId, now]);

  const persistMe = useCallback((next: LocalUser) => { setMe(next); writeJson(userKey(user.email), next); }, [user.email]);
  const persistPosts = useCallback((next: LocalPosts) => { setLocalPosts(next); writeJson(POSTS_KEY, next); }, []);

  const createPost = useCallback(async (input: CreatePostInput): Promise<SocialPost> => {
    if (usage[input.kind] >= WEEKLY_LIMITS[input.kind]) throw new Error(`Weekly limit reached: ${WEEKLY_LIMITS[input.kind]} ${input.kind === "photo" ? "photos" : "food trials"} per week`);
    if (input.kind === "photo" && !input.imageDataUrl) throw new Error("A food photo needs an image");
    if (input.kind === "trial" && !input.vendorId) throw new Error("Tag the vendor you tried");
    if (mode === "remote") {
      const sb = getSupabaseBrowserClient(); if (!sb || !userId) throw new Error("Sign in again to post");
      let imageUrl = "";
      if (input.imageDataUrl) {
        const blob = await (await fetch(input.imageDataUrl)).blob();
        const path = `${userId}/${Date.now()}.jpg`;
        const upload = await sb.storage.from("post-media").upload(path, blob, { contentType: "image/jpeg" });
        if (upload.error) throw new Error(upload.error.message);
        imageUrl = sb.storage.from("post-media").getPublicUrl(path).data.publicUrl;
      }
      const result = await sb.rpc("create_post", { p_kind: input.kind, p_caption: input.caption, p_image_url: imageUrl, p_vendor_id: input.vendorId || null, p_product_id: input.productId || null }).single();
      if (result.error || !result.data) throw new Error(result.error?.message || "The post could not be published");
      const row = result.data as RemotePostRow;
      const post = mapRemote(row);
      setRemotePosts((current) => [post, ...current]);
      return post;
    }
    const post: SocialPost = { id: `local-${Date.now().toString(36)}`, authorId: myId, authorName: user.name, authorHandle: me.profile.handle, kind: input.kind, caption: input.caption, imageUrl: input.imageDataUrl, vendorId: input.vendorId || null, productId: input.productId || null, createdAt: new Date().toISOString(), likeCount: 0, commentCount: 0 };
    persistPosts({ ...localPosts, posts: [post, ...localPosts.posts] });
    return post;
  }, [usage, mode, userId, myId, user.name, me.profile.handle, localPosts, persistPosts]);

  const toggleSet = useCallback(async (table: "post_likes" | "post_saves", field: "liked" | "saved", postId: string) => {
    const current = meRef.current; const has = current[field].includes(postId);
    const nextIds = has ? current[field].filter((id) => id !== postId) : [...current[field], postId];
    persistMe({ ...current, [field]: nextIds });
    if (field === "liked") {
      const delta = has ? -1 : 1;
      if (mode === "remote") setRemotePosts((list) => list.map((p) => (p.id === postId ? { ...p, likeCount: Math.max(0, p.likeCount + delta) } : p)));
      else persistPosts({ ...localPosts, likeBonus: { ...localPosts.likeBonus, [postId]: (localPosts.likeBonus[postId] || 0) + delta } });
    }
    if (mode === "remote" && userId) {
      const sb = getSupabaseBrowserClient();
      const res = has ? await sb?.from(table).delete().eq("post_id", postId).eq("user_id", userId) : await sb?.from(table).insert({ post_id: postId, user_id: userId });
      if (res?.error) { persistMe(current); throw new Error(res.error.message); }
    }
  }, [mode, userId, localPosts, persistMe, persistPosts]);

  const toggleLike = useCallback((postId: string) => toggleSet("post_likes", "liked", postId), [toggleSet]);
  const toggleSave = useCallback((postId: string) => toggleSet("post_saves", "saved", postId), [toggleSet]);

  const toggleFollow = useCallback(async (vendorId: string) => {
    const current = meRef.current; const has = current.followed.includes(vendorId);
    persistMe({ ...current, followed: has ? current.followed.filter((id) => id !== vendorId) : [...current.followed, vendorId] });
    if (mode === "remote" && userId) {
      const sb = getSupabaseBrowserClient();
      const res = await sb?.rpc("follow_vendor", { p_vendor: vendorId, p_follow: !has });
      if (res?.error) { persistMe(current); throw new Error(res.error.message); }
    } else {
      const followers = readLocalVendorFollowers();
      const id = `local-${user.email.toLowerCase()}`;
      const currentFollowers = followers[vendorId] || [];
      followers[vendorId] = has
        ? currentFollowers.filter((item) => item.id !== id)
        : [...currentFollowers.filter((item) => item.id !== id), { id, handle: meRef.current.profile.handle, bio: meRef.current.profile.bio }];
      writeLocalVendorFollowers(followers);
    }
  }, [mode, userId, user.email, persistMe]);

  const loadComments = useCallback(async (postId: string): Promise<SocialComment[]> => {
    if (mode === "remote") {
      const sb = getSupabaseBrowserClient();
      const res = await sb?.from("post_comments").select("id,post_id,author_name,body,created_at").eq("post_id", postId).order("created_at", { ascending: true });
      return (res?.data || []).map((r) => ({ id: r.id as string, postId: r.post_id as string, authorName: r.author_name as string, body: r.body as string, createdAt: r.created_at as string }));
    }
    return localPosts.comments[postId] || [];
  }, [mode, localPosts]);

  const addComment = useCallback(async (postId: string, body: string): Promise<SocialComment> => {
    const text = body.trim(); if (!text) throw new Error("Write a comment first");
    if (mode === "remote" && userId) {
      const sb = getSupabaseBrowserClient();
      const res = await sb?.from("post_comments").insert({ post_id: postId, author_id: userId, author_name: user.name, body: text }).select("id,post_id,author_name,body,created_at").single();
      if (!res || res.error || !res.data) throw new Error(res?.error?.message || "The comment could not be posted");
      setRemotePosts((list) => list.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p)));
      return { id: res.data.id as string, postId, authorName: user.name, body: text, createdAt: res.data.created_at as string };
    }
    const comment: SocialComment = { id: `c-${Date.now().toString(36)}`, postId, authorName: user.name, body: text, createdAt: new Date().toISOString() };
    persistPosts({ ...localPosts, comments: { ...localPosts.comments, [postId]: [...(localPosts.comments[postId] || []), comment] }, posts: localPosts.posts.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p)) });
    return comment;
  }, [mode, userId, user.name, localPosts, persistPosts]);

  const reportPost = useCallback(async (postId: string, reason: string) => {
    persistMe({ ...meRef.current, reported: [...meRef.current.reported, postId] });
    if (mode === "remote" && userId) { const sb = getSupabaseBrowserClient(); await sb?.from("post_reports").insert({ post_id: postId, reporter_id: userId, reason }); }
  }, [mode, userId, persistMe]);

  const deletePost = useCallback(async (postId: string) => {
    if (mode === "remote") {
      const sb = getSupabaseBrowserClient(); const res = await sb?.from("posts").delete().eq("id", postId);
      if (res?.error) throw new Error(res.error.message);
      setRemotePosts((list) => list.filter((p) => p.id !== postId));
    } else persistPosts({ ...localPosts, posts: localPosts.posts.filter((p) => p.id !== postId) });
  }, [mode, localPosts, persistPosts]);

  const saveProfile = useCallback(async (profile: SocialProfile) => {
    const handle = profile.handle.toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (handle.length < 3 || handle.length > 24) throw new Error("Handle must be 3–24 letters, numbers or underscores");
    if (mode === "remote" && userId) {
      const sb = getSupabaseBrowserClient();
      const res = await sb?.from("social_profiles").update({ handle, bio: profile.bio.slice(0, 160), updated_at: new Date().toISOString() }).eq("user_id", userId);
      if (res?.error) throw new Error(/duplicate|unique/i.test(res.error.message) ? "That handle is taken" : res.error.message);
    }
    persistMe({ ...meRef.current, profile: { handle, bio: profile.bio.slice(0, 160) } });
  }, [mode, userId, persistMe]);

  return {
    mode, posts, usage, limits: WEEKLY_LIMITS, myId, profile: me.profile,
    liked: me.liked, saved: me.saved, followed: me.followed,
    createPost, toggleLike, toggleSave, toggleFollow, loadComments, addComment, reportPost, deletePost, saveProfile,
  };
}

export type SocialApi = ReturnType<typeof useSocial>;

export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.max(1, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60); if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24); return `${days} day${days === 1 ? "" : "s"} ago`;
}
