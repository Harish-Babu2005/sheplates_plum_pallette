import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type InviteBody = { email?: string; name?: string; businessName?: string };

/**
 * Operations / Super Admin: invite a vendor by email.
 *
 * The caller's own Supabase session is checked against `profiles` (a role claimed by the browser is never trusted).
 * The invitation itself is sent by Supabase Auth with the service-role key, which never reaches the client. The vendor
 * opens the link, sets a password on the app's password page, and then completes onboarding and accepts the agreement.
 * The email is sent by the project's own email settings in Supabase (Authentication > Emails).
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) return NextResponse.json({ error: "Invitations are not available in this deployment." }, { status: 500 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sign in as Operations or Super Admin to invite a vendor." }, { status: 401 });

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: authData, error: authError } = await caller.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  const { data: callerProfile } = await caller.from("profiles").select("role").eq("id", authData.user.id).single();
  if (!callerProfile || !["operations", "admin"].includes(callerProfile.role)) return NextResponse.json({ error: "Only Operations or Super Admin can invite vendors." }, { status: 403 });

  const body = await request.json() as InviteBody;
  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim() || "Vendor";
  const businessName = body.businessName?.trim() || "";
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address for the vendor." }, { status: 400 });

  const origin = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || new URL(request.url).origin;
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const invited = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin.replace(/\/$/, "")}/reset-password`, data: { full_name: name, role: "vendor", business_name: businessName } });
  if (invited.error) return NextResponse.json({ error: /already|registered|exists/i.test(invited.error.message) ? "A login with this email already exists. Ask the vendor to sign in, or use the vendor picker." : invited.error.message }, { status: 400 });

  const profile = await admin.from("profiles").upsert({ id: invited.data.user.id, full_name: name, role: "vendor" }, { onConflict: "id" });
  if (profile.error) return NextResponse.json({ error: profile.error.message }, { status: 500 });

  await admin.from("audit_logs").insert({ actor_id: authData.user.id, actor_role: callerProfile.role, action: "invited_vendor", entity_type: "profile", entity_id: invited.data.user.id, after_data: { email, businessName } });
  return NextResponse.json({ ok: true, email });
}
