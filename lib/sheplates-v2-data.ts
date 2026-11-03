import type { Role } from "./sheplates-data";

export type DemoSession = { email: string; name: string; role: Role; userId?: string; vendorId?: string; isNewVendor?: boolean; p0UpgradeInvitationId?: string; toursCompleted?: string[]; privateAccount?: boolean };
export type VerificationStatus = "Draft" | "Submitted" | "Under review" | "Changes required" | "Verified" | "Rejected" | "Expired";
export type OrderStatus = "Awarded" | "Confirmed" | "Preparing" | "Ready" | "Out for delivery" | "Ready for pickup" | "Completed" | "Cancellation requested" | "Cancelled";
export type PaymentStatus = "Paid" | "Reversal pending" | "Reversal initiated" | "Refunded";

export type VendorApplication = {
  id: string; ownerEmail: string; ownerName: string; businessName: string; category: string;
  locality: string; fssaiNumber: string; certificateName: string; expiryDate: string;
  verification: VerificationStatus; operational: "Inactive" | "Active" | "Paused" | "Suspended";
  plan: "Taster" | "Crave" | "Thrive" | "Crown"; submittedAt: string; reviewNote?: string;
};

export type MenuItem = {
  id: string; vendorId: string; name: string; category: string; unit: string; vendorPrice: number;
  active: boolean; emoji: string;
};

export type GroceryItem = { id: string; name: string; brand: string; quantity: number; unit: string; substitute: boolean };
export type GroceryRequirement = {
  id: string; customerEmail: string; title: string; locality: string; deliveryDate: string;
  mode: "Vendor delivery" | "Self pickup"; quoteDeadline: string; items: GroceryItem[];
  status: "Draft" | "Customer review" | "Quoting" | "Quotes received" | "Vendor selected" | "Expired";
};

export type QuoteItem = GroceryItem & { offeredBrand: string; unitPrice: number; available: boolean };
export type VendorQuote = {
  id: string; requirementId: string; vendorId: string; vendorName: string; items: QuoteItem[];
  deliveryFee: number; tax: number; vendorTotal: number; status: "Draft" | "Submitted" | "Selected" | "Not selected";
  submittedAt: string;
};

export type Order = {
  id: string; requirementId?: string; customerEmail: string; customerName: string; vendorId: string;
  vendorName: string; description: string; itemCount: number; total: number; vendorBaseTotal: number;
  markupTotal: number; mode: "Vendor delivery" | "Self pickup"; scheduledDate: string;
  scheduledSlot: string; status: OrderStatus; paymentStatus: PaymentStatus;
  timeline: { label: string; at: string; complete: boolean }[];
};

export type CancellationRequest = {
  id: string; orderId: string; customerEmail: string; reason: string; requestedAt: string;
  aiDecision: "Eligible" | "Conditional" | "Not eligible"; aiConfidence: number; aiReason: string;
  recommendedRefund: number; status: "Awaiting operations" | "Approved" | "Rejected" | "Refunded";
  operationsNote?: string;
};

export type AuditEvent = { id: string; actor: string; action: string; entity: string; at: string; details: string };

export const demoAccounts = [
  {email:"customer@sheplates.demo",password:"Customer@123",name:"Karthikeyan A",role:"customer" as Role,label:"Customer",detail:"Monthly needs, quotes and orders"},
  {email:"vendor@sheplates.demo",password:"Vendor@123",name:"Murugan",role:"vendor" as Role,vendorId:"v1",label:"Verified vendor",detail:"Kovai Fresh Dairy"},
  {email:"newvendor@sheplates.demo",password:"NewVendor@123",name:"Malar",role:"vendor" as Role,vendorId:"v7",isNewVendor:true,label:"New vendor",detail:"Test self-onboarding"},
  {email:"operations@sheplates.demo",password:"Operations@123",name:"Nandhini",role:"operations" as Role,label:"Operations",detail:"Verify, price and resolve"},
  {email:"admin@sheplates.demo",password:"Admin@123",name:"Karthikeyan A",role:"admin" as Role,label:"Super admin",detail:"Plans, access and audit"},
];

