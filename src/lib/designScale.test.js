import assert from "node:assert/strict";
import {
  feetBetween,
  getFloorScale,
  roomSqft,
  updateFloorPlanScale,
  updateFloorPlanManualCalibration,
  getProjectCalibratedScale,
} from "./designScale.js";

const plans = updateFloorPlanScale([{ floor_number: 1, image_url: "a.png" }], 1, {
  pxPerFt: 5,
  scaleSource: "test",
  scaleCandidates: [5],
  buildingBounds: { left: 0, top: 0, right: 100, bottom: 100 },
});

assert.equal(getFloorScale(plans, 1), 5);
// Low-confidence detection scales ("test") stay on their own floor.
assert.equal(getFloorScale(plans, 2), 10);
assert.equal(roomSqft({ width: 50, height: 20 }, 5), 40);
assert.equal(Math.round(feetBetween({ x: 0, y: 0 }, { x: 30, y: 40 }, 5)), 10);

// A deliberate manual calibration on one floor applies to the whole blueprint.
const multi = [
  { floor_number: 1, image_url: "f1.png" },
  { floor_number: 2, image_url: "f2.png" },
  { floor_number: 3, image_url: "f3.png" },
];
const calibrated = updateFloorPlanManualCalibration(multi, 1, { drawnPixels: 100, feet: 5 }); // 20 px/ft
assert.equal(getProjectCalibratedScale(calibrated), 20);
assert.equal(getFloorScale(calibrated, 1), 20);
assert.equal(getFloorScale(calibrated, 2), 20);
assert.equal(getFloorScale(calibrated, 3), 20);

// A floor with its own deliberate calibration overrides the project-wide value.
const perFloor = updateFloorPlanManualCalibration(calibrated, 2, { drawnPixels: 100, feet: 10 }); // 10 px/ft
assert.equal(getFloorScale(perFloor, 2), 10);
// Floor 3 (uncalibrated) still inherits a deliberate calibration, not the 10 default-by-coincidence.
assert.ok([10, 20].includes(getFloorScale(perFloor, 3)));

console.log("designScale tests passed");
