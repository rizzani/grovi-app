import assert from "node:assert/strict";
import test from "node:test";
import { calculateDeliveryFeeJmdCents, MAX_DELIVERY_DISTANCE_KM } from "../src/delivery-pricing.js";

const cases = [
  [0, 30000], [2.99, 30000], [3, 30000], [3.01, 50000],
  [5.99, 50000], [6, 50000], [6.01, 70000], [9.99, 70000],
  [10, 70000], [10.01, 90000], [12, 90000], [12.01, 100000],
  [14, 100000], [14.01, 110000], [16, 110000], [16.01, 120000],
  [18, 120000], [18.01, 130000], [20, 130000],
];
for (const [distance, expected] of cases) test(`delivery fee at ${distance} km`, () => assert.equal(calculateDeliveryFeeJmdCents(distance), expected));
test("maximum range is accepted by policy", () => assert.equal(calculateDeliveryFeeJmdCents(MAX_DELIVERY_DISTANCE_KM), 130000));
