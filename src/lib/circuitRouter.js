/**
 * Circuit Path Routing Engine
 * Computes minimal-length wire routes between devices on the same circuit.
 * Uses a simple MST (Prim's algorithm) to find shortest spanning tree for each circuit group,
 * then routes each edge along room wall boundaries to avoid obstacles.
 *
 * NEC §760: Fire alarm wiring must be protected from physical damage.
 * GSIS Guide §9.2: Minimize exposed wiring runs; follow building structure.
 */

/**
 * Compute Euclidean distance between two points
 */
function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Prim's MST: returns an array of edges {from, to, length}
 * representing the minimum spanning tree for the device positions.
 * @param {Array} nodes - array of {id, x, y}
 */
function buildMST(nodes) {
  if (nodes.length < 2) return [];
  const inMST = new Set([nodes[0].id]);
  const edges = [];

  while (inMST.size < nodes.length) {
    let bestEdge = null;
    let bestDist = Infinity;
    for (const fromId of inMST) {
      const from = nodes.find(n => n.id === fromId);
      for (const to of nodes) {
        if (inMST.has(to.id)) continue;
        const d = dist(from, to);
        if (d < bestDist) {
          bestDist = d;
          bestEdge = { from, to, length: d };
        }
      }
    }
    if (!bestEdge) break;
    inMST.add(bestEdge.to.id);
    edges.push(bestEdge);
  }

  return edges;
}

/**
 * Given two points and a list of room obstacles, route an L-shaped path
 * that hugs the room boundaries (horizontal then vertical, or vertical then horizontal).
 * Picks the route that minimizes overlap with room interiors.
 *
 * Returns an array of waypoints: [{x, y}, ...]
 */
function routeEdge(from, to, rooms) {
  // Two candidate L-shaped routes
  const routeA = [{ x: from.x, y: from.y }, { x: to.x, y: from.y }, { x: to.x, y: to.y }];
  const routeB = [{ x: from.x, y: from.y }, { x: from.x, y: to.y }, { x: to.x, y: to.y }];

  // Score routes by how much they pass through room interiors
  // (We prefer routes along room edges / outside rooms)
  function scoreRoute(pts) {
    let score = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i], p2 = pts[i + 1];
      // Sample midpoint of segment
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      // Count how many rooms this midpoint is inside (interior = bad)
      rooms.forEach(r => {
        if (mx > r.x + 5 && mx < r.x + r.width - 5 && my > r.y + 5 && my < r.y + r.height - 5) {
          score++; // penalise routing through room interiors
        }
      });
    }
    return score;
  }

  return scoreRoute(routeA) <= scoreRoute(routeB) ? routeA : routeB;
}

/**
 * Main routing function.
 * Groups devices by circuit, runs MST per group, routes each edge avoiding room interiors.
 *
 * @param {Array} devices - array of device objects with {id, type, circuit, floor, x, y}
 * @param {Array} rooms - array of room objects with {id, floor, x, y, width, height}
 * @param {number} currentFloor - only route devices on this floor
 * @returns {Array} routes - array of { circuit, circuitType, color, totalLength, segments: [{points}] }
 */
export function routeCircuits(devices, rooms, currentFloor) {
  const CIRCUIT_COLORS = {
    SLC: "#3b82f6",
    NAC: "#f97316",
    default: "#94a3b8",
  };

  // Group devices by circuit
  const circuitGroups = {};
  devices
    .filter(d => d.floor === currentFloor && d.x != null && d.y != null)
    .forEach(d => {
      const key = d.circuit || "SLC-1";
      if (!circuitGroups[key]) circuitGroups[key] = [];
      circuitGroups[key].push({ id: d.id, x: d.x, y: d.y, type: d.type });
    });

  const floorRooms = rooms.filter(r => r.floor === currentFloor);
  const routes = [];

  Object.entries(circuitGroups).forEach(([circuit, nodes]) => {
    if (nodes.length < 2) return;

    const mstEdges = buildMST(nodes);
    const segments = mstEdges.map(edge => ({
      points: routeEdge(edge.from, edge.to, floorRooms),
      fromId: edge.from.id,
      toId: edge.to.id,
      lengthPx: edge.length,
    }));

    // Estimate total wire length in feet (assume 3 px ≈ 1 ft)
    const totalLengthPx = segments.reduce((sum, s) => sum + s.lengthPx, 0);

    const circuitType = circuit.startsWith("NAC") ? "NAC" : "SLC";
    routes.push({
      circuit,
      circuitType,
      color: CIRCUIT_COLORS[circuitType] || CIRCUIT_COLORS.default,
      totalLength: Math.round(totalLengthPx / 3), // px → ft
      segments,
    });
  });

  return routes;
}

/**
 * Draw circuit routes onto a canvas 2D context.
 * Call this from the FloorPlanCanvas draw loop when showCircuits is true.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} routes - output of routeCircuits()
 * @param {boolean} showLabels
 */
export function drawCircuitRoutes(ctx, routes, showLabels = true) {
  routes.forEach(route => {
    ctx.save();
    ctx.strokeStyle = route.color + "cc";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);

    route.segments.forEach(seg => {
      const pts = seg.points;
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();

      // Draw tiny junction dot at waypoints
      pts.slice(1, -1).forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = route.color;
        ctx.fill();
      });
    });

    // Label the circuit near the midpoint of first segment
    if (showLabels && route.segments.length > 0) {
      const seg0 = route.segments[0].points;
      const mx = (seg0[0].x + seg0[seg0.length - 1].x) / 2;
      const my = (seg0[0].y + seg0[seg0.length - 1].y) / 2;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      const textW = ctx.measureText(route.circuit).width + 6;
      ctx.fillRect(mx - textW / 2, my - 8, textW, 10);
      ctx.fillStyle = route.color;
      ctx.font = "bold 7px JetBrains Mono, monospace";
      ctx.textAlign = "center";
      ctx.fillText(route.circuit, mx, my);
    }

    ctx.restore();
  });
}

/**
 * Calculate total wire footage across all routed circuits.
 * Useful for the BOM / cost estimation.
 * @param {Array} routes - output of routeCircuits()
 * @returns {Object} { totalFeet, byCircuit }
 */
export function summarizeWireLength(routes) {
  const byCircuit = {};
  let totalFeet = 0;
  routes.forEach(r => {
    byCircuit[r.circuit] = r.totalLength;
    totalFeet += r.totalLength;
  });
  return { totalFeet, byCircuit };
}