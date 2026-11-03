// Live campaigns, customer side: what the Marketplace banner shows and how views and taps are counted.
// The database decides what a customer may see (live_campaigns() in supabase/V9_2_LIVE_CAMPAIGNS.sql);
// demo mode applies the same rules to the sample campaigns in local data.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient, isLiveSupabaseMode } from "@/lib/supabase";
import { liveForCustomer, type CampaignSegment, type CampaignStatus, type CampaignTargetType } from "@/lib/campaigns-rules";

export type LiveCampaign = {
  id: string; name: string; headline: string; subline: string; offer: string; emoji: string; ctaLabel: string;
  targetType: CampaignTargetType; targetValue: string; endsAt?: string; priority: number;
};

/** The shape of a campaign in the app's own data (admin screen and demo mode). */
export type CampaignRecord = {
  id: string; name: string; audience: string; offer: string; channel: string; status: CampaignStatus; aiRationale: string; createdAt: string;
  headline?: string; subline?: string; emoji?: string; ctaLabel?: string; targetType?: CampaignTargetType; targetValue?: string;
  segment?: CampaignSegment; startsAt?: string; endsAt?: string; priority?: number; views?: number; clicks?: number;
};

export const toLiveCampaign = (c: CampaignRecord): LiveCampaign => ({
  id: c.id, name: c.name, headline: c.headline || c.name, subline: c.subline || "", offer: c.offer, emoji: c.emoji || "🎉", ctaLabel: c.ctaLabel || "Shop now",
  targetType: c.targetType || "none", targetValue: c.targetValue || "", endsAt: c.endsAt || undefined, priority: c.priority ?? 0,
});

type LiveRow = { id: string; name: string; headline: string | null; subline: string | null; offer: string; emoji: string; cta_label: string; target_type: CampaignTargetType; target_value: string | null; ends_at: string | null; priority: number };

export async function loadLiveCampaigns(): Promise<LiveCampaign[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return [];
  const res = await sb.rpc("live_campaigns");
  if (res.error) return [];
  return ((res.data || []) as LiveRow[]).map((r) => ({
    id: r.id, name: r.name, headline: r.headline || r.name, subline: r.subline || "", offer: r.offer, emoji: r.emoji || "🎉", ctaLabel: r.cta_label || "Shop now",
    targetType: r.target_type, targetValue: r.target_value || "", endsAt: r.ends_at || undefined, priority: r.priority,
  }));
}

export function recordCampaignEvent(id: string, kind: "view" | "click") {
  if (!isLiveSupabaseMode()) return;
  void getSupabaseBrowserClient()?.rpc("record_campaign_event", { p_campaign: id, p_kind: kind });
}

/** The campaigns this customer should see now. Live mode asks the database every minute; demo mode applies the same rules locally. */
export function useCustomerCampaigns(local: CampaignRecord[], hasOrdered: boolean) {
  const [remote, setRemote] = useState<LiveCampaign[] | null>(null);
  const live = isLiveSupabaseMode();
  const refresh = useCallback(async () => { if (live) setRemote(await loadLiveCampaigns()); }, [live]);
  useEffect(() => {
    if (!live) return;
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, [live, refresh]);
  const [tick, setTick] = useState(0);
  useEffect(() => { if (live) return; const t = window.setInterval(() => setTick((n) => n + 1), 30_000); return () => window.clearInterval(t); }, [live]);
  return useMemo(() => (live ? remote || [] : liveForCustomer(local, hasOrdered).map(toLiveCampaign)), [live, remote, local, hasOrdered, tick]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Counts each campaign once per page visit. */
export function useCampaignViewCounter() {
  const seen = useRef<Set<string>>(new Set());
  return useCallback((id: string) => { if (seen.current.has(id)) return; seen.current.add(id); recordCampaignEvent(id, "view"); }, []);
}
