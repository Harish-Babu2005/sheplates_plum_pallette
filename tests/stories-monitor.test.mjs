import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (file) => readFile(path.join(root, file), "utf8");

test("the Stories monitor migration is staff-only and leaves the new tables closed to direct access", async () => {
  const sql = await read("supabase/migrations/20261103000100_stories_monitor.sql");
  assert.equal(sql, await read("supabase/V9_13_STORIES_MONITOR.sql"), "the editor copy matches the migration");
  for (const table of ["status_reports", "status_moderation_log"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.doesNotMatch(sql, /create policy/i, "no direct policies: access only through the functions");
  assert.match(sql, /public\.current_app_role\(\) not in \('operations', 'admin'\)/);
  for (const fn of ["stories_monitor_summary", "monitor_statuses", "remove_status", "keep_status", "monitor_food_shorts", "set_food_short_status"]) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}`));
    assert.match(sql, /perform public\.assert_stories_staff\(\)|assert_stories_staff\(\)/);
  }
  assert.match(sql, /report_status[\s\S]*current_app_role\(\) <> 'customer'/, "only customers report");
  assert.match(sql, /You cannot report your own status/);
  assert.match(sql, /insert into public\.notifications[\s\S]*Your status was removed/, "the author is told why");
});

test("the monitor page, the report button and the menus are wired", async () => {
  const page = await read("components/staff/stories-monitor.tsx");
  const lib = await read("lib/stories-monitor.ts");
  const app = await read("components/sheplates-v3.tsx");
  const viewer = await read("components/customer-v2/status.tsx");
  assert.match(lib, /rpc\("remove_status"/);
  assert.match(lib, /status-media/);
  assert.match(page, /Customer statuses/);
  assert.match(page, /Vendor Food Shorts/);
  assert.match(app, /"Reports", "Stories monitor", "Ticket centre"\]/);
  assert.equal((app.match(/<StoriesMonitor \/>/g) || []).length, 2, "both Operations and Super Admin open it");
  assert.match(viewer, /Report this status/);
});

test("V9_14 SQL is staff-only and the app wires the three audit and note features", async () => {
  const { readFileSync } = await import("node:fs");
  const sql = readFileSync(new URL("../supabase/V9_14_AUDIT_VIEWS_AND_VENDOR_NOTES.sql", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../supabase/migrations/20261103000200_audit_views_and_vendor_notes.sql", import.meta.url), "utf8");
  assert.equal(sql, migration);
  assert.match(sql, /not in \('operations', 'admin'\)/);
  for (const fn of ["log_customer_data_view", "audit_trail", "send_vendor_note"]) assert.match(sql, new RegExp(`function public\\.${fn}`));
  const app = readFileSync(new URL("../components/sheplates-v3.tsx", import.meta.url), "utf8");
  assert.match(app, /logCustomerView\(email, "Users"\)/);
  assert.match(app, /Note to the vendor/);
  assert.match(app, /Send the vendor an invitation email/);
  const route = readFileSync(new URL("../app/api/admin/invite-vendor/route.ts", import.meta.url), "utf8");
  assert.match(route, /operations/);
  assert.match(route, /inviteUserByEmail/);
});
