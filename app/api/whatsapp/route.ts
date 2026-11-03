import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ReminderRequest = { scheduleId?: string; orderId?: string; template?: "schedule_reminder" | "order_started" | "out_for_delivery" };

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !anon || !service || !token) return NextResponse.json({ error: "Notifications are temporarily unavailable." }, { status: 503 });

  const caller = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await caller.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const body = await request.json() as ReminderRequest;
  const template = body.template || "schedule_reminder";
  const { data: profile } = await admin.from("profiles").select("id,phone").eq("id", authData.user.id).single();
  if (!profile?.phone) return NextResponse.json({ error: "Add a WhatsApp phone number in Profile first." }, { status: 400 });

  const scheduledFor = template === "schedule_reminder" ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : new Date().toISOString();
  const queued = await admin.from("communication_outbox").insert({ recipient_id: profile.id, channel: "whatsapp", template_key: template, payload: { schedule_id: body.scheduleId, order_id: body.orderId, phone: profile.phone }, scheduled_for: scheduledFor }).select("id,status,scheduled_for").single();
  if (queued.error) return NextResponse.json({ error: queued.error.message }, { status: 500 });

  // Provider delivery is intentionally performed by a scheduled worker, not the browser.
  // This endpoint only creates a role-owned outbox record that can be audited/retried.
  return NextResponse.json({ queued: true, reminder: queued.data });
}

