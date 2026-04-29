import test from "node:test";
import assert from "node:assert/strict";
import { mergeGeneratedDevices, validateDesign, calculateWireLengthSummary } from "./designValidation.js";

test("mergeGeneratedDevices preserves manual devices and replaces generated devices on selected floor", () => {
  const existing = [
    { id: "manual-f1", floor: 1, type: "facp", x: 1, y: 1 },
    { id: "generated-old", floor: 1, type: "smoke_detector", generated_by: "auto_place", x: 10, y: 10 },
    { id: "generated-f2", floor: 2, type: "smoke_detector", generated_by: "auto_place", x: 20, y: 20 },
  ];
  const generated = [{ id: "new", floor: 1, type: "smoke_detector", x: 30, y: 30 }];
  const merged = mergeGeneratedDevices(existing, generated, 1);

  assert.equal(merged.some((d) => d.id === "manual-f1"), true);
  assert.equal(merged.some((d) => d.id === "generated-old"), false);
  assert.equal(merged.some((d) => d.id === "generated-f2"), true);
  assert.equal(merged.some((d) => d.id === "new" && d.generated_by === "auto_place"), true);
});

test("calculateWireLengthSummary uses calibrated floor scale", () => {
  const devices = [
    { id: "a", floor: 1, x: 0, y: 0, circuit: "NAC-1" },
    { id: "b", floor: 1, x: 30, y: 40, circuit: "NAC-1" },
  ];
  const wires = [{ from: "a", to: "b", floor: 1, type: "NAC" }];
  const summary = calculateWireLengthSummary({
    devices,
    wires,
    floorPlans: [{ floor_number: 1, px_per_ft: 10 }],
  });

  assert.equal(summary.totalFeet, 5);
  assert.equal(summary.byCircuit[0].segments, 1);
});

test("validateDesign reports missing core design elements", () => {
  const validation = validateDesign({
    project: { name: "Test", num_floors: 1, sprinkler_status: "None", analysis_results: { fireAlarmRequired: true } },
    rooms: [],
    devices: [],
    wires: [],
    floorPlans: [],
  });

  const codes = validation.issues.map((issue) => issue.code);
  assert.equal(codes.includes("ROOMS_MISSING"), true);
  assert.equal(codes.includes("DEVICES_MISSING"), true);
  assert.equal(codes.includes("FACP_MISSING"), true);
  assert.equal(validation.counts.errors >= 3, true);
});
