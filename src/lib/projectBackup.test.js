import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyProjectBackup,
  isMissing,
  mergePlanSheetsByIdentity,
  mergeFloorPlansByIdentity,
  planSheetKey,
  floorPlanKey,
  readProjectBackup,
  writeProjectBackup,
} from './projectBackup.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    get __raw() { return map; },
  };
}

test('isMissing flags null / undefined / empty arrays / empty objects / blank strings', () => {
  assert.equal(isMissing(null), true);
  assert.equal(isMissing(undefined), true);
  assert.equal(isMissing([]), true);
  assert.equal(isMissing({}), true);
  assert.equal(isMissing(''), true);
  assert.equal(isMissing('   '), true);
  assert.equal(isMissing(0), false);
  assert.equal(isMissing(false), false);
  assert.equal(isMissing(['x']), false);
  assert.equal(isMissing({ a: 1 }), false);
});

test('planSheetKey and floorPlanKey are stable for matching rows', () => {
  assert.equal(planSheetKey({ id: 'abc' }), 'id:abc');
  assert.equal(planSheetKey({ file_url: 'u', page_number: 3 }), 'url:u|3');
  assert.equal(floorPlanKey({ sheet_id: 'sh1' }), 'sheet:sh1');
  assert.equal(
    floorPlanKey({ floor_number: 2, plan_type: 'Fire Alarm', file_url: 'u', page_number: 1 }),
    'floor:2|Fire Alarm|u|1'
  );
});

test('mergePlanSheetsByIdentity grafts missing assigned_floor / plan_type back onto server rows', () => {
  // This is the exact failure the user reported: server keeps the sheet rows
  // but their assignment fields get stripped, so on refresh the Plans tab shows
  // every page unassigned again. The backup remembers the assignment.
  const server = [
    { id: 'sheet-1', file_url: 'u1', page_number: 1 },
    { id: 'sheet-2', file_url: 'u1', page_number: 2 },
    { id: 'sheet-3', file_url: 'u1', page_number: 3 },
  ];
  const backup = [
    { id: 'sheet-1', file_url: 'u1', page_number: 1, assigned_floor: 1, plan_type: 'Fire Alarm' },
    { id: 'sheet-3', file_url: 'u1', page_number: 3, assigned_floor: 2, plan_type: 'Architectural' },
  ];
  const { sheets, changed } = mergePlanSheetsByIdentity(server, backup);
  assert.equal(changed, true);
  assert.equal(sheets.length, 3);
  const byId = Object.fromEntries(sheets.map((s) => [s.id, s]));
  assert.equal(byId['sheet-1'].assigned_floor, 1);
  assert.equal(byId['sheet-1'].plan_type, 'Fire Alarm');
  assert.equal(byId['sheet-2'].assigned_floor, undefined); // no backup entry → unchanged
  assert.equal(byId['sheet-3'].assigned_floor, 2);
  assert.equal(byId['sheet-3'].plan_type, 'Architectural');
});

test('mergePlanSheetsByIdentity does NOT overwrite server values with backup values', () => {
  const server = [{ id: 'sheet-1', assigned_floor: 5, plan_type: 'Electrical' }];
  const backup = [{ id: 'sheet-1', assigned_floor: 1, plan_type: 'Fire Alarm' }];
  const { sheets, changed } = mergePlanSheetsByIdentity(server, backup);
  assert.equal(changed, false);
  assert.equal(sheets[0].assigned_floor, 5);
  assert.equal(sheets[0].plan_type, 'Electrical');
});

test('mergePlanSheetsByIdentity re-adds sheets the server dropped entirely', () => {
  const server = [{ id: 'sheet-1' }];
  const backup = [{ id: 'sheet-1' }, { id: 'sheet-2', assigned_floor: 3 }];
  const { sheets, changed } = mergePlanSheetsByIdentity(server, backup);
  assert.equal(changed, true);
  assert.equal(sheets.length, 2);
  assert.equal(sheets.find((s) => s.id === 'sheet-2').assigned_floor, 3);
});

test('mergeFloorPlansByIdentity restores stripped sheet_id / plan_type / file_url on floor entries', () => {
  const server = [{ floor_number: 1, image_url: 'u1' }];
  const backup = [
    {
      floor_number: 1,
      image_url: 'u1',
      file_url: 'u1',
      file_type: 'application/pdf',
      file_name: 'Plans.pdf',
      page_number: 9,
      page_count: 24,
      plan_type: 'Fire Alarm',
      sheet_id: 'sheet-9',
      sheet_text: '',
    },
  ];
  const { plans, changed } = mergeFloorPlansByIdentity(server, backup);
  assert.equal(changed, true);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].file_url, 'u1');
  assert.equal(plans[0].plan_type, 'Fire Alarm');
  assert.equal(plans[0].sheet_id, 'sheet-9');
  assert.equal(plans[0].page_number, 9);
});

