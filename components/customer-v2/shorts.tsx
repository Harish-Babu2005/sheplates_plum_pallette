"use client";
// Food Shorts for customers: thumbnails, the distance-controlled feed, the rail used in
// Marketplace, and the full-screen vertical viewer. Visibility itself is decided by the
// data layer (lib/food-shorts.ts, enforced in the database); this file only presents
// whatever the customer is allowed to see.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronDown, ChevronUp, Heart, MapPin, Play, ShoppingBag, Volume2, VolumeX, X } from "@/components/icons";
import type { FoodShort } from "@/lib/food-shorts";
import { VIEW_RADIUS_OPTIONS_KM, formatDistanceKm, formatDuration } from "@/lib/food-shorts-rules";
import { Avatar, EmptyState, PhotoTile, categoryEmoji } from "./kit";

export function ShortThumb({ short, onOpen, className = "" }: { short: FoodShort; onOpen: () => void; className?: string }) {
  return <button type="button" onClick={onOpen} data-testid="short-thumb" aria-label={`Watch ${short.title} from ${short.vendorName}`} className={`group relative block aspect-[9/16] overflow-hidden rounded-[22px] bg-stone-900 text-left shadow-sm ring-1 ring-black/5 transition hover:shadow-lg ${className}`}>
    <span className="absolute inset-0 block"><PhotoTile imageUrl={short.thumbUrl} category={short.vendorCategory} className="h-full w-full" emojiSize={56} /></span>
    <span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
    {short.distanceKm != null && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 text-[10px] font-black text-stone-800 shadow"><MapPin className="size-3 text-[#653046]" />{formatDistanceKm(short.distanceKm)}</span>}
    <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-black text-white">{formatDuration(short.durationS)}</span>
    <span className="absolute bottom-[3.4rem] right-2.5 grid size-9 place-items-center rounded-full bg-white/90 text-[#653046] shadow-lg transition group-hover:scale-110"><Play className="ml-0.5 size-4 fill-current" /></span>
    <span className="absolute inset-x-2.5 bottom-2.5 text-white"><span className="line-clamp-2 text-[13px] font-black leading-tight drop-shadow">{short.title}</span><span className="mt-0.5 block truncate text-[11px] font-bold text-white/85">{short.vendorName}{short.sample ? " · Sample" : ""}</span></span>
  </button>;
}

export function DistanceChips({ value, onChange }: { value: number; onChange: (km: number) => void }) {
  return <div role="tablist" aria-label="Distance" className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
    {VIEW_RADIUS_OPTIONS_KM.map((km) => <button key={km} role="tab" type="button" aria-selected={km === value} onClick={() => onChange(km)} className={`shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-bold transition ${km === value ? "border-[#753b50] bg-[#753b50] text-white shadow-[0_8px_20px_rgba(224,25,79,.25)]" : "border-stone-200 bg-white text-stone-600 hover:border-[#e8cbd5]"}`}>{km} km</button>)}
  </div>;
}

/** The Shorts section inside the Stories tab: distance chips plus a grid. */
export function ShortsFeed({ shorts, radius, onRadius, onOpen, hasPin, onSetLocation }: { shorts: FoodShort[]; radius: number; onRadius: (km: number) => void; onOpen: (index: number) => void; hasPin: boolean; onSetLocation?: () => void }) {
  if (!hasPin) return <EmptyState emoji="📍" title="Set your location to see Food Shorts" body="Shorts are shown by distance, so we need your delivery pin first." action={onSetLocation ? <button type="button" onClick={onSetLocation} className="rounded-full bg-[#753b50] px-5 py-2 text-sm font-black text-white">Set my location</button> : undefined} />;
  return <div className="space-y-4">
    <div><h2 className="text-lg font-black tracking-[-.02em]">Food Shorts near you</h2><p className="mt-0.5 text-xs font-bold text-stone-500">Videos from vendors within {radius} km. A vendor only reaches customers inside the distance they chose.</p></div>
    <DistanceChips value={radius} onChange={onRadius} />
    {shorts.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="shorts-grid">{shorts.map((s, i) => <ShortThumb key={s.id} short={s} onOpen={() => onOpen(i)} />)}</div>
      : <EmptyState emoji="🎬" title={`No Food Shorts within ${radius} km`} body={radius < 30 ? "Try a wider distance. New shorts from nearby vendors appear here as they are posted." : "Vendors around you haven't posted a short yet."} />}
  </div>;
}

/** A horizontal row of shorts for the Marketplace and vendor profiles. */
export function ShortsRail({ shorts, onOpen, title = "Food Shorts near you", onSeeAll }: { shorts: FoodShort[]; onOpen: (index: number) => void; title?: string; onSeeAll?: () => void }) {
  if (!shorts.length) return null;
  return <section aria-label={title} data-testid="shorts-rail" className="space-y-3">
    <div className="flex items-end justify-between gap-3"><h2 className="text-lg font-black tracking-[-.02em]">{title}</h2>{onSeeAll && <button type="button" onClick={onSeeAll} className="text-sm font-black text-[#653046]">See all</button>}</div>
    <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar">{shorts.slice(0, 12).map((s, i) => <ShortThumb key={s.id} short={s} onOpen={() => onOpen(i)} className="w-[128px] shrink-0 sm:w-[148px]" />)}</div>
  </section>;
}

/** Full-screen vertical player. Scroll or use the arrows to move between shorts; only the
 * short in view plays. */
export function ShortsViewer({ shorts, startIndex, onClose, liked, onLike, onView, onOpenVendor }: {
  shorts: FoodShort[]; startIndex: number; onClose: () => void; liked: string[]; onLike: (id: string) => void; onView: (id: string) => void | Promise<void>; onOpenVendor?: (vendorId: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const slides = useRef<(HTMLElement | null)[]>([]);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const [active, setActive] = useState(startIndex);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const count = shorts.length;
  const [baseLiked] = useState(() => new Set(liked)); // the snapshot's like counts already include these

  const go = useCallback((index: number) => {
    const el = slides.current[Math.max(0, Math.min(count - 1, index))];
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [count]);

  useEffect(() => {
    // lock the page scroll on both roots so a classic scrollbar can't leave a strip beside the player
    const root = document.documentElement;
    const previous = document.body.style.overflow, previousRoot = root.style.overflow, previousGutter = root.style.scrollbarGutter;
    document.body.style.overflow = "hidden"; root.style.overflow = "hidden"; root.style.scrollbarGutter = "auto"; // the app reserves a gutter; release it while the player is open
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowDown") go(active + 1); if (e.key === "ArrowUp") go(active - 1); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; root.style.overflow = previousRoot; root.style.scrollbarGutter = previousGutter; window.removeEventListener("keydown", onKey); };
  }, [active, go, onClose]);

  useEffect(() => { slides.current[startIndex]?.scrollIntoView({ block: "start" }); }, [startIndex]);

  useEffect(() => {
    const root = scroller.current; if (!root) return;
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
        setProgress(0);
        setActive(Number((entry.target as HTMLElement).dataset.index));
      }
    }, { root, threshold: [0.6] });
    slides.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [count]);

  useEffect(() => {
    videos.current.forEach((video, i) => { if (!video) return; if (i === active) { video.currentTime = 0; void video.play().catch(() => undefined); } else video.pause(); });
    const current = shorts[active]; if (current) void onView(current.id);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = shorts[active];
  // Rendered on document.body: an ancestor with a filter or transform would otherwise shrink "fixed" to its own box.
  return createPortal(<div role="dialog" aria-modal="true" aria-label="Food Shorts" ref={(el) => el?.style.setProperty("max-width", "none", "important")} className="fixed inset-0 z-[250] bg-black" data-testid="shorts-viewer">
    <div ref={scroller} className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain hide-scrollbar">
      {shorts.map((s, i) => <section key={s.id} ref={(el) => { slides.current[i] = el; }} data-index={i} aria-label={`${s.title}, ${s.vendorName}`} className="relative flex h-[100dvh] snap-start items-center justify-center">
        <div className="relative h-full w-full max-w-[460px] overflow-hidden bg-stone-900">
          {(() => {
            let shopHref: string | undefined;
            try {
              const url = new URL(s.shopLink || "");
              if (url.protocol === "https:" || url.protocol === "http:") shopHref = url.href;
            } catch { /* Hide malformed links from older or externally written records. */ }
            return shopHref && <a href={shopHref} target="_blank" rel="noopener noreferrer" className="absolute right-4 bottom-32 z-10 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-black text-stone-900 shadow-lg transition hover:bg-stone-100"><ShoppingBag className="size-4" />Shop now</a>;
          })()}
          {s.videoUrl
            ? <video ref={(el) => { videos.current[i] = el; }} src={s.videoUrl} poster={s.thumbUrl} muted={muted} loop playsInline preload={Math.abs(i - active) <= 1 ? "auto" : "metadata"} onTimeUpdate={(e) => { if (i === active) setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0); }} className="h-full w-full object-cover" />
            : <div className="grid h-full w-full place-items-center bg-gradient-to-br from-[#292124] via-[#292124] to-[#292124]">{s.thumbUrl ? <Image src={s.thumbUrl} alt="" fill unoptimized sizes="460px" className="object-cover opacity-80" /> : <span className="text-[120px]" aria-hidden>{categoryEmoji(s.vendorCategory)}</span>}<span className="absolute left-1/2 top-24 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-black text-stone-800">Sample clip, no video</span></div>}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
          <div className="absolute inset-x-4 bottom-6 flex items-end justify-between gap-3 text-white">
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => { onClose(); onOpenVendor?.(s.vendorId); }} className="flex max-w-full items-center gap-2 text-left"><Avatar name={s.vendorName} size={36} ring /><span className="truncate text-sm font-black">{s.vendorName}</span></button>
              <h3 className="mt-2 text-[15px] font-black leading-tight">{s.title}</h3>
              {s.caption && <p className="mt-1 line-clamp-2 text-[13px] text-white/85">{s.caption}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black">
                {s.distanceKm != null && <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 backdrop-blur"><MapPin className="size-3" />{formatDistanceKm(s.distanceKm)} away</span>}
                <span className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur">Reaches {s.reachKm} km</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-3">
              <button type="button" aria-label={liked.includes(s.id) ? "Unlike" : "Like"} onClick={() => onLike(s.id)} className="grid size-12 place-items-center rounded-full bg-white/15 backdrop-blur transition active:scale-90"><Heart className={`size-6 ${liked.includes(s.id) ? "fill-[#753b50] text-[#753b50]" : "text-white"}`} /></button>
              <span className="-mt-2 text-xs font-black" data-testid="short-likes">{s.likeCount + (liked.includes(s.id) ? 1 : 0) - (baseLiked.has(s.id) ? 1 : 0)}</span>
            </div>
          </div>
          {i === active && s.videoUrl && <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20"><div className="h-full bg-[#753b50]" style={{ width: `${progress * 100}%` }} /></div>}
        </div>
      </section>)}
    </div>
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <button type="button" aria-label="Close Food Shorts" onClick={onClose} className="pointer-events-auto grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur"><X className="size-5" /></button>
      <span className="rounded-full bg-black/45 px-3 py-1.5 text-xs font-black text-white backdrop-blur" aria-live="polite">{active + 1} / {count}</span>
      <button type="button" aria-label={muted ? "Turn sound on" : "Turn sound off"} onClick={() => setMuted((v) => !v)} className="pointer-events-auto grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur">{muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}</button>
    </div>
    <div className="pointer-events-none absolute right-5 top-1/2 hidden -translate-y-1/2 flex-col gap-3 md:flex">
      <button type="button" aria-label="Previous short" disabled={active === 0} onClick={() => go(active - 1)} className="pointer-events-auto grid size-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur disabled:opacity-30"><ChevronUp className="size-5" /></button>
      <button type="button" aria-label="Next short" disabled={active >= count - 1} onClick={() => go(active + 1)} className="pointer-events-auto grid size-11 place-items-center rounded-full bg-white/15 text-white backdrop-blur disabled:opacity-30"><ChevronDown className="size-5" /></button>
    </div>
    <span className="sr-only">{current ? `Now playing ${current.title}` : ""}</span>
  </div>, document.body);
}

/** Small hook so any screen can open the viewer on a list of shorts. */
export function useShortsViewer() {
  const [state, setState] = useState<{ shorts: FoodShort[]; start: number } | null>(null);
  const open = useCallback((shorts: FoodShort[], start: number) => setState({ shorts, start }), []);
  const close = useCallback(() => setState(null), []);
  return useMemo(() => ({ state, open, close }), [state, open, close]);
}
