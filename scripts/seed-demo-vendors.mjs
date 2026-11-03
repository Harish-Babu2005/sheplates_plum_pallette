// Seeds a realistic, spread-out set of test vendors around Coimbatore so the
// interactive nearby-vendors map and its radius control actually have
// something to demonstrate: several distances, a mix of delivery/pickup-only
// vendors, and enough products that they show up in the customer marketplace.
// Idempotent — safe to re-run; it upserts by vendor id / (vendor_id, name).
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
}
const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

// customer@sheplates.demo's saved delivery pin (Ganapathy, Coimbatore).
const CUSTOMER_LAT = 11.0383247;
const CUSTOMER_LNG = 76.9780717;

async function ensureVendorOwner(email, password, fullName) {
  const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) throw listed.error;
  let user = listed.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (user) {
    const updated = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    if (updated.error) throw updated.error;
    user = updated.data.user;
  } else {
    const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName, role: "vendor" } });
    if (created.error) throw created.error;
    user = created.data.user;
  }
  const profile = await supabase.from("profiles").upsert({ id: user.id, full_name: fullName, role: "vendor" }, { onConflict: "id" }).select("id").single();
  if (profile.error) throw profile.error;
  return user.id;
}

async function upsertVendor(ownerId, vendor) {
  const existing = await supabase.from("vendors").select("id").eq("owner_id", ownerId).eq("name", vendor.name).maybeSingle();
  if (existing.error) throw existing.error;
  const row = {
    owner_id: ownerId, name: vendor.name, category: vendor.category, locality: vendor.locality,
    latitude: vendor.latitude, longitude: vendor.longitude, service_radius_km: vendor.radiusKm,
    delivery_enabled: vendor.delivery, pickup_enabled: vendor.pickup,
    verification_status: "verified", operational_status: "active", marketplace_visible: true, store_open_today: true,
  };
  let vendorId;
  if (existing.data) {
    vendorId = existing.data.id;
    const updated = await supabase.from("vendors").update(row).eq("id", vendorId);
    if (updated.error) throw updated.error;
  } else {
    const created = await supabase.from("vendors").insert(row).select("id").single();
    if (created.error) throw created.error;
    vendorId = created.data.id;
  }
  const linked = await supabase.from("profiles").update({ vendor_id: vendorId }).eq("id", ownerId);
  if (linked.error) throw linked.error;
  return vendorId;
}

async function upsertProducts(vendorId, products) {
  for (const p of products) {
    const existing = await supabase.from("vendor_menu_items").select("id").eq("vendor_id", vendorId).eq("name", p.name).maybeSingle();
    if (existing.error) throw existing.error;
    const row = {
      vendor_id: vendorId, name: p.name, category: p.category, unit: p.unit,
      vendor_base_price: p.price, quantity_step: p.step ?? 1, stock_quantity: p.stock ?? 50,
      calories_per_unit: p.calories, protein_g: p.protein, carbs_g: p.carbs, fat_g: p.fat, fibre_g: p.fibre ?? 1,
      pack_amount: p.packAmount, pack_measure: p.packMeasure, active: true,
    };
    if (existing.data) {
      const updated = await supabase.from("vendor_menu_items").update(row).eq("id", existing.data.id);
      if (updated.error) throw updated.error;
    } else {
      const created = await supabase.from("vendor_menu_items").insert(row);
      if (created.error) throw created.error;
    }
  }
}

// ~2.78km N + ~1.64km E of the customer.
const MALAR_LAT = CUSTOMER_LAT + 0.025, MALAR_LNG = CUSTOMER_LNG + 0.015;
// ~4.45km S + ~4.9km W — outside a 5km default radius, inside 10km.
const ASHWIN_LAT = CUSTOMER_LAT - 0.04, ASHWIN_LNG = CUSTOMER_LNG - 0.045;
// ~11.1km S + ~4.4km W — outside the default 10km radius, needs it widened.
const UKKADAM_LAT = CUSTOMER_LAT - 0.10, UKKADAM_LNG = CUSTOMER_LNG - 0.04;

