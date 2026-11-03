import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Scheduled cleanup for customer statuses. A status is hidden from everyone the moment it expires; this removes the
// rows and the photo or video files so nothing is kept. Call it every hour from the host's scheduler:
//   POST /api/statuses/purge   with the header  x-cron-secret: <STATUS_PURGE_SECRET>
export async function POST(request: Request) {
  const secret = process.env.STATUS_PURGE_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const purged = await admin.rpc("purge_expired_statuses");
  if (purged.error) return NextResponse.json({ error: purged.error.message }, { status: 500 });
  const rows = (purged.data || []) as { m_url: string | null; t_url: string | null }[];
  const paths = rows.flatMap((r) => [r.m_url, r.t_url]).flatMap((u) => { const m = u?.split("/status-media/")[1]; return m ? [decodeURIComponent(m)] : []; });
  if (paths.length) await admin.storage.from("status-media").remove(paths);
  return NextResponse.json({ removedStatuses: rows.length, removedFiles: paths.length });
}
