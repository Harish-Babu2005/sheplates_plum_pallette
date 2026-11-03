import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const staffAccounts = [
  {
    email: process.env.SHEPLATES_OPERATIONS_EMAIL || "operations@sheplates.demo",
    password: process.env.SHEPLATES_OPERATIONS_PASSWORD || "Operations@123",
    fullName: process.env.SHEPLATES_OPERATIONS_NAME || "Nandhini",
    role: "operations",
  },
  {
    email: process.env.SHEPLATES_ADMIN_EMAIL || "admin@sheplates.demo",
    password: process.env.SHEPLATES_ADMIN_PASSWORD || "Admin@123",
    fullName: process.env.SHEPLATES_ADMIN_NAME || "Karthikeyan A",
    role: "admin",
  },
];

const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listed.error) throw listed.error;

for (const account of staffAccounts) {
  let user = listed.data.users.find((candidate) => candidate.email?.toLowerCase() === account.email);
  if (user) {
    const updated = await supabase.auth.admin.updateUserById(user.id, {
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.fullName, role: "customer" },
    });
    if (updated.error) throw updated.error;
    user = updated.data.user;
  } else {
    const created = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.fullName, role: "customer" },
    });
    if (created.error) throw created.error;
    user = created.data.user;
  }

  const profile = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: account.fullName,
    role: account.role,
    vendor_id: null,
  }, { onConflict: "id" }).select("id,role").single();
  if (profile.error) throw profile.error;
  if (profile.data.role !== account.role) throw new Error(`Profile role verification failed for ${account.email}`);
  process.stdout.write(`Created/updated ${account.email} as ${account.role}\n`);
}

process.stdout.write("Operations and Super Admin credentials are ready. No customer or vendor account was created.\n");
