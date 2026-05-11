import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRiserModel, SLC_DEVICE_GROUPS, NAC_DEVICE_GROUPS } from './riserModel.js';

test('buildRiserModel aggregates per-floor counts (does NOT produce one entry per device)', () => {
  const project = { name: 'Test', num_floors: 2 };
  const devices = [
    // Floor 1: 25 smokes, 5 heats, 2 pulls, 1 waterflow, 1 tamper, 8 horn/strobes
    ...Array.from({ length: 25 }, (_, i) => ({ id: `S-${i}`, type: 'smoke_detector', floor: 1, label: `SD-${i + 1}` })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: `H-${i}`, type: 'heat_detector', floor: 1, label: `HD-${i + 1}` })),
    { type: 'pull_station', floor: 1, label: 'MPS-01' },
    { type: 'pull_station', floor: 1, label: 'MPS-02' },
    { type: 'waterflow_switch', floor: 1, label: 'WF-01' },
    { type: 'valve_tamper', floor: 1, label: 'VS-01' },
    ...Array.from({ length: 8 }, (_, i) => ({ type: 'horn_strobe', floor: 1, label: `HS-${i + 1}` })),
    // Floor 2: 10 smokes, 4 horn/strobes
    ...Array.from({ length: 10 }, (_, i) => ({ type: 'smoke_detector', floor: 2, label: `SD2-${i}` })),
    ...Array.from({ length: 4 }, (_, i) => ({ type: 'horn_strobe', floor: 2, label: `HS2-${i}` })),
  ];

  const model = buildRiserModel(project, devices);

  // Top floor first → floors[0] is floor 2
  assert.equal(model.floors.length, 2);
  assert.equal(model.floors[0].number, 2);
  assert.equal(model.floors[1].number, 1);

  // Floor 1 SLC must have AT MOST 10 type-group rows — never one row per device.
  const floor1 = model.floors[1];
  assert.ok(
    floor1.slc.entries.length <= SLC_DEVICE_GROUPS.length,
    `SLC must aggregate by type, got ${floor1.slc.entries.length} entries`
  );
  // And the counts must match the totals we inserted.
  const slcEntryByKey = Object.fromEntries(floor1.slc.entries.map((e) => [e.key, e.count]));
  assert.equal(slcEntryByKey.smoke, 25);
  assert.equal(slcEntryByKey.heat, 5);
  assert.equal(slcEntryByKey.pull, 2);
  assert.equal(slcEntryByKey.waterflow, 1);
  assert.equal(slcEntryByKey.tamper, 1);

  // Floor 1 NAC: only horn/strobe present
  assert.equal(floor1.nac.entries.length, 1);
  assert.equal(floor1.nac.entries[0].key, 'hornStrobe');
  assert.equal(floor1.nac.entries[0].count, 8);

  // Floor 2 totals
  const floor2 = model.floors[0];
  const f2slc = Object.fromEntries(floor2.slc.entries.map((e) => [e.key, e.count]));
  assert.equal(f2slc.smoke, 10);
  assert.equal(floor2.nac.entries.find((e) => e.key === 'hornStrobe').count, 4);

  // Totals roll up correctly
  assert.equal(model.totals.smoke, 35);
  assert.equal(model.totals.heat, 5);
  assert.equal(model.totals.hornStrobe, 12);
});

test('buildRiserModel handles empty / no-devices project gracefully', () => {
  const model = buildRiserModel({ name: 'Empty', num_floors: 3 }, []);
  assert.equal(model.isEmpty, true);
  assert.equal(model.floors.length, 3);
  for (const floor of model.floors) {
    assert.equal(floor.slc.entries.length, 0);
    assert.equal(floor.nac.entries.length, 0);
    assert.equal(floor.aux, null);
  }
});

test('buildRiserModel emits AUX row only when AUX-typed devices exist', () => {
  const projectNoAux = { name: 'NoAux', num_floors: 1 };
  const modelNoAux = buildRiserModel(projectNoAux, [
    { type: 'smoke_detector', floor: 1 },
    { type: 'horn_strobe', floor: 1 },
  ]);
  assert.equal(modelNoAux.floors[0].aux, null);

  const modelWithAux = buildRiserModel(projectNoAux, [
    { type: 'smoke_detector', floor: 1 },
    { type: 'door_holder', floor: 1 },
    { type: 'door_holder', floor: 1 },
    { type: 'annunciator', floor: 1 },
  ]);
  assert.ok(modelWithAux.floors[0].aux, 'AUX row should exist when AUX devices present');
  const auxByKey = Object.fromEntries(modelWithAux.floors[0].aux.entries.map((e) => [e.key, e.count]));
  assert.equal(auxByKey.doorHolder, 2);
  assert.equal(auxByKey.annunciator, 1);
});

test('FACP location reflects placed FACP device when present', () => {
  const project = { name: 'P', num_floors: 2 };
  const modelDefault = buildRiserModel(project, []);
  assert.match(modelDefault.facp.location, /Floor 1/);

  const modelWithFacp = buildRiserModel(project, [{ type: 'facp', floor: 2 }]);
  assert.match(modelWithFacp.facp.location, /Floor 2/);
});

test('Device types not represented on the riser are silently dropped (no crash)', () => {
  const model = buildRiserModel({ name: 'P', num_floors: 1 }, [
    { type: 'mystery_device', floor: 1 },
    { type: 'smoke_detector', floor: 1 },
  ]);
  // smoke_detector counted, mystery_device ignored
  const slc = Object.fromEntries(model.floors[0].slc.entries.map((e) => [e.key, e.count]));
  assert.equal(slc.smoke, 1);
  assert.equal(Object.values(slc).reduce((s, v) => s + v, 0), 1);
});

test('Horn/strobe with subtype photoelectric_beam under smoke_detector goes to smokeBeam', () => {
  const model = buildRiserModel({ name: 'P', num_floors: 1 }, [
    { type: 'smoke_detector', subtype: 'photoelectric_beam', floor: 1 },
    { type: 'smoke_detector', subtype: 'photoelectric_beam', floor: 1 },
    { type: 'smoke_detector', floor: 1 },
  ]);
  const slc = Object.fromEntries(model.floors[0].slc.entries.map((e) => [e.key, e.count]));
  assert.equal(slc.smoke, 1);
  assert.equal(slc.smokeBeam, 2);
});

test('NAC device type groups are present in the canonical NAC list', () => {
  // Sanity: every NAC group has a unique key/symbol pairing
  const keys = NAC_DEVICE_GROUPS.map((g) => g.key);
  assert.equal(new Set(keys).size, keys.length, 'NAC group keys must be unique');
});
