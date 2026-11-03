// Realistic sample data for exercising the customer portal in DEMO mode (no
// database): six vendors around Coimbatore, 19 products, a paid-order history,
// recurring subscriptions and four live Food Drops. Built relative to "now" so
// drops are always live. Used by playwright.demo.config.ts specs only.
const iso = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const day = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

export const DEMO_CUSTOMER = { email: "customer@sheplates.demo", name: "Raj" };

export function buildDemoState() {
  const vendor = (id: string, businessName: string, category: string, latitude: number, longitude: number, address: string, extra: Record<string, unknown> = {}) => ({
    id, ownerEmail: `${id}@sheplates.demo`, ownerName: businessName, businessName, category, address, latitude, longitude, radiusKm: 10, delivery: true, pickup: true,
    openToday: true, fssaiNumber: "Verified", certificateName: "cert.pdf", expiryDate: "2027-12-31", verification: "Verified", operational: "Active", plan: "Crown", ...extra,
  });
  const vendors = [
    vendor("v-meena", "Meena's Home Kitchen", "Home food", 11.0431, 76.9805, "RS Puram, Coimbatore, Tamil Nadu 641002"),
    vendor("v-abc", "ABC Bakery", "Bakery", 11.0362, 76.9741, "Race Course, Coimbatore, Tamil Nadu 641018"),
    vendor("v-kumar", "Kumar Dairy", "Milk & dairy", 11.0489, 76.9794, "Saibaba Colony, Coimbatore, Tamil Nadu 641011", { pickup: false }),
    vendor("v-fresh", "Fresh Farm", "Vegetables", 10.9983, 76.9331, "Ukkadam, Coimbatore, Tamil Nadu 641008"),
    vendor("v-siva", "Siva Meats", "Meat & fish", 11.0551, 76.9902, "Ganapathy, Coimbatore, Tamil Nadu 641006"),
    vendor("v-ram", "Ram Provisions", "Groceries", 11.0262, 76.9655, "Gandhipuram, Coimbatore, Tamil Nadu 641012"),
  ];
  let n = 0;
  const product = (vendorId: string, name: string, category: string, baseUnit: string, vendorPrice: number, calories = 320, protein = 12) => ({
    id: `p-${++n}`, vendorId, name, category, emoji: "🍽️", baseUnit, quantityStep: 1, vendorPrice, stock: 40, active: true, calories, protein, carbs: 40, fat: 10, fibre: 3, dietaryTags: [], nutritionStatus: "Estimated",
  });
  const products = [
    product("v-meena", "Mini Meals", "Home food", "1 complete meal", 120, 520, 18), product("v-meena", "Variety Rice", "Home food", "1 portion", 100, 430), product("v-meena", "Sambar Rice", "Home food", "1 portion", 90, 400),
    product("v-meena", "Curd Rice", "Home food", "1 portion", 80, 280, 7), product("v-meena", "Chicken Biryani", "Home food", "1 meal", 160, 650, 28), product("v-meena", "Idli Sambar", "Home food", "1 complete meal", 60, 310),
    product("v-abc", "Fresh Croissants", "Bakery", "pack of 6", 130, 420), product("v-abc", "Truffle Pasta", "Home food", "1 portion", 190, 580), product("v-abc", "Whole Wheat Bread", "Bakery", "1 loaf", 55, 240),
    product("v-kumar", "Cow Milk", "Milk & dairy", "1 litre pouch", 62, 610, 32), product("v-kumar", "Paneer", "Milk & dairy", "200 g pack", 90, 330, 18), product("v-kumar", "Curd", "Milk & dairy", "500 g cup", 45, 210),
    product("v-fresh", "Mixed Fruit Box", "Vegetables", "1 kg box", 100, 180), product("v-fresh", "Tomato", "Vegetables", "1 kg pack", 40, 18), product("v-fresh", "Carrot", "Vegetables", "500 g pack", 25, 41),
    product("v-siva", "Chicken Curry Cut", "Meat & fish", "1 kg pack", 240, 1650, 220), product("v-siva", "Rohu Fish", "Meat & fish", "1 kg pack", 260, 1100, 190),
    product("v-ram", "Basmati Rice", "Rice & staples", "5 kg bag", 420, 130, 3), product("v-ram", "Sunflower Oil", "Groceries", "1 litre pouch", 145, 884, 0),
  ];
  const named = (name: string) => products.find((p) => p.name === name)!;
  const order = (vendorId: string, productName: string, offsetDays: number, status = "Completed", quantity = 1) => {
    const p = named(productName);
    return { id: `ORD-${vendorId}-${++n}`, customerEmail: DEMO_CUSTOMER.email, vendorId, productId: p.id, description: p.name, quantity, unit: p.baseUnit, total: p.vendorPrice * quantity, date: day(offsetDays), slot: "07:00–08:00 AM", mode: "Vendor delivery", status, payment: "Paid" };
  };
  const orders = [
    order("v-meena", "Mini Meals", 0, "Preparing"), order("v-kumar", "Cow Milk", 0, "Out for delivery", 2), order("v-meena", "Chicken Biryani", -3), order("v-meena", "Idli Sambar", -6),
    order("v-abc", "Fresh Croissants", -4), order("v-kumar", "Curd", -5), order("v-fresh", "Mixed Fruit Box", -10), order("v-ram", "Basmati Rice", -14), order("v-siva", "Chicken Curry Cut", -11),
  ];
  const schedule = (id: string, vendorId: string, productName: string, recurrence: string, weekdays: string[], timeSlot: string, quantity: number) => {
    const p = named(productName);
    return { id, customerEmail: DEMO_CUSTOMER.email, productId: p.id, vendorId, startDate: day(-14), endDate: "", recurrence, weekdays, timeSlot, quantity, unit: p.baseUnit, mode: "Vendor delivery", estimatedOccurrences: 20, status: "Active", nextDeliveryAt: day(1) };
  };
  const schedules = [schedule("SCH-1", "v-meena", "Mini Meals", "Custom", ["Mon", "Tue", "Wed", "Thu", "Fri"], "12:30–01:30 PM", 1), schedule("SCH-2", "v-kumar", "Cow Milk", "Daily", [], "06:00–07:00 AM", 2)];
  const drop = (id: string, vendorId: string, productName: string, title: string, dropPrice: number, totalQuantity: number, remainingQuantity: number, endsInMinutes: number, description: string) =>
    ({ id, vendorId, productId: named(productName).id, title, description, dropPrice, originalPrice: named(productName).vendorPrice, totalQuantity, remainingQuantity, startsAt: iso(-60), endsAt: iso(endsInMinutes), status: "active" });
  const foodDrops = [
    drop("d1", "v-abc", "Fresh Croissants", "Fresh Croissants (Surplus)", 99, 12, 5, 42, "Surplus from this morning's bake"),
    drop("d2", "v-meena", "Chicken Biryani", "Chicken Biryani (Today's Surplus)", 129, 10, 3, 75, "Surplus lunch batch"),
    drop("d3", "v-fresh", "Mixed Fruit Box", "Mixed Fruit Box (Slightly Blemished)", 80, 15, 5, 35, "Slightly blemished, fully fresh inside"),
    drop("d4", "v-kumar", "Paneer", "Fresh Paneer — Limited Batch", 70, 20, 14, 180, "Small batch made this morning"),
  ];
  return {
    customers: [{ email: DEMO_CUSTOMER.email, address: "RS Puram, Coimbatore, Coimbatore North, Tamil Nadu, 641002, India", latitude: 11.0392, longitude: 76.9778, householdSize: 3, diet: "No preference", allergies: [], goals: [], dislikes: "", onboardingComplete: true, phone: "", agentMemory: {} }],
    vendors, products, schedules, orders, staff: [], assignments: [], requirements: [], quotes: [], markups: {}, notifications: [], cancellations: [], audit: [], cart: [], tickets: [], transactions: [], staffAccounts: [], campaigns: [],
    merchandising: { featuredProductIds: [], recommendationPopupEnabled: true, maxFeatured: 6 }, wishlist: [], reviews: [],
    tasteProfiles: [{ customerEmail: DEMO_CUSTOMER.email, weights: { comfort_food: 0.8, spicy: 0.6, south_indian: 0.7 }, onboarded: true }], productAttributes: {}, foodDrops, foodDropClaims: [],
    deliverySlots: [
      { id: "slot-meena-1", vendorId: "v-meena", slotName: "Morning", startTime: "09:00", endTime: "11:00", isActive: true },
      { id: "slot-meena-2", vendorId: "v-meena", slotName: "Afternoon", startTime: "12:00", endTime: "14:00", isActive: true },
      { id: "slot-meena-3", vendorId: "v-meena", slotName: "Evening", startTime: "16:00", endTime: "18:00", isActive: true },
    ],
  };
}
