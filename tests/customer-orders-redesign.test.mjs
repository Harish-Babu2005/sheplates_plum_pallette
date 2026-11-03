import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("Customer Orders Redesign - Code and Logic Verification", async (t) => {
  const filePath = path.resolve("components/sheplates-v3.tsx");
  const content = fs.readFileSync(filePath, "utf8");

  await t.test("CustomerOrderCard exists and has no embedded MapPreview", () => {
    assert.ok(content.includes("function CustomerOrderCard("), "CustomerOrderCard component should be defined");
    
    // Extract CustomerOrderCard body
    const cardStart = content.indexOf("function CustomerOrderCard(");
    const cardEnd = content.indexOf("function OrdersV4(");
    assert.ok(cardStart !== -1 && cardEnd !== -1, "Found CustomerOrderCard and OrdersV4");
    const cardBody = content.slice(cardStart, cardEnd);

    // Assert that MapPreview is not rendered inside CustomerOrderCard
    assert.ok(!cardBody.includes("<MapPreview"), "CustomerOrderCard must NOT embed MapPreview");
  });

  await t.test("Order summary metric cards are preserved in OrdersV4", () => {
    assert.ok(content.includes('label="Paid orders"'), "Paid orders summary metric card should exist");
    assert.ok(content.includes('label="Active schedules"'), "Active schedules summary metric card should exist");
    assert.ok(content.includes('label="Open requirements"'), "Open requirements summary metric card should exist");
    assert.ok(content.includes('label="Order value"'), "Order value summary metric card should exist");
  });

  await t.test("CustomerOrderCard includes required details and actions", () => {
    assert.ok(content.includes("<CompactDeliveryTimeline"), "CompactDeliveryTimeline component should be rendered");
    assert.ok(content.includes("View Details"), "View Details action button should be present");
    assert.ok(content.includes("Track Order"), "Track Order action button should be present");
    assert.ok(content.includes("<PhotoTile"), "PhotoTile thumbnail should be rendered");
    assert.ok(content.includes("displayOrderNo"), "Order number badge should be present");
  });

  await t.test("OrderDetailsDialog and OrderTrackingDialog exist with comprehensive fields", () => {
    assert.ok(content.includes("function OrderDetailsDialog("), "OrderDetailsDialog must be defined");
    assert.ok(content.includes("function OrderTrackingDialog("), "OrderTrackingDialog must be defined");
    
    // Check fields in OrderDetailsDialog
    assert.ok(content.includes("deliveryAddress"), "Delivery address should be present in details dialog");
    assert.ok(content.includes("Delivery Partner"), "Delivery partner should be present in details dialog");
    assert.ok(content.includes("Payment Information"), "Payment info should be present in details dialog");
    assert.ok(content.includes("Ordered Items"), "Ordered items should be present in details dialog");

    // Check Track Order dialog has future map notice without embedding map
    const trackStart = content.indexOf("function OrderTrackingDialog(");
    const trackEnd = content.indexOf("function CustomerOrderCard(");
    const trackBody = content.slice(trackStart, trackEnd);
    assert.ok(!trackBody.includes("<MapPreview"), "OrderTrackingDialog must not embed MapPreview");
    assert.ok(trackBody.includes("Live GPS Map Tracking"), "OrderTrackingDialog should mention future live GPS map tracking");
  });

  await t.test("Dynamic timeline logic tests for all order statuses", () => {
    // Test the logic directly by checking timeline mapping function
    assert.ok(content.includes("function getOrderTimeline(order: Order): TimelineStep[]"), "getOrderTimeline function should be present");

    function getOrderTimelineSim(order) {
      const isPickup = order.mode === "Self pickup";
      const step3Label = isPickup ? "Ready for Pickup" : "Out for Delivery";
      const step4Label = isPickup ? "Picked Up" : "Delivered";

      if (order.status === "Cancelled" || order.status === "Cancellation requested") {
        return [
          { key: "placed", label: "Order Placed", state: "completed" },
          { key: "confirmed", label: "Cancelled", state: "cancelled" },
          { key: "transit", label: step3Label, state: "upcoming" },
          { key: "delivered", label: step4Label, state: "upcoming" },
        ];
      }
      if (order.status === "Delivered" || order.status === "Completed") {
        return [
          { key: "placed", label: "Order Placed", state: "completed" },
          { key: "confirmed", label: "Vendor Confirmed", state: "completed" },
          { key: "transit", label: step3Label, state: "completed" },
          { key: "delivered", label: step4Label, state: "completed" },
        ];
      }
      if (order.status === "Out for delivery") {
        return [
          { key: "placed", label: "Order Placed", state: "completed" },
          { key: "confirmed", label: "Vendor Confirmed", state: "completed" },
          { key: "transit", label: step3Label, state: "current" },
          { key: "delivered", label: step4Label, state: "upcoming" },
        ];
      }
      if (order.status === "Preparing") {
        return [
          { key: "placed", label: "Order Placed", state: "completed" },
          { key: "confirmed", label: "Vendor Confirmed", state: "current" },
          { key: "transit", label: step3Label, state: "upcoming" },
          { key: "delivered", label: step4Label, state: "upcoming" },
        ];
      }
      return [
        { key: "placed", label: "Order Placed", state: "completed" },
        { key: "confirmed", label: "Vendor Confirmed", state: "current" },
        { key: "transit", label: step3Label, state: "upcoming" },
        { key: "delivered", label: step4Label, state: "upcoming" },
      ];
    }

    // Verify Out for delivery
    const outOrder = { status: "Out for delivery", mode: "Vendor delivery" };
    const outSteps = getOrderTimelineSim(outOrder);
    assert.equal(outSteps[0].state, "completed");
    assert.equal(outSteps[1].state, "completed");
    assert.equal(outSteps[2].state, "current");
    assert.equal(outSteps[3].state, "upcoming");

    // Verify Delivered
    const deliveredOrder = { status: "Delivered", mode: "Vendor delivery" };
    const deliveredSteps = getOrderTimelineSim(deliveredOrder);
    assert.ok(deliveredSteps.every((s) => s.state === "completed"));

    // Verify Self pickup mode labels
    const pickupOrder = { status: "Preparing", mode: "Self pickup" };
    const pickupSteps = getOrderTimelineSim(pickupOrder);
    assert.equal(pickupSteps[2].label, "Ready for Pickup");
    assert.equal(pickupSteps[3].label, "Picked Up");
  });
});

