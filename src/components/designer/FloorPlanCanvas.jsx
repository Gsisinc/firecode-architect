import { useRef, useEffect, useState, useCallback } from 'react';
import { DeviceSymbol } from './DesignerSidebar';

const DEVICE_INFO = {
  smoke_detector: { color: '#3b82f6', shape: 'circle', symbol: 'S' },
  heat_detector: { color: '#f59e0b', shape: 'circle', symbol: 'H' },
  pull_station: { color: '#ef4444', shape: 'square', symbol: 'F' },
  horn_strobe: { color: '#f97316', shape: 'square', symbol: 'HS' },
  strobe: { color: '#8b5cf6', shape: 'square', symbol: 'CD' },
  speaker: { color: '#06b6d4', shape: 'square', symbol: 'SW' },
  duct_detector: { color: '#6366f1', shape: 'circle', symbol: 'D' },
  waterflow_switch: { color: '#10b981', shape: 'circle', symbol: 'WF' },
  valve_tamper: { color: '#14b8a6', shape: 'circle', symbol: 'VS' },
  co_detector: { color: '#84cc16', shape: 'circle', symbol: 'CO' },
  facp: { color: '#ef4444', shape: 'rect', symbol: 'FACP' },
  elevator_recall: { color: '#a78bfa', shape: 'circle', symbol: 'S' },
};

const DEVICE_SIZE = 22;

