// Live campaigns — the rules, as pure functions with no imports so Node can test them directly
// (tests/campaigns-rules.test.mjs). The database applies the same rules in live_campaigns()
// (supabase/V9_2_LIVE_CAMPAIGNS.sql); this mirrors them for demo mode and for the admin preview.

export type CampaignStatus = "Draft" | "Active" | "Paused";
export type CampaignTargetType = "none" | "category" | "vendor" | "product";
export type CampaignSegment = "everyone" | "new_customers" | "returning_customers";
export type CampaignPhase = "draft" | "paused" | "scheduled" | "live" | "ended";

export const SEGMENT_LABEL: Record<CampaignSegment, string> = {
  everyone: "All customers",
  new_customers: "New customers (no orders yet)",
  returning_customers: "Returning customers (at least one order)",
};
export const TARGET_LABEL: Record<CampaignTargetType, string> = { none: "Just show the offer", category: "Open a category", vendor: "Open a vendor", product: "Show a product" };
export const MAX_LIVE_CAMPAIGNS = 6;
export const HEADLINE_MAX = 60;
export const SUBLINE_MAX = 120;

export type CampaignLike = {
  status: CampaignStatus; startsAt?: string | null; endsAt?: string | null; segment?: CampaignSegment | null; headline?: string | null;
  priority?: number | null; createdAt?: string | null;
};

/** Where a campaign is in its life. Only "live" reaches customers. */
export function campaignPhase(c: Pick<CampaignLike, "status" | "startsAt" | "endsAt">, now: number = Date.now()): CampaignPhase {
  if (c.status === "Draft") return "draft";
  if (c.status === "Paused") return "paused";
  const start = c.startsAt ? new Date(c.startsAt).getTime() : null, end = c.endsAt ? new Date(c.endsAt).getTime() : null;
  if (end !== null && Number.isFinite(end) && end <= now) return "ended";
  if (start !== null && Number.isFinite(start) && start > now) return "scheduled";
  return "live";
}

export const PHASE_LABEL: Record<CampaignPhase, string> = { draft: "Draft", paused: "Paused", scheduled: "Scheduled", live: "Live now", ended: "Ended" };

/** The audience rule: a segment is decided by whether the customer has ordered before. */
export function campaignSeenBy(c: Pick<CampaignLike, "segment">, hasOrdered: boolean): boolean {
  const segment = c.segment || "everyone";
  if (segment === "everyone") return true;
  return segment === "returning_customers" ? hasOrdered : !hasOrdered;
}

/** What a customer would see right now: live, inside the audience, highest priority first, newest first, capped. */
export function liveForCustomer<T extends CampaignLike>(campaigns: T[], hasOrdered: boolean, now: number = Date.now()): T[] {
  return campaigns
    .filter((c) => campaignPhase(c, now) === "live" && Boolean(c.headline && c.headline.trim()) && campaignSeenBy(c, hasOrdered))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
    .slice(0, MAX_LIVE_CAMPAIGNS);
}

export type CampaignForm = {
  name: string; headline: string; subline: string; targetType: CampaignTargetType; targetValue: string;
  startsAt: string; endsAt: string; status?: CampaignStatus;
};

/** One plain sentence about what to fix, or null when the campaign can be saved. */
export function validateCampaignForm(f: CampaignForm): string | null {
  if (!f.name.trim()) return "Give the campaign an internal name";
  if (!f.headline.trim()) return "Write the headline customers will see";
  if (f.headline.trim().length > HEADLINE_MAX) return `Keep the headline to ${HEADLINE_MAX} characters`;
  if (f.subline.trim().length > SUBLINE_MAX) return `Keep the line under the headline to ${SUBLINE_MAX} characters`;
  if (f.targetType !== "none" && !f.targetValue.trim()) return f.targetType === "category" ? "Choose the category the button opens" : f.targetType === "vendor" ? "Choose the vendor the button opens" : "Choose the product the button shows";
  const start = f.startsAt ? new Date(f.startsAt).getTime() : null, end = f.endsAt ? new Date(f.endsAt).getTime() : null;
  if (start !== null && Number.isNaN(start)) return "The start date is not valid";
  if (end !== null && Number.isNaN(end)) return "The end date is not valid";
  if (start !== null && end !== null && end <= start) return "The end must be after the start";
  if (f.status === "Active" && end !== null && end <= Date.now()) return "The end date has already passed";
  return null;
}

/** "2d 4h", "5h 12m", "38 min": coarse on purpose, for a banner. Empty when there is no end or it is far away. */
export function endsInLabel(endsAt: string | null | undefined, now: number = Date.now(), withinDays = 7): string {
  if (!endsAt) return "";
  const ms = new Date(endsAt).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0 || ms > withinDays * 86_400_000) return "";
  const minutes = Math.floor(ms / 60_000), hours = Math.floor(minutes / 60), days = Math.floor(hours / 24);
  if (days >= 1) return `${days}d ${hours % 24}h`;
  if (hours >= 1) return `${hours}h ${minutes % 60}m`;
  return `${Math.max(1, minutes)} min`;
}

export function clickRate(views: number | undefined, clicks: number | undefined): string {
  const v = views || 0, c = clicks || 0;
  if (v <= 0) return "0%";
  return `${Math.min(100, Math.round((c / v) * 100))}%`;
}

/** <input type="datetime-local"> uses local time without a zone; the database wants an ISO instant. */
export function localInputToIso(value: string): string | null { if (!value) return null; const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ""; const d = new Date(iso); if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
