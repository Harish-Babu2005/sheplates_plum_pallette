import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SHORT_SECONDS, MAX_SHORT_BYTES, REACH_OPTIONS_KM, checkVideoDuration, checkVideoFile, defaultReachKm,
  formatDistanceKm, formatDuration, haversineKm, shortVisibleAtDistance,
} from "../lib/food-shorts-rules.ts";

// Food Shorts rules. The database applies the same rules in nearby_food_shorts()
// (supabase/V8_4_FOOD_SHORTS.sql); this mirrors them for local mode and the distance chips.

test("a short is visible only inside BOTH the vendor's reach and the customer's chosen radius", () => {
  const short = { reachKm: 5, status: "active" };
  assert.equal(shortVisibleAtDistance(short, 3, 10), true);   // inside both
  assert.equal(shortVisibleAtDistance(short, 5, 10), true);   // exactly at the vendor's reach
  assert.equal(shortVisibleAtDistance(short, 5.1, 30), false); // beyond what the vendor chose, even if the customer looks wide
  assert.equal(shortVisibleAtDistance(short, 3, 1), false);   // inside the vendor's reach but outside the customer's radius
});

test("hidden or removed shorts and viewers without a pin see nothing", () => {
  assert.equal(shortVisibleAtDistance({ reachKm: 30, status: "hidden" }, 1, 30), false);
  assert.equal(shortVisibleAtDistance({ reachKm: 30, status: "removed" }, 1, 30), false);
  assert.equal(shortVisibleAtDistance({ reachKm: 30, status: "active" }, null, 30), false);
  assert.equal(shortVisibleAtDistance({ reachKm: 30, status: "active" }, undefined, 30), false);
  assert.equal(shortVisibleAtDistance({ reachKm: 30, status: "active" }, Number.NaN, 30), false);
});

test("a 30 second limit: 30 is allowed, 31 is not, unreadable lengths are refused", () => {
  assert.equal(MAX_SHORT_SECONDS, 30);
  assert.equal(checkVideoDuration(30).ok, true);
  assert.equal(checkVideoDuration(0.5).ok, true);
  const long = checkVideoDuration(30.4);
  assert.equal(long.ok, false);
  assert.match(long.message, /at most 30 seconds/);
  assert.equal(checkVideoDuration(0).ok, false);
  assert.equal(checkVideoDuration(Number.POSITIVE_INFINITY).ok, false);
});

test("file checks: type and size", () => {
  assert.equal(checkVideoFile({ type: "video/mp4", size: 5_000_000 }).ok, true);
  assert.equal(checkVideoFile({ type: "video/quicktime", size: 5_000_000 }).ok, true);
  assert.equal(checkVideoFile({ type: "video/webm", size: 5_000_000 }).ok, true);
  assert.equal(checkVideoFile({ type: "video/x-msvideo", size: 5_000_000 }).ok, false);
  assert.equal(checkVideoFile({ type: "image/png", size: 1000 }).ok, false);
  assert.equal(checkVideoFile({ type: "video/mp4", size: MAX_SHORT_BYTES + 1 }).ok, false);
  assert.equal(checkVideoFile({ type: "video/mp4", size: MAX_SHORT_BYTES }).ok, true);
  assert.equal(checkVideoFile({ type: "video/mp4", size: 0 }).ok, false);
});

test("default reach is the largest option within the store's delivery radius, never below 1 km", () => {
  assert.equal(defaultReachKm(10), 10);
  assert.equal(defaultReachKm(12), 10);
  assert.equal(defaultReachKm(4), 3);
  assert.equal(defaultReachKm(0.5), 1);
  assert.equal(defaultReachKm(undefined), 5);
  assert.equal(defaultReachKm(80), 30);
  assert.ok(REACH_OPTIONS_KM.every((km) => km >= 1 && km <= 30));
});

test("distance maths and labels", () => {
  // RS Puram to Race Course, Coimbatore: roughly 1.4 km apart
  const km = haversineKm(11.0431, 76.9805, 11.0362, 76.9741);
  assert.ok(km > 0.8 && km < 1.6, `unexpected distance ${km}`);
  assert.equal(haversineKm(11, 76, 11, 76), 0);
  assert.equal(formatDistanceKm(2.345), "2.3 km");
  assert.equal(formatDistanceKm(0.45), "500 m");
  assert.equal(formatDistanceKm(null), "");
  assert.equal(formatDuration(24), "0:24");
  assert.equal(formatDuration(30), "0:30");
});
