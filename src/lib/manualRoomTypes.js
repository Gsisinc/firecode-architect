/** Dropdown values for manually drawn rooms → persisted `room_type` */
export const MANUAL_ROOM_TYPE_OPTIONS = [
  // Residential
  { value: 'dwelling_unit', label: 'Dwelling Unit (Apartment)' },
  { value: 'sleeping_room', label: 'Sleeping Room / Bedroom' },
  { value: 'hotel_room', label: 'Hotel / Motel Room' },
  // Circulation
  { value: 'corridor', label: 'Corridor / Hallway' },
  { value: 'stairwell', label: 'Stairway / Stairwell' },
  { value: 'lobby', label: 'Lobby / Entrance' },
  { value: 'elevator', label: 'Elevator / Shaft' },
  { value: 'exit', label: 'Exit / Exit Passageway' },
  // Common areas
  { value: 'office', label: 'Office' },
  { value: 'conference_room', label: 'Conference / Meeting Room' },
  { value: 'common_area', label: 'Common Area / Lounge' },
  { value: 'community_room', label: 'Community / Recreation Room' },
  { value: 'kitchen', label: 'Kitchen / Break Room' },
  { value: 'laundry', label: 'Laundry Room' },
  // Commercial / Retail
  { value: 'sales_floor', label: 'Sales Floor / Retail Area' },
  { value: 'stockroom', label: 'Stockroom / Back of House' },
  // Service / Utility
  { value: 'bathroom', label: 'Restroom / Bathroom' },
  { value: 'storage', label: 'Storage Room' },
  { value: 'mechanical_room', label: 'Mechanical Room' },
  { value: 'electrical', label: 'Electrical Room' },
  { value: 'it_room', label: 'IT / Telecom Room' },
  { value: 'janitor', label: 'Janitor / Utility Closet' },
  { value: 'garage', label: 'Garage / Parking' },
];

/** Maps manual option value to schema-friendly room_type */
export function normalizeManualRoomType(value) {
  // Keep all values as-is — the expanded set covers everything
  return value || 'office';
}

/** Fill colors (rgba) for canvas room overlays by room_type */
export const ROOM_TYPE_FILL_COLORS = {
  dwelling_unit: 'rgba(59, 130, 246, 0.15)',
  sleeping_room: 'rgba(99, 102, 241, 0.15)',
  hotel_room: 'rgba(139, 92, 246, 0.15)',
  corridor: 'rgba(148, 163, 184, 0.14)',
  stairwell: 'rgba(100, 116, 139, 0.18)',
  lobby: 'rgba(20, 184, 166, 0.14)',
  elevator: 'rgba(6, 182, 212, 0.14)',
  exit: 'rgba(239, 68, 68, 0.14)',
  office: 'rgba(59, 130, 246, 0.12)',
  conference_room: 'rgba(99, 102, 241, 0.10)',
  common_area: 'rgba(16, 185, 129, 0.12)',
  community_room: 'rgba(5, 150, 105, 0.12)',
  kitchen: 'rgba(245, 158, 11, 0.14)',
  laundry: 'rgba(251, 191, 36, 0.12)',
  sales_floor: 'rgba(236, 72, 153, 0.12)',
  stockroom: 'rgba(244, 114, 182, 0.10)',
  bathroom: 'rgba(34, 197, 94, 0.12)',
  storage: 'rgba(234, 179, 8, 0.12)',
  mechanical_room: 'rgba(168, 85, 247, 0.12)',
  electrical: 'rgba(249, 115, 22, 0.14)',
  it_room: 'rgba(14, 165, 233, 0.12)',
  janitor: 'rgba(107, 114, 128, 0.12)',
  garage: 'rgba(75, 85, 99, 0.14)',
  default: 'rgba(249, 115, 22, 0.08)',
};

export function fillColorForRoom(room) {
  const kind = room?.user_room_kind || room?.room_type || room?.type || '';
  return ROOM_TYPE_FILL_COLORS[kind] || ROOM_TYPE_FILL_COLORS.default;
}