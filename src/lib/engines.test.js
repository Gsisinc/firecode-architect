import { test } from 'node:test';
import assert from 'node:assert/strict';

import { specForDeviceType, buildEquipmentList } from './deviceLibrary.js';
import {
  checkSmokeCoverage, checkHeatCoverage, requiredStrobeCandela, checkStrobeSelection,
  checkPullStationTravel, sizeBattery, checkNacVoltageDrop, reviewDesign,
} from './complianceEngine.js';
import { detectorCoverageCircles, smokeCoverageGaps } from './coverageModel.js';
import { extractWallSegments, snapPointToWalls, closestPointOnSegment } from './wallSnap.js';

test('device library resolves seeded specs + CSFM', () => {
  const smoke = specForDeviceType('smoke_detector');
  assert.equal(smoke.model, 'SD365');
  assert.equal(smoke.csfm, '7272-0075:0502');
  const hs = specForDeviceType('horn_strobe');
  assert.ok(hs.candela.includes(15));
});

test('equipment list aggregates quantities', () => {
  const list = buildEquipmentList([
    { type: 'smoke_detector' }, { type: 'smoke_detector' }, { type: 'pull_station' },
  ]);
  const smokeRow = list.find((r) => r.key === 'smoke_detector');
  assert.equal(smokeRow.qty, 2);
});

test('smoke coverage: 900sf=1 device, 1801sf needs 3', () => {
  assert.equal(checkSmokeCoverage(900, 1).ok, true);
  const big = checkSmokeCoverage(1801, 1);
  assert.equal(big.value.required, 3);
  assert.equal(big.ok, false);
  assert.match(big.section, /17\.7/);
});

test('heat coverage uses 2500sf cells', () => {
  assert.equal(checkHeatCoverage(2500, 1).ok, true);
  assert.equal(checkHeatCoverage(5001, 2).value.required, 3);
});

test('strobe candela by room size (NFPA table)', () => {
  assert.equal(requiredStrobeCandela(20).value.candela, 15);
  assert.equal(requiredStrobeCandela(35).value.candela, 60);
  assert.equal(requiredStrobeCandela(50).value.candela, 95);
  assert.equal(requiredStrobeCandela(80).value.multipleRequired, true);
  assert.equal(checkStrobeSelection(50, 75).ok, false);
  assert.equal(checkStrobeSelection(50, 95).ok, true);
});

test('pull station travel limit 200ft', () => {
  assert.equal(checkPullStationTravel(199).ok, true);
  assert.equal(checkPullStationTravel(201).ok, false);
});

test('battery sizing applies derate + cites 10.6.10', () => {
  const r = sizeBattery([{ type: 'smoke_detector' }, { type: 'horn_strobe' }], { standbyHours: 24, alarmMinutes: 5 });
  assert.ok(r.value.requiredAh > 0);
  // requiredAh must exceed raw (derate applied)
  assert.ok(r.value.requiredAh > r.value.rawAh);
  assert.match(r.section, /10\.6\.10/);
});

test('NAC voltage drop fails on long thin run, passes when short', () => {
  const bad = checkNacVoltageDrop(1.0, 1000, 16, 20.4);
  assert.equal(bad.ok, false);
  assert.ok(bad.value.endVolts < 16);
  const good = checkNacVoltageDrop(0.2, 100, 14, 20.4);
  assert.equal(good.ok, true);
});

test('coverage circles use 21ft smoke radius', () => {
  const circles = detectorCoverageCircles([{ type: 'smoke_detector', x: 100, y: 100, floor: 1 }], 10, 1);
  assert.equal(circles.length, 1);
  assert.equal(Math.round(circles[0].r), 210); // 21ft * 10px/ft
});

test('coverage gaps flags an uncovered room', () => {
  const rooms = [{ floor: 1, x: 0, y: 0, width: 600, height: 600 }];
  const gaps = smokeCoverageGaps(rooms, [], 10, 1, 30);
  assert.equal(gaps[0].gap, true);
});

test('wall extraction + snapping', () => {
  const paths = [{ pts: [[0, 100], [400, 100]] }, { pts: [[0, 0], [0, 300]] }];
  const walls = extractWallSegments(paths, { minLenPx: 24, axisTolPx: 3 });
  assert.equal(walls.length, 2);
  const snap = snapPointToWalls(200, 112, walls, 18);
  assert.equal(snap.snapped, true);
  assert.equal(snap.y, 100);
  const seg = closestPointOnSegment(200, 112, 0, 100, 400, 100);
  assert.equal(Math.round(seg.dist), 12);
});

test('reviewDesign returns cited checks + summary', () => {
  const rooms = [{ floor: 1, name: 'Office', x: 0, y: 0, width: 300, height: 300, sqft: 900 }];
  const devices = [{ type: 'smoke_detector', x: 150, y: 150, floor: 1 }];
  const { checks, summary } = reviewDesign({ rooms, devices, pxPerFt: 10, activeFloor: 1 });
  assert.ok(checks.length >= 2);
  assert.ok(checks.every((c) => c.code && c.section));
  assert.ok(summary.pass + summary.fail + summary.review === checks.length);
});
