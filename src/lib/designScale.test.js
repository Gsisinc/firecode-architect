import assert from "node:assert/strict";
import { feetBetween, getFloorScale, roomSqft, updateFloorPlanScale } from "./designScale.js";

const plans = updateFloorPlanScale([{ floor_number: 1, image_url: "a.png" }], 1, {
  pxPerFt: 5,
  scaleSource: "test",
  scaleCandidates: [5],
  buildingBounds: { left: 0, top: 0, right: 100, bottom: 100 },
});

assert.equal(getFloorScale(plans, 1), 5);
assert.equal(getFloorScale(plans, 2), 10);
assert.equal(roomSqft({ width: 50, height: 20 }, 5), 40);
assert.equal(Math.round(feetBetween({ x: 0, y: 0 }, { x: 30, y: 40 }, 5)), 10);

console.log("designScale tests passed");
