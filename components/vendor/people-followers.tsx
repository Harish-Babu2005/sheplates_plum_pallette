"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { loadVendorFollowers, type VendorFollower } from "@/lib/social";
import type { Vendor } from "@/components/sheplates-v3";
import { Avatar, EmptyState } from "@/components/customer-v2/kit";

export function VendorPeopleFollowers({ vendor }: { vendor: Vendor }) {
  const [followers, setFollowers] = useState<VendorFollower[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const result = await loadVendorFollowers(vendor.id);
        if (active) setFollowers(result);
      } catch (error) {
        if (active) toast.error(error instanceof Error ? error.message : "Customer followers could not be loaded");
      } finally {
        if (active) setLoading(false);
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [vendor.id]);

  return <div className="space-y-5">
    <div className="flex items-end justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-[.16em] text-[#653046]">CUSTOMER COMMUNITY</p><h1 className="mt-1 text-xl font-black">People followers</h1><p className="mt-1 text-sm text-stone-500">Customers who follow {vendor.businessName}.</p></div>
      <span className="rounded-full bg-white px-3 py-1.5 text-xs font-black shadow-sm">{followers.length} follower{followers.length === 1 ? "" : "s"}</span>
    </div>
    {loading && !followers.length ? <p className="text-sm font-bold text-stone-500" role="status">Loading followers…</p>
      : followers.length ? <div className="space-y-2">{followers.map((person) => <div key={person.id} className="flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white p-3 shadow-sm"><Avatar name={person.handle} size={44} /><div className="min-w-0"><b className="block truncate text-sm">@{person.handle}</b><span className="block truncate text-xs text-stone-500">{person.bio || "ShePlates customer"}</span></div></div>)}</div>
      : <EmptyState emoji="🫶" title="No customer followers yet" body="Customers who follow your store will appear here." />}
  </div>;
}
