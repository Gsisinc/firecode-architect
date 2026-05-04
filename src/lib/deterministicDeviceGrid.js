const CELL_FT = 30;
const MARGIN_PX = 14;

function id(prefix, floor, suffix) {
  return `${prefix}-${floor}-${suffix}-${Date.now().toString(36)}`;
}

/**
 * Fallback placement when OpenAI fails: 30ft × 30ft grid of smokes (cell centers),
 * pull at bottom-left of room, horn/strobe at top-right.
 */
export function buildDeterministicGridDevices({
  rooms = [],
  floor = 1,
  pxPerFt = 10,
  disciplineId = 'fire_alarm',
}) {
  if (disciplineId !== 'fire_alarm') return [];
  const cellPx = CELL_FT * Number(pxPerFt) || 300;
  const devices = [];

  rooms
    .filter((r) => Number(r.floor) === Number(floor))
    .forEach((room, roomIdx) => {
      const x = Number(room.x) || 0;
      const y = Number(room.y) || 0;
      const width = Number(room.width) || 0;
      const height = Number(room.height) || 0;
      if (width < 20 || height < 20) return;

      let cx = x + Math.min(cellPx / 2, width / 2);
      let col = 0;
      while (cx < x + width - MARGIN_PX) {
        let cy = y + Math.min(cellPx / 2, height / 2);
        let row = 0;
        while (cy < y + height - MARGIN_PX) {
          devices.push({
            id: id('smoke', floor, `g-${roomIdx}-${row}-${col}`),
            type: 'smoke_detector',
            x: Math.round(cx),
            y: Math.round(cy),
            floor,
            room_id: room.id,
            label: `S-${String(devices.length + 1).padStart(3, '0')}`,
            element_name: 'Smoke detector',
            installation_status: 'Proposed',
            circuit_type: 'SLC',
            circuit: `SLC-${floor}`,
            discipline: 'fire_alarm',
            zone: `F${floor}-Z1`,
            source: 'deterministic_grid',
            symbol_style: 'instruction_spec',
            mounting_height: 'Ceiling',
            quantity: 1,
            installation_hours: 0.5,
            address: `1-${String(100 + devices.length).padStart(3, '0')}`,
          });
          cy += cellPx;
          row += 1;
        }
        cx += cellPx;
        col += 1;
      }

      devices.push({
        id: id('pull', floor, `p-${roomIdx}`),
        type: 'pull_station',
        x: Math.round(x + MARGIN_PX),
        y: Math.round(y + height - MARGIN_PX),
        floor,
        room_id: room.id,
        label: `P-${String(roomIdx + 1).padStart(2, '0')}`,
        element_name: 'Manual pull station',
        installation_status: 'Proposed',
        circuit_type: 'SLC',
        circuit: `SLC-${floor}`,
        discipline: 'fire_alarm',
        zone: `F${floor}-Z1`,
        source: 'deterministic_grid',
        symbol_style: 'instruction_spec',
        mounting_height: 'Wall - 84 AFF',
        quantity: 1,
        installation_hours: 0.5,
      });

      devices.push({
        id: id('hs', floor, `h-${roomIdx}`),
        type: 'horn_strobe',
        x: Math.round(x + width - MARGIN_PX),
        y: Math.round(y + MARGIN_PX),
        floor,
        room_id: room.id,
        label: `HS-${String(roomIdx + 1).padStart(2, '0')}`,
        element_name: 'Horn/strobe',
        installation_status: 'Proposed',
        circuit_type: 'NAC',
        circuit: `NAC-${floor}`,
        discipline: 'fire_alarm',
        zone: `F${floor}-Z1`,
        source: 'deterministic_grid',
        symbol_style: 'instruction_spec',
        mounting_height: 'Wall - 84 AFF',
        quantity: 1,
        installation_hours: 0.5,
      });
    });

  return devices;
}
