// The ten shopping groups on the redesigned Marketplace. Each group maps onto
// the catalogue categories that already exist; groups with no matching
// categories yet (Ready to Cook, Snacks, Beverages, Premium & Artisan) simply
// show an empty state until vendors can list in them.
export const MARKET_GROUPS = [
  { key: "Ready to Cook", emoji: "🍳", tint: "#fff0e6", match: ["Ready to cook"] },
  { key: "Meals", emoji: "🍛", tint: "#ffe9ef", match: ["Home food", "Caterer"] },
  { key: "Meat & Seafood", emoji: "🍗", tint: "#ffe5e5", match: ["Meat & fish", "Eggs"] },
  { key: "Vegetables & Fruits", emoji: "🥦", tint: "#e8f6e8", match: ["Vegetables"] },
  { key: "Grocery & Staples", emoji: "🛍️", tint: "#f1eaff", match: ["Groceries", "Rice & staples"] },
  { key: "Bakery & Desserts", emoji: "🥐", tint: "#fbeee0", match: ["Bakery"] },
  { key: "Home Foods", emoji: "🏠", tint: "#fff3d9", match: ["Home food", "Bakery"] },
  { key: "Beverages & Dairy", emoji: "🥛", tint: "#e8f3ff", match: ["Milk & dairy", "Beverages"] },
  { key: "Snacks", emoji: "🍿", tint: "#fff6d6", match: ["Snacks"] },
  { key: "Premium & Artisan", emoji: "✨", tint: "#f4ecff", match: ["Premium & artisan"] },
] as const;

/** True when a product category belongs to the selected group, or equals a plain category name. */
export function groupMatches(selected: string, productCategory: string) {
  if (selected === "All") return true;
  const group = MARKET_GROUPS.find((g) => g.key === selected);
  return group ? (group.match as readonly string[]).includes(productCategory) : selected === productCategory;
}
