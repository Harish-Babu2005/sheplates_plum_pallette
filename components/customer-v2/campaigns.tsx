"use client";
// The Marketplace banner for live campaigns. It shows what the Super Admin has set live for this
// customer's audience, rotates through up to six, and falls back to the standing promo when none is live.
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Timer } from "@/components/icons";
import type { LiveCampaign } from "@/lib/campaigns";
import { endsInLabel } from "@/lib/campaigns-rules";

const THEMES = [
  "from-[#292124] via-[#753b50] to-[#753b50]",
  "from-[#292124] via-[#292124] to-[#292124]",
  "from-[#3b2410] via-[#7a4a14] to-[#c1651f]",
  "from-[#292124] via-[#292124] to-[#292124]",
] as const;

export function CampaignBanner({ campaigns, fallback, onCta, onView, intervalMs = 6000 }: {
  campaigns: LiveCampaign[]; fallback: React.ReactNode; onCta: (campaign: LiveCampaign) => void; onView: (id: string) => void; intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = campaigns.length;
  const safe = count ? Math.max(0, Math.min(index, count - 1)) : 0;
  const current = campaigns[safe];
  const currentId = current?.id;
  const viewed = useRef(onView);

  useEffect(() => { viewed.current = onView; }, [onView]);
  useEffect(() => { if (currentId) onView(currentId); }, [currentId, onView]);
  useEffect(() => {
    if (count < 2 || paused) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => window.clearInterval(t);
  }, [count, paused, intervalMs]);

  if (!current) return <>{fallback}</>;
  const ends = endsInLabel(current.endsAt);
  return <section aria-roledescription="carousel" aria-label="Offers and campaigns" data-testid="campaign-banner" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}
    className={`relative overflow-hidden rounded-[26px] bg-gradient-to-br ${THEMES[safe % THEMES.length]} p-5 text-white shadow-[0_18px_44px_rgba(35,10,20,.18)] sm:p-7`}>
    <div className="pointer-events-none absolute -right-4 -top-4 select-none text-[120px] leading-none opacity-25 sm:text-[150px]" aria-hidden>{current.emoji}</div>
    <div key={current.id} data-campaign-id={current.id} aria-live="polite" className="relative max-w-xl">
      {current.offer && <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-[11px] font-black uppercase tracking-[.12em] backdrop-blur">{current.offer}</span>}
      <h2 className="mt-3 text-xl font-black leading-tight tracking-[-.02em] sm:text-3xl" data-testid="campaign-headline">{current.headline}</h2>
      {current.subline && <p className="mt-1.5 text-sm text-white/80 sm:text-base">{current.subline}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => onCta(current)} data-testid="campaign-cta" className="rounded-full bg-white px-5 py-2 text-sm font-black text-[#292124] shadow-[0_10px_24px_rgba(0,0,0,.25)] transition hover:scale-[1.03]">{current.ctaLabel}</button>
        {ends && <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white/85"><Timer className="size-3.5" />Ends in {ends}</span>}
      </div>
    </div>
    {count > 1 && <>
      <div className="relative mt-5 flex items-center gap-2" role="tablist" aria-label="Choose a campaign">
        {campaigns.map((c, i) => <button key={c.id} type="button" role="tab" aria-selected={i === safe} aria-label={`Campaign ${i + 1} of ${count}: ${c.headline}`} onClick={() => setIndex(i)} className={`h-1.5 rounded-full transition-all ${i === safe ? "w-7 bg-white" : "w-3 bg-white/40 hover:bg-white/70"}`} />)}
      </div>
      <div className="absolute bottom-4 right-4 hidden gap-2 sm:flex">
        <button type="button" aria-label="Previous campaign" onClick={() => setIndex((safe - 1 + count) % count)} className="grid size-9 place-items-center rounded-full bg-white/20 backdrop-blur transition hover:bg-white/35"><ChevronLeft className="size-4" /></button>
        <button type="button" aria-label="Next campaign" onClick={() => setIndex((safe + 1) % count)} className="grid size-9 place-items-center rounded-full bg-white/20 backdrop-blur transition hover:bg-white/35"><ChevronRight className="size-4" /></button>
      </div>
    </>}
  </section>;
}
