import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const accounts = [
  { email: "customer@sheplates.demo", password: "Customer@123", fullName: "Karthikeyan A", role: "customer" },
  { email: "vendor@sheplates.demo", password: "Vendor@123", fullName: "Murugan", role: "vendor" },
  { email: "newvendor@sheplates.demo", password: "NewVendor@123", fullName: "Malar", role: "vendor" },
  { email: "operations@sheplates.demo", password: "Operations@123", fullName: "Nandhini", role: "operations" },
  { email: "admin@sheplates.demo", password: "Admin@123", fullName: "Karthikeyan A", role: "admin" },
];

const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listed.error) throw listed.error;

for (const account of accounts) {
  let user = listed.data.users.find((candidate) => candidate.email?.toLowerCase() === account.email.toLowerCase());
  if (user) {
    const updated = await supabase.auth.admin.updateUserById(user.id, {
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.fullName, role: account.role === "vendor" ? "vendor" : "customer" },
    });
    if (updated.error) throw updated.error;
    user = updated.data.user;
  } else {
    const created = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.fullName, role: account.role === "vendor" ? "vendor" : "customer" },
    });
    if (created.error) throw created.error;
    user = created.data.user;
  }

  const profile = await supabase.from("profiles").upsert({ id: user.id, full_name: account.fullName, role: account.role }, { onConflict: "id" }).select("id,role").single();
  if (profile.error) throw profile.error;
  if (profile.data.role !== account.role) throw new Error(`Profile role verification failed for ${account.email}`);

  process.stdout.write(`Created/updated ${account.email} as ${account.role}\n`);
}

process.stdout.write("ShePlates V3 test identities are ready. No vendor, product, order, quote or schedule data was seeded.\n");
