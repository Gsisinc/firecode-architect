/** Dropdown values for manually drawn rooms → persisted `room_type` */
export const MANUAL_ROOM_TYPE_OPTIONS = [
  { value: 'office', label: 'Office' },
  { value: 'corridor', label: 'Corridor' },
  { value: 'storage', label: 'Storage' },
  { value: 'mechanical_room', label: 'Mechanical' },
  { value: 'bathroom', label: 'Restroom' },
  { value: 'exit', label: 'Exit' },
  { value: 'electrical', label: 'Electrical' },
];

/** Maps manual option value to schema-friendly room_type */
export function normalizeManualRoomType(value) {
  if (value === 'exit') return 'corridor';
  if (value === 'electrical') return 'mechanical_room';
  return value || 'office';
}

/** Fill colors (rgba) for canvas room overlays by room_type */
export const ROOM_TYPE_FILL_COLORS = {
  office: 'rgba(59, 130, 246, 0.12)',
  corridor: 'rgba(148, 163, 184, 0.14)',
  storage: 'rgba(234, 179, 8, 0.12)',
  mechanical_room: 'rgba(168, 85, 247, 0.12)',
  bathroom: 'rgba(34, 197, 94, 0.12)',
  exit: 'rgba(239, 68, 68, 0.12)',
  electrical: 'rgba(249, 115, 22, 0.12)',
  default: 'rgba(249, 115, 22, 0.08)',
};

export function fillColorForRoom(room) {
  if (room?.user_room_kind === 'exit') return ROOM_TYPE_FILL_COLORS.exit;
  if (room?.user_room_kind === 'electrical') return ROOM_TYPE_FILL_COLORS.electrical;
  const t = room?.room_type || room?.type || '';
  return ROOM_TYPE_FILL_COLORS[t] || ROOM_TYPE_FILL_COLORS.default;
}
