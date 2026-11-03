// Taste Match Engine — a deterministic, explainable scoring model over a
// small fixed set of weighted "taste dimensions". AI may be used to *tag* a
// food item with these dimensions (see app/api/food-attributes/route.ts),
// but the match score itself is always a plain, auditable calculation over
// stored numbers — never a model call, never a random number.

export type TasteWeights = Record<string, number>;

export const TASTE_DIMENSIONS = [
  "spicy", "sweet", "tangy", "savory", "smoky", "crunchy", "creamy",
  "traditional", "healthy", "high_protein", "comfort_food", "street_food",
  "south_indian", "north_indian", "chinese", "continental", "bakery", "desserts",
  "vegetarian", "non_vegetarian", "vegan",
  "chicken", "seafood", "dairy", "rice_based",
] as const;
export type TasteDimension = (typeof TASTE_DIMENSIONS)[number];

export const TASTE_DIMENSION_LABELS: Record<TasteDimension, string> = {
  spicy: "Spicy", sweet: "Sweet", tangy: "Tangy", savory: "Savory", smoky: "Smoky",
  crunchy: "Crunchy", creamy: "Creamy", traditional: "Traditional", healthy: "Healthy",
  high_protein: "High Protein", comfort_food: "Comfort Food", street_food: "Street Food",
  south_indian: "South Indian", north_indian: "North Indian", chinese: "Chinese",
  continental: "Continental", bakery: "Bakery", desserts: "Desserts",
  vegetarian: "Vegetarian", non_vegetarian: "Non-Vegetarian", vegan: "Vegan",
  chicken: "Chicken", seafood: "Seafood", dairy: "Dairy", rice_based: "Rice-based",
};

/** The chip set shown in the quick "What tastes like you?" setup — a subset
 * of all dimensions, picked for being immediately meaningful to a first-time
 * user (the more niche/derived ones like rice_based are inferred from
 * behaviour instead of asked for directly). */
