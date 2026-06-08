import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  roomRequiresHeatDetector,
  heatDetectorRuleForRoom,
  isParkingGarageRoom,
  calculateSmokeDetectorPlacement,
  calculateHeatDetectorPlacement,
  calculateSpeakerStrobePlacement,
  calculateParkingGarageNotification,
  determineSystemRequirements,
} from './codeEngine.js';

// ── P1: room type → detector type mapping (NFPA 72 §17.8 / FA-005 R-03..R-08) ──

test('high-risk rooms require heat detectors, not smoke', () => {
  const heatRooms = [
    'electrical', 'Electrical Room', 'switchgear', 'emergency generator', 'fire pump room',
    'mechanical room', 'boiler room', 'trash room', 'refuse compactor', 'ev electrical',
    'elevator machine room', 'commercial kitchen', 'laundry', 'loading dock',
  ];
  for (const name of heatRooms) {
    assert.equal(roomRequiresHeatDetector({ name }), true, `${name} should require heat detector`);
  }
});

test('standard rooms still use smoke detectors', () => {
  for (const name of ['office', 'corridor', 'lobby', 'conference', 'storage', 'sleeping_room']) {
    assert.equal(roomRequiresHeatDetector({ room_type: name }), false, `${name} should NOT require heat`);
  }
});

test('parking garage is heat-detector + identifiable', () => {
  assert.equal(isParkingGarageRoom({ room_type: 'garage' }), true);
  assert.equal(isParkingGarageRoom({ name: 'Parking Level P1' }), true);
  assert.equal(isParkingGarageRoom({ name: 'bike room' }), false);
  assert.equal(roomRequiresHeatDetector({ room_type: 'garage' }), true);
});

test('heat rule carries a code citation', () => {
  const rule = heatDetectorRuleForRoom({ room_type: 'electrical' });
  assert.ok(rule);
  assert.match(rule.code, /17\.8/);
});

test('placement: electrical room gets HD and no SD', () => {
  const room = { id: 'r1', room_type: 'electrical', x: 0, y: 0, width: 200, height: 200, sqft: 400, floor: 1 };
  const sds = calculateSmokeDetectorPlacement([room], { default: 9 });
  const hds = calculateHeatDetectorPlacement([room], { default: 9 });
  assert.equal(sds.length, 0, 'no smoke detectors in electrical room');
  assert.ok(hds.length >= 1, 'at least one heat detector in electrical room');
});

test('placement: office gets SD and no HD', () => {
  const room = { id: 'r2', room_type: 'office', x: 0, y: 0, width: 200, height: 200, sqft: 400, floor: 1 };
  assert.ok(calculateSmokeDetectorPlacement([room], { default: 9 }).length >= 1);
  assert.equal(calculateHeatDetectorPlacement([room], { default: 9 }).length, 0);
});

// ── P2: voice evac → all NAC speaker-strobe (IBC §907.5.2.3 / FA-005 R-02) ──

test('R-2 high-rise (11 floors) forces voice evac', () => {
  const res = determineSystemRequirements({
    occupancy_group: 'R-2',
    num_floors: 11,
    total_occupant_load: 200,
    sprinkler_status: 'Full (NFPA 13)',
    default_ceiling_height: 10,
  });
  assert.equal(res.fireAlarmRequired, true);
  assert.equal(res.voiceEvacRequired, true);
  assert.equal(res.highRise, true);
  assert.equal(res.notificationApplianceType, 'speaker_strobe');
});

test('low-rise R-2 does NOT force voice evac', () => {
  const res = determineSystemRequirements({
    occupancy_group: 'R-2',
    num_floors: 4,
    total_occupant_load: 60,
    sprinkler_status: 'Full (NFPA 13)',
    default_ceiling_height: 10,
  });
  assert.equal(res.voiceEvacRequired, false);
  assert.equal(res.notificationApplianceType, 'horn_strobe');
});

test('speaker-strobe placement emits speaker_strobe devices', () => {
  const rooms = [{ id: 'r1', room_type: 'office', x: 0, y: 0, width: 200, height: 200, sqft: 400, floor: 1 }];
  const devices = calculateSpeakerStrobePlacement(rooms);
  assert.equal(devices.length, 1);
  assert.equal(devices[0].type, 'speaker_strobe');
});

// ── P3: parking garage egress-path NAC (NFPA 72 §18.5.4 / FA-004 §6.1) ──

test('13,748 SF garage gets 10+ speaker-strobes (not 2)', () => {
  // ~136 ft x ~101 ft at 10 px/ft → 1360 x 1010 px
  const garage = { id: 'g1', room_type: 'garage', x: 0, y: 0, width: 1360, height: 1010, sqft: 13748, floor: 1 };
  const devices = calculateParkingGarageNotification([garage], { pxPerFt: 10, deviceType: 'speaker_strobe' });
  assert.ok(devices.length >= 10, `expected >=10 garage devices, got ${devices.length}`);
  assert.ok(devices.every((d) => d.type === 'speaker_strobe'), 'all garage NAC are speaker-strobes in voice evac');
});

test('garage NAC honors non-voice strobe selection', () => {
  const garage = { id: 'g1', room_type: 'garage', x: 0, y: 0, width: 800, height: 400, sqft: 3200, floor: 1 };
  const devices = calculateParkingGarageNotification([garage], { pxPerFt: 10, deviceType: 'strobe' });
  assert.ok(devices.every((d) => d.type === 'strobe'));
});