test('mergeFloorPlansByIdentity falls back to floor_number+plan_type+url identity when no sheet_id', () => {
  const server = [{ floor_number: 2, plan_type: 'Fire Alarm', image_url: 'u2', page_number: 5 }];
  const backup = [{
    floor_number: 2,
    plan_type: 'Fire Alarm',
    file_url: 'u2',
    image_url: 'u2',
    page_number: 5,
    file_name: 'Restored.pdf',
  }];
  const { plans, changed } = mergeFloorPlansByIdentity(server, backup);
  assert.equal(changed, true);
  assert.equal(plans[0].file_name, 'Restored.pdf');
});

test('applyProjectBackup reports restored=true when assignments grafted', () => {
  const project = {
    id: 'p1',
    plan_sheets: [{ id: 's1' }, { id: 's2' }],
    floor_plans: [{ floor_number: 1, image_url: 'u1' }],
  };
  const backup = {
    plan_sheets: [{ id: 's1', assigned_floor: 1, plan_type: 'Fire Alarm' }],
    floor_plans: [{
      floor_number: 1,
      image_url: 'u1',
      sheet_id: 's1',
      plan_type: 'Fire Alarm',
      page_number: 9,
    }],
  };
  const { project: merged, restored } = applyProjectBackup(project, backup);
  assert.equal(restored, true);
  assert.equal(merged.plan_sheets[0].assigned_floor, 1);
  assert.equal(merged.plan_sheets[0].plan_type, 'Fire Alarm');
  assert.equal(merged.floor_plans[0].sheet_id, 's1');
});

test('applyProjectBackup reports restored=false when server already has everything', () => {
  const project = {
    plan_sheets: [{ id: 's1', assigned_floor: 1, plan_type: 'Fire Alarm' }],
    floor_plans: [{
      floor_number: 1,
      image_url: 'u1',
      sheet_id: 's1',
      plan_type: 'Fire Alarm',
    }],
  };
  const backup = {
    plan_sheets: [{ id: 's1', assigned_floor: 1, plan_type: 'Fire Alarm' }],
    floor_plans: [{
      floor_number: 1,
      image_url: 'u1',
      sheet_id: 's1',
      plan_type: 'Fire Alarm',
    }],
  };
  const { restored } = applyProjectBackup(project, backup);
  assert.equal(restored, false);
});

test('applyProjectBackup still grafts whole missing top-level fields (layout_zones, document_workspace)', () => {
  const project = { plan_sheets: [], floor_plans: [], layout_zones: [], document_workspace: null };
  const backup = {
    layout_zones: [{ id: 'z1', floor: 1, zone_type: 'rack' }],
    document_workspace: { documents: [{ id: 'd1' }] },
  };
  const { project: merged, restored } = applyProjectBackup(project, backup);
  assert.equal(restored, true);
  assert.equal(merged.layout_zones.length, 1);
  assert.equal(merged.document_workspace.documents.length, 1);
});

test('readProjectBackup / writeProjectBackup roundtrip persists payload', () => {
  const store = memoryStorage();
  writeProjectBackup('p1', {
    plan_sheets: [{ id: 's1', assigned_floor: 1, plan_type: 'Fire Alarm' }],
    floor_plans: [{ floor_number: 1, image_url: 'u', sheet_id: 's1' }],
    layout_zones: [],
    devices: [],
    rooms: [],
  }, store);
  const read = readProjectBackup('p1', store);
  assert.ok(read);
  assert.equal(read.plan_sheets[0].assigned_floor, 1);
  assert.equal(read.floor_plans[0].sheet_id, 's1');
});

test('writeProjectBackup strips huge data-url previews when quota is exceeded', () => {
  let firstCall = true;
  const quotaStore = {
    setItem(k, v) {
      if (firstCall) {
        firstCall = false;
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      this._k = k;
      this._v = v;
    },
    getItem() { return this._v || null; },
  };
  writeProjectBackup('p1', {
    plan_sheets: [{ id: 's1', preview_url: 'data:image/png;base64,AAAAAA...', assigned_floor: 1 }],
    floor_plans: [{ floor_number: 1, rendered_image_url: 'data:image/png;base64,XXXX', sheet_id: 's1' }],
  }, quotaStore);
  // Should NOT have thrown; second attempt should succeed with previews stripped.
  const parsed = JSON.parse(quotaStore._v);
  assert.equal(parsed.plan_sheets[0].preview_url, '');
  assert.equal(parsed.plan_sheets[0].assigned_floor, 1); // assignment preserved
  assert.equal(parsed.floor_plans[0].rendered_image_url, '');
  assert.equal(parsed.floor_plans[0].sheet_id, 's1');
});

test('readProjectBackup returns null on corrupted JSON', () => {
  const store = memoryStorage();
  store.setItem('firecode_project_backup_p1', '{not-json');
  assert.equal(readProjectBackup('p1', store), null);
});
