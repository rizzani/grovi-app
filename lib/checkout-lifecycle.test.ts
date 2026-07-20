import assert from "node:assert/strict";
import test from "node:test";
import { finishSuccessfulCheckout, materialInputsMatch, reusableAttempt, SubmissionGate } from "./checkout-lifecycle";

const original = { addressId: "address-1", cartRevision: "revision-1", paymentMethod: "cash_on_delivery" };

test("double tap admits only one submission", () => {
  const gate = new SubmissionGate();
  assert.equal(gate.enter(), true);
  assert.equal(gate.enter(), false);
  gate.leave();
  assert.equal(gate.enter(), true);
});

test("timeout retry and app restart reuse materially identical attempt", () => {
  assert.equal(materialInputsMatch(original, { ...original }), true);
  const persisted = { state: "outcome_unknown", request: original, clientRequestId: "same-uuid" };
  assert.equal(reusableAttempt(persisted, { ...original })?.clientRequestId, "same-uuid");
});

test("address, cart revision, and payment changes require a new attempt", () => {
  assert.equal(materialInputsMatch(original, { ...original, addressId: "address-2" }), false);
  assert.equal(materialInputsMatch(original, { ...original, cartRevision: "revision-2" }), false);
  assert.equal(materialInputsMatch(original, { ...original, paymentMethod: "card" }), false);
});

test("successful order navigates after cart reconciliation", async () => {
  const events: string[] = [];
  await finishSuccessfulCheckout(async () => { events.push("clear"); }, () => events.push("navigate"), () => events.push("warn"));
  assert.deepEqual(events, ["clear", "navigate"]);
});

test("cart clear failure still navigates and does not resubmit", async () => {
  const events: string[] = [];
  await finishSuccessfulCheckout(async () => { throw new Error("offline"); }, () => events.push("navigate"), () => events.push("reconcile-later"));
  assert.deepEqual(events, ["reconcile-later", "navigate"]);
});