export const TASTE_SETUP_CHOICES: TasteDimension[] = [
  "spicy", "sweet", "tangy", "savory", "smoky", "crunchy", "creamy", "traditional",
  "healthy", "high_protein", "comfort_food", "street_food", "south_indian", "north_indian",
  "chinese", "continental", "bakery", "desserts", "vegetarian", "non_vegetarian", "vegan",
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** How strongly each implicit/explicit signal moves a customer's weights,
 * and in which direction. An order is a much stronger signal than a view;
 * a single skip barely moves anything — matching the "don't overreact to one
 * interaction" requirement. */
export type TasteSignal = "view" | "save" | "like" | "follow_vendor" | "order" | "repeat_order" | "more_like_this" | "less_like_this" | "skip";
export const SIGNAL_LEARNING_RATE: Record<TasteSignal, number> = {
  view: 0.03,
  save: 0.08,
  like: 0.08,
  follow_vendor: 0.05,
  order: 0.16,
  repeat_order: 0.22,
  more_like_this: 0.2,
  less_like_this: -0.2,
  skip: -0.03,
};

/** Applies one taste signal (e.g. a customer ordered, or tapped "More like
 * this") to a product to the customer's existing weight vector, returning a
 * new vector. Pure function — no I/O, fully unit-testable. Dimensions the
 * product barely has (<0.2) are ignored as noise. Positive signals pull a
 * dimension's weight up toward 1 proportional to how far it still has to go;
 * negative signals pull it down proportional to how high it currently is —
 * both converge smoothly instead of overshooting on a single event. */
export function applyTasteSignal(current: TasteWeights, productAttributes: TasteWeights, signal: TasteSignal): TasteWeights {
  const rate = SIGNAL_LEARNING_RATE[signal] ?? 0;
  if (!rate) return current;
  const next: TasteWeights = { ...current };
  for (const [dimension, strength] of Object.entries(productAttributes)) {
    if (strength < 0.2) continue;
    const existing = next[dimension] ?? 0.3;
    next[dimension] = rate > 0
      ? clamp01(existing + rate * strength * (1 - existing))
      : clamp01(existing + rate * strength * existing);
  }
  return next;
}

export type TasteMatchResult = {
  score: number; // 0-100
  contributions: { dimension: string; value: number }[]; // sorted, strongest first
};

/** Cosine similarity between the customer's weight vector and the product's
 * attribute vector, restricted to dimensions the product actually has (an
 * item with no tagged dimensions in common with the customer's profile
 * scores 0, not an arbitrary number). Returns 0 for a customer with no taste
 * profile yet — callers should treat that as "not enough data", not "0%
 * match", and hide the badge rather than show a discouraging number. */
export function tasteMatchScore(customerWeights: TasteWeights, productAttributes: TasteWeights): TasteMatchResult {
  const dims = Object.keys(productAttributes);
  let dot = 0, productMagnitude = 0, customerMagnitude = 0;
  const contributions: { dimension: string; value: number }[] = [];
  for (const dimension of dims) {
    const c = customerWeights[dimension] ?? 0;
    const p = productAttributes[dimension];
    dot += c * p;
    productMagnitude += p * p;
    if (c > 0) contributions.push({ dimension, value: c * p });
  }
  for (const c of Object.values(customerWeights)) customerMagnitude += c * c;
  const denom = Math.sqrt(customerMagnitude) * Math.sqrt(productMagnitude);
  const raw = denom > 0 ? dot / denom : 0;
  contributions.sort((a, b) => b.value - a.value);
  return { score: Math.round(clamp01(raw) * 100), contributions };
}

/** Turns a raw setup selection (a handful of chosen dimensions) into a
 * starting weight vector — chosen dimensions start meaningfully high but not
 * maxed out, so real behaviour can still refine them either way. */
export function weightsFromSetupChoices(choices: string[]): TasteWeights {
  const weights: TasteWeights = {};
  for (const dimension of choices) weights[dimension] = 0.75;
  return weights;
}

// --- Deterministic fallback attribute inference -----------------------
// Used when the AI classification route is unavailable (no OPENAI_API_KEY,
// or the call fails) so a product always has *some* reasonable attributes
// rather than none. Keyword-matched against the product's own name/category
// — no network call, same result every time for the same input.
const CATEGORY_BASE_ATTRIBUTES: Record<string, TasteWeights> = {
  "Milk & dairy": { dairy: 0.9, creamy: 0.6, vegetarian: 0.9, healthy: 0.5 },
  "Home food": { traditional: 0.7, comfort_food: 0.7, south_indian: 0.5 },
  "Meat & fish": { non_vegetarian: 0.9, savory: 0.6, high_protein: 0.7 },
  Vegetables: { vegetarian: 0.95, healthy: 0.85, vegan: 0.6 },
  Groceries: { traditional: 0.4 },
  Eggs: { non_vegetarian: 0.4, high_protein: 0.6, vegetarian: 0.3 },
  Bakery: { bakery: 0.9, sweet: 0.55, comfort_food: 0.5 },
  "Rice & staples": { rice_based: 0.8, traditional: 0.6, vegetarian: 0.6 },
};
const NAME_KEYWORD_ATTRIBUTES: [RegExp, TasteWeights][] = [
  [/biryani/i, { spicy: 0.7, rice_based: 0.85, south_indian: 0.55, comfort_food: 0.6 }],
  [/(sambar|idly|idli|dosa|uttapam)/i, { south_indian: 0.9, traditional: 0.85, healthy: 0.4 }],
  [/chicken/i, { chicken: 0.9, non_vegetarian: 0.9, high_protein: 0.6 }],
  [/(fish|rohu|prawn|shrimp)/i, { seafood: 0.9, non_vegetarian: 0.9, high_protein: 0.5 }],
  [/mutton/i, { non_vegetarian: 0.9, savory: 0.6, high_protein: 0.5 }],
  [/(sweet|brownie|dessert|cake|halwa)/i, { desserts: 0.85, sweet: 0.85, comfort_food: 0.4 }],
  [/(spicy|chilli|chili|masala)/i, { spicy: 0.8 }],
  [/(millet|salad|healthy|multigrain)/i, { healthy: 0.85, vegetarian: 0.6 }],
  [/(paneer|curd|milk|ghee)/i, { dairy: 0.8, vegetarian: 0.9, creamy: 0.5 }],
  [/(oil|flour|sugar|dal|rice|tea)/i, { traditional: 0.4 }],
  [/(tomato|onion|carrot|vegetable)/i, { vegetarian: 0.9, healthy: 0.75, vegan: 0.6 }],
];

export function inferAttributesLocally(name: string, category: string): TasteWeights {
  const attributes: TasteWeights = { ...(CATEGORY_BASE_ATTRIBUTES[category] || {}) };
  for (const [pattern, boost] of NAME_KEYWORD_ATTRIBUTES) {
    if (!pattern.test(name)) continue;
    for (const [dimension, value] of Object.entries(boost)) {
      attributes[dimension] = Math.max(attributes[dimension] ?? 0, value);
    }
  }
  if (!Object.keys(attributes).length) attributes.traditional = 0.3;
  return attributes;
}