export const initialApplications: VendorApplication[] = [
  {id:"APP-1001",ownerEmail:"vendor@sheplates.demo",ownerName:"Murugan",businessName:"Kovai Fresh Dairy",category:"Milk & dairy",locality:"Ganapathy",fssaiNumber:"12426018000123",certificateName:"kovai-fresh-fssai.pdf",expiryDate:"2027-08-31",verification:"Verified",operational:"Active",plan:"Crown",submittedAt:"28 Aug 2026"},
  {id:"APP-1002",ownerEmail:"newvendor@sheplates.demo",ownerName:"Malar",businessName:"Malar Home Foods",category:"Home food",locality:"Peelamedu",fssaiNumber:"",certificateName:"",expiryDate:"",verification:"Draft",operational:"Inactive",plan:"Crave",submittedAt:"Not submitted"},
  {id:"APP-1003",ownerEmail:"hens@sheplates.demo",ownerName:"Kavitha",businessName:"Happy Hens Farm",category:"Eggs",locality:"Saravanampatti",fssaiNumber:"12426018000987",certificateName:"happy-hens-food-license.pdf",expiryDate:"2027-01-18",verification:"Under review",operational:"Inactive",plan:"Thrive",submittedAt:"5 Sep 2026"},
];

export const initialMenuItems: MenuItem[] = [
  {id:"MI-101",vendorId:"v1",name:"Cow milk",category:"Milk & dairy",unit:"1 litre",vendorPrice:62,active:true,emoji:"🥛"},
  {id:"MI-102",vendorId:"v1",name:"Fresh curd",category:"Milk & dairy",unit:"500 g",vendorPrice:48,active:true,emoji:"🥣"},
  {id:"MI-103",vendorId:"v1",name:"Farm paneer",category:"Milk & dairy",unit:"250 g",vendorPrice:110,active:true,emoji:"🧀"},
  {id:"MI-201",vendorId:"v2",name:"Home-style lunch",category:"Home food",unit:"1 meal",vendorPrice:115,active:true,emoji:"🍱"},
  {id:"MI-202",vendorId:"v2",name:"Chapati dinner",category:"Home food",unit:"1 meal",vendorPrice:95,active:true,emoji:"🫓"},
  {id:"MI-301",vendorId:"v3",name:"Chicken curry cut",category:"Meat & fish",unit:"1 kg",vendorPrice:260,active:true,emoji:"🍗"},
  {id:"MI-501",vendorId:"v5",name:"Ponni boiled rice",category:"Groceries",unit:"25 kg",vendorPrice:1420,active:true,emoji:"🍚"},
  {id:"MI-502",vendorId:"v5",name:"Sunflower oil",category:"Groceries",unit:"5 litre",vendorPrice:690,active:true,emoji:"🫗"},
  {id:"MI-503",vendorId:"v5",name:"Toor dal",category:"Groceries",unit:"3 kg",vendorPrice:510,active:true,emoji:"🫘"},
  {id:"MI-504",vendorId:"v5",name:"Monthly essentials basket",category:"Groceries",unit:"1 basket",vendorPrice:4250,active:true,emoji:"🛍️"},
];

export const vendorNames: Record<string,string> = {v1:"Kovai Fresh Dairy",v2:"Amma's Daily Kitchen",v3:"Namma Fresh Cuts",v4:"Green Basket Coimbatore",v5:"Sri Murugan Stores",v6:"Happy Hens Farm",v7:"Malar Home Foods"};

const reqItems: GroceryItem[] = [
  {id:"RI-1",name:"Ponni boiled rice",brand:"Any trusted brand",quantity:25,unit:"kg",substitute:true},
  {id:"RI-2",name:"Sunflower oil",brand:"Gold Winner",quantity:5,unit:"litre",substitute:false},
  {id:"RI-3",name:"Toor dal",brand:"Any",quantity:3,unit:"kg",substitute:true},
  {id:"RI-4",name:"Chilli powder",brand:"Aachi",quantity:500,unit:"g",substitute:false},
  {id:"RI-5",name:"Bath soap",brand:"Mysore Sandal",quantity:4,unit:"pieces",substitute:false},
  {id:"RI-6",name:"Dishwash liquid",brand:"Any",quantity:2,unit:"litre",substitute:true},
];

export const initialRequirements: GroceryRequirement[] = [
  {id:"RFQ-260901",customerEmail:"customer@sheplates.demo",title:"September family groceries",locality:"Ganapathy",deliveryDate:"2026-09-10",mode:"Vendor delivery",quoteDeadline:"2026-09-08T18:00",items:reqItems,status:"Quotes received"},
];