export default function FloorPlanCanvas({
  floorPlanUrl,
  devices = [],
  rooms = [],
  layers = {},
  selectedTool = 'select',
  selectedDeviceType = null,
  onDevicesChange,
  onRoomsChange,
  onDeviceSelect,
  selectedDevice,
  currentFloor,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(null); // { type: 'device'|'pan'|'room', id?, start, current }
  const [drawingRoom, setDrawingRoom] = useState(null);
  const [floorImg, setFloorImg] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });

  // Load floor plan image
  useEffect(() => {
    if (!floorPlanUrl) { setFloorImg(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setFloorImg(img);
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
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 3000, 2000);

    // Floor plan image
    if (floorImg) {
      ctx.drawImage(floorImg, 0, 0, floorImg.width, floorImg.height);
    } else {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 0, canvasSize.w / scale, canvasSize.h / scale);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '18px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Upload a floor plan to begin', (canvasSize.w / scale) / 2, (canvasSize.h / scale) / 2);
    }

    // Grid overlay
    if (layers.grid) {
      const gridPx = 30 * 3; // 30 ft × 3 px/ft
      ctx.strokeStyle = 'rgba(59,130,246,0.15)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < 3000; x += gridPx) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 2000); ctx.stroke();
      }
      for (let y = 0; y < 2000; y += gridPx) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(3000, y); ctx.stroke();
      }
    }

    // Rooms
    if (layers.rooms !== false) {
      rooms.filter(r => r.floor === currentFloor).forEach(room => {
        ctx.strokeStyle = 'rgba(249,115,22,0.6)';
        ctx.fillStyle = 'rgba(249,115,22,0.06)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.rect(room.x, room.y, room.width, room.height);
        ctx.fill(); ctx.stroke();
        ctx.setLineDash([]);
        if (layers.labels !== false) {
          ctx.fillStyle = 'rgba(249,115,22,0.8)';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.textAlign = 'left';
          ctx.fillText(room.name || 'Room', room.x + 4, room.y + 14);
          if (room.sqft) {
            ctx.font = '8px JetBrains Mono, monospace';
            ctx.fillStyle = 'rgba(249,115,22,0.5)';
            ctx.fillText(`${room.sqft} sf`, room.x + 4, room.y + 25);
          }
        }
      });
    }

    // Drawing room preview
    if (drawingRoom) {
      const { x, y, ex, ey } = drawingRoom;
      ctx.strokeStyle = '#f97316';
      ctx.fillStyle = 'rgba(249,115,22,0.1)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.rect(Math.min(x, ex), Math.min(y, ey), Math.abs(ex - x), Math.abs(ey - y));
      ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Circuit lines
    if (layers.circuits) {
      const floorDevices = devices.filter(d => d.floor === currentFloor);
      const byCircuit = {};
      floorDevices.forEach(d => {
        const c = d.circuit || 'default';
        if (!byCircuit[c]) byCircuit[c] = [];
        byCircuit[c].push(d);
      });
      const circuitColors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'];
      Object.entries(byCircuit).forEach(([circuit, devs], ci) => {
        if (devs.length < 2) return;
        ctx.strokeStyle = circuitColors[ci % circuitColors.length] + '60';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        devs.forEach((d, i) => {
          if (i === 0) ctx.moveTo(d.x, d.y);
          else ctx.lineTo(d.x, d.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // Devices
    devices.filter(d => d.floor === currentFloor).forEach(device => {
      const info = DEVICE_INFO[device.subtype] || DEVICE_INFO[device.type] || { color: '#94a3b8', shape: 'circle', symbol: '?' };
      const isSelected = selectedDevice?.id === device.id;
      const x = device.x;
      const y = device.y;
      const size = DEVICE_SIZE;
      const half = size / 2;
      const color = info.color;

      ctx.save();
      if (isSelected) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
      }

      if (info.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(x, y, half, 0, Math.PI * 2);
        ctx.fillStyle = color + '30';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = `bold ${info.symbol.length > 2 ? 6 : 8}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(info.symbol, x, y + 3);
      } else if (info.shape === 'square') {
        ctx.beginPath();
        ctx.rect(x - half, y - half, size, size);
        ctx.fillStyle = color + '30';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = `bold ${info.symbol.length > 2 ? 6 : 8}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(info.symbol, x, y + 3);
      } else if (info.shape === 'rect') {
        const rw = 36, rh = 16;
        ctx.beginPath();
        ctx.rect(x - rw / 2, y - rh / 2, rw, rh);
        ctx.fillStyle = color + '30';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 2 : 1.5;
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.font = 'bold 6px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(info.symbol, x, y + 2);
      }

      ctx.restore();

      // Label
      if (layers.labels !== false && (isSelected || layers.labels)) {
        ctx.fillStyle = '#1e293b';
        ctx.font = '7px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        const labelText = device.label || device.id;
        const lw = ctx.measureText(labelText).width + 4;
        ctx.fillRect(x - lw / 2, y + half + 1, lw, 9);
        ctx.fillStyle = '#0f172a';
        ctx.fillText(labelText, x, y + half + 9);
      }
    });

    ctx.restore();
  }, [floorImg, devices, rooms, layers, scale, offset, selectedDevice, drawingRoom, canvasSize, currentFloor]);

  // World coordinates from canvas event
  const toWorld = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - offset.x) / scale,
      y: (e.clientY - rect.top - offset.y) / scale,
    };
  }, [offset, scale]);

  const handleMouseDown = useCallback((e) => {
    const world = toWorld(e);

    if (selectedTool === 'pan') {
      setDragging({ type: 'pan', start: { x: e.clientX - offset.x, y: e.clientY - offset.y } });
      return;
    }

    if (selectedTool === 'room') {
      setDrawingRoom({ x: world.x, y: world.y, ex: world.x, ey: world.y });
      return;
    }

    if (selectedTool?.startsWith('place_device_')) {
      const devType = selectedTool.replace('place_device_', '');
      const info = DEVICE_INFO[devType] || { color: '#94a3b8', shape: 'circle', symbol: '?' };
      const newDev = {
        id: `${devType}-${Date.now()}`,
        type: devType,
        subtype: devType,
        symbol: info.symbol,
        x: world.x,
        y: world.y,
        floor: currentFloor,
        label: `${devType.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-4)}`,
        address: `1-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`,
        zone: `F${currentFloor}-Z1`,
        circuit: `SLC-1`,
        mounting_height: 'Ceiling',
      };
      onDevicesChange([...devices, newDev]);
      return;
    }

    if (selectedTool === 'select' || !selectedTool) {
      const floorDevs = devices.filter(d => d.floor === currentFloor);
      const hit = [...floorDevs].reverse().find(d => {
        const dx = Math.abs(world.x - d.x);
        const dy = Math.abs(world.y - d.y);
        return dx < DEVICE_SIZE && dy < DEVICE_SIZE;
      });
      if (hit) {
        onDeviceSelect(hit);
        setDragging({ type: 'device', id: hit.id, startX: world.x - hit.x, startY: world.y - hit.y });
      } else {
        onDeviceSelect(null);
        setDragging({ type: 'pan', start: { x: e.clientX - offset.x, y: e.clientY - offset.y } });
      }
    }
  }, [selectedTool, toWorld, offset, devices, currentFloor, onDevicesChange, onDeviceSelect]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging) {
      if (drawingRoom) {
        const world = toWorld(e);
        setDrawingRoom(r => ({ ...r, ex: world.x, ey: world.y }));
      }
      return;
    }
    if (dragging.type === 'pan') {
      setOffset({ x: e.clientX - dragging.start.x, y: e.clientY - dragging.start.y });
    } else if (dragging.type === 'device') {
      const world = toWorld(e);
      onDevicesChange(devices.map(d =>
        d.id === dragging.id
          ? { ...d, x: Math.round(world.x - dragging.startX), y: Math.round(world.y - dragging.startY) }
          : d
      ));
    }
    if (drawingRoom) {
      const world = toWorld(e);
      setDrawingRoom(r => r ? { ...r, ex: world.x, ey: world.y } : null);
    }
  }, [dragging, drawingRoom, toWorld, devices, onDevicesChange]);

  const handleMouseUp = useCallback((e) => {
    if (selectedTool === 'room' && drawingRoom) {
      const { x, y, ex, ey } = drawingRoom;
      const rx = Math.min(x, ex), ry = Math.min(y, ey);
      const rw = Math.abs(ex - x), rh = Math.abs(ey - y);
      if (rw > 10 && rh > 10) {
        const name = prompt('Room name:', 'Room');
        const newRoom = {
          id: `room-${Date.now()}`,
          floor: currentFloor,
          name: name || 'Room',
          x: Math.round(rx),
          y: Math.round(ry),
          width: Math.round(rw),
          height: Math.round(rh),
          sqft: Math.round(rw * rh / 9), // rough conversion px to sqft
          ceiling_height: 9,
          ceiling_type: 'smooth_flat',
        };
        onRoomsChange([...rooms, newRoom]);
      }
      setDrawingRoom(null);
    }
    setDragging(null);
  }, [selectedTool, drawingRoom, rooms, onRoomsChange, currentFloor]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setScale(s => Math.max(0.1, Math.min(5, s * factor)));
  }, []);

  const getCursor = () => {
    if (selectedTool === 'pan') return 'grab';
    if (dragging?.type === 'pan') return 'grabbing';
    if (selectedTool === 'room') return 'crosshair';
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
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button onClick={() => setScale(s => Math.min(5, s * 1.2))} className="w-8 h-8 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center justify-center text-sm font-bold shadow-sm">+</button>
        <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }} className="w-8 h-8 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center justify-center text-xs shadow-sm">⊡</button>
        <button onClick={() => setScale(s => Math.max(0.1, s / 1.2))} className="w-8 h-8 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center justify-center text-sm font-bold shadow-sm">−</button>
      </div>
      <div className="absolute bottom-4 left-4 bg-white/80 border border-gray-200 rounded px-2 py-1 text-xs text-gray-500 font-mono">
        {Math.round(scale * 100)}% · Floor {currentFloor}
      </div>
    </div>
  );
}