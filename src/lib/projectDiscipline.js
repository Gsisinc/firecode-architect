import { DISCIPLINE_IDS, DISCIPLINES } from '@/lib/disciplines';

/** Last project opened from the dashboard (sidebar “open in discipline”). */
export const SYSTEMS_LAST_PROJECT_KEY = 'systemsLastProjectId';

/** Discipline stored on the project record for dashboard badges and default designer route. */
export function getProjectPrimaryDiscipline(project) {
  const raw = project?.primary_discipline;
  if (raw && DISCIPLINES[raw]) return raw;
  return DISCIPLINE_IDS.FIRE_ALARM;
}

export function normalizeDisciplineParam(value) {
  if (value && DISCIPLINES[value]) return value;
  return null;
}