export const initialQuotes: VendorQuote[] = [
  {id:"QT-601",requirementId:"RFQ-260901",vendorId:"v5",vendorName:"Sri Murugan Stores",deliveryFee:80,tax:312,vendorTotal:5840,status:"Submitted",submittedAt:"6 Sep, 9:30 AM",items:reqItems.map((x,i)=>({...x,offeredBrand:i===1?"Gold Winner":x.brand,unitPrice:[1420,690,510,210,188,260][i],available:true}))},
  {id:"QT-602",requirementId:"RFQ-260901",vendorId:"v8",vendorName:"Ganapathy Family Mart",deliveryFee:0,tax:298,vendorTotal:5595,status:"Submitted",submittedAt:"6 Sep, 10:10 AM",items:reqItems.map((x,i)=>({...x,offeredBrand:i===1?"Fortune":x.brand,unitPrice:[1390,645,495,205,180,250][i],available:i!==4}))},
];

export const initialOrders: Order[] = [
  {id:"SP-ORD-8401",customerEmail:"customer@sheplates.demo",customerName:"Karthikeyan A",vendorId:"v1",vendorName:"Kovai Fresh Dairy",description:"September milk schedule",itemCount:30,total:2230,vendorBaseTotal:1860,markupTotal:341,mode:"Vendor delivery",scheduledDate:"Tomorrow",scheduledSlot:"06:00–07:00 AM",status:"Confirmed",paymentStatus:"Paid",timeline:[{label:"Order confirmed",at:"5 Sep, 7:42 PM",complete:true},{label:"Vendor confirmed",at:"5 Sep, 8:06 PM",complete:true},{label:"Preparing",at:"Tomorrow, 5:15 AM",complete:false},{label:"Delivered",at:"Tomorrow, 6:00–7:00 AM",complete:false}]},
  {id:"SP-ORD-8328",customerEmail:"customer@sheplates.demo",customerName:"Karthikeyan A",vendorId:"v4",vendorName:"Green Basket Coimbatore",description:"Weekly vegetable basket",itemCount:1,total:690,vendorBaseTotal:600,markupTotal:61,mode:"Vendor delivery",scheduledDate:"10 Sep 2026",scheduledSlot:"07:00–08:00 AM",status:"Preparing",paymentStatus:"Paid",timeline:[{label:"Order confirmed",at:"4 Sep, 4:10 PM",complete:true},{label:"Vendor confirmed",at:"4 Sep, 4:32 PM",complete:true},{label:"Preparing",at:"6 Sep, 8:15 AM",complete:true},{label:"Delivered",at:"10 Sep, 7:00–8:00 AM",complete:false}]},
];

export const initialCancellations: CancellationRequest[] = [
  {id:"CAN-901",orderId:"SP-ORD-8328",customerEmail:"customer@sheplates.demo",reason:"Travelling outside Coimbatore",requestedAt:"6 Sep, 8:40 AM",aiDecision:"Eligible",aiConfidence:96,aiReason:"Request is before the vendor cut-off, preparation has not created a non-recoverable cost, and no prior cancellation abuse is detected.",recommendedRefund:690,status:"Awaiting operations"},
];

export const initialMarkups: Record<string,number> = {"MI-101":12,"MI-102":10,"MI-103":15,"MI-201":18,"MI-202":18,"MI-301":12,"MI-501":8,"MI-502":7,"MI-503":9,"MI-504":10};

export const initialAudit: AuditEvent[] = [
  {id:"AUD-1",actor:"Nandhini · Operations",action:"Updated item markup",entity:"Cow milk · Kovai Fresh Dairy",at:"6 Sep, 9:14 AM",details:"10% → 12%; applies to new orders only"},
  {id:"AUD-2",actor:"AI Cancellation Reviewer",action:"Evaluated cancellation",entity:"SP-ORD-8328",at:"6 Sep, 8:41 AM",details:"Eligible · 96% confidence · ₹690 recommended reversal"},
  {id:"AUD-3",actor:"Kavitha · Vendor",action:"Submitted verification",entity:"Happy Hens Farm",at:"5 Sep, 4:20 PM",details:"Food certificate and bank proof uploaded"},
];

export function customerPrice(item: MenuItem, markups: Record<string,number>) {
  const pct=markups[item.id] ?? 0;
  return Math.round(item.vendorPrice*(1+pct/100)*100)/100;
}

export function quoteCustomerTotal(quote: VendorQuote, vendorMarkupPercent:number) {
  return Math.round((quote.vendorTotal*(1+vendorMarkupPercent/100)+quote.deliveryFee+quote.tax)*100)/100;
}
