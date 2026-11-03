"use client";
// Vendor portal: create and manage Food Shorts (video up to 30 seconds). The vendor picks how
// far the short reaches; customers inside that distance see it (enforced by the database).
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Clapperboard, Eye, EyeOff, Heart, MapPin, Trash2, Upload, Video } from "@/components/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ShortsApi } from "@/lib/food-shorts";
import { inspectVideo, type VideoInspection } from "@/lib/food-shorts-media";
import { MAX_SHORT_SECONDS, REACH_OPTIONS_KM, defaultReachKm, formatDuration } from "@/lib/food-shorts-rules";
import { timeAgo } from "@/lib/social";

type ManagerVendor = { id: string; businessName: string; radiusKm: number; latitude?: number; longitude?: number; verification: string; operational: string };

export function VendorShortsManager({ vendor, products, shorts }: { vendor: ManagerVendor; products: { id: string; name: string }[]; shorts: ShortsApi }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<VideoInspection | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [title, setTitle] = useState(""); const [caption, setCaption] = useState(""); const [productId, setProductId] = useState(""); const [shopLink, setShopLink] = useState("");
  const [reachKm, setReachKm] = useState<number>(defaultReachKm(vendor.radiusKm));
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [checking, setChecking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(""); const [playing, setPlaying] = useState("");
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const hasPin = Number.isFinite(vendor.latitude) && Number.isFinite(vendor.longitude);
  const live = vendor.verification === "Verified" && vendor.operational === "Active";

  async function choose(next: File | undefined) {
    if (!next) return;
    setError(""); setInfo(null); setFile(null); setChecking(true);
    try {
      const inspected = await inspectVideo(next);
      setFile(next); setInfo(inspected);
      setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(next); });
    } catch (e) { setError(e instanceof Error ? e.message : "That video could not be used"); }
    finally { setChecking(false); if (fileInput.current) fileInput.current.value = ""; }
  }
  function reset() { setFile(null); setInfo(null); setPreviewUrl(""); setTitle(""); setCaption(""); setProductId(""); setShopLink(""); setError(""); }
  async function publish() {
    if (!file || !info) return;
    setBusy(true); setError("");
    try {
      await shorts.publish({ title, caption, file, thumbDataUrl: info.thumbDataUrl, durationS: info.durationS, reachKm, productId: productId || null, shopLink });
      toast.success(`Food Short published. Customers within ${reachKm} km can watch it`);
      reset();
    } catch (e) { setError(e instanceof Error ? e.message : "The short could not be published"); }
    finally { setBusy(false); }
  }
  const act = (fn: () => Promise<void>, ok: string) => void fn().then(() => toast.success(ok)).catch((e) => toast.error(e instanceof Error ? e.message : "Something went wrong"));

  return <div className="space-y-6">
    <div className="sp-page-heading flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.19em] text-[#653046] sm:text-xs">SHORT VIDEOS</p><h1 className="mt-1.5 text-lg font-black leading-[1.15] tracking-[-.03em] sm:text-xl">Food Shorts</h1>
        <p className="mt-2 max-w-3xl text-[13px] leading-6 text-stone-500">Post a video of up to {MAX_SHORT_SECONDS} seconds. You choose how far it reaches: only customers inside that distance from your shop can see it.</p></div>
    </div>
    {!hasPin && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Set your exact store pin in Store &amp; radius first. Customers see shorts by distance from your pin, so shorts without a pin reach nobody.</div>}
    {hasPin && !live && <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">Your shorts go live for customers once your store is verified and active. You can prepare them now.</div>}

    <section className="surface-card rounded-[26px] p-5" aria-label="New Food Short">
      <h2 className="font-black">New Food Short</h2>
      {!info ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input ref={fileInput} id="short-file" type="file" accept="video/mp4,video/quicktime,video/webm,video/*" className="sr-only" aria-label="Choose a video" onChange={(e) => void choose(e.target.files?.[0])} />
        <input id="short-camera" type="file" accept="video/*" capture="environment" className="sr-only" aria-label="Record a video" onChange={(e) => void choose(e.target.files?.[0])} />
        <label htmlFor="short-file" className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-stone-300 p-4 transition hover:border-[#753b50] hover:bg-stone-50"><span className="grid size-11 place-items-center rounded-xl bg-[#f7edf0] text-[#653046]"><Upload className="size-5" /></span><span><span className="block text-sm font-black">Choose a video</span><span className="block text-xs text-stone-500">MP4, MOV or WebM, up to {MAX_SHORT_SECONDS} seconds and 30 MB</span></span></label>
        <label htmlFor="short-camera" className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-stone-300 p-4 transition hover:border-[#753b50] hover:bg-stone-50"><span className="grid size-11 place-items-center rounded-xl bg-[#f7edf0] text-[#653046]"><Video className="size-5" /></span><span><span className="block text-sm font-black">Record now</span><span className="block text-xs text-stone-500">Opens your phone camera</span></span></label>
        {checking && <p className="text-sm font-bold text-stone-500 sm:col-span-2" role="status">Checking your video…</p>}
      </div>
      : <div className="mt-4 grid gap-5 md:grid-cols-[200px_1fr]">
        <div><video src={previewUrl} controls playsInline muted className="aspect-[9/16] w-full rounded-2xl bg-black object-cover" aria-label="Preview of your video" /><p className="mt-2 text-xs font-bold text-stone-500">Length {formatDuration(info.durationS)} of {formatDuration(MAX_SHORT_SECONDS)}</p></div>
        <div className="space-y-4">
          <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-[.14em] text-stone-500">Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Fresh croissants out of the oven" aria-label="Short title" className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#753b50]" /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-[.14em] text-stone-500">Caption (optional)</span><textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} rows={2} aria-label="Short caption" className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#753b50]" /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-[.14em] text-stone-500">Shop link (optional)</span><input type="url" value={shopLink} onChange={(e) => setShopLink(e.target.value)} maxLength={2048} placeholder="https://your-shop-or-product-link" aria-label="Shop link" className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#753b50]" /><span className="mt-1 block text-xs text-stone-500">Customers can open this link while watching your short.</span></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-[.14em] text-stone-500">Reach</span>
              <select value={reachKm} onChange={(e) => setReachKm(Number(e.target.value))} aria-label="Reach distance" className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#753b50]">{REACH_OPTIONS_KM.map((km) => <option key={km} value={km}>{km} km from my shop{km === defaultReachKm(vendor.radiusKm) ? " (my delivery radius)" : ""}</option>)}</select></label>
            <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-[.14em] text-stone-500">Product (optional)</span>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} aria-label="Tag product" className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#753b50]"><option value="">No product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          </div>
          <p className="flex items-center gap-1.5 text-xs font-bold text-stone-500"><MapPin className="size-3.5 text-[#653046]" />Customers within {reachKm} km of your shop can see this short. Your delivery radius is {vendor.radiusKm} km.</p>
          {error && <p role="alert" className="text-sm font-bold text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2"><Button onClick={() => void publish()} disabled={busy || !title.trim()} className="rounded-xl"><Clapperboard />{busy ? "Publishing…" : "Publish short"}</Button><Button variant="outline" onClick={reset} disabled={busy} className="rounded-xl">Choose another video</Button></div>
        </div>
      </div>}
      {error && !info && <p role="alert" className="mt-3 text-sm font-bold text-red-600">{error}</p>}
    </section>

    <section aria-label="Your Food Shorts" className="space-y-3">
      <h2 className="font-black">Your Food Shorts ({shorts.mine.length})</h2>
      {shorts.feedError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{shorts.feedError}</p>}
      {shorts.mine.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="my-shorts">{shorts.mine.map((s) => <article key={s.id} data-testid="my-short" className="surface-card overflow-hidden rounded-[26px]">
        <div className="relative aspect-[9/16] max-h-72 w-full bg-stone-900">
          {playing === s.id && s.videoUrl ? <video src={s.videoUrl} controls autoPlay playsInline className="h-full w-full object-contain" /> : <>{s.thumbUrl ? <Image src={s.thumbUrl} alt="" fill unoptimized sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" /> : <div className="grid h-full place-items-center text-stone-400"><Video className="size-10" /></div>}<button type="button" onClick={() => setPlaying(s.id)} disabled={!s.videoUrl} aria-label={`Play ${s.title}`} className="absolute inset-0 grid place-items-center bg-black/10 text-white disabled:hidden"><span className="grid size-12 place-items-center rounded-full bg-black/55">▶</span></button></>}
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-black text-white">{formatDuration(s.durationS)}</span>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2"><h3 className="min-w-0 truncate text-sm font-black">{s.title}</h3><span className={`sp-status inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-black ${s.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-stone-50 text-stone-500"}`}>{s.status === "active" ? "Live" : "Hidden"}</span></div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-stone-500"><span className="inline-flex items-center gap-1"><Eye className="size-3.5" />{s.viewCount}</span><span className="inline-flex items-center gap-1"><Heart className="size-3.5" />{s.likeCount}</span><span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{s.reachKm} km</span><span>{timeAgo(s.createdAt)}</span></p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => act(() => shorts.setStatus(s.id, s.status === "active" ? "hidden" : "active"), s.status === "active" ? "Hidden from customers" : "Live again")}>{s.status === "active" ? <><EyeOff />Hide</> : <><Eye />Show</>}</Button>
            {confirmDelete === s.id ? <Button size="sm" variant="outline" className="rounded-xl border-red-300 text-red-600" onClick={() => { setConfirmDelete(""); act(() => shorts.remove(s.id), "Short deleted"); }}>Confirm delete</Button> : <Button size="sm" variant="outline" className="rounded-xl text-red-600" onClick={() => setConfirmDelete(s.id)}><Trash2 />Delete</Button>}
          </div>
        </div>
      </article>)}</div>
        : <div className="surface-card rounded-[28px] border border-dashed p-10 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f7edf0] text-[#653046]"><Clapperboard className="size-7" /></div><h3 className="mt-4 font-black">No Food Shorts yet</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-stone-500">Show customers nearby what is fresh today. A 15 second clip of the kitchen or the counter works well.</p></div>}
    </section>
  </div>;
}
