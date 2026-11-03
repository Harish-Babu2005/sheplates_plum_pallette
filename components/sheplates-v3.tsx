"use client";
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type * as React from "react";
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, Bell, CalendarDays,
  Check, ClipboardCheck, FileCheck2, HeartPulse,
  IndianRupee, LayoutDashboard, ListChecks, LocateFixed, LogOut, MapPin, Menu,
  MessageSquareText, Package, Pause, Percent, Play, Plus, RefreshCcw, Search, Send, Settings,
  ShieldCheck, ShoppingBag, Sparkles, Store, Truck, Upload, UserPlus, Users,
  WalletCards, X, MapPinned, TicketCheck, ShoppingCart, Building2, ImageUp,
  FileSpreadsheet, Download, CreditCard, UserCog, CheckCircle2, Lightbulb, Eye, EyeOff, Copy,
  ChevronDown, Filter, Megaphone, Star, Flame, CircleUserRound, Pencil, Trash2, FileUp, Volume2, Clock3, HelpCircle,
  Heart, MessagesSquare, ThumbsUp, ThumbsDown, SlidersHorizontal, Zap, Timer, Clapperboard, ReceiptText, Compass, PhoneCall, Crown, MessageCircle, FileText,
} from "@/components/icons";
import { downloadWorkbook } from "@/lib/excel-export";
import { MARKET_GROUPS } from "@/lib/market-groups";
import { createStaffUser } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { ShePlatesEntry } from "@/components/sheplates-entry";
import { VendorQrCode } from "@/components/vendor-qr-code";
import { P0VendorManagement } from "@/components/p0-vendor-management";
import { P0UpgradeAcceptance } from "@/components/p0-upgrade-acceptance";

import { categories, categoryVisual } from "@/lib/sheplates-data";
import { demoAccounts, type DemoSession } from "@/lib/sheplates-v2-data";
import { nutritionLooksConsistent, type Nutrition } from "@/lib/nutrition";
import {
  acceptLiveThirdPartyDelivery, issueLiveThirdPartyDeliveryCode, verifyLiveThirdPartyDeliveryCode,
  decideLiveVendorVerification, getAccessToken, isLiveSupabaseMode, isSupabaseConfigured,
  loadLiveCustomerPreference, loadLiveCustomerMemory, clearLiveCustomerMemory, loadLiveMarketplace, loadLiveOperationsWorkspace, loadLiveVendorWorkspace, loadLiveCommerceSnapshot,
  loadLiveNotifications, markLiveNotificationsRead, saveLiveCustomerProfile,
  liveSignOut, saveLiveCustomerLocation, saveLiveVendorLocation, saveLiveVendorProduct,
  saveLiveMarketplaceHome, saveLiveCampaign, deleteLiveCampaign, uploadLiveProductImage, submitLiveVendorApplication, updateLiveVendorControls, saveLiveVendorPlan, createLiveScheduledCheckout, syncLiveCart, checkoutLiveCart, markLiveOrderPaid, createLiveRazorpayOrder, verifyLiveRazorpayPayment, saveLiveDeliveryStaff, deleteLiveDeliveryStaff, saveLiveDeliverySlot, deleteLiveDeliverySlot, toggleLiveDeliverySlot, assignLiveDeliveryStaff, resubmitLiveVendorVerification, saveLiveOutletCertificate, uploadLiveCertificate, updateLiveOrderStatus, rescheduleLiveOrder, notifyLiveNutritionReview, saveLiveTourCompleted,
  loadLiveTasteProfile, saveLiveTasteProfile, recordLiveTasteFeedback, fetchLiveFoodAttributes,
  loadLiveFoodDrops, loadLiveVendorFoodDrops, createLiveFoodDrop, cancelLiveFoodDrop, claimLiveFoodDrop, loadLiveFoodDropClaims,
  type LiveMarketplaceRow, type LiveMenuItemRow, type LiveVendorRow, type MarketplaceDiagnostics,
 subscribeLiveNotifications,} from "@/lib/supabase";
import {
  TASTE_SETUP_CHOICES, TASTE_DIMENSION_LABELS, tasteMatchScore, applyTasteSignal, weightsFromSetupChoices, inferAttributesLocally,
  type TasteWeights, type TasteSignal,
} from "@/lib/taste-match";
import {
  dropDisplayStatus, discountPercent, claimedPercent, formatCountdown, foodDropSchedule,
  type FoodDrop, type FoodDropClaim,
} from "@/lib/food-drops";
import { useSocial } from "@/lib/social";
import { groupMatches } from "@/lib/market-groups";
import { CustomerBottomNav, CustomerFooter, CustomerHeader, tabOf } from "@/components/customer-v2/shell";
import { StaffShell } from "@/components/staff/shell";
import { StoriesMonitor } from "@/components/staff/stories-monitor";
import { inviteVendorByEmail, loadAuditTrail, logCustomerView, sendVendorNote, type TrailEvent } from "@/lib/audit-trail";
import { CategoryGrid, FoodDropsTab, MapsTab, PromoBanner, SchedulesTab, VendorRow } from "@/components/customer-v2/discover";
import { StoriesTab } from "@/components/customer-v2/stories";
import { ShortsRail, ShortsViewer, useShortsViewer } from "@/components/customer-v2/shorts";
import { VendorShortsManager } from "@/components/vendor/shorts-manager";
import { VendorPeopleFollowers } from "@/components/vendor/people-followers";
import { LiveCustomerRfqs, LiveRfqDesk, LiveVendorRfqs } from "@/components/rfq/live-rfq";
import { publishRequirement } from "@/lib/rfq";
import { CampaignBanner } from "@/components/customer-v2/campaigns";
import { CampaignManager } from "@/components/admin/campaign-manager";
import { recordCampaignEvent, useCampaignViewCounter, useCustomerCampaigns, type CampaignRecord, type LiveCampaign } from "@/lib/campaigns";
import { usePeople, type PeopleApi } from "@/lib/people";
import { useStatuses } from "@/lib/statuses";
import { useFoodShorts, type FoodShort, type ShortsApi } from "@/lib/food-shorts";
import { ProfileTab, VendorProfileDialog } from "@/components/customer-v2/profile";
import { shortArea, useTicker, PhotoTile } from "@/components/customer-v2/kit";

function CategoryBadge({ name, className = "size-5" }: { name: string; className?: string }) {
  const { Icon, fg } = categoryVisual(name);
  return <Icon className={className} style={{ color: fg }} strokeWidth={1.75} />;
}
function ProductGlyph({ category, iconClassName = "size-6" }: { category: string; iconClassName?: string }) {
  const { Icon, fg } = categoryVisual(category);
  return <Icon className={iconClassName} style={{ color: fg }} strokeWidth={1.6} />;
}

type Role = DemoSession["role"];
type DeliveryMode = "Vendor delivery" | "Self pickup" | "Third-party delivery";



type Verification = "Draft" | "Submitted" | "Under review" | "Changes required" | "Verified" | "Rejected";
export type Product = {
  id: string; vendorId: string; name: string; category: string; emoji: string; baseUnit: string;
  quantityStep: number; vendorPrice: number; stock: number; active: boolean; calories: number;
  protein: number; carbs: number; fat: number; fibre: number; dietaryTags: string[];
  packAmount?: number; packMeasure?: string; liveDistanceKm?: number; imageUrl?: string; originalImageUrl?: string;
  nutritionStatus?: "Verified" | "Estimated" | "Pending review"; nutritionConfidence?: number; nutritionNote?: string;
};
type AgentMemory = { lastBudget?: number; favoriteCategories?: string[]; lastComplaintAt?: string; calorieTarget?: number; minProtein?: number; preferredDietaryTags?: string[]; preferredDeliveryPeriod?: string; favoriteProducts?: string[] };
type AgentMessage = { role: "user" | "agent"; text: string; productIds?: string[]; basketTotal?: number; intent?: string; streaming?: boolean };

/** Reads She Agent's event stream: "reply" events carry the words written so far, the last event is the validated result. */
async function readAgentStream(response: Response, onReply: (replySoFar: string) => void): Promise<{ result?: Record<string, unknown>; error?: string }> {
  const reader = response.body!.getReader(); const decoder = new TextDecoder();
  let buffer = ""; let outcome: { result?: Record<string, unknown>; error?: string } = { error: "She Agent stopped before answering. Please try again." };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf("\n\n")) >= 0) {
      const line = buffer.slice(0, cut).split("\n").find((l) => l.startsWith("data:")); buffer = buffer.slice(cut + 2);
      if (!line) continue;
      try {
        const event = JSON.parse(line.slice(5).trim()) as { type?: string; text?: string; result?: Record<string, unknown>; error?: string };
        if (event.type === "reply" && event.text) onReply(event.text);
        else if (event.type === "result" && event.result) outcome = { result: event.result };
        else if (event.type === "error") outcome = { error: event.error || "She Agent couldn't complete that request just now." };
      } catch { /* ignore a malformed event */ }
    }
  }
  return outcome;
}
type CustomerProfile = {
  email: string; address: string; latitude?: number; longitude?: number; householdSize: number;
  diet: string; allergies: string[]; goals: string[]; dislikes: string; onboardingComplete: boolean;
  phone?: string; addresses?: CustomerAddress[]; agentMemory?: AgentMemory; privateAccount?: boolean;
};
type CustomerAddress = { id: string; label: string; address: string; latitude?: number; longitude?: number; phone?: string; isDefault: boolean };
export type Vendor = {
  id: string; ownerEmail: string; ownerName: string; businessName: string; category: string;
  address: string; latitude?: number; longitude?: number; radiusKm: number; delivery: boolean;
  pickup: boolean; openToday: boolean; fssaiNumber: string; certificateName: string; expiryDate: string;
  verification: Verification; operational: "Inactive" | "Active" | "Paused"; plan: "Taster" | "Crave" | "Thrive" | "Crown";
  logoUrl?: string; bannerUrl?: string; outlets?: VendorOutlet[];
  vendorKind?: "subscription" | "p0_connect";
};
type VendorOutlet = { id: string; name: string; address: string; latitude?: number; longitude?: number; radiusKm: number; openToday: boolean; certificateNumber?: string; certificateName?: string; certificateExpiry?: string };
type Schedule = {
  id: string; customerEmail: string; productId: string; vendorId: string; startDate: string;
  endDate: string; recurrence: "Once" | "Daily" | "Weekly" | "Custom"; weekdays: string[];
  timeSlot: string; quantity: number; unit: string; mode: DeliveryMode; estimatedOccurrences: number;
  status?: "Awaiting payment" | "Active" | "Paused" | "Cancelled" | "Completed"; nextDeliveryAt?: string; whatsappReminder?: boolean;
};
export type VendorDeliverySlot = {
  id: string;
  vendorId: string;
  slotName: string;
  startTime: string; // "09:00"
  endTime: string;   // "11:00"
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type Order = {
  id: string; scheduleId?: string; customerEmail: string; vendorId: string; productId?: string;
  description: string; quantity: number; unit: string; total: number; date: string; slot: string; deliveryAddress?: string;
mode: DeliveryMode; status: "Scheduled" | "Confirmed" | "Preparing" | "Ready" | "Out for delivery" | "Ready for pickup" | "Completed" | "Delivered" | "Cancellation requested" | "Cancelled";  payment: "Pending" | "Paid" | "Reversal pending" | "Refunded";
  trackingLatitude?: number; trackingLongitude?: number; cancellationFee?: number;
  orderNumber?: string;
  paymentReference?: string;
  paymentProvider?: string;
  createdAt?: string;
  items?: Array<{ name: string; quantity: number; unit?: string; price?: number }>;
};
type ThirdPartyDeliveryRequest = {
  orderId: string; customerId: string; vendorId: string; notes: string;
  status: "pending" | "accepted" | "delivered" | "expired" | "locked";
  acceptedAt?: string; codeExpiresAt?: string; codeIssuedCount: number; deliveredAt?: string;
};
type Staff = { id: string; vendorId: string; name: string; phone: string; active: boolean };
type Assignment = { id: string; orderId: string; staffId: string; assignedAt: string };
type RequirementItem = { id: string; name: string; quantity: number; unit: string; brand: string };
type Requirement = { id: string; customerEmail: string; title: string; deliveryDate: string; closingDate?: string; sourceFileName?: string; items: RequirementItem[]; status: "Draft" | "Quoting" | "Quotes received" | "Awarded"; invitedVendorIds?: string[] };
type Quote = { id: string; requirementId: string; vendorId: string; total: number; deliveryFee: number; note: string; status: "Submitted" | "Selected" | "Not selected" };
type Notification = { id: string; recipient: string; recipientRole: Role; title: string; body: string; at: string; read: boolean; href?: string; entityType?: string | null; entityId?: string | null };
type Cancellation = { id: string; orderId: string; customerEmail: string; reason: string; aiDecision: string; confidence: number; status: "Awaiting operations" | "Approved" | "Rejected" | "Refunded"; kind?: "cancellation" | "quality_complaint"; recommendedRefundAmount?: number; attachmentName?: string };
type Audit = { id: string; actor: string; action: string; detail: string; at: string };
type CartItem = { id: string; customerEmail: string; productId: string; quantity: number };
type Ticket = { id: string; creatorEmail: string; creatorRole: Role; vendorId?: string; subject: string; category: string; priority: "Low" | "Normal" | "High" | "Urgent"; status: "Open" | "In progress" | "Waiting on user" | "Resolved"; description: string; attachmentName?: string; createdVia: "Portal" | "She Agent"; at: string };
type PayoutStatus = "Scheduled" | "Paid" | "Reversed";
type Transaction = {
  id: string; orderId: string; vendorId: string; customerEmail: string; method: string;
  grossAmount: number; commissionPercent: number; commissionAmount: number; vendorPayout: number;
  collectedAt: string; scheduledPayoutDate: string; payoutStatus: PayoutStatus; paidAt?: string; note?: string;
};
type StaffAccount = { id: string; email: string; name: string; role: "operations" | "admin"; createdBy: string; createdAt: string; mode: "live" | "local"; active: boolean };
export type Campaign = CampaignRecord;
type MerchandisingConfig = { featuredProductIds: string[]; recommendationPopupEnabled: boolean; maxFeatured: number };
type WishlistItem = { customerEmail: string; productId: string; addedAt: string };
type Review = { id: string; productId: string; vendorId: string; customerEmail: string; customerName: string; rating: number; comment: string; createdAt: string };
type TasteProfileRow = { customerEmail: string; weights: TasteWeights; onboarded: boolean };

export type V3State = {
  customers: CustomerProfile[]; vendors: Vendor[]; products: Product[]; schedules: Schedule[];
  orders: Order[]; thirdPartyDeliveries: ThirdPartyDeliveryRequest[]; thirdPartyDeliveryAvailable: boolean; staff: Staff[]; assignments: Assignment[]; requirements: Requirement[];
  quotes: Quote[]; markups: Record<string, number>; notifications: Notification[];
  cancellations: Cancellation[]; audit: Audit[];
  cart: CartItem[]; tickets: Ticket[]; transactions: Transaction[]; staffAccounts: StaffAccount[];
  campaigns: Campaign[]; merchandising: MerchandisingConfig; merchandisingError?: string | null;
  wishlist: WishlistItem[]; reviews: Review[];
  tasteProfiles: TasteProfileRow[]; productAttributes: Record<string, TasteWeights>;
  foodDrops: FoodDrop[]; foodDropClaims: FoodDropClaim[];
  deliverySlots?: VendorDeliverySlot[];
};

const EMPTY_STATE: V3State = {
customers: [], vendors: [], products: [], schedules: [], orders: [], thirdPartyDeliveries: [], thirdPartyDeliveryAvailable: false, staff: [], assignments: [],  requirements: [], quotes: [], markups: {}, notifications: [], cancellations: [], audit: [], cart: [], tickets: [],
  transactions: [], staffAccounts: [], campaigns: [], merchandising: { featuredProductIds: [], recommendationPopupEnabled: true, maxFeatured: 6 },
  wishlist: [], reviews: [], tasteProfiles: [], productAttributes: {},
  foodDrops: [], foodDropClaims: [], deliverySlots: [],
};

function stateWithoutInlineProductImages(state: V3State): V3State {
  return {
    ...state,
    products: state.products.map((product) => ({
      ...product,
      imageUrl: product.imageUrl?.startsWith("data:") ? undefined : product.imageUrl,
      originalImageUrl: product.originalImageUrl?.startsWith("data:") ? undefined : product.originalImageUrl,
    })),
  };
}

function isStorageQuotaError(error: unknown): boolean {
  return error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014);
}

const REVIEW_COMMENT_BANK = [
  "Always fresh and delivered on time.", "Great quality for the price, will order again.",
  "Packaging was neat and the quantity was accurate.", "Tastes just like home-made — loved it.",
  "Good product, delivery could be a bit faster.", "Consistent quality every single time.",
  "My family's new favourite from this vendor.", "Fresh stock, no complaints at all.",
  "Value for money and reliable service.", "Exactly as described, nicely packed.",
];
const REVIEW_NAME_BANK = ["Priya", "Arun", "Lakshmi", "Karthik", "Divya", "Suresh", "Meena", "Vignesh", "Anitha", "Ramesh"];
/** Deterministic pseudo-random int in [min,max] seeded from a string, so the
 * same product always gets the same seeded reviews across reloads instead of
 * reshuffling every render. */
function seededInt(seed: string, min: number, max: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return min + (hash % (max - min + 1));
}
/** Dummy reviews for every real product currently loaded, so ratings show up
 * immediately without requiring real customers to have left feedback yet.
 * Only fills in for products that don't already have a review (safe to call
 * repeatedly as new products appear in the marketplace). */
function seedReviewsForProducts(products: Product[], vendors: Vendor[], existing: Review[]): Review[] {
  const covered = new Set(existing.map((r) => r.productId));
  const seeded: Review[] = [];
  for (const product of products) {
    if (covered.has(product.id)) continue;
    const vendor = vendors.find((v) => v.id === product.vendorId);
    const count = seededInt(product.id + "n", 2, 5);
    for (let i = 0; i < count; i++) {
      const seed = `${product.id}-${i}`;
      const rating = seededInt(seed + "r", 3, 5);
      seeded.push({
        id: `RVW-${product.id}-${i}`, productId: product.id, vendorId: vendor?.id || product.vendorId,
        customerEmail: `demo${seededInt(seed, 0, 999)}@sheplates.demo`,
        customerName: REVIEW_NAME_BANK[seededInt(seed + "name", 0, REVIEW_NAME_BANK.length - 1)],
        rating, comment: REVIEW_COMMENT_BANK[seededInt(seed + "c", 0, REVIEW_COMMENT_BANK.length - 1)],
        createdAt: new Date(Date.now() - seededInt(seed + "d", 1, 60) * 86400000).toISOString().slice(0, 10),
      });
    }
  }
  return seeded;
}
function productRating(productId: string, reviews: Review[]) {
  const mine = reviews.filter((r) => r.productId === productId);
  if (!mine.length) return null;
  return { average: mine.reduce((sum, r) => sum + r.rating, 0) / mine.length, count: mine.length };
}
function StarRow({ value, size = "size-3.5" }: { value: number; size?: string }) {
  return <span className="inline-flex items-center">{[1, 2, 3, 4, 5].map((n) => (
    <Star key={n} className={`${size} ${n <= Math.round(value) ? "fill-[#e3a008] text-[#e3a008]" : "fill-stone-200 text-stone-200"}`} />
  ))}</span>;
}

// --- Taste Match --------------------------------------------------------
// The customer's own weight vector and every product's attribute vector are
// kept in local V3State (so the feature is fully interactive this session
// even before the V8_1 migration is applied) and mirrored to Supabase on a
// best-effort basis — see loadLiveTasteProfile/saveLiveTasteProfile in
// lib/supabase.ts. Once that migration lands, the same reads/writes start
// reflecting a real, durable, access-controlled row automatically.
function tasteProfileFor(state: V3State, email: string): TasteProfileRow {
  return state.tasteProfiles.find((p) => p.customerEmail === email) || { customerEmail: email, weights: {}, onboarded: false };
}
function upsertTasteProfile(state: V3State, email: string, weights: TasteWeights, onboarded: boolean): V3State {
  return { ...state, tasteProfiles: [{ customerEmail: email, weights, onboarded }, ...state.tasteProfiles.filter((p) => p.customerEmail !== email)] };
}
function attributesFor(state: V3State, product: Product): TasteWeights {
  return state.productAttributes[product.id] || inferAttributesLocally(product.name, product.category);
}
/** Records a taste signal for one product: updates the customer's weight
 * vector (locally, immediately) and mirrors both the feedback event and the
 * resulting profile to Supabase in the background. */
function recordTasteSignal(state: V3State, setState: React.Dispatch<React.SetStateAction<V3State>>, session: DemoSession, product: Product, signal: TasteSignal) {
  const profile = tasteProfileFor(state, session.email);
  const attributes = attributesFor(state, product);
  const nextWeights = applyTasteSignal(profile.weights, attributes, signal);
  setState((s) => upsertTasteProfile(s, session.email, nextWeights, profile.onboarded || Object.keys(nextWeights).length > 0));
  if (session.userId) {
    void recordLiveTasteFeedback(session.userId, product.id, signal);
    void saveLiveTasteProfile(session.userId, nextWeights, true);
  }
}
function TasteMatchBadge({ state, setState, session, product }: { state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; session: DemoSession; product: Product }) {
  const [open, setOpen] = useState(false);
  const profile = tasteProfileFor(state, session.email);
  if (!Object.keys(profile.weights).length) return null;
  const attributes = attributesFor(state, product);
  const { score, contributions } = tasteMatchScore(profile.weights, attributes);
  if (score < 30) return null;
  const tone = score >= 80 ? "bg-[#f7edf0] text-[#292124] border-[#e8cbd5]" : score >= 55 ? "bg-[#fdf3e2] text-[#8a5a00] border-[#f0d9a8]" : "bg-stone-100 text-stone-600 border-stone-200";
  return <span className="relative inline-block">
    <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${tone}`}><Flame className="size-3" />{score}% Taste Match</button>
    {open && <div className="absolute left-0 top-full z-30 mt-1.5 w-56 rounded-2xl border border-stone-200/80 bg-white p-3.5 text-left shadow-xl" onClick={(e) => e.stopPropagation()}>
      <div className="text-xs font-black text-[#292124]">{score}% Taste Match</div>
      {contributions.length ? <p className="mt-1.5 text-[11px] leading-5 text-stone-500">Because you like: <span className="font-bold text-stone-700">{contributions.slice(0, 3).map((c) => TASTE_DIMENSION_LABELS[c.dimension as keyof typeof TASTE_DIMENSION_LABELS] || c.dimension).join(" • ")}</span></p> : <p className="mt-1.5 text-[11px] text-stone-500">Based on your taste profile.</p>}
      <div className="mt-2.5 flex gap-1.5">
        <button type="button" onClick={() => { recordTasteSignal(state, setState, session, product, "more_like_this"); toast.success("We'll show you more like this"); setOpen(false); }} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#f7edf0] px-2 py-1.5 text-[11px] font-black text-[#292124]"><ThumbsUp className="size-3" />More like this</button>
        <button type="button" onClick={() => { recordTasteSignal(state, setState, session, product, "less_like_this"); toast.success("Got it — we'll show less like this"); setOpen(false); }} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-stone-100 px-2 py-1.5 text-[11px] font-black text-stone-600"><ThumbsDown className="size-3" />Less like this</button>
      </div>
    </div>}
  </span>;
}
/** Shown once per un-onboarded customer at the top of Marketplace. Skipping
 * still marks the profile onboarded (with whatever weights already exist)
 * so the banner doesn't reappear — Taste Match then keeps learning purely
 * from view/save/order signals instead. */
function TasteOnboardingBanner({ state, setState, session }: { state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; session: DemoSession }) {
  const profile = tasteProfileFor(state, session.email);
  const [selected, setSelected] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);
  if (profile.onboarded || dismissed) return null;
  function toggle(dimension: string) { setSelected((list) => list.includes(dimension) ? list.filter((x) => x !== dimension) : [...list, dimension]); }
  function finish(skip: boolean) {
    const weights = skip ? profile.weights : weightsFromSetupChoices(selected);
    setState((s) => upsertTasteProfile(s, session.email, weights, true));
    if (session.userId) void saveLiveTasteProfile(session.userId, weights, true);
    setDismissed(true);
    if (!skip) toast.success("Thanks — Taste Match is now personalizing your marketplace");
  }
  return <section className="sp-ai-card relative overflow-hidden rounded-[30px] p-5 sm:p-6">
    <button onClick={() => finish(true)} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-stone-100" aria-label="Skip taste setup"><X className="size-4" /></button>
    <div className="pr-12"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#653046]"><Flame className="size-4" />Taste Match</div><h2 className="mt-2 text-lg font-black tracking-[-.02em]">What tastes like you?</h2><p className="mt-1 max-w-3xl text-sm text-stone-500">Pick a few things you enjoy — we&apos;ll show a Taste Match % on products and learn more from what you view, save and order.</p></div>
    <div className="mt-5 flex flex-wrap gap-2">{TASTE_SETUP_CHOICES.map((dimension) => <button type="button" key={dimension} onClick={() => toggle(dimension)} className={`rounded-full border px-3 py-2 text-sm font-bold ${selected.includes(dimension) ? "border-[#753b50] bg-[#f7edf0] text-[#292124]" : "bg-white text-stone-500"}`}>{TASTE_DIMENSION_LABELS[dimension]}</button>)}</div>
    <div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => finish(false)} disabled={!selected.length} className="rounded-xl bg-[#292124]"><Check />Continue</Button><Button variant="outline" onClick={() => finish(true)} className="rounded-xl">Skip for now</Button></div>
  </section>;
}
const PLATFORM_COMMISSION_PERCENT = 8;
const PAYOUT_CYCLE_DAYS = 7;
const STAFF_KEY = "sheplates-v3-staff-accounts";
const STORE_KEY = "sheplates-v3-state";
const SESSION_KEY = "sheplates-v3-session";
const roleName: Record<Role, string> = { customer: "Customer", vendor: "Vendor", operations: "Operations", admin: "Super admin" };
const nav: Record<Role, string[]> = {
  customer: ["Marketplace", "Maps", "Schedules", "Food Drops", "Stories", "Profile", "Cart", "Wishlist", "My schedule", "Monthly requirement", "My quotations", "Orders", "Profile & food", "Ticket centre"],
  vendor: ["Dashboard", "AI insights", "Online shop & POS", "Store & radius", "Verification", "Catalog", "Food Drops", "Food Shorts", "Quote opportunities", "Orders", "Delivery team", "People followers", "Settlements", "Ticket centre"],
  operations: ["Command centre", "AI insights", "P0 Connect vendors", "Vendor onboarding", "Vendor verification", "Store & radius", "Item pricing", "RFQ desk", "Orders", "Cancellations", "Vendor payments", "Reports", "Stories monitor", "Ticket centre"],
  admin: ["Executive view", "AI insights", "Homepage & campaigns", "Users", "P0 Connect vendors", "Vendors", "Vendor plans", "Pricing policies", "Orders", "Vendor payments", "Reports", "Stories monitor", "Ticket centre", "Audit log"],
};
const navIcons: Record<string, typeof Store> = {
  "Stories monitor": Play,
  Marketplace: ShoppingBag, Cart: ShoppingCart, Wishlist: Heart, "My schedule": CalendarDays, "Monthly requirement": ListChecks, "My quotations": ClipboardCheck,
  Orders: Package, "Profile & food": HeartPulse, Dashboard: LayoutDashboard, "Vendor workspace": LayoutDashboard, "Store & radius": MapPin, "People followers": Users,
  Verification: BadgeCheck, Catalog: ShoppingBag, "Online shop & POS": Building2, "Food Drops": Zap, "Food Shorts": Clapperboard, "Quote opportunities": ClipboardCheck, "Delivery team": Truck,
  "Command centre": LayoutDashboard, "Vendor onboarding": UserPlus, "Vendor verification": FileCheck2,
  "P0 Connect vendors": MapPinned,
  "Item pricing": Percent, "RFQ desk": ClipboardCheck, Cancellations: RefreshCcw, "Executive view": LayoutDashboard,
  Users, Vendors: Store, "Vendor plans": WalletCards, "Pricing policies": Settings, "Audit log": Activity, "Ticket centre": TicketCheck, "AI insights": Sparkles, "Homepage & campaigns": Megaphone,
  Settlements: WalletCards, "Vendor payments": IndianRupee, Reports: FileSpreadsheet,
};
type SellingSpec = { key: string; label: string; amount: number; measure: string; emoji: string };
const weightPacks = (emoji: string): SellingSpec[] => [
  { key: "250-g", label: "250 g pack", amount: 250, measure: "g", emoji },
  { key: "500-g", label: "500 g pack", amount: 500, measure: "g", emoji },
  { key: "1-kg", label: "1 kg pack", amount: 1, measure: "kg", emoji },
];
const volumePacks = (emoji: string): SellingSpec[] => [
  { key: "250-ml", label: "250 ml pouch/bottle", amount: 250, measure: "ml", emoji },
  { key: "500-ml", label: "500 ml pouch/bottle", amount: 500, measure: "ml", emoji },
  { key: "1-litre", label: "1 litre pouch/bottle", amount: 1, measure: "litre", emoji },
];
const unitsByCategory: Record<string, SellingSpec[]> = {
  "Milk & dairy": [...volumePacks("🥛"), ...weightPacks("🥣")],
  "Home food": [{ key: "meal", label: "1 complete meal", amount: 1, measure: "meal", emoji: "🍱" }, { key: "portion", label: "1 portion", amount: 1, measure: "portion", emoji: "🍲" }],
  Caterer: [{ key: "meal", label: "1 complete meal", amount: 1, measure: "meal", emoji: "🍽️" }, { key: "portion", label: "1 portion", amount: 1, measure: "portion", emoji: "🍱" }],
  "Meat & fish": [...weightPacks("🍗"), { key: "piece", label: "1 whole piece", amount: 1, measure: "piece", emoji: "🐟" }],
  Vegetables: [...weightPacks("🥬"), { key: "bundle", label: "1 bundle", amount: 1, measure: "pack", emoji: "🥦" }],
  Groceries: [...weightPacks("🛍️"), ...volumePacks("🫗"), { key: "piece", label: "1 retail pack/piece", amount: 1, measure: "pack", emoji: "📦" }],
  Eggs: [{ key: "egg", label: "1 egg", amount: 1, measure: "piece", emoji: "🥚" }, { key: "six-eggs", label: "Pack of 6 eggs", amount: 6, measure: "piece", emoji: "🥚" }, { key: "dozen", label: "Tray of 12 eggs", amount: 12, measure: "piece", emoji: "🥚" }],
  Bakery: [{ key: "piece", label: "1 piece", amount: 1, measure: "piece", emoji: "🥖" }, ...weightPacks("🍞")],
  Snacks: [{ key: "piece", label: "1 piece", amount: 1, measure: "piece", emoji: "🍿" }, ...weightPacks("🍿")],
  "Rice & staples": [...weightPacks("🍚"), { key: "5-kg", label: "5 kg bag", amount: 5, measure: "kg", emoji: "🍚" }, { key: "25-kg", label: "25 kg bag", amount: 25, measure: "kg", emoji: "🍚" }],
  Other: [{ key: "piece", label: "1 pack or item", amount: 1, measure: "pack", emoji: "📦" }, ...weightPacks("📦")],
};
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const categoryNames = Object.keys(unitsByCategory);

function id(prefix: string) { return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`; }
function now() { return new Date().toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); }
function localDateISO(date = new Date()) { const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return shifted.toISOString().slice(0, 10); }
function tomorrow() { const date = new Date(); date.setDate(date.getDate() + 1); return localDateISO(date); }
function money(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value); }
function finalPrice(product: Product, state: V3State) { return Math.round(product.vendorPrice * (1 + (state.markups[product.id] || 0) / 100) * 100) / 100; }
function vendorFor(state: V3State, session: DemoSession) { return state.vendors.find((v) => v.ownerEmail === session.email); }
function notificationBelongsToSession(item: Notification, session: DemoSession) {
  return item.recipientRole === session.role && item.recipient.toLowerCase() === session.email.toLowerCase();
}
function hasPlaceholderAddress(address?: string) { return !address || /detected location|detected coordinates|saved address|add flat|add store address/i.test(address); }
function distanceKm(aLat?: number, aLng?: number, bLat?: number, bLng?: number) {
  if (![aLat, aLng, bLat, bLng].every(Number.isFinite)) return null;
  const radians = (value: number) => value * Math.PI / 180;
  const lat1 = radians(aLat!); const lat2 = radians(bLat!);
  const deltaLat = radians(bLat! - aLat!); const deltaLng = radians(bLng! - aLng!);
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
function productServing(product: Product) {
  if (product.packAmount && product.packMeasure) return { amount: product.packAmount, unit: product.packMeasure };
  if (product.baseUnit === "kg") return { amount: 1, unit: "kg" };
  if (product.baseUnit === "litre") return { amount: 1, unit: "litre" };
  if (product.baseUnit === "dozen") return { amount: 12, unit: "piece" };
  return { amount: 1, unit: product.baseUnit };
}
function migrateLegacyProduct(product: Product): Product {
  if (product.packAmount && product.packMeasure) return product;
  const step = product.quantityStep || 1;
  if (product.baseUnit === "kg") {
    const amount = step < 1 ? step * 1000 : step;
    const measure = step < 1 ? "g" : "kg";
    return { ...product, baseUnit: `${amount} ${measure} pack`, packAmount: amount, packMeasure: measure, quantityStep: 1, vendorPrice: Math.round(product.vendorPrice * step * 100) / 100, stock: Math.max(0, Math.floor(product.stock / step)) };
  }
  if (product.baseUnit === "litre") {
    const amount = step < 1 ? step * 1000 : step;
    const measure = step < 1 ? "ml" : "litre";
    return { ...product, baseUnit: `${amount} ${measure} pouch/bottle`, packAmount: amount, packMeasure: measure, quantityStep: 1, vendorPrice: Math.round(product.vendorPrice * step * 100) / 100, stock: Math.max(0, Math.floor(product.stock / step)) };
  }
  const labels: Record<string, { label: string; amount: number; measure: string }> = {
    piece: { label: "1 piece", amount: 1, measure: "piece" }, meal: { label: "1 complete meal", amount: 1, measure: "meal" },
    portion: { label: "1 portion", amount: 1, measure: "portion" }, dozen: { label: "Tray of 12 eggs", amount: 12, measure: "piece" },
    bundle: { label: "1 bundle", amount: 1, measure: "pack" }, bag: { label: "1 retail bag", amount: 1, measure: "pack" },
  };
  const replacement = labels[product.baseUnit];
  return replacement ? { ...product, baseUnit: replacement.label, packAmount: replacement.amount, packMeasure: replacement.measure, quantityStep: 1 } : product;
}
function repairSavedState(raw: V3State): V3State {
  return {
    ...EMPTY_STATE,
    ...raw,
    customers: (raw.customers || []).map((profile) => ({
      ...profile,
      address: hasPlaceholderAddress(profile.address) ? (profile.latitude && profile.longitude ? `GPS pin ${profile.latitude.toFixed(5)}, ${profile.longitude.toFixed(5)} — confirm address` : "Location not confirmed") : profile.address,
      phone: profile.phone || "",
      addresses: profile.addresses?.length ? profile.addresses : [{ id: id("ADR"), label: "Home", address: profile.address, latitude: profile.latitude, longitude: profile.longitude, isDefault: true }],
    })),
    products: (raw.products || []).map((savedProduct) => {
      const product = migrateLegacyProduct(savedProduct);
      const current: Nutrition = { calories: product.calories, protein: product.protein, carbs: product.carbs, fat: product.fat, fibre: product.fibre };
      const hasNutrition = Object.values(current).some((value) => Number(value) > 0);
      return { ...product, nutritionStatus: product.nutritionStatus || (hasNutrition && nutritionLooksConsistent(current) ? "Estimated" : "Pending review") };
    }),
    // Notifications saved by earlier builds did not include a role boundary.
    // Discard those ambiguous entries instead of risking cross-role disclosure.
    notifications: (raw.notifications || []).filter((item) => Boolean(item.recipientRole)),
    cart: raw.cart || [],
    thirdPartyDeliveries: raw.thirdPartyDeliveries || [],
    thirdPartyDeliveryAvailable: raw.thirdPartyDeliveryAvailable || false,
    wishlist: raw.wishlist || [],
    tickets: raw.tickets || [],
    transactions: raw.transactions || [],
    staffAccounts: raw.staffAccounts || [],
    campaigns: raw.campaigns || [],
    merchandising: raw.merchandising || { featuredProductIds: [], recommendationPopupEnabled: true, maxFeatured: 6 },
  };
}
function addDaysISO(dateISO: string, days: number) {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
function todayISO() { return localDateISO(new Date()); }
function payoutDateFor(collectedDateISO: string) { return addDaysISO(collectedDateISO, PAYOUT_CYCLE_DAYS); }
function weekdayLabel(dateISO: string) { return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${dateISO}T12:00:00`).getDay()]; }
/** Every date within `rangeDates` on which this schedule actually delivers — used so the
 * calendar and reschedule preview show ALL chosen weekdays, not just the anchor start date. */
function occurrenceDatesInRange(schedule: Schedule, rangeDates: string[]): string[] {
  if ((schedule.status || "Active") !== "Active") return [];
  return rangeDates.filter((date) => {
    if (date < schedule.startDate) return false;
    if (schedule.endDate && date > schedule.endDate) return false;
    if (schedule.recurrence === "Once") return date === schedule.startDate;
    if (schedule.recurrence === "Daily") return true;
    if (schedule.recurrence === "Weekly") return weekdayLabel(date) === weekdayLabel(schedule.startDate);
    return schedule.weekdays.includes(weekdayLabel(date));
  });
}
function recordTransaction(order: Order, method: string): Transaction {
  const commissionAmount = Math.round(order.total * (PLATFORM_COMMISSION_PERCENT / 100) * 100) / 100;
  const collectedAt = todayISO();
  return {
    id: id("TXN"), orderId: order.id, vendorId: order.vendorId, customerEmail: order.customerEmail, method,
    grossAmount: order.total, commissionPercent: PLATFORM_COMMISSION_PERCENT, commissionAmount,
    vendorPayout: Math.round((order.total - commissionAmount) * 100) / 100,
    collectedAt, scheduledPayoutDate: payoutDateFor(collectedAt), payoutStatus: "Scheduled",
  };
}
function readLocalStaffAccounts(): (StaffAccount & { password: string })[] {
  try { return JSON.parse(localStorage.getItem(STAFF_KEY) || "[]"); } catch { return []; }
}
function writeLocalStaffAccounts(list: (StaffAccount & { password: string })[]) {
  try { localStorage.setItem(STAFF_KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
}
function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function verificationFromLive(value: string): Verification {
  const labels: Record<string, Verification> = { draft: "Draft", submitted: "Submitted", under_review: "Under review", changes_required: "Changes required", verified: "Verified", rejected: "Rejected", expired: "Changes required" };
  return labels[value] || "Draft";
}
function planFromCode(code?: string | null): Vendor["plan"] {
  return code === "crown" ? "Crown" : code === "thrive" ? "Thrive" : code === "taster" ? "Taster" : "Crave";
}
function planCodeFromEmbed(embed: LiveVendorRow["vendor_plans"]): string | undefined {
  return (Array.isArray(embed) ? embed[0] : embed)?.code;
}
function operationalFromLive(value: string): Vendor["operational"] {
  return value === "active" ? "Active" : value === "paused" ? "Paused" : "Inactive";
}
function vendorFromLive(row: LiveVendorRow, identity?: { email?: string; name?: string }, document?: Record<string, unknown>): Vendor {
  return {
    id: row.id, ownerEmail: identity?.email || "vendor@sheplates.local", ownerName: identity?.name || "Vendor",
    businessName: row.name, category: row.category, address: row.address || row.locality,
    latitude: row.latitude === null ? undefined : Number(row.latitude), longitude: row.longitude === null ? undefined : Number(row.longitude),
    radiusKm: Number(row.service_radius_km), delivery: row.delivery_enabled, pickup: row.pickup_enabled,
    openToday: row.store_open_today, verification: verificationFromLive(row.verification_status),
    operational: operationalFromLive(row.operational_status), plan: planFromCode(planCodeFromEmbed(row.vendor_plans)),
    vendorKind: row.vendor_kind || "subscription",
    fssaiNumber: String(document?.document_number || "Submitted"),
    certificateName: String(document?.storage_path || "Private certificate"), expiryDate: String(document?.expiry_date || "—"),
  };
}
function productFromLive(row: LiveMenuItemRow): Product {
  return {
    id: row.id, vendorId: row.vendor_id, name: row.name, category: row.category,
    emoji: unitsByCategory[row.category]?.[0]?.emoji || "📦", baseUnit: row.unit,
    quantityStep: Number(row.quantity_step || 1), vendorPrice: Number(row.vendor_base_price),
    stock: Number(row.stock_quantity), active: row.active, calories: Number(row.calories_per_unit),
    protein: Number(row.protein_g), carbs: Number(row.carbs_g), fat: Number(row.fat_g), fibre: Number(row.fibre_g),
    dietaryTags: row.dietary_tags || [], packAmount: row.pack_amount === null ? undefined : Number(row.pack_amount),
    packMeasure: row.pack_measure || undefined, imageUrl: row.image_url || undefined,
    nutritionStatus: row.nutrition_status === "verified" ? "Verified" : row.nutrition_status === "estimated" ? "Estimated" : (Number(row.calories_per_unit) > 0 ? "Estimated" : "Pending review"),
    nutritionConfidence: row.nutrition_confidence == null ? undefined : Number(row.nutrition_confidence),
    nutritionNote: row.nutrition_note || undefined,
  };
}
function marketplaceProductFromLive(row: LiveMarketplaceRow): Product {
  return {
    id: row.item_id, vendorId: row.vendor_id, name: row.item_name, category: row.category,
    emoji: unitsByCategory[row.category]?.[0]?.emoji || "📦", baseUnit: row.unit,
    quantityStep: Number(row.quantity_step || 1), vendorPrice: Number(row.customer_price),
    stock: Number(row.stock_quantity), active: true, calories: Number(row.calories_per_unit),
    protein: Number(row.protein_g), carbs: Number(row.carbs_g), fat: Number(row.fat_g), fibre: Number(row.fibre_g),
    dietaryTags: row.dietary_tags || [], packAmount: row.pack_amount === null ? undefined : Number(row.pack_amount),
    packMeasure: row.pack_measure || undefined, liveDistanceKm: Number(row.distance_km), imageUrl: row.image_url || undefined,
    nutritionStatus: Number(row.calories_per_unit) > 0 ? "Estimated" : "Pending review",
  };
}

function liveOrderStatus(value: unknown): Order["status"] {
  const map: Record<string, Order["status"]> = {
    awarded: "Scheduled", confirmed: "Confirmed", preparing: "Preparing", ready: "Ready",
out_for_delivery: "Out for delivery", ready_for_pickup: "Ready for pickup", completed: "Completed", delivered: "Delivered",    cancellation_requested: "Cancellation requested", cancelled: "Cancelled",
  };
  return map[String(value || "")] || "Scheduled";
}
function livePaymentStatus(payments: unknown, orderStatus?: unknown): Order["payment"] {
  const rows = Array.isArray(payments) ? payments as Array<Record<string, unknown>> : [];
  const statuses = rows.map((row) => String(row.status || "").toLowerCase()).filter(Boolean);
  if (statuses.some((status) => status === "refunded")) return "Refunded";
  if (statuses.some((status) => status.includes("reversal"))) return "Reversal pending";
  if (statuses.some((status) => ["paid", "captured", "success", "succeeded"].includes(status))) return "Paid";
const progressed = ["confirmed", "preparing", "ready", "out_for_delivery", "ready_for_pickup", "completed", "delivered"].includes(String(orderStatus || "").toLowerCase());  return progressed ? "Paid" : "Pending";
}
type LiveCommerceStateSnapshot = { orders?: Array<Record<string, unknown>>; schedules?: Array<Record<string, unknown>>; staff?: Array<Record<string, unknown>>; assignments?: Array<Record<string, unknown>>; thirdPartyDeliveries?: Array<Record<string, unknown>>; thirdPartyDeliveryAvailable?: boolean; cart?: Record<string, unknown> | null; cartItems?: Array<Record<string, unknown>>; deliverySlots?: Array<Record<string, unknown>> };function mergeLiveCommerce(current: V3State, snapshot: LiveCommerceStateSnapshot, session: DemoSession): V3State {
  const orderRows = snapshot.orders || [];
  const orders: Order[] = orderRows.map((row) => {
    const items = Array.isArray(row.order_items) ? row.order_items as Array<Record<string, unknown>> : [];
    const first = items[0];
    const fulfilmentMode = String(row.fulfilment_mode);
    const isThirdParty = fulfilmentMode === "third_party_delivery";
    const payments = Array.isArray(row.payments) ? row.payments as Array<Record<string, unknown>> : [];
    const firstPayment = payments[0];
    return {
      id: String(row.id), scheduleId: row.schedule_id ? String(row.schedule_id) : undefined,
      customerEmail: session.role === "customer" ? session.email : String(row.customer_id || "customer"), vendorId: String(row.vendor_id),
      productId: first ? current.products.find((product) => product.vendorId === String(row.vendor_id) && product.name.trim().toLowerCase() === String(first.product_name || "").trim().toLowerCase())?.id : undefined,
      description: items.length ? items.map((item) => String(item.product_name || "Item")).join(", ") : String(row.order_number || "Order"),
      quantity: Number(first?.quantity || items.length || 1), unit: String(first?.unit || "items"), total: Number(row.customer_total || 0),
      date: String(row.scheduled_date || ""), slot: String(row.scheduled_slot || "Vendor to confirm"),
      deliveryAddress: typeof row.delivery_address === "string" ? row.delivery_address : undefined,
mode: isThirdParty ? "Third-party delivery" : fulfilmentMode === "self_pickup" ? "Self pickup" : "Vendor delivery",      status: liveOrderStatus(row.status), payment: livePaymentStatus(row.payments, row.status),
      trackingLatitude: row.tracking_latitude == null ? undefined : Number(row.tracking_latitude),
      trackingLongitude: row.tracking_longitude == null ? undefined : Number(row.tracking_longitude),
      cancellationFee: Number(row.cancellation_fee || 0),
      orderNumber: row.order_number ? String(row.order_number) : undefined,
      paymentReference: firstPayment?.provider_reference ? String(firstPayment.provider_reference) : undefined,
      paymentProvider: firstPayment?.provider ? String(firstPayment.provider) : undefined,
      createdAt: row.created_at ? String(row.created_at) : undefined,
      items: items.map((it) => ({
        name: String(it.product_name || "Item"),
        quantity: Number(it.quantity || 1),
        unit: it.unit ? String(it.unit) : undefined,
        price: it.customer_price != null ? Number(it.customer_price) : undefined,
      })),
    };
  });
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const schedules: Schedule[] = (snapshot.schedules || []).map((row) => ({
    id: String(row.id), customerEmail: session.role === "customer" ? session.email : String(row.customer_id || "customer"), productId: String(row.menu_item_id), vendorId: String(row.vendor_id),
    startDate: String(row.start_date), endDate: row.end_date ? String(row.end_date) : "", recurrence: (String(row.recurrence || "once")[0].toUpperCase() + String(row.recurrence || "once").slice(1)) as Schedule["recurrence"],
    weekdays: Array.isArray(row.weekdays) ? (row.weekdays as number[]).map((day) => dayNames[Number(day)]).filter(Boolean) : [], timeSlot: String(row.scheduled_slot),
quantity: Number(row.quantity || 1), unit: String(row.unit || "pack"), mode: String(row.fulfilment_mode) === "third_party_delivery" ? "Third-party delivery" : String(row.fulfilment_mode) === "self_pickup" ? "Self pickup" : "Vendor delivery",    estimatedOccurrences: 1, status: String(row.status || "active") === "paused" ? "Paused" : String(row.status || "active") === "cancelled" ? "Cancelled" : String(row.status || "active") === "completed" ? "Completed" : String(row.status || "active") === "awaiting_payment" ? "Awaiting payment" : "Active",
    nextDeliveryAt: row.next_delivery_at ? String(row.next_delivery_at) : undefined, whatsappReminder: row.whatsapp_reminder_enabled !== false,
  }));
  const orderScheduleIds = new Set(orders.map((order) => order.scheduleId).filter(Boolean) as string[]);
  const preservedSchedules = current.schedules.filter((schedule) => orderScheduleIds.has(schedule.id) && !schedules.some((live) => live.id === schedule.id));
  const mergedSchedules = [...schedules, ...preservedSchedules];
  const staff: Staff[] = (snapshot.staff || []).map((row) => ({ id: String(row.id), vendorId: String(row.vendor_id), name: String(row.full_name || "Delivery person"), phone: String(row.phone || ""), active: row.active !== false }));
  const assignments: Assignment[] = (snapshot.assignments || []).map((row) => ({ id: String(row.id), orderId: String(row.order_id), staffId: String(row.delivery_staff_id), assignedAt: String(row.assigned_at || "") }));
  const thirdPartyDeliveries: ThirdPartyDeliveryRequest[] = (snapshot.thirdPartyDeliveries || []).map((row) => ({
    orderId: String(row.order_id), customerId: String(row.customer_id), vendorId: String(row.vendor_id),
    notes: String(row.customer_notes || ""), status: String(row.status || "pending") as ThirdPartyDeliveryRequest["status"],
    acceptedAt: row.accepted_at ? String(row.accepted_at) : undefined,
    codeExpiresAt: row.code_expires_at ? String(row.code_expires_at) : undefined,
    codeIssuedCount: Number(row.code_issued_count || 0),
    deliveredAt: row.delivered_at ? String(row.delivered_at) : undefined,
  }));
  const syncedCart: CartItem[] = session.role === "customer" ? (snapshot.cartItems || []).map((row) => ({ id: String(row.id), customerEmail: session.email, productId: String(row.menu_item_id), quantity: Math.max(0.001, Number(row.quantity || 1)) })) : [];
  const cart = session.role === "customer" ? [...current.cart.filter((item) => item.customerEmail !== session.email), ...syncedCart] : current.cart;
  return {
    ...current, orders, schedules: mergedSchedules, staff, assignments, thirdPartyDeliveries, cart,
    thirdPartyDeliveryAvailable: snapshot.thirdPartyDeliveryAvailable === true,
  };
}
async function findLocation(params: { lat?: number; lng?: number; address?: string }) {
  const query = params.address ? `q=${encodeURIComponent(params.address)}` : `lat=${params.lat}&lng=${params.lng}`;
  const response = await fetch(`/api/geocode?${query}`);
  const result = await response.json() as { address?: string; latitude?: number; longitude?: number; error?: string };
  if (!response.ok || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) throw new Error(result.error || "Location was not found");
  return result as { address: string; latitude: number; longitude: number };
}

type PlaceSuggestion = { address: string; latitude: number; longitude: number };

/** Debounced type-ahead over the same free Nominatim geocoder `findLocation` already
 * uses, so typing an address shows 3-5 real suggestions instead of requiring an
 * explicit "Find typed address" click. Selecting one still stores lat/lng as the
 * source of truth, exactly like the GPS and manual-search paths. */
function LocationSuggestions({ query, onSelect }: { query: string; onSelect: (place: PlaceSuggestion) => void }) {
  const trimmed = query.trim();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [dismissed, setDismissed] = useState("");
  useEffect(() => {
    setSuggestions([]);
    if (trimmed.length < 3 || trimmed === dismissed) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}&suggest=1`);
        const data = await response.json() as { suggestions?: PlaceSuggestion[] };
        if (!cancelled) setSuggestions(data.suggestions || []);
      } catch { if (!cancelled) setSuggestions([]); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [trimmed, dismissed]);
  const visibleSuggestions = trimmed.length >= 3 && trimmed !== dismissed ? suggestions : [];
  if (!visibleSuggestions.length) return null;
  return (
    <div className="relative z-10 -mt-2 space-y-1 rounded-2xl border border-stone-200 bg-white/95 p-1.5 shadow-lg backdrop-blur">
      {visibleSuggestions.map((item, index) => {
        const [primary, ...rest] = item.address.split(",");
        return (
          <button type="button" key={`${item.latitude}-${item.longitude}-${index}`} onClick={() => { onSelect(item); setSuggestions([]); setDismissed(item.address); }} className="flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left hover:bg-[#f7edf0]">
            <MapPin className="mt-0.5 size-4 shrink-0 text-[#653046]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-stone-800">{primary.trim()}</span>
              <span className="block truncate text-xs text-stone-500">{rest.join(",").trim()}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ShePlatesV3() {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [state, setState] = useState<V3State>(EMPTY_STATE);
  const syncEmail = session?.email;
  const syncName = session?.name;
  const syncRole = session?.role;
  const syncUserId = session?.userId;
  const syncVendorId = session?.vendorId;
  const syncSession = useMemo(() => {
    if (!syncEmail || !syncName || !syncRole) return null;
    return { email: syncEmail, name: syncName, role: syncRole, userId: syncUserId, vendorId: syncVendorId };
  }, [syncEmail, syncName, syncRole, syncUserId, syncVendorId]);
  const [active, setActive] = useState("Marketplace");
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [customerMenuOpen, setCustomerMenuOpen] = useState(false);
  const [mapsStart, setMapsStart] = useState<"People" | undefined>(undefined);
  const [agentOpen, setAgentOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const storageQuotaFallback = useRef(false);
  const storageWarningShown = useRef(false);
  const storageUnavailable = useRef(false);
  const [liveSync, setLiveSync] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [liveSyncError, setLiveSyncError] = useState("");
  const [syncVersion, setSyncVersion] = useState(0);
  const [tourOpen, setTourOpen] = useState<null | "customer" | "vendor">(null);
  const lastAlertedNotification = useRef<string>("");
  const [vendorProfileId, setVendorProfileId] = useState<string | null>(null);
  const [locationSignal, setLocationSignal] = useState(0);
  const [planProduct, setPlanProduct] = useState<Product | null>(null);
  const social = useSocial({ email: session?.role === "customer" ? session.email : "", name: session?.name ?? "", userId: session?.userId }, state.vendors, state.products);
  // Food Shorts: vendors post, customers see them by distance (the rule lives in lib/food-shorts-rules.ts and the database)
  const shortsVendor = session?.role === "vendor" ? state.vendors.find((v) => v.ownerEmail === session.email) : undefined;
  const shortsViewerCustomer = session?.role === "customer" ? state.customers.find((c) => c.email === session.email) : undefined;
  const shorts = useFoodShorts({ email: session?.email ?? "", name: session?.name ?? "", userId: session?.userId, role: session?.role, vendorId: shortsVendor?.id }, state.vendors, { latitude: shortsViewerCustomer?.latitude, longitude: shortsViewerCustomer?.longitude });
  const shortsViewer = useShortsViewer();
  // People and statuses: follow customers, find them by handle or on the map, share 24-hour view-once statuses
  const peopleUser = { email: session?.role === "customer" ? session.email : "", name: session?.name ?? "", userId: session?.userId, role: session?.role, handle: social.profile.handle, bio: social.profile.bio, privateAccount: shortsViewerCustomer?.privateAccount };
  const people = usePeople(peopleUser, { latitude: shortsViewerCustomer?.latitude, longitude: shortsViewerCustomer?.longitude });
  const [peopleRadius, setPeopleRadiusState] = useState(() => { try { const n = Number(localStorage.getItem("sheplates-people-radius")); return n >= 1 && n <= 30 ? n : 5; } catch { return 5; } });
  const setPeopleRadius = (km: number) => { setPeopleRadiusState(km); try { localStorage.setItem("sheplates-people-radius", String(km)); } catch { /* ignore */ } };
  const statuses = useStatuses(peopleUser, people, peopleRadius, state.vendors);
  const [shortsRadius, setShortsRadiusState] = useState(() => { try { const n = Number(localStorage.getItem("sheplates-shorts-radius")); return n >= 1 && n <= 30 ? n : 5; } catch { return 5; } });
  const setShortsRadius = (km: number) => { setShortsRadiusState(km); try { localStorage.setItem("sheplates-shorts-radius", String(km)); } catch { /* ignore */ } };
  const openShorts = (list: FoodShort[], index: number) => { if (list.length) shortsViewer.open(list, index); };
  function refreshDrops() {
    return loadLiveFoodDrops().then((remote) => { if (remote) setState((current) => ({ ...current, foodDrops: remote })); }).catch(() => undefined);
  }

  // The crimson customer design is scoped to signed-in customers; every other
  // portal (and the logged-out landing page) keeps the original green brand.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("theme-customer", session?.role === "customer");
    return () => root.classList.remove("theme-customer");
  }, [session?.role]);
  useEffect(() => { if (session?.role === "customer") void refreshDrops(); }, [session?.role, session?.email]);

  useEffect(() => {
    if (!hydrated || !session) return;
    const key = session.role === "customer" ? CUSTOMER_TOUR_KEY : session.role === "vendor" ? VENDOR_TOUR_KEY : null;
    if (!key || (session.toursCompleted || []).includes(key)) return;
    const timer = window.setTimeout(() => {
      // The vendor tour's targets live in the staff sidebar, which on a
      // narrow viewport is a closed hamburger drawer by default — open it
      // so the spotlighted nav items are actually visible.
      if (session.role === "vendor") setMenuOpen(true);
      setTourOpen(session.role === "customer" ? "customer" : "vendor");
    }, 900);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session?.email, session?.role]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY);
      const savedSession = localStorage.getItem(SESSION_KEY);
      queueMicrotask(() => {
        if (saved) setState(repairSavedState(JSON.parse(saved) as V3State));
        if (savedSession) {
          const parsed = JSON.parse(savedSession) as DemoSession;
          setSession(parsed);

          // Restore the last selected page for this role and account.
          const pageKey = `sheplates-v3-active-page:${parsed.role}:${parsed.email.toLowerCase()}`;
          const savedPage = localStorage.getItem(pageKey);
          setActive(
            savedPage && nav[parsed.role].includes(savedPage)
              ? savedPage
              : nav[parsed.role][0]
          );
        }
        setHydrated(true);
      });
    } catch { queueMicrotask(() => setHydrated(true)); }
  }, []);
  useEffect(() => {
    if (!hydrated || storageUnavailable.current) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(
        storageQuotaFallback.current ? stateWithoutInlineProductImages(state) : state
      ));
    } catch (error) {
      if (!isStorageQuotaError(error)) {
        storageUnavailable.current = true;
        if (!storageWarningShown.current) {
          storageWarningShown.current = true;
          toast.error(`Could not save marketplace data: ${error instanceof Error ? error.message : String(error)}`);
        }
        return;
      }
      try {
        storageQuotaFallback.current = true;
        localStorage.setItem(STORE_KEY, JSON.stringify(stateWithoutInlineProductImages(state)));
        if (!storageWarningShown.current) {
          storageWarningShown.current = true;
          toast.warning("Browser storage is full. Product photos won't be saved after a refresh.");
        }
      } catch (fallbackError) {
        storageUnavailable.current = true;
        if (!storageWarningShown.current) {
          storageWarningShown.current = true;
          toast.error(`Could not save marketplace data: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
        }
      }
    }
  }, [state, hydrated]);
  const navRole = session?.role;
  const navEmail = session?.email;
  useEffect(() => {
    const sessionRole = navRole;
    const sessionEmail = navEmail;
    if (!hydrated || !sessionRole || !sessionEmail) return;

    // Persist the active main navigation page per role and account.
    const pageKey = `sheplates-v3-active-page:${sessionRole}:${sessionEmail.toLowerCase()}`;
    if (nav[sessionRole].includes(active)) {
      localStorage.setItem(pageKey, active);
    }
  }, [active, hydrated, navEmail, navRole]);
  useEffect(() => { if (!hydrated) return; if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session)); else localStorage.removeItem(SESSION_KEY); }, [session, hydrated]);
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined); }, []);
  useEffect(() => {
    if (!session) return;
    const newest = state.notifications.find((item) => notificationBelongsToSession(item, session) && !item.read);
    if (!newest || newest.id === lastAlertedNotification.current) return;
    lastAlertedNotification.current = newest.id;
    const important = /order|payment|delivery|verification|quote|schedule/i.test(`${newest.title} ${newest.body}`);
    if (!important) return;
    playNotificationSound();
    toast(newest.title, { description: newest.body, duration: 7000 });
    showDeviceNotification(newest.title, newest.body);
  }, [state.notifications, session]);
  useEffect(() => {
    if (!session || !isLiveSupabaseMode()) return;
    let stopped = false;
    const refreshNotifications = async () => {
      try {
        const [rows, commerce] = await Promise.all([loadLiveNotifications(), loadLiveCommerceSnapshot()]);
        if (!stopped) setState((current) => {
          const synced = mergeLiveCommerce(current, commerce, session);
          return { ...synced, notifications: [
            ...rows.map((row) => ({ id: row.id, recipient: session.email, recipientRole: session.role, title: row.title, body: row.body, at: new Date(row.created_at).toLocaleString("en-IN"), read: Boolean(row.read_at), entityType: row.entity_type, entityId: row.entity_id })),
            ...synced.notifications.filter((item) => !notificationBelongsToSession(item, session) || item.id.startsWith("NOT-")),
          ].filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index) };
        });
      } catch { /* keep the last safe snapshot while offline */ }
    };
    void refreshNotifications();
    const timer = window.setInterval(refreshNotifications, 15000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [session]);
  const notificationSessionUserId = session?.userId;
  const notificationSessionEmail = session?.email;
  const notificationSessionRole = session?.role;
  useEffect(() => {
    if (!notificationSessionUserId || !notificationSessionEmail || !notificationSessionRole || !isLiveSupabaseMode()) return;

    const unsubscribe = subscribeLiveNotifications(
      notificationSessionUserId,
      () => {
        void loadLiveNotifications()
          .then((rows) => {
            setState((current) => ({
              ...current,
              notifications: [
                ...rows.map((row) => ({
                  id: row.id,
                  recipient: notificationSessionEmail,
                  recipientRole: notificationSessionRole,
                  title: row.title,
                  body: row.body,
                  at: new Date(row.created_at).toLocaleString("en-IN"),
                  read: Boolean(row.read_at),
                  entityType: row.entity_type,
                  entityId: row.entity_id,
                })),
                ...current.notifications.filter(
                  (item) =>
                    item.recipientRole !== notificationSessionRole ||
                    item.recipient.toLowerCase() !== notificationSessionEmail.toLowerCase() ||
                    item.id.startsWith("NOT-"),
                ),
              ].filter(
                (item, index, list) =>
                  list.findIndex(
                    (candidate) => candidate.id === item.id,
                  ) === index,
              ),
            }));
          })
          .catch((error) => {
            console.error("Real-time notification refresh failed:", error);
          });
      },
    );

    return unsubscribe;
  }, [session, notificationSessionUserId, notificationSessionEmail, notificationSessionRole]);
  useEffect(() => {
    if (!hydrated || !syncSession) return;
    if (!isLiveSupabaseMode()) { queueMicrotask(() => setLiveSync("ready")); return; }
    let cancelled = false;
    const syncTimeout = window.setTimeout(() => {
      if (!cancelled) {
        setLiveSync("error");
        setLiveSyncError("The account service did not respond within 10 seconds. You can continue using the page and retry.");
      }
    }, 10000);
    queueMicrotask(() => { setLiveSync("loading"); setLiveSyncError(""); });
    (async () => {
      if (syncSession.role === "customer") {
        const preference = syncSession.userId ? await loadLiveCustomerPreference(syncSession.userId) : null;
        const memoryRows = syncSession.userId ? await loadLiveCustomerMemory(syncSession.userId) : [];
        const liveMemory: AgentMemory = {};
        for (const row of memoryRows as Array<{ memory_key: string; memory_value: string }>) {
          if (row.memory_key === "preferred_budget") liveMemory.lastBudget = Number(row.memory_value) || undefined;
          if (row.memory_key === "favorite_categories") liveMemory.favoriteCategories = row.memory_value.split(",").map((item) => item.trim()).filter(Boolean);
          if (row.memory_key === "favorite_products") liveMemory.favoriteProducts = row.memory_value.split(",").map((item) => item.trim()).filter(Boolean);
          if (row.memory_key === "calorie_target") liveMemory.calorieTarget = Number(row.memory_value) || undefined;
          if (row.memory_key === "protein_preference") liveMemory.minProtein = Number(row.memory_value) || undefined;
          if (row.memory_key === "dietary_preference") liveMemory.preferredDietaryTags = row.memory_value.split(",").map((item) => item.trim()).filter(Boolean);
          if (row.memory_key === "delivery_window") liveMemory.preferredDeliveryPeriod = row.memory_value;
        }
        let products: Product[] = []; let vendors: Vendor[] = []; let merchandising = { featuredProductIds: [] as string[], recommendationPopupEnabled: true, maxFeatured: 6 }; let merchandisingError: string | null = null;
        if (preference && Number.isFinite(Number(preference.latitude)) && Number.isFinite(Number(preference.longitude))) {
          const marketplace = await loadLiveMarketplace(Number(preference.latitude), Number(preference.longitude));
          products = marketplace.items.map(marketplaceProductFromLive); merchandising = marketplace.merchandising; merchandisingError = marketplace.merchandisingError || null;
          const unique = new Map<string, Vendor>();
          marketplace.items.forEach((row) => unique.set(row.vendor_id, {
            id: row.vendor_id, ownerEmail: "vendor@sheplates.local", ownerName: "Verified vendor", businessName: row.vendor_name,
            category: row.category, address: "Serviceable near your delivery pin", radiusKm: Math.max(1, Number(row.distance_km)),
            latitude: Number.isFinite(row.vendor_lat) ? row.vendor_lat : undefined, longitude: Number.isFinite(row.vendor_lng) ? row.vendor_lng : undefined,
            delivery: row.delivery_enabled, pickup: row.pickup_enabled, openToday: true, fssaiNumber: "Verified",
            certificateName: "Private", expiryDate: "—", verification: "Verified", operational: "Active", plan: planFromCode(row.vendor_plan_code),
          }));
          vendors = [...unique.values()];
        }
        if (!cancelled) setState((current) => ({
          ...current,
          customers: preference ? [...current.customers.filter((item) => item.email !== syncSession.email), {
            email: syncSession.email,
            phone: String(preference.phone || ""),
            address: String(preference.address || ""),
            latitude: Number(preference.latitude),
            longitude: Number(preference.longitude),
            householdSize: Number(preference.household_size || 1),
            diet: String(preference.diet || "No preference"),
            allergies: Array.isArray(preference.allergies) ? preference.allergies : [],
            goals: Array.isArray(preference.health_goals) ? preference.health_goals : [],
            dislikes: String(preference.dislikes_and_instructions || ""),
            onboardingComplete: Boolean(preference.onboarding_complete),
            agentMemory: liveMemory,
            addresses: [{
              id: id("ADR"),
              label: "Home",
              address: String(preference.address || ""),
              latitude: Number(preference.latitude),
              longitude: Number(preference.longitude),
              phone: String(preference.phone || ""),
              isDefault: true,
            }],
          }] : current.customers.filter((item) => item.email !== syncSession.email),
          vendors, products, markups: {}, merchandising, merchandisingError,
        }));
      } else if (syncSession.role === "vendor" && syncSession.vendorId) {
        const workspace = await loadLiveVendorWorkspace(syncSession.vendorId);
        if (!cancelled) setState((current) => ({ ...current,
          vendors: [vendorFromLive(workspace.vendor, { email: syncSession.email, name: syncSession.name }, workspace.document || undefined)],
          products: workspace.products.map(productFromLive),
        }));
      } else {
        const workspace = await loadLiveOperationsWorkspace();
        if (!cancelled) setState((current) => ({ ...current,
          vendors: workspace.vendors.map((row) => {
            const profile = workspace.profiles.find((item) => item.vendor_id === row.id || item.id === row.owner_id);
            const document = workspace.documents.find((item) => item.vendor_id === row.id);
            return vendorFromLive(row, { name: profile?.full_name }, document);
          }),
          products: workspace.products.map(productFromLive),
          merchandising: workspace.merchandising || current.merchandising,
          merchandisingError: workspace.merchandisingError || null,
          campaigns: (workspace.campaigns || []).map((row: Record<string, unknown>) => ({
            id: String(row.id), name: String(row.name), audience: String(row.audience), offer: String(row.offer), channel: String(row.channel), status: row.status === "active" ? "Active" : row.status === "paused" ? "Paused" : "Draft", aiRationale: String(row.ai_rationale || ""), createdAt: String(row.created_at),
            headline: (row.headline as string | null) || undefined, subline: (row.subline as string | null) || undefined, emoji: (row.emoji as string | null) || undefined, ctaLabel: (row.cta_label as string | null) || undefined,
            targetType: (row.target_type as Campaign["targetType"]) || undefined, targetValue: (row.target_value as string | null) || undefined, segment: (row.segment as Campaign["segment"]) || undefined,
            startsAt: (row.starts_at as string | null) || undefined, endsAt: (row.ends_at as string | null) || undefined, priority: Number(row.priority ?? 0), views: Number(row.view_count ?? 0), clicks: Number(row.click_count ?? 0),
          } satisfies Campaign)),
        }));
      }
      const commerce = await loadLiveCommerceSnapshot();
      if (!cancelled) setState((current) => mergeLiveCommerce(current, commerce, syncSession));
      window.clearTimeout(syncTimeout);
      if (!cancelled) setLiveSync("ready");
    })().catch((error) => { window.clearTimeout(syncTimeout); if (!cancelled) { setLiveSync("error"); setLiveSyncError(error instanceof Error ? error.message : "Your latest account data could not be loaded"); } });
    return () => { cancelled = true; window.clearTimeout(syncTimeout); };
  }, [hydrated, syncSession, syncVersion]);

  async function signOut() { await liveSignOut(); setSession(null); setActive("Marketplace"); toast.success("Signed out"); }
  function finishTour(skipped: boolean) {
    const key = tourOpen === "customer" ? CUSTOMER_TOUR_KEY : VENDOR_TOUR_KEY;
    setTourOpen(null);
    setSession((current) => {
      if (!current) return current;
      const toursCompleted = [...new Set([...(current.toursCompleted || []), key])];
      if (isLiveSupabaseMode() && current.userId) void saveLiveTourCompleted(current.userId, toursCompleted);
      return { ...current, toursCompleted };
    });
    if (skipped) toast("Tour skipped — replay it anytime from Help", { duration: 4000 });
  }
  function replayTour() {
    if (session?.role !== "customer" && session?.role !== "vendor") return;
    if (session.role === "vendor") setMenuOpen(true);
    setTourOpen(session.role);
  }
  if (!session) return <ShePlatesEntry onLogin={(next) => { setSession(next); setActive(nav[next.role][0]); }} />;
  const role = session.role;
  const customer = state.customers.find((item) => item.email === session.email);
  const vendor = vendorFor(state, session);
  const needsRemoteIdentity = (role === "customer" && !customer) || (role === "vendor" && Boolean(session.vendorId) && !vendor);
  if (isLiveSupabaseMode() && liveSync === "loading" && needsRemoteIdentity) return <div className="sp-v7 grid min-h-screen place-items-center bg-[#faf6f4] p-5"><div className="text-center"><RefreshCcw className="mx-auto size-8 animate-spin text-[#653046]" /><div className="mt-4 font-black">Loading your ShePlates profile…</div><p className="mt-1 text-sm text-stone-500">You can continue if the account service is temporarily unavailable.</p><Button variant="outline" onClick={() => setLiveSync("ready")} className="mt-5 rounded-xl">Continue to setup</Button></div></div>;
  if (isLiveSupabaseMode() && liveSync === "error" && needsRemoteIdentity) return <div className="sp-v7 grid min-h-screen place-items-center bg-[#faf6f4] p-5"><div className="surface-card max-w-lg rounded-[28px] p-6 text-center"><AlertTriangle className="mx-auto text-amber-600" /><h1 className="mt-4 text-xl font-black">Account sync is unavailable</h1><p className="mt-2 text-sm text-stone-500">{liveSyncError}</p><div className="mt-5 flex justify-center gap-2"><Button onClick={() => setSyncVersion((value) => value + 1)} className="rounded-xl bg-[#753b50]"><RefreshCcw />Try again</Button><Button variant="outline" onClick={() => setLiveSync("ready")} className="rounded-xl">Continue to setup</Button></div></div></div>;
  if (role === "customer" && !customer?.onboardingComplete) return <CustomerOnboarding session={session} onSave={(profile) => setState((s) => ({ ...s, customers: [...s.customers.filter((x) => x.email !== profile.email), profile], audit: [audit(session, "Completed customer food profile", profile.diet), ...s.audit] }))} onLogout={signOut} />;
  if (role === "vendor" && !vendor && session.p0UpgradeInvitationId) {
    return <P0UpgradeAcceptance invitationId={session.p0UpgradeInvitationId} />;
  }
  if (role === "vendor" && !vendor) return <VendorOnboarding session={session} setState={setState} onLogout={signOut} />;

  const unread = state.notifications.filter((item) => notificationBelongsToSession(item, session) && !item.read).length;
  const hasPin = Boolean(customer && Number.isFinite(customer.latitude) && Number.isFinite(customer.longitude));
  async function claimDrop(drop: FoodDrop, quantity: number) {
    try {
      const claim = await claimLiveFoodDrop(drop.id, quantity);
      setState((current) => ({
        ...current,
        foodDrops: current.foodDrops.map((d) => d.id === drop.id ? { ...d, remainingQuantity: Math.max(0, d.remainingQuantity - quantity) } : d),
        foodDropClaims: [{ ...claim, customerEmail: session!.email }, ...current.foodDropClaims],
      }));
      toast.success(`Added ${quantity} × ${drop.title} — settle at pickup/delivery with the vendor`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This drop could not be claimed");
      void refreshDrops(); // the server decided (sold out / ended) — resync instead of trusting local stock
    }
  }
  function renderCustomerPage() {
    const area = { latitude: customer?.latitude, longitude: customer?.longitude, address: customer?.address };
    if (active === "Notifications") return <NotificationDrawerV4 page open setOpen={() => undefined} session={session!} state={state} setState={setState} people={people} />;
    if (active === "She Agent") return <div className="space-y-4"><div><h1 className="text-[28px] font-bold leading-tight">She Agent</h1><p className="mt-1 text-sm text-[#71676b]">Your food assistant. It never pays for you: you confirm every order.</p></div><SheAgent page open setOpen={() => setActive("Marketplace")} session={session!} state={state} setState={setState} navigate={setActive} /></div>;
    if (active === "Maps") return <MapsTab key={mapsStart ?? "maps"} initialTab={mapsStart} state={state} profile={area} social={social} shorts={shorts} people={people} peopleRadius={peopleRadius} onPeopleRadius={setPeopleRadius} onOpenShorts={openShorts} locationConfirmed={hasPin} onOpenVendor={setVendorProfileId} onConfirmLocation={() => setActive("Marketplace")} />;
    if (active === "Food Drops") return <FoodDropsTab state={state} profile={area} social={social} onClaim={claimDrop} onRefresh={() => void refreshDrops()} />;
    if (active === "Stories") return <StoriesTab state={state} social={social} shorts={shorts} people={people} statuses={statuses} peopleRadius={peopleRadius} onPeopleRadius={setPeopleRadius} shortsRadius={shortsRadius} onShortsRadius={setShortsRadius} onOpenShorts={openShorts} hasPin={hasPin} onSetLocation={() => setActive("Marketplace")} userName={session!.name} onOpenVendor={setVendorProfileId} />;
    if (active === "Profile") return <ProfileTab session={session!} state={state} setState={setState} social={social} people={people} statuses={statuses} onSetLocation={() => setActive("Marketplace")} onOpenVendor={setVendorProfileId} onNavigate={setActive} onReplayTour={replayTour} onSignOut={signOut} />;
    if (active === "Schedules" || active === "Orders" || active === "My schedule") return <SchedulesTab initial={active === "My schedule" ? "Subscriptions" : "Orders"} orders={<OrdersV4 session={session!} state={state} setState={setState} scope="customer" />} subscriptions={<SchedulesV4 session={session!} state={state} setState={setState} navigate={setActive} />} />;
    return <CustomerArea active={active} session={session!} state={state} setState={setState} navigate={setActive} openAgent={() => setAgentOpen(true)} openVendor={setVendorProfileId} locationSignal={locationSignal} shorts={shorts} shortsRadius={shortsRadius} onShortsRadius={setShortsRadius} openShorts={openShorts} onSeeAllShorts={() => setActive("Stories")} />;
  }
  const openTicketCount = state.tickets.filter((t) => t.status !== "Resolved").length;
  const staffCounts: Record<string, number> = role === "vendor"
    ? { Orders: state.orders.filter((o) => o.status === "Scheduled" && vendorFor(state, session)?.id === o.vendorId).length }
    : role === "operations"
      ? { "Vendor verification": state.vendors.filter((v) => v.vendorKind !== "p0_connect" && ["Submitted", "Under review"].includes(v.verification)).length, "Ticket centre": openTicketCount, Cancellations: state.cancellations.filter((x) => x.status === "Awaiting operations").length }
      : role === "admin" ? { "Ticket centre": openTicketCount } : {};
  const content = role === "customer"
    ? renderCustomerPage()
    : role === "vendor"
      ? <VendorArea active={active} session={session} state={state} setState={setState} shorts={shorts} />
      : role === "operations"
        ? <OperationsArea active={active} session={session} state={state} setState={setState} navigate={setActive} openAgent={() => setAgentOpen(true)} />
        : <AdminArea active={active} session={session} state={state} setState={setState} />;

  const customerCartCount = role === "customer" ? state.cart.filter((item) => item.customerEmail === session.email).reduce((sum, item) => sum + item.quantity, 0) : 0;
  const customerQuoteCount = role === "customer" ? state.quotes.filter((quote) => {
    const requirement = state.requirements.find((item) => item.id === quote.requirementId);
    return requirement?.customerEmail === session.email && quote.status === "Submitted";
  }).length : 0;

  return <div className="app-shell-bg sp-v7 min-h-screen text-[#292124]">
    <Toaster position="top-center" richColors />
    {role === "customer" && <CustomerHeader active={active} name={session.name} email={session.email} area={shortArea(customer?.address)} unread={unread} cartCount={customerCartCount} accountOpen={customerMenuOpen} onToggleAccount={() => setCustomerMenuOpen((value) => !value)} onNavigate={(key) => { if (key === "Maps") setMapsStart(undefined); setActive(key); setCustomerMenuOpen(false); }} onAgent={() => setActive("She Agent")} onNotifications={() => setActive("Notifications")} onLocation={() => { setActive("Marketplace"); setLocationSignal((n) => n + 1); }} onReplayTour={() => { replayTour(); setCustomerMenuOpen(false); }} onSignOut={signOut} />}

    {role === "customer" ? <><main className="sp-customer-main mx-auto min-w-0 max-w-385 p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8 lg:pb-28">
      {isLiveSupabaseMode() && liveSync === "loading" && <div className="surface-card mb-4 flex items-center gap-3 rounded-2xl border border-sky-200/70 bg-sky-50/90 p-3 text-sm text-sky-900"><RefreshCcw className="size-4 animate-spin" /><span className="flex-1 font-bold">Refreshing your latest data…</span></div>}
      {isLiveSupabaseMode() && liveSync === "error" && <div className="surface-card mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/90 p-3 text-sm text-amber-900"><AlertTriangle className="size-4" /><span className="min-w-0 flex-1"><b>Account sync paused.</b> {liveSyncError}</span><Button size="sm" variant="outline" onClick={() => setSyncVersion((value) => value + 1)} className="rounded-lg"><RefreshCcw />Retry</Button></div>}
      {content}
      {!notificationsOpen && <CustomerBottomNav active={active} onNavigate={(key) => { if (key === "Maps") setMapsStart(undefined); setActive(key); setCustomerMenuOpen(false); }} onAgent={() => setActive("She Agent")} />}
      {customerMenuOpen && <button className="fixed inset-0 z-30 hidden md:block" onClick={() => setCustomerMenuOpen(false)} aria-label="Close account menu" />}
      <VendorProfileDialog vendorId={vendorProfileId} onClose={() => setVendorProfileId(null)} state={state} customerEmail={session.email} social={social} profile={{ latitude: customer?.latitude, longitude: customer?.longitude, address: customer?.address }} onAdd={(product) => { void addProductToCart(state, setState, session, product); }} cartLines={state.cart.filter((item) => item.customerEmail === session.email).map((item) => { const product = state.products.find((x) => x.id === item.productId); return { id: item.id, name: product?.name || "Item", quantity: item.quantity, total: product ? finalPrice(product, state) * item.quantity : 0 }; })} onViewCart={() => { setVendorProfileId(null); setActive("Cart"); }} onPlan={(product) => setPlanProduct(product)} onToggleWishlist={(product) => setState((current) => {
        const alreadySaved = current.wishlist.some((item) => item.customerEmail === session.email && item.productId === product.id);
        return {
          ...current,
          wishlist: alreadySaved
            ? current.wishlist.filter((item) => !(item.customerEmail === session.email && item.productId === product.id))
            : [{ customerEmail: session.email, productId: product.id, addedAt: new Date().toISOString() }, ...current.wishlist],
        };
      })} onClaimDrop={claimDrop} shorts={vendorProfileId ? shorts.forVendor(vendorProfileId, 30) : []} onOpenShorts={openShorts} />
      {shortsViewer.state && <ShortsViewer shorts={shortsViewer.state.shorts} startIndex={shortsViewer.state.start} liked={shorts.liked} onLike={(id) => void shorts.toggleLike(id).catch((e) => toast.error(e instanceof Error ? e.message : "Could not save your like"))} onView={(id) => { void shorts.recordView(id).catch((e) => { toast.error(e instanceof Error ? e.message : "Could not record this view"); }); }} onOpenVendor={setVendorProfileId} onClose={shortsViewer.close} />}
      <ScheduleDialog product={planProduct} close={() => setPlanProduct(null)} session={session} state={state} setState={setState} initialStartDate={tomorrow()} onCreated={() => { setVendorProfileId(null); setActive("Cart"); }} />
    </main><CustomerFooter /></> : <StaffShell role={role} roleLabel={roleName[role]} items={nav[role]} icons={navIcons} active={active} onNavigate={setActive} unread={unread} name={session.name} email={session.email} menuOpen={menuOpen} onMenu={setMenuOpen} onNotifications={() => setNotificationsOpen(true)} onSignOut={signOut} onReplayTour={role === "vendor" ? replayTour : undefined} counts={staffCounts}
      banner={<>
        {isLiveSupabaseMode() && liveSync === "loading" && <div className="surface-card flex items-center gap-3 rounded-2xl p-3 text-sm"><RefreshCcw className="size-4 animate-spin" /><span className="flex-1 font-bold">Refreshing your latest data…</span></div>}
        {isLiveSupabaseMode() && liveSync === "error" && <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle className="size-4" /><span className="min-w-0 flex-1"><b>Account sync paused.</b> {liveSyncError}</span><Button size="sm" variant="outline" onClick={() => setSyncVersion((value) => value + 1)}><RefreshCcw />Retry</Button></div>}
      </>}>{content}</StaffShell>}

    <button data-tour="agent-desktop" onClick={() => (role === "customer" ? setActive("She Agent") : setAgentOpen(true))} className={`${role === "customer" ? "sp-desktop-agent-launcher" : "sp-staff-agent-launcher"} sp-agent-launcher group fixed bottom-5 right-4 z-30 grid size-16 place-items-center rounded-full border border-white/70 bg-white/92 p-2 shadow-[0_22px_70px_rgba(25, 19, 21,.24)] backdrop-blur-xl transition hover:shadow-[0_28px_90px_rgba(25, 19, 21,.30)] sm:right-6`} aria-label="Open She Agent">
      <span className="sp-agent-orb relative grid size-12 place-items-center rounded-full text-white"><Activity className="size-5" /></span>
    </button>
    <NotificationDrawerV4 open={notificationsOpen} setOpen={setNotificationsOpen} session={session} state={state} setState={setState} people={people} />
    <SheAgent open={agentOpen} setOpen={setAgentOpen} session={session} state={state} setState={setState} navigate={setActive} />
    {tourOpen === "customer" && <ProductTour steps={CUSTOMER_TOUR_STEPS} onClose={finishTour} />}
    {tourOpen === "vendor" && <ProductTour steps={VENDOR_TOUR_STEPS} onClose={finishTour} />}
  </div>;
}

function audit(session: DemoSession, action: string, detail: string): Audit { return { id: id("AUD"), actor: `${session.name} · ${roleName[session.role]}`, action, detail, at: now() }; }
function Logo({ compact = false }: { compact?: boolean }) { return <div className="flex min-w-0 items-center gap-2.5 sm:gap-3"><div className="surface-card-muted grid size-10 shrink-0 place-items-center rounded-[14px] sm:size-12 sm:rounded-2xl"><img src="/sheplates-logo.png" alt="ShePlates" className="size-8 rounded-full object-contain sm:size-10" /></div>{!compact && <div className="min-w-0"><div className="truncate text-lg font-black tracking-[-.04em] sm:text-xl">ShePlates</div><div className="hidden text-[9px] font-black uppercase tracking-[.18em] text-[#653046] min-[390px]:block sm:text-[10px]">Agentic local commerce</div></div>}</div>; }
function RolePill({ children }: { children: React.ReactNode }) { return <span className="soft-chip hidden sm:inline-flex">{children}</span>; }

type TourStep = { selectors: string[]; title: string; body: string };

const CUSTOMER_TOUR_KEY = "customer_v1";
const VENDOR_TOUR_KEY = "vendor_v1";

const CUSTOMER_TOUR_STEPS: TourStep[] = [
  { selectors: ['[data-tour="location"]', '[data-tour="location-mobile"]'], title: "Your delivery location", body: "Set your delivery pin here — by GPS or by typing an address. Every product you see is matched to this exact location, not just the text." },
  { selectors: ['[data-tour="search"]'], title: "Search the marketplace", body: "Look up a product, vendor, category or dietary tag directly." },
  { selectors: ['[data-tour="categories"]'], title: "Browse categories", body: "Jump straight to milk, home food, vegetables, groceries and more." },
  { selectors: ['[data-tour="filters"]'], title: "Filters", body: "Narrow by budget, calories, protein and dietary preference." },
  { selectors: ['[data-tour="products"]'], title: "Add to Cart or Schedule", body: "Every product has two independent actions: Add puts it straight in your cart; Plan opens a one-off or recurring delivery schedule for it." },
  { selectors: ['[data-tour="agent-desktop"]', '[data-tour="agent-mobile"]'], title: "She Agent", body: "Ask in plain language — \"add milk to my cart\" or \"what did I order last week\" — and She Agent uses the same cart and order history you see here." },
  { selectors: ['[data-tour="cart"]', '[data-tour="cart-mobile"]'], title: "Cart", body: "Your saved basket — it persists across refresh, logout and devices, and is shared with She Agent." },
  { selectors: ['[data-tour="nav-tabs"]', '[data-tour="nav-tabs-mobile"]'], title: "Six tabs, one app", body: "Maps for vendors near you, Marketplace to shop, Schedules for orders and subscriptions, Food Drops for limited offers, Stories for what neighbours are eating, and your Profile." },
  { selectors: ['[data-tour="account"]', '[data-tour="account-mobile"]'], title: "Profile & food, and more", body: "Your profile holds Profile & Food, Wishlist, Orders, My Quotations, Monthly Requirement and Ticket Centre." },
];

const VENDOR_TOUR_STEPS: TourStep[] = [
  { selectors: ['[data-tour-nav="Dashboard"]'], title: "Dashboard", body: "Your daily fulfilment load, GMV and store health at a glance." },
  { selectors: ['[data-tour="store-open"]', '[data-tour-nav="Store & radius"]'], title: "Store open/close & radius", body: "Open or close for the day, and set your exact store pin and service radius — customer matching uses this coordinate, not your address text." },
  { selectors: ['[data-tour-nav="Verification"]'], title: "Verification", body: "Submit your food certification here. Operations must verify you before customers can see your products." },
  { selectors: ['[data-tour-nav="Catalog"]'], title: "Catalog", body: "Create products with an exact pack size, price and stock count." },
  { selectors: ['[data-tour-nav="Quote opportunities"]'], title: "Quote opportunities", body: "Respond to monthly requirement RFQs from eligible customers." },
  { selectors: ['[data-tour-nav="Orders"]'], title: "Orders", body: "Fulfil scheduled and one-off orders, and update their status." },
  { selectors: ['[data-tour-nav="Delivery team"]'], title: "Delivery team", body: "Add your delivery staff and assign them to orders." },
  { selectors: ['[data-tour-nav="Settlements"]'], title: "Settlements", body: "See your collected payments, commission and payout schedule." },
  { selectors: ['[data-tour-nav="AI insights"]'], title: "AI insights", body: "Explainable, data-grounded signals about stock risk and fulfilment load." },
  { selectors: ['[data-tour-nav="Ticket centre"]'], title: "Tickets", body: "Raise and track support tickets with Operations." },
];

/** Contextual coach-mark tour: darkens the page, spotlights one real UI element
 * at a time via a fixed-position ring (not a screenshot/mock), and steps
 * through Back/Next/Skip. Portalled to <body> so its fixed positioning is
 * never affected by an ancestor's transform/backdrop-filter. */
function ProductTour({ steps, onClose }: { steps: TourStep[]; onClose: (skipped: boolean) => void }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  useEffect(() => {
    function locate() {
      for (let i = index; i < steps.length; i++) {
        const el = steps[i].selectors.map((selector) => document.querySelector(selector) as HTMLElement | null).find((node) => node && node.offsetParent !== null);
        if (el) {
          if (i !== index) { setIndex(i); return; }
          setRect(el.getBoundingClientRect());
          setViewport({ w: window.innerWidth, h: window.innerHeight });
          if (i === index) el.scrollIntoView({ block: "center", behavior: "smooth" });
          return;
        }
      }
      onClose(false);
    }
    locate();
    window.addEventListener("resize", locate);
    window.addEventListener("scroll", locate, true);
    const timer = window.setInterval(locate, 500);
    return () => { window.removeEventListener("resize", locate); window.removeEventListener("scroll", locate, true); window.clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (!rect || typeof document === "undefined") return null;
  const step = steps[index];
  const pad = 8;
  const spot = { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  const cardWidth = 300;
  const spaceBelow = viewport.h - (spot.top + spot.height);
  const showBelow = spaceBelow > 190 || spot.top < 190;
  const cardTop = showBelow ? Math.min(spot.top + spot.height + 14, viewport.h - 200) : Math.max(14, spot.top - 190);
  const cardLeft = Math.min(Math.max(14, spot.left), Math.max(14, viewport.w - cardWidth - 14));

  return createPortal(
    <div className="fixed inset-0 z-300" role="dialog" aria-modal="true" aria-label="Product tour">
      <div className="absolute rounded-2xl transition-all duration-200" style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height, boxShadow: "0 0 0 9999px rgba(17, 14, 15,.58)", border: "2px solid rgba(255,255,255,.92)", pointerEvents: "none" }} />
      <div className="glass absolute rounded-[22px] border border-white/70 bg-white/95 p-4 shadow-2xl backdrop-blur-xl" style={{ top: cardTop, left: cardLeft, width: cardWidth }}>
        <div className="text-[10px] font-black uppercase tracking-[.12em] text-[#653046]">Step {index + 1} of {steps.length}</div>
        <h4 className="mt-1 text-base font-black text-[#292124]">{step.title}</h4>
        <p className="mt-1.5 text-sm leading-5 text-stone-600">{step.body}</p>
        <div className="mt-3.5 flex items-center justify-between">
          <button onClick={() => onClose(true)} className="text-xs font-bold text-stone-400 hover:text-stone-600">Skip</button>
          <div className="flex gap-2">
            {index > 0 && <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setIndex((i) => i - 1)}>Back</Button>}
            <Button size="sm" className="rounded-lg bg-[#753b50] hover:bg-[#292124]" onClick={() => index === steps.length - 1 ? onClose(false) : setIndex((i) => i + 1)}>{index === steps.length - 1 ? "Finish" : "Next"}</Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
function Heading({ eyebrow, title, body, action }: { eyebrow: string; title: string; body: string; action?: React.ReactNode }) { return <div className="sp-page-heading flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-end lg:justify-between"><div className="min-w-0"><p className="sr-only">{eyebrow}</p><h1 className="text-[28px] font-bold leading-[1.15] tracking-[-.01em]">{title}</h1><p className="mt-1 max-w-3xl text-sm leading-5 text-[#71676b]">{body}</p></div>{action}</div>; }
function Empty({ icon: Icon, title, body, action }: { icon: typeof Store; title: string; body: string; action?: React.ReactNode }) { return <div className="surface-card sp-empty-state rounded-[28px] border border-dashed p-10 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f7edf0] text-[#653046]"><Icon className="size-7" /></div><h3 className="mt-4 font-black">{title}</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-stone-500">{body}</p>{action && <div className="mt-5">{action}</div>}</div>; }
function BarChart({ data, height = 160 }: { data: { label: string; value: number }[]; height?: number }) { const max = Math.max(1, ...data.map((d) => d.value)); return <div className="flex items-end gap-2" style={{ height }}>{data.map((d, i) => <div key={`${d.label}-${i}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2" title={`${d.label}: ${d.value}`}><div className="w-full rounded-xl" style={{ height: `${Math.max(6, Math.round((d.value / max) * 100))}%`, background: i === data.length - 1 ? "#753b50" : "#e8cbd5" }} /><span className="text-[11px] text-[#71676b]">{d.label}</span></div>)}</div>; }
function lastDays(count: number) { return Array.from({ length: count }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (count - 1 - i)); return { key: localDateISO(d), label: count <= 7 ? (i === count - 1 ? "Today" : d.toLocaleDateString("en-IN", { weekday: "short" })) : String(d.getDate()) }; }); }
function compactMoney(value: number) { return value >= 100000 ? `₹${(value / 100000).toFixed(1)} L` : money(value); }
const METRIC_TONES = {
  green: { bg: "bg-gradient-to-br from-[#f7edf0] to-[#f7edf0]", fg: "text-[#653046]" },
  blue: { bg: "bg-gradient-to-br from-[#f7edf0] to-[#f7edf0]", fg: "text-[#285fba]" },
  amber: { bg: "bg-gradient-to-br from-[#fdf3e2] to-[#fff9ec]", fg: "text-[#a67c00]" },
  violet: { bg: "bg-gradient-to-br from-[#f7edf0] to-[#faf6f4]", fg: "text-[#292124]" },
} as const;
function Metric({ label, value, icon: Icon, note }: { label: string; value: string; icon: typeof Store; note?: string; tone?: keyof typeof METRIC_TONES }) { const up = !!note && /^\+/.test(note); return <div className="surface-card sp-metric-card rounded-3xl p-5"><div className="flex items-start justify-between gap-3"><div className="text-[13px] font-medium text-[#71676b]">{label}</div><div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#f7edf0] text-[#292124]"><Icon className="size-5" /></div></div><div className="mt-2 text-[28px] font-bold leading-none tracking-[-.01em] tabular-nums">{value}</div>{note && <div className={`mt-3 text-xs font-semibold ${up ? "text-[#21683b]" : "text-[#71676b]"}`}>{note}</div>}</div>; }
function Status({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <span className={`sp-status inline-flex rounded-full border border-stone-200/80 bg-stone-50/90 px-3 py-1 text-[11px] font-black ${className}`}>{children}</span>; }
export const STANDARD_DIETS = [
  "No preference",
  "Vegetarian",
  "Vegan",
  "Eggetarian",
  "Non-vegetarian",
  "Jain",
  "Low carb",
  "High protein",
] as const;

export const STANDARD_ALLERGIES = [
  "Milk",
  "Egg",
  "Peanut",
  "Tree nuts",
  "Gluten",
  "Soy",
  "Fish",
  "Shellfish",
] as const;

export const STANDARD_GOALS = [
  "Balanced meals",
  "Weight management",
  "High protein",
  "Low sodium",
  "Diabetes aware",
  "Heart friendly",
] as const;

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) { return <label className="sp-field block"><span className="mb-2 block text-xs font-black uppercase tracking-[.14em] text-stone-500">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-stone-400">{hint}</span>}</label>; }
const inputClass = "h-11 w-full rounded-2xl border border-stone-200/80 bg-white/90 px-3.5 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,.6)] focus:border-[#753b50] focus:ring-2 focus:ring-[#753b50]/10";

function CustomerOnboarding({ session, onSave, onLogout }: { session: DemoSession; onSave: (profile: CustomerProfile) => void; onLogout: () => void }) {
  const [step, setStep] = useState(1), [locating, setLocating] = useState(false), [mapBusy, setMapBusy] = useState(false);
  const [address, setAddress] = useState(""), [coords, setCoords] = useState<{ lat?: number; lng?: number }>({});
  const pinLookup = useRef(0);
  const [household, setHousehold] = useState(2), [diet, setDiet] = useState("No preference"), [allergies, setAllergies] = useState<string[]>([]), [goals, setGoals] = useState<string[]>([]), [dislikes, setDislikes] = useState("");
  const [privateAccount, setPrivateAccount] = useState(session.privateAccount ?? false);
  const roundPoint = (point: { lat: number; lng: number }) => ({ lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) });
  function detect() { if (!navigator.geolocation) return toast.error("Location is unavailable in this browser"); const request = ++pinLookup.current; setLocating(true); navigator.geolocation.getCurrentPosition(async (position) => { const point = roundPoint({ lat: position.coords.latitude, lng: position.coords.longitude }); setCoords(point); setAddress(`GPS pin ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)} — add flat/street details`); try { const place = await findLocation(point); const next = roundPoint({ lat: place.latitude, lng: place.longitude }); if (request === pinLookup.current) { setCoords(next); setAddress(place.address); } toast.success(`Actual GPS location detected (±${Math.round(position.coords.accuracy)} m)`); } catch (error) { if (request === pinLookup.current) toast.info(error instanceof Error ? `${error.message} The exact GPS pin is still saved.` : "The exact GPS pin is saved; add the street details."); } finally { setLocating(false); } }, () => { setLocating(false); toast.info("Allow precise location in Chrome, or search your full address manually"); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }); }
  async function locateAddress() { if (!address.trim()) return toast.error("Enter the delivery address first"); const request = ++pinLookup.current; setMapBusy(true); try { const place = await findLocation({ address }); const next = roundPoint({ lat: place.latitude, lng: place.longitude }); if (request === pinLookup.current) { setCoords(next); setAddress(place.address); toast.success("Address pinned on the map"); } } catch (error) { if (request === pinLookup.current) toast.error(error instanceof Error ? error.message : "Address was not found"); } finally { setMapBusy(false); } }
  function movePin(point: { lat: number; lng: number }) {
    const next = roundPoint(point);
    setCoords(next);
    setAddress(`Selected map location ${next.lat.toFixed(6)}, ${next.lng.toFixed(6)}`);
  }
  function continueSetup() {
    if (step === 1 && !address.trim()) return toast.error("Enter your delivery address first");
    if (step === 1 && (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng))) return toast.error("Confirm your delivery pin with GPS, an address suggestion, or the map before continuing");
    setStep((current) => current + 1);
  }
  async function finish() {
    if (!address.trim()) return toast.error("Enter your delivery address first");
    if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return toast.error("Confirm your delivery pin with GPS, an address suggestion, or the map before saving");
    const latitude = Number(coords.lat?.toFixed(6));
    const longitude = Number(coords.lng?.toFixed(6));
    try {
      if (session.userId && process.env.NEXT_PUBLIC_DEMO_MODE === "false" && isSupabaseConfigured()) {
        await saveLiveCustomerProfile({
          userId: session.userId,
          address,
          latitude,
          longitude,
          householdSize: household,
          diet,
          allergies,
          goals,
          instructions: dislikes,
        });
      }
      onSave({
        email: session.email,
        address,
        latitude,
        longitude,
        householdSize: household,
        diet,
        allergies,
        goals,
        dislikes,
        onboardingComplete: true,
        privateAccount,
        addresses: [{
          id: id("ADR"),
          label: "Home",
          address,
          latitude,
          longitude,
          isDefault: true,
        }],
      });
      toast.success("Your food profile and exact service pin are ready");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Profile could not be saved"); }
  }
  return <div className="app-shell-bg sp-v7 min-h-screen p-4 sm:p-8"><div className="mx-auto flex max-w-5xl items-center justify-between"><Logo /><button onClick={onLogout} className="text-sm font-bold text-stone-500">Sign out</button></div><div className="mx-auto mt-5 grid max-w-5xl overflow-hidden rounded-[30px] surface-card sm:mt-8 sm:rounded-[36px] lg:grid-cols-[.82fr_1.18fr]"><div className="sp-onboarding-side surface-dark p-8 text-white sm:p-10"><div className="grid size-12 place-items-center rounded-2xl bg-[#753b50]"><HeartPulse /></div><h1 className="mt-8 text-xl font-black tracking-[-.02em]">Help She Agent understand your home.</h1><p className="mt-4 leading-7 text-white/60">Your address finds serviceable vendors. Your food preferences help personalize products and calorie guidance. You remain in control of every purchase.</p><div className="mt-8 space-y-3 text-sm">{["Location & household", "Diet, allergies & goals", "Review your private profile"].map((item, index) => <div key={item} className={`flex items-center gap-3 rounded-xl p-3 ${step === index + 1 ? "bg-white/10 text-white" : "text-white/45"}`}><span className={`grid size-7 place-items-center rounded-full ${step > index + 1 ? "bg-[#753b50]" : "border border-white/25"}`}>{step > index + 1 ? <Check className="size-4" /> : index + 1}</span>{item}</div>)}</div></div><div className="p-7 sm:p-10"><p className="text-xs font-black uppercase tracking-[.16em] text-[#b42332]">Customer setup · {step}/3</p>{step === 1 && <div className="mt-5 space-y-5"><h2 className="text-lg font-black">Where should we serve you?</h2><p className="text-sm text-stone-500">Use GPS or enter an address and choose a suggestion, then drag the map pin to your exact delivery point. Confirmed coordinates are required to continue.</p><Field label="Delivery address"><Textarea value={address} onChange={(e) => { ++pinLookup.current; setAddress(e.target.value); setCoords({}); }} placeholder="Flat, street, landmark, area, city and PIN" /></Field><LocationSuggestions query={address} onSelect={(place) => { ++pinLookup.current; setAddress(place.address); setCoords({ lat: place.latitude, lng: place.longitude }); }} /><div className="flex flex-wrap gap-2"><Button onClick={detect} disabled={locating} variant="outline" className="h-11 rounded-xl"><LocateFixed className={locating ? "animate-spin" : ""} />{locating ? "Finding current address…" : "Use my current location"}</Button><Button onClick={locateAddress} disabled={mapBusy} variant="outline" className="h-11 rounded-xl"><Search className={mapBusy ? "animate-pulse" : ""} />{mapBusy ? "Finding…" : "Find typed address"}</Button></div><MapPreview lat={coords.lat} lng={coords.lng} radius={2} label="Delivery location" onPinChange={movePin} /><Field label="Household size"><input type="number" min="1" max="20" value={household} onChange={(e) => setHousehold(Number(e.target.value))} className={inputClass} /></Field></div>}
  {step === 2 && <div className="mt-5 space-y-5"><h2 className="text-lg font-black">Food preferences</h2><Field label="Diet"><Select value={diet} onValueChange={setDiet}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{STANDARD_DIETS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field><ChoiceGroup label="Allergies" options={STANDARD_ALLERGIES as unknown as string[]} value={allergies} setValue={setAllergies} /><ChoiceGroup label="Health goals" options={STANDARD_GOALS as unknown as string[]} value={goals} setValue={setGoals} /><Field label="Dislikes or instructions"><input value={dislikes} onChange={(e) => setDislikes(e.target.value)} className={inputClass} placeholder="Example: no coriander, mild spice" /></Field></div>}
  {step === 3 && <div className="mt-5"><h2 className="text-lg font-black">Review your food profile</h2><div className="mt-5 space-y-3 rounded-2xl bg-[#faf6f4] p-5 text-sm"><Review label="Address" value={address} /><Review label="Household" value={`${household} people`} /><Review label="Diet" value={diet} /><Review label="Allergies" value={allergies.join(", ") || "None selected"} /><Review label="Goals" value={goals.join(", ") || "None selected"} /></div><div className="mt-4 space-y-3 rounded-2xl border border-stone-200 bg-white p-4"><div><h3 className="text-sm font-black">Customer account privacy</h3><p className="mt-1 text-xs leading-5 text-stone-500">Choose whether other customers can follow you directly or need your approval first.</p></div><div className="grid gap-2 sm:grid-cols-2"><button type="button" aria-pressed={!privateAccount} onClick={() => setPrivateAccount(false)} className={`rounded-xl border p-3 text-left ${!privateAccount ? "border-[#753b50] bg-[#f7edf0]" : "border-stone-200"}`}><b className="block text-sm">Public</b><span className="mt-1 block text-xs text-stone-500">Customers can follow you directly.</span></button><button type="button" aria-pressed={privateAccount} onClick={() => setPrivateAccount(true)} className={`rounded-xl border p-3 text-left ${privateAccount ? "border-[#753b50] bg-[#f7edf0]" : "border-stone-200"}`}><b className="block text-sm">Private</b><span className="mt-1 block text-xs text-stone-500">Approve follow requests before they follow you.</span></button></div></div><div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><b>Important:</b> calorie and nutrition values are estimates, not medical advice. Verify labels and allergens with the vendor.</div></div>}
  <div className="mt-8 flex justify-between"><Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => s - 1)} className="rounded-xl"><ArrowLeft />Back</Button>{step < 3 ? <Button onClick={continueSetup} className="rounded-xl bg-[#753b50] hover:bg-[#292124]">Continue<ArrowRight /></Button> : <Button onClick={finish} className="rounded-xl bg-[#753b50] hover:bg-[#292124]"><Check />Save profile</Button>}</div></div></div></div>;
}

function ChoiceGroup({ label, options, value, setValue }: { label: string; options: string[]; value: string[]; setValue: (next: string[]) => void }) { return <div><div className="mb-2 text-xs font-black uppercase tracking-widest text-stone-500">{label}</div><div className="flex flex-wrap gap-2">{options.map((option) => <button type="button" key={option} onClick={() => setValue(value.includes(option) ? value.filter((x) => x !== option) : [...value, option])} className={`rounded-full border px-3 py-2 text-sm font-bold ${value.includes(option) ? "border-[#753b50] bg-[#f7edf0] text-[#292124]" : "bg-white text-stone-500"}`}>{option}</button>)}</div></div>; }
function Review({ label, value }: { label: string; value: string }) { return <div className="sp-review flex min-w-0 justify-between gap-4 border-b border-stone-200/70 pb-3 last:border-0 last:pb-0"><span className="shrink-0 text-stone-500">{label}</span><b className="min-w-0 wrap-break-word text-right">{value}</b></div>; }
function OrderDetail({ label, value }: { label: string; value: React.ReactNode }) { return <div className="flex h-full min-h-20 min-w-0 flex-col items-start gap-2 rounded-2xl border border-stone-100 bg-stone-50/80 px-3.5 py-3"><span className="text-[11px] font-black uppercase tracking-wide text-stone-500">{label}</span><b className="min-w-0 w-full wrap-break-word text-left text-sm leading-5 text-stone-800">{value}</b></div>; }

function VendorOnboarding({ session, setState, onLogout, operationsCreated = false, close }: { session: DemoSession; setState: React.Dispatch<React.SetStateAction<V3State>>; onLogout?: () => void; operationsCreated?: boolean; close?: () => void }) {
  const [step, setStep] = useState(1), [locating, setLocating] = useState(false), [mapBusy, setMapBusy] = useState(false), [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false);
  const firstVendorAccount = demoAccounts.find((account) => account.role === "vendor")!;
  const [form, setForm] = useState({ businessName: "", ownerName: operationsCreated ? firstVendorAccount.name : session.name, ownerEmail: operationsCreated ? firstVendorAccount.email : session.email, category: "Groceries", address: "", lat: undefined as number | undefined, lng: undefined as number | undefined, radius: 5, delivery: true, pickup: true, fssai: "", expiry: "" });
  const [otherCategory, setOtherCategory] = useState("");
  const [invite, setInvite] = useState(false), [inviteEmail, setInviteEmail] = useState("");
  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) { setForm((f) => ({ ...f, [key]: value })); }
  function detect() { if (!navigator.geolocation) return toast.error("Location is unavailable"); setLocating(true); navigator.geolocation.getCurrentPosition(async (position) => { const point = { lat: position.coords.latitude, lng: position.coords.longitude }; set("lat", point.lat); set("lng", point.lng); set("address", `GPS pin ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)} — add store details`); try { const place = await findLocation(point); set("address", place.address); set("lat", place.latitude); set("lng", place.longitude); toast.success(`Actual store GPS location detected (±${Math.round(position.coords.accuracy)} m)`); } catch (error) { toast.info(error instanceof Error ? `${error.message} The exact GPS pin is still saved.` : "The exact GPS pin is saved; add the store details."); } finally { setLocating(false); } }, () => { setLocating(false); toast.info("Allow precise location in Chrome, or search the complete store address"); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }); }
  async function locateAddress() { if (!form.address.trim()) return toast.error("Enter the store address first"); setMapBusy(true); try { const place = await findLocation({ address: form.address }); set("address", place.address); set("lat", place.latitude); set("lng", place.longitude); toast.success("Store address pinned on the map"); } catch (error) { toast.error(error instanceof Error ? error.message : "Address was not found"); } finally { setMapBusy(false); } }
  function continueOnboarding() { if (step === 1 && form.category === "Other" && !otherCategory.trim()) return toast.error("Enter your business category"); setStep((current) => current + 1); }
  async function submit() {
    if (!form.businessName || !form.ownerEmail || !form.address || !form.fssai || !form.expiry || !file) return toast.error("Complete all business and certification fields");
    if (form.category === "Other" && !otherCategory.trim()) return toast.error("Enter your business category");
    if (!Number.isFinite(form.lat) || !Number.isFinite(form.lng)) return toast.error("Detect the store GPS location or find its typed address on the map first");
    if (!form.delivery && !form.pickup) return toast.error("Enable delivery or pickup");
    if (operationsCreated && invite && !/^\S+@\S+\.\S+$/.test(inviteEmail.trim())) return toast.error("Enter the email address the invitation should go to");
    setBusy(true);
    let vendorId = id("VEN");
    try {
      const category = form.category === "Other" ? otherCategory.trim() : form.category;
      if (!operationsCreated && session.userId && process.env.NEXT_PUBLIC_DEMO_MODE === "false" && isSupabaseConfigured()) vendorId = await submitLiveVendorApplication({ userId: session.userId, businessName: form.businessName, category, locality: form.address, fssaiNumber: form.fssai, expiryDate: form.expiry, certificate: file, address: form.address, latitude: form.lat, longitude: form.lng, radiusKm: form.radius, delivery: form.delivery, pickup: form.pickup, operatingHours: { duration_hours: 7 } });
      const vendor: Vendor = { id: vendorId, ownerEmail: form.ownerEmail, ownerName: form.ownerName, businessName: form.businessName, category, address: form.address, latitude: form.lat, longitude: form.lng, radiusKm: form.radius, delivery: form.delivery, pickup: form.pickup, openToday: false, fssaiNumber: form.fssai, certificateName: file.name, expiryDate: form.expiry, verification: "Submitted", operational: "Inactive", plan: "Crave" };
      setState((s) => ({ ...s, vendors: [vendor, ...s.vendors.filter((v) => v.ownerEmail !== vendor.ownerEmail)], notifications: [notice(form.ownerEmail, "vendor", "Application submitted", "Operations will verify your certificate and business details."), ...s.notifications], audit: [audit(session, operationsCreated ? "Operations onboarded vendor" : "Submitted vendor application", form.businessName), ...s.audit] }));
      toast.success("Vendor application sent to Operations");
      if (operationsCreated && invite) {
        if (isLiveSupabaseMode()) {
          try { const token = await getAccessToken(); if (!token) throw new Error("Sign in again to send invitations"); await inviteVendorByEmail({ email: inviteEmail.trim(), name: form.ownerName, businessName: form.businessName }, token); toast.success(`Invitation email sent to ${inviteEmail.trim()}`); }
          catch (caught) { toast.error(caught instanceof Error ? caught.message : "The invitation email could not be sent"); }
        } else toast.info("Invitation emails are sent only on the live site. Nothing was emailed in this demo.");
      }
      close?.();
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "Application could not be submitted"); } finally { setBusy(false); }
  }
  return <div className={operationsCreated ? "sp-v7" : "sp-v7 k-onb min-h-screen bg-[#faf6f4] p-4 sm:p-8"}>{!operationsCreated && <div className="mx-auto flex max-w-6xl items-center justify-between"><Logo /><button onClick={onLogout} className="text-sm font-bold text-stone-500">Sign out</button></div>}<div className={operationsCreated ? "grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]" : "mx-auto mt-8 max-w-6xl"}><div className="surface-card rounded-[34px] p-6 shadow-xl sm:p-8"><div className="k-stepper-wrap"><p className="sr-only">Vendor onboarding · {step}/4</p><ol className="k-stepper" aria-label="Onboarding steps">{["Business", "Location", "Fulfilment", "Certificate"].map((label, index) => { const n = index + 1; const done = n < step; return <li key={label} className={`${done ? "done" : n === step ? "now" : ""}`} aria-current={n === step ? "step" : undefined}><span className="k-step-dot">{done ? <Check className="size-4" /> : n}</span><span className="k-step-label">{label}</span></li>; })}</ol><h1 className="mt-5 text-2xl font-bold">{["Business profile", "Location & service radius", "Fulfilment controls", "Food certification"][step - 1]}</h1></div>
  {step === 1 && <div className="mt-7 grid gap-5 md:grid-cols-2"><Field label="Business name"><input value={form.businessName} onChange={(e) => set("businessName", e.target.value)} className={inputClass} /></Field><Field label="Category"><Select value={form.category} onValueChange={(value) => set("category", value)}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{categoryNames.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>{form.category === "Other" && <Field label="Your category"><input value={otherCategory} onChange={(e) => setOtherCategory(e.target.value)} className={inputClass} placeholder="Enter your business category" /></Field>}<Field label="Owner name"><input value={form.ownerName} disabled={operationsCreated} onChange={(e) => set("ownerName", e.target.value)} className={inputClass} /></Field>{operationsCreated ? <Field label="Assign to vendor login" hint="The vendor will appear when this exact account signs in."><Select value={form.ownerEmail} onValueChange={(email) => { const account = demoAccounts.find((item) => item.email === email)!; set("ownerEmail", email); set("ownerName", account.name); }}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{demoAccounts.filter((account) => account.role === "vendor").map((account) => <SelectItem key={account.email} value={account.email}>{account.name} · {account.email}</SelectItem>)}</SelectContent></Select></Field> : <Field label="Owner email"><input type="email" value={form.ownerEmail} disabled className={inputClass} /></Field>}{operationsCreated && <div className="rounded-3xl bg-[#faf6f4] p-4 md:col-span-2"><div className="flex items-center justify-between gap-4"><div><p className="font-semibold">Send the vendor an invitation email</p><p className="text-sm text-[#71676b]">They get a link to set a password and finish onboarding themselves.</p></div><Switch checked={invite} onCheckedChange={setInvite} aria-label="Send the vendor an invitation email" /></div>{invite && <Field label="Send the invitation to"><input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="owner@theirbusiness.com" className={inputClass} /></Field>}</div>}</div>}
  {step === 2 && <div className="mt-7 grid gap-6 lg:grid-cols-[.85fr_1.15fr]"><div className="space-y-4"><Field label="Full store address"><Textarea value={form.address} onChange={(e) => set("address", e.target.value)} className="min-h-28 rounded-xl" placeholder="Street, landmark, area, city and PIN" /></Field><LocationSuggestions query={form.address} onSelect={(place) => { set("address", place.address); set("lat", place.latitude); set("lng", place.longitude); }} /><div className="flex flex-wrap gap-2"><Button onClick={detect} disabled={locating} variant="outline" className="rounded-xl"><LocateFixed className={locating ? "animate-spin" : ""} />{locating ? "Finding current address…" : "Use current location"}</Button><Button onClick={locateAddress} disabled={mapBusy} variant="outline" className="rounded-xl"><Search className={mapBusy ? "animate-pulse" : ""} />{mapBusy ? "Finding…" : "Find typed address"}</Button></div><Field label={`Supply radius · ${form.radius} km`} hint="You can adjust this daily after onboarding"><Slider value={[form.radius]} min={1} max={30} step={1} onValueChange={(value) => set("radius", value[0])} /></Field></div><MapPreview lat={form.lat} lng={form.lng} radius={form.radius} label="Store service location" /></div>}
  {step === 3 && <div className="mt-7 grid gap-4 md:grid-cols-3"><ToggleCard icon={Truck} title="Vendor delivery" body="Your own staff delivers orders" checked={form.delivery} setChecked={(v) => set("delivery", v)} /><ToggleCard icon={ShoppingBag} title="Self pickup" body="Customer collects from your store" checked={form.pickup} setChecked={(v) => set("pickup", v)} /><div className="surface-card-muted rounded-3xl p-5"><Store className="text-[#653046]" /><h3 className="mt-4 font-black">Operating duration: 7 hours</h3><p className="mt-2 text-sm leading-6 text-stone-500">No fixed opening or closing time was provided. You can set a schedule later.</p><p className="mt-3 text-xs font-bold text-stone-500">Closed until verified. After approval, you can open or close for the day without changing your profile.</p></div></div>}
  {step === 4 && <div className="mt-7 grid gap-5 md:grid-cols-2"><Field label="Food certificate / FSSAI number"><input value={form.fssai} onChange={(e) => set("fssai", e.target.value)} className={inputClass} /></Field><Field label="Expiry date"><input type="date" min={tomorrow()} value={form.expiry} onChange={(e) => set("expiry", e.target.value)} className={inputClass} /></Field><label className="surface-card-muted md:col-span-2 grid min-h-36 cursor-pointer place-items-center rounded-3xl border-2 border-dashed p-5 text-center"><input type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} /><Upload className="mx-auto text-[#b42332]" /><div className="mt-2 font-black">{file?.name || "Upload certificate PDF or image"}</div><div className="text-xs text-stone-500">Private document; accessible only to this vendor and authorised Operations/Admin users.</div></label></div>}
  <div className="mt-8 flex justify-between"><Button variant="outline" disabled={step === 1} onClick={() => setStep((s) => s - 1)} className="rounded-xl"><ArrowLeft />Back</Button>{step < 4 ? <Button onClick={continueOnboarding} className="rounded-xl bg-[#753b50] hover:bg-[#292124]">Continue<ArrowRight /></Button> : <Button onClick={submit} disabled={busy} className="rounded-xl bg-[#753b50] hover:bg-[#602d40]"><FileCheck2 />{busy ? "Submitting…" : "Submit for verification"}</Button>}</div></div>{operationsCreated && <aside className="surface-card rounded-3xl p-5"><h3 className="text-lg font-semibold">Documents to collect</h3><ul className="mt-3 space-y-2 text-sm">{[["PAN", true], ["Identity proof", true], ["Address proof", true], ["FSSAI licence", true], ["Bank proof", true], ["GST (if applicable)", false]].map(([label, required]) => <li key={String(label)} className="flex items-center gap-2"><span className={`grid size-5 place-items-center rounded-full ${required ? "bg-[#753b50]" : "bg-[#e8dfe1]"}`}>{required ? <Check className="size-3.5" /> : null}</span>{String(label)}</li>)}</ul><p className="mt-4 flex items-start gap-2 rounded-2xl bg-[#FFF4CF] p-3 text-xs font-medium text-[#795900]"><AlertTriangle className="mt-0.5 size-4 shrink-0" />The vendor cannot go live until the FSSAI licence is valid and Operations has verified every required document.</p></aside>}</div></div>;
}

/** The map libraries need the browser, so the small location map is loaded only there. */
function PinMap(props: { lat: number; lng: number; radiusKm?: number; onChange?: (point: { lat: number; lng: number }) => void }) {
  const [Component, setComponent] = useState<null | ((p: { lat: number; lng: number; radiusKm?: number; onChange?: (point: { lat: number; lng: number }) => void }) => React.ReactElement)>(null);
  useEffect(() => { let alive = true; void import("@/components/pin-map").then((mod) => { if (alive) setComponent(() => mod.PinMap); }); return () => { alive = false; }; }, []);
  return Component ? <Component {...props} /> : <div className="grid h-full w-full place-items-center bg-stone-100 text-sm text-stone-400">Loading map…</div>;
}

function MapPreview({ lat, lng, radius, label = "Selected location", onPinChange }: { lat?: number; lng?: number; radius: number; label?: string; onPinChange?: (point: { lat: number; lng: number }) => void }) {
  const latitude = lat ?? 11.0168;
  const longitude = lng ?? 76.9558;
  const fullMapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=15/${latitude}/${longitude}`;
  const googleMapUrl = `https://www.google.com/maps/search/?api=1&query=${latitude}%2C${longitude}`;
  return <div className="surface-card overflow-hidden rounded-[22px]"><div className="relative h-72 bg-stone-100"><PinMap lat={latitude} lng={longitude} radiusKm={radius} onChange={onPinChange} /><div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-white/95 px-3 py-2 text-xs font-black shadow-lg backdrop-blur">{lat !== undefined && lng !== undefined ? label : "Coimbatore preview — detect or search to place pin"}</div>{onPinChange && <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl bg-white/95 px-3 py-2 text-xs font-bold shadow-lg">Drag the pin to adjust your exact location</div>}{radius > 0 && <div className="pointer-events-none absolute bottom-3 right-3 rounded-xl bg-[#292124]/90 px-3 py-2 text-xs font-black text-white shadow-lg">Service view: {radius} km</div>}</div><div className="flex flex-wrap items-center gap-3 p-3 text-xs text-stone-500"><span className="mr-auto font-mono">{lat !== undefined && lng !== undefined ? `Exact pin ${lat.toFixed(6)}, ${lng.toFixed(6)}` : "No confirmed pin yet"}</span><a href={googleMapUrl} target="_blank" rel="noreferrer" className="font-black text-[#292124] hover:underline">Verify in Google Maps ↗</a><a href={fullMapUrl} target="_blank" rel="noreferrer" className="font-black text-[#292124] hover:underline">OpenStreetMap ↗</a><span className="w-full text-[11px] text-stone-400">Map © OpenStreetMap contributors</span></div></div>;
}
function ToggleCard({ icon: Icon, title, body, checked, setChecked }: { icon: typeof Store; title: string; body: string; checked: boolean; setChecked: (v: boolean) => void }) { return <div className={`rounded-2xl border p-5 ${checked ? "border-[#753b50] bg-[#f7edf0]" : "bg-white"}`}><div className="flex items-center justify-between"><Icon className="text-[#653046]" /><Switch checked={checked} onCheckedChange={setChecked} /></div><h3 className="mt-4 font-black">{title}</h3><p className="mt-2 text-sm text-stone-500">{body}</p></div>; }

function CustomerArea({ active, session, state, setState, navigate, openAgent, openVendor, locationSignal, shorts, shortsRadius, onShortsRadius, openShorts, onSeeAllShorts }: { onSeeAllShorts: () => void; shorts: ShortsApi; shortsRadius: number; onShortsRadius: (km: number) => void; openShorts: (list: FoodShort[], index: number) => void; active: string; session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; navigate: (page: string) => void; openAgent: () => void; openVendor: (vendorId: string) => void; locationSignal?: number }) {
  if (active === "Cart") return <CartView session={session} state={state} setState={setState} navigate={navigate} />;
  if (active === "My schedule") return <SchedulesV4 session={session} state={state} setState={setState} navigate={navigate} />;
  if (active === "Monthly requirement") return <RequirementsV4 session={session} state={state} setState={setState} />;
  if (active === "My quotations") return isLiveSupabaseMode() ? <LiveCustomerRfqs /> : <CustomerQuotesV4 session={session} state={state} setState={setState} />;
  if (active === "Orders") return <OrdersV4 session={session} state={state} setState={setState} scope="customer" />;
  if (active === "Profile & food") return <CustomerProfileV4 session={session} state={state} setState={setState} />;
  if (active === "Ticket centre") return <TicketCentre session={session} state={state} setState={setState} />;
  if (active === "Wishlist") return <WishlistView session={session} state={state} setState={setState} />;
  return <Marketplace view={active === "Search" ? "search" : "home"} session={session} state={state} setState={setState} navigate={navigate} openAgent={openAgent} openVendor={openVendor} locationSignal={locationSignal} shorts={shorts} shortsRadius={shortsRadius} openShorts={openShorts} onSeeAllShorts={onSeeAllShorts} />;
}

/** Add one pack of a product to the signed-in customer's saved basket (optimistic locally, then synced). */
async function addProductToCart(state: V3State, setState: React.Dispatch<React.SetStateAction<V3State>>, session: DemoSession, product: Product) {
  const own = state.cart.filter((item) => item.customerEmail === session.email);
  const existing = own.find((item) => item.productId === product.id);
  const nextOwn = existing ? own.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item) : [{ id: id("CART"), customerEmail: session.email, productId: product.id, quantity: 1 }, ...own];
  setState((current) => ({ ...current, cart: [...current.cart.filter((item) => item.customerEmail !== session.email), ...nextOwn] }));
  recordTasteSignal(state, setState, session, product, "save");
  try {
    if (isLiveSupabaseMode()) {
      const saved = await syncLiveCart({ items: nextOwn.map((item) => ({ productId: item.productId, quantity: item.quantity })) });
      if (saved.snapshot) setState((current) => mergeLiveCommerce(current, saved.snapshot as LiveCommerceStateSnapshot, session));
    }
    toast.success(`${product.name} added to cart`);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Cart could not be saved");
    if (isLiveSupabaseMode()) { try { const snapshot = await loadLiveCommerceSnapshot(); setState((current) => mergeLiveCommerce(current, snapshot, session)); } catch {} }
  }
}

function Marketplace({ session, state, setState, navigate, openAgent, openVendor, locationSignal = 0, shorts, shortsRadius, openShorts, onSeeAllShorts, view = "home" }: { view?: "home" | "search"; onSeeAllShorts: () => void; shorts: ShortsApi; shortsRadius: number; openShorts: (list: FoodShort[], index: number) => void; session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; navigate: (page: string) => void; openAgent: () => void; openVendor: (vendorId: string) => void; locationSignal?: number }) {
  const profile = state.customers.find((x) => x.email === session.email)!;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  // Live campaigns set by the Super Admin: shown to this customer only when live and inside their audience
  const hasOrdered = state.orders.some((o) => o.customerEmail === session.email);
  const campaigns = useCustomerCampaigns(state.campaigns, hasOrdered);
  const countCampaignView = useCampaignViewCounter();
  const scrollToProducts = () => requestAnimationFrame(() => document.querySelector('[data-tour="products"]')?.scrollIntoView({ behavior: "smooth", block: "start" }));
  function runCampaign(campaign: LiveCampaign) {
    recordCampaignEvent(campaign.id, "click");
    if (campaign.targetType === "vendor" && campaign.targetValue) return openVendor(campaign.targetValue);
    if (campaign.targetType === "category" && campaign.targetValue) { setCategory(campaign.targetValue); setQuery(""); }
    else if (campaign.targetType === "product" && campaign.targetValue) { setCategory("All"); setQuery(state.products.find((p) => p.id === campaign.targetValue)?.name || ""); }
    navigate("Search");
  }
  const [selected, setSelected] = useState<Product | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapBusy, setMapBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [diagnostics, setDiagnostics] = useState<MarketplaceDiagnostics | null>(null);
  const [catalogueError, setCatalogueError] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [maxPrice, setMaxPrice] = useState(profile.agentMemory?.lastBudget || 0);
  const [maxCalories, setMaxCalories] = useState(profile.agentMemory?.calorieTarget || 0);
  const [minProtein, setMinProtein] = useState(profile.agentMemory?.minProtein || 0);
  const [dietary, setDietary] = useState("All");
  const [sortBy, setSortBy] = useState("Recommended");
  const [deliveryDate, setDeliveryDate] = useState(tomorrow());
  const [periodDays, setPeriodDays] = useState(1);
  const [showAiPicks, setShowAiPicks] = useState(true);
  const [aiPickIds, setAiPickIds] = useState<string[]>([]);
  const [aiPickMessage, setAiPickMessage] = useState("");
  const [aiPicksLoading, setAiPicksLoading] = useState(false);
  const [draftAddress, setDraftAddress] = useState(profile.address);
  const [draftCoords, setDraftCoords] = useState<{ lat?: number; lng?: number }>({ lat: profile.latitude, lng: profile.longitude });
  const locationConfirmed = Number.isFinite(profile.latitude) && Number.isFinite(profile.longitude);
  const [vendorFilter, setVendorFilter] = useState("");
  const locationDraftRef = useRef({ address: profile.address, latitude: profile.latitude, longitude: profile.longitude });
  useEffect(() => { locationDraftRef.current = { address: profile.address, latitude: profile.latitude, longitude: profile.longitude }; }, [profile.address, profile.latitude, profile.longitude]);
  useEffect(() => {
    if (locationSignal <= 0) return;
    queueMicrotask(() => {
      const latest = locationDraftRef.current;
      setDraftAddress(latest.address);
      setDraftCoords({ lat: latest.latitude, lng: latest.longitude });
      setLocationOpen(true);
    });
  }, [locationSignal]);
  const qrVendorHandled = useRef(false);

  // A vendor's QR code links to "<origin>/?vendor=<id>" (there is no path
  // router in this app, so a query param is the deep-link mechanism). Once
  // this customer's marketplace vendors are loaded, jump straight to that
  // vendor's products and drop the param so it doesn't linger in the URL.
  useEffect(() => {
    if (qrVendorHandled.current || !state.vendors.length) return;
    const params = new URLSearchParams(window.location.search);
    const vendorId = params.get("vendor");
    if (!vendorId) return;
    qrVendorHandled.current = true;
    const vendor = state.vendors.find((v) => v.id === vendorId);
    if (vendor) { queueMicrotask(() => setVendorFilter(vendorId)); toast.success(`Showing ${vendor.businessName}'s shop`); }
    else toast.error("That vendor's shop is not available right now.");
    params.delete("vendor");
    const next = params.toString();
    window.history.replaceState({}, "", next ? `?${next}` : window.location.pathname);
  }, [state.vendors]);

  // Dummy ratings so the marketplace never shows an unreviewed, unproven-
  // looking product — generates deterministic sample reviews for whatever
  // real products are actually loaded (no hardcoded IDs, works against any
  // database) and only ever adds reviews for products that don't have any.
  useEffect(() => {
    if (!state.products.length) return;
    const additions = seedReviewsForProducts(state.products, state.vendors, state.reviews);
    if (additions.length) queueMicrotask(() => setState((s) => ({ ...s, reviews: [...s.reviews, ...additions] })));
  }, [state.products, state.vendors, state.reviews, setState]);

  // Taste Match: pull in a durable profile from Supabase if one exists (once
  // the V8_1 migration is applied) without clobbering local progress made
  // this session; then classify whatever products are visible and don't yet
  // have cached attributes, via the AI route (with its own local fallback).
  const tasteLoadedRef = useRef(false);
  useEffect(() => {
    if (tasteLoadedRef.current || !session.userId) return;
    tasteLoadedRef.current = true;
    void loadLiveTasteProfile(session.userId).then((remote) => {
      if (!remote || !Object.keys(remote.weights).length) return;
      setState((s) => (Object.keys(tasteProfileFor(s, session.email).weights).length ? s : upsertTasteProfile(s, session.email, remote.weights, remote.onboarded)));
    });
  }, [session.userId, session.email, setState]);

  async function refreshMarketplace(showSuccess = false) {
    if (!isLiveSupabaseMode() || !locationConfirmed) return;
    setRefreshing(true); setCatalogueError("");
    try {
      const live = await loadLiveMarketplace(profile.latitude!, profile.longitude!);
      const products = live.items.map(marketplaceProductFromLive);
      const vendorMap = new Map<string, Vendor>();
      live.items.forEach((row) => vendorMap.set(row.vendor_id, { id: row.vendor_id, ownerEmail: "vendor@sheplates.local", ownerName: "Verified vendor", businessName: row.vendor_name, category: row.category, address: "Serviceable near your delivery pin", radiusKm: Math.max(1, Number(row.distance_km)), latitude: Number.isFinite(row.vendor_lat) ? row.vendor_lat : undefined, longitude: Number.isFinite(row.vendor_lng) ? row.vendor_lng : undefined, delivery: row.delivery_enabled, pickup: row.pickup_enabled, openToday: true, fssaiNumber: "Verified", certificateName: "Private", expiryDate: "—", verification: "Verified", operational: "Active", plan: planFromCode(row.vendor_plan_code) }));
      setDiagnostics(live.diagnostics);
      setState((current) => ({ ...current, products, vendors: [...vendorMap.values()], markups: {}, merchandising: live.merchandising || current.merchandising, merchandisingError: live.merchandisingError || null }));
      if (showSuccess) toast.success(products.length ? `${products.length} serviceable product pack(s) refreshed` : "Marketplace checked; see the eligibility explanation below");
    } catch (error) { setCatalogueError(error instanceof Error ? error.message : "Marketplace could not be refreshed"); }
    finally { setRefreshing(false); }
  }
  function detectLocation() { if (!navigator.geolocation) return toast.error("Location is unavailable in this browser"); setLocating(true); navigator.geolocation.getCurrentPosition(async (position) => { const point = { lat: position.coords.latitude, lng: position.coords.longitude }; setDraftCoords(point); setDraftAddress(`GPS pin ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)} — add flat/street details`); try { const place = await findLocation(point); setDraftAddress(place.address); setDraftCoords({ lat: place.latitude, lng: place.longitude }); toast.success(`Actual GPS location detected (±${Math.round(position.coords.accuracy)} m)`); } catch (error) { toast.info(error instanceof Error ? `${error.message} The exact GPS pin is still shown.` : "The exact GPS pin is shown; add street details."); } finally { setLocating(false); } }, (error) => { setLocating(false); toast.error(error.code === 1 ? "Allow precise location for localhost in Chrome, then try again" : "GPS could not get a fresh position. Search your complete address instead."); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }); }
  async function findTypedLocation() { if (!draftAddress.trim()) return toast.error("Enter your complete address first"); setMapBusy(true); try { const place = await findLocation({ address: draftAddress }); setDraftAddress(place.address); setDraftCoords({ lat: place.latitude, lng: place.longitude }); toast.success("Address located on the map"); } catch (error) { toast.error(error instanceof Error ? error.message : "Address was not found"); } finally { setMapBusy(false); } }
  async function saveLocation() { if (!Number.isFinite(draftCoords.lat) || !Number.isFinite(draftCoords.lng)) return toast.error("Detect GPS or find the typed address before saving"); try { if (session.userId && process.env.NEXT_PUBLIC_DEMO_MODE === "false" && isSupabaseConfigured()) await saveLiveCustomerLocation({ userId: session.userId, address: draftAddress, latitude: draftCoords.lat!, longitude: draftCoords.lng! }); setState((current) => ({ ...current, customers: current.customers.map((item) => item.email === session.email ? { ...item, address: draftAddress, latitude: draftCoords.lat, longitude: draftCoords.lng } : item) })); setLocationOpen(false); toast.success("Delivery location and service pin updated"); } catch (error) { toast.error(error instanceof Error ? error.message : "Location could not be saved"); } }
  function addToCart(product: Product) { return addProductToCart(state, setState, session, product); }
  function openProduct(product: Product) {
    recordTasteSignal(state, setState, session, product, "view");
    setSelected(product);
  }

  const serviceable = useMemo(() => locationConfirmed ? state.products.filter((product) => {
    const vendor = state.vendors.find((v) => v.id === product.vendorId);
    const distance = product.liveDistanceKm ?? distanceKm(profile.latitude, profile.longitude, vendor?.latitude, vendor?.longitude);
    const allergyText = `${product.name} ${product.dietaryTags.join(" ")}`.toLowerCase();
    const obviousAllergyConflict = profile.allergies.some((allergy) => allergy && allergyText.includes(allergy.toLowerCase()));
    return product.active && product.stock > 0 && vendor?.verification === "Verified" && vendor.operational === "Active" && vendor.openToday && distance !== null && distance <= vendor.radiusKm && !obviousAllergyConflict;
  }) : [], [locationConfirmed, state.products, state.vendors, profile.latitude, profile.longitude, profile.allergies]);

  const serviceableSignature = serviceable.map((product) => `${product.id}:${product.stock}:${finalPrice(product, state)}`).sort().join("|");
  const serviceableRef = useRef(serviceable);
  const stateForRecommendations = useRef(state);
  useEffect(() => { serviceableRef.current = serviceable; }, [serviceable]);
  useEffect(() => { stateForRecommendations.current = state; }, [state]);
  useEffect(() => {
    if (!serviceable.length) return;
    const uncached = serviceable.filter((p) => !state.productAttributes[p.id]).slice(0, 12);
    if (!uncached.length) return;
    void fetchLiveFoodAttributes(uncached.map((p) => ({ id: p.id, name: p.name, category: p.category }))).then((remote) => {
      setState((s) => {
        const next = { ...s.productAttributes };
        for (const p of uncached) next[p.id] = remote[p.id] && Object.keys(remote[p.id]).length ? remote[p.id] : inferAttributesLocally(p.name, p.category);
        return { ...s, productAttributes: next };
      });
    });
  }, [serviceable, serviceableSignature, setState, state.productAttributes]);
  const recommendationsEnabled = state.merchandising.recommendationPopupEnabled;
  useEffect(() => {
    if (!showAiPicks || !recommendationsEnabled || !serviceable.length) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setAiPicksLoading(true);
      try {
        const currentServiceable = serviceableRef.current;
        const currentState = stateForRecommendations.current;
        const token = await getAccessToken();
        const context = !token ? { availableProducts: currentServiceable.map((product) => ({ item_id: product.id, item_name: product.name, category: product.category, customer_price: finalPrice(product, currentState), calories_per_unit: product.calories, protein_g: product.protein, dietary_tags: product.dietaryTags })) } : undefined;
        const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ task: "commerce", role: "customer", message: "Give me up to three useful picks from what is available now. Use what you remember about my shopping preferences, but do not invent anything.", context }) });
        const json = await response.json() as { result?: { selectedProductIds?: string[]; summary?: string } };
        if (cancelled) return;
        const valid = (json.result?.selectedProductIds || []).filter((productId) => currentServiceable.some((product) => product.id === productId)).slice(0, 3);
        setAiPickIds(valid);
        setAiPickMessage(json.result?.summary || "");
      } catch { if (!cancelled) { setAiPickIds([]); setAiPickMessage(""); } }
      finally { if (!cancelled) setAiPicksLoading(false); }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  // Serviceability, stock and price are the grounding boundary for this recommendation call.
  }, [serviceable.length, serviceableSignature, showAiPicks, recommendationsEnabled]);

  const dietaryOptions = Array.from(new Set(serviceable.flatMap((product) => product.dietaryTags))).filter(Boolean).slice(0, 10);
  const popularVendors = state.vendors
    .filter((vendor) => serviceable.some((product) => product.vendorId === vendor.id))
    .sort((a, b) => (distanceKm(profile.latitude, profile.longitude, a.latitude, a.longitude) ?? 99) - (distanceKm(profile.latitude, profile.longitude, b.latitude, b.longitude) ?? 99));
  const filtered = serviceable.filter((product) => {
    const vendor = state.vendors.find((v) => v.id === product.vendorId)!;
    const text = `${product.name} ${product.category} ${vendor.businessName} ${product.dietaryTags.join(" ")}`.toLowerCase();
    return groupMatches(category, product.category)
      && (!query || text.includes(query.toLowerCase()))
      && (!maxPrice || finalPrice(product, state) <= maxPrice)
      && (!maxCalories || product.calories <= maxCalories)
      && (!minProtein || product.protein >= minProtein)
      && (dietary === "All" || product.dietaryTags.includes(dietary))
      && (!vendorFilter || product.vendorId === vendorFilter);
  });

  const preferenceScore = (product: Product) => {
    let score = 0;
    if (state.merchandising.featuredProductIds.includes(product.id)) score += 100;
    if (profile.agentMemory?.favoriteCategories?.includes(product.category)) score += 12;
    if (profile.agentMemory?.favoriteProducts?.includes(product.id)) score += 14;
    if (profile.agentMemory?.lastBudget && finalPrice(product, state) <= profile.agentMemory.lastBudget) score += 6;
    if (profile.goals.some((goal) => /protein/i.test(goal))) score += Math.min(10, product.protein / 4);
    if (profile.diet && product.dietaryTags.some((tag) => profile.diet.toLowerCase().includes(tag.toLowerCase()))) score += 8;
    return score;
  };

  const visible = [...filtered].sort((a, b) => {
    if (sortBy === "Price low") return finalPrice(a, state) - finalPrice(b, state);
    if (sortBy === "Protein high") return b.protein - a.protein;
    if (sortBy === "Calories low") return a.calories - b.calories;
    if (sortBy === "Nearest") return (a.liveDistanceKm || 999) - (b.liveDistanceKm || 999);
    return preferenceScore(b) - preferenceScore(a);
  });
  const groundedAiPicks = aiPickIds.map((productId) => serviceable.find((product) => product.id === productId)).filter(Boolean) as Product[];
  const aiPicks = groundedAiPicks.length ? groundedAiPicks : [...serviceable].sort((a, b) => preferenceScore(b) - preferenceScore(a) || finalPrice(a, state) - finalPrice(b, state)).slice(0, 3);
  const featured = state.merchandising.featuredProductIds.map((productId) => serviceable.find((product) => product.id === productId)).filter(Boolean) as Product[];
  const periodEndDate = addDaysISO(deliveryDate, Math.max(0, periodDays - 1));
  const activeFilterCount = [category !== "All", maxPrice > 0, maxCalories > 0, minProtein > 0, dietary !== "All", deliveryDate !== tomorrow(), periodDays !== 1].filter(Boolean).length;
  const emptyReason = !diagnostics ? "Refresh to check verification, store status, stock and service radius from the live marketplace."
    : diagnostics.verified_vendors === 0 ? "No vendor has been verified by Operations yet."
      : diagnostics.open_vendors === 0 ? "A verified vendor exists, but its store is closed or marketplace access is not enabled."
        : diagnostics.vendors_with_products === 0 ? "The verified vendor has no active in-stock product packs."
          : diagnostics.vendors_in_radius === 0 ? "The vendor pin is outside its saved service radius from your delivery pin."
            : "A product exists but did not pass every marketplace eligibility rule. Refresh after the vendor updates it.";

  const renderRow = (product: Product) => {
    const vendor = state.vendors.find((v) => v.id === product.vendorId)!;
    const distance = product.liveDistanceKm ?? distanceKm(profile.latitude, profile.longitude, vendor.latitude, vendor.longitude);
    const personalized = preferenceScore(product) > 5;
    const fulfilmentLabel = vendor.delivery && vendor.pickup ? "Delivery & pickup" : vendor.pickup ? "Pickup only" : "Delivery only";
    const isWishlisted = state.wishlist.some((w) => w.customerEmail === session.email && w.productId === product.id);
    const rating = productRating(product.id, state.reviews);
    return <article key={product.id} className="sh k-pr">
      <div className="k-pr-img" style={{ background: product.imageUrl ? undefined : categoryVisual(product.category).bg }}>
        {product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <ProductGlyph category={product.category} iconClassName="size-9" />}
      </div>
      <div className="k-pr-body">
        <h3>{product.name}</h3>
        <p className="s m">{vendor.businessName} · {product.baseUnit} · {distance?.toFixed(1)} km {vendor.pickup && !vendor.delivery ? "to pick up" : "away"} · {fulfilmentLabel}</p>
        <div className="k-pr-tags">
          {product.nutritionStatus === "Pending review" || product.calories <= 0 ? <span className="pill warn">Nutrition pending</span> : <><span className="pill">{product.calories} kcal</span><span className="pill">{product.protein}g protein</span></>}
          {product.dietaryTags.slice(0, 2).map((tag) => <span key={tag} className="pill ok"><span className="dot ok" />{tag}</span>)}
          {rating && <span className="rate"><Star className="size-4" />{rating.average.toFixed(1)} ({rating.count})</span>}
          {personalized && <span className="pill o"><Sparkles className="size-4" />For you</span>}
          <TasteMatchBadge state={state} setState={setState} session={session} product={product} />
        </div>
      </div>
      <div className="k-pr-act">
        <div className="k-pr-price"><b>{money(finalPrice(product, state))}</b><span>per pack</span></div>
        <div className="k-pr-btns">
          <button type="button" className="btn xs" onClick={() => addToCart(product)}><ShoppingCart className="size-4" />Add</button>
          <button type="button" className="btn xs sec" onClick={() => openProduct(product)}><CalendarDays className="size-4" />Plan</button>
          <button type="button" onClick={() => setState((s) => ({ ...s, wishlist: isWishlisted ? s.wishlist.filter((w) => !(w.customerEmail === session.email && w.productId === product.id)) : [{ customerEmail: session.email, productId: product.id, addedAt: new Date().toISOString() }, ...s.wishlist] }))} aria-label={isWishlisted ? "Remove from wishlist" : "Save to wishlist"} aria-pressed={isWishlisted} className={`ibtn sm round${isWishlisted ? " o" : ""}`}><Heart className="size-5" /></button>
        </div>
      </div>
    </article>;
  };
  return <div className="sp-marketplace space-y-6">
    <div className="sp-market-toolbar rounded-[28px] p-3">
      <div className="sp-market-toolbar-grid grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 md:grid-cols-[.8fr_1.2fr_auto] xl:grid-cols-[.72fr_1.28fr_auto]">
        <button data-tour="location" onClick={() => { setDraftAddress(profile.address); setDraftCoords({ lat: profile.latitude, lng: profile.longitude }); setLocationOpen(true); }} className={`col-span-2 h-12 min-w-0 items-center rounded-2xl px-3 text-left md:col-span-1 md:flex ${locationConfirmed ? "hidden bg-[#faf6f4]" : "flex bg-amber-50 ring-1 ring-amber-300"}`}><MapPin className={`mr-2 size-5 shrink-0 ${locationConfirmed ? "text-[#653046]" : "text-amber-700"}`} /><span className="min-w-0 flex-1 truncate text-sm font-bold">{locationConfirmed ? profile.address : "Confirm your delivery location"}</span><LocateFixed className="ml-2 size-4 shrink-0 text-[#653046]" /></button>
        <div data-tour="search" className="flex h-12 items-center rounded-2xl bg-stone-100/90 px-3"><Search className="mr-2 size-5 text-stone-500" /><input value={query} onChange={(e) => { setQuery(e.target.value); if (view === "home" && e.target.value) navigate("Search"); }} placeholder="Search food, vendor, category, dietary tag…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />{query && <button onClick={() => setQuery("")}><X className="size-4" /></button>}</div>
        <div className="flex gap-2">
          <button data-tour="filters" onClick={() => { if (view === "home") navigate("Search"); setFiltersOpen((value) => view === "home" ? true : !value); }} className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black ${filtersOpen || activeFilterCount ? "border-[#753b50] bg-[#f7edf0] text-[#653046]" : "bg-white"}`}><Filter className="size-4" />Filters {activeFilterCount > 0 && <span className="grid size-5 place-items-center rounded-full bg-[#753b50] text-[10px] text-white">{activeFilterCount}</span>}</button>
        </div>
      </div>
      {vendorFilter && (
        <div className="flex flex-wrap items-center gap-2 px-1 text-xs font-bold text-stone-500">
          {vendorFilter && <button onClick={() => setVendorFilter("")} className="flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-stone-700"><MapPin className="size-3.5" />Viewing {state.vendors.find((v) => v.id === vendorFilter)?.businessName || "vendor"}<X className="size-3.5" /></button>}
        </div>
      )}
    </div>

    {view === "search" ? <div className="k-search-layout">
      <aside className={`k-filters sh${filtersOpen ? " open" : ""}`} aria-label="Filters"><div className="k-filters-head"><h2>Filters</h2><button type="button" className="k-filters-x" onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X className="size-5" /></button></div>
      <div className="grid gap-3">
        <Field label="Planning from"><input type="date" min={tomorrow()} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className={inputClass} /></Field>
        <Field label="Planning period"><Select value={String(periodDays)} onValueChange={(value) => setPeriodDays(Number(value))}><SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">This date</SelectItem><SelectItem value="7">Next 7 days</SelectItem><SelectItem value="14">Next 14 days</SelectItem><SelectItem value="30">Next 30 days</SelectItem></SelectContent></Select></Field>
        <Field label="Max budget"><input type="number" min="0" value={maxPrice || ""} onChange={(e) => setMaxPrice(Number(e.target.value))} placeholder="Any ₹" className={inputClass} /></Field>
        <Field label="Max calories / pack"><input type="number" min="0" value={maxCalories || ""} onChange={(e) => setMaxCalories(Number(e.target.value))} placeholder="Any kcal" className={inputClass} /></Field>
        <Field label="Min protein"><input type="number" min="0" value={minProtein || ""} onChange={(e) => setMinProtein(Number(e.target.value))} placeholder="Any grams" className={inputClass} /></Field>
        <Field label="Dietary tag"><Select value={dietary} onValueChange={setDietary}><SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="All">All dietary options</SelectItem>{dietaryOptions.map((tag) => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Sort"><Select value={sortBy} onValueChange={setSortBy}><SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger><SelectContent>{["Recommended", "Price low", "Protein high", "Calories low", "Nearest"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field>
        <div className=" flex flex-wrap items-center gap-2"><span className="text-xs font-black text-stone-500">Quick:</span>{[150, 300, 500, 1000].map((budget) => <button key={budget} onClick={() => setMaxPrice(budget)} className="rounded-full border bg-white px-3 py-1.5 text-xs font-black">Under ₹{budget}</button>)}<button onClick={() => { setMaxPrice(0); setMaxCalories(0); setMinProtein(0); setDietary("All"); setCategory("All"); setDeliveryDate(tomorrow()); setPeriodDays(1); setSortBy("Recommended"); }} className="ml-auto rounded-full px-3 py-1.5 text-xs font-black text-red-600">Clear filters</button></div>
      </div>
      </aside>
    <div className="k-results"><div className="flex flex-wrap items-end justify-between gap-3"><Heading eyebrow="MARKETPLACE" title={query ? `“${query}”` : category !== "All" ? category : "Food near you"} body={`${visible.length} result${visible.length === 1 ? "" : "s"} near ${shortArea(profile.address)} · ${deliveryDate}${periodDays > 1 ? ` to ${periodEndDate}` : ""} · verified, open and serviceable vendors only`} /><Button variant="outline" onClick={() => void refreshMarketplace(true)} disabled={refreshing || !isLiveSupabaseMode()} className="rounded-xl"><RefreshCcw className={refreshing ? "animate-spin" : ""} />Refresh</Button></div>{catalogueError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{catalogueError}</div>}
      <div data-tour="products" className="k-plist">{visible.map(renderRow)}</div>
      {!visible.length && (locationConfirmed ? <div className="mt-5 space-y-4"><Empty icon={Store} title="No matching products" body={serviceable.length ? "Your filters are narrowing the currently serviceable marketplace. Clear one or more filters, or ask She Agent for alternatives." : emptyReason} action={serviceable.length ? <Button onClick={() => { setMaxPrice(0); setMaxCalories(0); setMinProtein(0); setDietary("All"); setCategory("All"); setQuery(""); }} variant="outline" className="rounded-xl">Clear marketplace filters</Button> : undefined} /><div className="grid gap-3 sm:grid-cols-5">{diagnostics && [["Verified", diagnostics.verified_vendors], ["Open", diagnostics.open_vendors], ["With stock", diagnostics.vendors_with_products], ["In radius", diagnostics.vendors_in_radius], ["Products", diagnostics.serviceable_products]].map(([label, value]) => <div key={String(label)} className="surface-card rounded-2xl p-3 text-center"><div className="text-xl font-black">{value}</div><div className="text-xs text-stone-500">{label}</div></div>)}</div></div> : <Empty icon={LocateFixed} title="Confirm your actual location first" body="Products are hidden until GPS or a searched address creates a real service pin." action={<Button onClick={() => setLocationOpen(true)} className="rounded-xl bg-[#753b50]"><LocateFixed />Detect my location</Button>} />)}
    </div></div> : <>
    <CategoryGrid selected={category} onSelect={(key) => { setCategory(key); if (key !== "All") navigate("Search"); }} />
    <CampaignBanner campaigns={campaigns} onView={countCampaignView} onCta={runCampaign} fallback={<PromoBanner onShop={() => navigate("Food Drops")} />} />
    <VendorRow title="Nearby kitchens" vendors={popularVendors} state={state} profile={profile} onOpen={openVendor} />
    <VendorRow title="Home Foods" vendors={popularVendors.filter((v) => v.category === "Home food")} state={state} profile={profile} onOpen={openVendor} />

    <TasteOnboardingBanner state={state} setState={setState} session={session} />

    {showAiPicks && state.merchandising.recommendationPopupEnabled && aiPicks.length > 0 && <section className="sp-ai-card relative overflow-hidden rounded-[30px] p-5 sm:p-6">
      <button onClick={() => setShowAiPicks(false)} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-stone-100" aria-label="Close recommendations"><X className="size-4" /></button>
      <div className="pr-12"><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-[#653046]"><Sparkles className="size-4" />She Agent · for you {aiPicksLoading && <RefreshCcw className="size-3 animate-spin" />}</div><h2 className="mt-2 text-lg font-black tracking-[-.02em]">A few useful picks, based on your marketplace and preferences.</h2><p className="mt-1 max-w-3xl text-sm text-stone-500">{aiPickMessage || "These are grounded in currently serviceable products. She Agent can refine by budget, calories, protein, diet, schedule or anything you ask naturally."}</p></div>
      <div className="mt-5 flex snap-x gap-3 overflow-x-auto pb-2 hide-scrollbar md:grid md:grid-cols-3">{aiPicks.map((product) => <button key={product.id} onClick={() => openProduct(product)} className="surface-card-muted min-w-[82%] snap-start flex items-center gap-3 rounded-[22px] p-3 text-left transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md md:min-w-0"><div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl" style={{ background: product.imageUrl ? undefined : categoryVisual(product.category).bg }}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" /> : <ProductGlyph category={product.category} />}</div><div className="min-w-0 flex-1"><div className="truncate font-black">{product.name}</div><div className="mt-1 text-xs text-stone-500">{money(finalPrice(product, state))} · {product.nutritionStatus === "Pending review" || product.calories <= 0 ? "nutrition pending" : `${product.calories} kcal · ${product.protein}g protein`}</div></div><ArrowRight className="size-4 text-stone-400" /></button>)}</div>
      <div className="mt-4 flex flex-wrap gap-2"><Button onClick={openAgent} className="rounded-xl bg-[#292124]"><Sparkles />Ask She Agent to refine</Button><Button onClick={() => { setMaxPrice(profile.agentMemory?.lastBudget || 300); setFiltersOpen(true); }} variant="outline" className="rounded-xl">Use my usual budget</Button></div>
    </section>}
    {!showAiPicks && <div className="flex justify-end"><button onClick={() => setShowAiPicks(true)} className="soft-chip"><Sparkles className="size-3.5" />Show AI picks</button></div>}

    {featured.length > 0 && <section><div className="flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#653046]">Featured today</p><h2 className="mt-1 text-lg font-black">Picked by ShePlates</h2></div><span className="text-xs text-stone-400">Curated by Super Admin</span></div><div className="mt-4 flex gap-3 overflow-x-auto pb-2 hide-scrollbar">{featured.map((product) => <button key={product.id} onClick={() => openProduct(product)} className="surface-card min-w-60 rounded-3xl p-3 text-left"><div className="flex items-center gap-3"><div className="grid size-14 place-items-center overflow-hidden rounded-2xl" style={{ background: product.imageUrl ? undefined : categoryVisual(product.category).bg }}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" /> : <ProductGlyph category={product.category} />}</div><div><div className="font-black">{product.name}</div><div className="text-xs text-stone-500">{money(finalPrice(product, state))}</div></div></div></button>)}</div></section>}


    {visible.length > 0 && <section><div className="flex items-end justify-between"><h2 className="text-lg font-semibold">Popular today</h2><button type="button" onClick={() => navigate("Search")} className="text-sm font-semibold text-[#653046]">See all</button></div><div className="k-plist mt-3">{visible.slice(0, 6).map(renderRow)}</div></section>}
    </>}

    <ScheduleDialog product={selected} close={() => setSelected(null)} session={session} state={state} setState={setState} initialStartDate={deliveryDate} onCreated={() => navigate("Cart")} />
<Dialog open={locationOpen} onOpenChange={setLocationOpen}><DialogContent className="max-h-[92vh] overflow-x-hidden overflow-y-auto rounded-[28px] sm:max-w-5xl *:min-w-0"><DialogHeader><DialogTitle className="text-2xl font-bold">Confirm your delivery location</DialogTitle><DialogDescription>Use fresh GPS for your actual position, or search a complete address. Products are matched using the saved coordinates—not the address text.</DialogDescription></DialogHeader><div className="grid gap-5 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]"><div className="space-y-3"><Field label="Full delivery address"><Textarea value={draftAddress} onChange={(event) => setDraftAddress(event.target.value)} placeholder="Flat, street, landmark, area, city and PIN" className="min-h-24 rounded-xl" /></Field><LocationSuggestions query={draftAddress} onSelect={(place) => { setDraftAddress(place.address); setDraftCoords({ lat: place.latitude, lng: place.longitude }); }} /><div className="flex flex-wrap gap-2"><Button onClick={detectLocation} disabled={locating} className="rounded-xl bg-[#753b50]"><LocateFixed className={locating ? "animate-spin" : ""} />{locating ? "Getting fresh GPS…" : "Use my actual GPS location"}</Button><Button onClick={findTypedLocation} disabled={mapBusy} variant="outline" className="rounded-xl"><Search className={mapBusy ? "animate-pulse" : ""} />{mapBusy ? "Searching…" : "Find typed address"}</Button></div><Button onClick={saveLocation} className="h-12 w-full"><Check />Save this delivery pin</Button></div><div className="min-w-0"><MapPreview lat={draftCoords.lat} lng={draftCoords.lng} radius={2} label="Customer delivery pin" /></div></div></DialogContent></Dialog>  </div>;
}

function ScheduleDialog({ product, close, session, state, setState, initialStartDate, onCreated }: { product: Product | null; close: () => void; session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; initialStartDate?: string; onCreated?: () => void }) {
  const [startDate, setStartDate] = useState(tomorrow());
  const [endDate, setEndDate] = useState("");
  const [recurrence, setRecurrence] = useState<Schedule["recurrence"]>("Once");
  const [days, setDays] = useState<string[]>([]);
  const [slot, setSlot] = useState("06:00–07:00 AM");
  const [quantity, setQuantity] = useState(1);
  const [mode, setMode] = useState<DeliveryMode>("Vendor delivery");
const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const supportsVendorDelivery = product ? state.vendors.find((item) => item.id === product.vendorId)?.delivery === true : false;
  const supportsPickup = product ? state.vendors.find((item) => item.id === product.vendorId)?.pickup === true : false;
  useEffect(() => { if (product) queueMicrotask(() => { setQuantity(product.quantityStep); setRecurrence("Once"); setDays([]); setStartDate(initialStartDate && initialStartDate >= tomorrow() ? initialStartDate : tomorrow()); setEndDate(""); setDeliveryInstructions(""); setMode(supportsVendorDelivery ? "Vendor delivery" : supportsPickup ? "Self pickup" : "Third-party delivery"); }); }, [product, initialStartDate, supportsVendorDelivery, supportsPickup]);  if (!product) return null;
  const scheduledProduct = product;
  const vendor = state.vendors.find((v) => v.id === scheduledProduct.vendorId)!;
  const activeProductVendorSlots = (state.deliverySlots || []).filter((s) => s.vendorId === scheduledProduct.vendorId && s.isActive);
  const scheduleSlotOptions: string[] = activeProductVendorSlots.length > 0
    ? activeProductVendorSlots.map((s) => formatSlotLabel(s))
    : ["06:00–07:00 AM", "07:00–08:00 AM", "08:00–09:00 AM", "12:00–01:00 PM", "05:00–06:00 PM", "07:00–08:00 PM"];
const modes: DeliveryMode[] = ["Vendor delivery", "Self pickup", "Third-party delivery"];  const effectiveEnd = endDate || (recurrence === "Once" ? startDate : addDaysISO(startDate || tomorrow(), 29));
  const startMs = new Date(`${startDate || tomorrow()}T12:00:00`).getTime();
  const endMs = new Date(`${effectiveEnd}T12:00:00`).getTime();
  const rangeLength = Math.max(1, Math.min(366, Math.floor((endMs - startMs) / 86400000) + 1));
  const rangeDates = Array.from({ length: rangeLength }, (_, index) => addDaysISO(startDate || tomorrow(), index));
  const previewSchedule: Schedule = { id: "preview", customerEmail: session.email, productId: product.id, vendorId: product.vendorId, startDate: startDate || tomorrow(), endDate: effectiveEnd, recurrence, weekdays: days, timeSlot: slot, quantity, unit: product.baseUnit, mode, estimatedOccurrences: 0, status: "Active" };
  const deliveryDates = occurrenceDatesInRange(previewSchedule, rangeDates);
  const occurrences = deliveryDates.length;
  const perDelivery = finalPrice(scheduledProduct, state) * quantity;
  const price = perDelivery * occurrences;
  const hasNutrition = scheduledProduct.nutritionStatus !== "Pending review" && scheduledProduct.calories > 0;
  const calories = hasNutrition ? Math.round(scheduledProduct.calories * quantity * occurrences) : 0;

  async function save() {
    if (!startDate || startDate < tomorrow()) return toast.error("Choose tomorrow or a future date");
    if (endDate && endDate < startDate) return toast.error("End date must be after the start date");
    if (recurrence === "Custom" && !days.length) return toast.error("Choose at least one weekday");
    if (!occurrences) return toast.error("This schedule has no delivery dates. Adjust the dates or repeat pattern.");
    if (mode === "Third-party delivery" && !isLiveSupabaseMode()) return toast.error("Third-party delivery requires a live customer account.");
    if (mode === "Third-party delivery" && recurrence !== "Once") return toast.error("Third-party delivery is available for one-time plans only.");
    if (mode === "Third-party delivery" && !deliveryInstructions.trim()) return toast.error("Add delivery instructions for the third-party handler.");
    if (deliveryInstructions.length > 1000) return toast.error("Delivery instructions must be 1,000 characters or fewer.");
    try {
      let scheduleId = id("SCH"); let orderId = id("ORD");
      if (isLiveSupabaseMode()) {
const saved = await createLiveScheduledCheckout({ productId: scheduledProduct.id, startDate, endDate: endDate || undefined, recurrence, weekdays: days, slot, quantity, unit: scheduledProduct.baseUnit, mode, deliveryInstructions: deliveryInstructions.trim(), customerPrice: finalPrice(scheduledProduct, state), perDeliveryTotal: perDelivery, total: price, whatsappReminder: true });        scheduleId = String(saved.scheduleId); orderId = String(saved.orderId);
      }
      const schedule: Schedule = { id: scheduleId, customerEmail: session.email, productId: scheduledProduct.id, vendorId: scheduledProduct.vendorId, startDate, endDate, recurrence, weekdays: days, timeSlot: slot, quantity, unit: scheduledProduct.baseUnit, mode, estimatedOccurrences: occurrences, status: "Active", nextDeliveryAt: deliveryDates[0], whatsappReminder: true };
      const order: Order = { id: orderId, scheduleId, customerEmail: session.email, vendorId: scheduledProduct.vendorId, productId: scheduledProduct.id, description: scheduledProduct.name, quantity, unit: scheduledProduct.baseUnit, total: price, date: deliveryDates[0], slot, mode, status: "Scheduled", payment: "Pending" };
      setState((s) => ({ ...s, schedules: [schedule, ...s.schedules.filter((x) => x.id !== schedule.id)], orders: [order, ...s.orders.filter((x) => x.id !== order.id)], notifications: [notice(session.email, "customer", "Schedule ready for payment", `${scheduledProduct.name} has ${occurrences} planned deliver${occurrences === 1 ? "y" : "ies"}. Complete payment to activate it.`), ...s.notifications], audit: [audit(session, "Created product schedule", `${scheduledProduct.name} · ${recurrence} · ${occurrences} deliveries`), ...s.audit] }));
      showDeviceNotification("Schedule ready for payment", `${scheduledProduct.name} · ${occurrences} planned deliver${occurrences === 1 ? "y" : "ies"}`);
      toast.success("Schedule saved. Complete payment to activate it."); close(); onCreated?.();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Schedule could not be saved"); }
  }

return <Dialog open onOpenChange={(open) => !open && close()}><DialogContent className="max-h-[94vh] overflow-y-auto rounded-[28px] p-0 sm:max-w-5xl"><div className="bg-[#f7edf0] p-6 text-[#292124]"><DialogHeader><DialogTitle className="flex items-center gap-3 text-2xl font-bold"><span className="grid size-12 place-items-center rounded-2xl bg-[#753b50]"><CalendarDays /></span>Schedule {product.name}</DialogTitle><DialogDescription className="text-[#4c4246]">Choose the exact first delivery date, delivery period, repeat pattern, time and pack quantity.</DialogDescription></DialogHeader></div><div className="grid gap-0 lg:grid-cols-[.8fr_1.2fr]">    <div className="space-y-6 p-6 lg:order-2"><div className="grid gap-4 sm:grid-cols-2"><Field label={recurrence === "Once" ? "Delivery date" : "First delivery date"}><input aria-label={recurrence === "Once" ? "Delivery date" : "First delivery date"} type="date" min={tomorrow()} value={startDate} onChange={(e) => { const nextDate = e.target.value; setStartDate(nextDate); if (endDate && endDate < nextDate) setEndDate(nextDate); }} className={inputClass} /></Field><Field label="Ends (optional)"><input type="date" min={startDate || tomorrow()} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} /></Field></div><div><div className="mb-2 text-xs font-black uppercase tracking-widest text-stone-500">Repeat</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(["Once", "Daily", "Weekly", "Custom"] as const).map((item) => <button key={item} type="button" onClick={() => setRecurrence(item)} className={`rounded-xl border p-3 text-sm font-black ${recurrence === item ? "border-[#753b50] bg-[#f7edf0] text-[#292124]" : ""}`}>{item}</button>)}</div></div>{recurrence === "Custom" && <div><div className="mb-2 text-xs font-black uppercase tracking-widest text-stone-500">Delivery days</div><div className="flex flex-wrap gap-2">{weekdays.map((day) => <button type="button" key={day} onClick={() => setDays(days.includes(day) ? days.filter((x) => x !== day) : [...days, day])} className={`grid size-11 place-items-center rounded-full border text-xs font-black ${days.includes(day) ? "border-[#753b50] bg-[#753b50] text-white" : ""}`}>{day}</button>)}</div></div>}<Field label="Preferred time"><Select value={slot} onValueChange={setSlot}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{scheduleSlotOptions.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field><div><div className="mb-2 text-xs font-black uppercase tracking-widest text-stone-500">Number of packs per delivery</div><div className="flex flex-wrap items-center gap-3"><Button variant="outline" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="size-11 rounded-xl">−</Button><div className="min-w-40 rounded-2xl border border-stone-200/80 bg-white/90 px-4 py-3 text-center text-base font-black shadow-sm">{quantity} × {product.baseUnit}</div><Button variant="outline" onClick={() => setQuantity(quantity + 1)} className="size-11 rounded-xl">+</Button></div></div><Field label="Fulfilment"><Select value={modes.includes(mode) ? mode : modes[0]} onValueChange={(v) => { const nextMode = v as DeliveryMode; setMode(nextMode); if (nextMode === "Third-party delivery" && recurrence !== "Once") { setRecurrence("Once"); setEndDate(""); setDays([]); } }}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{modes.map((x) => <SelectItem key={x} value={x} disabled={x === "Third-party delivery" ? !isLiveSupabaseMode() || !state.thirdPartyDeliveryAvailable : x === "Vendor delivery" ? !supportsVendorDelivery : !supportsPickup}>{x}</SelectItem>)}</SelectContent></Select></Field>{mode === "Third-party delivery" && <Field label="Instructions for the delivery handler"><Textarea maxLength={1000} value={deliveryInstructions} onChange={(event) => setDeliveryInstructions(event.target.value)} placeholder="Gate code, drop-off preference, or other handover details" className="min-h-24 rounded-xl" /><span className="text-right text-xs text-stone-500">{deliveryInstructions.length}/1,000</span><p className="text-xs text-stone-500">Third-party delivery is for one-time plans. After the vendor accepts, request a secure in-app handover code from Orders.</p></Field>}{isLiveSupabaseMode() && !state.thirdPartyDeliveryAvailable && <p className="text-xs text-amber-800">Third-party delivery is unavailable until its Supabase migrations are applied.</p>}<div className="rounded-2xl bg-[#faf6f4] p-4"><div className="text-xs font-black uppercase tracking-widest text-stone-500">Delivery dates</div><div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">{deliveryDates.slice(0, 60).map((date) => <span key={date} className="rounded-full border bg-white px-2.5 py-1 text-xs font-bold">{new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>)}{deliveryDates.length > 60 && <span className="px-2 py-1 text-xs text-stone-500">+{deliveryDates.length - 60} more</span>}</div></div></div><div className="bg-[#faf6f4] p-6 lg:order-1"><div className="rounded-3xl bg-white p-5"><div className="grid size-16 place-items-center rounded-2xl" style={{ background: categoryVisual(product.category).bg }}><ProductGlyph category={product.category} iconClassName="size-8" /></div><h3 className="mt-4 text-xl font-black">{product.name}</h3><p className="text-sm text-stone-500">{vendor.businessName} · {product.baseUnit}</p><div className="mt-5 space-y-3 text-sm"><Review label="Frequency" value={recurrence} /><Review label="Confirmed delivery dates" value={String(occurrences)} />{hasNutrition ? <Review label="Calories (all planned packs)" value={`${calories.toLocaleString("en-IN")} kcal`} /> : <Review label="Nutrition" value="Pending review" />}<Review label="Per delivery" value={money(perDelivery)} /><Review label="Total to activate schedule" value={money(price)} /></div><div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">The schedule remains in checkout until payment. After payment, all confirmed delivery dates appear in My Schedule and Orders, and the vendor receives the order.</div><Button onClick={save} className="mt-5 h-12 w-full rounded-xl bg-[#753b50] font-black hover:bg-[#602d40]"><CreditCard />Continue to payment</Button></div></div></div></DialogContent></Dialog>;}
function WishlistView({ session, state, setState }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  const items = state.wishlist.filter((w) => w.customerEmail === session.email);
  function remove(productId: string) {
    setState((s) => ({ ...s, wishlist: s.wishlist.filter((w) => !(w.customerEmail === session.email && w.productId === productId)) }));
  }
  async function addToCart(product: Product) {
    const own = state.cart.filter((item) => item.customerEmail === session.email);
    const existing = own.find((item) => item.productId === product.id);
    const nextOwn = existing ? own.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item) : [{ id: id("CART"), customerEmail: session.email, productId: product.id, quantity: 1 }, ...own];
    setState((current) => ({ ...current, cart: [...current.cart.filter((item) => item.customerEmail !== session.email), ...nextOwn] }));
    try {
      if (isLiveSupabaseMode()) {
        const saved = await syncLiveCart({ items: nextOwn.map((item) => ({ productId: item.productId, quantity: item.quantity })) });
        if (saved.snapshot) setState((current) => mergeLiveCommerce(current, saved.snapshot as LiveCommerceStateSnapshot, session));
      }
      toast.success(`${product.name} added to cart`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Cart could not be saved"); }
  }
  return <div className="space-y-6"><Heading eyebrow="SAVED FOR LATER" title="Your wishlist" body="Products you've liked while browsing the marketplace, all in one place." />
    {items.length ? <div className="k-plist">{items.map((item) => {
      const product = state.products.find((x) => x.id === item.productId);
      if (!product) return null;
      const vendor = state.vendors.find((v) => v.id === product.vendorId);
      const rating = productRating(product.id, state.reviews);
      return <article key={item.productId} className="sh k-pr">
        <div className="k-pr-img" style={{ background: product.imageUrl ? undefined : categoryVisual(product.category).bg }}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} /> : <ProductGlyph category={product.category} iconClassName="size-9" />}</div>
        <div className="k-pr-body"><h3>{product.name}</h3><p className="s m">{vendor?.businessName || "Vendor"} · {product.baseUnit}</p>
          {rating && <div className="k-pr-tags"><span className="rate"><Star className="size-4" />{rating.average.toFixed(1)} ({rating.count})</span></div>}</div>
        <div className="k-pr-act"><div className="k-pr-price"><b>{money(finalPrice(product, state))}</b><span>per pack</span></div>
          <div className="k-pr-btns"><button type="button" className="btn xs" onClick={() => void addToCart(product)}><ShoppingCart className="size-4" />Add</button><button type="button" onClick={() => remove(product.id)} aria-label="Remove from wishlist" className="ibtn sm round o"><Heart className="size-5" /></button></div></div>
      </article>;
    })}</div> : <Empty icon={Heart} title="Your wishlist is empty" body="Tap the heart on any product in Marketplace to save it here for later." />}
  </div>;
}
function Schedules({ session, state }: { session: DemoSession; state: V3State }) { const items = state.schedules.filter((x) => x.customerEmail === session.email); return <div className="space-y-6"><Heading eyebrow="RECURRING PLAN" title="My product schedules" body="Each product keeps its own quantity unit, recurrence, dates and time window." />{items.length ? <div className="grid gap-4 lg:grid-cols-2">{items.map((schedule) => { const product = state.products.find((x) => x.id === schedule.productId); return <div key={schedule.id} className="surface-card rounded-[26px] p-5"><div className="flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl" style={{ background: product ? categoryVisual(product.category).bg : "#f1f6e8" }}>{product ? <ProductGlyph category={product.category} /> : <Package className="size-6 text-stone-400" />}</div><div className="flex-1"><div className="font-black">{product?.name || "Product"}</div><div className="text-xs text-stone-500">{schedule.id}</div></div><Status>{schedule.recurrence}</Status></div><div className="mt-5 grid grid-cols-2 gap-3 text-sm"><Review label="Starts" value={schedule.startDate} /><Review label="Quantity" value={`${schedule.quantity} ${schedule.unit}`} /><Review label="Time" value={schedule.timeSlot} /><Review label="Mode" value={schedule.mode} /></div></div>; })}</div> : <Empty icon={CalendarDays} title="No schedules yet" body="Open Marketplace and schedule a product from a verified vendor." />}</div>; }

function Requirements({ session, state, setState }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  const [title, setTitle] = useState("Monthly household groceries"), [deliveryDate, setDeliveryDate] = useState(tomorrow()), [items, setItems] = useState<RequirementItem[]>([{ id: id("ITM"), name: "", quantity: 1, unit: "kg", brand: "Any" }]);
  function add() { setItems((list) => [...list, { id: id("ITM"), name: "", quantity: 1, unit: "kg", brand: "Any" }]); }
  function submit() { if (!items.some((x) => x.name.trim())) return toast.error("Add at least one item"); const requirement: Requirement = { id: id("RFQ"), customerEmail: session.email, title, deliveryDate, items: items.filter((x) => x.name.trim()), status: "Quoting" }; const eligible = state.vendors.filter((v) => v.verification === "Verified" && v.operational === "Active" && v.plan === "Crown"); setState((s) => ({ ...s, requirements: [requirement, ...s.requirements], notifications: [notice(session.email, "customer", "Requirement sent", `${eligible.length} eligible premium vendor(s) can quote.`), ...eligible.map((v) => notice(v.ownerEmail, "vendor", "New quote opportunity", `${title} has ${requirement.items.length} items.`)), ...s.notifications], audit: [audit(session, "Submitted monthly requirement", `${requirement.id} · ${eligible.length} vendors eligible`), ...s.audit] })); toast.success("Monthly requirement opened for quotations"); }
  return <div className="space-y-6"><Heading eyebrow="MONTHLY REQUIREMENT" title="Request local quotations" body="Add your real household list. Eligible verified vendors on a quotation-enabled plan can submit their best price." action={<Button onClick={add} variant="outline" className="rounded-xl"><Plus />Add item</Button>} /><div className="surface-card rounded-[28px] p-5"><div className="grid gap-4 md:grid-cols-2"><Field label="Request title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} /></Field><Field label="Needed on"><input type="date" min={tomorrow()} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className={inputClass} /></Field></div><div className="mt-5 space-y-3">{items.map((item, index) => <div key={item.id} className="grid gap-2 rounded-3xl bg-[#faf6f4] p-3.5 md:grid-cols-[1.5fr_.5fr_.55fr_1fr_auto]"><input aria-label={`Item ${index + 1}`} value={item.name} onChange={(e) => setItems((list) => list.map((x) => x.id === item.id ? { ...x, name: e.target.value } : x))} placeholder="Product name" className={inputClass} /><input type="number" min=".1" step=".1" value={item.quantity} onChange={(e) => setItems((list) => list.map((x) => x.id === item.id ? { ...x, quantity: Number(e.target.value) } : x))} className={inputClass} /><Select value={item.unit} onValueChange={(value) => setItems((list) => list.map((x) => x.id === item.id ? { ...x, unit: value } : x))}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{["kg", "litre", "piece", "pack", "dozen"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select><input value={item.brand} onChange={(e) => setItems((list) => list.map((x) => x.id === item.id ? { ...x, brand: e.target.value } : x))} placeholder="Preferred brand" className={inputClass} /><Button variant="ghost" onClick={() => setItems((list) => list.filter((x) => x.id !== item.id))}><X /></Button></div>)}</div><Button onClick={submit} className="mt-5 h-12 rounded-xl bg-[#753b50] font-black hover:bg-[#602d40]"><Send />Send for local quotes</Button></div></div>;
}

function CustomerQuotes({ session, state, setState }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) { const requirements = state.requirements.filter((x) => x.customerEmail === session.email); function selectQuote(quote: Quote) { const req = state.requirements.find((x) => x.id === quote.requirementId)!; setState((s) => ({ ...s, quotes: s.quotes.map((x) => x.requirementId === quote.requirementId ? { ...x, status: x.id === quote.id ? "Selected" : "Not selected" } : x), requirements: s.requirements.map((x) => x.id === req.id ? { ...x, status: "Awarded" } : x), orders: [{ id: id("ORD"), customerEmail: session.email, vendorId: quote.vendorId, description: req.title, quantity: req.items.length, unit: "items", total: quote.total + quote.deliveryFee, date: req.deliveryDate, slot: "Vendor to confirm", mode: "Vendor delivery", status: "Scheduled", payment: "Pending" }, ...s.orders], notifications: [notice(session.email, "customer", "Quotation selected", `${money(quote.total + quote.deliveryFee)} order created.`), ...s.notifications] })); toast.success("Quotation selected and order created"); } return <div className="space-y-6"><Heading eyebrow="SEALED QUOTATIONS" title="Compare vendor offers" body="Vendor offers remain independent. Choose based on price, fulfilment and trust." />{requirements.length ? requirements.map((req) => <div key={req.id} className="surface-card rounded-[28px] p-5"><div className="flex justify-between"><div><h3 className="font-black">{req.title}</h3><p className="text-xs text-stone-500">{req.id} · {req.items.length} items · {req.deliveryDate}</p></div><Status>{req.status}</Status></div><div className="mt-4 grid gap-3 lg:grid-cols-3">{state.quotes.filter((x) => x.requirementId === req.id).map((quote) => { const vendor = state.vendors.find((x) => x.id === quote.vendorId); return <div key={quote.id} className="surface-card rounded-3xl p-4"><BadgeCheck className="text-[#653046]" /><h4 className="mt-3 font-black">{vendor?.businessName}</h4><div className="mt-2 text-lg font-black">{money(quote.total + quote.deliveryFee)}</div><p className="mt-2 text-xs text-stone-500">{quote.note || "No vendor note"}</p><Button disabled={quote.status !== "Submitted"} onClick={() => selectQuote(quote)} className="mt-4 w-full rounded-xl bg-[#753b50] hover:bg-[#292124]">Select quote</Button></div>; })}</div>{!state.quotes.some((x) => x.requirementId === req.id) && <div className="surface-card-muted mt-4 rounded-2xl p-4 text-sm text-stone-500">Waiting for eligible local vendors to quote.</div>}</div>) : <Empty icon={ClipboardCheck} title="No quotation requests" body="Create a monthly requirement first." />}</div>; }

function CustomerProfileView({ session, state, setState }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) { const profile = state.customers.find((x) => x.email === session.email)!; const [dislikes, setDislikes] = useState(profile.dislikes); return <div className="space-y-6"><Heading eyebrow="PRIVATE PROFILE" title="Location, diet & preferences" body="She Agent uses this information only within your customer context to personalize suggestions." /><div className="grid gap-5 lg:grid-cols-2"><div className="surface-card rounded-[28px] p-6"><h3 className="font-black">Household</h3><div className="mt-5 space-y-3"><Review label="Address" value={profile.address} /><Review label="Household size" value={String(profile.householdSize)} /><Review label="Diet" value={profile.diet} /><Review label="Allergies" value={profile.allergies.join(", ") || "None selected"} /><Review label="Goals" value={profile.goals.join(", ") || "None selected"} /></div></div><div className="surface-card rounded-[28px] p-6"><h3 className="font-black">Instructions for She Agent</h3><Textarea value={dislikes} onChange={(e) => setDislikes(e.target.value)} className="mt-4 min-h-32 rounded-xl" /><Button onClick={() => { setState((s) => ({ ...s, customers: s.customers.map((x) => x.email === session.email ? { ...x, dislikes } : x) })); toast.success("Preferences updated"); }} className="mt-4 rounded-xl bg-[#753b50]">Save changes</Button></div></div></div>; }

function CartView({ session, state, setState, navigate }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; navigate: (page: string) => void }) {
  const items = state.cart.filter((item) => item.customerEmail === session.email);
  const customer = state.customers.find((item) => item.email === session.email);
  const savedAddresses = customer?.addresses?.length
    ? customer.addresses
    : customer?.address ? [{ id: "default-address", label: "Home", address: customer.address, latitude: customer.latitude, longitude: customer.longitude, isDefault: true }] : [];
  const pendingOrders = state.orders.filter((item) => item.customerEmail === session.email && item.payment === "Pending" && item.status !== "Cancelled");
  const [paying, setPaying] = useState<Order | null>(null);
  const [savingCart, setSavingCart] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState(tomorrow());
  const [selectedAddressId, setSelectedAddressId] = useState(savedAddresses.find((address) => address.isDefault)?.id || savedAddresses[0]?.id || "");
  const [newAddress, setNewAddress] = useState("");
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<DeliveryMode>("Vendor delivery");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const cartVendorIds = [...new Set(items.map((it) => state.products.find((p) => p.id === it.productId)?.vendorId).filter(Boolean))];
  const activeCartVendorSlots = (state.deliverySlots || []).filter((s) => cartVendorIds.includes(s.vendorId) && s.isActive);
  const cartSlotOptions: string[] = activeCartVendorSlots.length > 0
    ? activeCartVendorSlots.map((s) => formatSlotLabel(s))
    : ["06:00–07:00 AM", "07:00–08:00 AM", "08:00–09:00 AM", "12:00–01:00 PM", "05:00–06:00 PM", "07:00–08:00 PM"];
  const [selectedSlot, setSelectedSlot] = useState(cartSlotOptions[0] || "07:00–08:00 AM");
  const total = items.reduce((sum, item) => { const product = state.products.find((x) => x.id === item.productId); return sum + (product ? finalPrice(product, state) * item.quantity : 0); }, 0);

  async function persistOwnCart(nextOwn: CartItem[], createdBy: "customer" | "she_agent" = "customer") {
    setState((current) => ({ ...current, cart: [...current.cart.filter((item) => item.customerEmail !== session.email), ...nextOwn] }));
    if (!isLiveSupabaseMode()) return;
    setSavingCart(true);
    try {
      const saved = await syncLiveCart({ items: nextOwn.map((item) => ({ productId: item.productId, quantity: item.quantity })), createdBy });
      if (saved.snapshot) setState((current) => mergeLiveCommerce(current, saved.snapshot as LiveCommerceStateSnapshot, session));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cart could not be saved");
      try { const snapshot = await loadLiveCommerceSnapshot(); setState((current) => mergeLiveCommerce(current, snapshot, session)); } catch {}
      throw error;
    } finally { setSavingCart(false); }
  }

  async function changeQuantity(item: CartItem, delta: number) {
    const nextOwn = items.map((row) => row.id === item.id ? { ...row, quantity: Math.max(1, row.quantity + delta) } : row);
    try { await persistOwnCart(nextOwn); } catch { /* toast handled above */ }
  }

  async function removeItem(item: CartItem) {
    const nextOwn = items.filter((row) => row.id !== item.id);
    try { await persistOwnCart(nextOwn); toast.success("Item removed from cart"); } catch { /* toast handled above */ }
  }

  async function confirm(deliveryAddress: string) {
    if (!items.length || savingCart) return;
    if (!deliveryDate || deliveryDate < tomorrow()) {
      toast.error("Choose a delivery date from tomorrow onward.");
      return;
    }
    const address = deliveryAddress.trim();
    if (!address) {
      toast.error("Choose a saved delivery address or enter a new one.");
      return;
    }
    if (checkoutMode === "Third-party delivery" && !isLiveSupabaseMode()) {
      toast.error("Third-party delivery requires a live customer account.");
      return;
    }
    if (checkoutMode === "Third-party delivery" && !deliveryInstructions.trim()) {
      toast.error("Add delivery instructions for the third-party handler.");
      return;
    }
    if (deliveryInstructions.length > 1000) {
      toast.error("Delivery instructions must be 1,000 characters or fewer.");
      return;
    }
    if (isLiveSupabaseMode()) {
      setSavingCart(true);
      try {
        // Sync first so carts created on another device / older build are reconciled before checkout.
        await syncLiveCart({ items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })) });
const effectiveSlot = checkoutMode === "Self pickup" ? "Store pickup" : (selectedSlot || cartSlotOptions[0]);
        if (checkoutMode !== "Self pickup" && !effectiveSlot) {
          toast.error("Please select a delivery time slot.");
          return;
        }
        const result = await checkoutLiveCart({ scheduledDate: deliveryDate, slot: effectiveSlot, deliveryAddress: address, mode: checkoutMode, deliveryInstructions: deliveryInstructions.trim() });        const snapshot = result.snapshot as LiveCommerceStateSnapshot | undefined;
        if (!snapshot) throw new Error("Checkout did not return the latest order state.");
        const next = mergeLiveCommerce(state, snapshot, session);
        setState(next);
        const ids = Array.isArray(result.orderIds) ? result.orderIds.map(String) : [];
        const createdOrders = next.orders.filter((order) => ids.includes(order.id) && order.payment === "Pending");
        if (createdOrders.length === 1) setPaying(createdOrders[0]);
        toast.success(createdOrders.length > 1 ? `${createdOrders.length} vendor checkouts are ready for payment.` : "Checkout is ready for payment.");
        setAddressDialogOpen(false);
      } catch (error) { toast.error(error instanceof Error ? error.message : "Checkout could not be created"); }
      finally { setSavingCart(false); }
      return;
    }
    const first = state.products.find((x) => x.id === items[0].productId); if (!first) return;
    const vendor = state.vendors.find((x) => x.id === first.vendorId);
const order: Order = { id: id("ORD"), customerEmail: session.email, vendorId: first.vendorId, description: items.map((item) => state.products.find((x) => x.id === item.productId)?.name).filter(Boolean).join(", "), quantity: items.reduce((sum, x) => sum + x.quantity, 0), unit: "packs", total, date: deliveryDate, slot: checkoutMode === "Self pickup" ? "Store pickup" : (selectedSlot || cartSlotOptions[0]), deliveryAddress: address, mode: checkoutMode === "Vendor delivery" && !vendor?.delivery ? "Self pickup" : checkoutMode, status: "Scheduled", payment: "Pending", cancellationFee: 0 };    setState((current) => ({ ...current, orders: [order, ...current.orders], cart: current.cart.filter((item) => item.customerEmail !== session.email), notifications: [notice(session.email, "customer", "Checkout ready", `${order.description} is ready for payment.`), ...current.notifications] }));
    setAddressDialogOpen(false);
    setPaying(order);
  }
  function continueWithAddress() {
    const chosen = useNewAddress ? newAddress.trim() : savedAddresses.find((address) => address.id === selectedAddressId)?.address || "";
    void confirm(chosen);
  }
  return <div className="space-y-6"><Heading eyebrow="CHECKOUT" title="My cart" body="Your basket is saved with your account. She Agent, Marketplace and Cart all use the same basket, including when you switch devices." />
    {pendingOrders.length > 0 && <div className="space-y-3"><h3 className="text-lg font-black">Awaiting payment</h3>{pendingOrders.map((order) => {
      const scheduledDatePassed = order.date < todayISO();
      return <div key={order.id} className="surface-card flex flex-col gap-4 rounded-3xl border-l-4 border-l-amber-400 p-5 transition hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600"><Clock3 className="size-5" /></div><div className="min-w-0 flex-1"><b>{order.description}</b><div className="mt-1 text-sm text-stone-500">{order.date} · {order.slot} · {order.mode}</div><div className="mt-2 text-xl font-black">{money(order.total)}</div>{scheduledDatePassed && <p className="mt-2 text-sm font-medium text-amber-800">Payment unavailable: the scheduled date has passed.</p>}</div><Button disabled={scheduledDatePassed} onClick={() => setPaying(order)} title={scheduledDatePassed ? "Payment is unavailable because the scheduled date has passed" : undefined} className="rounded-xl bg-[#753b50] transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600 disabled:hover:transform-none disabled:hover:shadow-none">{scheduledDatePassed ? "Scheduled date passed" : <><CreditCard />Pay & place order</>}</Button></div>;
    })}</div>}
    {items.length ? <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <section className="surface-card rounded-3xl p-5">
          {(() => { const first = state.products.find((x) => x.id === items[0]?.productId); const kitchen = state.vendors.find((v) => v.id === first?.vendorId); return <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">{kitchen?.businessName || "Your basket"}</h3><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#4c4246]">One kitchen per order</span></div>; })()}
          <div className="mt-3 divide-y divide-[#e8dfe1]">{items.map((item) => { const product = state.products.find((x) => x.id === item.productId); if (!product) return null; return <div key={item.id} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap sm:gap-4">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl" style={{ background: product.imageUrl ? undefined : categoryVisual(product.category).bg }}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" /> : <ProductGlyph category={product.category} />}</div>
            <div className="min-w-35 flex-1"><b className="text-[15px]">{product.name}</b><div className="text-xs text-[#71676b]">{product.baseUnit} · {money(finalPrice(product, state))} each</div></div>
            <div className="flex items-center gap-1 rounded-full bg-white p-1"><button type="button" aria-label={`Decrease ${product.name}`} disabled={savingCart} onClick={() => void changeQuantity(item, -1)} className="grid size-9 place-items-center rounded-full bg-[#faf6f4] text-lg font-semibold disabled:opacity-50">−</button><b className="min-w-8 text-center tabular-nums">{item.quantity}</b><button type="button" aria-label={`Increase ${product.name}`} disabled={savingCart} onClick={() => void changeQuantity(item, 1)} className="grid size-9 place-items-center rounded-full bg-[#faf6f4] text-lg font-semibold disabled:opacity-50">+</button></div>
            <b className="w-20 text-right tabular-nums">{money(finalPrice(product, state) * item.quantity)}</b>
            <button type="button" aria-label={`Remove ${product.name}`} disabled={savingCart} onClick={() => void removeItem(item)} className="grid size-9 place-items-center rounded-full hover:bg-[#fdecef] hover:text-[#b42332]"><X className="size-4" /></button>
          </div>; })}</div>
        </section>
        <section className="surface-card rounded-3xl p-5"><h3 className="text-lg font-semibold">Delivery date</h3><p className="mt-1 text-sm text-[#71676b]">Plan ahead: pick any day from tomorrow</p>
          <label className="mt-3 block max-w-sm text-sm font-semibold text-[#4c4246]">Delivery date<input aria-label="Order delivery date" type="date" min={tomorrow()} value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} className={`${inputClass} mt-2`} /></label></section>
      </div>
      <aside className="surface-card h-fit rounded-3xl p-5 lg:sticky lg:top-40"><h3 className="text-lg font-semibold">Order summary</h3>
        <div className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><span className="text-[#4c4246]">Products</span><b>{items.length}</b></div><div className="flex justify-between"><span className="text-[#4c4246]">Items</span><b>{items.reduce((sum, item) => sum + item.quantity, 0)}</b></div></div>
        <div className="my-3 h-px bg-[#e8dfe1]" /><div className="flex items-center justify-between"><b>Estimated total</b><b className="text-2xl tabular-nums">{money(total)}</b></div>
        <Button disabled={savingCart} onClick={() => setAddressDialogOpen(true)} className="mt-4 w-full"><CreditCard />{savingCart ? "Saving…" : "Continue to payment"}</Button></aside>
    </div> : pendingOrders.length === 0 ? <Empty icon={ShoppingCart} title="Your cart is empty" body="Ask She Agent to add products or add them from the marketplace. The same saved basket appears everywhere." /> : null}
    <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[28px] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Choose a delivery address</DialogTitle>
          <DialogDescription>Select a saved address or enter a new one before continuing to payment.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Delivery method">
            <Select value={checkoutMode} onValueChange={(value) => setCheckoutMode(value as DeliveryMode)}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Vendor delivery">Vendor delivery</SelectItem>
                <SelectItem value="Self pickup">Self-pickup</SelectItem>
                <SelectItem value="Third-party delivery" disabled={!isLiveSupabaseMode() || !state.thirdPartyDeliveryAvailable}>3rd Party Delivery</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {isLiveSupabaseMode() && !state.thirdPartyDeliveryAvailable && <p className="text-xs text-amber-800">Third-party delivery is unavailable until its Supabase migrations are applied.</p>}
          {checkoutMode !== "Self pickup" && (
            <Field label="Delivery time window">
              <Select value={selectedSlot || cartSlotOptions[0]} onValueChange={setSelectedSlot}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cartSlotOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {checkoutMode === "Third-party delivery" && <Field label="Instructions for the delivery handler">
            <Textarea maxLength={1000} value={deliveryInstructions} onChange={(event) => setDeliveryInstructions(event.target.value)} placeholder="Gate code, drop-off preference, or other handover details" className="min-h-24 rounded-xl" />
            <span className="text-right text-xs text-stone-500">{deliveryInstructions.length}/1,000</span>
          </Field>}
          {savedAddresses.map((address) => (
            <button type="button" key={address.id} aria-pressed={!useNewAddress && selectedAddressId === address.id} onClick={() => { setSelectedAddressId(address.id); setUseNewAddress(false); }} className={`w-full rounded-2xl border p-4 text-left transition ${!useNewAddress && selectedAddressId === address.id ? "border-[#753b50] bg-[#faf6f4]" : "border-stone-200 bg-white"}`}>
              <span className="flex items-center justify-between gap-3"><span className="font-black">{address.label}{address.isDefault ? " · Default" : ""}</span><MapPin className="size-4 shrink-0 text-[#653046]" /></span>
              <span className="mt-1 block text-sm text-stone-600">{address.address}</span>
            </button>
          ))}
          <button type="button" aria-pressed={useNewAddress} onClick={() => setUseNewAddress(true)} className={`w-full rounded-2xl border p-4 text-left font-black ${useNewAddress ? "border-[#753b50] bg-[#faf6f4]" : "border-stone-200 bg-white"}`}>
            <span className="flex items-center gap-2"><Plus className="size-4" /> Use a new address</span>
          </button>
          {useNewAddress && <Field label="New delivery address"><Textarea autoFocus value={newAddress} onChange={(event) => setNewAddress(event.target.value)} placeholder="Flat, street, landmark, area, city and PIN" className="min-h-24 rounded-xl" /></Field>}
        </div>
        <Button disabled={savingCart || (useNewAddress ? !newAddress.trim() : !savedAddresses.some((address) => address.id === selectedAddressId))} onClick={continueWithAddress} className="w-full rounded-xl bg-[#753b50]">
          <CreditCard />{savingCart ? "Saving…" : "Continue to payment"}
        </Button>
      </DialogContent>
    </Dialog>
    <PaymentDialog order={paying} close={() => setPaying(null)} state={state} setState={setState} onPaid={() => navigate(paying?.scheduleId ? "My schedule" : "Orders")} />
  </div>;
}

function SchedulesV4({ session, state, setState, navigate }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; navigate: (page: string) => void }) {
  const customerOrders = state.orders.filter((order) => order.customerEmail === session.email && order.status !== "Cancelled");
  const paidDeliveries = customerOrders.filter((order) => order.payment === "Paid").sort((a, b) => a.date.localeCompare(b.date));
  const pendingOrders = customerOrders.filter((order) => order.payment === "Pending");
  const paidScheduleIds = new Set(paidDeliveries.map((order) => order.scheduleId).filter(Boolean) as string[]);
  const storedSchedules = state.schedules.filter((schedule) => schedule.customerEmail === session.email && paidScheduleIds.has(schedule.id));
  const groupedOrders = new Map<string, Order[]>();
  for (const order of paidDeliveries) {
    if (!order.scheduleId) continue;
    const list = groupedOrders.get(order.scheduleId) || [];
    list.push(order); groupedOrders.set(order.scheduleId, list);
  }
  const syntheticSchedules: Schedule[] = [...groupedOrders.entries()].filter(([scheduleId]) => !storedSchedules.some((schedule) => schedule.id === scheduleId)).map(([scheduleId, orders]) => {
    const sorted = [...orders].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0];
    const product = first.productId ? state.products.find((item) => item.id === first.productId) : state.products.find((item) => item.vendorId === first.vendorId && first.description.toLowerCase().includes(item.name.toLowerCase()));
    const uniqueDays = [...new Set(sorted.map((order) => weekdayLabel(order.date)))];
    return { id: scheduleId, customerEmail: session.email, productId: product?.id || "", vendorId: first.vendorId, startDate: first.date, endDate: sorted.at(-1)?.date || first.date, recurrence: sorted.length === 1 ? "Once" : "Custom", weekdays: uniqueDays, timeSlot: first.slot, quantity: first.quantity, unit: first.unit, mode: first.mode, estimatedOccurrences: sorted.length, status: "Active", nextDeliveryAt: sorted.find((order) => order.date >= todayISO())?.date || first.date, whatsappReminder: true };
  });
  const items = [...storedSchedules, ...syntheticSchedules].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const firstUpcoming = paidDeliveries.find((order) => order.date >= todayISO())?.date || todayISO();
  const [selectedDate, setSelectedDate] = useState(firstUpcoming);
  const [rescheduling, setRescheduling] = useState<Schedule | null>(null);
  const calendarAnchor = new Date(`${todayISO()}T12:00:00`);
  calendarAnchor.setDate(calendarAnchor.getDate() - calendarAnchor.getDay());
  const anchorISO = localDateISO(calendarAnchor);
  const calendar = Array.from({ length: 28 }, (_, index) => addDaysISO(anchorISO, index));
  const ordersByDate = new Map<string, Order[]>();
  for (const date of calendar) ordersByDate.set(date, paidDeliveries.filter((order) => order.date === date));
  const selectedOrders = paidDeliveries.filter((order) => order.date === selectedDate);

  function change(schedule: Schedule, action: "pause" | "resume" | "cancel") {
    if (!state.schedules.some((item) => item.id === schedule.id)) return toast.info("Schedule details are syncing. You can manage the individual delivery from Orders in the meantime.");
    let patch: Partial<Schedule> = {}; let message = "";
    if (action === "pause") { patch = { status: "Paused" }; message = "Schedule paused"; }
    if (action === "resume") { patch = { status: "Active" }; message = "Schedule resumed"; }
    if (action === "cancel") { if (!confirm("Cancel this recurring schedule? Existing prepared orders may still have a cancellation charge.")) return; patch = { status: "Cancelled" }; message = "Schedule cancelled"; }
    setState((s) => ({ ...s, schedules: s.schedules.map((x) => x.id === schedule.id ? { ...x, ...patch } : x), notifications: [notice(session.email, "customer", message, `${schedule.id} was updated.`), ...s.notifications] })); toast.success(message);
  }

  return <div className="space-y-6"><Heading eyebrow="CALENDAR" title="My schedule" body="Only paid, active schedules appear here. Every confirmed delivery date is taken from your actual orders, so recurring deliveries remain visible after payment and across future days." />
    {pendingOrders.length > 0 && <button onClick={() => navigate("Cart")} className="flex w-full items-center gap-3 rounded-[22px] border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-950"><CreditCard className="size-5 shrink-0" /><span className="flex-1"><b>{pendingOrders.length} schedule{pendingOrders.length === 1 ? "" : "s"} waiting for payment.</b> Complete checkout to activate the delivery calendar.</span><ArrowRight className="size-4" /></button>}
    <div className="surface-card rounded-[28px] p-4 sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[.12em] text-[#653046]">Next 7 days</div><div className="mt-1 text-sm text-stone-500">Tap a date to see confirmed paid deliveries.</div></div>{paidDeliveries.length > 0 && <Status>{paidDeliveries.filter((order) => order.date >= todayISO()).length} upcoming</Status>}</div><div className="grid grid-cols-7 gap-1.5 sm:gap-2">{Array.from({ length: 7 }, (_, index) => addDaysISO(todayISO(), index)).map((date) => { const dayOrders = ordersByDate.get(date) || []; const d = new Date(`${date}T12:00:00`); return <button key={date} type="button" onClick={() => setSelectedDate(date)} aria-pressed={selectedDate === date} className={`sp-calendar-day relative rounded-2xl px-1 py-3 text-center transition ${selectedDate === date ? "bg-[#753b50] text-white" : "bg-white hover:bg-[#f7edf0]"}`}><span className="block text-xs font-medium">{d.toLocaleDateString("en-IN", { weekday: "short" })}</span><span className="block text-xl font-bold tabular-nums">{d.getDate()}</span>{dayOrders.length > 0 ? <span className={`mx-auto mt-1 grid size-5 place-items-center rounded-full text-[10px] font-bold ${selectedDate === date ? "bg-[#292124] text-white" : "bg-[#753b50] text-white"}`}>{dayOrders.length}</span> : <span className="mt-1 block h-5" />}</button>; })}</div>
      {selectedOrders.length > 0 ? <div className="mt-4 rounded-[22px] bg-[#faf6f4] p-4"><b>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</b><div className="mt-3 space-y-2">{selectedOrders.map((order) => <button key={order.id} onClick={() => navigate("Orders")} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left"><div className="grid size-10 place-items-center rounded-xl bg-[#f7edf0] text-[#653046]"><Package className="size-4" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-black">{order.description}</div><div className="text-xs text-stone-500">{order.slot} · {order.mode}</div></div><Status>{order.status}</Status></button>)}</div></div> : <div className="mt-4 rounded-2xl bg-stone-50 p-3 text-sm text-stone-500">No confirmed delivery on this date.</div>}
    </div>
    {items.length ? <div className="grid gap-4 lg:grid-cols-2">{items.map((schedule) => { const product = schedule.productId ? state.products.find((x) => x.id === schedule.productId) : undefined; const scheduleOrders = groupedOrders.get(schedule.id) || []; const status = schedule.status || "Active"; const upcoming = scheduleOrders.filter((order) => order.date >= todayISO()).map((order) => order.date); const persisted = state.schedules.some((item) => item.id === schedule.id); const displayName = product?.name || scheduleOrders[0]?.description || "Scheduled product"; return <div key={schedule.id} className="surface-card rounded-[26px] p-5"><div className="flex items-start gap-3"><div className="grid size-12 shrink-0 place-items-center rounded-2xl" style={{ background: product ? categoryVisual(product.category).bg : "#eff6e6" }}>{product ? <ProductGlyph category={product.category} /> : <Package className="size-6 text-stone-400" />}</div><div className="min-w-0 flex-1"><div className="font-black">{displayName}</div><div className="mt-1 text-xs text-stone-500">{schedule.recurrence}{schedule.recurrence === "Custom" && schedule.weekdays.length ? ` · ${schedule.weekdays.join(", ")}` : ""} · {schedule.timeSlot}</div></div><Status>{status}</Status></div><div className="mt-4 grid grid-cols-2 gap-2 rounded-[20px] bg-[#faf6f4] p-3 text-xs"><div><span className="text-stone-400">Paid deliveries</span><div className="mt-1 font-black">{scheduleOrders.length || schedule.estimatedOccurrences}</div></div><div><span className="text-stone-400">Next delivery</span><div className="mt-1 font-black">{upcoming[0] || schedule.nextDeliveryAt || "Completed"}</div></div></div><div className="mt-3 rounded-2xl bg-[#f7edf0] p-3 text-xs text-[#292124]"><CalendarDays className="mr-2 inline size-4" />{upcoming.length ? `Upcoming: ${upcoming.slice(0, 5).join(", ")}${upcoming.length > 5 ? ` +${upcoming.length - 5} more` : ""}` : "No future paid deliveries remain."}</div><div className="mt-2 rounded-2xl bg-[#faf6f4] p-3 text-xs text-stone-500"><MessageSquareText className="mr-2 inline size-4" />Reminder is prepared for one hour before each delivery.</div>{persisted ? <div className="mt-4 flex flex-wrap gap-2">{status === "Paused" ? <Button size="sm" onClick={() => change(schedule, "resume")} className="bg-[#753b50]"><Play />Resume</Button> : <Button size="sm" variant="outline" disabled={status === "Cancelled"} onClick={() => change(schedule, "pause")}><Pause />Pause</Button>}<Button size="sm" variant="outline" disabled={status === "Cancelled"} onClick={() => setRescheduling(schedule)}><CalendarDays />Reschedule</Button></div> : <div className="mt-4 text-xs font-bold text-stone-400">Schedule definition is syncing; the confirmed delivery dates above are already active.</div>}</div>; })}</div> : <Empty icon={CalendarDays} title="No active paid schedules" body={pendingOrders.length ? "You have a schedule waiting in Cart for payment." : "Schedule a product, complete payment, and every confirmed delivery date will appear here."} action={pendingOrders.length ? <Button onClick={() => navigate("Cart")} className="rounded-xl bg-[#753b50]"><CreditCard />Go to checkout</Button> : <Button onClick={() => navigate("Marketplace")} variant="outline" className="rounded-xl"><ShoppingBag />Explore marketplace</Button>} />}
    <RescheduleDialog schedule={rescheduling} close={() => setRescheduling(null)} session={session} setState={setState} />
  </div>;
}
function RescheduleDialog({ schedule, close, session, setState }: { schedule: Schedule | null; close: () => void; session: DemoSession; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  const [startDate, setStartDate] = useState(tomorrow());
  const [recurrence, setRecurrence] = useState<Schedule["recurrence"]>("Once");
  const [days, setDays] = useState<string[]>([]);
  const [slot, setSlot] = useState("06:00–07:00 AM");
  useEffect(() => { if (schedule) queueMicrotask(() => { setStartDate(schedule.startDate < tomorrow() ? tomorrow() : schedule.startDate); setRecurrence(schedule.recurrence); setDays(schedule.weekdays); setSlot(schedule.timeSlot); }); }, [schedule]);
  if (!schedule) return null;
  const preview = occurrenceDatesInRange({ ...schedule, startDate, recurrence, weekdays: days }, Array.from({ length: 30 }, (_, index) => addDaysISO(todayISO(), index + 1)));
  function save() {
    if (!schedule) return;
    if (!startDate || startDate < tomorrow()) return toast.error("Choose tomorrow or a later date");
    if (recurrence === "Custom" && !days.length) return toast.error("Choose at least one delivery day");
    setState((s) => ({
      ...s,
      schedules: s.schedules.map((x) => x.id === schedule.id ? { ...x, startDate, recurrence, weekdays: days, timeSlot: slot, nextDeliveryAt: startDate } : x),
      notifications: [notice(session.email, "customer", "Schedule rescheduled", `${schedule.id} now starts ${startDate}${recurrence === "Custom" ? ` on ${days.join(", ")}` : ""}.`), ...s.notifications],
      audit: [audit(session, "Rescheduled product schedule", `${schedule.id} → ${startDate} · ${recurrence}`), ...s.audit],
    }));
    toast.success("Schedule updated"); close();
  }
  return <Dialog open onOpenChange={(open) => !open && close()}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-[28px] sm:max-w-xl"><DialogHeader><DialogTitle className="text-lg font-black">Reschedule delivery</DialogTitle><DialogDescription>Pick the new date, repeat pattern and delivery days. The preview below shows every date this will actually fall on.</DialogDescription></DialogHeader>
    <div className="space-y-5">
      <Field label="New start date"><input type="date" min={tomorrow()} value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} /></Field>
      <div><div className="mb-2 text-xs font-black uppercase tracking-widest text-stone-500">Repeat</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(["Once", "Daily", "Weekly", "Custom"] as const).map((item) => <button key={item} type="button" onClick={() => setRecurrence(item)} className={`rounded-xl border p-3 text-sm font-black ${recurrence === item ? "border-[#753b50] bg-[#f7edf0] text-[#292124]" : ""}`}>{item}</button>)}</div></div>
      {recurrence === "Custom" && <div><div className="mb-2 text-xs font-black uppercase tracking-widest text-stone-500">Delivery days</div><div className="flex flex-wrap gap-2">{weekdays.map((day) => <button type="button" key={day} onClick={() => setDays(days.includes(day) ? days.filter((x) => x !== day) : [...days, day])} className={`grid size-11 place-items-center rounded-full border text-xs font-black ${days.includes(day) ? "border-[#753b50] bg-[#753b50] text-white" : ""}`}>{day}</button>)}</div></div>}
      <Field label="Preferred time"><Select value={slot} onValueChange={setSlot}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{["06:00–07:00 AM", "07:00–08:00 AM", "08:00–09:00 AM", "12:00–01:00 PM", "05:00–06:00 PM", "07:00–08:00 PM"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field>
      <div className="rounded-2xl bg-[#faf6f4] p-4 text-sm"><b>{preview.length} deliver{preview.length === 1 ? "y" : "ies"} in the next 30 days</b>{preview.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{preview.slice(0, 12).map((date) => <span key={date} className="rounded-full border border-[#753b50]/25 bg-white/90 px-2.5 py-1 text-xs font-bold text-[#653046] shadow-sm">{new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>)}{preview.length > 12 && <span className="text-xs text-stone-500">+{preview.length - 12} more</span>}</div>}{!preview.length && <p className="mt-1 text-xs text-amber-700">No dates match this combination yet — choose different days or a start date.</p>}</div>
      <Button onClick={save} className="h-12 w-full rounded-xl bg-[#753b50] font-black hover:bg-[#602d40]"><Check />Save new schedule</Button>
    </div>
  </DialogContent></Dialog>;
}

function parseRequirementText(text: string) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 100).map((line) => {
    const parts = line.split(/,|\t|\s+-\s+/).map((x) => x.trim());
    const match = (parts[1] || "1 pack").match(/([\d.]+)\s*(kg|g|litre|l|ml|piece|pack|dozen)?/i);
    return { id: id("ITM"), name: parts[0], quantity: Number(match?.[1] || 1), unit: (match?.[2] || "pack").toLowerCase().replace(/^l$/, "litre"), brand: parts[2] || "Any" } as RequirementItem;
  });
}

function RequirementsV4({ session, state, setState }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  const [title, setTitle] = useState("Monthly household groceries"), [deliveryDate, setDeliveryDate] = useState(tomorrow()), [closingDate, setClosingDate] = useState(tomorrow()), [sourceFileName, setSourceFileName] = useState(""), [items, setItems] = useState<RequirementItem[]>([{ id: id("ITM"), name: "", quantity: 1, unit: "kg", brand: "Any" }]);
  async function upload(file?: File) { if (!file) return; setSourceFileName(file.name); const text = await file.text(); const parsed = parseRequirementText(text); if (!parsed.length) return toast.error("No list rows were found. Use CSV/TXT with one product per line."); setItems(parsed); toast.success(`${parsed.length} item(s) extracted. Review before sending.`); }
  async function submit() { const valid = items.filter((x) => x.name.trim()); if (!valid.length) return toast.error("Add at least one item"); if (closingDate > deliveryDate) return toast.error("RFQ closing date must be on or before the required date"); const profile = state.customers.find((x) => x.email === session.email);
    if (isLiveSupabaseMode()) {
      // Live mode: the database saves the RFQ and invites every Crown vendor whose own service radius covers this pin.
      if (!profile || !Number.isFinite(profile.latitude) || !Number.isFinite(profile.longitude)) return toast.error("Set your delivery location first so vendors near you can be found");
      try {
        const result = await publishRequirement({ title, locality: shortArea(profile.address), latitude: profile.latitude!, longitude: profile.longitude!, deliveryDate, closingDate, items: valid.map((x) => ({ name: x.name, quantity: x.quantity, unit: x.unit, brand: x.brand })) });
        toast.success(result.invited ? `RFQ sent to ${result.invited} Crown vendor${result.invited === 1 ? "" : "s"} near you. Track replies under My quotations` : "RFQ saved. No Crown vendor covers your address yet");
        setItems([{ id: id("ITM"), name: "", quantity: 1, unit: "kg", brand: "Any" }]); setSourceFileName("");
      } catch (error) { toast.error(error instanceof Error ? error.message : "The RFQ could not be published"); }
      return;
    } const eligible = state.vendors.filter((v) => v.verification === "Verified" && v.operational === "Active" && v.plan === "Crown" && (!profile || distanceKm(profile.latitude, profile.longitude, v.latitude, v.longitude) === null || distanceKm(profile.latitude, profile.longitude, v.latitude, v.longitude)! <= v.radiusKm)); const requirement: Requirement = { id: id("RFQ"), customerEmail: session.email, title, deliveryDate, closingDate, sourceFileName, items: valid, status: "Quoting", invitedVendorIds: eligible.map((x) => x.id) }; setState((s) => ({ ...s, requirements: [requirement, ...s.requirements], notifications: [notice(session.email, "customer", "RFQ published", `${eligible.length} serviceable Crown vendor(s) were invited. Quotes close ${closingDate}.`), ...eligible.map((v) => notice(v.ownerEmail, "vendor", "New local RFQ", `${title} closes ${closingDate}.`)), ...s.notifications] })); toast.success("RFQ sent to eligible local vendors"); }
  return <div className="space-y-6"><Heading eyebrow="MONTHLY RFQ" title="Upload or build your monthly list" body="She Agent structures CSV/TXT lists, you review them, set the quote closing date, then eligible local Crown vendors are invited." /><label className="grid min-h-28 cursor-pointer place-items-center rounded-[28px] border-2 border-dashed border-[#e8cbd5] bg-[#FFF8F0] p-5 text-center"><input type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} /><Upload className="size-8 text-[#753b50]" /><b>{sourceFileName || "Upload monthly list (CSV, TXT or TSV)"}</b><span className="text-xs text-stone-500">Example: Rice, 5 kg, preferred brand</span></label><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"><div className="surface-card rounded-3xl p-5"><div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">Your list · {items.length} item{items.length === 1 ? "" : "s"}</h3><Button variant="outline" onClick={() => setItems((x) => [...x, { id: id("ITM"), name: "", quantity: 1, unit: "pack", brand: "Any" }])}><Plus />Add row</Button></div><div className="mt-4 space-y-3">{items.map((item, index) => <div key={item.id} className="grid gap-2 rounded-3xl bg-[#faf6f4] p-3.5 md:grid-cols-[1.5fr_.5fr_.55fr_1fr_auto]"><input aria-label={`Item ${index + 1}`} value={item.name} onChange={(e) => setItems((list) => list.map((x) => x.id === item.id ? { ...x, name: e.target.value } : x))} placeholder="Product name" className={inputClass} /><input type="number" min=".1" step=".1" value={item.quantity} onChange={(e) => setItems((list) => list.map((x) => x.id === item.id ? { ...x, quantity: Number(e.target.value) } : x))} className={inputClass} /><Select value={item.unit} onValueChange={(value) => setItems((list) => list.map((x) => x.id === item.id ? { ...x, unit: value } : x))}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{["kg","g","litre","ml","piece","pack","dozen"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select><input value={item.brand} onChange={(e) => setItems((list) => list.map((x) => x.id === item.id ? { ...x, brand: e.target.value } : x))} className={inputClass} /><Button variant="ghost" onClick={() => setItems((list) => list.filter((x) => x.id !== item.id))}><X /></Button></div>)}</div></div><aside className="surface-card h-fit space-y-3 rounded-3xl p-5"><h3 className="text-lg font-semibold">Send for quotes</h3><div className="grid gap-3"><Field label="Request title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} /></Field><Field label="Quotes close on"><input type="date" min={tomorrow()} value={closingDate} onChange={(e) => setClosingDate(e.target.value)} className={inputClass} /></Field><Field label="Delivery needed on"><input type="date" min={closingDate || tomorrow()} value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className={inputClass} /></Field></div><div className="rounded-2xl bg-[#FFF4CF] p-3 text-xs font-medium text-[#795900]">Only vendors on the Crown plan whose service radius covers your address are invited.</div><Button onClick={submit} className="h-12 w-full"><Send />Publish RFQ</Button></aside></div></div>;
}

function CustomerQuotesV4({ session, state, setState }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  const requirements = state.requirements.filter((x) => x.customerEmail === session.email);
  function selectQuote(quote: Quote) { const req = state.requirements.find((x) => x.id === quote.requirementId); if (!req) return; const order: Order = { id: id("ORD"), customerEmail: session.email, vendorId: quote.vendorId, description: req.title, quantity: req.items.length, unit: "items", total: quote.total + quote.deliveryFee, date: req.deliveryDate, slot: "Vendor to confirm", mode: "Vendor delivery", status: "Scheduled", payment: "Pending", cancellationFee: 0 }; const vendor = state.vendors.find((x) => x.id === quote.vendorId); setState((s) => ({ ...s, quotes: s.quotes.map((x) => x.requirementId === quote.requirementId ? { ...x, status: x.id === quote.id ? "Selected" : "Not selected" } : x), requirements: s.requirements.map((x) => x.id === req.id ? { ...x, status: "Awarded" } : x), orders: [order, ...s.orders], notifications: [notice(session.email, "customer", "Quotation selected", `${money(order.total)} order created for ${order.date}.`), ...(vendor ? [notice(vendor.ownerEmail, "vendor", "RFQ awarded", `${order.id} was awarded to your store.`)] : []), ...s.notifications] })); toast.success("Quotation selected. Review payment and delivery before fulfilment."); }
  return <div className="space-y-5"><Heading eyebrow="RFP / RFQ TRACKING" title="My quotations" body="Compare the sealed offers from invited Crown vendors and award the winner yourself." />
    {requirements.length ? requirements.map((req) => {
      const invited = req.invitedVendorIds || []; const quotes = state.quotes.filter((x) => x.requirementId === req.id);
      const best = quotes.length ? Math.min(...quotes.map((q) => q.total + q.deliveryFee)) : 0;
      return <section key={req.id} className="space-y-3">
        <div className="surface-card rounded-3xl p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-lg font-semibold">{req.title}</h3><p className="mt-0.5 text-xs text-[#71676b]">{req.id} · delivery {req.deliveryDate} · quotes close {req.closingDate || "not set"} · {req.sourceFileName || "manually entered"}</p></div>
          <div className="flex flex-wrap items-center gap-1.5">{req.items.slice(0, 6).map((item) => <span key={item.id} className="rounded-full bg-white px-3 py-1 text-xs font-semibold">{item.name} {item.quantity}{item.unit}</span>)}<span className="rounded-full bg-[#eaf5ec] px-3 py-1 text-xs font-semibold text-[#21683b]">{quotes.length} quote{quotes.length === 1 ? "" : "s"}</span><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">{req.status}</span></div></div>
          <div className="mt-3 text-xs text-[#71676b]">{invited.length} invited · {quotes.length} responded · {Math.max(0, invited.length - quotes.length)} awaiting response</div></div>
        {quotes.length ? <><h3 className="text-lg font-semibold">Compare offers</h3><div className="grid gap-3 lg:grid-cols-3">{quotes.map((quote) => { const vendor = state.vendors.find((x) => x.id === quote.vendorId); const total = quote.total + quote.deliveryFee; const isBest = total === best && quotes.length > 1; return <div key={quote.id} className={`rounded-3xl bg-white p-5 ${isBest ? "ring-2 ring-[#753b50]" : "ring-1 ring-[#e8dfe1]"}`}>
          <div className="flex items-start justify-between gap-2"><div><h4 className="text-[16px] font-semibold">{vendor?.businessName || "Verified vendor"}</h4><p className="text-xs text-[#71676b]">{vendor?.plan ? `${vendor.plan} plan` : "Verified vendor"}</p></div>{isBest && <span className="rounded-full bg-[#eaf5ec] px-3 py-1 text-xs font-semibold text-[#21683b]">Best price</span>}</div>
          {quote.note && <p className="mt-2 text-xs text-[#4c4246]">{quote.note}</p>}
          <div className="mt-3 flex items-end justify-between"><span className="text-sm text-[#71676b]">Delivery {quote.deliveryFee ? money(quote.deliveryFee) : "free"}</span><b className="text-2xl tabular-nums">{money(total)}</b></div>
          <Button disabled={quote.status !== "Submitted"} variant={isBest ? "default" : "secondary"} onClick={() => selectQuote(quote)} className="mt-4 w-full">{quote.status === "Selected" ? "Awarded" : "Choose this quote"}</Button></div>; })}</div></>
          : <div className="rounded-3xl bg-[#FFF4CF] p-4 text-sm text-[#795900]">No vendor has accepted yet. Responses remain open until {req.closingDate || "the closing date"}.</div>}
      </section>;
    }) : <Empty icon={ClipboardCheck} title="No RFQs yet" body="Upload a monthly list and publish it to serviceable local vendors." />}</div>;
}

function CustomerProfileV4({ session, state, setState }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  const profile = state.customers.find((x) => x.email === session.email) || {
    email: session.email,
    address: "",
    householdSize: 2,
    diet: "No preference",
    allergies: [],
    goals: [],
    dislikes: "",
    onboardingComplete: false,
    phone: "",
    latitude: 11.0168,
    longitude: 76.9558,
  };
  const memory = profile.agentMemory || {};

  const normalizeList = (val: unknown): string[] => {
    if (Array.isArray(val)) return val.flatMap((x) => (typeof x === "string" ? x.split(",") : [])).map((x) => x.trim()).filter(Boolean);
    if (typeof val === "string") return val.split(",").map((x) => x.trim()).filter(Boolean);
    return [];
  };

  const initialAllergies = normalizeList(profile.allergies);
  const initialGoals = normalizeList(profile.goals);

  const [phone, setPhone] = useState(profile.phone || "");
  const [address, setAddress] = useState(profile.address || "");
  const [diet, setDiet] = useState(profile.diet || "No preference");
  const [household, setHousehold] = useState(profile.householdSize || 2);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>(() =>
    initialAllergies.filter((a) => (STANDARD_ALLERGIES as readonly string[]).includes(a))
  );
  const [customAllergies, setCustomAllergies] = useState<string>(() =>
    initialAllergies.filter((a) => !(STANDARD_ALLERGIES as readonly string[]).includes(a)).join(", ")
  );
  const [selectedGoals, setSelectedGoals] = useState<string[]>(() =>
    initialGoals.filter((g) => (STANDARD_GOALS as readonly string[]).includes(g))
  );
  const [customGoals, setCustomGoals] = useState<string>(() =>
    initialGoals.filter((g) => !(STANDARD_GOALS as readonly string[]).includes(g)).join(", ")
  );
  const [instructions, setInstructions] = useState(profile.dislikes || "");
  const [coords, setCoords] = useState({ lat: profile.latitude, lng: profile.longitude });
  const [saving, setSaving] = useState(false);
  const [clearingMemory, setClearingMemory] = useState(false);

  // Synchronize component form state whenever profile updates from live sync or external state
  useEffect(() => {
    if (profile) {
      setPhone(profile.phone || "");
      setAddress(profile.address || "");
      setDiet(profile.diet || "No preference");
      setHousehold(profile.householdSize || 2);
      setInstructions(profile.dislikes || "");
      setCoords({ lat: profile.latitude, lng: profile.longitude });

      const rawAllergies = normalizeList(profile.allergies);
      setSelectedAllergies(rawAllergies.filter((a) => (STANDARD_ALLERGIES as readonly string[]).includes(a)));
      setCustomAllergies(rawAllergies.filter((a) => !(STANDARD_ALLERGIES as readonly string[]).includes(a)).join(", "));

      const rawGoals = normalizeList(profile.goals);
      setSelectedGoals(rawGoals.filter((g) => (STANDARD_GOALS as readonly string[]).includes(g)));
      setCustomGoals(rawGoals.filter((g) => !(STANDARD_GOALS as readonly string[]).includes(g)).join(", "));
    }
  }, [
    profile.email,
    profile.phone,
    profile.address,
    profile.diet,
    profile.householdSize,
    profile.dislikes,
    profile.latitude,
    profile.longitude,
    JSON.stringify(profile.allergies),
    JSON.stringify(profile.goals),
  ]);

  function toggleAllergy(item: string) {
    setSelectedAllergies((curr) => (curr.includes(item) ? curr.filter((x) => x !== item) : [...curr, item]));
  }

  function toggleGoal(item: string) {
    setSelectedGoals((curr) => (curr.includes(item) ? curr.filter((x) => x !== item) : [...curr, item]));
  }

  const tasteProfile = tasteProfileFor(state, session.email);
  const [tasteSelected, setTasteSelected] = useState<string[]>(
    TASTE_SETUP_CHOICES.filter((dimension) => (tasteProfile.weights[dimension] || 0) >= 0.5)
  );
  function toggleTaste(dimension: string) {
    setTasteSelected((list) => (list.includes(dimension) ? list.filter((x) => x !== dimension) : [...list, dimension]));
  }
  function saveTastePreferences() {
    const behavioral = Object.fromEntries(
      Object.entries(tasteProfile.weights).filter(([dimension]) => !(TASTE_SETUP_CHOICES as string[]).includes(dimension))
    );
    const next = { ...behavioral, ...weightsFromSetupChoices(tasteSelected) };
    setState((s) => upsertTasteProfile(s, session.email, next, true));
    if (session.userId) void saveLiveTasteProfile(session.userId, next, true);
    toast.success("Taste preferences saved");
  }

  function detect() {
    navigator.geolocation?.getCurrentPosition(
      async (position) => {
        const point = { lat: Number(position.coords.latitude.toFixed(6)), lng: Number(position.coords.longitude.toFixed(6)) };
        setCoords(point);
        try {
          const place = await findLocation(point);
          setAddress(place.address);
        } catch {
          setAddress(`GPS pin ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`);
        }
      },
      () => toast.error("Allow precise location in your browser"),
      { enableHighAccuracy: true, maximumAge: 0 }
    );
  }

  async function save() {
    setSaving(true);
    const parsedCustomAllergies = customAllergies.split(",").map((x) => x.trim()).filter(Boolean);
    const finalAllergies = Array.from(new Set([...selectedAllergies, ...parsedCustomAllergies]));

    const parsedCustomGoals = customGoals.split(",").map((x) => x.trim()).filter(Boolean);
    const finalGoals = Array.from(new Set([...selectedGoals, ...parsedCustomGoals]));

    const next = {
      ...profile,
      phone,
      address,
      latitude: coords.lat,
      longitude: coords.lng,
      householdSize: household,
      diet,
      allergies: finalAllergies,
      goals: finalGoals,
      dislikes: instructions,
      addresses: [
        { id: profile.addresses?.[0]?.id || id("ADR"), label: "Home", address, latitude: coords.lat, longitude: coords.lng, phone, isDefault: true },
        ...(profile.addresses || []).filter((x) => !x.isDefault),
      ],
    };

    try {
      if (session.userId && isLiveSupabaseMode() && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
        await saveLiveCustomerProfile({
          userId: session.userId,
          phone,
          address,
          latitude: coords.lat!,
          longitude: coords.lng!,
          householdSize: household,
          diet,
          allergies: finalAllergies,
          goals: finalGoals,
          instructions,
        });
      }
      setState((s) => ({ ...s, customers: s.customers.map((x) => (x.email === session.email ? next : x)) }));
      toast.success("Profile and default address saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Profile could not be saved");
    } finally {
      setSaving(false);
    }
  }

  function addAddress() {
    const value = prompt("Enter another complete delivery address");
    if (!value) return;
    setState((s) => ({
      ...s,
      customers: s.customers.map((x) =>
        x.email === session.email
          ? { ...x, addresses: [...(x.addresses || []), { id: id("ADR"), label: `Address ${(x.addresses?.length || 0) + 1}`, address: value, isDefault: false }] }
          : x
      ),
    }));
  }

  async function clearMemory() {
    if (!confirm("Clear She Agent's learned shopping preferences? Your profile, orders, addresses and explicit food settings will stay unchanged.")) return;
    setClearingMemory(true);
    try {
      if (session.userId && isLiveSupabaseMode()) await clearLiveCustomerMemory(session.userId);
      setState((current) => ({
        ...current,
        customers: current.customers.map((item) => (item.email === session.email ? { ...item, agentMemory: {} } : item)),
      }));
      toast.success("She Agent memory cleared");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Memory could not be cleared");
    } finally {
      setClearingMemory(false);
    }
  }

  const remembered = [
    ["Typical budget", memory.lastBudget ? money(memory.lastBudget) : "Not learned"],
    ["Favourite categories", memory.favoriteCategories?.join(", ") || "Not learned"],
    ["Favourite products", memory.favoriteProducts?.join(", ") || "Not learned"],
    ["Calorie preference", memory.calorieTarget ? `Up to ${memory.calorieTarget} kcal / pack` : "Not learned"],
    ["Protein preference", memory.minProtein ? `At least ${memory.minProtein} g / pack` : "Not learned"],
    ["Dietary preference", memory.preferredDietaryTags?.join(", ") || "Not learned"],
    ["Delivery preference", memory.preferredDeliveryPeriod || "Not learned"],
  ];

  return (
    <div className="space-y-6">
      <Heading
        eyebrow="YOUR PROFILE"
        title="Addresses, food preferences & She Agent memory"
        body="Your explicit profile and the shopping preferences She Agent remembers are separated. Learned shopping preferences are kept privately with your account and can be cleared here at any time."
        action={
          <Button variant="outline" onClick={addAddress}>
            <Plus />Add address
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="surface-card space-y-4 rounded-[28px] p-6">
          <Field label="Phone / WhatsApp">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="+91 ..." />
          </Field>
          <Field label="Default delivery address">
            <Textarea value={address} onChange={(e) => setAddress(e.target.value)} className="rounded-xl" />
          </Field>
          <LocationSuggestions
            query={address}
            onSelect={(place) => {
              setAddress(place.address);
              setCoords({ lat: place.latitude, lng: place.longitude });
            }}
          />
          <Button variant="outline" onClick={detect}>
            <LocateFixed />Use actual location
          </Button>
          <MapPreview
            lat={coords.lat}
            lng={coords.lng}
            radius={0}
            label="Default delivery address"
            onPinChange={(point) => {
              const next = { lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) };
              setCoords(next);
              setAddress(`Selected map location ${next.lat.toFixed(6)}, ${next.lng.toFixed(6)}`);
            }}
          />
          <div className="space-y-2">
            {(profile.addresses || []).filter((x) => !x.isDefault).map((item) => (
              <div key={item.id} className="rounded-2xl bg-[#faf6f4] p-3 text-sm">
                <b>{item.label}</b>
                <div>{item.address}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-card space-y-4 rounded-[28px] p-6">
          <Field label="Diet">
            <Select value={diet} onValueChange={setDiet}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Select diet" />
              </SelectTrigger>
              <SelectContent>
                {STANDARD_DIETS.map((x) => (
                  <SelectItem key={x} value={x}>{x}</SelectItem>
                ))}
                {!STANDARD_DIETS.includes(diet as any) && diet ? (
                  <SelectItem value={diet}>{diet}</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </Field>

          <div className="sp-field block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[.14em] text-stone-500">Allergies</span>
            <div className="flex flex-wrap gap-2 mb-2">
              {STANDARD_ALLERGIES.map((option) => {
                const selected = selectedAllergies.includes(option);
                return (
                  <button
                    type="button"
                    key={option}
                    onClick={() => toggleAllergy(option)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      selected
                        ? "border-[#753b50] bg-[#f7edf0] text-[#292124]"
                        : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                    }`}
                  >
                    {selected ? "✓ " : "+ "}{option}
                  </button>
                );
              })}
            </div>
            <input
              value={customAllergies}
              onChange={(e) => setCustomAllergies(e.target.value)}
              className={inputClass}
              placeholder="Other allergies (comma separated)"
            />
            <span className="mt-1 block text-xs text-stone-400">Standard options (tap to toggle) plus custom allergies</span>
          </div>

          <div className="sp-field block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[.14em] text-stone-500">Health goals</span>
            <div className="flex flex-wrap gap-2 mb-2">
              {STANDARD_GOALS.map((option) => {
                const selected = selectedGoals.includes(option);
                return (
                  <button
                    type="button"
                    key={option}
                    onClick={() => toggleGoal(option)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      selected
                        ? "border-[#753b50] bg-[#f7edf0] text-[#292124]"
                        : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                    }`}
                  >
                    {selected ? "✓ " : "+ "}{option}
                  </button>
                );
              })}
            </div>
            <input
              value={customGoals}
              onChange={(e) => setCustomGoals(e.target.value)}
              className={inputClass}
              placeholder="Other goals (comma separated)"
            />
            <span className="mt-1 block text-xs text-stone-400">Standard options (tap to toggle) plus custom goals</span>
          </div>

          <Field label="Household size">
            <input
              type="number"
              min="1"
              max="20"
              value={household}
              onChange={(e) => setHousehold(Number(e.target.value))}
              className={inputClass}
            />
          </Field>

          <Field label="Instructions for She Agent">
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="min-h-24 rounded-xl"
              placeholder="Example: no coriander, mild spice"
            />
          </Field>

          <Button onClick={() => void save()} disabled={saving} className="bg-[#753b50]">
            <Check />{saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </div>

      <section className="surface-card rounded-[28px] p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-[#653046]" />
              <h3 className="text-lg font-black">What She Agent remembers</h3>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              Only durable commerce preferences should be learned from natural conversations. Sensitive attributes, payment data and precise location are excluded from this memory layer.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={clearingMemory}
            onClick={() => void clearMemory()}
            className="rounded-xl text-red-600"
          >
            {clearingMemory ? <RefreshCcw className="animate-spin" /> : <X />}
            {clearingMemory ? "Clearing…" : "Clear learned memory"}
          </Button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {remembered.map(([label, value]) => (
            <div key={label} className="rounded-[20px] bg-[#faf6f4] p-4">
              <div className="text-[11px] font-black uppercase tracking-[.12em] text-stone-400">{label}</div>
              <div className="mt-2 text-sm font-black">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card rounded-[28px] p-6">
        <div className="flex items-center gap-2">
          <Flame className="size-5 text-[#b42332]" />
          <h3 className="text-lg font-black">Taste Match preferences</h3>
        </div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
          Pick what tastes like you. Marketplace products show a Taste Match % based on this, and on what you view, save and order — you can adjust it here anytime.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TASTE_SETUP_CHOICES.map((dimension) => (
            <button
              type="button"
              key={dimension}
              onClick={() => toggleTaste(dimension)}
              className={`rounded-full border px-3 py-2 text-sm font-bold ${
                tasteSelected.includes(dimension) ? "border-[#753b50] bg-[#f7edf0] text-[#292124]" : "bg-white text-stone-500"
              }`}
            >
              {TASTE_DIMENSION_LABELS[dimension]}
            </button>
          ))}
        </div>
        <Button onClick={saveTastePreferences} className="mt-4 rounded-xl bg-[#753b50] hover:bg-[#602d40]">
          <Check />Save taste preferences
        </Button>
      </section>
    </div>
  );
}

/** Re-renders once a second purely to keep a countdown string fresh — the
 * source of truth (starts_at/ends_at) always comes from the server, this
 * never derives or trusts a client-computed deadline. */
function CreateFoodDropDialog({ open, close, vendor, products, state, setState }: { open: boolean; close: () => void; vendor: Vendor; products: Product[]; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  const [productId, setProductId] = useState("");
  const [title, setTitle] = useState("");
  const [dropPrice, setDropPrice] = useState(0);
  const [quantity, setQuantity] = useState(10);
  const [busy, setBusy] = useState(false);
  const product = products.find((p) => p.id === productId);
  const originalPrice = product ? finalPrice(product, state) : 0;
  function dismiss() {
    setProductId("");
    setTitle("");
    setDropPrice(0);
    setQuantity(10);
    close();
  }

  async function submit() {
    if (!product) return toast.error("Choose a product");
    if (!title.trim()) return toast.error("Enter a title");
    if (!dropPrice || dropPrice <= 0 || dropPrice >= originalPrice) return toast.error("Drop price must be positive and below the current price");
    if (!quantity || quantity <= 0) return toast.error("Enter how many units are available");
    setBusy(true);
    try {
      const drop = await createLiveFoodDrop({ vendorId: vendor.id, productId: product.id, title: title.trim(), dropPrice, originalPrice, totalQuantity: quantity });
      setState((s) => ({ ...s, foodDrops: [drop, ...s.foodDrops] }));
      toast.success(dropDisplayStatus(drop) === "live" ? "Food Drop is live" : "Food Drop scheduled for 8:00 PM");
      dismiss();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Drop could not be created"); }
    finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={(v) => !v && dismiss()}><DialogContent className="rounded-[26px] sm:max-w-lg"><DialogHeader><DialogTitle className="text-lg font-black">New Food Drop</DialogTitle><DialogDescription>Prepare a discounted quantity of one of your products in advance. Customers can claim it only on the day you create it, from 8:00 PM to midnight IST. Stock is enforced by the database, even under simultaneous requests.</DialogDescription></DialogHeader>
    <div className="space-y-4">
      <Field label="Product"><Select value={productId} onValueChange={(value) => {
        setProductId(value);
        const selected = products.find((item) => item.id === value);
        if (selected) {
          setTitle(`${selected.name} — flash drop`);
          setDropPrice(Math.max(1, Math.round(finalPrice(selected, state) * 0.7)));
        }
      }}><SelectTrigger className="h-11 w-full rounded-xl"><SelectValue placeholder="Choose a product" /></SelectTrigger><SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Drop title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label={`Drop price${originalPrice ? ` (was ${money(originalPrice)})` : ""}`}><input type="number" min="1" value={dropPrice || ""} onChange={(e) => setDropPrice(Number(e.target.value))} className={inputClass} /></Field><Field label="Units available"><input type="number" min="1" step="1" value={quantity || ""} onChange={(e) => setQuantity(Number(e.target.value))} className={inputClass} /></Field></div>
      <p className="rounded-xl bg-[#faf6f4] p-3 text-xs font-bold text-stone-600">Scheduled — starts at 8:00 PM. A drop is claimable only tonight and stops at midnight.</p>
      <Button onClick={() => void submit()} disabled={busy || !products.length} className="h-12 w-full rounded-xl bg-[#753b50] font-black"><Zap />{busy ? "Publishing…" : "Schedule drop"}</Button>
    </div>
  </DialogContent></Dialog>;
}

function FoodDropsManager({ vendor, state, setState }: { vendor: Vendor; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  const loadedRef = useRef(false);
  const [creating, setCreating] = useState(false);
  const now = useTicker();
  const drops = state.foodDrops.filter((d) => d.vendorId === vendor.id).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const dropIds = drops.map((d) => d.id);
  const claims = state.foodDropClaims.filter((c) => dropIds.includes(c.dropId));
  const products = state.products.filter((p) => p.vendorId === vendor.id && p.active);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void loadLiveVendorFoodDrops(vendor.id).then((remote) => {
      if (!remote.length) return;
      setState((s) => ({ ...s, foodDrops: [...remote, ...s.foodDrops.filter((d) => d.vendorId !== vendor.id)] }));
      void loadLiveFoodDropClaims(remote.map((d) => d.id)).then((claimRows) => {
        if (!claimRows.length) return;
        const remoteIds = new Set(remote.map((d) => d.id));
        setState((s) => ({ ...s, foodDropClaims: [...claimRows, ...s.foodDropClaims.filter((c) => !remoteIds.has(c.dropId))] }));
      });
    });
  }, [vendor.id, setState]);

  async function cancel(drop: FoodDrop) {
    if (!confirm(`End "${drop.title}" now? Customers will no longer be able to claim it.`)) return;
    try {
      await cancelLiveFoodDrop(drop.id);
      setState((s) => ({ ...s, foodDrops: s.foodDrops.map((d) => d.id === drop.id ? { ...d, status: "cancelled" as const } : d) }));
      toast.success("Drop ended");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Drop could not be ended"); }
  }

  if (!["Thrive", "Crown"].includes(vendor.plan)) return <div className="space-y-6"><Heading eyebrow="FLASH OFFERS" title="Food Drops" body="Daily evening offers on your own products." /><Empty icon={Zap} title="Food Drops are on the Thrive and Crown plans" body={`Your store is on the ${vendor.plan} plan. Ask Operations to move you to Thrive or Crown to publish Food Drops.`} /></div>;
  return <div className="space-y-6">
    <Heading eyebrow="FLASH OFFERS" title="Food Drops" body="Surplus or special batches at a better price. Stock is enforced by the database: once claims reach your quantity, the drop stops selling." action={<Button onClick={() => setCreating(true)} disabled={!products.length}><Plus />New drop</Button>} />
    <p className="rounded-3xl bg-[#edf3fd] p-4 text-sm font-medium leading-relaxed text-[#285fba]">How it works: Food Drops run 8:00 PM – 12:00 AM IST. Each drop is available only on the evening it is created, and unclaimed units do not carry over.</p>
    {!products.length && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Add an active product in your Catalog first — a drop always discounts an existing product.</div>}
    {drops.length ? <div className="grid gap-4 lg:grid-cols-2">{drops.map((drop) => {
      const product = state.products.find((p) => p.id === drop.productId);
      const currentTime = new Date(now);
      const status = dropDisplayStatus(drop, currentTime);
      const dropClaims = claims.filter((c) => c.dropId === drop.id);
      const revenue = dropClaims.reduce((sum, c) => sum + c.totalPrice, 0);
      const claimedUnits = drop.totalQuantity - drop.remainingQuantity;
      const tone = status === "live" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "sold_out" ? "border-amber-200 bg-amber-50 text-amber-800" : status === "scheduled" ? "border-sky-200 bg-sky-50 text-sky-800" : "border-stone-200 bg-stone-50 text-stone-500";
      const statusLabel = status === "live" ? "LIVE" : status === "scheduled" ? "Scheduled — Starts at 8:00 PM" : status === "sold_out" ? "Sold out" : "Ended";
      return <div key={drop.id} className="surface-card rounded-[26px] p-5">
        <div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{drop.title}</h3><p className="mt-1 text-xs text-stone-500">{product?.name || "Product"}</p></div><Status className={tone}>{statusLabel}</Status></div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Review label="Price" value={`${money(drop.dropPrice)} (was ${money(drop.originalPrice)})`} /><Review label="Discount" value={`${discountPercent(drop)}%`} /><Review label="Claimed" value={`${claimedUnits} / ${drop.totalQuantity}`} /><Review label="Revenue" value={money(revenue)} /></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full bg-[#753b50]" style={{ width: `${claimedPercent(drop)}%` }} /></div>
        {status === "live" && <p className="mt-3 text-xs font-bold text-stone-500"><Timer className="mr-1 inline size-3.5" />Closes at midnight · {formatCountdown(foodDropSchedule(drop).endsAt.toISOString(), currentTime)}</p>}
        {(status === "live" || status === "scheduled") && <Button size="sm" variant="outline" onClick={() => void cancel(drop)} className="mt-4 rounded-xl text-red-600">End drop now</Button>}
      </div>;
    })}</div> : <Empty icon={Zap} title="No drops yet" body="Create a flash offer on one of your products to drive same-day demand." />}
    {creating && <CreateFoodDropDialog open close={() => setCreating(false)} vendor={vendor} products={products} state={state} setState={setState} />}
  </div>;
}

function VendorArea({ active, session, state, setState, shorts }: { active: string; session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; shorts: ShortsApi }) {
  const vendor = vendorFor(state, session)!;
  if (active === "People followers") return <VendorPeopleFollowers vendor={vendor} />;
  if (active === "AI insights") return <VendorAIInsights vendor={vendor} state={state} session={session} />;
  if (active === "Online shop & POS") return <StorefrontPos vendor={vendor} state={state} setState={setState} session={session} />;
  if (active === "Store & radius") return <StoreRadius vendor={vendor} state={state} setState={setState} session={session} />;
  if (active === "Verification" || active === "Profile" || active === "Vendor profile") return <VerificationView vendor={vendor} setState={setState} session={session} />;
  if (active === "Catalog") return <Catalog vendor={vendor} state={state} setState={setState} session={session} />;
  if (active === "Food Drops") return <FoodDropsManager vendor={vendor} state={state} setState={setState} />;
  if (active === "Food Shorts") return <VendorShortsManager vendor={vendor} products={state.products.filter((p) => p.vendorId === vendor.id && p.active)} shorts={shorts} />;
  if (active === "Quote opportunities") return isLiveSupabaseMode() ? <LiveVendorRfqs vendor={vendor} /> : <VendorQuotes vendor={vendor} state={state} setState={setState} session={session} />;
  if (active === "Orders") return <OrdersV4 session={session} state={state} setState={setState} scope="vendor" vendor={vendor} />;
  if (active === "Delivery team") return <DeliveryTeam vendor={vendor} state={state} setState={setState} session={session} />;
  if (active === "Settlements") return <VendorSettlements vendor={vendor} state={state} />;
  if (active === "Ticket centre") return <TicketCentre session={session} state={state} setState={setState} vendor={vendor} />;
  const products = state.products.filter((x) => x.vendorId === vendor.id), orders = state.orders.filter((x) => x.vendorId === vendor.id);
  const vendorReviews = state.reviews.filter((r) => products.some((p) => p.id === r.productId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const vendorRatingAvg = vendorReviews.length ? vendorReviews.reduce((sum, r) => sum + r.rating, 0) / vendorReviews.length : null;
  const todayStr = todayISO();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const ordersToday = orders.filter((x) => x.date === todayStr && x.status !== "Cancelled");
  const waiting = orders.filter((x) => x.status === "Scheduled");
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return { key: localDateISO(d), label: i === 6 ? "Today" : d.toLocaleDateString("en-IN", { weekday: "short" }) }; });
  const byDay = days.map((d) => ({ ...d, total: orders.filter((x) => x.date === d.key && x.status !== "Cancelled").reduce((sum, x) => sum + x.total, 0) }));
  const maxDay = Math.max(1, ...byDay.map((d) => d.total));
  const lowStock = products.filter((x) => x.active && x.stock <= 5).sort((x, y) => x.stock - y.stock).slice(0, 4);
  async function accept(order: Order) { try { if (isLiveSupabaseMode()) await updateLiveOrderStatus(order.id, "Confirmed"); setState((cur) => ({ ...cur, orders: cur.orders.map((x) => x.id === order.id ? { ...x, status: "Confirmed" } : x) })); toast.success(`${order.id} accepted`); } catch (error) { toast.error(error instanceof Error ? error.message : "The order could not be accepted"); } }
  const planNote: Record<string, string> = { Taster: "Food Drops and quotation requests need the Thrive or Crown plan.", Crave: "Food Drops need the Thrive or Crown plan. Quotation requests are on Crown.", Thrive: "Food Drops are on. Upgrade to Crown to receive customer quotation requests.", Crown: "Food Drops and customer quotation requests are both on." };
  return <div className="space-y-5">
    <Heading eyebrow="VENDOR WORKSPACE" title={`${greeting}, ${session.name.split(" ")[0]}`} body={`${vendor.businessName} · ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}`} action={<div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${vendor.openToday ? "bg-[#eaf5ec] text-[#21683b]" : "bg-[#eaf5ec] text-[#b42332]"}`}>{vendor.openToday ? "Open today" : "Closed today"}</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${vendor.verification === "Verified" ? "bg-[#eaf5ec] text-[#21683b]" : "bg-[#eaf5ec] text-[#795900]"}`}>{vendor.verification}</span></div>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Orders today" value={String(ordersToday.length)} icon={ReceiptText} note={`${orders.filter((x) => !["Completed", "Cancelled"].includes(x.status)).length} upcoming in total`} />
      <Metric label="Sales today" value={money(ordersToday.reduce((sum, x) => sum + x.total, 0))} icon={IndianRupee} />
      <Metric label="Waiting for you" value={String(waiting.length)} icon={Clock3} note={waiting.length ? "Accept new orders" : "Nothing waiting"} />
      <Metric label="Customer rating" value={vendorRatingAvg ? vendorRatingAvg.toFixed(1) : "—"} icon={Star} note={vendorReviews.length ? `${vendorReviews.length} review${vendorReviews.length === 1 ? "" : "s"}` : "No reviews yet"} />
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.4fr_.9fr]">
      <section className="surface-card rounded-3xl p-5"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Orders to accept</h3></div>
        {waiting.length ? <div className="mt-3 space-y-2">{waiting.slice(0, 5).map((order) => <div key={order.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-[18px] bg-[#faf6f4] px-4 py-3"><b className="w-24 shrink-0">{order.id}</b><span className="w-28 shrink-0 text-sm">{order.slot}</span><span className="min-w-0 flex-1 truncate text-sm">{order.quantity} × {order.description}</span><b className="num">{money(order.total)}</b><Button size="sm" onClick={() => void accept(order)}>Accept</Button></div>)}</div> : <p className="mt-4 rounded-[18px] bg-[#faf6f4] p-4 text-sm text-[#71676b]">No orders are waiting. New orders appear here the moment a customer pays.</p>}
        <p className="mt-3 text-xs text-[#71676b]">Once you accept, only Operations can change an order. Cancellations after acceptance go through Support.</p></section>
      <section className="surface-card rounded-3xl p-5"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Sales this week</h3></div>
        <div className="mt-4 flex h-44 items-end gap-2">{byDay.map((d, i) => <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${d.label}: ${money(d.total)}`}><div className="w-full rounded-xl" style={{ height: `${Math.max(8, Math.round((d.total / maxDay) * 100))}%`, background: i === 6 ? "#753b50" : "#e8cbd5" }} /><span className="text-[11px] text-[#71676b]">{d.label}</span></div>)}</div></section>
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.4fr_.9fr]">
      <div className="rounded-3xl bg-[#753b50] p-5 text-white"><div className="flex items-center gap-3"><Crown className="size-9 shrink-0" /><div><div className="text-lg font-bold">You are on the {vendor.plan} plan</div><div className="text-xs font-medium">{planNote[vendor.plan] || ""}</div></div></div></div>
      <section className="surface-card rounded-3xl p-5"><h3 className="text-lg font-semibold">Low stock</h3>{lowStock.length ? <div className="mt-3 space-y-2">{lowStock.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate">{item.name}</span><span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${item.stock <= 2 ? "bg-[#fdecef] text-[#b42332]" : "bg-[#fdecef] text-[#795900]"}`}>{item.stock} left</span></div>)}</div> : <p className="mt-3 text-sm text-[#71676b]">Every active product has healthy stock.</p>}</section>
    </div>
    {vendor.verification !== "Verified" && <div className="rounded-3xl bg-[#FFF4CF] p-4 text-sm text-[#795900]"><AlertTriangle className="mr-2 inline size-4" />Marketplace remains locked until Operations verifies the food certification.</div>}
    <div className="surface-card rounded-[28px] p-6"><div className="flex items-center justify-between"><h3 className="font-black">Customer feedback</h3>{vendorRatingAvg && <div className="flex items-center gap-1.5"><StarRow value={vendorRatingAvg} /><span className="text-xs font-black text-stone-500">{vendorRatingAvg.toFixed(1)} average</span></div>}</div>
      {vendorReviews.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{vendorReviews.slice(0, 6).map((r) => { const product = products.find((p) => p.id === r.productId); return <div key={r.id} className="rounded-2xl bg-[#faf6f4] p-4"><div className="flex items-center justify-between gap-2"><b className="truncate text-sm">{product?.name || "Product"}</b><StarRow value={r.rating} size="size-3" /></div><p className="mt-1.5 text-xs leading-5 text-stone-600">{r.comment || "No written feedback."}</p><div className="mt-2 text-[11px] font-bold text-stone-400">{r.customerName} · {r.createdAt}</div></div>; })}</div> : <Empty icon={Star} title="No reviews yet" body="Ratings appear here once customers complete an order and rate it." />}
    </div>
  </div>;
}


function VendorAIInsights({ vendor, state, session }: { vendor: Vendor; state: V3State; session: DemoSession }) {
  const products = state.products.filter((item) => item.vendorId === vendor.id);
  const orders = state.orders.filter((item) => item.vendorId === vendor.id);
  const openOrders = orders.filter((item) => !["Completed", "Cancelled"].includes(item.status));
  const lowStock = products.filter((item) => item.active && item.stock <= 5);
  const unassigned = openOrders.filter((item) => item.mode === "Vendor delivery" && !state.assignments.some((assignment) => assignment.orderId === item.id));
  const quoteOpportunities = state.requirements.filter((requirement) => requirement.status === "Quoting" && (!requirement.invitedVendorIds?.length || requirement.invitedVendorIds.includes(vendor.id)));
  const [insight, setInsight] = useState<{ summary: string; recommendedAction: string; wentWell?: string[]; needsAttention?: string[]; recovery?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  async function askAI() {
    setBusy(true);
    try {
      const token = await getAccessToken();
      const context = { vendor: { id: vendor.id, name: vendor.businessName, openToday: vendor.openToday, radiusKm: vendor.radiusKm, verification: vendor.verification }, products: products.map((item) => ({ id: item.id, name: item.name, stock: item.stock, active: item.active, price: item.vendorPrice })), orders: orders.map((item) => ({ id: item.id, date: item.date, status: item.status, mode: item.mode, total: item.total })), quoteOpportunities: quoteOpportunities.length };
      const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ task: "business_insights", role: "vendor", message: "Review my store and tell me what to prioritise today", context }) });
      const json = await response.json() as { result?: { summary?: string; recommendedAction?: string; insights?: { wentWell?: string[]; needsAttention?: string[]; recovery?: string[] } } };
      if (!json.result) return toast.error("She Agent could not analyse your store right now");
      setInsight({ summary: json.result.summary || "Store analysis ready.", recommendedAction: json.result.recommendedAction || "Review the highest-priority operational signal.", wentWell: json.result.insights?.wentWell, needsAttention: json.result.insights?.needsAttention, recovery: json.result.insights?.recovery });
    } catch { toast.error("She Agent is unavailable right now"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6"><Heading eyebrow="VENDOR AI" title="Store intelligence" body="She Agent analyses only your store workspace: your catalogue, stock, upcoming orders and delivery capacity. It cannot inspect another vendor's information or make payments, pricing or verification decisions for you." action={<Button onClick={() => void askAI()} disabled={busy} className="rounded-xl bg-[#292124]"><Sparkles />{busy ? "Analysing…" : "Ask She Agent"}</Button>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Open orders" value={String(openOrders.length)} icon={Package} /><Metric label="Low-stock items" value={String(lowStock.length)} icon={AlertTriangle} /><Metric label="Unassigned deliveries" value={String(unassigned.length)} icon={Truck} /><Metric label="RFQ opportunities" value={String(quoteOpportunities.length)} icon={ClipboardCheck} /></div>
    <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]"><section className="surface-card rounded-[28px] p-6"><h3 className="font-black">Signals from your store</h3><div className="mt-5 space-y-3"><Review label="Store status" value={vendor.openToday ? "Open" : "Closed"} /><Review label="Published products" value={String(products.filter((item) => item.active).length)} /><Review label="Products needing stock attention" value={lowStock.map((item) => item.name).slice(0, 3).join(", ") || "None"} /><Review label="Delivery queue without assignee" value={String(unassigned.length)} /></div></section>
      <section className="surface-dark rounded-[28px] p-6 text-white"><Activity className="text-[#e8cbd5]" /><h3 className="mt-4 text-xl font-black">AI daily recommendation</h3>{insight ? <><p className="mt-3 text-sm leading-6 text-white/70">{insight.summary}</p><div className="mt-4 rounded-2xl bg-white/8 p-4 text-sm font-bold text-[#e8cbd5]">{insight.recommendedAction}</div></> : <p className="mt-3 text-sm leading-6 text-white/60">Ask She Agent for a grounded daily review. It can flag stock risk, fulfilment load and quote opportunities using your own store data.</p>}</section></div>
    {insight && (insight.wentWell?.length || insight.needsAttention?.length || insight.recovery?.length) ? <div className="grid gap-4 lg:grid-cols-3"><div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5"><h4 className="font-black text-emerald-800">Going well</h4><ul className="mt-3 space-y-2 text-sm text-emerald-900">{(insight.wentWell || []).map((line, index) => <li key={index}>• {line}</li>)}</ul></div><div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5"><h4 className="font-black text-amber-900">Attention</h4><ul className="mt-3 space-y-2 text-sm text-amber-950">{(insight.needsAttention || []).map((line, index) => <li key={index}>• {line}</li>)}</ul></div><div className="rounded-3xl border border-sky-200 bg-sky-50/60 p-5"><h4 className="font-black text-sky-900">Next actions</h4><ul className="mt-3 space-y-2 text-sm text-sky-950">{(insight.recovery || []).map((line, index) => <li key={index}>• {line}</li>)}</ul></div></div> : null}
  </div>;
}

function readImage(file: File, done: (value: string) => void) { const reader = new FileReader(); reader.onload = () => done(String(reader.result || "")); reader.readAsDataURL(file); }

function StorefrontPos({ vendor, state, setState, session }: { vendor: Vendor; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; session: DemoSession }) {
  const outlets = vendor.outlets || [{ id: `${vendor.id}-main`, name: "Main outlet", address: vendor.address, latitude: vendor.latitude, longitude: vendor.longitude, radiusKm: vendor.radiusKm, openToday: vendor.openToday, certificateNumber: vendor.fssaiNumber, certificateName: vendor.certificateName, certificateExpiry: vendor.expiryDate }];
  function asset(kind: "logoUrl" | "bannerUrl", file?: File) { if (!file) return; readImage(file, (value) => { setState((s) => ({ ...s, vendors: s.vendors.map((x) => x.id === vendor.id ? { ...x, [kind]: value } : x), audit: [audit(session, `Updated storefront ${kind === "logoUrl" ? "logo" : "banner"}`, vendor.businessName), ...s.audit] })); toast.success("Storefront image updated"); }); }
  function addOutlet() { const name = prompt("Outlet / POS name"); const address = prompt("Complete outlet address"); if (!name || !address) return; const outlet: VendorOutlet = { id: id("POS"), name, address, radiusKm: vendor.radiusKm, openToday: false }; setState((s) => ({ ...s, vendors: s.vendors.map((x) => x.id === vendor.id ? { ...x, outlets: [...outlets, outlet] } : x) })); toast.success("Outlet added. Add its certification and exact location before opening."); }
  function updateOutlet(outletId: string, patch: Partial<VendorOutlet>) { setState((s) => ({ ...s, vendors: s.vendors.map((x) => x.id === vendor.id ? { ...x, outlets: outlets.map((outlet) => outlet.id === outletId ? { ...outlet, ...patch } : outlet) } : x), audit: [audit(session, "Updated outlet", `${vendor.businessName} · ${outletId}`), ...s.audit] })); }
  function editCertification(outlet: VendorOutlet) { const number = prompt("Certification / licence number", outlet.certificateNumber || "") ?? (outlet.certificateNumber || ""); const expiry = prompt("Expiry date (YYYY-MM-DD)", outlet.certificateExpiry || "") ?? (outlet.certificateExpiry || ""); updateOutlet(outlet.id, { certificateNumber: number, certificateExpiry: expiry }); toast.success("Outlet certification saved"); }
  return <div className="space-y-6"><Heading eyebrow="ONLINE SHOP" title="Brand storefront & POS locations" body="Manage the brand and each physical POS/outlet. Each outlet can keep its own certification details." action={<Button onClick={addOutlet} className="bg-[#753b50]"><Plus />Add POS / outlet</Button>} />
    <div className="surface-card overflow-hidden rounded-4xl"><div className="relative h-40 bg-linear-to-r from-[#292124] to-[#292124] sm:h-52">{vendor.bannerUrl && <img src={vendor.bannerUrl} alt="Store banner" className="h-full w-full object-cover" />}<div className="absolute inset-0 bg-linear-to-t from-black/25 via-transparent to-transparent" /><label className="absolute right-3 top-3 flex cursor-pointer items-center gap-2 rounded-full border border-white/60 bg-white/92 px-3 py-2 text-[11px] font-black text-[#292124] shadow-lg backdrop-blur"><input type="file" accept="image/*" className="hidden" onChange={(e) => asset("bannerUrl", e.target.files?.[0])} /><ImageUp className="size-4" /><span className="hidden sm:inline">Update cover</span></label></div><div className="relative p-5 pt-12 sm:p-6 sm:pt-14"><div className="absolute -top-10 left-5 size-20 sm:-top-12 sm:left-6 sm:size-24"><div className="grid h-full w-full place-items-center overflow-hidden rounded-3xl border-4 border-white bg-[#f7edf0] text-3xl font-black text-[#653046] shadow-xl">{vendor.logoUrl ? <img src={vendor.logoUrl} alt="Store logo" className="h-full w-full object-cover" /> : vendor.businessName[0]}</div><label className="absolute -bottom-2 -right-2 grid size-9 cursor-pointer place-items-center rounded-full border-2 border-white bg-[#292124] text-white shadow-lg" title="Update logo"><input type="file" accept="image/*" className="hidden" onChange={(e) => asset("logoUrl", e.target.files?.[0])} /><Pencil className="size-3.5" /></label></div><h2 className="text-lg font-black">{vendor.businessName}</h2><p className="text-sm text-stone-500">{vendor.category} · {state.products.filter((x) => x.vendorId === vendor.id && x.active).length} published products</p></div></div>
    <div className="grid gap-4 lg:grid-cols-2">{outlets.map((outlet) => <div key={outlet.id} className="surface-card rounded-[26px] p-5"><div className="flex items-start gap-3"><div className="grid size-11 place-items-center rounded-xl bg-[#f7edf0] text-[#653046]"><Building2 /></div><div className="min-w-0 flex-1"><b>{outlet.name}</b><p className="mt-1 text-sm text-stone-500">{outlet.address}</p></div><Status>{outlet.openToday ? "Open" : "Closed"}</Status></div><div className="mt-3 text-xs text-stone-500">Service radius: {outlet.radiusKm} km · {Number.isFinite(outlet.latitude) ? "Pinned" : "Needs map pin"}</div><div className="mt-4 rounded-2xl bg-[#faf6f4] p-3 text-sm"><div className="flex items-center justify-between gap-3"><div><b>Outlet certification</b><div className="mt-1 text-xs text-stone-500">{outlet.certificateNumber || "Not added"}{outlet.certificateExpiry ? ` · expires ${outlet.certificateExpiry}` : ""}</div></div><Button size="sm" variant="outline" onClick={() => editCertification(outlet)}><Pencil />Edit</Button></div><label className="mt-3 inline-flex cursor-pointer items-center text-xs font-black text-[#653046]"><input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => updateOutlet(outlet.id, { certificateName: e.target.files?.[0]?.name || outlet.certificateName })} /><Upload className="mr-1 size-3.5" />{outlet.certificateName || "Upload certificate"}</label></div></div>)}</div>
    <VendorQrCode vendorId={vendor.id} vendorName={vendor.businessName} />
  </div>;
}

function cancellationCharge(order: Order) { if (["Out for delivery", "Ready", "Ready for pickup"].includes(order.status)) return order.total; if (order.status === "Preparing") return Math.round(order.total * .25); return Math.min(25, Math.round(order.total * .05)); }


function orderStatusTone(status: Order["status"]): string {
  switch (status) {
    case "Delivered":
    case "Completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Out for delivery":
      return "border-sky-200 bg-sky-50 text-sky-700 font-bold";
    case "Confirmed":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "Preparing":
    case "Ready":
    case "Ready for pickup":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Scheduled":
      return "border-stone-200 bg-stone-50 text-stone-700";
    case "Cancelled":
    case "Cancellation requested":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "";
  }
}

type TimelineStep = {
  key: string;
  label: string;
  state: "completed" | "current" | "upcoming" | "cancelled";
  caption?: string;
};

function getOrderTimeline(order: Order): TimelineStep[] {
  const isPickup = order.mode === "Self pickup";
  const step3Label = isPickup ? "Ready for Pickup" : "Out for Delivery";
  const step4Label = isPickup ? "Picked Up" : "Delivered";

  if (order.status === "Cancelled" || order.status === "Cancellation requested") {
    return [
      { key: "placed", label: "Order Placed", state: "completed", caption: "Received" },
      { key: "confirmed", label: order.status === "Cancelled" ? "Cancelled" : "Cancellation Pending", state: "cancelled", caption: "Stopped" },
      { key: "transit", label: step3Label, state: "upcoming" },
      { key: "delivered", label: step4Label, state: "upcoming" },
    ];
  }

  if (order.status === "Delivered" || order.status === "Completed") {
    return [
      { key: "placed", label: "Order Placed", state: "completed", caption: "Confirmed" },
      { key: "confirmed", label: "Vendor Confirmed", state: "completed", caption: "Prepared" },
      { key: "transit", label: step3Label, state: "completed", caption: isPickup ? "Ready" : "Dispatched" },
      { key: "delivered", label: step4Label, state: "completed", caption: isPickup ? "Collected" : "Fulfilled" },
    ];
  }

  if (order.status === "Out for delivery") {
    return [
      { key: "placed", label: "Order Placed", state: "completed" },
      { key: "confirmed", label: "Vendor Confirmed", state: "completed" },
      { key: "transit", label: step3Label, state: "current", caption: "On the way" },
      { key: "delivered", label: step4Label, state: "upcoming" },
    ];
  }

  if (order.status === "Ready" || order.status === "Ready for pickup") {
    return [
      { key: "placed", label: "Order Placed", state: "completed" },
      { key: "confirmed", label: "Vendor Confirmed", state: "completed" },
      { key: "transit", label: step3Label, state: "current", caption: isPickup ? "Ready to pick" : "Packed & ready" },
      { key: "delivered", label: step4Label, state: "upcoming" },
    ];
  }

  if (order.status === "Preparing") {
    return [
      { key: "placed", label: "Order Placed", state: "completed" },
      { key: "confirmed", label: "Vendor Confirmed", state: "current", caption: "In kitchen" },
      { key: "transit", label: step3Label, state: "upcoming" },
      { key: "delivered", label: step4Label, state: "upcoming" },
    ];
  }

  if (order.status === "Confirmed") {
    return [
      { key: "placed", label: "Order Placed", state: "completed" },
      { key: "confirmed", label: "Vendor Confirmed", state: "completed", caption: "Slot booked" },
      { key: "transit", label: step3Label, state: "upcoming" },
      { key: "delivered", label: step4Label, state: "upcoming" },
    ];
  }

  // Default / Scheduled
  return [
    { key: "placed", label: "Order Placed", state: "completed", caption: "Recorded" },
    { key: "confirmed", label: "Vendor Confirmed", state: "current", caption: "Awaiting slot" },
    { key: "transit", label: step3Label, state: "upcoming" },
    { key: "delivered", label: step4Label, state: "upcoming" },
  ];
}

function CompactDeliveryTimeline({ timeline }: { timeline: TimelineStep[] }) {
  return (
    <div className="w-full">
      <div className="relative flex items-center justify-between">
        {timeline.map((step, idx) => {
          const isLast = idx === timeline.length - 1;
          const isCompleted = step.state === "completed";
          const isCurrent = step.state === "current";
          const isCancelled = step.state === "cancelled";
          const nextStep = timeline[idx + 1];
          const isLineActive = isCompleted && nextStep && (nextStep.state === "completed" || nextStep.state === "current");

          return (
            <Fragment key={step.key}>
              <div className="relative z-10 flex flex-col items-center text-center">
                <div
                  className={`grid size-7 sm:size-8 place-items-center rounded-full text-xs font-bold transition-all ${
                    isCancelled
                      ? "bg-rose-500 text-white ring-4 ring-rose-100"
                      : isCompleted
                      ? "bg-emerald-600 text-white ring-4 ring-emerald-50"
                      : isCurrent
                      ? "bg-[#292124] text-white ring-4 ring-stone-200 animate-pulse"
                      : "bg-stone-200 text-stone-500"
                  }`}
                >
                  {isCancelled ? (
                    <X className="size-3.5" />
                  ) : isCompleted ? (
                    <CheckCircle2 className="size-4" />
                  ) : isCurrent ? (
                    <span className="size-2 rounded-full bg-white" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-stone-400" />
                  )}
                </div>
                <div className="mt-1.5 max-w-[70px] sm:max-w-[100px]">
                  <p
                    className={`text-[11px] sm:text-xs font-bold leading-tight ${
                      isCancelled
                        ? "text-rose-600"
                        : isCurrent
                        ? "text-stone-900"
                        : isCompleted
                        ? "text-emerald-800"
                        : "text-stone-400"
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.caption && (
                    <p className="mt-0.5 text-[10px] text-stone-500 font-medium hidden sm:block">
                      {step.caption}
                    </p>
                  )}
                </div>
              </div>
              {!isLast && (
                <div className="relative mb-5 flex-1 mx-1.5 sm:mx-3 h-0.5 sm:h-1 bg-stone-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isLineActive ? "bg-emerald-500" : isCancelled ? "bg-rose-300" : "bg-transparent"
                    }`}
                  />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function OrderDetailsDialog({
  order,
  close,
  state,
  session,
}: {
  order: Order | null;
  close: () => void;
  state: V3State;
  session: DemoSession;
}) {
  if (!order) return null;
  const product = order.productId ? state.products.find((p) => p.id === order.productId) : undefined;
  const vendor = state.vendors.find((v) => v.id === order.vendorId);
  const assignment = state.assignments.find((item) => item.orderId === order.id);
  const person = state.staff.find((item) => item.id === assignment?.staffId);
  const customer = state.customers.find((c) => c.email === session.email);
  const deliveryAddress = order.deliveryAddress || customer?.address || "Address confirmed on profile";
  const displayOrderNo = order.orderNumber ? `#${order.orderNumber}` : `#${order.id.slice(0, 8)}`;

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[28px] p-0 sm:max-w-2xl">
        <div className="border-b bg-[#292124] p-6 text-white">
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2 text-lg font-black">
                <ReceiptText className="size-5 text-emerald-400" />
                Order Details
              </DialogTitle>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-stone-300 bg-white/10 px-2.5 py-1 rounded-lg">
                  {displayOrderNo}
                </span>
                <Status className={orderStatusTone(order.status)}>{order.status}</Status>
              </div>
            </div>
            <DialogDescription className="text-stone-300 text-xs mt-1">
              Placed on {order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : order.date}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 p-6">
          {/* Vendor Details */}
          <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-wider text-stone-400">Store & Kitchen</div>
                <h4 className="mt-1 font-black text-stone-900 text-base">{vendor?.businessName || "ShePlates Kitchen Partner"}</h4>
                {vendor?.address && (
                  <p className="mt-1 text-xs text-stone-600 flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0 text-stone-400" />
                    {vendor.address}
                  </p>
                )}
                {vendor?.ownerEmail && (
                  <p className="mt-1 text-xs text-stone-600 flex items-center gap-1.5">
                    <PhoneCall className="size-3.5 shrink-0 text-stone-400" />
                    {vendor.ownerEmail}
                  </p>
                )}
              </div>
              {vendor && <Status className={vendor.verification === "Verified" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>{vendor.verification}</Status>}
            </div>
          </div>

          {/* Delivery & Schedule Information */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-stone-200/80 bg-white p-4">
              <div className="text-[11px] font-black uppercase tracking-wider text-stone-400">Scheduled Fulfilment</div>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex items-center gap-2 font-bold text-stone-900">
                  <CalendarDays className="size-4 text-stone-500" />
                  {order.date}
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-stone-600">
                  <Clock3 className="size-4 text-stone-400" />
                  {order.slot}
                </div>
                <div className="mt-2 text-xs font-medium text-stone-500">
                  Mode: <span className="font-bold text-stone-800">{order.mode}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200/80 bg-white p-4">
              <div className="text-[11px] font-black uppercase tracking-wider text-stone-400">Delivery Address</div>
              <div className="mt-2 text-xs leading-5 text-stone-700 flex items-start gap-1.5">
                <MapPin className="size-4 shrink-0 text-stone-400 mt-0.5" />
                <span>{deliveryAddress}</span>
              </div>
            </div>
          </div>

          {/* Delivery Partner */}
          <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4">
            <div className="text-[11px] font-black uppercase tracking-wider text-stone-400">Delivery Partner</div>
            {person ? (
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-stone-900 text-sm">{person.name}</div>
                  <div className="text-xs text-stone-500 font-mono mt-0.5">{person.phone}</div>
                </div>
                <a
                  href={`tel:${person.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-stone-800 hover:bg-stone-50"
                >
                  <PhoneCall className="size-3.5 text-emerald-600" />
                  Call Partner
                </a>
              </div>
            ) : (
              <p className="mt-1 text-xs text-stone-500">
                {order.mode === "Self pickup"
                  ? "Self pickup chosen. Please collect from the vendor kitchen during the scheduled slot."
                  : "A delivery partner will be assigned once preparation is underway."}
              </p>
            )}
          </div>

          {/* Items breakdown */}
          <div className="rounded-2xl border border-stone-200/80 bg-white p-4">
            <div className="text-[11px] font-black uppercase tracking-wider text-stone-400">Ordered Items</div>
            <div className="mt-3 divide-y divide-stone-100">
              {order.items && order.items.length > 0 ? (
                order.items.map((it, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 text-sm">
                    <div className="font-bold text-stone-900">
                      {it.quantity} × {it.name} {it.unit ? `(${it.unit})` : ""}
                    </div>
                    {it.price != null && (
                      <div className="font-mono text-stone-700 font-semibold">{money(it.price * it.quantity)}</div>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-between py-2 text-sm">
                  <div className="font-bold text-stone-900">
                    {order.quantity} × {product?.name || order.description} {order.unit ? `(${order.unit})` : ""}
                  </div>
                  <div className="font-mono text-stone-700 font-semibold">{money(order.total)}</div>
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-stone-200 pt-3 text-base font-black text-stone-900">
              <span>Total Paid</span>
              <span>{money(order.total)}</span>
            </div>
          </div>

          {/* Payment Details */}
          <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-4">
            <div className="text-[11px] font-black uppercase tracking-wider text-stone-400">Payment Information</div>
            <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-stone-500">Status:</span>
                <span className="ml-1 font-bold text-emerald-700">{order.payment}</span>
              </div>
              <div>
                <span className="text-stone-500">Method:</span>
                <span className="ml-1 font-bold text-stone-800">{order.paymentProvider || (order.payment === "Paid" ? "Razorpay" : "Prepaid")}</span>
              </div>
              {order.paymentReference && (
                <div className="col-span-2">
                  <span className="text-stone-500">Transaction ID:</span>
                  <span className="ml-1 font-mono text-stone-700 break-all">{order.paymentReference}</span>
                </div>
              )}
            </div>
          </div>

          <Button onClick={close} className="w-full h-11 rounded-xl bg-stone-900 font-bold text-white hover:bg-stone-800">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrderTrackingDialog({
  order,
  close,
  state,
}: {
  order: Order | null;
  close: () => void;
  state: V3State;
}) {
  if (!order) return null;
  const product = order.productId ? state.products.find((p) => p.id === order.productId) : undefined;
  const vendor = state.vendors.find((v) => v.id === order.vendorId);
  const assignment = state.assignments.find((item) => item.orderId === order.id);
  const person = state.staff.find((item) => item.id === assignment?.staffId);
  const timeline = getOrderTimeline(order);
  const displayOrderNo = order.orderNumber ? `#${order.orderNumber}` : `#${order.id.slice(0, 8)}`;

  // Hero status message
  let heroTitle = "Order in Progress";
  let heroSubtitle = "Your fresh meal is being coordinated with the kitchen.";
  if (order.status === "Delivered" || order.status === "Completed") {
    heroTitle = "Delivered!";
    heroSubtitle = "Your order was successfully completed. Bon appétit!";
  } else if (order.status === "Out for delivery") {
    heroTitle = "Out for Delivery";
    heroSubtitle = person ? `${person.name} is on the way to your delivery address.` : "Your delivery partner is en route!";
  } else if (order.status === "Ready" || order.status === "Ready for pickup") {
    heroTitle = order.mode === "Self pickup" ? "Ready for Pickup" : "Food Ready for Dispatch";
    heroSubtitle = "Freshly prepared and packed by the kitchen.";
  } else if (order.status === "Preparing") {
    heroTitle = "Preparing in Kitchen";
    heroSubtitle = `${vendor?.businessName || "The kitchen"} is currently preparing your meal.`;
  } else if (order.status === "Confirmed") {
    heroTitle = "Order Confirmed";
    heroSubtitle = "The vendor has accepted your order and slot.";
  } else if (order.status === "Scheduled") {
    heroTitle = "Order Scheduled";
    heroSubtitle = `Scheduled for delivery on ${order.date} during ${order.slot}.`;
  } else if (order.status === "Cancelled" || order.status === "Cancellation requested") {
    heroTitle = order.status === "Cancelled" ? "Order Cancelled" : "Cancellation Pending";
    heroSubtitle = "This order is no longer in active fulfilment.";
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-[28px] p-0 sm:max-w-2xl">
        {/* Header */}
        <div className="border-b bg-[#292124] p-6 text-white">
          <DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DialogTitle className="flex items-center gap-2 text-lg font-black">
                <Compass className="size-5 text-emerald-400" />
                Live Order Tracking
              </DialogTitle>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-stone-300 bg-white/10 px-2.5 py-1 rounded-lg">
                  {displayOrderNo}
                </span>
                <Status className={orderStatusTone(order.status)}>{order.status}</Status>
              </div>
            </div>
            <DialogDescription className="text-stone-300 text-xs mt-1">
              Estimated delivery: {order.date} • {order.slot}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 p-6">
          {/* Hero status box */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 via-emerald-100/40 to-white p-5 border border-emerald-200/80">
            <div className="flex items-start gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-emerald-600 text-white shrink-0">
                {order.status === "Delivered" || order.status === "Completed" ? (
                  <CheckCircle2 className="size-6" />
                ) : (
                  <Package className="size-5" />
                )}
              </div>
              <div>
                <h3 className="font-black text-emerald-950 text-base">{heroTitle}</h3>
                <p className="mt-0.5 text-xs text-emerald-800 leading-relaxed font-medium">{heroSubtitle}</p>
                <div className="mt-2 text-xs font-bold text-emerald-900">
                  {order.quantity} × {product?.name || order.description}
                </div>
              </div>
            </div>
          </div>

          {/* Progress Timeline */}
          <div className="rounded-2xl border border-stone-200/80 bg-stone-50/60 p-5">
            <div className="text-xs font-black uppercase tracking-wider text-stone-400 mb-4">Delivery Progress</div>
            <CompactDeliveryTimeline timeline={timeline} />
          </div>

          {/* Delivery Partner Details (if assigned) */}
          <div className="rounded-2xl border border-stone-200/80 bg-white p-4">
            <div className="text-[11px] font-black uppercase tracking-wider text-stone-400">Fulfilment & Partner</div>
            {person ? (
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-full bg-stone-100 text-stone-700 font-black text-sm">
                    {person.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-stone-900 text-sm">{person.name}</div>
                    <div className="text-xs text-stone-500">Assigned Delivery Partner</div>
                  </div>
                </div>
                <a
                  href={`tel:${person.phone}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-bold text-stone-800 hover:bg-stone-50"
                >
                  <PhoneCall className="size-3.5 text-emerald-600" />
                  {person.phone}
                </a>
              </div>
            ) : (
              <p className="mt-2 text-xs text-stone-500">
                {order.mode === "Self pickup"
                  ? "Self pickup order. Collect your meal from the kitchen during the chosen time slot."
                  : "A delivery partner will be designated closer to dispatch time."}
              </p>
            )}
          </div>

          {/* Future GPS Map Notice */}
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4 text-center">
            <Compass className="size-6 text-stone-400 mx-auto" />
            <div className="mt-2 text-xs font-black text-stone-700">Live GPS Map Tracking</div>
            <p className="mt-1 text-xs text-stone-500 max-w-md mx-auto">
              Real-time map tracking will be active on this screen once our partner telemetry system goes live for live coordinates.
            </p>
          </div>

          <Button onClick={close} className="w-full h-11 rounded-xl bg-stone-900 font-bold text-white hover:bg-stone-800">
            Back to Orders
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CustomerOrderCard({
  order,
  state,
  session,
  onViewDetails,
  onTrackOrder,
  onReschedule,
  onRateOrder,
  onIssueThirdPartyCode,
  deliveryCodes,
  deliveryActionId,
}: {
  order: Order;
  state: V3State;
  session: DemoSession;
  onViewDetails: (order: Order) => void;
  onTrackOrder: (order: Order) => void;
  onReschedule: (order: Order) => void;
  onRateOrder: (order: Order) => void;
  onIssueThirdPartyCode: (order: Order) => void;
  deliveryCodes: Record<string, { code: string; expiresAt: string }>;
  deliveryActionId: string | null;
}) {
  const product = order.productId ? state.products.find((p) => p.id === order.productId) : undefined;
  const vendor = state.vendors.find((v) => v.id === order.vendorId);
  const thirdPartyDelivery = state.thirdPartyDeliveries.find((request) => request.orderId === order.id);
  const timeline = getOrderTimeline(order);
  const displayOrderNo = order.orderNumber ? `#${order.orderNumber}` : `#${order.id.slice(0, 8)}`;

  return (
    <div className="surface-card rounded-[28px] p-5 sm:p-6 transition-all hover:shadow-md">
      {/* Header row: Order #, Date, Status Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg">
            {displayOrderNo}
          </span>
          <span className="text-stone-300">•</span>
          <span className="text-stone-500 font-medium">
            {order.createdAt
              ? new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
              : order.date}
          </span>
          <span className="text-stone-300">•</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-0.5 text-xs font-semibold text-stone-700">
            {order.mode}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Status className={order.payment === "Paid" ? "border-emerald-200 bg-emerald-50 text-emerald-700 font-bold" : ""}>
            {order.payment}
          </Status>
          <Status className={orderStatusTone(order.status)}>
            {order.status}
          </Status>
        </div>
      </div>

      {/* Main content row: Thumbnail + Product Info + Price */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-4 min-w-0">
          <PhotoTile
            imageUrl={product?.imageUrl || product?.originalImageUrl}
            category={product?.category}
            className="size-16 sm:size-20 shrink-0 rounded-2xl shadow-sm"
            emojiSize={32}
          />
          <div className="min-w-0">
            <h4 className="font-black text-stone-900 text-base sm:text-lg truncate">
              {product?.name || order.description}
            </h4>
            <p className="text-xs sm:text-sm text-stone-500 font-medium mt-0.5">
              {order.quantity} × {product?.baseUnit || order.unit || "item"}
              {vendor ? ` • ${vendor.businessName}` : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-stone-600">
              <span className="inline-flex items-center gap-1 font-semibold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md">
                <CalendarDays className="size-3 text-stone-500" />
                {order.date}
              </span>
              <span className="inline-flex items-center gap-1 text-stone-600 bg-stone-50 px-2 py-0.5 rounded-md border border-stone-200/60">
                <Clock3 className="size-3 text-stone-400" />
                {order.slot}
              </span>
            </div>
          </div>
        </div>

        {/* Amount */}
        <div className="sm:text-right shrink-0">
          <div className="text-xs uppercase font-bold tracking-wider text-stone-400">Total</div>
          <div className="text-xl sm:text-2xl font-black text-stone-900">{money(order.total)}</div>
          {order.items && order.items.length > 1 && (
            <div className="text-[11px] text-stone-400 font-medium">+{order.items.length - 1} more item(s)</div>
          )}
        </div>
      </div>

      {/* Compact Delivery Timeline */}
      <div className="rounded-2xl bg-stone-50/80 p-4 border border-stone-100">
        <CompactDeliveryTimeline timeline={timeline} />
      </div>

      {/* Third party delivery handling if requested */}
      {order.mode === "Third-party delivery" && thirdPartyDelivery && (
        <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="text-sm text-violet-950">3rd Party Delivery Request</b>
            <Status>{thirdPartyDelivery.status}</Status>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-violet-950">{thirdPartyDelivery.notes}</p>
          {thirdPartyDelivery.status === "pending" && (
            <p className="mt-3 text-xs text-violet-900">The vendor must accept this request before you can issue the handover code.</p>
          )}
          {thirdPartyDelivery.status === "accepted" && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-violet-900">Issue a secure, one-time code for handover. The code expires after 30 minutes.</p>
              {deliveryCodes[order.id] && (
                <div className="rounded-xl border border-violet-200 bg-white p-3 text-center">
                  <div className="font-mono text-2xl font-black tracking-[0.3em] text-violet-950">{deliveryCodes[order.id].code}</div>
                  <div className="mt-1 text-xs text-violet-800">Expires {new Date(deliveryCodes[order.id].expiresAt).toLocaleTimeString()}</div>
                </div>
              )}
              <Button
                disabled={deliveryActionId === order.id}
                size="sm"
                onClick={() => onIssueThirdPartyCode(order)}
                variant="outline"
                className="rounded-xl border-violet-300"
              >
                {deliveryActionId === order.id ? "Issuing…" : deliveryCodes[order.id] ? "Issue replacement code" : "Show handover code"}
              </Button>
            </div>
          )}
          {thirdPartyDelivery.status === "delivered" && (
            <p className="mt-3 text-sm font-bold text-emerald-800">Handover verified. This order has been delivered.</p>
          )}
          {thirdPartyDelivery.status === "locked" && (
            <p className="mt-3 text-sm font-bold text-red-700">Code verification is locked after five incorrect attempts.</p>
          )}
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-100 mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewDetails(order)}
            className="rounded-xl border-stone-300 font-bold hover:bg-stone-50 text-stone-700"
          >
            <ReceiptText className="size-4" />
            View Details
          </Button>
          <Button
            size="sm"
            onClick={() => onTrackOrder(order)}
            className="rounded-xl bg-[#292124] text-white hover:bg-stone-800 font-bold"
          >
            <Compass className="size-4" />
            Track Order
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={["Completed", "Delivered", "Cancelled", "Cancellation requested", "Preparing", "Out for delivery"].includes(order.status)}
            onClick={() => onReschedule(order)}
            className="rounded-xl"
          >
            <CalendarDays className="size-4" />
            Reschedule
          </Button>
          {["Completed", "Delivered"].includes(order.status) && product && (
            <Button
              size="sm"
              onClick={() => onRateOrder(order)}
              className="rounded-xl bg-[#e3a008] text-white hover:bg-[#c98a00] font-bold"
            >
              <Star className="size-4" />
              {state.reviews.some((review) => review.productId === product.id && review.customerEmail === session.email) ? "Edit rating" : "Rate"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function OrdersV4({ session, state, setState, scope, vendor }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; scope: "customer" | "vendor" | "operations"; vendor?: Vendor }) {
  const baseOrders = scope === "customer"
    ? state.orders.filter((x) => x.customerEmail === session.email && x.payment !== "Pending")
    : scope === "vendor"
      ? state.orders.filter((x) => x.vendorId === vendor?.id && x.payment === "Paid")
      : state.orders;
  const [rescheduling, setRescheduling] = useState<Order | null>(null);
  const [paying, setPaying] = useState<Order | null>(null);
  const [ratingOrder, setRatingOrder] = useState<Order | null>(null);
  const [detailsOrder, setDetailsOrder] = useState<Order | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const [deliveryCodes, setDeliveryCodes] = useState<Record<string, { code: string; expiresAt: string }>>({});
  const [verificationInputs, setVerificationInputs] = useState<Record<string, string>>({});
  const [deliveryActionId, setDeliveryActionId] = useState<string | null>(null);
  const [dateMode, setDateMode] = useState<"today" | "tomorrow" | "all" | "custom">(scope === "customer" ? "all" : "today");
  const [customDate, setCustomDate] = useState(todayISO());
  const targetDate = dateMode === "today" ? todayISO() : dateMode === "tomorrow" ? tomorrow() : dateMode === "custom" ? customDate : "";
  const [stage, setStage] = useState<"All" | "To accept" | "Preparing" | "Ready" | "Out for delivery" | "Unassigned" | "Completed">("All");
  const stageOf = (order: Order) => order.status === "Scheduled" ? "To accept" : order.status === "Confirmed" || order.status === "Preparing" ? "Preparing" : order.status === "Ready" || order.status === "Ready for pickup" ? "Ready" : order.status === "Out for delivery" ? "Out for delivery" : order.status === "Completed" ? "Completed" : "";
  const dated = targetDate ? baseOrders.filter((item) => item.date === targetDate) : baseOrders;
  const unassigned = (order: Order) => order.mode === "Vendor delivery" && !["Completed", "Cancelled"].includes(order.status) && !state.assignments.some((a) => a.orderId === order.id);
  const orders = (scope === "vendor" || scope === "operations") && stage !== "All" ? dated.filter((item) => stage === "Unassigned" ? unassigned(item) : stageOf(item) === stage) : dated;
  const dayValue = orders.reduce((sum, item) => sum + item.total, 0);
  const totalValue = baseOrders.reduce((sum, item) => sum + item.total, 0);

  const DELIVERY_STATUSES: Order["status"][] = ["Preparing", "Ready", "Out for delivery", "Ready for pickup", "Completed", "Delivered"];
  async function update(order: Order, status: Order["status"]) { try { if (DELIVERY_STATUSES.includes(status) && order.date > todayISO()) { toast.error(`This order is scheduled for ${order.date}. Delivery actions are only allowed on or after the delivery date.`); return; } if (isLiveSupabaseMode()) await updateLiveOrderStatus(order.id, status); setState((s) => ({ ...s, orders: s.orders.map((x) => x.id === order.id ? { ...x, status } : x) })); showDeviceNotification(`Order ${status}`, order.description); toast.success("Order status updated"); } catch (error) { toast.error(error instanceof Error ? error.message : "Order status could not be saved"); } }
  async function acceptThirdPartyRequest(order: Order) {
    setDeliveryActionId(order.id);
    try {
      await acceptLiveThirdPartyDelivery(order.id);
      setState((current) => ({
        ...current,
        thirdPartyDeliveries: current.thirdPartyDeliveries.map((request) => request.orderId === order.id
          ? { ...request, status: "accepted", acceptedAt: new Date().toISOString() }
          : request),
      }));
      toast.success("Request accepted. The customer can now issue a secure handover code.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The delivery request could not be accepted");
    } finally { setDeliveryActionId(null); }
  }
  async function issueThirdPartyCode(order: Order) {
    setDeliveryActionId(order.id);
    try {
      const issued = await issueLiveThirdPartyDeliveryCode(order.id);
      setDeliveryCodes((current) => ({ ...current, [order.id]: issued }));
      setState((current) => ({
        ...current,
        thirdPartyDeliveries: current.thirdPartyDeliveries.map((request) => request.orderId === order.id
          ? { ...request, codeExpiresAt: issued.expiresAt, codeIssuedCount: request.codeIssuedCount + 1 }
          : request),
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "A handover code could not be issued");
    } finally { setDeliveryActionId(null); }
  }
  async function verifyThirdPartyCode(order: Order) { if (order.date > todayISO()) { toast.error(`This order is scheduled for ${order.date}. Handover verification is only allowed on or after the delivery date.`); return; }
    const code = verificationInputs[order.id] || "";
    setDeliveryActionId(order.id);
    try {
      await verifyLiveThirdPartyDeliveryCode(order.id, code);
      setVerificationInputs((current) => ({ ...current, [order.id]: "" }));
      setDeliveryCodes((current) => { const next = { ...current }; delete next[order.id]; return next; });
      setState((current) => ({
        ...current,
        orders: current.orders.map((item) => item.id === order.id ? { ...item, status: "Delivered" } : item),
        thirdPartyDeliveries: current.thirdPartyDeliveries.map((request) => request.orderId === order.id
          ? { ...request, status: "delivered", deliveredAt: new Date().toISOString(), codeExpiresAt: undefined }
          : request),
      }));
      toast.success("Handover verified. Order marked delivered.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The handover code could not be verified");
    } finally { setDeliveryActionId(null); }
  }
  async function refreshCommerce() {
    try {
      const snapshot = await loadLiveCommerceSnapshot();
      setState((current) => mergeLiveCommerce(current, snapshot, session));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Orders could not be refreshed");
    }
  }
  function cancel(order: Order) { const fee = cancellationCharge(order); if (!confirm(`Cancellation charge: ${money(fee)} based on the current fulfilment stage. Send to Operations for final review?`)) return; const reason = prompt("Cancellation reason"); if (!reason) return; setState((s) => ({ ...s, orders: s.orders.map((x) => x.id === order.id ? { ...x, status: "Cancellation requested", cancellationFee: fee } : x), cancellations: [{ id: id("CAN"), orderId: order.id, customerEmail: session.email, reason, aiDecision: `Review with estimated charge ${money(fee)}`, confidence: 91, status: "Awaiting operations" }, ...s.cancellations], notifications: [notice("operations@sheplates.demo", "operations", "Cancellation review", `${order.id}: proposed charge ${money(fee)}.`), ...s.notifications] })); }
  function locate(order: Order) { navigator.geolocation?.getCurrentPosition((position) => { setState((s) => ({ ...s, orders: s.orders.map((x) => x.id === order.id ? { ...x, trackingLatitude: position.coords.latitude, trackingLongitude: position.coords.longitude } : x), notifications: [notice(order.customerEmail, "customer", "Live location updated", `${order.id} location was refreshed by the vendor.`), ...s.notifications] })); toast.success("Live delivery position updated"); }, () => toast.error("Allow location access on the delivery device"), { enableHighAccuracy: true, maximumAge: 0 }); }
  async function assign(order: Order, staffId: string) { try { if (isLiveSupabaseMode()) await assignLiveDeliveryStaff(order.id, staffId === "unassigned" ? undefined : staffId); const nextAssignments = staffId === "unassigned" ? state.assignments.filter((x) => x.orderId !== order.id) : [{ id: id("ASN"), orderId: order.id, staffId, assignedAt: now() }, ...state.assignments.filter((x) => x.orderId !== order.id)]; setState((s) => ({ ...s, assignments: nextAssignments, notifications: staffId === "unassigned" ? s.notifications : [notice(order.customerEmail, "customer", "Delivery person assigned", `${state.staff.find((x) => x.id === staffId)?.name || "Your delivery person"} will handle ${order.id}.`), ...s.notifications] })); toast.success(staffId === "unassigned" ? "Delivery assignment cleared" : "Delivery person assigned"); } catch (error) { toast.error(error instanceof Error ? error.message : "Delivery assignment could not be saved"); } }

  const customerSchedules = scope === "customer" ? state.schedules.filter((item) => item.customerEmail === session.email && (item.status || "Active") === "Active").length : 0;
  const customerOpenRequirements = scope === "customer" ? state.requirements.filter((item) => item.customerEmail === session.email && item.status !== "Awarded").length : 0;

return <div className="space-y-6"><Heading eyebrow="ORDER JOURNEY" title={scope === "customer" ? "Orders & live tracking" : scope === "vendor" ? "Fulfilment & tracking" : "Platform order control"} body={scope === "vendor" ? "Paid orders remain visible for every future delivery date. Use Today, Tomorrow or a date filter to plan fulfilment and assign an active delivery person." : "Track paid orders, fulfilment status and delivery progress."} action={isLiveSupabaseMode() && scope !== "operations" ? <Button onClick={() => void refreshCommerce()} variant="outline" className="rounded-xl"><RefreshCcw />Refresh orders</Button> : undefined} />    {scope === "customer" ? <div className="sp-mobile-metric-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Paid orders" value={String(baseOrders.length)} icon={Package} tone="green" /><Metric label="Active schedules" value={String(customerSchedules)} icon={CalendarDays} tone="blue" /><Metric label="Open requirements" value={String(customerOpenRequirements)} icon={ListChecks} tone="violet" /><Metric label="Order value" value={money(totalValue)} icon={CreditCard} tone="amber" /></div> : <><div className="sp-mobile-metric-grid grid gap-3 sm:grid-cols-3"><Metric label="Orders in view" value={String(orders.length)} icon={Package} tone="green" /><Metric label="Value in view" value={money(dayValue)} icon={IndianRupee} tone="amber" /><Metric label="All future order value" value={money(totalValue)} icon={CalendarDays} tone="blue" /></div><div className="surface-card flex flex-wrap items-center gap-2 rounded-3xl p-3">{([['today','Today'],['tomorrow','Tomorrow'],['all','All dates'],['custom','Choose date']] as const).map(([value,label]) => <button key={value} onClick={() => setDateMode(value)} className={`rounded-xl px-4 py-2 text-sm font-black ${dateMode === value ? "bg-[#292124] text-white" : "bg-stone-50 text-stone-600"}`}>{label}</button>)}{dateMode === "custom" && <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className={`${inputClass} max-w-48`} />}</div></>}
    {(scope === "vendor" || scope === "operations") && <div className="flex flex-wrap gap-2" role="tablist" aria-label="Order stage">{((scope === "vendor" ? ["All", "To accept", "Preparing", "Ready", "Out for delivery", "Completed"] : ["All", "Preparing", "Out for delivery", "Unassigned", "Completed"]) as ("All" | "To accept" | "Preparing" | "Ready" | "Out for delivery" | "Unassigned" | "Completed")[]).map((name) => { const count = name === "All" ? dated.length : name === "Unassigned" ? dated.filter(unassigned).length : dated.filter((item) => stageOf(item) === name).length; return <button key={name} type="button" role="tab" aria-selected={stage === name} onClick={() => setStage(name)} className={`h-10 rounded-full px-4 text-sm font-semibold ${stage === name ? "bg-[#753b50] text-white" : "bg-white text-[#4c4246]"}`}>{name}{name !== "All" || count ? ` · ${count}` : ""}</button>; })}</div>}
    {scope === "customer" && (() => {
      const live = orders.find((o) => o.status === "Out for delivery");
      if (!live) return null;
      const assignment = state.assignments.find((a) => a.orderId === live.id); const partner = state.staff.find((m) => m.id === assignment?.staffId);
      const kitchen = state.vendors.find((v) => v.id === live.vendorId);
      return <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]"><div className="flex items-center justify-between gap-4 rounded-[28px] bg-[#292124] px-6 py-5 text-white"><div><div className="text-xs text-white/80">Almost there! · {live.slot} slot</div><div className="text-[32px] font-bold leading-tight text-[#e8cbd5]">Arriving by {(live.slot.split(/[–-]| to /).pop() || live.slot).trim()}</div></div><span className="grid size-14 shrink-0 place-items-center rounded-full bg-[#753b50] text-white"><Truck className="size-7" /></span></div>
        <div className="flex items-center gap-3 rounded-[28px] bg-[#faf6f4] p-4"><span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#753b50] text-lg font-bold">{(partner?.name || kitchen?.businessName || "D").slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><div className="truncate font-semibold">{partner ? `${partner.name} · Delivery partner` : "Delivery partner not assigned yet"}</div><div className="truncate text-xs text-[#71676b]">{kitchen?.businessName || "Your kitchen"} team</div></div>{partner?.phone && <a href={`tel:${partner.phone}`} aria-label={`Call ${partner.name}`} className="grid size-11 shrink-0 place-items-center rounded-full bg-[#753b50] text-white"><PhoneCall className="size-5" /></a>}</div></div>;
    })()}
    {orders.length ? <div className="space-y-4">
      {orders.sort((a, b) => a.date.localeCompare(b.date)).map((order) => {
        if (scope === "customer") {
          return (
            <CustomerOrderCard
              key={order.id}
              order={order}
              state={state}
              session={session}
              onViewDetails={(ord) => setDetailsOrder(ord)}
              onTrackOrder={(ord) => setTrackingOrder(ord)}
              onReschedule={(ord) => setRescheduling(ord)}
              onRateOrder={(ord) => setRatingOrder(ord)}
              onIssueThirdPartyCode={(ord) => void issueThirdPartyCode(ord)}
              deliveryCodes={deliveryCodes}
              deliveryActionId={deliveryActionId}
            />
          );
        }
        const assignment = state.assignments.find((item) => item.orderId === order.id);
        const person = state.staff.find((item) => item.id === assignment?.staffId);
        const thirdPartyDelivery = state.thirdPartyDeliveries.find((request) => request.orderId === order.id);
        const available = state.staff.filter((item) => item.vendorId === order.vendorId && item.active);
        const product = order.productId ? state.products.find((item) => item.id === order.productId) : undefined;
        const details = [
          ["Delivery", <Fragment key="delivery"><span>{order.date}</span><span className="mt-1 block text-xs font-semibold text-stone-600">{order.slot}</span></Fragment>],
          ["Items", <span className="font-bold" key="items">{order.quantity} × {product?.name || order.description}</span>],
          ["Total", money(order.total)],
          ["Mode", order.mode],
          ["Delivery person", person ? <Fragment key="delivery-person"><span className="block">{person.name}</span><span className="mt-1 block break-all text-xs font-semibold text-stone-600">{person.phone}</span></Fragment> : "Not assigned"],
        ] as const;
        return <div key={order.id} className="surface-card rounded-[28px] p-5">
          <div className="flex flex-col gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><b>{order.description}</b><Status>{order.status}</Status><Status className={order.payment === "Paid" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>{order.payment}</Status><span className="font-mono text-xs text-stone-400">{order.id}</span></div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 xl:grid-cols-5">{details.map(([label, value]) => <OrderDetail key={label} label={label} value={value} />)}</div>
              {order.status === "Out for delivery" && <div className="mt-4"><MapPreview lat={order.trackingLatitude || vendor?.latitude} lng={order.trackingLongitude || vendor?.longitude} radius={0} label="Live delivery position" /></div>}
              {order.mode === "Third-party delivery" && thirdPartyDelivery && <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm text-violet-950">3rd Party Delivery Request</b><Status>{thirdPartyDelivery.status}</Status></div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-violet-950">{thirdPartyDelivery.notes}</p>
                {scope === "vendor" && thirdPartyDelivery.status === "pending" && <Button disabled={deliveryActionId === order.id} size="sm" onClick={() => void acceptThirdPartyRequest(order)} className="mt-3 rounded-xl bg-violet-700 hover:bg-violet-800">{deliveryActionId === order.id ? "Accepting…" : "Accept delivery request"}</Button>}
                {scope === "vendor" && thirdPartyDelivery.status === "accepted" && <div className="mt-3 flex flex-wrap items-end gap-2">
                  <Field label="Customer handover code"><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={verificationInputs[order.id] || ""} onChange={(event) => setVerificationInputs((current) => ({ ...current, [order.id]: event.target.value.replace(/\D/g, "").slice(0, 6) }))} placeholder="6-digit code" className={`${inputClass} w-40 font-mono tracking-widest`} /></Field>
                  <Button disabled={deliveryActionId === order.id || (verificationInputs[order.id] || "").length !== 6} size="sm" onClick={() => void verifyThirdPartyCode(order)} className="rounded-xl bg-violet-700 hover:bg-violet-800">{deliveryActionId === order.id ? "Verifying…" : "Verify & mark delivered"}</Button>
                </div>}
                {thirdPartyDelivery.status === "delivered" && <p className="mt-3 text-sm font-bold text-emerald-800">Handover verified. This order has been delivered.</p>}
                {thirdPartyDelivery.status === "locked" && <p className="mt-3 text-sm font-bold text-red-700">Code verification is locked after five incorrect attempts.</p>}
              </div>}
            </div>
            <div className="flex flex-wrap gap-2">
              {scope === "vendor" && order.status === "Scheduled" && <Button onClick={() => void update(order, "Confirmed")}>Accept order</Button>}
              <Select value={person?.id || "unassigned"} onValueChange={(staffId) => void assign(order, staffId)}><SelectTrigger className="w-44"><SelectValue placeholder="Assign delivery" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Not assigned</SelectItem>{available.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
{order.mode !== "Third-party delivery" && <Select value={order.status} onValueChange={(value) => void update(order, value as Order["status"])}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent>{["Scheduled", "Confirmed", "Preparing", "Ready", "Out for delivery", "Ready for pickup", "Completed"].map((status) => <SelectItem key={status} value={status} disabled={DELIVERY_STATUSES.includes(status as Order["status"]) && order.date > todayISO()}>{status}</SelectItem>)}</SelectContent></Select>}                {scope === "vendor" && order.status === "Out for delivery" && <Button size="sm" onClick={() => locate(order)} className="bg-[#753b50]"><MapPinned />Share live position</Button>}
            </div>
          </div>
        </div>;
      })}
    </div> : <Empty icon={Package} title="No orders for this selection" body={scope === "vendor" ? "Try Tomorrow or All dates. Unpaid schedules stay with the customer until payment is completed." : "No paid orders are available in this view."} />}
    <OrderDetailsDialog order={detailsOrder} close={() => setDetailsOrder(null)} state={state} session={session} />
    <OrderTrackingDialog order={trackingOrder} close={() => setTrackingOrder(null)} state={state} />
    <OrderRescheduleDialog order={rescheduling} close={() => setRescheduling(null)} state={state} setState={setState} />
    <PaymentDialog order={paying} close={() => setPaying(null)} state={state} setState={setState} />
    <RateOrderDialog key={ratingOrder?.id || "closed"} order={ratingOrder} close={() => setRatingOrder(null)} state={state} setState={setState} session={session} />
  </div>;
}

function RateOrderDialog({ order, close, state, setState, session }: { order: Order | null; close: () => void; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; session: DemoSession }) {
  const product = order?.productId ? state.products.find((x) => x.id === order.productId) : undefined;
  const existing = product ? state.reviews.find((r) => r.productId === product.id && r.customerEmail === session.email) : undefined;
  const [rating, setRating] = useState(existing?.rating || 5);
  const [comment, setComment] = useState(existing?.comment || "");
  if (!order || !product) return null;
  function submit() {
    if (!product) return;
    const review: Review = { id: existing?.id || id("RVW"), productId: product.id, vendorId: product.vendorId, customerEmail: session.email, customerName: session.name || session.email.split("@")[0], rating, comment: comment.trim(), createdAt: todayISO() };
    setState((s) => ({ ...s, reviews: [review, ...s.reviews.filter((r) => r.id !== review.id)] }));
    toast.success("Thanks for the feedback!");
    close();
  }
  return <Dialog open onOpenChange={(open) => !open && close()}><DialogContent className="rounded-[26px] sm:max-w-md"><DialogHeader><DialogTitle className="text-lg font-black">Rate {product.name}</DialogTitle><DialogDescription>Your feedback helps other customers and the vendor, {state.vendors.find((v) => v.id === product.vendorId)?.businessName || "this store"}.</DialogDescription></DialogHeader>
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2 py-2">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n === 1 ? "" : "s"}`}><Star className={`size-9 transition ${n <= rating ? "fill-[#e3a008] text-[#e3a008]" : "fill-stone-200 text-stone-200"}`} /></button>)}</div>
      <Field label="Tell us more (optional)"><Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How was the quality, packaging and delivery?" className="min-h-24 rounded-xl" /></Field>
      <Button onClick={submit} className="h-11 w-full rounded-xl bg-[#e3a008] font-black hover:bg-[#c98a00]"><Star />Submit rating</Button>
    </div>
  </DialogContent></Dialog>;
}

function OrderRescheduleDialog({ order, close, state, setState }: { order: Order | null; close: () => void; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  const [date, setDate] = useState(tomorrow());
  const [slot, setSlot] = useState("06:00–07:00 AM");
  const maxDate = addDaysISO(todayISO(), 15);
  const vendorActiveSlots = order ? (state.deliverySlots || []).filter((s) => s.vendorId === order.vendorId && s.isActive) : [];
  const rescheduleSlotOptions: string[] = vendorActiveSlots.length > 0
    ? vendorActiveSlots.map((s) => formatSlotLabel(s))
    : ["06:00–07:00 AM", "07:00–08:00 AM", "08:00–09:00 AM", "12:00–01:00 PM", "05:00–06:00 PM", "07:00–08:00 PM"];
  useEffect(() => { if (order) queueMicrotask(() => { setDate(order.date < tomorrow() || order.date > maxDate ? tomorrow() : order.date); setSlot(order.slot); }); }, [order, maxDate]);
  if (!order) return null;
  async function save() {
    if (!order) return;
    if (!date || date < tomorrow()) return toast.error("Choose tomorrow or a later date");
    if (date > maxDate) return toast.error("Orders can only be rescheduled within the next 15 days");
    try { if (isLiveSupabaseMode()) await rescheduleLiveOrder(order.id, date, slot); setState((s) => ({ ...s, orders: s.orders.map((x) => x.id === order.id ? { ...x, date, slot } : x) })); toast.success(`Order moved to ${date}`); close(); } catch (error) { toast.error(error instanceof Error ? error.message : "Order could not be rescheduled"); }
  }
  return <Dialog open onOpenChange={(open) => !open && close()}><DialogContent className="rounded-[26px] sm:max-w-md"><DialogHeader><DialogTitle className="text-xl font-black">Reschedule order</DialogTitle><DialogDescription>Choose a new delivery date within the next 15 days and a time window for {order.id}.</DialogDescription></DialogHeader><div className="space-y-4"><Field label="New delivery date"><input type="date" min={tomorrow()} max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} /></Field><Field label="Preferred time"><Select value={slot} onValueChange={setSlot}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{["06:00–07:00 AM", "07:00–08:00 AM", "08:00–09:00 AM", "12:00–01:00 PM", "05:00–06:00 PM", "07:00–08:00 PM"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field><Button onClick={save} className="h-11 w-full rounded-xl bg-[#753b50] font-black"><Check />Save new date</Button></div></DialogContent></Dialog>;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function PaymentDialog({ order, close, state, setState, onPaid }: { order: Order | null; close: () => void; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; onPaid?: () => void }) {
  const [method, setMethod] = useState<"UPI" | "Card" | "Net banking">("UPI");
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState(false);
  if (!order) return null;
  const vendor = state.vendors.find((x) => x.id === order.vendorId);
  const isLive = isLiveSupabaseMode();

  async function pay() {
    if (!order) return;
    setBusy(true);

    if (isLive) {
      try {
        const loaded = await loadRazorpayScript();
        if (!loaded || !(window as unknown as { Razorpay?: unknown }).Razorpay) {
          throw new Error("Unable to load secure Razorpay Checkout. Please check your connection and try again.");
        }

        const rzpOrder = await createLiveRazorpayOrder(order.id);

        const RazorpayConstructor = (window as unknown as { Razorpay: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, handler: (resp: unknown) => void) => void } }).Razorpay;

        const rzp = new RazorpayConstructor({
          key: rzpOrder.keyId,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency || "INR",
          name: "ShePlates",
          description: rzpOrder.description || `Order ${rzpOrder.orderNumber}`,
          order_id: rzpOrder.razorpayOrderId,
          prefill: {
            name: rzpOrder.customer?.name || "",
            email: rzpOrder.customer?.email || order.customerEmail || "",
          },
          theme: {
            color: "#753b50",
          },
          handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            try {
              setBusy(true);
              const result = await verifyLiveRazorpayPayment({
                orderId: order.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });

              const liveSnapshot = (result.snapshot || null) as { orders?: Array<Record<string, unknown>>; schedules?: Array<Record<string, unknown>>; staff?: Array<Record<string, unknown>>; assignments?: Array<Record<string, unknown>> } | null;
              const transaction = recordTransaction(order, "Razorpay");

              setState((s) => {
                const base = liveSnapshot
                  ? mergeLiveCommerce(s, liveSnapshot, { email: order.customerEmail, name: order.customerEmail, role: "customer" })
                  : { ...s, orders: s.orders.map((x) => x.id === order.id ? { ...x, payment: "Paid" as const, status: "Confirmed" as const } : x) };
                return {
                  ...base,
                  transactions: [transaction, ...base.transactions],
                  notifications: [
                    notice(order.customerEmail, "customer", "Payment successful", `${money(order.total)} collected via Razorpay. Your scheduled deliveries are now confirmed.`),
                    ...base.notifications,
                  ],
                  audit: [
                    audit({ email: order.customerEmail, name: order.customerEmail, role: "customer" }, "Customer paid via Razorpay", `${order.id} · ${money(order.total)} (Payment ID: ${response.razorpay_payment_id})`),
                    ...base.audit,
                  ],
                };
              });

              toast.success("Payment confirmed! Your delivery schedule is active.");
              setPlaced(true);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Payment verification failed.");
            } finally {
              setBusy(false);
            }
          },
          modal: {
            ondismiss: () => {
              setBusy(false);
              toast.info("Payment cancelled.");
            },
          },
        });

        rzp.on("payment.failed", (resp: unknown) => {
          setBusy(false);
          const errDesc = (resp as { error?: { description?: string } })?.error?.description;
          toast.error(errDesc || "Payment failed. Please try again.");
        });

        rzp.open();
      } catch (error) {
        setBusy(false);
        toast.error(error instanceof Error ? error.message : "Payment could not be initiated");
      }
      return;
    }

    // Demo Mode Simulated Payment
    await new Promise((resolve) => setTimeout(resolve, 350));
    try {
      const transaction = recordTransaction(order, method);
      setState((s) => {
        const base = { ...s, orders: s.orders.map((x) => x.id === order.id ? { ...x, payment: "Paid" as const, status: "Confirmed" as const } : x) };
        return {
          ...base,
          transactions: [transaction, ...base.transactions],
          notifications: [notice(order.customerEmail, "customer", "Payment successful", `${money(order.total)} collected. Your scheduled deliveries are now confirmed.`), ...base.notifications],
          audit: [audit({ email: order.customerEmail, name: order.customerEmail, role: "customer" }, "Customer paid for schedule", `${order.id} · ${money(order.total)} via ${method}`), ...base.audit],
        };
      });
      toast.success("Payment confirmed. Your delivery schedule is active.");
      setPlaced(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payment could not be confirmed");
    } finally {
      setBusy(false);
    }
  }

  if (placed) return <Dialog open onOpenChange={(open) => { if (!open) { close(); onPaid?.(); } }}><DialogContent className="rounded-[28px] sm:max-w-md"><DialogHeader className="items-center text-center"><span className="mx-auto grid size-16 place-items-center rounded-full bg-[#eaf5ec] text-[#21683b]"><Check className="size-8" /></span><DialogTitle className="text-[28px] font-bold">Order placed!</DialogTitle><DialogDescription>{vendor?.businessName || "The kitchen"} has your order. We will message you when it is accepted.</DialogDescription></DialogHeader>
    <div className="space-y-2 rounded-2xl bg-[#faf6f4] p-4 text-sm"><div className="flex justify-between gap-4"><span className="text-[#71676b]">Order number</span><b>{order.id}</b></div><div className="flex justify-between gap-4"><span className="text-[#71676b]">Delivery</span><b className="text-right">{order.date} · {order.slot}</b></div><div className="flex justify-between gap-4"><span className="text-[#71676b]">Items</span><b className="text-right">{order.description}</b></div><div className="flex justify-between gap-4"><span className="text-[#71676b]">Paid {isLive ? "with Razorpay" : `with ${method}`}</span><b className="tabular-nums">{money(order.total)}</b></div></div>
    <p className="rounded-2xl bg-[#edf3fd] p-3 text-xs font-medium text-[#285fba]">Need a change before the kitchen accepts? Contact Support with your order number: 9600037836 (9:30 AM to 7 PM).</p>
    <div className="flex flex-wrap justify-center gap-2"><Button onClick={() => { close(); onPaid?.(); }}>Track my order</Button><Button variant="secondary" onClick={() => close()}>Back to home</Button></div></DialogContent></Dialog>;

  return <Dialog open onOpenChange={(open) => !open && close()}><DialogContent className="rounded-[28px] sm:max-w-md"><DialogHeader><DialogTitle className="text-xl font-black">Pay for {order.id}</DialogTitle><DialogDescription>{isLive ? "Secure checkout powered by Razorpay Test Mode. All test payment methods (UPI, Cards, Net banking) are supported." : "Simulated secure checkout for this environment. Confirming here records a real transaction and schedules the vendor payout — no external gateway is charged."}</DialogDescription></DialogHeader>
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#faf6f4] p-4 text-sm"><Review label="Order" value={order.description} /><Review label="Vendor" value={vendor?.businessName || "—"} /><Review label="Delivery address" value={order.deliveryAddress || "Not provided"} /><Review label="Amount payable" value={money(order.total)} /></div>
      {!isLive && <div><div className="mb-2 text-xs font-black uppercase tracking-widest text-stone-500">Payment method</div><div className="grid grid-cols-3 gap-2">{(["UPI", "Card", "Net banking"] as const).map((item) => <button type="button" key={item} onClick={() => setMethod(item)} className={`h-11 rounded-full text-sm font-semibold ${method === item ? "bg-[#753b50] text-white" : "bg-[#faf6f4] text-[#4c4246]"}`}>{item}</button>)}</div></div>}
      {isLive && <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-950 flex items-center gap-2"><CreditCard className="size-4 shrink-0 text-emerald-600" /><span>Test Mode: Complete payment securely using Razorpay standard checkout popup.</span></div>}
      <Button onClick={() => void pay()} disabled={busy} className="h-12 w-full"><CreditCard />{busy ? (isLive ? "Opening Razorpay…" : "Processing…") : (isLive ? `Pay ${money(order.total)} with Razorpay` : `Pay ${money(order.total)}`)}</Button>
      <p className="rounded-2xl bg-[#FFF4CF] p-3 text-xs font-medium text-[#795900]">Payments are processed securely. ShePlates never stores your card or UPI details.</p><p className="text-[11px] leading-5 text-stone-400">A {PLATFORM_COMMISSION_PERCENT}% platform commission is retained; the rest is scheduled to reach the vendor {PAYOUT_CYCLE_DAYS} days after collection.</p>
    </div>
  </DialogContent></Dialog>;
}

function TicketCentre({ session, state, setState, vendor, mode = "manage" }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; vendor?: Vendor; mode?: "manage" | "oversight" }) {
  const visible = session.role === "operations" || session.role === "admin" ? state.tickets : state.tickets.filter((x) => x.creatorEmail === session.email || (vendor && x.vendorId === vendor.id));
  const [subject, setSubject] = useState(""), [description, setDescription] = useState(""), [category, setCategory] = useState("Order"), [file, setFile] = useState<File | null>(null);
  const canResolve = session.role === "operations";
  const open = visible.filter((x) => x.status !== "Resolved").length;
  function create() { if (!subject.trim() || !description.trim()) return toast.error("Add a subject and details"); const ticket: Ticket = { id: id("TKT"), creatorEmail: session.email, creatorRole: session.role, vendorId: vendor?.id, subject, description, category, priority: "Normal", status: "Open", attachmentName: file?.name, createdVia: "Portal", at: now() }; setState((s) => ({ ...s, tickets: [ticket, ...s.tickets], notifications: [notice(session.email, session.role, "Ticket created", `${ticket.id} is open.`), notice("operations@sheplates.demo", "operations", "New support ticket", `${ticket.id}: ${subject}`), ...s.notifications] })); setSubject(""); setDescription(""); setFile(null); toast.success(`${ticket.id} created`); }
  return <div className="space-y-6"><Heading eyebrow="SUPPORT" title="Ticket centre" body={mode === "oversight" ? "Operations owns day-to-day ticket triage and resolution for customers and vendors. This is a platform-wide oversight view — escalate or intervene only when needed." : "Raise and track account, order, catalogue, payment or delivery issues raised by customers and vendors. She Agent can create a ticket in the same role scope."} />{mode === "oversight" && <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900"><b>{open}</b> ticket(s) currently open across the platform. Operations is the owning team for resolution; Super Admin has full read access for governance and can step in on escalations.</div>}<div className={mode === "oversight" ? "" : "grid gap-5 xl:grid-cols-[1fr_380px]"}>{mode !== "oversight" && <aside className="space-y-4 xl:order-2"><div className="rounded-3xl bg-[#753b50] p-5 text-white"><h3 className="text-xl font-bold">We are here every day</h3><p className="mt-1 text-xs font-medium">Monday to Sunday, 9:30 AM to 7:00 PM</p><div className="mt-3 space-y-2 text-sm font-semibold"><div className="flex items-center gap-2"><PhoneCall className="size-5" />9600037836</div><div className="flex items-center gap-2"><MessageCircle className="size-5" />WhatsApp 9600037836</div><div className="flex items-center gap-2"><Send className="size-5" />support@sheplates.com</div></div></div><div className="surface-card space-y-3 rounded-[28px] p-5"><Field label="Category"><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Order","Delivery","Payment","Account","Catalogue","Verification","Other"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field><Field label="Subject"><input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} /></Field><Field label="Details"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-28 rounded-xl" /></Field><label className="block rounded-xl border border-dashed p-3 text-sm"><input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} /><Upload className="mr-2 inline size-4" />{file?.name || "Attach document"}</label><Button onClick={create} className="w-full"><TicketCheck />Create ticket</Button></div></aside>}<div className="space-y-3">{visible.length ? visible.map((ticket) => <div key={ticket.id} className="surface-card rounded-3xl p-5"><div className="flex flex-wrap items-center gap-2"><b>{ticket.subject}</b><Status>{ticket.status}</Status><Status>{ticket.creatorRole}</Status><span className="ml-auto font-mono text-xs">{ticket.id}</span></div><p className="mt-2 text-sm text-stone-500">{ticket.description}</p><div className="mt-3 text-xs text-stone-400">{ticket.category} · {ticket.createdVia} · {ticket.attachmentName || "No attachment"} · {ticket.at}</div>{canResolve && ticket.status !== "Resolved" && <Button size="sm" variant="outline" className="mt-3" onClick={() => setState((s) => ({ ...s, tickets: s.tickets.map((x) => x.id === ticket.id ? { ...x, status: "Resolved" } : x) }))}>Resolve</Button>}</div>) : <Empty icon={TicketCheck} title="No tickets in your scope" body="New support requests will appear here." />}</div></div></div>;
}

function computeBusinessHealth(state: V3State) {
  const wentWell: string[] = []; const needsAttention: string[] = []; const recovery: string[] = [];
  const completed = state.orders.filter((x) => x.status === "Completed").length;
  const cancelled = state.orders.filter((x) => x.status === "Cancelled").length;
  const totalOrders = state.orders.length;
  const gmv = state.orders.reduce((sum, x) => sum + x.total, 0);
  const paidRatio = totalOrders ? state.orders.filter((x) => x.payment === "Paid").length / totalOrders : 0;
  const verifiedVendors = state.vendors.filter((x) => x.verification === "Verified").length;
  const verificationBacklog = state.vendors.filter((x) => ["Submitted", "Under review"].includes(x.verification)).length;
  const openTickets = state.tickets.filter((x) => x.status !== "Resolved").length;
  const overduePayouts = state.transactions.filter((x) => x.payoutStatus === "Scheduled" && x.scheduledPayoutDate <= todayISO()).length;
  const cancellationRate = totalOrders ? cancelled / totalOrders : 0;
  const topVendorShare = (() => {
    if (!state.orders.length) return 0;
    const byVendor = new Map<string, number>();
    state.orders.forEach((o) => byVendor.set(o.vendorId, (byVendor.get(o.vendorId) || 0) + o.total));
    const max = Math.max(0, ...byVendor.values());
    return gmv ? max / gmv : 0;
  })();

  if (state.vendors.length && verifiedVendors / state.vendors.length >= 0.6) wentWell.push(`${verifiedVendors} of ${state.vendors.length} vendors are verified and trading — a healthy trust base.`);
  if (completed > 0) wentWell.push(`${completed} order(s) completed successfully out of ${totalOrders} placed.`);
  if (paidRatio >= 0.7 && totalOrders > 0) wentWell.push(`${Math.round(paidRatio * 100)}% of orders are already paid, keeping vendor payouts on schedule.`);
  if (openTickets === 0 && state.tickets.length > 0) wentWell.push("Every support ticket raised so far has been resolved.");
  if (cancellationRate <= 0.1 && totalOrders > 0) wentWell.push(`Cancellation rate is low at ${Math.round(cancellationRate * 100)}% of all orders.`);
  if (!wentWell.length) wentWell.push("Not enough activity yet to highlight a strength — check back once vendors, orders and payments start flowing.");

  if (verificationBacklog > 0) { needsAttention.push(`${verificationBacklog} vendor(s) are waiting on verification.`); recovery.push("Clear the vendor verification queue within 48 hours — a stuck queue directly blocks new supply from going live."); }
  if (overduePayouts > 0) { needsAttention.push(`${overduePayouts} vendor payout(s) have passed their scheduled date and are not yet marked paid.`); recovery.push("Release overdue payouts from Vendor payments today; late payouts are the fastest way to lose good vendors."); }
  if (openTickets > 0) { needsAttention.push(`${openTickets} support ticket(s) are still open.`); recovery.push("Ask Operations to triage tickets daily and close the oldest ones first — ageing tickets erode trust fastest."); }
  if (cancellationRate > 0.15 && totalOrders >= 5) { needsAttention.push(`Cancellation rate is elevated at ${Math.round(cancellationRate * 100)}%.`); recovery.push("Review the top cancellation reasons and the vendors involved; tighten fulfilment SLAs where a pattern appears."); }
  if (topVendorShare > 0.5 && gmv > 0) { needsAttention.push(`One vendor accounts for ${Math.round(topVendorShare * 100)}% of GMV — concentration risk.`); recovery.push("Actively onboard and promote 2–3 more verified vendors in the same category to diversify supply."); }
  if (paidRatio < 0.5 && totalOrders >= 3) { needsAttention.push("Less than half of all orders have been paid."); recovery.push("Prompt customers with pending payments — a stuck payment blocks the vendor's payout entirely."); }
  if (!needsAttention.length) { needsAttention.push("No urgent operational issues detected right now."); recovery.push("Maintain the current verification, payout and ticket-response cadence — it is working."); }
  recovery.push("Best practice: review this panel weekly alongside Vendor payments and Reports so nothing drifts unnoticed between check-ins.");
  return { wentWell, needsAttention, recovery, snapshot: { gmv, totalOrders, completed, cancelled, verifiedVendors, vendorCount: state.vendors.length, verificationBacklog, openTickets, overduePayouts, cancellationRate: Math.round(cancellationRate * 100), paidRatio: Math.round(paidRatio * 100), topVendorShare: Math.round(topVendorShare * 100) } };
}

function AIInsights({ role, state }: { role: "operations" | "admin"; state: V3State }) {
  const fulfilmentRisk = state.orders.filter((x) => ["Scheduled","Confirmed"].includes(x.status) && x.date <= tomorrow()).length;
  const lowStock = state.products.filter((x) => x.stock <= 5).length;
  const unassigned = state.orders.filter((x) => x.mode === "Vendor delivery" && !state.assignments.some((a) => a.orderId === x.id) && !["Completed","Cancelled"].includes(x.status)).length;
  const overdueTickets = state.tickets.filter((x) => !["Resolved"].includes(x.status)).length;
  const health = useMemo(() => computeBusinessHealth(state), [state]);
  const [narrative, setNarrative] = useState<{ summary: string; recommendedAction: string } | null>(null);
  const [loadingNarrative, setLoadingNarrative] = useState(false);
  async function askSheAgent() {
    setLoadingNarrative(true);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ task: "business_insights", role, message: "Summarise current business health", context: health.snapshot }) });
      const json = await response.json();
      if (json?.result) setNarrative({ summary: json.result.summary, recommendedAction: json.result.recommendedAction });
      else toast.error("She Agent could not generate a narrative right now");
    } catch { toast.error("She Agent is unavailable right now"); }
    finally { setLoadingNarrative(false); }
  }
  return <div className="space-y-6"><Heading eyebrow="AI-ASSISTED ANALYTICS" title={role === "admin" ? "Executive intelligence" : "Operational intelligence"} body="Explainable risk signals from authorised platform data. She Agent recommends; humans approve verification, price, refunds and access changes." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Fulfilments at risk" value={String(fulfilmentRisk)} icon={AlertTriangle} note="Due tomorrow without preparation" /><Metric label="Low-stock products" value={String(lowStock)} icon={Package} /><Metric label="Unassigned deliveries" value={String(unassigned)} icon={Truck} /><Metric label="Open support tickets" value={String(overdueTickets)} icon={TicketCheck} /></div><div className="grid gap-4 lg:grid-cols-2"><div className="surface-card rounded-[28px] p-6"><h3 className="font-black">Recommended attention</h3><div className="mt-4 space-y-3"><Review label="Vendor verification backlog" value={String(state.vendors.filter((x) => ["Submitted","Under review"].includes(x.verification)).length)} /><Review label="RFQs without quotes" value={String(state.requirements.filter((x) => !state.quotes.some((q) => q.requirementId === x.id)).length)} /><Review label="Cancellation reviews" value={String(state.cancellations.filter((x) => x.status === "Awaiting operations").length)} /><Review label="Closed stores" value={String(state.vendors.filter((x) => x.verification === "Verified" && !x.openToday).length)} /></div></div><div className="surface-dark rounded-[28px] p-6 text-white"><Sparkles className="text-[#e8cbd5]" /><h3 className="mt-3 text-xl font-black">{role === "admin" ? "Ask She Agent for a deeper narrative" : "Ask She Agent to explain a signal"}</h3><p className="mt-2 text-sm leading-6 text-white/60">{role === "admin" ? "Analyse vendor concentration, plan adoption, GMV, audit anomalies, role access and policy impact across the platform." : "Prioritise delayed fulfilments, certificate expiry, delivery coverage, RFQ response and support queues."}</p>{role === "admin" && <Button onClick={() => void askSheAgent()} disabled={loadingNarrative} className="mt-4 rounded-xl bg-[#753b50] hover:bg-[#292124]"><Activity />{loadingNarrative ? "Thinking…" : "Generate narrative"}</Button>}{narrative && <div className="mt-4 rounded-xl bg-white/10 p-4 text-sm leading-6"><p>{narrative.summary}</p><p className="mt-2 font-black text-[#e8cbd5]">{narrative.recommendedAction}</p></div>}</div></div>
  {role === "admin" && <div className="grid gap-4 lg:grid-cols-3">
    <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-6"><div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="size-5" /><h3 className="font-black">What&apos;s going well</h3></div><ul className="mt-4 space-y-2 text-sm leading-6 text-emerald-900">{health.wentWell.map((line, index) => <li key={index} className="flex gap-2"><span>•</span><span>{line}</span></li>)}</ul></div>
    <div className="rounded-3xl border border-amber-200 bg-amber-50/60 p-6"><div className="flex items-center gap-2 text-amber-800"><AlertTriangle className="size-5" /><h3 className="font-black">Needs attention</h3></div><ul className="mt-4 space-y-2 text-sm leading-6 text-amber-900">{health.needsAttention.map((line, index) => <li key={index} className="flex gap-2"><span>•</span><span>{line}</span></li>)}</ul></div>
    <div className="rounded-3xl border border-sky-200 bg-sky-50/60 p-6"><div className="flex items-center gap-2 text-sky-800"><Lightbulb className="size-5" /><h3 className="font-black">Recovery & best practices</h3></div><ul className="mt-4 space-y-2 text-sm leading-6 text-sky-900">{health.recovery.map((line, index) => <li key={index} className="flex gap-2"><span>•</span><span>{line}</span></li>)}</ul></div>
  </div>}
  </div>;
}


export function formatTime12(timeStr: string): string {
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

export function timeToMinutes(timeStr: string): number {
  const parts = String(timeStr || "").split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function slotsOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(startB) < timeToMinutes(endA);
}

export function formatSlotLabel(slot: VendorDeliverySlot): string {
  return `${slot.slotName} (${formatTime12(slot.startTime)} - ${formatTime12(slot.endTime)})`;
}

export function validateDeliverySlot({
  slotName,
  startTime,
  endTime,
  isActive,
  slotId,
  existingSlots,
}: {
  slotName: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  slotId?: string;
  existingSlots: VendorDeliverySlot[];
}): { valid: boolean; error?: string } {
  const name = slotName.trim();
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

function DeliverySlotsSection({
  vendor,
  state,
  setState,
  session,
}: {
  vendor: Vendor;
  state: V3State;
  setState: React.Dispatch<React.SetStateAction<V3State>>;
  session: DemoSession;
}) {
  const slots = (state.deliverySlots || []).filter((s) => s.vendorId === vendor.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<VendorDeliverySlot | null>(null);
  const [slotName, setSlotName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  function handleOpenAdd() {
    setEditingSlot(null);
    setSlotName("");
    setStartTime("09:00");
    setEndTime("11:00");
    setIsActive(true);
    setFormError("");
    setModalOpen(true);
  }

  function handleOpenEdit(slot: VendorDeliverySlot) {
    setEditingSlot(slot);
    setSlotName(slot.slotName);
    setStartTime(slot.startTime);
    setEndTime(slot.endTime);
    setIsActive(slot.isActive);
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave() {
    const validation = validateDeliverySlot({
      slotName,
      startTime,
      endTime,
      isActive,
      slotId: editingSlot?.id,
      existingSlots: slots,
    });
    if (!validation.valid) {
      setFormError(validation.error || "Please check slot details.");
      return;
    }

    setSaving(true);
    setFormError("");
    const slotId = editingSlot?.id || id("SLOT");
    const newSlot: VendorDeliverySlot = {
      id: slotId,
      vendorId: vendor.id,
      slotName: slotName.trim(),
      startTime,
      endTime,
      isActive,
      updatedAt: new Date().toISOString(),
    };

    if (isLiveSupabaseMode()) {
      try {
        const res = await saveLiveDeliverySlot({
          slotId: editingSlot?.id,
          vendorId: vendor.id,
          slotName: slotName.trim(),
          startTime,
          endTime,
          isActive,
        });
        if (res.snapshot) {
          setState((curr) => mergeLiveCommerce(curr, res.snapshot as LiveCommerceStateSnapshot, session));
        } else {
          setState((curr) => {
            const currentSlots = curr.deliverySlots || [];
            const nextSlots = editingSlot
              ? currentSlots.map((s) => (s.id === editingSlot.id ? newSlot : s))
              : [...currentSlots, newSlot];
            return { ...curr, deliverySlots: nextSlots };
          });
        }
        toast.success(editingSlot ? "Delivery slot updated." : "Delivery slot added.");
        setModalOpen(false);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Failed to save delivery slot.");
        toast.error(err instanceof Error ? err.message : "Delivery slot could not be saved.");
      } finally {
        setSaving(false);
      }
      return;
    }

    // Demo Mode Persistence
    setState((curr) => {
      const currentSlots = curr.deliverySlots || [];
      const nextSlots = editingSlot
        ? currentSlots.map((s) => (s.id === editingSlot.id ? newSlot : s))
        : [...currentSlots, newSlot];
      return { ...curr, deliverySlots: nextSlots };
    });
    toast.success(editingSlot ? "Delivery slot updated." : "Delivery slot added.");
    setSaving(false);
    setModalOpen(false);
  }

  async function handleToggle(slot: VendorDeliverySlot) {
    const nextActive = !slot.isActive;
    if (nextActive) {
      const conflicting = slots.find(
        (s) => s.id !== slot.id && s.isActive && slotsOverlap(slot.startTime, slot.endTime, s.startTime, s.endTime)
      );
      if (conflicting) {
        toast.error(`Cannot activate: overlaps with active slot "${conflicting.slotName}" (${formatTime12(conflicting.startTime)} - ${formatTime12(conflicting.endTime)}).`);
        return;
      }
    }

    setActionId(slot.id);
    if (isLiveSupabaseMode()) {
      try {
        const res = await toggleLiveDeliverySlot(slot.id, nextActive);
        if (res.snapshot) {
          setState((curr) => mergeLiveCommerce(curr, res.snapshot as LiveCommerceStateSnapshot, session));
        } else {
          setState((curr) => ({
            ...curr,
            deliverySlots: (curr.deliverySlots || []).map((s) => (s.id === slot.id ? { ...s, isActive: nextActive } : s)),
          }));
        }
        toast.success(nextActive ? `"${slot.slotName}" is now active.` : `"${slot.slotName}" deactivated.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update slot status.");
      } finally {
        setActionId(null);
      }
      return;
    }

    // Demo mode
    setState((curr) => ({
      ...curr,
      deliverySlots: (curr.deliverySlots || []).map((s) => (s.id === slot.id ? { ...s, isActive: nextActive } : s)),
    }));
    toast.success(nextActive ? `"${slot.slotName}" is now active.` : `"${slot.slotName}" deactivated.`);
    setActionId(null);
  }

  async function handleDelete(slot: VendorDeliverySlot) {
    if (!confirm(`Delete delivery slot "${slot.slotName}" (${formatTime12(slot.startTime)} - ${formatTime12(slot.endTime)})?`)) return;
    setActionId(slot.id);
    if (isLiveSupabaseMode()) {
      try {
        const res = await deleteLiveDeliverySlot(slot.id);
        if (res.snapshot) {
          setState((curr) => mergeLiveCommerce(curr, res.snapshot as LiveCommerceStateSnapshot, session));
        } else {
          setState((curr) => ({
            ...curr,
            deliverySlots: (curr.deliverySlots || []).filter((s) => s.id !== slot.id),
          }));
        }
        toast.success("Delivery slot deleted.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete slot.");
      } finally {
        setActionId(null);
      }
      return;
    }

    // Demo mode
    setState((curr) => ({
      ...curr,
      deliverySlots: (curr.deliverySlots || []).filter((s) => s.id !== slot.id),
    }));
    toast.success("Delivery slot deleted.");
    setActionId(null);
  }

  return (
    <div className="mt-6 border-t border-stone-200/80 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-black text-stone-900">Delivery Slots</h3>
          <p className="text-xs text-stone-500">Configure the time windows when your store can deliver orders.</p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleOpenAdd}
          className="rounded-xl bg-[#292124] text-white hover:bg-stone-800 font-bold"
        >
          <Plus className="size-4 mr-1.5" />
          Add Delivery Slot
        </Button>
      </div>

      {slots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 p-6 text-center">
          <Clock3 className="size-6 text-stone-400 mx-auto" />
          <div className="mt-2 text-xs font-bold text-stone-700">No delivery slots configured</div>
          <p className="text-xs text-stone-500 mt-0.5">Add delivery time slots so customers can schedule their orders.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {slots.map((slot) => (
            <div
              key={slot.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all ${
                slot.isActive ? "border-stone-200/90 bg-white shadow-xs" : "border-stone-200/60 bg-stone-50/70 opacity-75"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                    slot.isActive ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-400"
                  }`}
                >
                  <Clock3 className="size-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-stone-900 text-sm truncate">{slot.slotName}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        slot.isActive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-stone-100 text-stone-500 border border-stone-200"
                      }`}
                    >
                      {slot.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 font-medium mt-0.5">
                    {formatTime12(slot.startTime)} – {formatTime12(slot.endTime)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => void handleToggle(slot)}
                  disabled={actionId === slot.id}
                  className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-bold transition ${
                    slot.isActive
                      ? "bg-emerald-100/70 text-emerald-800 hover:bg-emerald-200"
                      : "bg-stone-200 text-stone-700 hover:bg-stone-300"
                  }`}
                >
                  {slot.isActive ? "Active" : "Disabled"}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEdit(slot)}
                  className="grid size-8 place-items-center rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  title="Edit slot"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(slot)}
                  disabled={actionId === slot.id}
                  className="grid size-8 place-items-center rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                  title="Delete slot"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="rounded-[26px] sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-stone-900">
              {editingSlot ? "Edit Delivery Slot" : "Add Delivery Slot"}
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              Set the time window when your kitchen can deliver orders.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {formError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-semibold">
                {formError}
              </div>
            )}

            <Field label="Slot Name" hint="e.g. Morning, Afternoon, Evening">
              <input
                type="text"
                maxLength={80}
                value={slotName}
                onChange={(e) => {
                  setSlotName(e.target.value);
                  setFormError("");
                }}
                placeholder="e.g. Morning"
                className={inputClass}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Time">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value);
                    setFormError("");
                  }}
                  className={inputClass}
                />
              </Field>
              <Field label="End Time">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    setFormError("");
                  }}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 p-3">
              <div>
                <div className="text-xs font-bold text-stone-800">Active status</div>
                <div className="text-[11px] text-stone-500">Enable this slot for customer checkout</div>
              </div>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="size-4 accent-[#753b50] rounded"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="rounded-xl bg-[#753b50] font-bold text-white hover:bg-[#602d40]"
              >
                {saving ? "Saving…" : editingSlot ? "Save Changes" : "Add Slot"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StoreRadius({ vendor, state, setState, session }: { vendor: Vendor; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; session: DemoSession }) {
  const [radius, setRadius] = useState(vendor.radiusKm), [address, setAddress] = useState(vendor.address), [coords, setCoords] = useState<{ lat?: number; lng?: number }>({ lat: vendor.latitude, lng: vendor.longitude }), [locating, setLocating] = useState(false), [mapBusy, setMapBusy] = useState(false);
  async function update(patch: Partial<Vendor>, message: string) { try { if (isLiveSupabaseMode()) await updateLiveVendorControls(vendor.id, { ...(patch.openToday !== undefined ? { store_open_today: patch.openToday } : {}), ...(patch.operational ? { operational_status: patch.operational.toLowerCase() } : {}), ...(patch.delivery !== undefined ? { delivery_enabled: patch.delivery } : {}), ...(patch.pickup !== undefined ? { pickup_enabled: patch.pickup } : {}), ...(patch.openToday === true && vendor.verification === "Verified" ? { marketplace_visible: true } : {}) }); setState((s) => ({ ...s, vendors: s.vendors.map((x) => x.id === vendor.id ? { ...x, ...patch } : x), audit: [audit(session, message, vendor.businessName), ...s.audit] })); toast.success(message); } catch (error) { toast.error(error instanceof Error ? error.message : "Store control could not be saved"); } }
  function detectStore() {
    if (!navigator.geolocation) return toast.error("Location detection is not supported in this browser.");
    if (!window.isSecureContext) return toast.error("Location requires HTTPS or localhost. Open the app on a secure page and try again.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      setCoords(point);
      setAddress(`GPS pin ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)} — add store details`);
      try {
        const place = await findLocation(point);
        setAddress(place.address);
        setCoords({ lat: place.latitude, lng: place.longitude });
        toast.success(`Actual store GPS location detected (±${Math.round(position.coords.accuracy)} m)`);
      } catch (error) {
        toast.info(error instanceof Error ? `${error.message} The exact GPS pin is still shown.` : "The exact GPS pin is shown.");
      } finally {
        setLocating(false);
      }
    }, (error) => {
      setLocating(false);
      if (error.code === error.PERMISSION_DENIED) {
        toast.error("Location permission is blocked. In Chrome, open the site settings from the icon beside the address, set Location to Allow, then retry. You can also search the store address.");
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        toast.error("Your device could not determine its location. Turn on Windows Location services and retry, or search the store address.");
      } else if (error.code === error.TIMEOUT) {
        toast.error("Location detection timed out. Retry near a window or search the store address.");
      } else {
        toast.error(error.message || "Location could not be detected. Search the store address instead.");
      }
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  async function findStore() { if (!address.trim()) return toast.error("Enter the complete store address first"); setMapBusy(true); try { const place = await findLocation({ address }); setAddress(place.address); setCoords({ lat: place.latitude, lng: place.longitude }); toast.success("Store address located on the map"); } catch (error) { toast.error(error instanceof Error ? error.message : "Store address was not found"); } finally { setMapBusy(false); } }
  async function saveStorePin() { if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) return toast.error("Detect GPS or find the store address before saving"); try { if (session.userId && process.env.NEXT_PUBLIC_DEMO_MODE === "false" && isSupabaseConfigured()) await saveLiveVendorLocation({ vendorId: vendor.id, address, latitude: coords.lat!, longitude: coords.lng!, radiusKm: radius }); update({ address, latitude: coords.lat, longitude: coords.lng, radiusKm: radius }, "Store pin and service radius updated"); } catch (error) { toast.error(error instanceof Error ? error.message : "Store location could not be saved"); } }
  return <div className="space-y-6">
    <Heading eyebrow="DAILY SERVICE CONTROL" title="Store location, radius & fulfilment" body="Customer matching uses this exact store pin and the saved service radius—not the address text alone." />
    <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <div className="surface-card space-y-4 rounded-3xl p-6 lg:order-2">
        <div data-tour="store-open"><ToggleCard icon={Store} title={vendor.openToday ? "Open today" : "Closed today"} body={vendor.verification === "Verified" ? "Customers inside your saved radius can see active in-stock items while open." : "Verification is still required before customers can see items."} checked={vendor.openToday} setChecked={(value) => update({ openToday: value, operational: value && vendor.verification === "Verified" ? "Active" : value ? "Inactive" : "Paused" }, value ? "Store opened for today" : "Store closed for today")} /></div>
        <Field label="Full store address"><Textarea value={address} onChange={(event) => setAddress(event.target.value)} className="min-h-24 rounded-xl" /></Field>
        <LocationSuggestions query={address} onSelect={(place) => { setAddress(place.address); setCoords({ lat: place.latitude, lng: place.longitude }); }} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={detectStore} disabled={locating} className="rounded-xl bg-[#753b50]"><LocateFixed className={locating ? "animate-spin" : ""} />{locating ? "Getting fresh GPS…" : "Use actual store GPS"}</Button>
          <Button onClick={findStore} disabled={mapBusy} variant="outline" className="rounded-xl"><Search />{mapBusy ? "Searching…" : "Find typed address"}</Button>
        </div>
        <Field label={`Supply radius · ${radius} km`} hint="This is measured from the exact store pin shown on the map."><Slider value={[radius]} min={1} max={30} step={1} onValueChange={(v) => setRadius(v[0])} /></Field>
        <Button onClick={saveStorePin} className="w-full rounded-xl bg-[#753b50]"><Check />Save store pin & radius</Button>
        <div className="grid grid-cols-2 gap-3">
          <ToggleCard icon={Truck} title="Delivery" body="Your own team" checked={vendor.delivery} setChecked={(v) => update({ delivery: v }, "Delivery mode updated")} />
          <ToggleCard icon={ShoppingBag} title="Pickup" body="At your store" checked={vendor.pickup} setChecked={(v) => update({ pickup: v }, "Pickup mode updated")} />
        </div>
        <DeliverySlotsSection vendor={vendor} state={state} setState={setState} session={session} />
      </div>
      <div className="min-w-0 lg:order-1"><MapPreview lat={coords.lat} lng={coords.lng} radius={radius} label="Exact store pin" /></div>
    </div>
  </div>;
}
const THREE_VENDOR_PLANS = [
  {
    name: "Crave" as const,
    price: 699,
    description: "Pre-orders, subscriptions, delivery fleet management and Food Stories.",
    features: [
      "Pre-orders & scheduled subscriptions",
      "Delivery fleet & staff assignment",
      "Customer Food Stories & storefront",
    ],
  },
  {
    name: "Thrive" as const,
    price: 799,
    popular: true,
    description: "Everything in Crave, plus daily Food Drops for surplus promotions.",
    features: [
      "Everything in Crave plan",
      "Daily Food Drops (evening promotions)",
      "Surplus deals badge & live countdown",
    ],
  },
  {
    name: "Crown" as const,
    price: 999,
    description: "Everything in Thrive, plus Request for Quote (RFQ) with AI assistance.",
    features: [
      "Everything in Thrive plan",
      "Request for Quote (RFQ) opportunities",
      "AI quotation assistant & demand alerts",
    ],
  },
];
const vendorPlanRank: Record<string, number> = { Taster: 0, Crave: 1, Thrive: 2, Crown: 3 };

function VerificationView({ vendor, setState, session }: { vendor: Vendor; setState: React.Dispatch<React.SetStateAction<V3State>>; session: DemoSession }) {
  const [editing, setEditing] = useState(false);
  const [certificate, setCertificate] = useState(vendor.fssaiNumber || "");
  const [fileName, setFileName] = useState(vendor.certificateName || "");
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [expiry, setExpiry] = useState(vendor.expiryDate || "");
  const [upgradingTo, setUpgradingTo] = useState<string | null>(null);

  async function upgradePlan(newPlan: Vendor["plan"]) {
    if (vendor.plan === newPlan) return;
    setUpgradingTo(newPlan);
    try {
      if (isLiveSupabaseMode()) {
        await saveLiveVendorPlan(vendor.id, newPlan.toLowerCase() as "taster" | "crave" | "thrive" | "crown");
      }
      setState((s) => ({
        ...s,
        vendors: s.vendors.map((x) => x.id === vendor.id ? { ...x, plan: newPlan } : x),
        audit: [audit(session, "Vendor upgraded plan", `${vendor.businessName} switched to ${newPlan}`), ...s.audit],
      }));
      toast.success(`Plan upgraded to ${newPlan}!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Plan upgrade could not be saved");
    } finally {
      setUpgradingTo(null);
    }
  }
  async function save(resubmit = false) {
    if (!certificate.trim()) return toast.error("Enter the certification / licence number");
    try {
      if (isLiveSupabaseMode()) {
        if (certificateFile) { const uploaded = await uploadLiveCertificate({ vendorId: vendor.id, file: certificateFile }); setFileName(uploaded.fileName || certificateFile.name); }
        if (resubmit) await resubmitLiveVendorVerification({ documentNumber: certificate.trim(), expiryDate: expiry || undefined });
      }
      const nextStatus: Verification = resubmit ? "Submitted" : vendor.verification;
      setState((s) => ({ ...s, vendors: s.vendors.map((x) => x.id === vendor.id ? { ...x, fssaiNumber: certificate.trim(), certificateName: fileName || x.certificateName, expiryDate: expiry, verification: nextStatus, operational: resubmit ? "Inactive" : x.operational } : x), audit: [audit(session, resubmit ? "Resubmitted verification" : "Edited verification details", vendor.businessName), ...s.audit] }));
      setEditing(false); toast.success(resubmit ? "Verification resubmitted for review" : "Verification details saved");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Verification details could not be saved"); }
  }
  return <div className="space-y-6"><Heading eyebrow="TRUST & COMPLIANCE" title="Vendor verification" body="Review your certification details at any time. If information changes, edit and resubmit it for Operations review." action={<Button variant="outline" onClick={() => setEditing((v) => !v)} className="rounded-xl"><Pencil />{editing ? "Close editor" : "Edit details"}</Button>} />
    <div className="surface-card rounded-[28px] p-6"><div className="flex items-center gap-4"><div className="grid size-12 place-items-center rounded-2xl bg-[#f7edf0] text-[#653046]"><FileCheck2 /></div><div className="flex-1"><h3 className="font-black">{vendor.businessName}</h3><p className="text-sm text-stone-500">{vendor.address}</p></div><div className="flex flex-wrap items-center gap-2"><Status>{vendor.verification}</Status><Status className="border-stone-200 bg-stone-50 text-stone-700 font-bold">{vendor.plan} plan</Status></div></div>
      {editing ? <div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="Certification / licence number"><input value={certificate} onChange={(e) => setCertificate(e.target.value)} className={inputClass} /></Field><Field label="Expiry date"><input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={inputClass} /></Field><Field label="Certificate file"><label className="flex h-11 cursor-pointer items-center rounded-2xl border bg-white px-3.5 text-sm font-bold"><input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => { const next = e.target.files?.[0] || null; setCertificateFile(next); setFileName(next?.name || fileName); }} /><Upload className="mr-2 size-4" />{fileName || "Choose file"}</label></Field><div className="flex items-end gap-2"><Button onClick={() => void save(false)} variant="outline" className="h-11 rounded-xl">Save only</Button><Button onClick={() => void save(true)} className="h-11 rounded-xl bg-[#753b50]">Resubmit for review</Button></div></div> : <div className="mt-6 grid gap-3 sm:grid-cols-3"><Review label="Certificate" value={vendor.fssaiNumber || "Not added"} /><Review label="Uploaded file" value={vendor.certificateName || "Not added"} /><Review label="Expires" value={vendor.expiryDate || "Not set"} /><Review label="Current plan" value={`${vendor.plan} plan`} /></div>}
    </div>
    <div className="surface-card rounded-[28px] p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-black">Subscription plans</h3>
            <Status className="border-emerald-200 bg-emerald-50 text-emerald-800 font-bold">Active: {vendor.plan}</Status>
          </div>
          <p className="mt-1 text-sm text-stone-500">
            Choose a plan to upgrade your store capabilities, food drops, and quotation opportunities.
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {THREE_VENDOR_PLANS.map((plan) => {
          const isCurrent = vendor.plan === plan.name;
          const isHigher = (vendorPlanRank[plan.name] ?? 0) > (vendorPlanRank[vendor.plan || "Taster"] ?? 0);
          return (
            <div
              key={plan.name}
              data-plan-card={plan.name}
              className={`flex flex-col justify-between rounded-3xl border p-5 transition ${
                isCurrent
                  ? "border-[#753b50] bg-[#faf6f4] shadow-sm ring-2 ring-[#753b50]/20"
                  : "border-stone-200/80 bg-white hover:border-stone-300"
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-black">{plan.name}</h4>
                  {isCurrent ? (
                    <Status className="border-emerald-200 bg-emerald-100 text-emerald-800 font-bold">Current plan</Status>
                  ) : plan.popular ? (
                    <span className="rounded-full bg-[#b42332]/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#b42332]">Popular</span>
                  ) : null}
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-2xl font-black">{money(plan.price)}</span>
                  <span className="text-xs font-bold text-stone-500">/ month + GST</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-stone-500">{plan.description}</p>
                <ul className="mt-4 space-y-2 border-t border-stone-100 pt-3 text-xs text-stone-600">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2">
                      <Check className="size-3.5 text-[#653046] shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-5">
                {isCurrent ? (
                  <Button disabled variant="outline" className="w-full rounded-xl border-emerald-300 bg-emerald-50 text-emerald-800 font-black opacity-90 cursor-default">
                    <Check className="mr-1.5 size-4" />Current plan
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => void upgradePlan(plan.name)}
                    disabled={upgradingTo === plan.name}
                    className={`w-full rounded-xl font-black ${
                      isHigher
                        ? "bg-[#753b50] hover:bg-[#4d8b00] text-white shadow-sm"
                        : "bg-stone-900 hover:bg-stone-800 text-white"
                    }`}
                  >
                    {upgradingTo === plan.name ? (
                      "Updating…"
                    ) : isHigher ? (
                      <><Sparkles className="mr-1.5 size-4" />Upgrade to {plan.name}</>
                    ) : (
                      <>Switch to {plan.name}</>
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </div>;
}

function Catalog({ vendor, state, setState, session }: { vendor: Vendor; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; session: DemoSession }) {
  const [open, setOpen] = useState(false); const [bulkOpen, setBulkOpen] = useState(false); const items = state.products.filter((x) => x.vendorId === vendor.id);
  const readiness = [{ label: "Exact store pin", ready: Number.isFinite(vendor.latitude) && Number.isFinite(vendor.longitude) }, { label: "Operations verified", ready: vendor.verification === "Verified" }, { label: "Store open today", ready: vendor.openToday && vendor.operational === "Active" }, { label: "Active product with stock", ready: items.some((item) => item.active && item.stock > 0) }];
  return <div className="space-y-6"><Heading eyebrow="PRODUCT CATALOG" title="Items, packs & nutrition" body="Add one item manually or upload a grocery/product list. AI can structure the catalogue and create optional product images; nothing is published until you approve it." action={<div className="flex flex-wrap gap-2"><Button onClick={() => setBulkOpen(true)} variant="outline" className="rounded-xl"><FileUp />Upload product list</Button><Button onClick={() => setOpen(true)} className="rounded-xl bg-[#753b50]"><Plus />Add product pack</Button></div>} /><div className="surface-card rounded-[22px] p-4"><div className="text-sm font-black">Customer marketplace readiness</div><div className="mt-3 flex flex-wrap gap-2">{readiness.map((item) => <span key={item.label} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${item.ready ? "bg-[#f7edf0] text-[#292124]" : "bg-amber-50 text-amber-800"}`}>{item.ready ? <Check className="size-3" /> : <AlertTriangle className="size-3" />}{item.label}</span>)}</div>{readiness.some((item) => !item.ready) && <p className="mt-3 text-xs text-stone-500">The product will not appear to customers until all three checks are green.</p>}</div>{items.length ? <div className="surface-card overflow-hidden rounded-[28px]"><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Selling pack</TableHead><TableHead>Pack stock</TableHead><TableHead>Price / pack</TableHead><TableHead>Nutrition / pack</TableHead><TableHead>Active</TableHead></TableRow></TableHeader><TableBody>{items.map((product) => <TableRow key={product.id}><TableCell><div className="flex items-center gap-3"><span className="grid size-12 place-items-center overflow-hidden rounded-xl" style={{ background: product.imageUrl ? undefined : categoryVisual(product.category).bg }}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" /> : <ProductGlyph category={product.category} />}</span><div><b>{product.name}</b><div className="text-xs text-stone-500">{product.category}</div></div></div></TableCell><TableCell><b>{product.baseUnit}</b></TableCell><TableCell>{product.stock} packs</TableCell><TableCell className="font-black">{money(product.vendorPrice)}</TableCell><TableCell>{product.nutritionStatus === "Pending review" || product.calories <= 0 ? <div><Status className="border-amber-200 bg-amber-50 text-amber-800">Pending review</Status><div className="mt-1 text-xs text-stone-500">Product can stay active while Operations reviews nutrition.</div></div> : <div><b>{product.calories} kcal</b><div className="text-xs text-stone-500">P {product.protein}g · C {product.carbs}g · F {product.fat}g</div><div className="mt-1 text-[10px] font-bold text-[#653046]">{product.nutritionStatus || "Estimated"}</div></div>}</TableCell><TableCell><Switch checked={product.active} disabled={vendor.verification !== "Verified" || product.stock <= 0} onCheckedChange={(value) => setState((s) => ({ ...s, products: s.products.map((x) => x.id === product.id ? { ...x, active: value } : x) }))} /></TableCell></TableRow>)}</TableBody></Table></div> : <Empty icon={ShoppingBag} title="Your catalogue is empty" body="Add the first sellable product pack. Nothing is seeded in V3." action={<Button onClick={() => setOpen(true)} className="rounded-xl bg-[#753b50]"><Plus />Add first product pack</Button>} />}<ProductDialog open={open} close={() => setOpen(false)} vendor={vendor} setState={setState} session={session} /><BulkCatalogDialog open={bulkOpen} close={() => setBulkOpen(false)} vendor={vendor} state={state} setState={setState} session={session} /></div>;
}


type BulkCatalogDraft = { id: string; name: string; category: string; pack: string; price: number; stock: number; imageUrl?: string; generating?: boolean };
const bulkCatalogGridClass = "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)_minmax(0,.7fr)_minmax(0,.55fr)_minmax(0,.55fr)_6rem]";
function BulkCatalogDialog({ open, close, vendor, state, setState, session }: { open: boolean; close: () => void; vendor: Vendor; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; session: DemoSession }) {
  const [rows, setRows] = useState<BulkCatalogDraft[]>([]);
  const [busy, setBusy] = useState(false);
  async function readList(file?: File) {
    if (!file) return;
    const text = await file.text();
    const fallback = parseRequirementText(text).map((item) => ({ id: id("BULK"), name: item.name, category: vendor.category in unitsByCategory ? vendor.category : "Groceries", pack: `${item.quantity || 1} ${item.unit || "pack"}`, price: 0, stock: 1 }));
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/catalogue-import", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ text, defaultCategory: vendor.category }) });
      const json = await response.json() as { items?: Array<{ name: string; category: string; pack: string; price: number; stock: number }>; error?: string };
      const items = response.ok && json.items?.length ? json.items.map((item) => ({ id: id("BULK"), name: item.name, category: item.category in unitsByCategory ? item.category : (vendor.category in unitsByCategory ? vendor.category : "Groceries"), pack: item.pack || "1 pack", price: Number(item.price || 0), stock: Math.max(1, Number(item.stock || 1)) })) : fallback;
      setRows(items); toast.success(`${items.length} item(s) prepared. Review every row before publishing.`);
    } catch { setRows(fallback); toast.info(`${fallback.length} item(s) extracted for manual review.`); }
  }
  async function generateImage(row: BulkCatalogDraft) {
    setRows((current) => current.map((item) => item.id === row.id ? { ...item, generating: true } : item));
    try { const token = await getAccessToken(); const response = await fetch("/api/product-image-generate", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ productName: row.name, category: row.category, pack: row.pack }) }); const json = await response.json() as { imageDataUrl?: string; imageUrl?: string; error?: string }; if (!response.ok) throw new Error(json.error || "Image creation failed"); setRows((current) => current.map((item) => item.id === row.id ? { ...item, imageUrl: json.imageDataUrl || json.imageUrl, generating: false } : item)); } catch (error) { setRows((current) => current.map((item) => item.id === row.id ? { ...item, generating: false } : item)); toast.error(error instanceof Error ? error.message : "Image creation failed"); }
  }
  async function publishAll() {
    const valid = rows.filter((row) => row.name.trim() && row.price > 0 && row.stock > 0);
    if (!valid.length) return toast.error("Add a price and stock for at least one item");
    setBusy(true);
    try {
      const created: Product[] = [];
      for (const row of valid) {
        const options = unitsByCategory[row.category] || unitsByCategory.Groceries; const spec = options[0];
        const nutrition: Nutrition = { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 };
        const nutritionNote = "Bulk-imported product published without verified nutrition. Operations review requested.";
        let imageUrl = row.imageUrl;
        if (imageUrl?.startsWith("data:") && isLiveSupabaseMode()) imageUrl = await uploadLiveProductImage(vendor.id, imageUrl);
        const productId = isLiveSupabaseMode() ? await saveLiveVendorProduct({ vendorId: vendor.id, name: row.name, category: row.category, unit: row.pack || spec.label, price: row.price, stock: Math.round(row.stock), active: vendor.verification === "Verified", ...nutrition, dietaryTags: [], packAmount: spec.amount, packMeasure: spec.measure, imageUrl, nutritionStatus: "pending_review", nutritionNote }) : id("PRD");
        if (isLiveSupabaseMode()) { try { await notifyLiveNutritionReview({ productId, productName: row.name, reason: nutritionNote }); } catch (error) { console.error("Bulk nutrition review notification", error); } }
        created.push({ id: productId, vendorId: vendor.id, name: row.name, category: row.category, emoji: spec.emoji, baseUnit: row.pack || spec.label, quantityStep: 1, vendorPrice: row.price, stock: Math.round(row.stock), active: vendor.verification === "Verified", ...nutrition, dietaryTags: [], packAmount: spec.amount, packMeasure: spec.measure, imageUrl, nutritionStatus: "Pending review", nutritionNote });
      }
      setState((current) => ({ ...current, products: [...created, ...current.products.filter((item) => !created.some((next) => next.id === item.id))], audit: [audit(session, "Bulk catalogue approved", `${created.length} item(s) published by human approval`), ...current.audit] }));
      toast.success(`${created.length} item(s) published`); setRows([]); close();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Catalogue could not be published"); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={(value) => !value && close()}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-[28px] sm:max-w-5xl"><DialogHeader><DialogTitle className="text-lg font-black">Build catalogue from a product list</DialogTitle><DialogDescription>Upload CSV or TXT. The list is structured into draft products. Review every row, optionally create an image, then approve the final catalogue yourself.</DialogDescription></DialogHeader>
    <label className="surface-card flex cursor-pointer items-center justify-center rounded-3xl border-dashed p-7 text-sm font-black"><input type="file" className="hidden" accept=".csv,.txt,.tsv" onChange={(e) => void readList(e.target.files?.[0])} /><FileUp className="mr-2" />Upload product list</label>
    {rows.length > 0 && <div className="space-y-3">
      <div className={`hidden gap-3 px-4 text-xs font-black tracking-wide text-stone-500 lg:grid ${bulkCatalogGridClass}`}>
        <div className="min-w-0">Product Name</div><div className="min-w-0">Categories</div><div className="min-w-0">No. of Packs</div><div className="min-w-0">Price</div><div className="min-w-0">Quantity</div><div className="w-24" aria-hidden="true" />
      </div>
      {rows.map((row) => <div key={row.id} className={`surface-card grid gap-3 rounded-3xl p-4 ${bulkCatalogGridClass}`}><input value={row.name} onChange={(e) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, name: e.target.value } : item))} className={`${inputClass} min-w-0`} placeholder="Product" /><Select value={row.category} onValueChange={(value) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, category: value } : item))}><SelectTrigger className="min-w-0"><SelectValue /></SelectTrigger><SelectContent>{categoryNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select><input value={row.pack} onChange={(e) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, pack: e.target.value } : item))} className={`${inputClass} min-w-0`} placeholder="Pack" /><input type="number" min="0" value={row.price || ""} onChange={(e) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, price: Number(e.target.value) } : item))} className={`${inputClass} min-w-0`} placeholder="₹" /><input type="number" min="1" value={row.stock} onChange={(e) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, stock: Number(e.target.value) } : item))} className={`${inputClass} min-w-0`} placeholder="Stock" /><div className="flex w-24 gap-2"><button onClick={() => void generateImage(row)} className="grid size-11 place-items-center rounded-xl border" title="Create optional image">{row.generating ? <RefreshCcw className="size-4 animate-spin" /> : row.imageUrl ? <img src={row.imageUrl} alt="" className="size-9 rounded-lg object-cover" /> : <Sparkles className="size-4" />}</button><button onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} className="grid size-11 place-items-center rounded-xl border text-red-600"><Trash2 className="size-4" /></button></div></div>)}
    </div>}
    <Button onClick={() => void publishAll()} disabled={busy || !rows.length} className="h-12 w-full rounded-xl bg-[#753b50] font-black"><Check />{busy ? "Publishing…" : "Approve & publish selected catalogue"}</Button>
  </DialogContent></Dialog>;
}

function ProductDialog({ open, close, vendor, setState, session }: { open: boolean; close: () => void; vendor: Vendor; setState: React.Dispatch<React.SetStateAction<V3State>>; session: DemoSession }) {
  const initialCategory = vendor.category in unitsByCategory ? vendor.category : "Groceries";
  const [name, setName] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [packKey, setPackKey] = useState(unitsByCategory[initialCategory][0].key);
  const [price, setPrice] = useState(0);
  const [stock, setStock] = useState(0);
  const [nutrition, setNutrition] = useState<Nutrition>({ calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 });
  const [confirmed, setConfirmed] = useState(false);
  const [nutritionConfidence, setNutritionConfidence] = useState<number | undefined>();
  const [nutritionNote, setNutritionNote] = useState("");
  const [nutritionSource, setNutritionSource] = useState("");
  const [nutritionLabelImage, setNutritionLabelImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [originalImageUrl, setOriginalImageUrl] = useState("");
  const options = unitsByCategory[category] || unitsByCategory.Groceries;
  const spec = options.find((x) => x.key === packKey) || options[0];
  useEffect(() => { if (!options.some((x) => x.key === packKey)) queueMicrotask(() => setPackKey(options[0].key)); }, [category, options, packKey]);

  const nutritionPresent = Object.values(nutrition).some((value) => Number(value) > 0);
  const nutritionConsistent = nutritionPresent && nutritionLooksConsistent(nutrition);
  const nutritionStatus: Product["nutritionStatus"] = confirmed && nutritionConsistent ? "Verified" : nutritionConsistent ? "Estimated" : "Pending review";
  const baseReady = Boolean(name.trim()) && price > 0 && Number.isInteger(stock) && stock > 0;
  const measurable = nutritionPresent && ["g","kg","ml","litre"].includes(spec.measure);
  const packBase = spec.measure === "kg" || spec.measure === "litre" ? spec.amount * 1000 : spec.amount;
  const per100 = measurable && packBase > 0 ? Object.fromEntries(Object.entries(nutrition).map(([key, value]) => [key, Math.round(Number(value) * 100 / packBase * 10) / 10])) as Nutrition : null;

  async function calculate() {
    if (!name.trim()) return toast.error("Enter the exact product name");
    setBusy(true);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ task: "nutrition", message: name, context: { productName: name, category, amount: spec.amount, measurementUnit: spec.measure, servingLabel: spec.label, nutritionSource }, imageBase64: nutritionLabelImage || undefined }),
      });
      const json = await response.json() as { result?: { nutritionAvailable?: boolean; nutrition?: Nutrition | null; confidence?: number; summary?: string; recommendedAction?: string }; error?: string };
      if (!response.ok) throw new Error(json.error || "Nutrition could not be estimated");
      const result = json.result;
      if (result?.nutritionAvailable && result.nutrition && nutritionLooksConsistent(result.nutrition)) {
        setNutrition(result.nutrition);
        setNutritionConfidence(Number(result.confidence || 0));
        setNutritionNote(result.summary || "Estimated for this selling pack. Verify against a label or recipe when possible.");
        setConfirmed(false);
        toast.success("Nutrition estimate added for this pack");
      } else {
        setNutritionConfidence(undefined);
        setNutritionNote(result?.summary || "Nutrition could not be estimated reliably from the information provided.");
        toast.info("Nutrition is pending. You can still publish this product.");
      }
    } catch (error) {
      setNutritionConfidence(undefined);
      setNutritionNote(error instanceof Error ? error.message : "Nutrition could not be estimated reliably.");
      toast.info("Nutrition is pending. You can still publish this product.");
    } finally { setBusy(false); }
  }

  function chooseImage(file?: File) {
    if (!file) return;
    readImage(file, (value) => { setOriginalImageUrl(value); setImageUrl(value); toast.success("Product image ready. You can publish it as-is or improve its presentation."); });
  }

  async function enhanceImage() {
    if (!imageUrl) return toast.error("Upload a product image first");
    if (!name.trim()) return toast.error("Enter the product name before image enhancement");
    setImageBusy(true);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/image-enhance", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ imageDataUrl: imageUrl, productName: name, category }) });
      const json = await response.json() as { imageDataUrl?: string; imageUrl?: string; error?: string };
      if (!response.ok) throw new Error(json.error || "Image enhancement failed");
      setImageUrl(json.imageDataUrl || json.imageUrl || imageUrl);
      toast.success("Marketplace image is ready. Review it before publishing.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Image enhancement failed"); }
    finally { setImageBusy(false); }
  }

  async function save() {
    if (!baseReady) return toast.error("Enter the product, price and whole pack stock");
    setBusy(true);
    try {
      const active = vendor.verification === "Verified";
      let publishedImage = imageUrl || undefined;
      if (publishedImage && isLiveSupabaseMode()) publishedImage = await uploadLiveProductImage(vendor.id, publishedImage);
      const statusForDb = nutritionStatus === "Verified" ? "verified" : nutritionStatus === "Estimated" ? "estimated" : "pending_review";
      const note = nutritionStatus === "Pending review" ? (nutritionNote || (nutritionPresent ? "Entered nutrition needs review." : "Nutrition was not supplied or could not be estimated reliably.")) : (nutritionNote || "Nutrition supplied for this selling pack.");
      const productId = isLiveSupabaseMode() ? await saveLiveVendorProduct({
        vendorId: vendor.id, name, category, unit: spec.label, price, stock, active,
        calories: nutrition.calories, protein: nutrition.protein, carbs: nutrition.carbs, fat: nutrition.fat, fibre: nutrition.fibre,
        dietaryTags: [], packAmount: spec.amount, packMeasure: spec.measure, imageUrl: publishedImage,
        nutritionStatus: statusForDb, nutritionConfidence, nutritionNote: note,
      }) : id("PRD");
      const product: Product = {
        id: productId, vendorId: vendor.id, name, category, emoji: spec.emoji, baseUnit: spec.label,
        quantityStep: 1, vendorPrice: price, stock, active, ...nutrition, dietaryTags: [], packAmount: spec.amount,
        packMeasure: spec.measure, imageUrl: publishedImage, originalImageUrl: originalImageUrl || undefined,
        nutritionStatus, nutritionConfidence, nutritionNote: note,
      };
      setState((current) => ({
        ...current,
        products: [product, ...current.products.filter((x) => x.id !== product.id)],
        markups: { ...current.markups, [product.id]: 0 },
        audit: [audit(session, "Published product pack", `${name} · ${spec.label} · nutrition ${nutritionStatus?.toLowerCase()}${publishedImage ? " · image attached" : ""}`), ...current.audit],
      }));
      if (nutritionStatus === "Pending review") {
        if (isLiveSupabaseMode()) {
          try { await notifyLiveNutritionReview({ productId, productName: name, reason: note }); } catch (error) { console.error("Nutrition review notification", error); }
        }
        toast.info("Product published. Operations has been flagged to review nutrition.");
      } else toast.success("Product pack saved");
      close();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Product could not be saved"); }
    finally { setBusy(false); }
  }

  const metrics: Array<[keyof Nutrition, string]> = [["calories","Calories"],["protein","Protein g"],["carbs","Carbs g"],["fat","Fat g"],["fibre","Fibre g"]];
  return <Dialog open={open} onOpenChange={(value) => !value && close()}><DialogContent className="sp-product-dialog max-h-[94vh] overflow-y-auto rounded-[26px] sm:max-w-4xl"><DialogHeader><DialogTitle className="text-lg font-black">Add a sellable product pack</DialogTitle><DialogDescription>Set the exact pack and price. Nutrition is helpful but not mandatory; uncertain or missing nutrition is automatically marked for Operations review.</DialogDescription></DialogHeader>
    <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
      <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Exact product name"><input value={name} onChange={(e) => { setName(e.target.value); setConfirmed(false); }} className={inputClass} placeholder="Example: Full cream cow milk" /></Field><Field label="Category"><Select value={category} onValueChange={(value) => { setCategory(value); setConfirmed(false); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categoryNames.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></Field><Field label="Customer selling pack" hint="Example: 250 ml pouch = one pack. Customers choose 1, 2, 3 packs."><Select value={spec.key} onValueChange={(value) => { setPackKey(value); setConfirmed(false); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map((x) => <SelectItem key={x.key} value={x.key}>{x.label}</SelectItem>)}</SelectContent></Select></Field><Field label={`Your price for one ${spec.label}`}><input type="number" min="1" value={price || ""} onChange={(e) => setPrice(Number(e.target.value))} className={inputClass} /></Field><Field label="Available sealed packs" hint={`20 = twenty ${spec.label} packs.`}><input type="number" min="1" step="1" value={stock || ""} onChange={(e) => setStock(Number(e.target.value))} className={inputClass} /></Field><div className="flex items-end"><Button onClick={calculate} disabled={busy} variant="outline" title="Calculate for this pack" className="h-11 w-full"><Sparkles />{busy ? "Calculating…" : "Calculate with She Agent"}</Button></div></div>
        <div className="rounded-[22px] border border-stone-200/80 bg-[#faf6f4] p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[.12em] text-stone-500">Nutrition source · optional</div><p className="mt-1 text-xs leading-5 text-stone-500">For a better estimate, paste package-label values or recipe/ingredient details, or upload a nutrition-label photo. You can also publish without nutrition.</p></div><Sparkles className="size-5 shrink-0 text-[#653046]" /></div><Textarea value={nutritionSource} onChange={(e) => setNutritionSource(e.target.value)} className="mt-3 min-h-20 rounded-xl bg-white" placeholder="Example: 250 g cooked rice, 120 g chicken, 15 g oil... or paste label text" /><label className="mt-3 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border bg-white px-3 text-sm font-black"><input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) readImage(file, setNutritionLabelImage); }} /><ImageUp className="size-4" />{nutritionLabelImage ? "Nutrition label attached" : "Upload nutrition-label photo"}</label></div>
        <div className="grid gap-4 lg:grid-cols-2"><div className={`rounded-2xl p-4 ${nutritionStatus === "Pending review" ? "bg-amber-50/80" : "bg-[#faf6f4]"}`}><div className={`text-xs font-black uppercase tracking-wider ${nutritionStatus === "Pending review" ? "text-amber-800" : "text-[#292124]"}`}>Per selected pack: {spec.label}</div><div className="mt-3 grid grid-cols-2 gap-2">{metrics.map(([key,label]) => <Field key={key} label={label}><input type="number" min="0" step="0.1" value={nutrition[key] || ""} placeholder="Optional" onChange={(e) => { setNutrition((x) => ({ ...x, [key]: Number(e.target.value || 0) })); setNutritionConfidence(undefined); setNutritionNote("Nutrition entered manually; Operations review may be required."); setConfirmed(false); }} className={inputClass} /></Field>)}</div></div><div className="surface-card rounded-[22px] p-4"><div className="flex items-center justify-between gap-2"><div className="text-xs font-black uppercase tracking-wider text-stone-500">Nutrition status</div><Status className={nutritionStatus === "Pending review" ? "border-amber-200 bg-amber-50 text-amber-800" : nutritionStatus === "Verified" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>{nutritionStatus}</Status></div>{nutritionConfidence !== undefined && <p className="mt-2 text-xs text-stone-500">Estimate confidence: {Math.round(nutritionConfidence)}%</p>}{nutritionNote && <p className="mt-2 text-sm leading-5 text-stone-600">{nutritionNote}</p>}{per100 ? <div className="mt-3 space-y-2 text-sm"><div className="text-[10px] font-black uppercase tracking-[.12em] text-stone-400">Comparable basis</div><Review label={`Calories / 100 ${["ml","litre"].includes(spec.measure) ? "ml" : "g"}`} value={`${per100.calories} kcal`} /><Review label="Protein" value={`${per100.protein} g`} /><Review label="Carbs" value={`${per100.carbs} g`} /><Review label="Fat" value={`${per100.fat} g`} /></div> : <p className="mt-3 text-sm text-stone-500">Nutrition can be left blank. Customers will see “Nutrition pending” until it is reviewed.</p>}{nutritionConsistent && <label className="mt-5 flex items-start gap-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><Switch checked={confirmed} onCheckedChange={setConfirmed} /><span><b>I verified these values.</b><br />I checked the estimate against the package label or recipe.</span></label>}</div></div>
      </div>
      <div className="surface-card-muted rounded-[28px] p-4"><div className="flex items-center justify-between"><div><div className="text-xs font-black uppercase tracking-[.14em] text-[#653046]">Product media</div><h3 className="mt-1 font-black">Marketplace image</h3></div><ImageUp className="text-[#653046]" /></div><div className="mt-4 grid aspect-square place-items-center overflow-hidden rounded-3xl shadow-inner" style={{ background: imageUrl ? undefined : categoryVisual(category).bg }}>{imageUrl ? <img src={imageUrl} alt="Product preview" className="h-full w-full object-cover" /> : <ProductGlyph category={category} iconClassName="size-12" />}</div><label className="mt-4 flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border bg-white text-sm font-black"><input type="file" accept="image/*" className="hidden" onChange={(e) => chooseImage(e.target.files?.[0])} /><ImageUp className="size-4" />Upload real product photo</label><Button onClick={enhanceImage} disabled={!imageUrl || imageBusy} variant="outline" className="mt-2 h-11 w-full rounded-xl"><Sparkles />{imageBusy ? "Enhancing…" : "AI enhance for marketplace"}</Button>{originalImageUrl && imageUrl !== originalImageUrl && <button onClick={() => setImageUrl(originalImageUrl)} className="mt-2 w-full text-center text-xs font-black text-stone-500">Restore original image</button>}<p className="mt-3 text-[11px] leading-5 text-stone-500">Image enhancement preserves the real product and pack while improving presentation. Review the result before publishing.</p></div>
    </div>
    {nutritionPresent && !nutritionConsistent && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">The entered calories and macros do not align. This does not block publishing; the product will be marked “Nutrition pending” and Operations will be notified.</div>}
    {!nutritionPresent && <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900"><b>Nutrition is optional.</b> Publish now if you do not have it. Operations will receive a review notification and the marketplace will show nutrition as pending.</div>}
    <Button onClick={save} disabled={!baseReady || busy} className="h-12 bg-[#753b50]"><Check />{busy ? "Publishing…" : "Publish product pack"}</Button>
  </DialogContent></Dialog>;
}

function VendorQuotes({ vendor, state, setState, session }: { vendor: Vendor; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; session: DemoSession }) { const opportunities = state.requirements.filter((x) => x.status === "Quoting" || x.status === "Quotes received").filter((x) => !x.invitedVendorIds?.length || x.invitedVendorIds.includes(vendor.id)); const [draft, setDraft] = useState<Record<string, number>>({}); function quote(req: Requirement) { if (req.closingDate && req.closingDate < new Date().toISOString().slice(0,10)) return toast.error("This RFQ is closed"); const total = draft[req.id]; if (!total) return toast.error("Enter your best total"); const item: Quote = { id: id("QTE"), requirementId: req.id, vendorId: vendor.id, total, deliveryFee: 0, note: "Best local price", status: "Submitted" }; setState((s) => ({ ...s, quotes: [item, ...s.quotes.filter((x) => !(x.vendorId === vendor.id && x.requirementId === req.id))], requirements: s.requirements.map((x) => x.id === req.id ? { ...x, status: "Quotes received" } : x), notifications: [notice(req.customerEmail, "customer", "Vendor accepted your RFQ", `${vendor.businessName} submitted ${money(total)}.`), ...s.notifications], audit: [audit(session, "Accepted RFQ and submitted quote", `${req.id} · ${money(total)}`), ...s.audit] })); toast.success("RFQ accepted and quotation submitted"); } return <div className="space-y-6"><Heading eyebrow="PREMIUM FEATURE" title="Local RFQ opportunities" body="Only RFQs explicitly matched to this vendor are visible. Submit an independent best price before the customer closing date." />{vendor.plan !== "Crown" ? <Empty icon={WalletCards} title="Quotation access is on the Crown plan" body="Ask Super Admin to assign the Crown plan for testing." /> : opportunities.length ? opportunities.map((req) => <div key={req.id} className="surface-card rounded-[28px] p-5"><div className="flex justify-between"><div><h3 className="font-black">{req.title}</h3><p className="text-xs text-stone-500">{req.items.length} items · closes {req.closingDate || "not set"} · needed {req.deliveryDate}</p></div><Status>{state.quotes.some((x) => x.requirementId === req.id && x.vendorId === vendor.id) ? "Accepted / quoted" : "Invited"}</Status></div><div className="mt-4 flex flex-wrap gap-2">{req.items.map((item) => <span key={item.id} className="rounded-full bg-stone-100 px-3 py-2 text-xs font-bold">{item.name} · {item.quantity} {item.unit}</span>)}</div><div className="mt-5 flex max-w-md gap-2"><input type="number" value={draft[req.id] || ""} onChange={(e) => setDraft((x) => ({ ...x, [req.id]: Number(e.target.value) }))} placeholder="Your best total ₹" className={inputClass} /><Button onClick={() => quote(req)} className="rounded-xl bg-[#753b50]">Accept & quote</Button></div></div>) : <Empty icon={ClipboardCheck} title="No RFQs matched to your store" body="Only serviceable customer requests sent to this vendor account will appear here." />}</div>; }

function DeliveryTeam({ vendor, state, setState, session }: { vendor: Vendor; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; session: DemoSession }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [editing, setEditing] = useState<Staff | null>(null);
  const people = state.staff.filter((x) => x.vendorId === vendor.id);
  async function savePerson() {
    if (!name || !/^\+?[0-9 ]{10,15}$/.test(phone)) return toast.error("Enter a staff name and valid phone number");
    try {
      let staffId = editing?.id || id("STF");
      if (isLiveSupabaseMode()) { const result = await saveLiveDeliveryStaff({ staffId: editing?.id, name, phone, active: editing?.active ?? true }); staffId = String(result.id); }
      if (editing) setState((s) => ({ ...s, staff: s.staff.map((x) => x.id === editing.id ? { ...x, id: staffId, name, phone } : x), audit: [audit(session, "Updated delivery staff", `${name} · ${phone}`), ...s.audit] }));
      else { const person: Staff = { id: staffId, vendorId: vendor.id, name, phone, active: true }; setState((s) => ({ ...s, staff: [person, ...s.staff], audit: [audit(session, "Added delivery staff", `${name} · ${phone}`), ...s.audit] })); }
      toast.success(editing ? "Delivery person updated" : "Delivery person added"); setName(""); setPhone(""); setEditing(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Delivery person could not be saved"); }
  }
  async function remove(person: Staff) {
    if (!confirm(`Delete ${person.name} from the delivery team? Existing completed-order history is retained.`)) return;
    try { if (isLiveSupabaseMode()) await deleteLiveDeliveryStaff(person.id); setState((s) => ({ ...s, staff: s.staff.filter((x) => x.id !== person.id), assignments: s.assignments.filter((x) => x.staffId !== person.id), audit: [audit(session, "Deleted delivery staff", `${person.name} · ${person.phone}`), ...s.audit] })); toast.success("Delivery person deleted"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Delivery person could not be deleted"); }
  }
  return <div className="space-y-6"><Heading eyebrow="DELIVERY ACCOUNTABILITY" title="Your delivery team" body="Add, edit or remove delivery people. Active staff can be assigned to upcoming delivery orders." />
    <div className="surface-card rounded-[28px] p-5"><div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Staff name" className={inputClass} /><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" className={inputClass} /><Button onClick={savePerson} className="h-11 rounded-xl bg-[#753b50]">{editing ? <Pencil /> : <Plus />}{editing ? "Save changes" : "Add staff"}</Button></div>{editing && <button onClick={() => { setEditing(null); setName(""); setPhone(""); }} className="mt-3 text-xs font-black text-stone-500">Cancel editing</button>}</div>
    {people.length ? <div className="grid gap-3 md:grid-cols-2">{people.map((person) => <div key={person.id} className="surface-card flex items-center gap-3 rounded-[22px] p-4"><div className="grid size-11 place-items-center rounded-full bg-[#f7edf0] font-black text-[#653046]">{person.name[0]}</div><div className="min-w-0 flex-1"><b className="block truncate">{person.name}</b><div className="text-xs text-stone-500">{person.phone}</div></div><button onClick={() => { setEditing(person); setName(person.name); setPhone(person.phone); }} className="grid size-9 place-items-center rounded-xl hover:bg-stone-100" title="Edit"><Pencil className="size-4" /></button><button onClick={() => remove(person)} className="grid size-9 place-items-center rounded-xl text-red-600 hover:bg-red-50" title="Delete"><Trash2 className="size-4" /></button><Switch checked={person.active} onCheckedChange={(value) => { void (async () => { try { if (isLiveSupabaseMode()) await saveLiveDeliveryStaff({ staffId: person.id, name: person.name, phone: person.phone, active: value }); setState((s) => ({ ...s, staff: s.staff.map((x) => x.id === person.id ? { ...x, active: value } : x) })); } catch (error) { toast.error(error instanceof Error ? error.message : "Staff status could not be changed"); } })(); }} /></div>)}</div> : <Empty icon={Truck} title="No delivery staff" body="Add the first delivery person above." />}
    <section className="surface-card rounded-3xl p-5"><h3 className="text-lg font-semibold">Today&apos;s assignments</h3>
      {(() => { const rows = state.orders.filter((o) => o.vendorId === vendor.id && o.payment === "Paid" && !["Completed", "Cancelled"].includes(o.status) && o.mode === "Vendor delivery").slice(0, 8); return rows.length ? <div className="mt-3 space-y-2">{rows.map((o) => { const a = state.assignments.find((x) => x.orderId === o.id); const who = state.staff.find((m) => m.id === a?.staffId); return <div key={o.id} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-[18px] bg-[#faf6f4] px-4 py-3 text-sm sm:grid-cols-[1.1fr_1fr_1.2fr_1fr_auto]"><b className="truncate">{o.id}</b><span>{o.slot}</span><span className="truncate text-[#4c4246]">{o.deliveryAddress || "Address on order"}</span><span className={who ? "font-medium" : "text-[#71676b]"}>{who?.name || "Not assigned"}</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${who ? "bg-[#edf3fd] text-[#285fba]" : "bg-[#FFF4CF] text-[#795900]"}`}>{who ? o.status : "Assign in Orders"}</span></div>; })}</div> : <p className="mt-3 rounded-2xl bg-[#faf6f4] p-4 text-sm text-[#71676b]">No open deliveries to assign right now.</p>; })()}
    </section>
    <p className="rounded-3xl bg-[#edf3fd] p-4 text-sm font-medium text-[#285fba]">Customers see the delivery person&apos;s first name and phone number only while their order is on the way.</p>
  </div>;
}

function Orders({ session, state, setState, scope, vendor }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; scope: "customer" | "vendor" | "operations"; vendor?: Vendor }) { const orders = scope === "customer" ? state.orders.filter((x) => x.customerEmail === session.email) : scope === "vendor" ? state.orders.filter((x) => x.vendorId === vendor?.id) : state.orders; function update(order: Order, status: Order["status"]) { const productVendor = state.vendors.find((x) => x.id === order.vendorId); setState((s) => ({ ...s, orders: s.orders.map((x) => x.id === order.id ? { ...x, status } : x), notifications: [notice(order.customerEmail, "customer", `Order ${status.toLowerCase()}`, `${order.description} is now ${status.toLowerCase()}.`), ...(productVendor ? [notice(productVendor.ownerEmail, "vendor", "Order updated", `${order.id} is ${status}.`)] : []), ...s.notifications], audit: [audit(session, "Updated order status", `${order.id} → ${status}`), ...s.audit] })); showDeviceNotification(`Order ${status}`, order.description); toast.success("Order status updated"); } function cancel(order: Order) { const reason = prompt("Why do you need to cancel this order?"); if (!reason) return; setState((s) => ({ ...s, orders: s.orders.map((x) => x.id === order.id ? { ...x, status: "Cancellation requested" } : x), cancellations: [{ id: id("CAN"), orderId: order.id, customerEmail: session.email, reason, aiDecision: "Eligible if before vendor preparation cut-off", confidence: 91, status: "Awaiting operations" }, ...s.cancellations], notifications: [notice("operations@sheplates.demo", "operations", "Cancellation needs review", `${order.id} was pre-screened by She Agent.`), ...s.notifications] })); toast.success("She Agent screened the request; Operations has the final decision"); } return <div className="space-y-6"><Heading eyebrow="ORDER CONTROL" title={scope === "customer" ? "Track your orders" : scope === "vendor" ? "Fulfil scheduled orders" : "Platform order tracking"} body="Every future order keeps a status, scheduled slot, payment state and accountable delivery person." />{orders.length ? <div className="surface-card overflow-x-auto rounded-[28px]"><Table><TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Schedule</TableHead><TableHead>Quantity</TableHead><TableHead>Status</TableHead><TableHead>Delivery person</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{orders.map((order) => { const assignment = state.assignments.find((x) => x.orderId === order.id); const person = state.staff.find((x) => x.id === assignment?.staffId); const available = state.staff.filter((x) => x.vendorId === order.vendorId && x.active); return <TableRow key={order.id}><TableCell><b className="font-mono text-xs">{order.id}</b><div className="text-xs text-stone-500">{order.description}</div></TableCell><TableCell><b>{order.date}</b><div className="text-xs text-stone-500">{order.slot}</div></TableCell><TableCell>{order.quantity} {order.unit}<div className="text-xs font-bold">{money(order.total)}</div></TableCell><TableCell><Status>{order.status}</Status><div className="mt-1 text-xs text-stone-500">{order.payment}</div></TableCell><TableCell>{scope === "vendor" ? <Select value={person?.id || "unassigned"} onValueChange={(staffId) => { if (staffId === "unassigned") return; const next: Assignment = { id: id("ASN"), orderId: order.id, staffId, assignedAt: now() }; setState((s) => ({ ...s, assignments: [next, ...s.assignments.filter((x) => x.orderId !== order.id)], notifications: [notice(order.customerEmail, "customer", "Delivery person assigned", `${state.staff.find((x) => x.id === staffId)?.name} will handle ${order.id}.`), ...s.notifications] })); }}><SelectTrigger className="w-44 rounded-xl"><SelectValue placeholder="Assign staff" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Not assigned</SelectItem>{available.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent></Select> : person ? <div><b>{person.name}</b><div className="text-xs text-[#653046]">{person.phone}</div></div> : <span className="text-xs text-stone-400">Not assigned</span>}</TableCell><TableCell className="text-right">{scope === "customer" ? <span className="text-xs font-bold text-stone-400">Contact Support to change</span> : <Select value={order.status} onValueChange={(value) => void update(order, value as Order["status"])}><SelectTrigger className="ml-auto w-44 rounded-lg"><SelectValue /></SelectTrigger><SelectContent>{["Scheduled", "Confirmed", "Preparing", "Ready", "Out for delivery", "Ready for pickup", "Completed"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>}</TableCell></TableRow>; })}</TableBody></Table></div> : <Empty icon={Package} title="No orders yet" body="Orders will appear when customers schedule a product or select a monthly quotation." />}</div>; }

function OperationsArea({ active, session, state, setState, navigate, openAgent }: { navigate: (page: string) => void; openAgent: () => void; active: string; session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  if (active === "AI insights") return <AIInsights role="operations" state={state} />;
  if (active === "P0 Connect vendors") return <P0VendorManagement role="operations" />;
  if (active === "Vendor onboarding") return <OperationsOnboard session={session} state={state} setState={setState} />;
  if (active === "Vendor verification") return <OperationsVerification session={session} state={state} setState={setState} />;
  if (active === "Store & radius") return <OperationsStoreRadius session={session} state={state} setState={setState} />;
  if (active === "Item pricing") return <ItemPricing session={session} state={state} setState={setState} />;
  if (active === "RFQ desk") return isLiveSupabaseMode() ? <LiveRfqDesk /> : <RFQDesk state={state} />;
  if (active === "Orders") return <OrdersV4 session={session} state={state} setState={setState} scope="operations" />;
  if (active === "Cancellations") return <Cancellations session={session} state={state} setState={setState} />;
  if (active === "Vendor payments") return <VendorPayments state={state} setState={setState} session={session} canManage />;
  if (active === "Reports") return <ReportsCentre state={state} />;
  if (active === "Stories monitor") return <StoriesMonitor />;
  if (active === "Ticket centre") return <TicketCentre session={session} state={state} setState={setState} mode="manage" />;
  const subscriptionVendors = state.vendors.filter((x) => x.vendorKind !== "p0_connect");
  const activeOrders = state.orders.filter((x) => !["Completed", "Cancelled"].includes(x.status)); const gmv = state.orders.reduce((sum, x) => sum + x.total, 0); const openVendors = subscriptionVendors.filter((x) => x.openToday && x.verification === "Verified").length;
  const todayStr = todayISO();
  const salesToday = state.orders.filter((x) => x.date === todayStr && x.status !== "Cancelled").reduce((sum, x) => sum + x.total, 0);
  const awaitingVerification = subscriptionVendors.filter((x) => ["Submitted", "Under review"].includes(x.verification));
  const unassigned = state.orders.filter((o) => !["Completed", "Cancelled"].includes(o.status) && o.mode === "Vendor delivery" && !state.assignments.some((a) => a.orderId === o.id));
  const cancelQueue = state.cancellations.filter((x) => x.status === "Awaiting operations");
  const openTickets = state.tickets.filter((t) => t.status !== "Resolved");
  const attention: { icon: typeof Store; tint: string; title: string; sub: string; go: string }[] = [
    ...unassigned.slice(0, 2).map((o) => ({ icon: AlertTriangle, tint: "bg-[#f7edf0]", title: `Order ${o.id} has no delivery partner`, sub: `${state.vendors.find((v) => v.id === o.vendorId)?.businessName || "Vendor"} · ${o.slot}`, go: "Orders" })),
    ...awaitingVerification.slice(0, 2).map((v) => ({ icon: BadgeCheck, tint: "bg-[#f7edf0]", title: `${v.businessName} is waiting for verification`, sub: "Review the certificate and approve or reject", go: "Vendor verification" })),
    ...cancelQueue.slice(0, 2).map((c) => ({ icon: RefreshCcw, tint: "bg-[#f7edf0]", title: `Cancellation request for ${c.orderId}`, sub: "Awaiting Operations review", go: "Cancellations" })),
    ...openTickets.slice(0, 2).map((t) => ({ icon: TicketCheck, tint: "bg-[#faf6f4]", title: t.subject, sub: `Ticket ${t.id} · ${t.status}`, go: "Ticket centre" })),
  ].slice(0, 5);
  const bySlot = Object.entries(activeOrders.reduce<Record<string, number>>((acc, o) => { acc[o.slot] = (acc[o.slot] || 0) + 1; return acc; }, {})).sort(([x], [y]) => x.localeCompare(y)).slice(0, 8).map(([label, value]) => ({ label: label.replace(/ to .*$/, ""), value }));
  return <div className="space-y-5">
    <Heading eyebrow="OPERATIONS COMMAND CENTRE" title="Live platform control" body={`${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · Verify vendors, track fulfilment and review cancellations`} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Active orders" value={String(activeOrders.length)} icon={ReceiptText} note={`${unassigned.length} without a delivery partner`} />
      <Metric label="Sales today" value={compactMoney(salesToday)} icon={IndianRupee} note={`${compactMoney(gmv)} in total`} />
      <Metric label="Verification queue" value={String(awaitingVerification.length)} icon={BadgeCheck} note={`${openVendors} vendors open today`} />
      <Metric label="Open tickets" value={String(openTickets.length)} icon={TicketCheck} note={`${cancelQueue.length} cancellation${cancelQueue.length === 1 ? "" : "s"} waiting`} />
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <section className="surface-card rounded-3xl p-5"><h3 className="text-lg font-semibold">Needs attention</h3>
        {attention.length ? <div className="mt-3 divide-y divide-[#e8dfe1]">{attention.map((item, i) => { const Icon = item.icon; return <div key={i} className="flex items-center gap-3 py-3"><div className={`grid size-11 shrink-0 place-items-center rounded-full ${item.tint}`}><Icon className="size-5" /></div><div className="min-w-0 flex-1"><div className="truncate text-[15px] font-semibold">{item.title}</div><div className="truncate text-xs text-[#71676b]">{item.sub}</div></div><Button size="sm" onClick={() => navigate(item.go)}>Open</Button></div>; })}</div> : <p className="mt-3 rounded-[18px] bg-[#faf6f4] p-4 text-sm text-[#71676b]">Nothing needs attention right now.</p>}</section>
      <div className="space-y-5">
        <section className="surface-card rounded-3xl p-5"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Orders by slot</h3><span className="text-xs text-[#71676b]">Active</span></div><div className="mt-4">{bySlot.length ? <BarChart data={bySlot} height={130} /> : <p className="text-sm text-[#71676b]">No active orders.</p>}</div></section>
        <section className="surface-card rounded-3xl p-5"><h3 className="text-lg font-semibold">She Agent for Operations</h3><p className="mt-1 text-xs text-[#71676b]">Ask across vendors, orders and delivery exceptions. It can recommend actions; final payment reversals remain human-controlled.</p><button type="button" onClick={openAgent} className="mt-3 flex h-12 w-full items-center justify-between rounded-full bg-[#faf6f4] px-5 text-left text-sm text-[#766b70]">Ask about today&apos;s late orders…<Send className="size-5" /></button></section>
      </div>
    </div>
  </div>;
}

function OperationsStoreRadius({ session, state, setState }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  const list = state.vendors.filter((vendor) => vendor.vendorKind !== "p0_connect");
  const [pickId, setPickId] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const shown = onlyOpen ? list.filter((vendor) => vendor.openToday) : list;
  const picked = shown.find((vendor) => vendor.id === pickId) || shown[0];
  return <div className="space-y-5">
    <Heading eyebrow="VENDOR COVERAGE" title="Store and radius" body="See every vendor's store pin and fix a wrong pin or radius on their behalf. Every change is written to the audit log with your name." />
    {list.length ? <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <div className="space-y-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setOnlyOpen(false)} className={`h-10 rounded-full px-4 text-sm font-semibold ${!onlyOpen ? "bg-[#753b50] text-white" : "bg-white"}`}>All vendors · {list.length}</button><button type="button" onClick={() => setOnlyOpen(true)} className={`h-10 rounded-full px-4 text-sm font-semibold ${onlyOpen ? "bg-[#753b50] text-white" : "bg-white"}`}>Open today · {list.filter((vendor) => vendor.openToday).length}</button></div>
        {shown.map((vendor) => <button key={vendor.id} type="button" onClick={() => setPickId(vendor.id)} aria-pressed={picked?.id === vendor.id} className={`block w-full rounded-3xl bg-white p-4 text-left ${picked?.id === vendor.id ? "ring-2 ring-[#753b50]" : "ring-1 ring-[#e8dfe1]"}`}><div className="flex items-start justify-between gap-2"><b>{vendor.businessName}</b><span className={`rounded-full px-3 py-1 text-xs font-semibold ${vendor.openToday ? "bg-[#eaf5ec] text-[#21683b]" : "bg-[#faf6f4] text-[#71676b]"}`}>{vendor.openToday ? "Open today" : "Closed"}</span></div><div className="mt-1 text-xs text-[#71676b]">{vendor.address || "Address not provided"} · {vendor.radiusKm} km</div></button>)}</div>
      {picked && <OperationsVendorRadius key={picked.id} vendor={picked} session={session} setState={setState} />}
    </div> : <Empty icon={Store} title="No vendors yet" body="Vendors appear here once they have a store pin." />}
  </div>;
}

function OperationsVendorRadius({ vendor, session, setState }: { vendor: Vendor; session: DemoSession; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  const [radius, setRadius] = useState(vendor.radiusKm);
  async function saveRadius() {
    try {
      if (isLiveSupabaseMode()) await updateLiveVendorControls(vendor.id, { service_radius_km: radius });
      setState((current) => ({
        ...current,
        vendors: current.vendors.map((item) => item.id === vendor.id ? { ...item, radiusKm: radius } : item),
        audit: [audit(session, "Updated vendor service radius", `${vendor.businessName} · ${radius} km`), ...current.audit],
      }));
      toast.success(`${vendor.businessName} service radius updated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Vendor service radius could not be saved");
    }
  }
  const hasPin = Number.isFinite(vendor.latitude) && Number.isFinite(vendor.longitude);
  return <div className="surface-card space-y-4 rounded-3xl p-5">
    <div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{vendor.businessName}</h3><p className="mt-1 text-xs text-stone-500">{vendor.address || "Address not provided"}</p></div><Status>{vendor.verification}</Status></div>
    <div className="text-xs text-stone-500">{hasPin ? `Store pin: ${vendor.latitude?.toFixed(5)}, ${vendor.longitude?.toFixed(5)}` : "No exact store pin saved"}</div>
    <Field label={`Service radius · ${radius} km`} hint="Customers within this distance of the vendor pin can be matched.">
      <Slider value={[radius]} min={1} max={30} step={1} onValueChange={(value) => setRadius(value[0])} />
    </Field>
    <Button onClick={() => void saveRadius()} disabled={radius === vendor.radiusKm} className="rounded-xl bg-[#753b50]"><Check />Save radius</Button>
  </div>;
}

function OperationsOnboard({ session, state, setState }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  const [open, setOpen] = useState(false);
  const vendors = state.vendors.filter((vendor) => vendor.vendorKind !== "p0_connect");
  return <div className="space-y-6"><Heading eyebrow="ASSISTED ONBOARDING" title="Create a vendor from Operations" body="Assign every vendor to an existing vendor login. After submission, the record stays visible below and appears to that exact vendor account." action={<Button onClick={() => setOpen(true)} className="rounded-xl bg-[#753b50]"><UserPlus />Start onboarding</Button>} />
    <div className="surface-card rounded-[22px] border border-sky-200/70 bg-sky-50/85 p-4 text-sm leading-6 text-sky-900"><b>Testing rule:</b> choose either <code>vendor@sheplates.demo</code> or <code>newvendor@sheplates.demo</code> in the onboarding form. Sign in with the selected account to see that vendor. The vendor remains unavailable to customers until Operations verifies it, the vendor opens the store, and at least one product is active.</div>
    {vendors.length ? <div className="surface-card overflow-x-auto rounded-[28px]"><Table><TableHeader><TableRow><TableHead>Created vendor</TableHead><TableHead>Assigned login</TableHead><TableHead>Location</TableHead><TableHead>Status</TableHead><TableHead>Customer visibility</TableHead></TableRow></TableHeader><TableBody>{vendors.map((vendor) => { const products = state.products.filter((item) => item.vendorId === vendor.id && item.active && item.stock > 0).length; const hasPin = Number.isFinite(vendor.latitude) && Number.isFinite(vendor.longitude); const visible = hasPin && vendor.verification === "Verified" && vendor.operational === "Active" && vendor.openToday && products > 0; return <TableRow key={vendor.id}><TableCell><b>{vendor.businessName}</b><div className="text-xs text-stone-500">{vendor.id}</div></TableCell><TableCell><Select value={vendor.ownerEmail} onValueChange={(email) => { const account = demoAccounts.find((item) => item.email === email)!; setState((current) => ({ ...current, vendors: current.vendors.map((item) => item.id === vendor.id ? { ...item, ownerEmail: email, ownerName: account.name } : item), audit: [audit(session, "Reassigned vendor login", `${vendor.businessName} → ${email}`), ...current.audit] })); toast.success(`Vendor assigned to ${email}`); }}><SelectTrigger className="w-60 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{demoAccounts.filter((account) => account.role === "vendor").map((account) => <SelectItem key={account.email} value={account.email}>{account.email}</SelectItem>)}</SelectContent></Select><div className="mt-1 text-xs text-stone-500">Sign in with this exact vendor account</div></TableCell><TableCell>{vendor.address}<div className="text-xs text-stone-500">{hasPin ? `${vendor.latitude?.toFixed(5)}, ${vendor.longitude?.toFixed(5)}` : "No store pin"} · {vendor.radiusKm} km radius</div></TableCell><TableCell><Status>{vendor.verification}</Status></TableCell><TableCell>{visible ? <span className="font-black text-[#292124]">Eligible by store status</span> : <span className="text-xs text-amber-700">Waiting: {!hasPin ? "exact store pin" : vendor.verification !== "Verified" ? "verification" : !vendor.openToday ? "store closed" : products === 0 ? "active product with stock" : "activation"}</span>}</TableCell></TableRow>; })}</TableBody></Table></div> : <Empty icon={UserPlus} title="No vendor has been created yet" body="Start onboarding and assign it to one of the existing vendor login identities." />}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[94vh] overflow-y-auto rounded-[28px] sm:max-w-5xl"><DialogHeader><DialogTitle className="sr-only">Operations vendor onboarding</DialogTitle><DialogDescription className="sr-only">Create a vendor application</DialogDescription></DialogHeader><VendorOnboarding operationsCreated session={session} setState={setState} close={() => setOpen(false)} /></DialogContent></Dialog></div>;
}
function OperationsVerification({ session, state, setState }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  const vendors = state.vendors.filter((vendor) => vendor.vendorKind !== "p0_connect");
  async function decide(vendor: Vendor, verification: Verification, note = "") {
    try {
      if (isLiveSupabaseMode()) { await decideLiveVendorVerification(vendor.id, verification.toLowerCase().replaceAll(" ", "_")); if (note.trim()) await sendVendorNote(vendor.id, note.trim()); }
      setState((s) => ({ ...s, vendors: s.vendors.map((x) => x.id === vendor.id ? { ...x, verification, operational: verification === "Verified" ? "Active" : "Inactive", openToday: verification === "Verified" ? x.openToday : false } : x), notifications: [notice(vendor.ownerEmail, "vendor", `Vendor ${verification.toLowerCase()}`, verification === "Verified" ? "Your store is approved. Open for the day and publish products." : note.trim() ? `Note from Operations: ${note.trim()}` : "Review the Operations decision in Verification."), ...s.notifications], audit: [audit(session, `Vendor ${verification.toLowerCase()}`, vendor.businessName), ...s.audit] }));
      toast.success(`${vendor.businessName}: ${verification} saved`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Verification decision could not be saved"); }
  }
  const [tab, setTab] = useState<"Submitted" | "Under review" | "Changes required" | "All">("All");
  const [pickedId, setPickedId] = useState("");
  const [vendorNote, setVendorNote] = useState("");
  const tabs = ["All", "Submitted", "Under review", "Changes required"] as const;
  const shown = tab === "All" ? vendors : vendors.filter((vendor) => vendor.verification === tab);
  const picked = shown.find((vendor) => vendor.id === pickedId) || shown[0];
  return <div className="space-y-5"><Heading eyebrow="VENDOR TRUST" title="Verification queue" body="Check each vendor's documents, location and radius before they can sell." />
    {vendors.length ? <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <div className="space-y-3"><div className="flex flex-wrap gap-2" role="tablist" aria-label="Verification status">{tabs.map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} onClick={() => { setTab(name); setPickedId(""); }} className={`h-10 rounded-full px-4 text-sm font-semibold ${tab === name ? "bg-[#753b50] text-white" : "bg-white text-[#4c4246]"}`}>{name} · {name === "All" ? vendors.length : vendors.filter((vendor) => vendor.verification === name).length}</button>)}</div>
        {shown.length ? shown.map((vendor) => <button key={vendor.id} type="button" onClick={() => setPickedId(vendor.id)} aria-pressed={picked?.id === vendor.id} className={`block w-full rounded-3xl bg-white p-4 text-left ${picked?.id === vendor.id ? "ring-2 ring-[#753b50]" : "ring-1 ring-[#e8dfe1]"}`}><div className="flex items-start justify-between gap-2"><b>{vendor.businessName}</b><span className={`rounded-full px-3 py-1 text-xs font-semibold ${vendor.verification === "Verified" ? "bg-[#eaf5ec] text-[#21683b]" : vendor.verification === "Rejected" ? "bg-[#fdecef] text-[#b42332]" : vendor.verification === "Changes required" ? "bg-[#FFF4CF] text-[#795900]" : "bg-[#edf3fd] text-[#285fba]"}`}>{vendor.verification}</span></div><div className="mt-1 text-xs text-[#71676b]">{vendor.category} · {vendor.address}</div></button>) : <p className="rounded-3xl bg-white p-4 text-sm text-[#71676b]">No vendors in this status.</p>}</div>
      {picked && <section className="surface-card h-fit space-y-4 rounded-3xl p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-xl font-semibold">{picked.businessName}</h3><p className="text-xs text-[#71676b]">Owner {picked.ownerName} · {picked.ownerEmail} · {picked.plan} plan</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">{picked.verification}</span></div>
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-white p-4 text-sm"><div className="flex items-center gap-2 font-semibold"><BadgeCheck className="size-5" />FSSAI</div><div className="mt-1 break-all text-xs text-[#71676b]">No. {picked.fssaiNumber || "not given"}</div><div className="text-xs text-[#71676b]">Expires {picked.expiryDate || "not given"}</div></div><div className="rounded-2xl bg-white p-4 text-sm"><div className="flex items-center gap-2 font-semibold"><FileCheck2 className="size-5" />Certificate file</div><div className="mt-1 break-all text-xs text-[#71676b]">{picked.certificateName || "No file uploaded"}</div></div><div className="rounded-2xl bg-white p-4 text-sm"><div className="flex items-center gap-2 font-semibold"><Truck className="size-5" />Service</div><div className="mt-1 text-xs text-[#71676b]">{[picked.delivery && "Delivery", picked.pickup && "Pickup"].filter(Boolean).join(" + ") || "No mode set"} · {picked.radiusKm} km radius</div></div></div>
        <MapPreview lat={picked.latitude} lng={picked.longitude} radius={picked.radiusKm} label={`Radius ${picked.radiusKm} km`} />
        {picked.verification !== "Verified" ? <div className="space-y-3"><label className="block text-sm font-semibold text-[#4c4246]">Note to the vendor<textarea value={vendorNote} onChange={(e) => setVendorNote(e.target.value)} maxLength={500} rows={3} placeholder="For example: please upload a clearer photo of the FSSAI page" className="mt-2 w-full rounded-3xl bg-white p-4 text-sm outline-none" /></label><div className="flex flex-wrap gap-2"><Button onClick={() => { void decide(picked, "Verified", vendorNote); setVendorNote(""); }}><BadgeCheck />Approve</Button><Button variant="outline" onClick={() => { void decide(picked, "Changes required", vendorNote); setVendorNote(""); }}>Ask for changes</Button><Button variant="outline" onClick={() => { void decide(picked, "Rejected", vendorNote); setVendorNote(""); }} className="text-[#b42332]">Reject</Button></div><p className="text-xs text-[#71676b]">The vendor receives your note as a notification.</p></div> : <p className="rounded-2xl bg-[#eaf5ec] p-3 text-sm font-medium text-[#21683b]">This vendor is verified and can sell.</p>}
      </section>}
    </div> : <Empty icon={FileCheck2} title="Verification queue is empty" body="A self-onboarded or Operations-created vendor will appear here." />}</div>;
}
function ItemPricing({ session, state, setState }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) { const [vendorId, setVendorId] = useState(state.vendors[0]?.id || ""); const [q, setQ] = useState(""); const [onlyCustom, setOnlyCustom] = useState(false); const products = state.products.filter((x) => x.vendorId === vendorId).filter((x) => !q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase())).filter((x) => !onlyCustom || (state.markups[x.id] || 0) > 0); const customCount = state.products.filter((x) => (state.markups[x.id] || 0) > 0).length; return <div className="space-y-6"><Heading eyebrow="ITEM-LEVEL PRICING" title="Operational percentage by vendor item" body="Select a vendor, inspect its menu and add a percentage on top of each vendor base price. Customer prices update only for future schedules." /><div className="grid gap-4 sm:grid-cols-3"><Metric label="Items on the platform" value={String(state.products.length)} icon={Package} /><Metric label="Items with their own %" value={String(customCount)} icon={Percent} /><Metric label="Vendors" value={String(state.vendors.length)} icon={Store} /></div><div className="surface-card flex flex-wrap items-center gap-3 rounded-3xl p-4"><Select value={vendorId} onValueChange={setVendorId}><SelectTrigger className="w-full max-w-sm rounded-xl"><SelectValue placeholder="Select vendor" /></SelectTrigger><SelectContent>{state.vendors.map((x) => <SelectItem key={x.id} value={x.id}>{x.businessName}</SelectItem>)}</SelectContent></Select><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item" aria-label="Search item" className="h-11 min-w-0 flex-1 rounded-full bg-white px-4 text-sm" /><button type="button" onClick={() => setOnlyCustom(false)} className={`h-10 rounded-full px-4 text-sm font-semibold ${!onlyCustom ? "bg-[#753b50] text-white" : "bg-white"}`}>All</button><button type="button" onClick={() => setOnlyCustom(true)} className={`h-10 rounded-full px-4 text-sm font-semibold ${onlyCustom ? "bg-[#753b50] text-white" : "bg-white"}`}>Custom %</button></div>{products.length ? <div className="surface-card overflow-x-auto rounded-[28px]"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Vendor base</TableHead><TableHead>Operations %</TableHead><TableHead>Customer price</TableHead></TableRow></TableHeader><TableBody>{products.map((product) => <TableRow key={product.id}><TableCell><b>{product.name}</b><div className="text-xs text-stone-500">per {product.baseUnit}</div></TableCell><TableCell>{money(product.vendorPrice)}</TableCell><TableCell><div className="flex items-center gap-2"><input type="number" min="0" max="100" step=".5" value={state.markups[product.id] || 0} onChange={(e) => { const value = Number(e.target.value); setState((s) => ({ ...s, markups: { ...s.markups, [product.id]: value }, audit: [audit(session, "Updated item percentage", `${product.name} → ${value}%`), ...s.audit] })); }} className="h-10 w-24 rounded-xl border px-3 font-black" />%</div></TableCell><TableCell className="text-lg font-bold">{money(finalPrice(product, state))}</TableCell></TableRow>)}</TableBody></Table></div> : <Empty icon={Percent} title="No vendor products selected" body="Choose a vendor with products, or wait for a vendor to add their catalogue." />}</div>; }
function RFQDesk({ state }: { state: V3State }) {
  const open = state.requirements.filter((x) => x.status === "Quoting" || x.status === "Quotes received");
  const awarded = state.requirements.filter((x) => x.status === "Awarded");
  const needsAttention = open.filter((x) => !(x.invitedVendorIds || []).length);
  const pill = (status: string) => status === "Awarded" ? "bg-[#faf6f4] text-[#4c4246]" : status === "Quotes received" ? "bg-[#eaf5ec] text-[#21683b]" : status === "Quoting" ? "bg-[#edf3fd] text-[#285fba]" : "bg-[#FFF4CF] text-[#795900]";
  return <div className="space-y-5"><Heading eyebrow="RFQ CONTROL" title="Monthly requirement desk" body="Every customer requirement, who was invited and who quoted." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Open RFQs" value={String(open.length)} icon={ClipboardCheck} /><Metric label="Quotes received" value={String(state.quotes.length)} icon={ReceiptText} /><Metric label="Awarded" value={String(awarded.length)} icon={BadgeCheck} /><Metric label="Need attention" value={String(needsAttention.length)} icon={AlertTriangle} note={needsAttention.length ? "No vendor was invited" : undefined} /></div>
    {state.requirements.length ? <div className="surface-card overflow-x-auto rounded-3xl"><Table><TableHeader><TableRow><TableHead>Requirement</TableHead><TableHead>Customer</TableHead><TableHead>Invited</TableHead><TableHead>Quoted</TableHead><TableHead>Closes</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{state.requirements.map((req) => <TableRow key={req.id}><TableCell><b>{req.title}</b><div className="text-xs text-[#71676b]">{req.id} · {req.items.length} items</div></TableCell><TableCell className="text-sm">{req.customerEmail}</TableCell><TableCell>{(req.invitedVendorIds || []).length ? `${(req.invitedVendorIds || []).length} Crown vendors` : <span className="rounded-full bg-[#fdecef] px-3 py-1 text-xs font-semibold text-[#b42332]">0 vendors</span>}</TableCell><TableCell>{state.quotes.filter((x) => x.requirementId === req.id).length}</TableCell><TableCell>{req.closingDate || "Not set"}</TableCell><TableCell><span className={`rounded-full px-3 py-1 text-xs font-semibold ${pill(req.status)}`}>{req.status}</span></TableCell></TableRow>)}</TableBody></Table></div> : <Empty icon={ClipboardCheck} title="No RFQs yet" body="Customer monthly requirements will appear here." />}
    <p className="flex items-start gap-3 rounded-3xl bg-[#FFF4CF] p-4 text-sm font-medium text-[#795900]"><AlertTriangle className="mt-0.5 size-5 shrink-0" />Only vendors on the Crown plan whose own radius covers the customer are invited. If none are invited, ask a nearby vendor to upgrade or contact the customer.</p></div>; }
function Cancellations({ session, state, setState }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [view, setView] = useState<"open" | "decided">("open");
  const openItems = state.cancellations.filter((x) => x.status === "Awaiting operations");
  const decidedItems = state.cancellations.filter((x) => x.status !== "Awaiting operations");
  const listed = view === "open" ? openItems : decidedItems;
  function decide(item: Cancellation, status: "Approved" | "Rejected") {
    const order = state.orders.find((x) => x.id === item.orderId);
    const transaction = state.transactions.find((x) => x.orderId === item.orderId);
    const isQuality = item.kind === "quality_complaint";
    const refundAmount = Math.max(0, Math.min(order?.total ?? Infinity, amounts[item.id] ?? item.recommendedRefundAmount ?? order?.total ?? 0));
    const fullRefund = order ? refundAmount >= order.total : true;
    setState((s) => ({
      ...s,
      cancellations: s.cancellations.map((x) => x.id === item.id ? { ...x, status, recommendedRefundAmount: isQuality ? refundAmount : x.recommendedRefundAmount } : x),
      orders: s.orders.map((x) => x.id === item.orderId ? {
        ...x,
        status: status === "Approved" ? (isQuality ? x.status : "Cancelled") : (isQuality ? x.status : "Confirmed"),
        payment: status === "Approved" && transaction ? (isQuality && !fullRefund ? "Reversal pending" : "Reversal pending") : x.payment,
      } : x),
      transactions: status === "Approved" && transaction ? s.transactions.map((x) => {
        if (x.id !== transaction.id) return x;
        if (x.payoutStatus === "Paid") return { ...x, note: `Already paid to vendor — recover ${money(refundAmount)} manually` };
        if (isQuality && !fullRefund) return { ...x, vendorPayout: Math.max(0, Math.round((x.vendorPayout - refundAmount) * 100) / 100), note: `Vendor payout reduced by ${money(refundAmount)} for an approved quality-complaint refund` };
        return { ...x, payoutStatus: "Reversed", note: isQuality ? "Voided: full refund approved for quality complaint" : "Voided: order cancelled before payout" };
      }) : s.transactions,
      notifications: order ? [
        notice(order.customerEmail, "customer", `${isQuality ? "Quality complaint" : "Cancellation"} ${status.toLowerCase()}`, status === "Approved" ? `Operations approved a refund of ${money(refundAmount)}; it is now processing.` : "Operations reviewed this and did not approve a refund."),
        ...s.notifications,
      ] : s.notifications,
      audit: [audit(session, `${status} ${isQuality ? "quality complaint" : "cancellation"}`, `${item.orderId}${status === "Approved" ? ` · refund ${money(refundAmount)}` : ""}`), ...s.audit],
    }));
    toast.success(`${isQuality ? "Quality complaint" : "Cancellation"} ${status.toLowerCase()}`);
  }
  return <div className="space-y-6"><Heading eyebrow="AI-ASSISTED REVIEW" title="Cancellations & quality-complaint refunds" body="She Agent checks evidence — including a customer-attached photo for quality complaints — and proposes a decision and refund amount first. Operations always owns the final call." /><div className="flex flex-wrap gap-2" role="tablist" aria-label="Decision status"><button type="button" role="tab" aria-selected={view === "open"} onClick={() => setView("open")} className={`h-10 rounded-full px-4 text-sm font-semibold ${view === "open" ? "bg-[#753b50] text-white" : "bg-white text-[#4c4246]"}`}>Awaiting decision · {openItems.length}</button><button type="button" role="tab" aria-selected={view === "decided"} onClick={() => setView("decided")} className={`h-10 rounded-full px-4 text-sm font-semibold ${view === "decided" ? "bg-[#753b50] text-white" : "bg-white text-[#4c4246]"}`}>Decided · {decidedItems.length}</button></div><p className="rounded-3xl bg-[#FFF4CF] p-4 text-sm font-medium text-[#795900]">Refunds are human-approved. She Agent can recommend but never moves money. Customers cannot cancel after a vendor accepts: those requests come through Support.</p>{listed.length ? listed.map((item) => { const order = state.orders.find((x) => x.id === item.orderId); const isQuality = item.kind === "quality_complaint"; return <div key={item.id} className="surface-card rounded-[26px] p-5"><div className="flex flex-col gap-4 lg:flex-row"><div className={`grid size-12 place-items-center rounded-2xl ${isQuality ? "bg-amber-50 text-amber-700" : "bg-[#f7edf0] text-[#653046]"}`}><Activity /></div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><b>{item.orderId}</b><Status>{item.status}</Status><Status className={isQuality ? "border-amber-200 bg-amber-50 text-amber-800" : ""}>{isQuality ? "Quality complaint" : "Cancellation"}</Status>{item.attachmentName && <Status>📷 {item.attachmentName}</Status>}</div><p className="mt-2 text-sm text-stone-500">Customer: {item.reason}</p><div className="mt-3 rounded-2xl bg-[#faf6f4] p-3 text-sm"><b>She Agent: {item.aiDecision}</b> · {item.confidence}% confidence</div>{order && <p className="mt-2 text-xs text-stone-400">Order total {money(order.total)} · current payment {order.payment}</p>}</div>{item.status === "Awaiting operations" && <div className="flex flex-col gap-2 lg:items-end"><Field label="Refund amount (₹)"><input type="number" min={0} max={order?.total ?? undefined} value={amounts[item.id] ?? item.recommendedRefundAmount ?? order?.total ?? 0} onChange={(e) => setAmounts((a) => ({ ...a, [item.id]: Number(e.target.value) }))} className={`${inputClass} w-40`} /></Field><div className="flex gap-2"><Button variant="outline" onClick={() => decide(item, "Rejected")} className="rounded-xl">Reject</Button><Button onClick={() => decide(item, "Approved")} className="rounded-xl bg-[#753b50]">{isQuality ? "Approve refund" : "Approve & reverse"}</Button></div></div>}</div></div>; }) : <Empty icon={RefreshCcw} title="No cancellation or quality-complaint reviews" body="Customer requests screened by She Agent — including photo-backed quality complaints — will appear here." />}</div>;
}

function vendorPayoutSummary(state: V3State, vendorId: string) {
  const rows = state.transactions.filter((x) => x.vendorId === vendorId);
  const gross = rows.reduce((sum, x) => sum + x.grossAmount, 0);
  const commission = rows.reduce((sum, x) => sum + x.commissionAmount, 0);
  const paidOut = rows.filter((x) => x.payoutStatus === "Paid").reduce((sum, x) => sum + x.vendorPayout, 0);
  const pending = rows.filter((x) => x.payoutStatus === "Scheduled").reduce((sum, x) => sum + x.vendorPayout, 0);
  const overdue = rows.filter((x) => x.payoutStatus === "Scheduled" && x.scheduledPayoutDate <= todayISO());
  const nextPayoutDate = rows.filter((x) => x.payoutStatus === "Scheduled").map((x) => x.scheduledPayoutDate).sort()[0];
  return { rows, gross, commission, paidOut, pending, overdueCount: overdue.length, nextPayoutDate };
}

function VendorSettlements({ vendor, state }: { vendor: Vendor; state: V3State }) {
  const summary = vendorPayoutSummary(state, vendor.id);
  return <div className="space-y-6"><Heading eyebrow="PAYMENTS" title="Settlements & payouts" body="Every customer payment collected on your orders, the platform commission retained and exactly when the remaining amount reaches you." /><div className="rounded-3xl bg-[#753b50] p-5 text-white"><div className="text-xs font-semibold">Next payout{summary.nextPayoutDate ? ` · ${summary.nextPayoutDate}` : ""}</div><div className="mt-1 text-[40px] font-bold leading-tight tabular-nums">{money(summary.pending)}</div><div className="text-xs font-medium">{summary.pending > 0 ? "Paid every Wednesday for completed orders from the previous Monday to Sunday." : "Nothing is waiting to be paid out right now."}</div></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Total collected" value={money(summary.gross)} icon={IndianRupee} tone="green" /><Metric label="Already paid to you" value={money(summary.paidOut)} icon={CheckCircle2} tone="blue" /><Metric label="Pending payout" value={money(summary.pending)} icon={WalletCards} tone="amber" note={summary.nextPayoutDate ? `Next: ${summary.nextPayoutDate}` : undefined} /><Metric label="Platform commission" value={money(summary.commission)} icon={Percent} tone="violet" note={`${PLATFORM_COMMISSION_PERCENT}% per order`} /></div>{summary.overdueCount > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mr-2 inline size-4" />{summary.overdueCount} payout(s) have reached their scheduled date and are awaited from Operations.</div>}{summary.rows.length ? <div className="surface-card overflow-x-auto rounded-[28px]"><Table><TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Collected</TableHead><TableHead>Gross</TableHead><TableHead>Commission</TableHead><TableHead>Your payout</TableHead><TableHead>Status</TableHead><TableHead>Expected / paid on</TableHead></TableRow></TableHeader><TableBody>{summary.rows.map((row) => <TableRow key={row.id}><TableCell className="font-mono text-xs">{row.orderId}</TableCell><TableCell>{row.collectedAt}</TableCell><TableCell>{money(row.grossAmount)}</TableCell><TableCell>{money(row.commissionAmount)}</TableCell><TableCell className="font-black">{money(row.vendorPayout)}</TableCell><TableCell><Status className={row.payoutStatus === "Paid" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : row.payoutStatus === "Reversed" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"}>{row.payoutStatus}</Status></TableCell><TableCell>{row.paidAt || row.scheduledPayoutDate}</TableCell></TableRow>)}</TableBody></Table></div> : <Empty icon={WalletCards} title="No payments yet" body="Payouts appear here once a customer pays for one of your orders." />}</div>;
}

function VendorPayments({ state, setState, session, canManage }: { state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; session: DemoSession; canManage: boolean }) {
  const rows = state.vendors.map((vendor) => ({ vendor, ...vendorPayoutSummary(state, vendor.id) })).filter((row) => row.rows.length > 0);
  const totals = rows.reduce((acc, row) => ({ gross: acc.gross + row.gross, commission: acc.commission + row.commission, pending: acc.pending + row.pending, paidOut: acc.paidOut + row.paidOut }), { gross: 0, commission: 0, pending: 0, paidOut: 0 });
  function markPaid(vendorId: string) {
    const due = state.transactions.filter((x) => x.vendorId === vendorId && x.payoutStatus === "Scheduled" && x.scheduledPayoutDate <= todayISO());
    if (!due.length) return toast.error("No payouts have reached their scheduled date yet");
    const vendor = state.vendors.find((x) => x.id === vendorId);
    const total = due.reduce((sum, x) => sum + x.vendorPayout, 0);
    setState((s) => ({
      ...s,
      transactions: s.transactions.map((x) => due.some((d) => d.id === x.id) ? { ...x, payoutStatus: "Paid", paidAt: todayISO() } : x),
      notifications: vendor ? [notice(vendor.ownerEmail, "vendor", "Payout sent", `${money(total)} across ${due.length} order(s) was marked paid.`), ...s.notifications] : s.notifications,
      audit: [audit(session, "Marked vendor payout as paid", `${vendor?.businessName || vendorId} · ${money(total)} · ${due.length} order(s)`), ...s.audit],
    }));
    toast.success(`${money(total)} marked paid to ${vendor?.businessName || "vendor"}`);
  }
  function downloadLedger() {
    downloadWorkbook("sheplates-vendor-payments", [{
      name: "Vendor payments",
      rows: rows.flatMap((row) => row.rows.map((t) => ({ Vendor: row.vendor.businessName, "Order ID": t.orderId, "Collected on": t.collectedAt, "Gross amount": t.grossAmount, "Commission %": t.commissionPercent, "Commission amount": t.commissionAmount, "Vendor payout": t.vendorPayout, "Payout status": t.payoutStatus, "Expected / paid date": t.paidAt || t.scheduledPayoutDate }))),
    }]);
  }
  return <div className="space-y-6"><Heading eyebrow="VENDOR SETTLEMENTS" title="Vendor-wise income & payouts" body={canManage ? "See exactly what each vendor earned, the platform's commission profit, and release payouts once they reach their scheduled date." : "Read-only oversight of vendor income, platform profit and payout status across the marketplace."} action={<Button variant="outline" onClick={downloadLedger} className="rounded-xl"><Download />Download Excel</Button>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Total collected (GMV)" value={money(totals.gross)} icon={IndianRupee} /><Metric label="Platform profit (commission)" value={money(totals.commission)} icon={Percent} /><Metric label="Pending vendor payouts" value={money(totals.pending)} icon={WalletCards} /><Metric label="Already paid to vendors" value={money(totals.paidOut)} icon={CheckCircle2} /></div>
    {rows.length ? <div className="surface-card overflow-x-auto rounded-[28px]"><Table><TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead>Income (gross)</TableHead><TableHead>Platform profit</TableHead><TableHead>Paid to vendor</TableHead><TableHead>Pending payout</TableHead><TableHead>Next payout</TableHead><TableHead>Status</TableHead>{canManage && <TableHead>Action</TableHead>}</TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.vendor.id}><TableCell><b>{row.vendor.businessName}</b><div className="text-xs text-stone-500">{row.vendor.ownerEmail}</div></TableCell><TableCell className="font-black">{money(row.gross)}</TableCell><TableCell className="text-[#653046] font-black">{money(row.commission)}</TableCell><TableCell>{money(row.paidOut)}</TableCell><TableCell>{money(row.pending)}</TableCell><TableCell>{row.nextPayoutDate || "—"}</TableCell><TableCell>{row.overdueCount > 0 ? <Status className="border-amber-200 bg-amber-50 text-amber-800">Payout due</Status> : row.pending > 0 ? <Status className="border-sky-200 bg-sky-50 text-sky-700">Scheduled</Status> : <Status className="border-emerald-200 bg-emerald-50 text-emerald-700">Paid up</Status>}</TableCell>{canManage && <TableCell><Button size="sm" disabled={row.overdueCount === 0} onClick={() => markPaid(row.vendor.id)} className="rounded-xl bg-[#753b50] disabled:opacity-40"><WalletCards />Mark payout paid</Button></TableCell>}</TableRow>)}</TableBody></Table></div> : <Empty icon={WalletCards} title="No vendor payments yet" body="Vendor income and payouts will appear here once customers start paying for orders." />}
  <p className="rounded-3xl bg-[#edf3fd] p-4 text-sm font-medium text-[#285fba]">Operations and Super Admin see the same figures. Vendors see only their own row in Settlements.</p></div>;
}

function AdminArea({ active, session, state, setState }: { active: string; session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  if (active === "AI insights") return <AIInsights role="admin" state={state} />;
  if (active === "P0 Connect vendors") return <P0VendorManagement role="admin" />;
  if (active === "Orders") return <OrdersV4 session={session} state={state} setState={setState} scope="operations" />;
  if (active === "Homepage & campaigns") return <HomepageCampaigns session={session} state={state} setState={setState} />;
  if (active === "Users") return <UsersView session={session} state={state} setState={setState} />;
  if (active === "Vendors") return <AdminVendors state={state} setState={setState} />;
  if (active === "Vendor plans") return <Plans state={state} setState={setState} />;
  if (active === "Pricing policies") return <AdminPricing state={state} />;
  if (active === "Stories monitor") return <StoriesMonitor />;
  if (active === "Ticket centre") return <TicketCentre session={session} state={state} setState={setState} mode="oversight" />;
  if (active === "Vendor payments") return <VendorPayments state={state} setState={setState} session={session} canManage={false} />;
  if (active === "Reports") return <ReportsCentre state={state} />;
  if (active === "Audit log") return <AuditLog items={state.audit} />;
  const revenue = state.orders.reduce((sum, x) => sum + x.total, 0), markup = state.products.reduce((sum, x) => sum + (finalPrice(x, state) - x.vendorPrice), 0);
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const since = (() => { const d = new Date(); d.setDate(d.getDate() - range); return localDateISO(d); })();
  const inRange = state.orders.filter((x) => x.date >= since && x.status !== "Cancelled");
  const gross = inRange.reduce((sum, x) => sum + x.total, 0);
  const days = lastDays(14).map((d) => ({ label: d.label, value: state.orders.filter((x) => x.date === d.key && x.status !== "Cancelled").reduce((sum, x) => sum + x.total, 0) }));
  const planFees: Record<string, number> = { Taster: 499, Crave: 699, Thrive: 799, Crown: 999 };
  const planCounts = Object.keys(planFees).map((plan) => ({ plan, count: state.vendors.filter((v) => v.plan === plan && v.vendorKind !== "p0_connect").length }));
  const maxPlan = Math.max(1, ...planCounts.map((x) => x.count));
  const subscription = planCounts.reduce((sum, x) => sum + x.count * planFees[x.plan], 0);
  const connectCount = state.vendors.filter((v) => v.vendorKind === "p0_connect").length;
  const awaiting = state.vendors.filter((x) => ["Submitted", "Under review"].includes(x.verification)).length;
  const attention = [awaiting ? `${awaiting} vendor${awaiting === 1 ? " is" : "s are"} waiting for verification` : "", state.cancellations.filter((x) => x.status === "Awaiting operations").length ? `${state.cancellations.filter((x) => x.status === "Awaiting operations").length} cancellation(s) waiting for Operations` : "", state.tickets.filter((t) => t.status !== "Resolved").length ? `${state.tickets.filter((t) => t.status !== "Resolved").length} open support ticket(s)` : ""].filter(Boolean);
  return <div className="space-y-5">
    <Heading eyebrow="SUPER ADMIN" title="Executive view" body={`The health of ShePlates at a glance · last ${range} days`} action={<div className="flex items-center gap-1 rounded-full bg-white p-1">{([[7, "7 days"], [30, "30 days"], [90, "Quarter"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setRange(value)} aria-pressed={range === value} className={`h-9 rounded-full px-4 text-sm font-semibold ${range === value ? "bg-[#753b50] text-white" : "text-[#71676b]"}`}>{label}</button>)}</div>} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Gross sales" value={compactMoney(gross)} icon={IndianRupee} note={`${compactMoney(revenue)} all time`} />
      <Metric label="Orders" value={String(inRange.length)} icon={ReceiptText} note={`${state.orders.filter((x) => x.status === "Completed").length} completed`} />
      <Metric label="Active customers" value={String(state.customers.length)} icon={Users} />
      <Metric label="Active vendors" value={String(state.vendors.length)} icon={Store} note={`${connectCount} Connect · ${planCounts.reduce((sum, x) => sum + x.count, 0)} on a plan`} />
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
      <section className="surface-card rounded-3xl p-5"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Sales by day</h3><span className="text-xs text-[#71676b]">last 14 days</span></div><div className="mt-4"><BarChart data={days} height={200} /></div></section>
      <div className="space-y-5">
        <section className="surface-card rounded-3xl p-5"><h3 className="text-lg font-semibold">Vendors by plan</h3><div className="mt-3 space-y-3">{planCounts.map(({ plan, count }) => <div key={plan}><div className="flex items-center justify-between text-sm"><span>{plan} · ₹{planFees[plan]}</span><b>{count}</b></div><div className="mt-1 h-2 rounded-full bg-[#faf6f4]"><div className="h-2 rounded-full" style={{ width: `${Math.round((count / maxPlan) * 100)}%`, background: plan === "Crown" ? "#292124" : plan === "Taster" ? "#e8cbd5" : "#753b50" }} /></div></div>)}</div></section>
        <div className="rounded-3xl bg-[#753b50] p-5 text-white"><div className="text-xs font-medium">Subscription revenue this month</div><div className="mt-1 text-[32px] font-bold leading-tight tabular-nums">{money(subscription)}</div><div className="text-xs font-medium">+ GST · plus commission on sales</div></div>
      </div>
    </div>
    {attention.length > 0 && <div className="flex items-start gap-3 rounded-3xl bg-[#FFF4CF] p-4 text-sm text-[#795900]"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><span>Needs your attention: {attention.join(" · ")}.</span></div>}
  </div>;
}
function HomepageCampaigns({ session, state, setState }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [prefill, setPrefill] = useState<Partial<Campaign> | null>(null);
  const [pickQuery, setPickQuery] = useState(""), [pickVendor, setPickVendor] = useState("all");
  const [suggestions, setSuggestions] = useState<Array<{ name: string; audience: string; offer: string; rationale: string; channel: string }>>([]);
  const eligibleProducts = state.products.filter((product) => product.active && product.stock > 0).slice(0, 80);
  const featured = state.merchandising.featuredProductIds;
  const pickable = eligibleProducts.filter((product) => (pickVendor === "all" || product.vendorId === pickVendor) && (!pickQuery.trim() || product.name.toLowerCase().includes(pickQuery.trim().toLowerCase())));
  async function saveHome(next = state.merchandising) {
    // Persist first: the UI must not show a featured product as saved when the write
    // actually failed (this previously happened silently whenever platform_settings
    // was missing/unreachable — the toggle looked successful and reverted on next load
    // with no explanation).
    if (isLiveSupabaseMode()) {
      try { await saveLiveMarketplaceHome(next); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Marketplace settings could not be saved"); return; }
    }
    setState((current) => ({ ...current, merchandising: next, merchandisingError: null, audit: [audit(session, "Updated customer marketplace merchandising", `${next.featuredProductIds.length} featured products · AI popup ${next.recommendationPopupEnabled ? "on" : "off"}`), ...current.audit] }));
    toast.success(isLiveSupabaseMode() ? "Marketplace home settings saved" : "Marketplace home settings saved locally");
  }
  function toggleFeatured(productId: string) {
    const already = featured.includes(productId);
    if (!already && featured.length >= state.merchandising.maxFeatured) return toast.error(`Choose up to ${state.merchandising.maxFeatured} featured products`);
    const next = { ...state.merchandising, featuredProductIds: already ? featured.filter((id) => id !== productId) : [...featured, productId] };
    void saveHome(next);
  }
  async function generateCampaigns() {
    setBusy(true);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ task: "campaign_strategy", message: "Analyse current marketplace and purchase behaviour and suggest responsible campaigns for useful customer segments.", role: "admin" }) });
      const json = await response.json() as { result?: { campaigns?: Array<{ name: string; audience: string; offer: string; rationale: string; channel: string }> }; error?: string };
      if (!response.ok) throw new Error(json.error || "AI campaign analysis failed");
      const result = json.result?.campaigns || [];
      if (result.length) setSuggestions(result);
      else {
        const topCategory = [...state.products].sort((a,b) => b.stock - a.stock)[0]?.category || "Groceries";
        setSuggestions([{ name: `${topCategory} discovery`, audience: `Customers who have not purchased ${topCategory} recently`, offer: "Personalised discovery bundle or limited introductory offer", rationale: "Uses non-sensitive commerce behaviour only and gives customers a relevant reason to explore an available category.", channel: "In-app + WhatsApp opt-in" }]);
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "Campaign suggestions could not be generated"); }
    finally { setBusy(false); }
  }
  /** Save a campaign: to the database first in live mode (so a failure is never shown as saved), then to local data. */
  async function saveCampaign(campaign: Campaign) {
    const known = state.campaigns.some((item) => item.id === campaign.id);
    let final = campaign;
    if (isLiveSupabaseMode()) {
      const liveId = await saveLiveCampaign({ id: known ? campaign.id : undefined, name: campaign.name, audience: campaign.audience, offer: campaign.offer, channel: campaign.channel, status: campaign.status, aiRationale: campaign.aiRationale, headline: campaign.headline, subline: campaign.subline, emoji: campaign.emoji, ctaLabel: campaign.ctaLabel, targetType: campaign.targetType, targetValue: campaign.targetValue, segment: campaign.segment, startsAt: campaign.startsAt, endsAt: campaign.endsAt, priority: campaign.priority });
      final = { ...campaign, id: liveId };
    }
    setState((current) => ({ ...current, campaigns: known ? current.campaigns.map((item) => (item.id === campaign.id ? final : item)) : [final, ...current.campaigns], audit: [audit(session, known ? "Updated campaign" : "Created campaign", `${final.name} · ${final.status}`), ...current.audit] }));
  }
  async function setCampaignStatus(campaign: Campaign, status: Campaign["status"]) {
    const next = { ...campaign, status };
    if (isLiveSupabaseMode()) await saveLiveCampaign({ id: campaign.id, name: campaign.name, audience: campaign.audience, offer: campaign.offer, channel: campaign.channel, status, aiRationale: campaign.aiRationale, headline: campaign.headline || campaign.name, subline: campaign.subline, emoji: campaign.emoji, ctaLabel: campaign.ctaLabel, targetType: campaign.targetType, targetValue: campaign.targetValue, segment: campaign.segment, startsAt: campaign.startsAt, endsAt: campaign.endsAt, priority: campaign.priority });
    setState((current) => ({ ...current, campaigns: current.campaigns.map((item) => item.id === campaign.id ? next : item), audit: [audit(session, status === "Active" ? "Campaign went live" : `Campaign ${status.toLowerCase()}`, campaign.name), ...current.audit] }));
  }
  async function removeCampaign(campaign: Campaign) {
    if (isLiveSupabaseMode()) await deleteLiveCampaign(campaign.id);
    setState((current) => ({ ...current, campaigns: current.campaigns.filter((item) => item.id !== campaign.id), audit: [audit(session, "Deleted campaign", campaign.name), ...current.audit] }));
  }
  return <div className="space-y-7"><Heading eyebrow="MARKETPLACE GROWTH" title="Homepage & campaigns" body="Super Admin controls which products are featured on the customer marketplace, can create offers manually, and can ask AI to propose behaviour-based campaigns. AI never sends a campaign automatically; a human approves every activation." action={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setPrefill(null); setCreateOpen(true); }} className="rounded-xl"><Plus />Create campaign</Button><Button onClick={generateCampaigns} disabled={busy} className="rounded-xl bg-[#292124]"><Sparkles />{busy ? "Analysing…" : "AI suggest campaigns"}</Button></div>} />
    {state.merchandisingError && <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><div><b>Homepage merchandising is not connected to the database.</b><p className="mt-1 leading-5">Featuring a product will not save and featured products will not appear to customers until this is fixed. Ask an engineer to run <code className="rounded bg-red-100 px-1 py-0.5 font-mono text-xs">supabase/V4_6_AGENTIC_COMMERCE.sql</code> in the Supabase SQL Editor. Database says: “{state.merchandisingError}”.</p></div></div>}
    <div className="grid items-start gap-5 xl:grid-cols-[1.15fr_.85fr]"><section className="surface-card rounded-[28px] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-black">Customer home merchandising</h3><p className="mt-1 text-sm text-stone-500">Feature up to {state.merchandising.maxFeatured} active products. Featured products appear before algorithmic recommendations.</p></div><label className="flex items-center gap-2 rounded-full bg-[#f7edf0] px-3 py-2 text-xs font-black text-[#653046]"><Switch checked={state.merchandising.recommendationPopupEnabled} onCheckedChange={(value) => void saveHome({ ...state.merchandising, recommendationPopupEnabled: value })} />AI recommendation popup</label></div><div className="mt-4 flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#753b50] px-4 py-2 text-sm font-semibold text-white">Featured · {featured.length} of {state.merchandising.maxFeatured}</span><input value={pickQuery} onChange={(e) => setPickQuery(e.target.value)} placeholder="Search products" aria-label="Search products to feature" className="h-10 min-w-0 flex-1 rounded-full bg-[#faf6f4] px-4 text-sm outline-none" /><Select value={pickVendor} onValueChange={setPickVendor}><SelectTrigger aria-label="Filter by vendor" className="h-10 w-48 rounded-full bg-[#faf6f4]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All vendors</SelectItem>{state.vendors.filter((v) => eligibleProducts.some((p) => p.vendorId === v.id)).map((v) => <SelectItem key={v.id} value={v.id}>{v.businessName}</SelectItem>)}</SelectContent></Select></div><div className="mt-4 grid max-h-[560px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">{pickable.map((product) => { const selected = featured.includes(product.id); const vendor = state.vendors.find((item) => item.id === product.vendorId); return <button key={product.id} data-testid="featured-toggle" onClick={() => toggleFeatured(product.id)} className={`rounded-[22px] border p-3 text-left transition ${selected ? "border-[#753b50] bg-[#f7edf0] ring-2 ring-[#753b50]/10" : "bg-white hover:border-stone-300"}`}><div className="flex items-center gap-3"><div className="grid size-12 place-items-center overflow-hidden rounded-xl" style={{ background: product.imageUrl ? undefined : categoryVisual(product.category).bg }}>{product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" /> : <ProductGlyph category={product.category} />}</div><div className="min-w-0 flex-1"><div className="line-clamp-2 font-black leading-tight">{product.name}</div><div className="truncate text-xs text-stone-500">{vendor?.businessName || "Vendor"} · {money(finalPrice(product, state))}</div></div><span className={`grid size-6 place-items-center rounded-full ${selected ? "bg-[#753b50] text-white" : "border"}`}>{selected ? <Check className="size-3" /> : <Plus className="size-3" />}</span></div></button>; })}</div>{!eligibleProducts.length && <Empty icon={ShoppingBag} title="No active products" body="Verify vendors and publish products before choosing homepage features." />}</section>
      <section className="surface-dark rounded-[28px] p-6 text-white"><Megaphone className="text-[#e8cbd5]" /><h3 className="mt-4 text-xl font-black">AI campaign guardrails</h3><p className="mt-2 text-sm leading-6 text-white/60">Campaign suggestions use commerce behaviour such as category affinity, purchase recency, frequency and budget bands. ShePlates does not ask AI to infer sensitive personal traits. Every draft requires Super Admin approval before activation.</p><div className="mt-5 space-y-2 text-xs text-white/70"><div className="rounded-xl bg-white/8 p-3">✓ Behavioural segmentation only</div><div className="rounded-xl bg-white/8 p-3">✓ Offers remain editable</div><div className="rounded-xl bg-white/8 p-3">✓ No automatic send or payment action</div></div></section></div>
    {suggestions.length > 0 && <section><div className="flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#653046]">AI suggestions</p><h3 className="mt-1 text-lg font-black">Campaign drafts to consider</h3></div><button onClick={() => setSuggestions([])} className="text-xs font-black text-stone-500">Clear suggestions</button></div><div className="mt-4 grid gap-4 lg:grid-cols-3">{suggestions.map((suggestion, index) => <div key={`${suggestion.name}-${index}`} className="surface-card rounded-[26px] p-5"><div className="flex items-center gap-2"><Sparkles className="size-4 text-[#653046]" /><Status>AI proposed</Status></div><h4 className="mt-3 text-lg font-black">{suggestion.name}</h4><div className="mt-4 space-y-3 text-sm"><Review label="Audience" value={suggestion.audience} /><Review label="Offer" value={suggestion.offer} /><Review label="Channel" value={suggestion.channel} /></div><p className="mt-4 rounded-xl bg-[#faf6f4] p-3 text-xs leading-5 text-stone-600">{suggestion.rationale}</p><Button onClick={() => { setPrefill({ name: suggestion.name, offer: suggestion.offer, channel: suggestion.channel, aiRationale: suggestion.rationale }); setCreateOpen(true); }} className="mt-4 w-full rounded-xl bg-[#753b50]"><Plus />Edit and use</Button></div>)}</div></section>}
    <CampaignManager campaigns={state.campaigns} categories={MARKET_GROUPS.map((group) => group.key)} vendors={state.vendors.filter((v) => v.verification === "Verified").map((v) => ({ id: v.id, name: v.businessName }))} products={eligibleProducts.map((p) => ({ id: p.id, name: p.name, vendor: state.vendors.find((v) => v.id === p.vendorId)?.businessName || "Vendor" }))} createOpen={createOpen} onCreateOpenChange={setCreateOpen} prefill={prefill} onPrefillUsed={() => setPrefill(null)} onSave={saveCampaign} onStatus={setCampaignStatus} onDelete={removeCampaign} />
  </div>;
}

function UsersView({ session, state, setState }: { session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  const [open, setOpen] = useState(false);
  const live = isSupabaseConfigured();
  const [roleTab, setRoleTab] = useState<"All" | "Customers" | "Vendors" | "Operations" | "Super Admin">("All");
  const [viewing, setViewing] = useState<CustomerProfile | null>(null);
  function openCustomer(email: string) {
    const customer = state.customers.find((c) => c.email === email);
    if (!customer) return;
    setViewing(customer);
    void logCustomerView(email, "Users");
    setState((current) => ({ ...current, audit: [audit(session, "Viewed customer details", email), ...current.audit] }));
  }
  const [userQuery, setUserQuery] = useState("");
  const roster = [
    ...state.customers.map((c) => ({ key: `c-${c.email}`, name: c.email.split("@")[0], email: c.email, role: "Customers" as const, active: true })),
    ...state.vendors.filter((v) => v.vendorKind !== "p0_connect").map((v) => ({ key: `v-${v.id}`, name: v.ownerName || v.businessName, email: v.ownerEmail, role: "Vendors" as const, active: v.operational === "Active" })),
    ...state.staffAccounts.map((a) => ({ key: `s-${a.id}`, name: a.name, email: a.email, role: (a.role === "admin" ? "Super Admin" : "Operations") as "Super Admin" | "Operations", active: a.active })),
  ];
  const shownUsers = roster.filter((u) => (roleTab === "All" || u.role === roleTab) && (!userQuery.trim() || `${u.name} ${u.email}`.toLowerCase().includes(userQuery.trim().toLowerCase())));
  return <div className="space-y-6">
    <Heading eyebrow="ACCESS" title="Team & user access" body="Customers, vendors and the ShePlates team. Only Super Admin can create logins for the Operations team from this portal." action={<Button onClick={() => setOpen(true)}><UserCog />Create user</Button>} />
    <div className="surface-card rounded-[22px] border border-sky-200/70 bg-sky-50/85 p-4 text-sm leading-6 text-sky-900">{live ? "Live account access is connected — new users are created as active role-based accounts." : "Live account access is not connected in this deployment, so new users are created as local test accounts for testing."}</div>
    <section className="surface-card rounded-3xl p-5"><div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Role">{(["All", "Customers", "Vendors", "Operations", "Super Admin"] as const).map((name) => <button key={name} type="button" role="tab" aria-selected={roleTab === name} onClick={() => setRoleTab(name)} className={`h-10 rounded-full px-4 text-sm font-semibold ${roleTab === name ? "bg-[#753b50] text-white" : "bg-white text-[#4c4246]"}`}>{name} · {name === "All" ? roster.length : roster.filter((u) => u.role === name).length}</button>)}<input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Search name or email" aria-label="Search name or email" className="ml-auto h-10 w-full max-w-xs rounded-full bg-white px-4 text-sm" /></div>
      {shownUsers.length ? <div className="mt-3 space-y-2">{shownUsers.slice(0, 80).map((u) => <div key={u.key} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-[18px] bg-white px-4 py-3 text-sm sm:grid-cols-[1.2fr_1.6fr_auto_auto]"><span className="flex items-center gap-2 font-semibold"><span className="grid size-8 place-items-center rounded-full bg-[#e8cbd5] text-xs font-bold">{(u.name || "?").slice(0, 1).toUpperCase()}</span>{u.name}</span><span className="truncate text-[#4c4246]">{u.email}</span><span className="rounded-full bg-[#faf6f4] px-3 py-1 text-xs font-semibold">{u.role === "Customers" ? "Customer" : u.role === "Vendors" ? "Vendor" : u.role}</span><span className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${u.active ? "bg-[#eaf5ec] text-[#21683b]" : "bg-[#FFF4CF] text-[#795900]"}`}>{u.active ? "Active" : "Inactive"}</span>{u.role === "Customers" && <button type="button" onClick={() => openCustomer(u.email)} className="h-8 rounded-full bg-[#faf6f4] px-3 text-xs font-semibold">View details</button>}</span></div>)}</div> : <p className="mt-3 rounded-2xl bg-white p-4 text-sm text-[#71676b]">No users match.</p>}
      <p className="mt-3 rounded-2xl bg-[#edf3fd] p-3 text-xs font-medium text-[#285fba]">Customer data is visible only to authorised roles. Every time customer details are opened, it is recorded in the audit log.</p></section>
    <Dialog open={!!viewing} onOpenChange={(value) => !value && setViewing(null)}><DialogContent className="max-h-[90vh] overflow-y-auto rounded-[28px] sm:max-w-lg"><DialogHeader><DialogTitle className="text-xl font-bold">Customer details</DialogTitle><DialogDescription>This view was recorded in the audit log.</DialogDescription></DialogHeader>{viewing && <div className="space-y-2 text-sm">{[["Email", viewing.email], ["Phone", viewing.phone || "Not given"], ["Default address", viewing.address || "Not given"], ["Household size", String(viewing.householdSize)], ["Diet", viewing.diet || "No preference"], ["Allergies", viewing.allergies.join(", ") || "None"], ["Goals", viewing.goals.join(", ") || "None"], ["Dislikes", viewing.dislikes || "None"]].map(([k, v]) => <div key={k} className="flex justify-between gap-4 rounded-2xl bg-[#faf6f4] px-4 py-3"><span className="text-[#71676b]">{k}</span><b className="text-right">{v}</b></div>)}</div>}</DialogContent></Dialog>
    <div className="surface-card overflow-x-auto rounded-[28px]"><div className="p-5 pb-0 text-sm font-black">Team accounts created from this portal</div>{state.staffAccounts.length ? <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Created by</TableHead><TableHead>Created</TableHead><TableHead>Mode</TableHead></TableRow></TableHeader><TableBody>{state.staffAccounts.map((account) => <TableRow key={account.id}><TableCell><b>{account.name}</b></TableCell><TableCell>{account.email}</TableCell><TableCell className="capitalize">{account.role}</TableCell><TableCell>{account.createdBy}</TableCell><TableCell>{account.createdAt}</TableCell><TableCell><Status className={account.mode === "live" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>{account.mode === "live" ? "Live account" : "Local test"}</Status></TableCell></TableRow>)}</TableBody></Table> : <div className="p-5"><Empty icon={UserCog} title="No team users created yet" body="Use Create user to give Operations teammates their own login." /></div>}</div>
    <div className="surface-card overflow-x-auto rounded-[28px]"><div className="p-5 pb-0 text-sm font-black">Demo login identities (testing only)</div><Table><TableHeader><TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Purpose</TableHead><TableHead>Password</TableHead></TableRow></TableHeader><TableBody>{demoAccounts.map((account) => <TableRow key={account.email}><TableCell><b>{account.name}</b><div className="text-xs text-stone-500">{account.email}</div></TableCell><TableCell className="capitalize">{account.role}</TableCell><TableCell>{account.detail}</TableCell><TableCell className="font-mono text-xs">{account.password}</TableCell></TableRow>)}</TableBody></Table></div>
    <CreateUserDialog open={open} close={() => setOpen(false)} session={session} setState={setState} live={live} />
  </div>;
}

function CreateUserDialog({ open, close, session, setState, live }: { open: boolean; close: () => void; session: DemoSession; setState: React.Dispatch<React.SetStateAction<V3State>>; live: boolean }) {
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [role, setRole] = useState<"operations" | "admin">("operations"), [busy, setBusy] = useState(false);
  const [issuedPassword, setIssuedPassword] = useState<{ email: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState(true);
  async function create() {
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email)) return toast.error("Enter a valid name and email address");
    setBusy(true);
    try {
      let password: string;
      let mode: "live" | "local";
      if (live) {
        const result = await createStaffUser({ name: name.trim(), email: email.trim().toLowerCase(), role });
        password = result.temporaryPassword; mode = "live";
      } else {
        password = generatePassword(); mode = "local";
        const existing = readLocalStaffAccounts();
        if (existing.some((x) => x.email.toLowerCase() === email.trim().toLowerCase())) throw new Error("A local test account with this email already exists");
        writeLocalStaffAccounts([...existing, { id: id("USR"), email: email.trim().toLowerCase(), name: name.trim(), role, password, createdBy: session.email, createdAt: now(), mode: "local", active: true }]);
      }
      const account: StaffAccount = { id: id("USR"), email: email.trim().toLowerCase(), name: name.trim(), role, createdBy: session.email, createdAt: now(), mode, active: true };
      setState((s) => ({ ...s, staffAccounts: [account, ...s.staffAccounts], audit: [audit(session, "Created team user", `${account.name} · ${account.email} · ${role}`), ...s.audit] }));
      setIssuedPassword({ email: account.email, password });
      toast.success(`${account.email} created as ${role}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "User could not be created"); }
    finally { setBusy(false); }
  }
  function reset() { setName(""); setEmail(""); setRole("operations"); setIssuedPassword(null); setShowPassword(true); close(); }
  return <Dialog open={open} onOpenChange={(value) => !value && reset()}><DialogContent className="rounded-[26px] sm:max-w-md"><DialogHeader><DialogTitle className="text-xl font-black">Create a team user</DialogTitle><DialogDescription>Only Super Admin can create Operations (or additional Super Admin) logins.</DialogDescription></DialogHeader>
    {issuedPassword ? <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle2 className="mb-2 inline size-5" /><p><b>{issuedPassword.email}</b> was created.</p><p className="mt-1">Share this temporary password securely — it will not be shown again.</p></div>
      <div className="surface-card-muted flex items-center gap-2 rounded-xl p-3 font-mono text-sm"><span className="flex-1">{showPassword ? issuedPassword.password : "•".repeat(issuedPassword.password.length)}</span><button onClick={() => setShowPassword((v) => !v)}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button><button onClick={() => { navigator.clipboard?.writeText(issuedPassword.password); toast.success("Password copied"); }}><Copy className="size-4" /></button></div>
      <Button onClick={reset} className="h-11 w-full rounded-xl bg-[#753b50] font-black">Done</Button>
    </div> : <div className="space-y-4">
      <Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} /></Field>
      <Field label="Work email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} /></Field>
      <Field label="Role"><Select value={role} onValueChange={(v) => setRole(v as "operations" | "admin")}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="operations">Operations</SelectItem><SelectItem value="admin">Super admin</SelectItem></SelectContent></Select></Field>
      <Button onClick={() => void create()} disabled={busy} className="h-11 w-full rounded-xl bg-[#753b50] font-black">{busy ? "Creating…" : "Create user"}</Button>
    </div>}
  </DialogContent></Dialog>;
}
function AdminVendors({ state, setState }: { state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) {
  const allVendors = state.vendors.filter((vendor) => vendor.vendorKind !== "p0_connect");
  const [vTab, setVTab] = useState<"All" | "Verified" | "Under review" | "Paused">("All");
  const [vQuery, setVQuery] = useState("");
  const vendors = allVendors.filter((vendor) => (vTab === "All" || (vTab === "Verified" ? vendor.verification === "Verified" : vTab === "Under review" ? ["Submitted", "Under review", "Changes required"].includes(vendor.verification) : vendor.operational === "Paused" || !vendor.openToday)) && (!vQuery.trim() || `${vendor.businessName} ${vendor.ownerEmail}`.toLowerCase().includes(vQuery.trim().toLowerCase())));
  return <div className="space-y-6"><Heading eyebrow="VENDOR GOVERNANCE" title="All vendors" body="Inspect verification, operating mode, radius, product count and subscription plan." /><div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Vendor status">{(["All", "Verified", "Under review", "Paused"] as const).map((name) => <button key={name} type="button" role="tab" aria-selected={vTab === name} onClick={() => setVTab(name)} className={`h-10 rounded-full px-4 text-sm font-semibold ${vTab === name ? "bg-[#753b50] text-white" : "bg-white text-[#4c4246]"}`}>{name} · {allVendors.filter((vendor) => name === "All" || (name === "Verified" ? vendor.verification === "Verified" : name === "Under review" ? ["Submitted", "Under review", "Changes required"].includes(vendor.verification) : vendor.operational === "Paused" || !vendor.openToday)).length}</button>)}<input value={vQuery} onChange={(e) => setVQuery(e.target.value)} placeholder="Search vendor or owner" aria-label="Search vendor or owner" className="ml-auto h-10 w-full max-w-xs rounded-full bg-white px-4 text-sm" /></div>{vendors.length ? <div className="surface-card overflow-x-auto rounded-[28px]"><Table><TableHeader><TableRow><TableHead>Vendor</TableHead><TableHead>Trust</TableHead><TableHead>Daily service</TableHead><TableHead>Products</TableHead><TableHead>Plan</TableHead></TableRow></TableHeader><TableBody>{vendors.map((vendor) => <TableRow key={vendor.id}><TableCell><b>{vendor.businessName}</b><div className="text-xs text-stone-500">{vendor.ownerEmail}</div></TableCell><TableCell><Status>{vendor.verification}</Status></TableCell><TableCell>{vendor.openToday ? "Open" : "Closed"} · {vendor.radiusKm} km</TableCell><TableCell>{state.products.filter((x) => x.vendorId === vendor.id).length}</TableCell><TableCell><Select value={vendor.plan} onValueChange={(value) => { const plan = value as Vendor["plan"]; setState((s) => ({ ...s, vendors: s.vendors.map((x) => x.id === vendor.id ? { ...x, plan } : x) })); if (isLiveSupabaseMode()) void saveLiveVendorPlan(vendor.id, plan.toLowerCase() as "taster" | "crave" | "thrive" | "crown").then(() => toast.success(`${vendor.businessName} moved to ${plan}`)).catch((error: Error) => { setState((s) => ({ ...s, vendors: s.vendors.map((x) => x.id === vendor.id ? { ...x, plan: vendor.plan } : x) })); toast.error(error.message || "Could not save the plan change"); }); }}><SelectTrigger className="w-32 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{["Taster", "Crave", "Thrive", "Crown"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></TableCell></TableRow>)}</TableBody></Table></div> : <Empty icon={Store} title="No vendors" body="Self-onboard a vendor or ask Operations to create one." />}</div>;
}
function PlanFeatureTable() {
  const plans = ["Taster", "Crave", "Thrive", "Crown"];
  const rows: [string, boolean[]][] = [
    ["Business information, description, catalogue", [true, true, true, true]],
    ["Leads through WhatsApp", [true, false, false, false]],
    ["Pre-orders, subscriptions, delivery fleet", [false, true, true, true]],
    ["Food Shorts (Food Stories)", [false, true, true, true]],
    ["Food Drops", [false, false, true, true]],
    ["Request for Quote with AI assistance", [false, false, false, true]],
  ];
  return <section className="surface-card overflow-x-auto rounded-3xl p-5"><h3 className="text-lg font-semibold">What each plan includes</h3><table className="mt-3 w-full min-w-[520px] border-separate border-spacing-y-2 text-sm"><thead><tr className="text-left text-xs uppercase tracking-[.06em] text-[#71676b]"><th className="px-3 py-1 font-semibold">Feature</th>{plans.map((plan) => <th key={plan} className="px-3 py-1 text-center font-semibold">{plan}</th>)}</tr></thead><tbody>{rows.map(([feature, has]) => <tr key={feature}><td className="rounded-l-[18px] bg-[#faf6f4] px-3 py-3 font-medium">{feature}</td>{has.map((yes, i) => <td key={plans[i]} className={`bg-[#faf6f4] px-3 py-3 text-center ${i === 3 ? "rounded-r-[18px]" : ""}`}>{yes ? <span aria-label="Included" className="inline-grid size-6 place-items-center rounded-full bg-[#753b50]"><Check className="size-4" /></span> : <span aria-label="Not included" className="text-[#766b70]">No</span>}</td>)}</tr>)}</tbody></table></section>;
}
function Plans({ state, setState }: { state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) { return <div className="space-y-6"><Heading eyebrow="VENDOR SUBSCRIPTIONS" title="Vendor plans" body="Monthly rates are exclusive of GST. Taster is the WhatsApp listing plan; Crave, Thrive and Crown are the ordering plans." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ name: "Taster", price: 499, text: "Business listing, catalogue and leads through WhatsApp. No platform commission." }, { name: "Crave", price: 699, text: "Pre-orders, subscriptions, delivery fleet management and Food Stories." }, { name: "Thrive", price: 799, text: "Everything in Crave, plus daily Food Drops." }, { name: "Crown", price: 999, text: "Everything in Thrive, plus Request for Quote (RFQ) with AI assistance." }].map((plan) => <div key={plan.name} className="surface-card rounded-[28px] p-6"><div className="flex justify-between"><h3 className="text-xl font-black">{plan.name}</h3></div><div className="mt-5 text-lg font-black">{money(plan.price)}<span className="text-sm font-bold text-stone-500"> / month + GST</span></div><p className="mt-3 text-sm leading-6 text-stone-500">{plan.text}</p><p className="mt-2 text-xs font-semibold text-[#71676b]">{state.vendors.filter((v) => v.plan === plan.name && v.vendorKind !== "p0_connect").length} vendor(s) on this plan</p></div>)}</div><PlanFeatureTable /><AdminVendors state={state} setState={setState} /></div>; }
function AdminPricing({ state }: { state: V3State }) {
  const [vendorId, setVendorId] = useState("all"), [q, setQ] = useState(""), [onlyCustom, setOnlyCustom] = useState(false);
  const pct = (id: string) => state.markups[id] || 0;
  const rows = state.products.filter((x) => vendorId === "all" || x.vendorId === vendorId).filter((x) => !q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase())).filter((x) => !onlyCustom || pct(x.id) > 0);
  const custom = state.products.filter((x) => pct(x.id) > 0);
  const average = custom.length ? custom.reduce((sum, x) => sum + pct(x.id), 0) / custom.length : 0;
  return <div className="space-y-6"><Heading eyebrow="PRICING GOVERNANCE" title="Published item percentages" body="Operations owns per-item percentages; Super Admin can inspect the full policy footprint." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Items on the platform" value={String(state.products.length)} icon={Package} /><Metric label="Items with their own %" value={String(custom.length)} icon={Percent} /><Metric label="Average % on those items" value={`${average.toFixed(1)}%`} icon={Activity} /><Metric label="Vendors" value={String(state.vendors.length)} icon={Store} /></div>
    <div className="surface-card flex flex-wrap items-center gap-3 rounded-3xl p-4"><Select value={vendorId} onValueChange={setVendorId}><SelectTrigger aria-label="Vendor" className="w-full max-w-xs rounded-xl"><SelectValue placeholder="All vendors" /></SelectTrigger><SelectContent><SelectItem value="all">All vendors</SelectItem>{state.vendors.map((x) => <SelectItem key={x.id} value={x.id}>{x.businessName}</SelectItem>)}</SelectContent></Select><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item" aria-label="Search item" className="h-11 min-w-0 flex-1 rounded-full bg-white px-4 text-sm outline-none" />{[["All", false], ["Custom %", true]].map(([label, value]) => <button key={String(label)} type="button" onClick={() => setOnlyCustom(Boolean(value))} className={`h-10 rounded-full px-4 text-sm font-semibold ${onlyCustom === value ? "bg-[#753b50] text-white" : "bg-white"}`}>{String(label)}</button>)}</div>
    {rows.length ? <div className="surface-card overflow-x-auto rounded-[28px]"><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Vendor</TableHead><TableHead>Vendor base</TableHead><TableHead>Operations %</TableHead><TableHead>Customer price</TableHead></TableRow></TableHeader><TableBody>{rows.map((x) => <TableRow key={x.id}><TableCell><b>{x.name}</b><div className="text-xs text-[#71676b]">per {x.baseUnit}</div></TableCell><TableCell className="text-sm">{state.vendors.find((v) => v.id === x.vendorId)?.businessName || "Vendor"}</TableCell><TableCell>{money(x.vendorPrice)}</TableCell><TableCell><span className={`rounded-full px-3 py-1 text-xs font-semibold ${pct(x.id) > 0 ? "bg-[#f7edf0] text-[#653046]" : "bg-[#faf6f4] text-[#71676b]"}`}>{pct(x.id)}%</span></TableCell><TableCell className="font-black">{money(finalPrice(x, state))}</TableCell></TableRow>)}</TableBody></Table></div> : <Empty icon={Percent} title={state.products.length ? "No items match" : "No product pricing"} body={state.products.length ? "Try another vendor or search." : "Pricing rows appear after vendors add products."} />}</div>;
}
function AuditLog({ items }: { items: Audit[] }) {
  function download() { downloadWorkbook("sheplates-audit-log", [{ name: "Audit log", rows: items.map((item) => ({ ID: item.id, Actor: item.actor, Action: item.action, Detail: item.detail, "At": item.at })) }]); }
  const [kind, setKind] = useState<"All" | "Permissions" | "Vendors" | "Plans and pricing">("All");
  const [auditQuery, setAuditQuery] = useState("");
  const [dbTrail, setDbTrail] = useState<TrailEvent[]>([]);
  const [trailError, setTrailError] = useState("");
  useEffect(() => { if (!isLiveSupabaseMode()) return; let alive = true; loadAuditTrail().then((rows) => { if (alive) setDbTrail(rows); }).catch((e) => { if (alive) setTrailError(e instanceof Error ? e.message : "The audit trail could not be loaded"); }); return () => { alive = false; }; }, []);
  const allItems = [...dbTrail, ...items];
  const kindOf = (item: Audit) => /permission|access|user/i.test(item.action) ? "Permissions" : /plan|price|percentage|markup/i.test(item.action) ? "Plans and pricing" : /vendor|verif|certificate|store/i.test(item.action + item.detail) ? "Vendors" : "Other";
  const shown = allItems.filter((item) => (kind === "All" || kindOf(item) === kind) && (!auditQuery.trim() || `${item.actor} ${item.action} ${item.detail}`.toLowerCase().includes(auditQuery.trim().toLowerCase())));
  return <div className="space-y-5"><Heading eyebrow="AUDITABILITY" title="Platform activity trail" body="Who did what, and when. Verification, pricing, catalogue, schedule and order actions are recorded." action={<Button variant="outline" onClick={download} disabled={!allItems.length}><Download />Download Excel</Button>} />{trailError && <p role="alert" className="rounded-3xl bg-[#FFF4CF] p-4 text-sm font-medium text-[#795900]">{trailError}</p>}
    <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Kind of action">{(["All", "Permissions", "Vendors", "Plans and pricing"] as const).map((name) => <button key={name} type="button" role="tab" aria-selected={kind === name} onClick={() => setKind(name)} className={`h-10 rounded-full px-4 text-sm font-semibold ${kind === name ? "bg-[#753b50] text-white" : "bg-white text-[#4c4246]"}`}>{name}</button>)}<input value={auditQuery} onChange={(e) => setAuditQuery(e.target.value)} placeholder="Search actor or action" aria-label="Search actor or action" className="ml-auto h-10 w-full max-w-xs rounded-full bg-white px-4 text-sm" /></div>
    {shown.length ? <div className="surface-card overflow-x-auto rounded-3xl p-3"><Table><TableHeader><TableRow><TableHead>When</TableHead><TableHead>Who</TableHead><TableHead>Action</TableHead><TableHead>Detail</TableHead></TableRow></TableHeader><TableBody>{shown.map((item) => <TableRow key={item.id}><TableCell className="whitespace-nowrap text-xs">{item.at}</TableCell><TableCell><span className="flex items-center gap-2 text-sm font-medium"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#e8cbd5] text-[11px] font-bold">{item.actor.slice(0, 1).toUpperCase()}</span>{item.actor}</span></TableCell><TableCell><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold">{item.action}</span></TableCell><TableCell className="text-sm text-[#4c4246]">{item.detail}</TableCell></TableRow>)}</TableBody></Table></div> : <Empty icon={Activity} title="No audit events" body="Actions across the new data flow will appear here." />}</div>;
}

type ReportKey = "orders" | "zoho_orders" | "payments" | "tickets" | "vendors" | "cancellations" | "customers";
const reportDefinitions: { key: ReportKey; label: string; dateField: string }[] = [
  { key: "orders", label: "Orders", dateField: "date" },
  { key: "zoho_orders", label: "Zoho Books daily order export", dateField: "date" },
  { key: "payments", label: "Vendor payments", dateField: "collectedAt" },
  { key: "tickets", label: "Support tickets", dateField: "at" },
  { key: "vendors", label: "Vendor directory", dateField: "" },
  { key: "cancellations", label: "Cancellations", dateField: "" },
  { key: "customers", label: "Customers", dateField: "" },
];
function buildReportRows(key: ReportKey, state: V3State, from: string, to: string): Record<string, unknown>[] {
  const inRange = (value?: string) => { if (!value) return true; const day = value.slice(0, 10); if (from && day < from) return false; if (to && day > to) return false; return true; };
  if (key === "orders") return state.orders.filter((o) => inRange(o.date)).map((o) => ({ "Order ID": o.id, Customer: o.customerEmail, Vendor: state.vendors.find((v) => v.id === o.vendorId)?.businessName || o.vendorId, Description: o.description, Total: o.total, Date: o.date, Slot: o.slot, Status: o.status, Payment: o.payment }));
  if (key === "zoho_orders") return state.orders.filter((o) => o.payment === "Paid" && inRange(o.date)).map((o) => ({ "Reference Number": o.id, "Customer Name": o.customerEmail, "Order Date": o.date, "Item Name": o.description, Quantity: o.quantity, Rate: o.quantity ? Math.round((o.total / o.quantity) * 100) / 100 : o.total, "Line Total": o.total, "Payment Status": o.payment, "Fulfilment Status": o.status, Vendor: state.vendors.find((v) => v.id === o.vendorId)?.businessName || o.vendorId, "Delivery Slot": o.slot }));
  if (key === "payments") return state.transactions.filter((t) => inRange(t.collectedAt)).map((t) => ({ "Order ID": t.orderId, Vendor: state.vendors.find((v) => v.id === t.vendorId)?.businessName || t.vendorId, "Collected on": t.collectedAt, Gross: t.grossAmount, Commission: t.commissionAmount, "Vendor payout": t.vendorPayout, Status: t.payoutStatus, "Expected / paid": t.paidAt || t.scheduledPayoutDate }));
  if (key === "tickets") return state.tickets.filter((t) => inRange(t.at)).map((t) => ({ "Ticket ID": t.id, "Raised by": t.creatorEmail, Role: t.creatorRole, Category: t.category, Subject: t.subject, Status: t.status, "Created via": t.createdVia, At: t.at }));
  if (key === "vendors") return state.vendors.map((v) => ({ Vendor: v.businessName, Owner: v.ownerEmail, Category: v.category, Verification: v.verification, Operational: v.operational, Plan: v.plan, "Open today": v.openToday ? "Yes" : "No", "Radius (km)": v.radiusKm }));
  if (key === "cancellations") return state.cancellations.map((c) => ({ "Cancellation ID": c.id, "Order ID": c.orderId, Customer: c.customerEmail, Reason: c.reason, "AI decision": c.aiDecision, "Confidence %": c.confidence, Status: c.status }));
  return state.customers.map((c) => ({ Email: c.email, Address: c.address, "Household size": c.householdSize, Diet: c.diet, Allergies: c.allergies.join(", "), Goals: c.goals.join(", ") }));
}
function ReportsCentre({ state }: { state: V3State }) {
  const [key, setKey] = useState<ReportKey>("orders");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const definition = reportDefinitions.find((x) => x.key === key)!;
  const rows = buildReportRows(key, state, from, to);
  function download() { downloadWorkbook(`sheplates-${key}-report`, [{ name: definition.label, rows }]); toast.success(`${definition.label} report downloaded (${rows.length} row(s))`); }
  return <div className="space-y-6"><Heading eyebrow="REPORTING" title="Custom reports" body="Pick a report, a period and download it as a spreadsheet." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{reportDefinitions.map((def) => { const count = buildReportRows(def.key, state, "", "").length; return <div key={def.key} className="surface-card flex flex-col gap-3 rounded-3xl p-5"><div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-[#753b50]"><FileText className="size-5" /></span><b>{def.label}</b></div><button type="button" onClick={() => { const data = buildReportRows(def.key, state, "", ""); downloadWorkbook(`sheplates-${def.key}-report`, [{ name: def.label, rows: data }]); toast.success(`${def.label} report downloaded (${data.length} row(s))`); }} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold ring-1 ring-[#e8dfe1]"><Download className="size-4" />Excel</button></div><div className="text-2xl font-bold tabular-nums">{count} <span className="text-sm font-medium text-[#71676b]">row{count === 1 ? "" : "s"}</span></div></div>; })}</div>
    <section className="surface-card rounded-3xl p-5"><h3 className="text-lg font-semibold">Orders over the last 14 days</h3><div className="mt-4"><BarChart data={lastDays(14).map((d) => ({ label: d.label, value: state.orders.filter((o) => o.date === d.key && o.status !== "Cancelled").length }))} height={150} /></div></section>
    <div className="surface-card grid gap-4 rounded-[28px] p-5 lg:grid-cols-[1.2fr_.8fr_.8fr_auto]">
      <Field label="Report"><Select value={key} onValueChange={(v) => setKey(v as ReportKey)}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{reportDefinitions.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="From" hint={definition.dateField ? undefined : "Not date-filterable"}><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} disabled={!definition.dateField} className={inputClass} /></Field>
      <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} disabled={!definition.dateField} className={inputClass} /></Field>
      <div className="flex items-end"><Button onClick={download} className="h-11 w-full rounded-xl bg-[#753b50] font-black hover:bg-[#602d40]"><Download />Download Excel</Button></div>
    </div>
    <div className="surface-card rounded-[28px] p-5"><div className="flex items-center justify-between"><h3 className="font-black">{definition.label} preview</h3><Status>{rows.length} row(s)</Status></div>{rows.length ? <div className="mt-4 overflow-x-auto"><Table><TableHeader><TableRow>{Object.keys(rows[0]).map((column) => <TableHead key={column}>{column}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0, 8).map((row, index) => <TableRow key={index}>{Object.keys(rows[0]).map((column) => <TableCell key={column}>{String(row[column] ?? "")}</TableCell>)}</TableRow>)}</TableBody></Table>{rows.length > 8 && <p className="mt-2 text-xs text-stone-400">Showing 8 of {rows.length} rows. Download the Excel file for the full dataset.</p>}</div> : <Empty icon={FileSpreadsheet} title="No rows for this selection" body="Widen the date range or choose a different report." />}</div>
  </div>;
}

function NotificationDrawer({ open, setOpen, session, state, setState }: { open: boolean; setOpen: (v: boolean) => void; session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>> }) { const items = state.notifications.filter((item) => notificationBelongsToSession(item, session)); async function enable() { if (!("Notification" in window)) return toast.error("Notifications are unavailable in this browser"); const permission = await Notification.requestPermission(); if (permission === "granted") { new Notification("ShePlates notifications enabled", { body: "Order and schedule updates can now reach this device.", icon: "/sheplates-logo.png" }); toast.success("Device notifications enabled"); } else toast.info("Notification permission was not granted"); } return <Sheet open={open} onOpenChange={setOpen}><SheetContent className="sp-notification-sheet w-full p-0 sm:max-w-md"><SheetHeader className="border-b bg-[#292124] p-6 text-left text-white"><SheetTitle className="text-white">Notifications</SheetTitle><SheetDescription className="text-white/55">In-app updates plus optional device notifications for this installed web app.</SheetDescription></SheetHeader><div className="p-5"><Button onClick={enable} variant="outline" className="mb-5 w-full rounded-xl"><Bell />Enable device notifications</Button><button onClick={() => setState((s) => ({ ...s, notifications: s.notifications.map((item) => notificationBelongsToSession(item, session) ? { ...item, read: true } : item) }))} className="mb-3 text-xs font-black text-[#653046]">Mark all as read</button><div className="space-y-3">{items.map((item) => <div key={item.id} className={`rounded-2xl border p-4 ${item.read ? "bg-white" : "border-[#753b50]/30 bg-[#f7edf0]"}`}><div className="flex justify-between gap-3"><b className="text-sm">{item.title}</b>{!item.read && <span className="mt-1 size-2 rounded-full bg-[#b42332]" />}</div><p className="mt-1 text-sm leading-6 text-stone-500">{item.body}</p><div className="mt-2 text-[11px] text-stone-400">{item.at}</div></div>)}{!items.length && <Empty icon={Bell} title="No notifications" body="Schedule, quote, verification and order updates will appear here." />}</div></div></SheetContent></Sheet>; }
function NotificationDrawerV4({ page = false, open, setOpen, session, state, setState, people }: { page?: boolean; open: boolean; setOpen: (v: boolean) => void; session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; people: PeopleApi }) {
  const items = state.notifications.filter((item) => notificationBelongsToSession(item, session));
  const [busyRequest, setBusyRequest] = useState("");
  async function enable() { if (!("Notification" in window)) return toast.error("Notifications are unavailable in this browser"); const permission = await Notification.requestPermission(); if (permission === "granted") { new Notification("ShePlates notifications enabled", { body: "Verification, quote, schedule and tracking updates can reach this device.", icon: "/sheplates-logo.png" }); toast.success("Device notifications enabled"); } }
  async function markAll() { try { if (isLiveSupabaseMode()) await markLiveNotificationsRead(); setState((s) => ({ ...s, notifications: s.notifications.map((item) => notificationBelongsToSession(item, session) ? { ...item, read: true } : item) })); } catch (error) { toast.error(error instanceof Error ? error.message : "Notifications could not be updated"); } }
  async function respondToFollowRequest(item: Notification, accept: boolean) {
    if (!item.entityId) return;
    setBusyRequest(item.id);
    try {
      await people.resolveRequest(item.entityId, accept);
      setState((current) => ({ ...current, notifications: current.notifications.map((notification) => notification.id === item.id ? { ...notification, read: true } : notification) }));
      toast.success(accept ? "Follow request approved" : "Follow request declined");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Follow request could not be updated");
    } finally { setBusyRequest(""); }
  }
  if (page) return <div className="mx-auto max-w-3xl space-y-4"><div className="flex items-end justify-between gap-3"><div><h1 className="text-[28px] font-bold leading-tight">Notifications</h1><p className="mt-1 text-sm text-[#71676b]">Private updates for {session.email}.</p></div></div><div className="space-y-3"><Button onClick={enable} variant="outline" className="mb-5 w-full rounded-xl"><Bell />Enable device notifications</Button><button onClick={() => void markAll()} className="mb-3 text-xs font-black text-[#653046]">Mark all as read</button><div className="space-y-3">{items.map((item) => <div key={item.id} className={`rounded-2xl border p-4 ${item.read ? "bg-white" : "border-[#753b50]/30 bg-[#f7edf0]"}`}><div className="flex justify-between gap-3"><b className="text-sm">{item.title}</b>{!item.read && <span className="mt-1 size-2 rounded-full bg-[#b42332]" />}</div><p className="mt-1 text-sm leading-6 text-stone-500">{item.body}</p><div className="mt-2 text-[11px] text-stone-400">{item.at}</div>{session.role === "customer" && item.entityType === "customer_follow_request" && item.entityId && people.requests.some((request) => request.id === item.entityId) && <div className="mt-3 flex gap-2"><Button type="button" size="sm" disabled={busyRequest === item.id} onClick={() => void respondToFollowRequest(item, true)} className="rounded-full bg-[#753b50] font-black text-white">Accept</Button><Button type="button" size="sm" variant="outline" disabled={busyRequest === item.id} onClick={() => void respondToFollowRequest(item, false)} className="rounded-full font-black">Decline</Button></div>}</div>)}{!items.length && <Empty icon={Bell} title="No notifications" body="Verification, quote, schedule and order updates will appear here." />}</div></div></div>;
  return <Sheet open={open} onOpenChange={setOpen}><SheetContent className="w-full overflow-hidden p-0 sm:max-w-md"><SheetHeader className="shrink-0 border-b bg-[#292124] p-6 text-left text-white"><SheetTitle className="text-white">Notifications</SheetTitle><SheetDescription className="text-white/55">Private updates for {session.email}. Vendor and customer events are never mixed.</SheetDescription></SheetHeader><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5"><Button onClick={enable} variant="outline" className="mb-5 w-full rounded-xl"><Bell />Enable device notifications</Button><button onClick={() => void markAll()} className="mb-3 text-xs font-black text-[#653046]">Mark all as read</button><div className="space-y-3">{items.map((item) => <div key={item.id} className={`rounded-2xl border p-4 ${item.read ? "bg-white" : "border-[#753b50]/30 bg-[#f7edf0]"}`}><div className="flex justify-between gap-3"><b className="text-sm">{item.title}</b>{!item.read && <span className="mt-1 size-2 rounded-full bg-[#b42332]" />}</div><p className="mt-1 text-sm leading-6 text-stone-500">{item.body}</p><div className="mt-2 text-[11px] text-stone-400">{item.at}</div>{session.role === "customer" && item.entityType === "customer_follow_request" && item.entityId && people.requests.some((request) => request.id === item.entityId) && <div className="mt-3 flex gap-2"><Button type="button" size="sm" disabled={busyRequest === item.id} onClick={() => void respondToFollowRequest(item, true)} className="rounded-full bg-[#753b50] font-black text-white">Accept</Button><Button type="button" size="sm" variant="outline" disabled={busyRequest === item.id} onClick={() => void respondToFollowRequest(item, false)} className="rounded-full font-black">Decline</Button></div>}</div>)}{!items.length && <Empty icon={Bell} title="No notifications" body="Verification, quote, schedule and order updates will appear here." />}</div></div></SheetContent></Sheet>;
}
function notice(recipient: string, recipientRole: Role, title: string, body: string): Notification { return { id: id("NOT"), recipient, recipientRole, title, body, at: now(), read: false }; }
function playNotificationSound() {
  try {
    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor(); const oscillator = ctx.createOscillator(); const gain = ctx.createGain();
    oscillator.frequency.value = 880; gain.gain.setValueAtTime(0.0001, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + 0.36);
  } catch { /* sound is best-effort and requires browser interaction on some devices */ }
}
function showDeviceNotification(title: string, body: string) { if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body, icon: "/sheplates-logo.png" }); }

function findRelevantOrderForComplaint(state: V3State, session: DemoSession): Order | undefined {
  const orders = state.orders.filter((order) => order.customerEmail === session.email);
  const delivered = orders.filter((order) => order.status === "Completed" || order.status === "Out for delivery" || order.status === "Ready for pickup");
  const pool = delivered.length ? delivered : orders;
  return [...pool].sort((a, b) => b.date.localeCompare(a.date))[0];
}
function availableCommerceProducts(state: V3State) {
  return state.products.filter((product) => product.active && product.stock > 0 && state.vendors.some((vendor) => vendor.id === product.vendorId && vendor.verification === "Verified" && vendor.operational === "Active" && vendor.openToday));
}
function withAgentMemory(state: V3State, email: string, patch: Partial<AgentMemory>): V3State {
  return { ...state, customers: state.customers.map((customer) => customer.email === email ? { ...customer, agentMemory: { ...customer.agentMemory, ...patch } } : customer) };
}
function rememberCategory(setState: React.Dispatch<React.SetStateAction<V3State>>, email: string, category: string) {
  setState((state) => {
    const existing = state.customers.find((customer) => customer.email === email)?.agentMemory?.favoriteCategories || [];
    const next = existing.includes(category) ? existing : [...existing, category].slice(-5);
    return withAgentMemory(state, email, { favoriteCategories: next });
  });
}

function SheAgent({ page = false, open, setOpen, session, state, setState, navigate }: { page?: boolean; open: boolean; setOpen: (v: boolean) => void; session: DemoSession; state: V3State; setState: React.Dispatch<React.SetStateAction<V3State>>; navigate: (page: string) => void }) {
  const customer = state.customers.find((c) => c.email === session.email);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([{ role: "agent", text: session.role === "customer" ? `Hi ${session.name.split(" ")[0]} 👋 Tell me what you're planning and I'll turn it into a local basket you can review.` : `Hello ${session.name}. I can analyse your ${roleName[session.role].toLowerCase()} workspace and recommend the next action.` }]);
  const [busy, setBusy] = useState(false);
  const [awaitingPhoto, setAwaitingPhoto] = useState<{ orderId: string; complaintText: string } | null>(null);
  const bottom = useRef<HTMLDivElement>(null); const fileInputRef = useRef<HTMLInputElement>(null);
  const scope = useMemo(() => scopedContext(session, state), [session, state]);
  const cartItems = state.cart.filter((item) => item.customerEmail === session.email);
  const cartTotal = cartItems.reduce((sum, item) => { const product = state.products.find((p) => p.id === item.productId); return sum + (product ? finalPrice(product, state) * item.quantity : 0); }, 0);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);
  useEffect(() => { if (!open) setMessage(""); }, [open]);

  async function syncAgentCart(addProductIds: string[] = [], removeProductIds: string[] = [], announce?: string) {
    const own = state.cart.filter((item) => item.customerEmail === session.email);
    const byProduct = new Map(own.map((item) => [item.productId, { ...item }]));
    for (const productId of addProductIds) {
      const product = state.products.find((item) => item.id === productId);
      if (!product) continue;
      const existing = byProduct.get(productId);
      byProduct.set(productId, existing ? { ...existing, quantity: existing.quantity + 1 } : { id: id("CRT"), customerEmail: session.email, productId, quantity: 1 });
      rememberCategory(setState, session.email, product.category);
    }
    for (const productId of removeProductIds) byProduct.delete(productId);
    const nextOwn = [...byProduct.values()];
    setState((current) => ({ ...current, cart: [...current.cart.filter((item) => item.customerEmail !== session.email), ...nextOwn] }));
    if (isLiveSupabaseMode()) {
      const saved = await syncLiveCart({ items: nextOwn.map((item) => ({ productId: item.productId, quantity: item.quantity })), createdBy: "she_agent" });
      if (saved.snapshot) setState((current) => mergeLiveCommerce(current, saved.snapshot as LiveCommerceStateSnapshot, session));
    }
    if (announce) toast.success(announce);
  }
  async function addProduct(productId: string, announce = true) {
    const product = state.products.find((item) => item.id === productId); if (!product) return;
    try { await syncAgentCart([productId], [], announce ? `${product.name} added to your basket` : undefined); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Cart could not be saved"); }
  }
  async function addSuggestedBasket(productIds: string[]) {
    try { await syncAgentCart(productIds, [], `${productIds.length} suggested item${productIds.length === 1 ? "" : "s"} added to your basket`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Basket could not be saved"); }
  }

  async function submitQualityComplaint(orderId: string, complaintText: string, fileName: string, imageDataUrl: string) {
    const order = state.orders.find((o) => o.id === orderId); let aiDecision = "I reviewed the photo but could not reach live vision analysis, so this needs a careful manual look."; let confidence = 65; let recommendedRefundAmount = order ? Math.round(order.total * 0.5 * 100) / 100 : 0;
    try { const token = await getAccessToken(); const response = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ task: "quality_complaint", message: complaintText, context: { ...scope, order }, imageBase64: imageDataUrl, role: session.role }) }); const json = await response.json() as { result?: { summary?: string; recommendedAction?: string; confidence?: number; quality?: { spoilageLikely?: boolean; recommendedRefundPercent?: number } } }; if (response.ok && json.result) { aiDecision = [json.result.summary, json.result.recommendedAction].filter(Boolean).join(" ") || aiDecision; if (typeof json.result.confidence === "number") confidence = json.result.confidence; const percent = json.result.quality?.recommendedRefundPercent; if (order && typeof percent === "number") recommendedRefundAmount = Math.max(0, Math.min(order.total, Math.round(order.total * (percent / 100) * 100) / 100)); } } catch { /* conservative fallback */ }
    const cancellation: Cancellation = { id: id("CAN"), orderId, customerEmail: session.email, reason: complaintText, aiDecision, confidence, status: "Awaiting operations", kind: "quality_complaint", recommendedRefundAmount, attachmentName: fileName };
    const ticket: Ticket = { id: id("TKT"), creatorEmail: session.email, creatorRole: session.role, subject: `Quality complaint — ${orderId}`, description: complaintText, category: "Order", priority: "High", status: "Open", attachmentName: fileName, createdVia: "She Agent", at: now() };
    setState((current) => withAgentMemory({ ...current, cancellations: [cancellation, ...current.cancellations], tickets: [ticket, ...current.tickets], notifications: [notice("operations@sheplates.demo", "operations", "Quality complaint needs review", `${cancellation.id} for ${orderId} · She Agent suggests ${money(recommendedRefundAmount)}.`), ...current.notifications], audit: [audit(session, "Quality complaint submitted", `${orderId} · photo attached (${fileName})`), ...current.audit] }, session.email, { lastComplaintAt: now() }));
    setMessages((x) => [...x, { role: "agent", text: `I've reviewed the photo for ${orderId}. ${aiDecision} I sent the evidence and a ${money(recommendedRefundAmount)} refund recommendation to Operations for final approval.` }]);
  }
  async function handlePhotoSelected(file: File) { if (!awaitingPhoto) return; const { orderId, complaintText } = awaitingPhoto; setAwaitingPhoto(null); setMessages((x) => [...x, { role: "user", text: `📷 Attached: ${file.name}` }]); setBusy(true); try { const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("The photo could not be read. Please try again.")); reader.readAsDataURL(file); }); await submitQualityComplaint(orderId, complaintText, file.name, dataUrl); } catch (error) { setMessages((x) => [...x, { role: "agent", text: error instanceof Error ? error.message : "The photo could not be processed. Please try again." }]); } finally { setBusy(false); } }

  async function send(prefill?: string) {
    const text = (prefill ?? message).trim();
    if (!text || busy) return;
    setMessage("");
    const userMessage: AgentMessage = { role: "user", text };
    setMessages((current) => [...current, userMessage]);
    setBusy(true);
    try {
      const token = await getAccessToken();
      const history = [...messages, userMessage].slice(-12).map((item) => ({ role: item.role, text: item.text, productIds: item.productIds || [] }));
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ task: "commerce", message: text, context: isLiveSupabaseMode() ? undefined : scope, history, role: session.role }),
      });
      type AgentJson = {
        result?: {
          reply?: string;
          intent?: string;
          budget?: number;
          selectedProductIds?: string[];
          basketProductIds?: string[];
          removeProductIds?: string[];
          navigateTo?: string;
          clarifyingQuestion?: string;
          requiresPhoto?: boolean;
          targetOrderId?: string;
          createTicket?: boolean;
          ticketSubject?: string;
          ticketCategory?: Ticket["category"];
          ticketPriority?: Ticket["priority"];
          memoryUpdates?: Array<{ key: string; value: string; confidence: number }>;
        };
        error?: string;
      };
      const streamed = (response.headers.get("content-type") || "").includes("text/event-stream") && Boolean(response.body);
      const json: AgentJson = streamed
        ? await readAgentStream(response, (reply) => setMessages((current) => { const last = current[current.length - 1]; return last?.streaming ? [...current.slice(0, -1), { ...last, text: reply }] : [...current, { role: "agent", text: reply, streaming: true }]; })) as AgentJson
        : await response.json() as AgentJson;
      if ((!streamed && !response.ok) || !json.result) throw new Error(json.error || "She Agent is temporarily unavailable. Please try again shortly.");
      const result = json.result;

      if (session.role === "customer" && result.memoryUpdates?.length) {
        const patch: Partial<AgentMemory> = {};
        for (const memory of result.memoryUpdates) {
          if (memory.key === "preferred_budget") patch.lastBudget = Number(memory.value) || customer?.agentMemory?.lastBudget;
          if (memory.key === "favorite_categories") patch.favoriteCategories = memory.value.split(",").map((item) => item.trim()).filter(Boolean);
          if (memory.key === "favorite_products") patch.favoriteProducts = memory.value.split(",").map((item) => item.trim()).filter(Boolean);
          if (memory.key === "calorie_target") patch.calorieTarget = Number(memory.value) || undefined;
          if (memory.key === "protein_preference") patch.minProtein = Number(memory.value) || undefined;
          if (memory.key === "dietary_preference") patch.preferredDietaryTags = memory.value.split(",").map((item) => item.trim()).filter(Boolean);
          if (memory.key === "delivery_window") patch.preferredDeliveryPeriod = memory.value;
        }
        if (Object.keys(patch).length) setState((current) => withAgentMemory(current, session.email, patch));
      }

      const permittedProducts = new Map(availableCommerceProducts(state).map((product) => [product.id, product]));
      const selectedProducts = [...new Set(result.selectedProductIds || [])].map((productId) => permittedProducts.get(productId)).filter((product): product is Product => Boolean(product)).slice(0, 8);
      const basketProducts = [...new Set(result.basketProductIds || [])].map((productId) => permittedProducts.get(productId)).filter((product): product is Product => Boolean(product)).slice(0, 8);
      const removeIds = new Set((result.removeProductIds || []).filter((productId) => permittedProducts.has(productId)));


      if (result.createTicket) {
        const vendor = session.role === "vendor" ? vendorFor(state, session) : undefined;
        const ticket: Ticket = {
          id: id("TKT"),
          creatorEmail: session.email,
          creatorRole: session.role,
          vendorId: vendor?.id,
          subject: (result.ticketSubject || text).slice(0, 80),
          description: text,
          category: result.ticketCategory || "Other",
          priority: result.ticketPriority || "Normal",
          status: "Open",
          createdVia: "She Agent",
          at: now(),
        };
        setState((current) => ({
          ...current,
          tickets: [ticket, ...current.tickets],
          notifications: [notice(session.email, session.role, "Support request created", `${ticket.id} is open.`), notice("operations@sheplates.demo", "operations", "New support request", `${ticket.id}: ${ticket.subject}`), ...current.notifications],
        }));
      }

      if (session.role === "customer" && result.requiresPhoto) {
        const order = state.orders.find((item) => item.customerEmail === session.email && (item.id === result.targetOrderId || item.description === result.targetOrderId)) || findRelevantOrderForComplaint(state, session);
        if (order) setAwaitingPhoto({ orderId: order.id, complaintText: text });
      }

      const destination = result.navigateTo || "";
      if (destination && nav[session.role].includes(destination)) {
        navigate(destination);
        if (destination !== "Marketplace") setOpen(false);
      }

      const productIds = selectedProducts.map((product) => product.id);
      const basketTotal = result.intent === "recommend" && selectedProducts.length ? selectedProducts.reduce((sum, product) => sum + finalPrice(product, state), 0) : undefined;
      let reply = result.clarifyingQuestion?.trim() || result.reply?.trim() || "I couldn't complete that request just now. Please try again.";
      if (result.requiresPhoto && awaitingPhoto === null) reply = `${reply} You can attach the photo below.`;
      setMessages((current) => [...current.filter((m) => !m.streaming), { role: "agent", text: reply, productIds: productIds.length ? productIds : undefined, basketTotal, intent: result.intent }]);
      // The reply is already on screen. Saving the basket is a network round trip, so it must not hold the answer back.
      setBusy(false);
      if (basketProducts.length || removeIds.size) {
        try { await syncAgentCart(basketProducts.map((product) => product.id), [...removeIds]); }
        catch (error) { toast.error(error instanceof Error ? error.message : "Your basket could not be saved. Please try again"); }
      }
    } catch (error) {
      setMessages((current) => [...current.filter((m) => !m.streaming), { role: "agent", text: error instanceof Error ? error.message : "She Agent is temporarily unavailable. Please try again shortly." }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  const scopeCopy = session.role === "customer" ? "Uses only your profile, nearby catalogue, basket, schedules and orders." : session.role === "vendor" ? "Uses only your vendor catalogue, staff and orders." : "Uses authorised platform operational data.";
  return <div className={page ? "k-agent-page" : "fixed inset-0 z-70 sm:pointer-events-none"}>{!page && <button onClick={() => setOpen(false)} className="absolute inset-0 bg-[#292124]/35 backdrop-blur-[2px] sm:hidden" aria-label="Close She Agent" />}<section className="sp-agent-panel pointer-events-auto absolute inset-x-0 bottom-0 flex h-[92dvh] flex-col overflow-hidden rounded-t-[30px] border border-white/60 bg-[#faf6f4] shadow-[0_-20px_80px_rgba(25, 19, 21,.22)] sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(790px,calc(100vh-36px))] sm:w-120 sm:rounded-4xl sm:shadow-[0_24px_90px_rgba(25, 19, 21,.28)]">
    <div className="relative overflow-hidden bg-[#292124] px-5 pb-5 pt-5 text-white"><div className="absolute -right-12 -top-16 size-44 rounded-full bg-[#753b50]/30 blur-3xl" /><div className="absolute -bottom-20 left-12 size-40 rounded-full bg-[#b42332]/20 blur-3xl" /><div className="relative flex items-center gap-3"><div className="sp-agent-orb sp-agent-orb-large relative grid size-12 place-items-center rounded-[18px] text-white"><Activity className="size-5" /><span className="sp-agent-orb-status absolute -right-1 -top-1 size-3 rounded-full" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="text-lg font-black">She Agent</h2><span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white/70">Commerce assistant</span></div><p className="mt-0.5 truncate text-xs text-white/55">{session.role === "customer" ? "Your local shopping copilot" : `${roleName[session.role]} copilot`}</p></div><button onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full bg-white/10 transition hover:bg-white/15" aria-label="Close"><X className="size-4" /></button></div>{session.role === "customer" && <div className="relative mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/8 px-3 py-2.5 text-xs"><ShoppingCart className="size-4 text-[#653046]" /><span className="font-bold">Review basket</span><span className="text-white/45">{cartItems.length} item{cartItems.length === 1 ? "" : "s"}</span><span className="ml-auto font-black">{money(cartTotal)}</span>{cartItems.length > 0 && <button onClick={() => { navigate("Cart"); setOpen(false); }} className="rounded-lg bg-white px-2.5 py-1.5 font-black text-[#292124]">View</button>}</div>}</div>
    <div className="border-b border-stone-200/70 bg-white/80 px-5 py-3 text-[11px] font-semibold leading-5 text-stone-500 backdrop-blur"><ShieldCheck className="mr-1.5 inline size-3.5 text-[#653046]" />{scopeCopy} Sensitive payments, refunds and approvals remain human-confirmed.</div>
    <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-5">{messages.length === 1 && session.role === "customer" && <div className="mb-5 grid grid-cols-2 gap-2">{[["Nearby now", "What products are available near me?"], ["Plan for me", "Plan something useful for me today"], ["Food preferences", "Show options that fit my preferences"], ["Track order", "Where is my next order?"]].map(([label, prompt]) => <button key={label} onClick={() => void send(prompt)} className="surface-card rounded-[22px] p-3 text-left transition hover:-translate-y-0.5 hover:border-[#753b50]/40 hover:shadow-md"><Sparkles className="size-4 text-[#653046]" /><div className="mt-2 text-xs font-black">{label}</div><div className="mt-1 text-[10px] leading-4 text-stone-400">{prompt}</div></button>)}</div>}<div className="space-y-4">{messages.map((item, index) => <div key={index} className={`flex ${item.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[92%] ${item.role === "user" ? "rounded-[22px_22px_8px_22px] bg-[#292124] text-white shadow-[0_16px_36px_rgba(22, 17, 18,.18)]" : "rounded-[22px_22px_22px_8px] border border-stone-200/80 bg-white/96 text-stone-700 shadow-[0_16px_40px_rgba(35,26,21,.08)]"} px-4 py-3 text-sm leading-6`}><div>{item.text}</div>{item.productIds?.length ? <div className="mt-3 space-y-2">{item.productIds.map((productId) => { const product = state.products.find((p) => p.id === productId); const vendor = product ? state.vendors.find((v) => v.id === product.vendorId) : undefined; if (!product) return null; const inCart = state.cart.some((x) => x.customerEmail === session.email && x.productId === product.id); return <div key={product.id} className="surface-card-muted rounded-[22px] p-3"><div className="flex items-center gap-3"><div className="grid size-12 shrink-0 place-items-center rounded-2xl shadow-sm ring-1 ring-stone-100" style={{ background: categoryVisual(product.category).bg }}><ProductGlyph category={product.category} /></div><div className="min-w-0 flex-1"><div className="truncate text-xs font-black text-[#292124]">{product.name}</div><div className="mt-0.5 truncate text-[10px] text-stone-500">{vendor?.businessName || "Verified vendor"} · {product.baseUnit}</div><div className="mt-1 flex items-center gap-2"><span className="text-sm font-black text-[#292124]">{money(finalPrice(product, state))}</span><span className="text-[10px] font-bold text-[#653046]">{product.protein}g protein</span></div></div><button onClick={() => void addProduct(product.id)} className={`grid min-w-14 place-items-center rounded-xl px-2.5 py-2 text-[11px] font-black ${inCart ? "bg-[#f7edf0] text-white" : "bg-[#753b50] text-white"}`}>{inCart ? "Add +" : "+ Add"}</button></div></div>; })}{item.basketTotal !== undefined && <div className="flex items-center justify-between gap-2 pt-1"><span className="text-[11px] font-bold text-stone-400">Suggested total {money(item.basketTotal)}</span><button onClick={() => void addSuggestedBasket(item.productIds || [])} className="rounded-xl bg-[#292124] px-3 py-2 text-[11px] font-black text-white">Add suggested basket</button></div>}</div> : null}</div></div>)}{busy && !messages.some((m) => m.streaming) && <div className="flex justify-start"><div className="inline-flex items-center gap-2 rounded-[22px_22px_22px_8px] border border-stone-200/80 bg-white/96 px-4 py-3 text-sm text-stone-500 shadow-[0_14px_36px_rgba(35,26,21,.08)]"><span className="flex gap-1"><span className="size-1.5 animate-bounce rounded-full bg-[#753b50]" /><span className="size-1.5 animate-bounce rounded-full bg-[#753b50] [animation-delay:120ms]" /><span className="size-1.5 animate-bounce rounded-full bg-[#753b50] [animation-delay:240ms]" /></span>Working on the best options…</div></div>}<div ref={bottom} /></div></div>
    <div className="border-t border-stone-200/80 bg-white/96 p-3.5 backdrop-blur sm:p-4"><input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) void handlePhotoSelected(file); e.target.value = ""; }} />{awaitingPhoto && <div className="mb-3 flex gap-2"><Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1 rounded-xl border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"><ImageUp />Attach photo for {awaitingPhoto.orderId}</Button><Button type="button" variant="ghost" onClick={() => setAwaitingPhoto(null)} className="rounded-xl">Cancel</Button></div>}<div className="mb-3 flex gap-2 overflow-x-auto pb-1">{agentPrompts(session.role).map((prompt) => <button key={prompt} onClick={() => void send(prompt)} disabled={busy} className="whitespace-nowrap rounded-full border border-stone-200 bg-[#faf6f4] px-3 py-2 text-[11px] font-bold text-stone-600 transition hover:border-[#753b50]/40 hover:bg-[#f7edf0]">{prompt}</button>)}</div><div className="flex items-end gap-2 rounded-[20px] border border-stone-200 bg-[#faf6f4] p-2 focus-within:border-[#753b50]/50 focus-within:ring-4 focus-within:ring-[#753b50]/10"><Textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder={session.role === "customer" ? "Ask naturally about food, products, orders or your plans…" : "Ask She Agent…"} className="min-h-10 max-h-28 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0" /><Button onClick={() => void send()} disabled={busy || !message.trim()} className="size-10 shrink-0 rounded-xl bg-[#753b50] p-0 hover:bg-[#602d40]" aria-label="Send"><Send className="size-4" /></Button></div><p className="mt-2 px-1 text-[10px] leading-4 text-stone-400">She Agent can prepare and modify a proposal. You confirm checkout, payment and sensitive actions.</p></div>
  </section></div>;
}
function scopedContext(session: DemoSession, state: V3State) {
  if (session.role === "customer") return {
    scope: "customer_self",
    profile: state.customers.find((x) => x.email === session.email),
    cart: state.cart.filter((x) => x.customerEmail === session.email),
    tickets: state.tickets.filter((x) => x.creatorEmail === session.email),
    schedules: state.schedules.filter((x) => x.customerEmail === session.email),
    orders: state.orders.filter((x) => x.customerEmail === session.email),
    requirements: state.requirements.filter((x) => x.customerEmail === session.email),
    quotations: state.quotes.filter((quote) => state.requirements.some((requirement) => requirement.id === quote.requirementId && requirement.customerEmail === session.email)),
    availableProducts: state.products.filter((product) => state.vendors.some((vendor) => vendor.id === product.vendorId && vendor.verification === "Verified" && vendor.openToday)),
  };
  if (session.role === "vendor") {
    const vendor = vendorFor(state, session);
    return {
      scope: "vendor_self",
      vendor,
      products: state.products.filter((x) => x.vendorId === vendor?.id),
      orders: state.orders.filter((x) => x.vendorId === vendor?.id),
      deliveryStaff: state.staff.filter((x) => x.vendorId === vendor?.id),
      tickets: state.tickets.filter((x) => x.vendorId === vendor?.id || x.creatorEmail === session.email),
      opportunities: vendor?.plan === "Crown" ? state.requirements.filter((x) => (x.status === "Quoting" || x.status === "Quotes received") && (!x.invitedVendorIds?.length || x.invitedVendorIds.includes(vendor.id))) : [],
      quotations: state.quotes.filter((x) => x.vendorId === vendor?.id),
      payouts: state.transactions.filter((x) => x.vendorId === vendor?.id),
    };
  }
  const operationsContext = {
    scope: "operations_authorised",
    metrics: {
      customers: state.customers.length,
      vendors: state.vendors.length,
      products: state.products.length,
      schedules: state.schedules.length,
      orders: state.orders.length,
      openTickets: state.tickets.filter((x) => x.status !== "Resolved").length,
    },
    customers: state.customers,
    vendors: state.vendors,
    products: state.products,
    orders: state.orders,
    requirements: state.requirements,
    cancellations: state.cancellations,
    tickets: state.tickets,
    payouts: state.transactions,
  };
  if (session.role === "operations") return operationsContext;
  return {
    ...operationsContext,
    scope: "super_admin_authorised",
    audit: state.audit.slice(0, 100),
    campaigns: state.campaigns,
    platformSettings: state.merchandising,
    staffAccounts: state.staffAccounts,
  };
}

function agentPrompts(role: Role) { return role === "customer" ? ["What’s available near me?", "Plan something for me", "Healthy options", "Track my next order"] : role === "vendor" ? ["What must I fulfil next?", "Summarise my inventory", "Create a delivery issue ticket"] : role === "operations" ? ["Show operational risks", "Prioritise open tickets", "Find unassigned deliveries"] : ["Summarise marketplace health", "Detect governance risks", "Compare vendor plan adoption"]; }
