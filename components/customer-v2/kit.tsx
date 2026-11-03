"use client";
// Shared building blocks for the redesigned customer portal. Deliberately
// free of value imports from sheplates-v3.tsx (types only) so the screens in
// this folder never form an import cycle with the main shell.
import type * as React from "react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { categories } from "@/lib/sheplates-data";
import type { Product, Vendor, V3State } from "@/components/sheplates-v3";

export const BRAND = "#753b50";

export const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
export const priceOf = (product: Product, state: V3State) => Math.round(product.vendorPrice * (1 + (state.markups[product.id] || 0) / 100) * 100) / 100;

export function haversineKm(aLat?: number, aLng?: number, bLat?: number, bLng?: number) {
  if (![aLat, aLng, bLat, bLng].every((v) => Number.isFinite(v))) return null;
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(bLat! - aLat!), dLng = rad(bLng! - aLng!);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat!)) * Math.cos(rad(bLat!)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const categoryEmoji = (category: string) => categories.find((c) => c.name === category)?.emoji || "🍽️";
export const categoryTint = (category: string) => categories.find((c) => c.name === category)?.color || "#ffe9ef";

/** "RS Puram, Coimbatore" style short area from a long geocoded address. */
export function shortArea(address?: string) {
  if (!address) return "Your area";
  // Vendors loaded from the nearby-marketplace query carry a placeholder instead of a street address.
  if (/serviceable near|delivery pin|location not confirmed|gps pin/i.test(address)) return "Near you";
  const parts = address.split(",").map((p) => p.trim()).filter((p) => p && !/^\d{5,6}$/.test(p) && !/india|tamil nadu|ward \d+|zone/i.test(p));
  return parts.slice(0, 2).join(", ") || "Your area";
}

export function vendorRating(state: V3State, vendorId: string) {
  const productIds = new Set(state.products.filter((p) => p.vendorId === vendorId).map((p) => p.id));
  const reviews = state.reviews.filter((r) => productIds.has(r.productId));
  if (!reviews.length) return null;
  return { average: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length, count: reviews.length };
}

export function vendorPhoto(state: V3State, vendor: Vendor) {
  return vendor.logoUrl || vendor.bannerUrl || state.products.find((p) => p.vendorId === vendor.id && p.imageUrl)?.imageUrl;
}

export function SegTabs<T extends string>({ tabs, value, onChange, className = "" }: { tabs: readonly T[]; value: T; onChange: (next: T) => void; className?: string }) {
  return <div role="tablist" className={`flex gap-2 overflow-x-auto pb-1 hide-scrollbar ${className}`}>
    {tabs.map((tab) => <button key={tab} role="tab" aria-selected={tab === value} type="button" onClick={() => onChange(tab)} className={`shrink-0 rounded-full border px-3 py-2 text-[13px] font-bold transition sm:px-4 sm:text-sm ${tab === value ? "border-[#753b50] bg-[#753b50] text-white shadow-[0_8px_20px_rgba(224,25,79,.25)]" : "border-stone-200 bg-white text-stone-600 hover:border-[#e8cbd5]"}`}>{tab}</button>)}
  </div>;
}

export function Avatar({ name, size = 40, ring = false }: { name: string; size?: number; ring?: boolean }) {
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return <span className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#753b50] to-[#753b50] font-black text-white ${ring ? "ring-[3px] ring-[#753b50] ring-offset-2" : ""}`} style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials}</span>;
}

/** A photo when there is one, otherwise a warm tinted tile with the category emoji —
 * so cards keep the photo-forward look of the design before vendors upload images. */
export function PhotoTile({ imageUrl, category, className = "", emojiSize = 44, children }: { imageUrl?: string | null; category?: string; className?: string; emojiSize?: number; children?: React.ReactNode }) {
  return <div className={`relative overflow-hidden ${className}`} style={imageUrl ? undefined : { background: `linear-gradient(135deg, ${categoryTint(category || "")}, #fff5f8)` }}>
    {imageUrl ? <Image src={imageUrl} alt="" fill unoptimized sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" /> : <span className="absolute inset-0 grid place-items-center" style={{ fontSize: emojiSize }} aria-hidden>{categoryEmoji(category || "")}</span>}
    {children}
  </div>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <div className="flex items-end justify-between gap-3"><h2 className="text-lg font-black tracking-[-.02em]">{title}</h2>{action && <button type="button" onClick={onAction} className="text-sm font-black text-[#653046]">{action}</button>}</div>;
}

export function EmptyState({ emoji, title, body, action }: { emoji: string; title: string; body: string; action?: React.ReactNode }) {
  return <div className="rounded-[28px] border border-dashed border-stone-300 bg-white/70 p-8 text-center"><div className="text-4xl" aria-hidden>{emoji}</div><h3 className="mt-3 font-black">{title}</h3><p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-stone-500">{body}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

/** True below the md breakpoint (768px); updates on resize/rotation. */
export function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => { const query = window.matchMedia("(max-width: 767px)"); const update = () => setMobile(query.matches); update(); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []);
  return mobile;
}

/** Re-renders every second so countdowns stay live; the deadline itself always comes from the server row. */
export function useTicker(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), intervalMs); return () => window.clearInterval(id); }, [intervalMs]);
  return now;
}

export function closesIn(endsAt: string, now = Date.now()) {
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return "Ended";
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60), s = Math.floor((ms % 60000) / 1000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m} min`;
}

export function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return <span className="inline-flex items-center" aria-label={`${value.toFixed(1)} out of 5`}>{[1, 2, 3, 4, 5].map((n) => <svg key={n} width={size} height={size} viewBox="0 0 24 24" className={n <= Math.round(value) ? "fill-[#f5a524] text-[#f5a524]" : "fill-stone-200 text-stone-200"}><path d="M12 2l3 6.9 7.5.6-5.7 4.9 1.8 7.3L12 17.8 5.4 21.7l1.8-7.3L1.5 9.5 9 8.9z" /></svg>)}</span>;
}