async function main() {
  // 1. Fix the three existing verified vendors that have zero products (so
  //    they were never actually visible in the marketplace or on the map
  //    despite showing "Verified" in Admin) and were also marked closed today.
  const existingFixes = [
    { name: "Murugan Daily Foods", products: [
      { name: "Basmati rice", category: "Groceries", unit: "5 kg bag", price: 420, calories: 130, protein: 2.7, carbs: 28, fat: 0.3, packAmount: 5, packMeasure: "kg" },
      { name: "Toor dal", category: "Groceries", unit: "1 kg pack", price: 165, calories: 343, protein: 22, carbs: 63, fat: 1.5, packAmount: 1, packMeasure: "kg" },
      { name: "Sunflower oil", category: "Groceries", unit: "1 litre pouch", price: 145, calories: 884, protein: 0, carbs: 0, fat: 100, packAmount: 1, packMeasure: "litre" },
    ]},
    { name: "Ram foods", products: [
      { name: "Wheat flour (Atta)", category: "Rice & staples", unit: "5 kg bag", price: 245, calories: 340, protein: 12, carbs: 71, fat: 1.7, packAmount: 5, packMeasure: "kg" },
      { name: "Sugar", category: "Groceries", unit: "1 kg pack", price: 52, calories: 387, protein: 0, carbs: 100, fat: 0, packAmount: 1, packMeasure: "kg" },
      { name: "Tea powder", category: "Groceries", unit: "250 g pack", price: 110, calories: 1, protein: 0, carbs: 0.3, fat: 0, packAmount: 250, packMeasure: "g" },
    ]},
    { name: "Siva Foods", products: [
      { name: "Chicken curry cut", category: "Meat & fish", unit: "1 kg pack", price: 240, calories: 239, protein: 27, carbs: 0, fat: 14, packAmount: 1, packMeasure: "kg" },
      { name: "Rohu fish", category: "Meat & fish", unit: "1 kg pack", price: 260, calories: 97, protein: 17, carbs: 0, fat: 3, packAmount: 1, packMeasure: "kg" },
      { name: "Mutton", category: "Meat & fish", unit: "500 g pack", price: 380, calories: 294, protein: 25, carbs: 0, fat: 21, packAmount: 500, packMeasure: "g" },
    ]},
  ];
  for (const fix of existingFixes) {
    const vendor = await supabase.from("vendors").select("id").eq("name", fix.name).maybeSingle();
    if (vendor.error) throw vendor.error;
    if (!vendor.data) { console.log(`Skipping ${fix.name} — not found.`); continue; }
    const opened = await supabase.from("vendors").update({ store_open_today: true }).eq("id", vendor.data.id);
    if (opened.error) throw opened.error;
    await upsertProducts(vendor.data.id, fix.products);
    console.log(`Fixed ${fix.name}: opened today, ${fix.products.length} product(s) added/updated.`);
  }

  // 2. New vendors spread across Coimbatore at meaningfully different distances.
  const malarOwner = await ensureVendorOwner("newvendor@sheplates.demo", "NewVendor@123", "Malar");
  const malarId = await upsertVendor(malarOwner, {
    name: "Malar's Kitchen", category: "Home food", locality: "RS Puram, Coimbatore",
    latitude: MALAR_LAT, longitude: MALAR_LNG, radiusKm: 8, delivery: true, pickup: true,
  });
  await upsertProducts(malarId, [
    { name: "Veg meals", category: "Home food", unit: "1 portion", price: 90, calories: 520, protein: 14, carbs: 78, fat: 12, packAmount: 1, packMeasure: "portion" },
    { name: "Chicken biryani", category: "Home food", unit: "1 meal", price: 160, calories: 650, protein: 28, carbs: 82, fat: 20, packAmount: 1, packMeasure: "meal" },
    { name: "Curd rice", category: "Home food", unit: "1 portion", price: 60, calories: 280, protein: 7, carbs: 50, fat: 5, packAmount: 1, packMeasure: "portion" },
  ]);
  console.log(`Malar's Kitchen ready (~${haversine(CUSTOMER_LAT, CUSTOMER_LNG, MALAR_LAT, MALAR_LNG).toFixed(1)} km away, delivery + pickup).`);

  const ashwinOwner = await ensureVendorOwner("ashwin.vendor@sheplates.demo", "Ashwin@123", "Ashwin");
  const ashwinId = await upsertVendor(ashwinOwner, {
    name: "Ashwin Fresh Mart", category: "Vegetables", locality: "Peelamedu, Coimbatore",
    latitude: ASHWIN_LAT, longitude: ASHWIN_LNG, radiusKm: 10, delivery: false, pickup: true,
  });
  await upsertProducts(ashwinId, [
    { name: "Tomato", category: "Vegetables", unit: "1 kg pack", price: 40, calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, packAmount: 1, packMeasure: "kg" },
    { name: "Onion", category: "Vegetables", unit: "1 kg pack", price: 35, calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, packAmount: 1, packMeasure: "kg" },
    { name: "Carrot", category: "Vegetables", unit: "500 g pack", price: 25, calories: 41, protein: 0.9, carbs: 10, fat: 0.2, packAmount: 500, packMeasure: "g" },
  ]);
  console.log(`Ashwin Fresh Mart ready (~${haversine(CUSTOMER_LAT, CUSTOMER_LNG, ASHWIN_LAT, ASHWIN_LNG).toFixed(1)} km away, pickup only).`);

  const ukkadamOwner = await ensureVendorOwner("ukkadam.vendor@sheplates.demo", "Ukkadam@123", "Siva");
  const ukkadamId = await upsertVendor(ukkadamOwner, {
    name: "Ukkadam Dairy Farm", category: "Milk & dairy", locality: "Ukkadam, Coimbatore",
    latitude: UKKADAM_LAT, longitude: UKKADAM_LNG, radiusKm: 15, delivery: true, pickup: false,
  });
  await upsertProducts(ukkadamId, [
    { name: "Cow milk", category: "Milk & dairy", unit: "1 litre pouch", price: 62, calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, packAmount: 1, packMeasure: "litre" },
    { name: "Paneer", category: "Milk & dairy", unit: "200 g pack", price: 90, calories: 265, protein: 18, carbs: 3.4, fat: 20, packAmount: 200, packMeasure: "g" },
    { name: "Curd", category: "Milk & dairy", unit: "500 g cup", price: 45, calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3, packAmount: 500, packMeasure: "g" },
  ]);
  console.log(`Ukkadam Dairy Farm ready (~${haversine(CUSTOMER_LAT, CUSTOMER_LNG, UKKADAM_LAT, UKKADAM_LNG).toFixed(1)} km away, delivery only, needs radius >= 12 km).`);

  console.log("\nDone. Reload the marketplace as customer@sheplates.demo and open the Map to see all vendors spread across Coimbatore.");
}

function haversine(aLat, aLng, bLat, bLng) {
  const rad = (v) => (v * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

main().catch((error) => { console.error(error); process.exit(1); });
