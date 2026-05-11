/**
 * Project Time Machine — stores the last 10 snapshots of canvas data in localStorage.
 * Each snapshot captures devices, rooms, wires, markups, layout_zones, floor_plans.
 */

const MAX_SNAPSHOTS = 10;

function storageKey(projectId) {
  return `project_snapshots_${projectId}`;
}

export function saveSnapshot(projectId, data) {
  if (!projectId) return;
  const snapshot = {
    id: `snap-${Date.now()}`,
    saved_at: new Date().toISOString(),
    devices: data.devices ?? [],
    rooms: data.rooms ?? [],
    wires: data.wires ?? [],
    markups: data.markups ?? [],
    layout_zones: data.layout_zones ?? [],
    floor_plans: data.floor_plans ?? [],
  };
  const existing = loadSnapshots(projectId);
  const next = [snapshot, ...existing].slice(0, MAX_SNAPSHOTS);
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(next));
  } catch {
    // localStorage full — drop oldest
    try {
      const trimmed = [snapshot, ...existing].slice(0, Math.max(1, MAX_SNAPSHOTS - 2));
      localStorage.setItem(storageKey(projectId), JSON.stringify(trimmed));
    } catch {
      /* ignore */
    }
  }
}

export function loadSnapshots(projectId) {
  if (!projectId) return [];
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearSnapshots(projectId) {
  if (!projectId) return;
  try {
    localStorage.removeItem(storageKey(projectId));
  } catch {
    /* ignore */
  }
}