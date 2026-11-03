import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Pure logic mirrors from components/sheplates-v3.tsx
function formatTime12(timeStr) {
  if (!timeStr) return "";
  const parts = String(timeStr).split(":");
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || "0", 10);
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

function timeToMinutes(timeStr) {
  const parts = String(timeStr || "").split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function slotsOverlap(startA, endA, startB, endB) {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(startB) < timeToMinutes(endA);
}

function formatSlotLabel(slot) {
  return `${slot.slotName} (${formatTime12(slot.startTime)} - ${formatTime12(slot.endTime)})`;
}

function validateDeliverySlot({ slotName, startTime, endTime, isActive, slotId, existingSlots }) {
  const name = String(slotName || "").trim();
  if (!name) return { valid: false, error: "Slot name is required." };
  if (!startTime) return { valid: false, error: "Start time is required." };
  if (!endTime) return { valid: false, error: "End time is required." };
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    return { valid: false, error: "End time must be later than start time." };
  }
  const duplicate = existingSlots.find(
    (s) => s.id !== slotId && s.slotName.trim().toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    return { valid: false, error: `A delivery slot named "${duplicate.slotName}" already exists for your store.` };
  }
  if (isActive) {
    const conflicting = existingSlots.find(
      (s) => s.id !== slotId && s.isActive && slotsOverlap(startTime, endTime, s.startTime, s.endTime)
    );
    if (conflicting) {
      return {
        valid: false,
        error: `This time window overlaps with active slot "${conflicting.slotName}" (${formatTime12(conflicting.startTime)} - ${formatTime12(conflicting.endTime)}).`,
      };
    }
  }
  return { valid: true };
}

test("Vendor Delivery Slot - Time Utilities & Formatting", () => {
  assert.equal(formatTime12("09:00"), "09:00 AM");
  assert.equal(formatTime12("11:30"), "11:30 AM");
  assert.equal(formatTime12("12:00"), "12:00 PM");
  assert.equal(formatTime12("14:15"), "02:15 PM");
  assert.equal(formatTime12("18:00"), "06:00 PM");
  assert.equal(formatTime12("00:00"), "12:00 AM");

  assert.equal(timeToMinutes("09:00"), 540);
  assert.equal(timeToMinutes("11:00"), 660);
  assert.equal(timeToMinutes("12:30"), 750);

  const slot = { slotName: "Morning", startTime: "09:00", endTime: "11:00", isActive: true };
  assert.equal(formatSlotLabel(slot), "Morning (09:00 AM - 11:00 AM)");
});

test("Vendor Delivery Slot - Overlap Detection Logic", () => {
  // Overlapping
  assert.equal(slotsOverlap("09:00", "11:00", "10:00", "12:00"), true, "Partially overlapping intervals should overlap");
  assert.equal(slotsOverlap("09:00", "14:00", "10:00", "11:00"), true, "Contained interval should overlap");
  assert.equal(slotsOverlap("10:00", "11:00", "09:00", "14:00"), true, "Enclosing interval should overlap");

  // Non-overlapping (adjacent / abutted)
  assert.equal(slotsOverlap("09:00", "11:00", "11:00", "13:00"), false, "Adjacent intervals (11:00 boundary) should NOT overlap");
  assert.equal(slotsOverlap("11:00", "13:00", "09:00", "11:00"), false, "Adjacent reverse order should NOT overlap");

  // Completely disjoint
  assert.equal(slotsOverlap("08:00", "10:00", "14:00", "16:00"), false, "Disjoint intervals should NOT overlap");
});

