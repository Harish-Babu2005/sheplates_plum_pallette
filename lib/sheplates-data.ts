import { Milk, Soup, Drumstick, Carrot, ShoppingBag, Egg, Croissant, Wheat, Package, type LucideIcon } from "@/components/icons";

export type Role = "customer" | "vendor" | "operations" | "admin";
export type SubscriptionStatus = "active" | "paused" | "cancelled";
export type FulfilmentStatus = "Scheduled" | "Confirmed" | "Preparing" | "Ready for pickup" | "Out for delivery" | "Completed" | "Delayed" | "Exception";

export type Plan = {
  id: string; vendorId: string; name: string; category: string; emoji: string;
  description: string; price: number; unit: string; frequency: string;
  rating: number; nextStart: string; delivery: boolean; pickup: boolean;
  slots: string[]; accent: string;
};

export type Vendor = {
  id: string; name: string; category: string; locality: string; distance: string;
  rating: number; verified: boolean; fulfilment: number; confirmation: number;
  plans: number; status: "Active" | "Review" | "Paused"; emoji: string;
};

export type Subscription = {
  id: string; planId: string; planName: string; vendor: string; emoji: string;
  status: SubscriptionStatus; schedule: string; slot: string; mode: "Vendor delivery" | "Self pickup";
  price: number; nextDate: string; address: string;
};

export type Fulfilment = {
  id: string; subscriptionId: string; customer: string; vendor: string; item: string;
  quantity: string; date: string; slot: string; mode: "Delivery" | "Pickup";
  status: FulfilmentStatus; locality: string;
};

export const categories = [
  { name: "Milk & dairy", emoji: "🥛", color: "#e9f4ff" },
  { name: "Home food", emoji: "🍱", color: "#fff0df" },
  { name: "Caterer", emoji: "🍽️", color: "#fff0df" },
  { name: "Meat & fish", emoji: "🍗", color: "#ffe5e5" },
  { name: "Vegetables", emoji: "🥬", color: "#e7f7e8" },
  { name: "Groceries", emoji: "🛍️", color: "#f1eaff" },
  { name: "Eggs", emoji: "🥚", color: "#fff8d8" },
  { name: "Bakery", emoji: "🥖", color: "#f8eadf" },
  { name: "Snacks", emoji: "🍿", color: "#fff6d6" },
  { name: "Rice & staples", emoji: "🍚", color: "#eef0ef" },
  { name: "Other", emoji: "📦", color: "#f1f6e8" },
];

// A controlled vector-icon set instead of raw emoji: renders identically across
// every OS/browser (emoji fonts vary — this matters once the app ships natively),
// and gives each category its own colour so the marketplace reads as a designed
// product rather than a placeholder grid.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Milk & dairy": Milk, "Home food": Soup, "Meat & fish": Drumstick, Vegetables: Carrot,
  Groceries: ShoppingBag, Eggs: Egg, Bakery: Croissant, "Rice & staples": Wheat,
};
const CATEGORY_TINTS: Record<string, string> = {
  "Milk & dairy": "#2f6fa8", "Home food": "#b1652f", "Meat & fish": "#b1484a", Vegetables: "#3f8f3f",
  Groceries: "#7847b8", Eggs: "#a67c00", Bakery: "#8a5a34", "Rice & staples": "#5f6b63",
};
export function categoryVisual(category: string): { bg: string; fg: string; Icon: LucideIcon } {
  const meta = categories.find((item) => item.name === category);
  return { bg: meta?.color || "#f1f6e8", fg: CATEGORY_TINTS[category] || "#5f6b63", Icon: CATEGORY_ICONS[category] || Package };
}

export const plans: Plan[] = [
  { id:"p1", vendorId:"v1", name:"Farm-fresh milk every morning", category:"Milk & dairy", emoji:"🥛", description:"Pasteurised cow milk delivered in reusable glass bottles.", price:1860, unit:"1 litre/day", frequency:"Daily", rating:4.9, nextStart:"Tomorrow", delivery:true, pickup:true, slots:["06:00–07:00 AM","07:00–08:00 AM"], accent:"from-sky-100 to-blue-50" },
  { id:"p2", vendorId:"v2", name:"Weekday home lunch", category:"Home food", emoji:"🍱", description:"Balanced Tamil home-style lunch, Monday to Friday.", price:2800, unit:"20 meals", frequency:"Weekdays", rating:4.8, nextStart:"Tomorrow", delivery:true, pickup:true, slots:["12:00–01:00 PM","01:00–02:00 PM"], accent:"from-orange-100 to-amber-50" },
  { id:"p3", vendorId:"v3", name:"Sunday chicken plan", category:"Meat & fish", emoji:"🍗", description:"Fresh cleaned curry-cut chicken prepared every Sunday.", price:1520, unit:"2 kg/week", frequency:"Weekly", rating:4.7, nextStart:"Sunday", delivery:true, pickup:true, slots:["07:00–08:00 AM","08:00–09:00 AM"], accent:"from-rose-100 to-red-50" },
  { id:"p4", vendorId:"v4", name:"Weekly vegetable basket", category:"Vegetables", emoji:"🥬", description:"Seasonal vegetables curated for a family of four.", price:1999, unit:"2 baskets/week", frequency:"Tue & Fri", rating:4.9, nextStart:"Tomorrow", delivery:true, pickup:false, slots:["06:00–07:00 AM","07:00–08:00 AM"], accent:"from-emerald-100 to-green-50" },
  { id:"p5", vendorId:"v5", name:"Monthly kitchen essentials", category:"Groceries", emoji:"🛍️", description:"Rice, dals, oil, spices and everyday staples in one plan.", price:4250, unit:"Family pack", frequency:"Monthly", rating:4.6, nextStart:"5 Sep", delivery:true, pickup:true, slots:["10:00–12:00 PM","04:00–06:00 PM"], accent:"from-violet-100 to-purple-50" },
  { id:"p6", vendorId:"v6", name:"Protein egg plan", category:"Eggs", emoji:"🥚", description:"Farm eggs twice a week with flexible quantity.", price:960, unit:"24 eggs/week", frequency:"Wed & Sat", rating:4.8, nextStart:"Saturday", delivery:false, pickup:true, slots:["07:00–09:00 AM","05:00–07:00 PM"], accent:"from-yellow-100 to-amber-50" },
];

