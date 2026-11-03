import test from "node:test";
import assert from "node:assert/strict";
import {
  campaignPhase, campaignSeenBy, clickRate, endsInLabel, isoToLocalInput, liveForCustomer, localInputToIso, validateCampaignForm,
} from "../lib/campaigns-rules.ts";

// Live campaigns: the rules that decide what a customer sees. The database applies the same
// rules in live_campaigns() (supabase/V9_2_LIVE_CAMPAIGNS.sql).

const NOW = Date.parse("2026-10-20T12:00:00Z");
const iso = (hours) => new Date(NOW + hours * 3_600_000).toISOString();
const camp = (o = {}) => ({ status: "Active", headline: "Breakfast week", segment: "everyone", priority: 0, createdAt: iso(-48), ...o });

test("only an Active campaign inside its dates is live", () => {
  assert.equal(campaignPhase(camp(), NOW), "live");
  assert.equal(campaignPhase(camp({ status: "Draft" }), NOW), "draft");
  assert.equal(campaignPhase(camp({ status: "Paused" }), NOW), "paused");
  assert.equal(campaignPhase(camp({ startsAt: iso(2) }), NOW), "scheduled");
  assert.equal(campaignPhase(camp({ endsAt: iso(-1) }), NOW), "ended");
  assert.equal(campaignPhase(camp({ startsAt: iso(-5), endsAt: iso(5) }), NOW), "live");
  assert.equal(campaignPhase(camp({ endsAt: iso(0) }), NOW), "ended"); // the end instant is already over
});

test("audience: new customers have no orders, returning customers have at least one", () => {
  assert.equal(campaignSeenBy({ segment: "everyone" }, false), true);
  assert.equal(campaignSeenBy({ segment: "everyone" }, true), true);
  assert.equal(campaignSeenBy({ segment: "new_customers" }, false), true);
  assert.equal(campaignSeenBy({ segment: "new_customers" }, true), false);
  assert.equal(campaignSeenBy({ segment: "returning_customers" }, true), true);
  assert.equal(campaignSeenBy({ segment: "returning_customers" }, false), false);
  assert.equal(campaignSeenBy({}, false), true); // no segment set means everyone
});

test("a customer sees live campaigns for their audience, highest priority first, newest next, at most six", () => {
  const list = [
    camp({ id: "old", createdAt: iso(-100), headline: "Old" }),
    camp({ id: "new", createdAt: iso(-1), headline: "New" }),
    camp({ id: "top", priority: 5, createdAt: iso(-200), headline: "Top" }),
    camp({ id: "draft", status: "Draft" }),
    camp({ id: "ended", endsAt: iso(-3) }),
    camp({ id: "later", startsAt: iso(4) }),
    camp({ id: "returning", segment: "returning_customers" }),
    camp({ id: "blank", headline: "   " }),
  ];
  assert.deepEqual(liveForCustomer(list, false, NOW).map((c) => c.id), ["top", "new", "old"]);
  assert.deepEqual(liveForCustomer(list, true, NOW).map((c) => c.id), ["top", "new", "returning", "old"]);
  const many = Array.from({ length: 9 }, (_, i) => camp({ id: `c${i}`, createdAt: iso(-i) }));
  assert.equal(liveForCustomer(many, false, NOW).length, 6);
});

test("saving needs a name, a headline of sensible length and a target when the button goes somewhere", () => {
  const ok = { name: "Breakfast week", headline: "Fresh breakfasts nearby", subline: "From 6 am", targetType: "none", targetValue: "", startsAt: "", endsAt: "" };
  assert.equal(validateCampaignForm(ok), null);
  assert.match(validateCampaignForm({ ...ok, name: " " }), /internal name/);
  assert.match(validateCampaignForm({ ...ok, headline: "" }), /headline/);
  assert.match(validateCampaignForm({ ...ok, headline: "x".repeat(61) }), /60/);
  assert.match(validateCampaignForm({ ...ok, subline: "x".repeat(121) }), /120/);
  assert.match(validateCampaignForm({ ...ok, targetType: "category", targetValue: "" }), /category/);
  assert.match(validateCampaignForm({ ...ok, targetType: "vendor", targetValue: "" }), /vendor/);
  assert.match(validateCampaignForm({ ...ok, targetType: "product", targetValue: "" }), /product/);
  assert.equal(validateCampaignForm({ ...ok, targetType: "category", targetValue: "Bakery" }), null);
  assert.match(validateCampaignForm({ ...ok, startsAt: "2026-10-25T10:00", endsAt: "2026-10-24T10:00" }), /after the start/);
  assert.match(validateCampaignForm({ ...ok, startsAt: "nonsense" }), /not valid/);
  assert.match(validateCampaignForm({ ...ok, status: "Active", endsAt: "2020-01-01T10:00" }), /already passed/);
});

test("end-of-campaign countdown is coarse and only shown when it is close", () => {
  assert.equal(endsInLabel(null, NOW), "");
  assert.equal(endsInLabel(iso(-1), NOW), "");
  assert.equal(endsInLabel(iso(24 * 9), NOW), "");           // more than a week away
  assert.equal(endsInLabel(iso(24 * 2 + 4), NOW), "2d 4h");
  assert.equal(endsInLabel(iso(5.2), NOW), "5h 12m");
  assert.equal(endsInLabel(new Date(NOW + 38 * 60_000).toISOString(), NOW), "38 min");
});

test("click rate and local date inputs", () => {
  assert.equal(clickRate(0, 0), "0%");
  assert.equal(clickRate(200, 30), "15%");
  assert.equal(clickRate(10, 50), "100%");
  assert.equal(localInputToIso(""), null);
  assert.equal(localInputToIso("not a date"), null);
  const roundTrip = isoToLocalInput(localInputToIso("2026-10-25T09:30"));
  assert.equal(roundTrip, "2026-10-25T09:30");
  assert.equal(isoToLocalInput(null), "");
});
