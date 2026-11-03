export type Nutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
};

type Basis = Nutrition & { basisAmount: number; basisUnit: "g" | "ml" | "piece" | "meal" | "portion" | "pack" };

const round = (value: number) => Math.round(value * 10) / 10;

function basisFor(productName: string, category: string): Basis {
  const name = productName.toLowerCase();

  if (name.includes("milk")) return { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, fibre: 0, basisAmount: 100, basisUnit: "ml" };
  if (name.includes("curd") || name.includes("yogurt")) return { calories: 61, protein: 3.5, carbs: 4.7, fat: 3.3, fibre: 0, basisAmount: 100, basisUnit: "g" };
  if (name.includes("paneer")) return { calories: 265, protein: 18.3, carbs: 1.2, fat: 20.8, fibre: 0, basisAmount: 100, basisUnit: "g" };
  if (name.includes("oil")) return { calories: 828, protein: 0, carbs: 0, fat: 92, fibre: 0, basisAmount: 100, basisUnit: "ml" };
  if (name.includes("chicken")) return { calories: 165, protein: 31, carbs: 0, fat: 3.6, fibre: 0, basisAmount: 100, basisUnit: "g" };
  if (name.includes("mutton") || name.includes("lamb")) return { calories: 294, protein: 25, carbs: 0, fat: 21, fibre: 0, basisAmount: 100, basisUnit: "g" };
  if (name.includes("fish")) return { calories: 120, protein: 20, carbs: 0, fat: 4, fibre: 0, basisAmount: 100, basisUnit: "g" };
  if (name.includes("egg")) return { calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8, fibre: 0, basisAmount: 1, basisUnit: "piece" };
  if (name.includes("rice")) return { calories: 365, protein: 7.1, carbs: 80, fat: 0.7, fibre: 1.3, basisAmount: 100, basisUnit: "g" };
  if (name.includes("dal") || name.includes("lentil")) return { calories: 343, protein: 25, carbs: 60, fat: 1.1, fibre: 11, basisAmount: 100, basisUnit: "g" };

  if (category === "Meat & fish") return { calories: 200, protein: 26, carbs: 0, fat: 10.5, fibre: 0, basisAmount: 100, basisUnit: "g" };
  if (category === "Vegetables") return { calories: 35, protein: 2, carbs: 7, fat: 0.3, fibre: 2.8, basisAmount: 100, basisUnit: "g" };
  if (category === "Bakery") return { calories: 265, protein: 9, carbs: 49, fat: 3.2, fibre: 2.7, basisAmount: 100, basisUnit: "g" };
  if (category === "Milk & dairy") return { calories: 150, protein: 8, carbs: 12, fat: 8, fibre: 0, basisAmount: 100, basisUnit: "g" };
  if (category === "Home food") return { calories: 520, protein: 18, carbs: 68, fat: 20, fibre: 8, basisAmount: 1, basisUnit: "meal" };
  return { calories: 350, protein: 10, carbs: 70, fat: 3.3, fibre: 8, basisAmount: 100, basisUnit: "g" };
}

function convertAmount(amount: number, fromUnit: string, toUnit: Basis["basisUnit"]) {
  if (fromUnit === toUnit) return amount;
  if (fromUnit === "kg" && toUnit === "g") return amount * 1000;
  if (fromUnit === "litre" && toUnit === "ml") return amount * 1000;
  if (fromUnit === "dozen" && toUnit === "piece") return amount * 12;
  return amount;
}

export function nutritionReference(productName: string, category: string, amount = 1, unit = "pack"): Nutrition {
  const basis = basisFor(productName, category);
  const comparableAmount = convertAmount(amount, unit, basis.basisUnit);
  const factor = comparableAmount / basis.basisAmount;
  return {
    calories: Math.round(basis.calories * factor),
    protein: round(basis.protein * factor),
    carbs: round(basis.carbs * factor),
    fat: round(basis.fat * factor),
    fibre: round(basis.fibre * factor),
  };
}

export function nutritionLooksConsistent(value: Nutrition) {
  if (value.calories <= 0) return false;
  const macroCalories = value.protein * 4 + value.carbs * 4 + value.fat * 9;
  if (macroCalories <= 0) return false;
  return Math.abs(value.calories - macroCalories) / value.calories <= 0.3;
}

