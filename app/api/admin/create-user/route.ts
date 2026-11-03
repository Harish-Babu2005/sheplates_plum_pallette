import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CreateUserBody = {
  name?: string;
  email?: string;
  role?: "operations" | "admin";
};

function generateTemporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < 14; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * Super-Admin-only account provisioning.
 *
 * Only a caller whose own Supabase session resolves (via RLS, through `profiles`) to
 * role = 'admin' may create a new Operations or Super Admin login. The bearer token is
 * verified against Supabase Auth directly — a role claimed by the browser is never trusted.
 * Creation itself always uses the service-role key, which never reaches the client.
 */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Live account creation is not available in this deployment." }, { status: 500 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Sign in as Super Admin to create users." }, { status: 401 });

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await caller.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: "Unauthorised." }, { status: 401 });

  const { data: callerProfile, error: callerProfileError } = await caller
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();
  if (callerProfileError || callerProfile?.role !== "admin") {
    return NextResponse.json({ error: "Only Super Admin can create team users." }, { status: 403 });
  }

  const body = await request.json() as CreateUserBody;
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const role = body.role;

  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email) || !["operations", "admin"].includes(role || "")) {
    return NextResponse.json({ error: "Enter a valid name, email and role (operations or admin)." }, { status: 400 });
  }

  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const temporaryPassword = generateTemporaryPassword();

  const created = await admin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: name, role },
  });
  if (created.error) return NextResponse.json({ error: created.error.message }, { status: 400 });

  const profile = await admin.from("profiles").upsert({ id: created.data.user.id, full_name: name, role }, { onConflict: "id" });
  if (profile.error) return NextResponse.json({ error: profile.error.message }, { status: 500 });

  await admin.from("audit_logs").insert({
    actor_id: authData.user.id,
    actor_role: "admin",
    action: "created_team_user",
    entity_type: "profile",
    entity_id: created.data.user.id,
    after_data: { email, role },
  });

  return NextResponse.json({ userId: created.data.user.id, email, temporaryPassword });
}
