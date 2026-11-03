import { createClient } from "@supabase/supabase-js";

const REQUIRED_CONFIRMATION = "DELETE_ALL_SHEPLATES_DATA";
const confirmation = process.argv.find((argument) => argument.startsWith("--confirm="))?.split("=")[1];

if (confirmation !== REQUIRED_CONFIRMATION) {
  throw new Error(
    `Destructive reset blocked. Re-run with --confirm=${REQUIRED_CONFIRMATION} after running supabase/V3_FULL_DEVELOPMENT_RESET.sql.`,
  );
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Storage objects must be removed through the Storage API. Keep the buckets and
// their policies so the application remains ready for fresh uploads.
const sheplatesBuckets = new Set(["vendor-certificates", "customer-requirements"]);
const bucketsResult = await supabase.storage.listBuckets();
if (bucketsResult.error) throw bucketsResult.error;

for (const bucket of bucketsResult.data || []) {
  if (!sheplatesBuckets.has(bucket.id)) continue;
  const emptied = await supabase.storage.emptyBucket(bucket.id);
  if (emptied.error) throw emptied.error;
  process.stdout.write(`Emptied Storage bucket ${bucket.id}\n`);
}

let deletedUsers = 0;

// Always request page 1 because the collection shrinks after every batch.
while (true) {
  const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) throw listed.error;
  if (!listed.data.users.length) break;

  for (const user of listed.data.users) {
    const deleted = await supabase.auth.admin.deleteUser(user.id, false);
    if (deleted.error) throw deleted.error;
    deletedUsers += 1;
    process.stdout.write(`Deleted Auth user ${user.email || user.id}\n`);
  }
}

process.stdout.write(`ShePlates reset complete: ${deletedUsers} Auth user(s) deleted.\n`);
process.stdout.write("Next: npm run supabase:create-staff-users\n");
