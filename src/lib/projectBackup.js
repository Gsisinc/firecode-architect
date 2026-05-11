/**
 * LocalStorage-backed safety net for project state.
 *
 * The Base44 entity layer can silently strip nested fields that aren't yet
 * declared in the project schema (e.g. plan-sheet `assigned_floor`,
 * `plan_type`, custom floor-plan metadata). When that happens the user sees
 * sheets still present after a refresh but every page assignment is gone.
 *
 * This module mirrors save attempts into localStorage and provides
 * identity-based merging that grafts missing per-sheet / per-floor fields
 * back onto the server payload on remount.
 */

export const BACKUP_KEYS = [
  'rooms',
  'devices',
  'wires',
  'markups',
  'layout_zones',
  'floor_plans',
  'plan_sheets',
  'plan_categories',
  'document_workspace',
  'analysis_results',
];

export const BACKUP_STORAGE_KEY = (projectId) => `firecode_project_backup_${projectId || ''}`;

export function readProjectBackup(projectId, storage) {
  const store = storage || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!projectId || !store) return null;
  try {
    const raw = store.getItem(BACKUP_STORAGE_KEY(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (error) {
    if (typeof console !== 'undefined') console.warn('[projectBackup] read failed', error);
    return null;
  }
}

export function writeProjectBackup(projectId, payload, storage) {
  const store = storage || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!projectId || !store || !payload) return;
  try {
    const subset = {};
    BACKUP_KEYS.forEach((key) => {
      if (payload[key] !== undefined) subset[key] = payload[key];
    });
    subset.__updatedAt = new Date().toISOString();
    store.setItem(BACKUP_STORAGE_KEY(projectId), JSON.stringify(subset));
  } catch (error) {
    // localStorage quota — try a slim copy without huge data URLs (previews).
    try {
      const slim = {};
      BACKUP_KEYS.forEach((key) => {
        if (payload[key] === undefined) return;
        if (key === 'plan_sheets' || key === 'floor_plans') {
          slim[key] = (payload[key] || []).map((entry) => {
            const copy = { ...entry };
            if (typeof copy.preview_url === 'string' && copy.preview_url.startsWith('data:')) copy.preview_url = '';
            if (typeof copy.rendered_image_url === 'string' && copy.rendered_image_url.startsWith('data:')) copy.rendered_image_url = '';
            return copy;
          });
        } else {
          slim[key] = payload[key];
        }
      });
      slim.__updatedAt = new Date().toISOString();
      store.setItem(BACKUP_STORAGE_KEY(projectId), JSON.stringify(slim));
    } catch (secondary) {
      if (typeof console !== 'undefined') console.warn('[projectBackup] write failed', secondary);
    }
  }
}

export function isMissing(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

// ── Identity-based merge helpers ──────────────────────────────────────────
// The previous merge replaced empty arrays wholesale. That's not enough when
// the server keeps the array but drops sub-fields (which is the actual
// failure mode for plan-sheet assignments). These helpers match by stable
// identity and graft any missing field from the backup onto the server row.

// Identity for a plan sheet — we return MULTIPLE possible keys so we can
// still match a backup row to a server row when the server stripped one of
// the identifying fields (sheet.id is the failure mode in practice).
export function planSheetKeys(sheet) {
  if (!sheet) return [];
  const keys = [];
  if (sheet.id) keys.push(`id:${sheet.id}`);
  const url = sheet.file_url || sheet.file_name || '';
  const page = sheet.page_number ?? '';
  if (url || page !== '') keys.push(`url:${url}|${page}`);
  return keys;
}

// Identity for a floor_plans entry. Server commonly strips `sheet_id` and
// `plan_type` and even `file_url`, so we offer several keys per row.
export function floorPlanKeys(plan) {
  if (!plan) return [];
  const keys = [];
  if (plan.sheet_id) keys.push(`sheet:${plan.sheet_id}`);
  const floor = plan.floor_number ?? '';
  const type = plan.plan_type || 'floor_plan';
  const url = plan.file_url || plan.image_url || '';
  const page = plan.page_number ?? '';
  if (floor !== '' || url) {
    keys.push(`floor:${floor}|${type}|${url}|${page}`);
    // Looser fallback — same floor + same url even if plan_type/page differ.
    if (url) keys.push(`floor-url:${floor}|${url}`);
  }
  return keys;
}

// Backwards-compatible single-key helpers (still used by tests)
export const planSheetKey = (s) => planSheetKeys(s)[0] || '';
export const floorPlanKey = (p) => floorPlanKeys(p)[0] || '';

function graftMissingFields(server, backup) {
  const out = { ...server };
  let changed = false;
  for (const k of Object.keys(backup)) {
    if (isMissing(out[k]) && !isMissing(backup[k])) {
      out[k] = backup[k];
      changed = true;
    }
  }
  return changed ? out : null;
}

// Generic merge that supports MULTIPLE identity keys per row so a backup
// row matches a server row even when the server stripped one of the keys.
function mergeArrayByIdentity(serverArr, backupArr, keysOf) {
  const server = Array.isArray(serverArr) ? serverArr : [];
  const backup = Array.isArray(backupArr) ? backupArr : [];
  if (server.length === 0) return { merged: backup, changed: backup.length > 0 };
  if (backup.length === 0) return { merged: server, changed: false };

  const keyToBackup = new Map();
  for (const b of backup) {
    for (const k of keysOf(b)) {
      if (!keyToBackup.has(k)) keyToBackup.set(k, b);
    }
  }

  let changed = false;
  const usedBackup = new Set();
  const merged = server.map((srv) => {
    let bk = null;
    for (const k of keysOf(srv)) {
      if (keyToBackup.has(k)) {
        bk = keyToBackup.get(k);
        break;
      }
    }
    if (!bk) return srv;
    usedBackup.add(bk);
    const grafted = graftMissingFields(srv, bk);
    if (grafted) {
      changed = true;
      return grafted;
    }
    return srv;
  });

  for (const b of backup) {
    if (!usedBackup.has(b)) {
      merged.push(b);
      changed = true;
    }
  }

  return { merged, changed };
}

export function mergePlanSheetsByIdentity(serverSheets, backupSheets) {
  const { merged, changed } = mergeArrayByIdentity(serverSheets, backupSheets, planSheetKeys);
  return { sheets: merged, changed };
}

export function mergeFloorPlansByIdentity(serverPlans, backupPlans) {
  const { merged, changed } = mergeArrayByIdentity(serverPlans, backupPlans, floorPlanKeys);
  return { plans: merged, changed };
}

/**
 * Merge a server project with the localStorage backup. Returns the merged
 * project plus a `restored` flag indicating whether ANY field was grafted
 * back from the backup (so the caller can trigger an auto-resync save).
 */
export function applyProjectBackup(project, backup) {
  if (!project) return { project, restored: false };
  if (!backup) return { project, restored: false };

  const merged = { ...project };
  let restored = false;

  // plan_sheets: per-sheet identity merge (handles dropped per-sheet fields)
  const sheetsResult = mergePlanSheetsByIdentity(merged.plan_sheets, backup.plan_sheets);
  merged.plan_sheets = sheetsResult.sheets;
  if (sheetsResult.changed) restored = true;

  // floor_plans: per-plan identity merge (handles dropped sheet_id, plan_type)
  const plansResult = mergeFloorPlansByIdentity(merged.floor_plans, backup.floor_plans);
  merged.floor_plans = plansResult.plans;
  if (plansResult.changed) restored = true;

  // Other top-level fields: graft only when the server returned nothing
  for (const key of BACKUP_KEYS) {
    if (key === 'plan_sheets' || key === 'floor_plans') continue;
    if (isMissing(merged[key]) && !isMissing(backup[key])) {
      merged[key] = backup[key];
      restored = true;
    }
  }

  return { project: merged, restored };
}