export const vendors: Vendor[] = [
  {id:"v1",name:"Kovai Fresh Dairy",category:"Milk & dairy",locality:"Ganapathy",distance:"1.2 km",rating:4.9,verified:true,fulfilment:98.7,confirmation:100,plans:4,status:"Active",emoji:"🥛"},
  {id:"v2",name:"Amma's Daily Kitchen",category:"Home food",locality:"Peelamedu",distance:"2.1 km",rating:4.8,verified:true,fulfilment:96.4,confirmation:98,plans:6,status:"Active",emoji:"🍱"},
  {id:"v3",name:"Namma Fresh Cuts",category:"Meat & fish",locality:"Ganapathy",distance:"2.8 km",rating:4.7,verified:true,fulfilment:94.8,confirmation:96,plans:5,status:"Active",emoji:"🍗"},
  {id:"v4",name:"Green Basket Coimbatore",category:"Vegetables",locality:"Saibaba Colony",distance:"3.4 km",rating:4.9,verified:true,fulfilment:99.1,confirmation:100,plans:3,status:"Active",emoji:"🥬"},
  {id:"v5",name:"Sri Murugan Stores",category:"Groceries",locality:"RS Puram",distance:"4.2 km",rating:4.6,verified:true,fulfilment:97.2,confirmation:97,plans:8,status:"Active",emoji:"🛍️"},
  {id:"v6",name:"Happy Hens Farm",category:"Eggs",locality:"Saravanampatti",distance:"5.8 km",rating:4.8,verified:false,fulfilment:92.6,confirmation:94,plans:2,status:"Review",emoji:"🥚"},
];

export const initialSubscriptions: Subscription[] = [
  {id:"SUB-24081",planId:"p1",planName:"Farm-fresh milk every morning",vendor:"Kovai Fresh Dairy",emoji:"🥛",status:"active",schedule:"Every day",slot:"06:00–07:00 AM",mode:"Vendor delivery",price:1860,nextDate:"Tomorrow, 6:00 AM",address:"Elite City, Ganapathy"},
  {id:"SUB-23892",planId:"p4",planName:"Weekly vegetable basket",vendor:"Green Basket Coimbatore",emoji:"🥬",status:"active",schedule:"Tuesday & Friday",slot:"07:00–08:00 AM",mode:"Vendor delivery",price:1999,nextDate:"Friday, 7:00 AM",address:"Elite City, Ganapathy"},
];

export const initialFulfilments: Fulfilment[] = [
  {id:"FUL-3901",subscriptionId:"SUB-24081",customer:"Karthikeyan A",vendor:"Kovai Fresh Dairy",item:"Cow milk",quantity:"1 litre",date:"Today",slot:"06:00–07:00 AM",mode:"Delivery",status:"Completed",locality:"Ganapathy"},
  {id:"FUL-3902",subscriptionId:"SUB-24081",customer:"Karthikeyan A",vendor:"Kovai Fresh Dairy",item:"Cow milk",quantity:"1 litre",date:"Tomorrow",slot:"06:00–07:00 AM",mode:"Delivery",status:"Confirmed",locality:"Ganapathy"},
  {id:"FUL-3903",subscriptionId:"SUB-23892",customer:"Karthikeyan A",vendor:"Green Basket Coimbatore",item:"Family vegetable basket",quantity:"1 basket",date:"Tomorrow",slot:"07:00–08:00 AM",mode:"Delivery",status:"Scheduled",locality:"Ganapathy"},
  {id:"FUL-3904",subscriptionId:"SUB-21912",customer:"Priya S",vendor:"Amma's Daily Kitchen",item:"Home lunch",quantity:"2 meals",date:"Tomorrow",slot:"12:00–01:00 PM",mode:"Delivery",status:"Scheduled",locality:"Peelamedu"},
  {id:"FUL-3905",subscriptionId:"SUB-21318",customer:"Arun M",vendor:"Namma Fresh Cuts",item:"Chicken curry cut",quantity:"2 kg",date:"Tomorrow",slot:"08:00–09:00 AM",mode:"Pickup",status:"Exception",locality:"Ganapathy"},
  {id:"FUL-3906",subscriptionId:"SUB-20310",customer:"Divya R",vendor:"Sri Murugan Stores",item:"Kitchen essentials",quantity:"1 pack",date:"Tomorrow",slot:"10:00–12:00 PM",mode:"Delivery",status:"Confirmed",locality:"RS Puram"},
  {id:"FUL-3907",subscriptionId:"SUB-19980",customer:"Vijay P",vendor:"Happy Hens Farm",item:"Farm eggs",quantity:"24 eggs",date:"Tomorrow",slot:"07:00–09:00 AM",mode:"Pickup",status:"Delayed",locality:"Saravanampatti"},
];

export const tomorrowDemand = [
  {name:"Milk",value:186,color:"#4f9cf9"},{name:"Meals",value:124,color:"#753b50"},{name:"Vegetables",value:78,color:"#14966f"},{name:"Meat",value:52,color:"#9b59b6"},{name:"Groceries",value:31,color:"#f3a712"}
];
