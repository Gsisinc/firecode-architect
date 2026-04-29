import { useRef, useEffect, useState, useCallback } from 'react';
import { routeCircuits, drawCircuitRoutes } from '@/lib/circuitRouter';

// NFPA 170 Standard Fire Protection Symbols
const NFPA_SYMBOLS = {
  smoke_detector: { color: '#2563eb', draw: (ctx, x, y, r, selected) => {
    // NFPA 170: Circle with 'S' - photoelectric smoke
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = selected ? '#dbeafe' : '#fff';
    ctx.fill();
    ctx.strokeStyle = '#2563eb'; ctx.lineWidth = selected ? 2.5 : 1.8; ctx.stroke();
    ctx.fillStyle = '#2563eb'; ctx.font = `bold ${r * 0.9}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('S', x, y);
  }},
  heat_detector: { color: '#d97706', draw: (ctx, x, y, r, selected) => {
    // NFPA 170: Circle with 'H'
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = selected ? '#fef3c7' : '#fff';
    ctx.fill();
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = selected ? 2.5 : 1.8; ctx.stroke();
    ctx.fillStyle = '#d97706'; ctx.font = `bold ${r * 0.9}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('H', x, y);
  }},
  pull_station: { color: '#dc2626', draw: (ctx, x, y, r, selected) => {
    // NFPA 170: Solid red square (manual station)
    const s = r * 1.6;
    ctx.beginPath(); ctx.rect(x - s/2, y - s/2, s, s);
    ctx.fillStyle = selected ? '#fee2e2' : '#fff5f5';
    ctx.fill();
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = selected ? 2.5 : 1.8; ctx.stroke();
    ctx.fillStyle = '#dc2626'; ctx.font = `bold ${r * 0.75}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('MPS', x, y);
  }},
  horn_strobe: { color: '#ea580c', draw: (ctx, x, y, r, selected) => {
    // NFPA 170: Square with diagonal lines (horn/strobe combo)
    const s = r * 1.6;
    ctx.beginPath(); ctx.rect(x - s/2, y - s/2, s, s);
    ctx.fillStyle = selected ? '#ffedd5' : '#fff7ed';
    ctx.fill();
    ctx.strokeStyle = '#ea580c'; ctx.lineWidth = selected ? 2.5 : 1.8; ctx.stroke();
    // Diagonal stripes for strobe
    ctx.save(); ctx.clip();
    ctx.strokeStyle = '#ea580c'; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.3;
    for (let i = -s; i < s * 2; i += 5) {
      ctx.beginPath(); ctx.moveTo(x - s/2 + i, y - s/2); ctx.lineTo(x - s/2 + i + s, y + s/2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#ea580c'; ctx.font = `bold ${r * 0.65}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('H/S', x, y);
  }},
  strobe: { color: '#7c3aed', draw: (ctx, x, y, r, selected) => {
    // NFPA 170: Square with 'CD' (candela strobe)
    const s = r * 1.6;
    ctx.beginPath(); ctx.rect(x - s/2, y - s/2, s, s);
    ctx.fillStyle = selected ? '#ede9fe' : '#faf5ff';
    ctx.fill();
    ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = selected ? 2.5 : 1.8; ctx.stroke();
    ctx.fillStyle = '#7c3aed'; ctx.font = `bold ${r * 0.7}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CD', x, y);
  }},
  speaker: { color: '#0891b2', draw: (ctx, x, y, r, selected) => {
    // NFPA 170: Speaker symbol (trapezoid)
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y - r * 0.6);
    ctx.lineTo(x + r * 0.5, y - r);
    ctx.lineTo(x + r * 0.5, y + r);
    ctx.lineTo(x - r * 0.5, y + r * 0.6);
    ctx.closePath();
    ctx.fillStyle = selected ? '#cffafe' : '#ecfeff';
    ctx.fill();
    ctx.strokeStyle = '#0891b2'; ctx.lineWidth = selected ? 2.5 : 1.8; ctx.stroke();
    ctx.fillStyle = '#0891b2'; ctx.font = `bold ${r * 0.7}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('SP', x, y);
  }},
  duct_detector: { color: '#4f46e5', draw: (ctx, x, y, r, selected) => {
    // NFPA 170: Rectangle with 'D' (duct detector)
    const w = r * 2.5, h = r * 1.4;
    ctx.beginPath(); ctx.rect(x - w/2, y - h/2, w, h);
    ctx.fillStyle = selected ? '#e0e7ff' : '#eef2ff';
    ctx.fill();
    ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = selected ? 2.5 : 1.8; ctx.stroke();
    // Dashes on sides (duct indication)
    ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(x - w/2 - 6, y); ctx.lineTo(x - w/2, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w/2, y); ctx.lineTo(x + w/2 + 6, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#4f46e5'; ctx.font = `bold ${r * 0.8}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('D', x, y);
  }},
  waterflow_switch: { color: '#059669', draw: (ctx, x, y, r, selected) => {
    // NFPA 170: Diamond shape (flow switch)
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.3);
    ctx.lineTo(x + r * 1.3, y);
    ctx.lineTo(x, y + r * 1.3);
    ctx.lineTo(x - r * 1.3, y);
    ctx.closePath();
    ctx.fillStyle = selected ? '#d1fae5' : '#ecfdf5';
    ctx.fill();
    ctx.strokeStyle = '#059669'; ctx.lineWidth = selected ? 2.5 : 1.8; ctx.stroke();
    ctx.fillStyle = '#059669'; ctx.font = `bold ${r * 0.65}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('WF', x, y);
  }},
  valve_tamper: { color: '#0d9488', draw: (ctx, x, y, r, selected) => {
    // NFPA 170: Diamond with 'VS'
    ctx.beginPath();
    ctx.moveTo(x, y - r * 1.3);
    ctx.lineTo(x + r * 1.3, y);
    ctx.lineTo(x, y + r * 1.3);
    ctx.lineTo(x - r * 1.3, y);
    ctx.closePath();
    ctx.fillStyle = selected ? '#ccfbf1' : '#f0fdfa';
    ctx.fill();
    ctx.strokeStyle = '#0d9488'; ctx.lineWidth = selected ? 2.5 : 1.8; ctx.stroke();
    ctx.fillStyle = '#0d9488'; ctx.font = `bold ${r * 0.65}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('VS', x, y);
  }},
  co_detector: { color: '#65a30d', draw: (ctx, x, y, r, selected) => {
    // NFPA 170: Circle with 'CO'
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = selected ? '#ecfccb' : '#f7fee7';
    ctx.fill();
    ctx.strokeStyle = '#65a30d'; ctx.lineWidth = selected ? 2.5 : 1.8; ctx.stroke();
    // Double ring for CO
    ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
    ctx.strokeStyle = '#65a30d'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = '#65a30d'; ctx.font = `bold ${r * 0.65}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('CO', x, y);
  }},
  facp: { color: '#dc2626', draw: (ctx, x, y, r, selected) => {
    // NFPA 170: Rectangle panel symbol
    const w = r * 3, h = r * 1.8;
    ctx.beginPath(); ctx.rect(x - w/2, y - h/2, w, h);
    ctx.fillStyle = selected ? '#fee2e2' : '#fff5f5';
    ctx.fill();
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = selected ? 2.5 : 2; ctx.stroke();
    // Inner border
    ctx.beginPath(); ctx.rect(x - w/2 + 2, y - h/2 + 2, w - 4, h - 4);
    ctx.strokeStyle = '#dc2626'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.fillStyle = '#dc2626'; ctx.font = `bold ${r * 0.7}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('FACP', x, y);
  }},
  elevator_recall: { color: '#7c3aed', draw: (ctx, x, y, r, selected) => {
    // Circle with 'E' (elevator recall detector)
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = selected ? '#ede9fe' : '#faf5ff';
    ctx.fill();
    ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = selected ? 2.5 : 1.8; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
    ctx.strokeStyle = '#7c3aed'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = '#7c3aed'; ctx.font = `bold ${r * 0.8}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('E', x, y);
  }},
};

const DEVICE_RADIUS = 14; // world pixels
const GRID_SIZE = 20;

function snapToGrid(val, enabled) {
  if (!enabled) return val;
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}

function getSymbol(type, subtype) {
  return NFPA_SYMBOLS[subtype] || NFPA_SYMBOLS[type] || NFPA_SYMBOLS['smoke_detector'];
}

export default function FloorPlanCanvas({
  floorPlanUrl,
  devices = [],
  rooms = [],
  layers = {},
  selectedTool = 'select',
  snapGrid = false,
  onDevicesChange,
  onRoomsChange,
  onDeviceSelect,
  selectedDevice,
  currentFloor,
  canvasRef: externalCanvasRef,
  onRoomNameRequest,
  wires = [],
  onWiresChange,
}) {
  const internalCanvasRef = useRef(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(null);
  const [drawingRoom, setDrawingRoom] = useState(null);
  const [wireStart, setWireStart] = useState(null); // device id
  const [mouseWorld, setMouseWorld] = useState(null);
  const [floorImg, setFloorImg] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });

  // Load floor plan image + zoom to fit
  useEffect(() => {
    if (!floorPlanUrl) { setFloorImg(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setFloorImg(img);
      // Fit image to canvas on load
      const container = containerRef.current;
      if (!container) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const padding = 40;
      const scaleX = (cw - padding * 2) / img.width;
      const scaleY = (ch - padding * 2) / img.height;
      const fitScale = Math.min(scaleX, scaleY, 1);
      setScale(fitScale);
      setOffset({
        x: (cw - img.width * fitScale) / 2,
        y: (ch - img.height * fitScale) / 2,
      });
    };
    img.src = floorPlanUrl;
  }, [floorPlanUrl]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setCanvasSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(-offset.x / scale, -offset.y / scale, canvasSize.w / scale, canvasSize.h / scale);

    // Subtle dot grid background
    ctx.fillStyle = 'rgba(148,163,184,0.25)';
    const dotSpacing = 30;
    const startX = Math.floor(-offset.x / scale / dotSpacing) * dotSpacing;
    const startY = Math.floor(-offset.y / scale / dotSpacing) * dotSpacing;
    for (let gx = startX; gx < startX + canvasSize.w / scale + dotSpacing; gx += dotSpacing) {
      for (let gy = startY; gy < startY + canvasSize.h / scale + dotSpacing; gy += dotSpacing) {
        ctx.beginPath(); ctx.arc(gx, gy, 0.8, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Floor plan image
    if (floorImg) {
      ctx.drawImage(floorImg, 0, 0, floorImg.width, floorImg.height);
    }

    // Grid overlay
    if (layers.grid) {
      ctx.strokeStyle = 'rgba(59,130,246,0.2)';
      ctx.lineWidth = 0.5;
      for (let gx = 0; gx < 4000; gx += GRID_SIZE) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, 3000); ctx.stroke();
      }
      for (let gy = 0; gy < 3000; gy += GRID_SIZE) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(4000, gy); ctx.stroke();
      }
    }

    // Rooms
    if (layers.rooms !== false) {
      rooms.filter(r => r.floor === currentFloor).forEach(room => {
        ctx.strokeStyle = 'rgba(249,115,22,0.7)';
        ctx.fillStyle = 'rgba(249,115,22,0.05)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.rect(room.x, room.y, room.width, room.height);
        ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        if (layers.labels !== false) {
          ctx.fillStyle = 'rgba(234,88,12,0.9)';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(room.name || 'Room', room.x + 6, room.y + 6);
          if (room.sqft) {
            ctx.font = '9px Inter, sans-serif';
            ctx.fillStyle = 'rgba(234,88,12,0.6)';
            ctx.fillText(`${room.sqft} sf`, room.x + 6, room.y + 20);
          }
        }
      });
    }

    // Drawing room preview
    if (drawingRoom) {
      const { x, y, ex, ey } = drawingRoom;
      ctx.strokeStyle = '#f97316';
      ctx.fillStyle = 'rgba(249,115,22,0.08)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.rect(Math.min(x, ex), Math.min(y, ey), Math.abs(ex - x), Math.abs(ey - y));
      ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      // Size label
      const w = Math.abs(ex - x), h = Math.abs(ey - y);
      if (w > 20 && h > 20) {
        ctx.fillStyle = '#f97316';
        ctx.font = 'bold 10px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(w)}×${Math.round(h)}px`, Math.min(x,ex)+w/2, Math.min(y,ey)+h/2);
      }
    }

    // Circuit routes
    if (layers.circuits) {
      try {
        const routes = routeCircuits(devices, rooms, currentFloor);
        drawCircuitRoutes(ctx, routes, layers.labels !== false);
      } catch(e) { /* circuit routing optional */ }
    }

    // Wires
    if (wires && wires.filter) {
      wires.filter(w => w.floor === currentFloor).forEach(wire => {
        const a = devices.find(d => d.id === wire.from);
        const b = devices.find(d => d.id === wire.to);
        if (!a || !b || a.x == null || b.x == null) return;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = wire.type === 'NAC' ? '#ea580c' : '#2563eb';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        // Wire length label
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const ft = Math.round(dist / 10); // fallback if no calibrated scale is available
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(mx - 20, my - 9, 40, 13);
        ctx.fillStyle = wire.type === 'NAC' ? '#ea580c' : '#2563eb';
        ctx.font = '8px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`~${ft}ft`, mx, my);
      });
    }

    // Live wire preview
    if (wireStart && mouseWorld) {
      const a = devices.find(d => d.id === wireStart);
      if (a && a.x != null) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(mouseWorld.x, mouseWorld.y);
        ctx.strokeStyle = 'rgba(37,99,235,0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Devices — NFPA 170 symbols
    devices.filter(d => d.floor === currentFloor).forEach(device => {
      if (device.x == null || device.y == null) return;
      const isSelected = selectedDevice?.id === device.id;
      const sym = getSymbol(device.type, device.subtype);
      const r = DEVICE_RADIUS;

      ctx.save();
      if (isSelected) {
        ctx.shadowColor = sym.color;
        ctx.shadowBlur = 12;
      }
      sym.draw(ctx, device.x, device.y, r, isSelected);
      ctx.shadowBlur = 0;

      // Label below
      if (layers.labels !== false) {
        const labelText = device.label || device.id || '';
        ctx.font = '8px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const lw = ctx.measureText(labelText).width + 6;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fillRect(device.x - lw/2, device.y + r + 2, lw, 11);
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(device.x - lw/2, device.y + r + 2, lw, 11);
        ctx.fillStyle = '#1e293b';
        ctx.fillText(labelText, device.x, device.y + r + 4);
      }
      ctx.restore();
    });

    ctx.restore();
  }, [floorImg, devices, rooms, layers, scale, offset, selectedDevice, drawingRoom, canvasSize, currentFloor, wires, wireStart, mouseWorld]);

  const toWorld = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - offset.x) / scale,
      y: (e.clientY - rect.top - offset.y) / scale,
    };
  }, [offset, scale]);

  const fitToCanvas = useCallback(() => {
    if (floorImg) {
      const cw = canvasSize.w, ch = canvasSize.h;
      const padding = 40;
      const fitScale = Math.min((cw - padding*2) / floorImg.width, (ch - padding*2) / floorImg.height, 1);
      setScale(fitScale);
      setOffset({ x: (cw - floorImg.width * fitScale) / 2, y: (ch - floorImg.height * fitScale) / 2 });
    } else {
      setScale(1); setOffset({ x: 0, y: 0 });
    }
  }, [floorImg, canvasSize]);

  const handleMouseDown = useCallback((e) => {
    const world = toWorld(e);
    if (e.button === 1 || selectedTool === 'pan') {
      setDragging({ type: 'pan', start: { x: e.clientX - offset.x, y: e.clientY - offset.y } });
      return;
    }
    if (selectedTool === 'room') {
      setDrawingRoom({ x: world.x, y: world.y, ex: world.x, ey: world.y });
      return;
    }
    if (selectedTool === 'delete') {
      const floorDevs = devices.filter(d => d.floor === currentFloor);
      const hit = [...floorDevs].reverse().find(d =>
        d.x != null && Math.hypot(world.x - d.x, world.y - d.y) < DEVICE_RADIUS + 4
      );
      if (hit) onDevicesChange(devices.filter(d => d.id !== hit.id));
      return;
    }
    if (selectedTool === 'wire') {
      const floorDevs = devices.filter(d => d.floor === currentFloor);
      const hit = [...floorDevs].reverse().find(d =>
        d.x != null && Math.hypot(world.x - d.x, world.y - d.y) < DEVICE_RADIUS + 6
      );
      if (hit) {
        if (!wireStart) {
          setWireStart(hit.id);
        } else if (wireStart !== hit.id) {
          const isNAC = ['horn_strobe','strobe','speaker','horn'].includes(hit.type) || ['horn_strobe','strobe','speaker','horn'].includes(devices.find(d=>d.id===wireStart)?.type);
          const newWire = { id: `wire-${Date.now()}`, from: wireStart, to: hit.id, floor: currentFloor, type: isNAC ? 'NAC' : 'SLC' };
          if (onWiresChange) onWiresChange([...(wires||[]), newWire]);
          setWireStart(null);
        } else {
          setWireStart(null);
        }
      } else {
        setWireStart(null);
      }
      return;
    }
    if (selectedTool?.startsWith('place_device_')) {
      const devType = selectedTool.replace('place_device_', '');
      const sym = NFPA_SYMBOLS[devType] || NFPA_SYMBOLS['smoke_detector'];
      const newDev = {
        id: `${devType}-${Date.now()}`,
        type: devType,
        subtype: devType,
        x: snapToGrid(world.x, snapGrid),
        y: snapToGrid(world.y, snapGrid),
        floor: currentFloor,
        label: `${devType.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-4)}`,
        address: `1-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`,
        zone: `F${currentFloor}-Z1`,
        circuit: 'SLC-1',
        mounting_height: 'Ceiling',
      };
      onDevicesChange([...devices, newDev]);
      return;
    }
    // Select / move
    if (selectedTool === 'select' || !selectedTool) {
      const floorDevs = devices.filter(d => d.floor === currentFloor);
      const hit = [...floorDevs].reverse().find(d =>
        d.x != null && Math.hypot(world.x - d.x, world.y - d.y) < DEVICE_RADIUS + 4
      );
      if (hit) {
        onDeviceSelect(hit);
        setDragging({ type: 'device', id: hit.id, startX: world.x - hit.x, startY: world.y - hit.y });
      } else {
        onDeviceSelect(null);
        setDragging({ type: 'pan', start: { x: e.clientX - offset.x, y: e.clientY - offset.y } });
      }
    }
  }, [selectedTool, toWorld, offset, devices, currentFloor, onDevicesChange, onDeviceSelect, snapGrid]);

  const handleMouseMove = useCallback((e) => {
    if (selectedTool === 'wire') {
      setMouseWorld(toWorld(e));
    }
    if (drawingRoom && !dragging) {
      const world = toWorld(e);
      setDrawingRoom(r => r ? { ...r, ex: world.x, ey: world.y } : null);
      return;
    }
    if (!dragging) return;
    if (dragging.type === 'pan') {
      setOffset({ x: e.clientX - dragging.start.x, y: e.clientY - dragging.start.y });
    } else if (dragging.type === 'device') {
      const world = toWorld(e);
      onDevicesChange(devices.map(d =>
        d.id === dragging.id
          ? { ...d, x: snapToGrid(world.x - dragging.startX, snapGrid), y: snapToGrid(world.y - dragging.startY, snapGrid) }
          : d
      ));
    }
    if (drawingRoom) {
      const world = toWorld(e);
      setDrawingRoom(r => r ? { ...r, ex: world.x, ey: world.y } : null);
    }
  }, [dragging, drawingRoom, toWorld, devices, onDevicesChange, snapGrid]);

  const handleMouseUp = useCallback((e) => {
    if (selectedTool === 'room' && drawingRoom) {
      const { x, y, ex, ey } = drawingRoom;
      const rx = Math.min(x, ex), ry = Math.min(y, ey);
      const rw = Math.abs(ex - x), rh = Math.abs(ey - y);
      if (rw > 15 && rh > 15) {
        // Use callback instead of browser prompt
        if (onRoomNameRequest) {
          onRoomNameRequest({ x: Math.round(rx), y: Math.round(ry), width: Math.round(rw), height: Math.round(rh) });
        } else {
          const name = prompt('Room name:', 'Room') || 'Room';
          onRoomsChange([...rooms, {
            id: `room-${Date.now()}`, floor: currentFloor, name,
            x: Math.round(rx), y: Math.round(ry), width: Math.round(rw), height: Math.round(rh),
            sqft: Math.round(rw * rh / 9), ceiling_height: 9, ceiling_type: 'smooth_flat',
          }]);
        }
      }
      setDrawingRoom(null);
    }
    setDragging(null);
  }, [selectedTool, drawingRoom, rooms, onRoomsChange, currentFloor, onRoomNameRequest]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    const newScale = Math.max(0.05, Math.min(8, scale * factor));
    // Zoom toward mouse position
    setOffset(prev => ({
      x: mouseX - (mouseX - prev.x) * (newScale / scale),
      y: mouseY - (mouseY - prev.y) * (newScale / scale),
    }));
    setScale(newScale);
  }, [scale]);

  const getCursor = () => {
    if (selectedTool === 'pan' || dragging?.type === 'pan') return dragging ? 'grabbing' : 'grab';
    if (selectedTool === 'room') return 'crosshair';
    if (selectedTool === 'delete') return 'not-allowed';
    if (selectedTool === 'wire') return wireStart ? 'cell' : 'crosshair';
    if (selectedTool?.startsWith('place_device_')) return 'copy';
    return 'default';
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-slate-100">
      <canvas
        ref={canvasRef}
        width={canvasSize.w}
        height={canvasSize.h}
        style={{ cursor: getCursor(), display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setDragging(null); setDrawingRoom(null); }}
        onWheel={handleWheel}
      />
      {/* Zoom Controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
        <button onClick={() => setScale(s => Math.min(8, s * 1.2))} className="w-8 h-8 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center justify-center font-bold shadow-sm text-lg leading-none">+</button>
        <button onClick={fitToCanvas} title="Fit to canvas" className="w-8 h-8 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center justify-center text-sm shadow-sm">⊡</button>
        <button onClick={() => setScale(s => Math.max(0.05, s / 1.2))} className="w-8 h-8 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center justify-center font-bold shadow-sm text-lg leading-none">−</button>
      </div>
      {/* Status bar */}
      <div className="absolute top-3 left-3 bg-white/90 border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-500 font-mono flex items-center gap-2 shadow-sm z-10">
        <span>{Math.round(scale * 100)}%</span>
        <span className="text-gray-300">|</span>
        <span>Floor {currentFloor}</span>
        {snapGrid && <><span className="text-gray-300">|</span><span className="text-blue-500 font-semibold">SNAP</span></>}
        {selectedTool?.startsWith('place_device_') && (
          <><span className="text-gray-300">|</span><span className="text-orange-500 font-semibold">PLACING — click to add</span></>
        )}
        {selectedTool === 'room' && (
          <><span className="text-gray-300">|</span><span className="text-orange-500 font-semibold">DRAW ROOM — drag to define</span></>
        )}
        {selectedTool === 'delete' && (
          <><span className="text-gray-300">|</span><span className="text-red-500 font-semibold">DELETE — click device</span></>
        )}
        {selectedTool === 'wire' && (
          <><span className="text-gray-300">|</span><span className="text-blue-500 font-semibold">{wireStart ? 'WIRE — click target device' : 'WIRE — click source device'}</span></>
        )}
      </div>
    </div>
  );
}

// Export NFPA symbol info for sidebar use
export { NFPA_SYMBOLS };