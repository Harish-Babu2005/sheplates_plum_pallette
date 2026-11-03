// Stories monitor: Operations and Super Admin review reported customer statuses and vendor Food Shorts.
// Backed by supabase/V9_13_STORIES_MONITOR.sql. Every call goes through a database function that checks the caller's role.
import { getSupabaseBrowserClient } from "@/lib/supabase";

export type MonitorSummary = { liveStatuses: number; reported: number; removedThisWeek: number; foodShortsLive: number };
export type MonitorStatus = { id: string; kind: "photo" | "video"; mediaUrl: string; thumbUrl?: string; caption: string; authorHandle: string; createdAt: string; expiresAt: string; reportCount: number; viewCount: number; lastReason?: string };
export type MonitorShort = { id: string; vendorName: string; title: string; caption: string; thumbUrl?: string; videoUrl: string; durationS: number; viewCount: number; status: "active" | "hidden" | "removed"; createdAt: string };
export type MonitorFilter = "reported" | "newest" | "most_viewed";

function client() {
  const sb = getSupabaseBrowserClient();
  if (!sb) throw new Error("The live database is not connected");
  return sb;
}
function fail(error: { message: string } | null | undefined, hint = "Apply supabase/V9_13_STORIES_MONITOR.sql first."): never {
  const message = error?.message || "Request failed";
  throw new Error(/function .* does not exist|schema cache/i.test(message) ? `The Stories monitor needs a database update. ${hint}` : message);
}

export async function loadMonitorSummary(): Promise<MonitorSummary> {
  const res = await client().rpc("stories_monitor_summary");
  if (res.error) fail(res.error);
  const row = (Array.isArray(res.data) ? res.data[0] : res.data) as { live_statuses: number; reported: number; removed_this_week: number; food_shorts_live: number } | null;
  return { liveStatuses: Number(row?.live_statuses ?? 0), reported: Number(row?.reported ?? 0), removedThisWeek: Number(row?.removed_this_week ?? 0), foodShortsLive: Number(row?.food_shorts_live ?? 0) };
}

export async function loadMonitorStatuses(filter: MonitorFilter): Promise<MonitorStatus[]> {
  const res = await client().rpc("monitor_statuses", { p_filter: filter });
  if (res.error) fail(res.error);
  return ((res.data || []) as { id: string; kind: "photo" | "video"; media_url: string; thumb_url: string | null; caption: string; author_handle: string; created_at: string; expires_at: string; report_count: number; view_count: number; last_reason: string | null }[]).map((r) => ({
    id: r.id, kind: r.kind, mediaUrl: r.media_url, thumbUrl: r.thumb_url || undefined, caption: r.caption, authorHandle: r.author_handle, createdAt: r.created_at, expiresAt: r.expires_at,
    reportCount: Number(r.report_count), viewCount: Number(r.view_count), lastReason: r.last_reason || undefined,
  }));
}

/** Removes the status, tells the author why, and deletes the uploaded files. */
export async function removeMonitorStatus(id: string, reason: string): Promise<void> {
  const sb = client();
  const res = await sb.rpc("remove_status", { p_status: id, p_reason: reason });
  if (res.error) fail(res.error);
  const paths = ((res.data || []) as { m_url: string | null; t_url: string | null }[]).flatMap((r) => [r.m_url, r.t_url]).flatMap((u) => { const m = u?.split("/status-media/")[1]; return m ? [decodeURIComponent(m)] : []; });
  if (paths.length) await sb.storage.from("status-media").remove(paths);
}

export async function keepMonitorStatus(id: string): Promise<void> {
  const res = await client().rpc("keep_status", { p_status: id });
  if (res.error) fail(res.error);
}

export async function loadMonitorShorts(): Promise<MonitorShort[]> {
  const res = await client().rpc("monitor_food_shorts");
  if (res.error) fail(res.error);
  return ((res.data || []) as { id: string; vendor_name: string; title: string; caption: string; thumb_url: string | null; video_url: string; duration_s: number; view_count: number; status: "active" | "hidden" | "removed"; created_at: string }[]).map((r) => ({
    id: r.id, vendorName: r.vendor_name, title: r.title, caption: r.caption, thumbUrl: r.thumb_url || undefined, videoUrl: r.video_url, durationS: Number(r.duration_s), viewCount: Number(r.view_count), status: r.status, createdAt: r.created_at,
  }));
}

export async function setMonitorShortStatus(id: string, status: "active" | "hidden" | "removed"): Promise<void> {
  const res = await client().rpc("set_food_short_status", { p_short: id, p_status: status });
  if (res.error) fail(res.error);
}
