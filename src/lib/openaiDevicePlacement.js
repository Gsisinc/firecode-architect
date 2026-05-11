import { buildDeterministicGridDevices } from '@/lib/deterministicDeviceGrid';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

function pickApiKey() {
  return (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENAI_API_KEY) ||
    (typeof globalThis !== 'undefined' && globalThis.process?.env?.VITE_OPENAI_API_KEY) ||
    ''
  );
}

function pointInRoom(px, py, room) {
  const x = Number(room.x);
  const y = Number(room.y);
  const w = Number(room.width);
  const h = Number(room.height);
  return px >= x && py >= y && px <= x + w && py <= y + h;
}

function clampToRoom(px, py, room) {
  const x = Number(room.x);
  const y = Number(room.y);
  const w = Number(room.width);
  const h = Number(room.height);
  const m = 12;
  return {
    x: Math.round(Math.min(Math.max(px, x + m), x + w - m)),
    y: Math.round(Math.min(Math.max(py, y + m), y + h - m)),
  };
}

/**
 * Calls GPT-4 class model for smoke / pull / horn-strobe pixel positions on the floor plan.
 * Falls back to deterministic grid on any failure or invalid JSON.
 */
export async function placeFireAlarmDevicesWithOpenAI({
  rooms = [],
  floor = 1,
  imageWidth = 1000,
  imageHeight = 800,
  pxPerFt = 10,
  disciplineId = 'fire_alarm',
}) {
  const apiKey = pickApiKey();
  const floorRooms = rooms.filter((r) => Number(r.floor) === Number(floor));

  const fallback = () =>
    buildDeterministicGridDevices({ rooms: floorRooms, floor, pxPerFt, disciplineId });

  if (disciplineId !== 'fire_alarm' || !floorRooms.length) {
    return { devices: [], source: 'skipped', error: null };
  }

  if (!apiKey) {
    return { devices: fallback(), source: 'deterministic_grid', error: 'VITE_OPENAI_API_KEY is not set' };
  }

  const roomPayload = floorRooms.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.room_type || r.type,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
  }));

  const userPrompt = `Floor plan bitmap coordinate space: 0,0 = top-left, ${imageWidth}px wide, ${imageHeight}px tall.
Scale hint: ~${Number(pxPerFt).toFixed(2)} pixels per foot (for spacing sanity only).
Rooms (pixel rectangles):
${JSON.stringify(roomPayload, null, 0)}

Return JSON only:
{
  "devices": [
    { "type": "smoke_detector"|"pull_station"|"horn_strobe", "room_id": "<id>", "x_px": <number>, "y_px": <number> }
  ]
}
Rules: Place smoke detectors with reasonable coverage per room (not only one). Pull station near likely egress on bottom edge of room; horn/strobe toward top or side wall. All x_px,y_px must fall inside the given room rectangle.`;

  try {
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a fire alarm preliminary layout assistant. Output only valid JSON matching the user schema. Use pixel coordinates in the image coordinate system.',
          },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        devices: fallback(),
        source: 'deterministic_grid',
        error: `OpenAI HTTP ${res.status}: ${errText.slice(0, 200)}`,
      };
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    let parsed;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return { devices: fallback(), source: 'deterministic_grid', error: 'Invalid JSON from model' };
    }

    const list = Array.isArray(parsed?.devices) ? parsed.devices : [];
    const allowed = new Set(['smoke_detector', 'pull_station', 'horn_strobe']);
    const byId = Object.fromEntries(floorRooms.map((r) => [r.id, r]));
    const built = [];
    let n = 0;
    for (const d of list) {
      const type = d.type;
      if (!allowed.has(type)) continue;
      const room = byId[d.room_id];
      if (!room) continue;
      let px = Number(d.x_px);
      let py = Number(d.y_px);
      if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
      if (!pointInRoom(px, py, room)) {
        const c = clampToRoom(px, py, room);
        px = c.x;
        py = c.y;
      }
      n += 1;
      built.push({
        id: `ai-${type}-${floor}-${n}-${Date.now().toString(36)}`,
        type,
        x: Math.round(px),
        y: Math.round(py),
        floor,
        room_id: room.id,
        label:
          type === 'smoke_detector'
            ? `S-${String(n).padStart(3, '0')}`
            : type === 'pull_station'
              ? `P-${String(n).padStart(2, '0')}`
              : `HS-${String(n).padStart(2, '0')}`,
        element_name:
          type === 'smoke_detector'
            ? 'Smoke detector'
            : type === 'pull_station'
              ? 'Manual pull station'
              : 'Horn/strobe',
        installation_status: 'Proposed',
        circuit_type: type === 'horn_strobe' ? 'NAC' : 'SLC',
        circuit: `${type === 'horn_strobe' ? 'NAC' : 'SLC'}-${floor}`,
        discipline: 'fire_alarm',
        zone: `F${floor}-Z1`,
        source: 'openai_placement',
        symbol_style: 'instruction_spec',
        mounting_height: type === 'smoke_detector' ? 'Ceiling' : 'Wall - 84 AFF',
        quantity: 1,
        installation_hours: 0.5,
        address: type !== 'horn_strobe' ? `1-${String(200 + n).padStart(3, '0')}` : '',
      });
    }

    if (!built.length) {
      return { devices: fallback(), source: 'deterministic_grid', error: 'Model returned no valid devices' };
    }

    return { devices: built, source: 'openai', error: null };
  } catch (e) {
    return {
      devices: fallback(),
      source: 'deterministic_grid',
      error: e?.message || String(e),
    };
  }
}