test("Vendor Delivery Slot - Validation Logic", () => {
  const existing = [
    { id: "s1", vendorId: "v1", slotName: "Morning", startTime: "09:00", endTime: "11:00", isActive: true },
    { id: "s2", vendorId: "v1", slotName: "Evening", startTime: "16:00", endTime: "18:00", isActive: false },
  ];

  // Missing name
  const r1 = validateDeliverySlot({ slotName: "  ", startTime: "12:00", endTime: "14:00", isActive: true, existingSlots: existing });
  assert.equal(r1.valid, false);
  assert.match(r1.error, /Slot name is required/i);

  // Missing times
  const r2 = validateDeliverySlot({ slotName: "Lunch", startTime: "", endTime: "14:00", isActive: true, existingSlots: existing });
  assert.equal(r2.valid, false);
  assert.match(r2.error, /Start time is required/i);

  // End time earlier than start time
  const r3 = validateDeliverySlot({ slotName: "Lunch", startTime: "14:00", endTime: "12:00", isActive: true, existingSlots: existing });
  assert.equal(r3.valid, false);
  assert.match(r3.error, /End time must be later than start time/i);

  // End time equal to start time
  const r4 = validateDeliverySlot({ slotName: "Lunch", startTime: "12:00", endTime: "12:00", isActive: true, existingSlots: existing });
  assert.equal(r4.valid, false);
  assert.match(r4.error, /End time must be later than start time/i);

  // Duplicate name (case-insensitive)
  const r5 = validateDeliverySlot({ slotName: "morning", startTime: "12:00", endTime: "14:00", isActive: true, existingSlots: existing });
  assert.equal(r5.valid, false);
  assert.match(r5.error, /already exists/i);

  // Overlapping active slot (overlaps with Morning 09:00 - 11:00)
  const r6 = validateDeliverySlot({ slotName: "Brunch", startTime: "10:30", endTime: "12:00", isActive: true, existingSlots: existing });
  assert.equal(r6.valid, false);
  assert.match(r6.error, /overlaps with active slot "Morning"/i);

  // Overlapping with an INACTIVE slot (Evening 16:00 - 18:00 is inactive) -> Should be permitted!
  const r7 = validateDeliverySlot({ slotName: "Late Afternoon", startTime: "16:30", endTime: "17:30", isActive: true, existingSlots: existing });
  assert.equal(r7.valid, true, "Overlap with inactive slot is allowed");

  // Valid non-overlapping slot
  const r8 = validateDeliverySlot({ slotName: "Afternoon", startTime: "12:00", endTime: "14:00", isActive: true, existingSlots: existing });
  assert.equal(r8.valid, true);

  // Editing existing slot without changing name or time should not conflict with itself
  const r9 = validateDeliverySlot({ slotId: "s1", slotName: "Morning", startTime: "09:00", endTime: "11:00", isActive: true, existingSlots: existing });
  assert.equal(r9.valid, true, "Self edit should not trigger duplicate or overlap errors");
});

test("Database Migration File Integrity", () => {
  const migPath = path.resolve("supabase/migrations/20261102000100_vendor_delivery_slots.sql");
  assert.ok(fs.existsSync(migPath), "Migration file must exist");
  const sql = fs.readFileSync(migPath, "utf8");

  assert.ok(sql.includes("create table if not exists public.vendor_delivery_slots"), "Should create vendor_delivery_slots table");
  assert.ok(sql.includes("vendor_id uuid not null references public.vendors(id)"), "Should have foreign key to vendors");
  assert.ok(sql.includes("check (end_time > start_time)"), "Should have time check constraint");
  assert.ok(sql.includes("vendor_delivery_slots_vendor_name_uniq"), "Should enforce unique slot name per vendor");
  assert.ok(sql.includes("enable row level security"), "Should enable RLS");
  assert.ok(sql.includes("create policy vendor_delivery_slots_select"), "Should have select policy");
  assert.ok(sql.includes("create policy vendor_delivery_slots_insert"), "Should have insert policy");
  assert.ok(sql.includes("create policy vendor_delivery_slots_update"), "Should have update policy");
  assert.ok(sql.includes("create policy vendor_delivery_slots_delete"), "Should have delete policy");
});

test("Commerce API Route & UI Integration", () => {
  const routePath = path.resolve("app/api/commerce/route.ts");
  const routeCode = fs.readFileSync(routePath, "utf8");
  assert.ok(routeCode.includes('action === "save_delivery_slot"'), "Route must handle save_delivery_slot");
  assert.ok(routeCode.includes('action === "delete_delivery_slot"'), "Route must handle delete_delivery_slot");
  assert.ok(routeCode.includes('action === "toggle_delivery_slot"'), "Route must handle toggle_delivery_slot");
  assert.ok(routeCode.includes("vendor_delivery_slots"), "Route must query vendor_delivery_slots");

  const uiPath = path.resolve("components/sheplates-v3.tsx");
  const uiCode = fs.readFileSync(uiPath, "utf8");
  assert.ok(uiCode.includes("function DeliverySlotsSection("), "DeliverySlotsSection must be defined");
  assert.ok(uiCode.includes("Add Delivery Slot"), "Add Delivery Slot button must exist");
  assert.ok(uiCode.includes("formatSlotLabel"), "formatSlotLabel must be defined");
});

