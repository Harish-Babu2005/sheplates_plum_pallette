"use client";
// Customer statuses: the rail at the top of Stories, the full-screen viewer, and the composer.
// A status is a photo or a video of up to 30 seconds. It disappears after 24 hours, and each person can
// watch it once. Nothing here is a permanent gallery.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Eye, Heart, MapPin, Plus, Trash2, Volume2, VolumeX, X } from "@/components/icons";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inspectVideo, type VideoInspection } from "@/lib/food-shorts-media";
import { formatDuration } from "@/lib/food-shorts-rules";
import { formatPeopleDistance, statusTimeLeft } from "@/lib/people-rules";
import type { MyStatus, Status, StatusViewer } from "@/lib/statuses";
import { Avatar } from "./kit";

type Group = { authorId: string; source: "following" | "nearby"; items: Status[] };

const ringStyle = () => "bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 p-[3px]";

export function StatusRail({ mine, groups, onAdd, onOpenMine, onOpenGroup, name, hasPin }: {
  mine: MyStatus[]; groups: Group[]; onAdd: () => void; onOpenMine: () => void; onOpenGroup: (index: number) => void; name: string; hasPin: boolean;
}) {
  const newest = mine[mine.length - 1];
  return <section aria-label="Statuses" data-testid="status-rail" className="space-y-2">
    <div className="flex gap-4 overflow-x-auto pb-1 hide-scrollbar">
      <div className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
        <button type="button" onClick={mine.length ? onOpenMine : onAdd} aria-label={mine.length ? "Your status" : "Add your status"} data-testid="my-status" className="relative">
          <Avatar name={name} size={62} ring={mine.length > 0} />
          <span role="button" tabIndex={-1} aria-label="Add a status" onClick={(e) => { e.stopPropagation(); onAdd(); }} className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full border-2 border-white bg-[#753b50] text-white"><Plus className="size-3.5" /></span>
        </button>
        <span className="w-full truncate text-center text-[11px] font-bold">{mine.length ? `Your status` : "Add status"}</span>
        {newest && <span className="-mt-1 text-[9px] font-bold text-stone-400">{statusTimeLeft(newest.expiresAt)}</span>}
      </div>
      {groups.map((g, i) => <button key={g.authorId} type="button" onClick={() => onOpenGroup(i)} aria-label={`${g.items[0].handle}'s status, ${g.items.length} to watch`} data-testid="status-ring" data-source={g.source} className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
        <span className="relative inline-block">
          <span
            className={`block rounded-full ${
              g.items.every((item) => item.viewed)
                ? "bg-stone-300 p-[3px]"
                : ringStyle()
            }`}
          >
            <Avatar name={g.items[0].handle} size={62} />
          </span>
          {g.items.length > 1 && (
            <span className="absolute right-0 top-0 z-10 grid size-5 translate-x-1/4 -translate-y-1/4 place-items-center rounded-full bg-[#753b50] text-[10px] font-black text-white shadow-sm">
              {g.items.length}
            </span>
          )}
        </span>
        <span className="w-full truncate text-center text-[11px] font-bold">{g.items[0].handle}</span>
        {g.source === "nearby" && <span className="-mt-1 inline-flex items-center gap-0.5 text-[9px] font-bold text-stone-400"><MapPin className="size-2.5" />{g.items[0].distanceKm != null ? formatPeopleDistance(g.items[0].distanceKm) : "nearby"}</span>}
      </button>)}
    </div>
    {!groups.length && <p className="text-xs font-bold text-stone-400" data-testid="status-empty">{hasPin ? "No new statuses. Follow people, or switch on the map in your profile, to see what they eat." : "Set your location to see statuses from people nearby."}</p>}
  </section>;
}

/** Full-screen viewer for one person's statuses, or your own. Watching counts as seen: each status can be
 * watched once. */
export function StatusViewer({ items, own, onClose, onViewed, onLike, onDelete, loadViewers, onOpenVendor, onReport }: {
  onReport?: (id: string, reason: string) => Promise<void>;
  items: (Status | MyStatus)[]; own: boolean; onClose: () => void; onViewed: (id: string) => void; onLike: (id: string, on: boolean) => Promise<void>; onDelete?: (id: string) => Promise<void>;
  loadViewers?: (id: string) => Promise<StatusViewer[]>; onOpenVendor?: (vendorId: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [seenBy, setSeenBy] = useState<StatusViewer[] | null>(null);
  const [likedHere, setLikedHere] = useState<Record<string, boolean>>({});
  const [failedPhotoId, setFailedPhotoId] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const count = items.length;
  const current = items[index];
  const currentId = current?.id;
  const moveTo = useCallback((next: number) => {
    setProgress(0);
    setSeenBy(null);
    setIndex(next);
  }, []);
  const advance = useCallback(() => { if (index + 1 < count) moveTo(index + 1); else onClose(); }, [count, index, moveTo, onClose]);

  useEffect(() => {
    const root = document.documentElement, prev = document.body.style.overflow, prevRoot = root.style.overflow, prevGutter = root.style.scrollbarGutter;
    document.body.style.overflow = "hidden"; root.style.overflow = "hidden"; root.style.scrollbarGutter = "auto";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") advance(); if (e.key === "ArrowLeft") moveTo(Math.max(0, index - 1)); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; root.style.overflow = prevRoot; root.style.scrollbarGutter = prevGutter; window.removeEventListener("keydown", onKey); };
  }, [advance, index, moveTo, onClose]);

  // showing a status counts as watching it (not for your own)
  useEffect(() => { if (currentId && !own) onViewed(currentId); }, [currentId, onViewed, own]);

  // photos advance after six seconds; videos advance when they finish
  useEffect(() => {
    if (!current || current.kind === "video") return;
    const started = Date.now(); const tick = window.setInterval(() => { const p = (Date.now() - started) / 6000; setProgress(Math.min(1, p)); if (p >= 1) { window.clearInterval(tick); advance(); } }, 100);
    return () => window.clearInterval(tick);
  }, [current?.id, current?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;
  const liked = likedHere[current.id] ?? (current as Status).liked;
  const likeCount = (current as Status).likeCount + (likedHere[current.id] !== undefined && likedHere[current.id] !== (current as Status).liked ? (likedHere[current.id] ? 1 : -1) : 0);
  async function toggleLike() {
    const next = !liked; setLikedHere((m) => ({ ...m, [current.id]: next }));
    try { await onLike(current.id, next); } catch (e) { setLikedHere((m) => ({ ...m, [current.id]: !next })); toast.error(e instanceof Error ? e.message : "Could not save your like"); }
  }
  return createPortal(<div role="dialog" aria-modal="true" aria-label={own ? "Your status" : `${current.handle}'s status`} data-testid="status-viewer" ref={(el) => el?.style.setProperty("max-width", "none", "important")} className="fixed inset-0 z-[260] grid place-items-center bg-[#faf6f4] p-0 sm:p-5">
    <button type="button" aria-label="Go back one" disabled={index === 0} onClick={() => moveTo(Math.max(0, index - 1))} className="absolute left-1/2 top-1/2 z-10 hidden size-12 -translate-x-[330px] -translate-y-1/2 place-items-center rounded-full bg-[#753b50] text-white disabled:opacity-40 sm:grid"><ArrowLeft className="size-6" /></button>
    <button type="button" aria-label="Go forward one" onClick={advance} className="absolute left-1/2 top-1/2 z-10 hidden size-12 translate-x-[282px] -translate-y-1/2 place-items-center rounded-full bg-[#753b50] text-white sm:grid"><ArrowRight className="size-6" /></button>
    <div className="relative h-full w-full max-w-[460px] overflow-hidden bg-[#292124] sm:max-h-[860px] sm:rounded-[32px]">
      {current.kind === "video" && current.mediaUrl
        ? <video key={current.id} ref={video} src={current.mediaUrl} poster={current.thumbUrl} autoPlay muted={muted} playsInline onEnded={advance} onTimeUpdate={(e) => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)} className="h-full w-full object-cover" />
        : current.mediaUrl && failedPhotoId !== current.id ? <img key={current.id} src={current.mediaUrl} alt="Customer status photo" onError={() => setFailedPhotoId(current.id)} className="absolute inset-0 h-full w-full bg-black object-contain" />
        : current.mediaUrl ? <div role="alert" className="grid h-full w-full place-items-center bg-stone-950 px-8 text-center text-sm font-bold text-white">This status photo could not be loaded.</div>
        : <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#292124] via-[#292124] to-[#292124]"><span className="text-[120px]" aria-hidden>{current.emoji || "🍽️"}</span>{current.sample && <span className="absolute left-1/2 top-28 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-black text-stone-800">Sample status</span>}</div>}
      <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/65 to-transparent p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex gap-1" aria-hidden>{items.map((s, i) => <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35"><span className="block h-full bg-white" style={{ width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%" }} /></span>)}</div>
        <div className="mt-3 flex items-center gap-2 text-white"><Avatar name={own ? "You" : current.handle} size={34} /><div className="min-w-0"><div className="truncate text-sm font-black">{own ? "Your status" : `@${current.handle}`}</div><div className="text-[11px] text-white/75">{statusTimeLeft(current.expiresAt)} · {current.kind === "video" && current.durationS ? formatDuration(current.durationS) : "photo"}</div></div>
          {current.kind === "video" && current.mediaUrl && <button type="button" aria-label={muted ? "Turn sound on" : "Turn sound off"} onClick={() => setMuted((m) => !m)} className="ml-auto grid size-9 place-items-center rounded-full bg-black/40">{muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}</button>}
          <button type="button" aria-label="Close status" onClick={onClose} className={`${current.kind === "video" && current.mediaUrl ? "" : "ml-auto"} grid size-9 place-items-center rounded-full bg-black/40`}><X className="size-5" /></button></div>
      </div>
      <button type="button" aria-label="Previous status" className="absolute bottom-24 left-0 top-24 w-1/3" onClick={() => moveTo(Math.max(0, index - 1))} />
      <button type="button" aria-label="Next status" className="absolute bottom-24 right-0 top-24 w-1/3" onClick={advance} />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white">
        {current.caption && <p className="mb-3 text-sm font-bold leading-6" data-testid="status-caption">{current.caption}</p>}
        {current.vendorName && current.vendorId && <button type="button" onClick={() => { onClose(); onOpenVendor?.(current.vendorId!); }} className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-black backdrop-blur">🍴 {current.vendorName}</button>}
        {own ? <div className="flex items-center gap-3 text-sm font-black">
            <button type="button" onClick={async () => setSeenBy(await (loadViewers?.(current.id) ?? Promise.resolve([])))} className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 backdrop-blur" data-testid="status-views"><Eye className="size-4" />{(current as MyStatus).viewCount} view{(current as MyStatus).viewCount === 1 ? "" : "s"}</button>
            <span className="inline-flex items-center gap-1.5" data-testid="status-own-likes"><Heart className="size-4" />{(current as MyStatus).likeCount}</span>
            {onDelete && <button type="button" aria-label="Delete this status" onClick={async () => { try { await onDelete(current.id); toast.success("Status deleted"); if (count <= 1) onClose(); else setIndex((i) => Math.max(0, i - 1)); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete"); } }} className="ml-auto grid size-10 place-items-center rounded-full bg-white/20 backdrop-blur"><Trash2 className="size-4" /></button>}
          </div>
          : <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-[11px] font-bold text-white/70">Seen once, then gone for you{onReport && <button type="button" aria-label="Report this status" onClick={async () => { const reason = window.prompt("Why are you reporting this status? (optional)") ; if (reason === null) return; try { await onReport(current.id, reason); toast.success("Thanks. Our team will review it."); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not send the report"); } }} className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-black backdrop-blur">Report</button>}</span>
              <button type="button" aria-label={liked ? "Unlike" : "Like"} onClick={() => void toggleLike()} className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-2 text-sm font-black backdrop-blur"><Heart className={`size-5 ${liked ? "fill-[#753b50] text-[#753b50]" : ""}`} /><span data-testid="status-likes">{likeCount}</span></button></div>}
        {seenBy && <div className="mt-3 max-h-40 overflow-y-auto rounded-2xl bg-black/55 p-3 text-xs backdrop-blur" data-testid="status-seen-by">{seenBy.length ? seenBy.map((v) => <div key={v.handle} className="flex justify-between py-1"><span className="font-black">@{v.handle}</span><span className="text-white/70">{v.liked ? "♥ " : ""}seen</span></div>) : <span className="text-white/70">Nobody has watched this yet.</span>}</div>}
      </div>
    </div>
  </div>, document.body);
}

/** Post a status: a photo or a video of up to 30 seconds. */
export function StatusComposer({ open, onClose, onPost, vendors }: {
  open: boolean; onClose: () => void; onPost: (input: { kind: "photo" | "video"; file: File; thumbDataUrl?: string; durationS?: number; caption: string; vendorId?: string | null }) => Promise<void>; vendors: { id: string; name: string }[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<VideoInspection | null>(null);
  const [preview, setPreview] = useState("");
  const [caption, setCaption] = useState(""); const [vendorId, setVendorId] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [checking, setChecking] = useState(false);
  const isVideo = Boolean(file?.type.startsWith("video/"));
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function choose(next: File | undefined) {
    if (!next) return;
    setError(""); setInfo(null); setFile(null); setChecking(true);
    try {
      if (next.type.startsWith("video/")) { const inspected = await inspectVideo(next); setInfo(inspected); }
      else if (!next.type.startsWith("image/")) throw new Error("Choose a photo or a video");
      setFile(next); setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(next); });
    } catch (e) { setError(e instanceof Error ? e.message : "That file could not be used"); } finally { setChecking(false); }
  }
  async function submit() {
    if (!file) return;
    setBusy(true); setError("");
    try { await onPost({ kind: isVideo ? "video" : "photo", file, thumbDataUrl: info?.thumbDataUrl, durationS: info?.durationS, caption, vendorId: vendorId || null }); toast.success("Status posted. It disappears in 24 hours"); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "The status could not be posted"); } finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={(v) => !v && onClose()}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-[28px] sm:max-w-md">
    <DialogHeader><DialogTitle className="text-lg font-black">Add to your status</DialogTitle><DialogDescription>A photo, or a video of up to 30 seconds. It disappears after 24 hours and each person can watch it once.</DialogDescription></DialogHeader>
    {!file ? <div className="grid grid-cols-2 gap-3">
      <input id="status-photo" type="file" accept="image/*" className="sr-only" aria-label="Choose a photo" onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
      <input id="status-video" type="file" accept="video/mp4,video/quicktime,video/webm,video/*" className="sr-only" aria-label="Choose a video" onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
      <label htmlFor="status-photo" className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-stone-300 p-5 text-sm font-black transition hover:border-[#753b50]"><span className="text-3xl" aria-hidden>📷</span>Photo</label>
      <label htmlFor="status-video" className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-stone-300 p-5 text-sm font-black transition hover:border-[#753b50]"><span className="text-3xl" aria-hidden>🎬</span>Video, up to 30 s</label>
      {checking && <p className="col-span-2 text-sm font-bold text-stone-500" role="status">Checking your file…</p>}
    </div>
    : <div className="overflow-hidden rounded-2xl bg-black">{isVideo ? <video src={preview} controls playsInline muted className="max-h-72 w-full object-contain" aria-label="Preview of your video" /> : <img src={preview} alt="Preview of your photo" className="max-h-72 w-full object-contain" />}</div>}
    {file && <>
      <label className="block text-xs font-black uppercase tracking-[.1em] text-stone-500">Caption (optional)<textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} rows={2} aria-label="Status caption" placeholder="What are you eating?" className="mt-1.5 w-full rounded-xl border border-stone-200 p-3 text-sm font-medium normal-case tracking-normal text-stone-800 outline-none focus:border-[#753b50]" /></label>
      <label className="block text-xs font-black uppercase tracking-[.1em] text-stone-500">Tag a vendor (optional)<select value={vendorId} onChange={(e) => setVendorId(e.target.value)} aria-label="Tag a vendor" className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-stone-800"><option value="">No vendor</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
      {isVideo && info && <p className="text-xs font-bold text-stone-500">Length {formatDuration(info.durationS)} of 0:30</p>}
    </>}
    {error && <p role="alert" className="text-sm font-bold text-red-600">{error}</p>}
    <div className="flex gap-2">{file && <button type="button" onClick={() => { setFile(null); setInfo(null); setError(""); }} disabled={busy} className="h-12 rounded-full border border-stone-300 px-5 text-sm font-black">Choose another</button>}
      <button type="button" disabled={!file || busy} onClick={() => void submit()} className="h-12 flex-1 rounded-full bg-[#753b50] text-base font-black text-white shadow-[0_12px_28px_rgba(224,25,79,.3)] transition hover:bg-[#753b50] disabled:opacity-40">{busy ? "Posting…" : "Post status"}</button></div>
  </DialogContent></Dialog>;
}
