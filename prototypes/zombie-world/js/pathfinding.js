// ── A* Grid Pathfinding ──
import { W, WORLD_W, state, FIELD_TOP, WALL_Y, FIELD_BOTTOM, TOWER_Y } from './game.js?v=16';

// ── Grid constants ──
export const GRID = 40; // 넓은 월드에서 성능 유지를 위해 타일 크기 증가
export const COLS = Math.ceil(WORLD_W / GRID);     // 270 (넓은 월드)
export const ROWS = Math.ceil((FIELD_BOTTOM - FIELD_TOP) / GRID); // 30

// ── Coordinate conversion helpers ──

/** World coords → grid cell */
export function toGrid(wx, wy) {
  return {
    c: Math.floor(wx / GRID),
    r: Math.floor((wy - FIELD_TOP) / GRID),
  };
}

/** Grid cell → world coords (tile center) */
export function toWorld(c, r) {
  return {
    x: c * GRID + GRID / 2,
    y: FIELD_TOP + r * GRID + GRID / 2,
  };
}

// ── Grid data ──
let grid = null; // flat array [ROWS * COLS], 0=walkable, 1=blocked

export function isWalkable(c, r) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
  if (!grid) return false;
  return grid[r * COLS + c] === 0;
}

/**
 * Build (or rebuild) the walkability grid from current game state.
 * Call this whenever buildings or doors change.
 */
export function buildGrid() {
  grid = new Uint8Array(ROWS * COLS); // all 0 (walkable)

  // ── Mark building tiles as blocked ──
  for (const b of state.buildings) {
    const cMin = Math.floor(b.x / GRID);
    const cMax = Math.floor((b.x + b.w - 1) / GRID);
    const rMin = Math.floor((b.y - FIELD_TOP) / GRID);
    const rMax = Math.floor((b.y + b.h - 1 - FIELD_TOP) / GRID);

    for (let r = Math.max(0, rMin); r <= Math.min(ROWS - 1, rMax); r++) {
      for (let c = Math.max(0, cMin); c <= Math.min(COLS - 1, cMax); c++) {
        grid[r * COLS + c] = 1;
      }
    }
  }

  // ── Mark wall rows as blocked (2 rows thick at WALL_Y) ──
  const wallRow = Math.floor((WALL_Y - FIELD_TOP) / GRID);
  for (let dr = 0; dr < 2; dr++) {
    const r = wallRow + dr;
    if (r >= 0 && r < ROWS) {
      for (let c = 0; c < COLS; c++) {
        grid[r * COLS + c] = 1;
      }
    }
  }

  // ── Carve door openings (3 tiles wide at each door.x) ──
  for (const door of state.doors) {
    const doorC = Math.floor(door.x / GRID);
    for (let dr = 0; dr < 2; dr++) {
      const r = wallRow + dr;
      if (r >= 0 && r < ROWS) {
        for (let dc = -1; dc <= 1; dc++) {
          const c = doorC + dc;
          if (c >= 0 && c < COLS) {
            grid[r * COLS + c] = 0;
          }
        }
      }
    }
  }
}

// ── A* pathfinding ──

// 8-directional neighbours (dx, dy, cost)
const DIRS = [
  { dc:  0, dr: -1, cost: 1 },   // N
  { dc:  1, dr:  0, cost: 1 },   // E
  { dc:  0, dr:  1, cost: 1 },   // S
  { dc: -1, dr:  0, cost: 1 },   // W
  { dc:  1, dr: -1, cost: 1.41 }, // NE
  { dc:  1, dr:  1, cost: 1.41 }, // SE
  { dc: -1, dr:  1, cost: 1.41 }, // SW
  { dc: -1, dr: -1, cost: 1.41 }, // NW
];

/** Octile distance heuristic */
function heuristic(c1, r1, c2, r2) {
  const dx = Math.abs(c1 - c2);
  const dy = Math.abs(r1 - r2);
  return Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
}

/**
 * Find nearest walkable tile to (c, r) using BFS spiral.
 * Returns {c, r} or null if nothing found within a reasonable radius.
 */
function findNearestWalkable(c, r) {
  if (isWalkable(c, r)) return { c, r };
  for (let radius = 1; radius <= 10; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue; // perimeter only
        const nc = c + dc;
        const nr = r + dr;
        if (isWalkable(nc, nr)) return { c: nc, r: nr };
      }
    }
  }
  return null;
}

/**
 * A* pathfinding from world coords to world coords.
 * Returns array of {x, y} waypoints in world coordinates (tile centers).
 * Returns empty array if no path found.
 */
export function findPath(fromX, fromY, toX, toY) {
  if (!grid) buildGrid();

  const start = toGrid(fromX, fromY);
  let goal = toGrid(toX, toY);

  // Clamp to grid bounds
  start.c = Math.max(0, Math.min(COLS - 1, start.c));
  start.r = Math.max(0, Math.min(ROWS - 1, start.r));
  goal.c = Math.max(0, Math.min(COLS - 1, goal.c));
  goal.r = Math.max(0, Math.min(ROWS - 1, goal.r));

  // If destination is blocked, find nearest walkable tile
  if (!isWalkable(goal.c, goal.r)) {
    const alt = findNearestWalkable(goal.c, goal.r);
    if (!alt) return [];
    goal = alt;
  }

  // If start is blocked, find nearest walkable tile
  if (!isWalkable(start.c, start.r)) {
    const alt = findNearestWalkable(start.c, start.r);
    if (!alt) return [];
    start.c = alt.c;
    start.r = alt.r;
  }

  // Trivial case
  if (start.c === goal.c && start.r === goal.r) {
    return [toWorld(goal.c, goal.r)];
  }

  // ── A* search ──
  const keyOf = (c, r) => r * COLS + c;

  // Open set as a simple sorted array (adequate for small grid)
  const gScore = new Float32Array(ROWS * COLS).fill(Infinity);
  const fScore = new Float32Array(ROWS * COLS).fill(Infinity);
  const cameFrom = new Int32Array(ROWS * COLS).fill(-1);
  const closed = new Uint8Array(ROWS * COLS);

  const startKey = keyOf(start.c, start.r);
  gScore[startKey] = 0;
  fScore[startKey] = heuristic(start.c, start.r, goal.c, goal.r);

  // Min-heap using array (key, fScore)
  const open = [startKey];
  const inOpen = new Uint8Array(ROWS * COLS);
  inOpen[startKey] = 1;

  let iterations = 0;
  const MAX_ITERATIONS = 5000;

  while (open.length > 0 && iterations < MAX_ITERATIONS) {
    iterations++;

    // Find node with lowest fScore in open set
    let bestIdx = 0;
    let bestF = fScore[open[0]];
    for (let i = 1; i < open.length; i++) {
      if (fScore[open[i]] < bestF) {
        bestF = fScore[open[i]];
        bestIdx = i;
      }
    }
    const currentKey = open[bestIdx];
    open[bestIdx] = open[open.length - 1];
    open.pop();
    inOpen[currentKey] = 0;

    const cr = Math.floor(currentKey / COLS);
    const cc = currentKey % COLS;

    // Reached goal?
    if (cc === goal.c && cr === goal.r) {
      return reconstructPath(cameFrom, currentKey);
    }

    closed[currentKey] = 1;

    // Explore neighbours
    for (const dir of DIRS) {
      const nc = cc + dir.dc;
      const nr = cr + dir.dr;

      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;

      const nKey = keyOf(nc, nr);
      if (closed[nKey]) continue;
      if (!isWalkable(nc, nr)) continue;

      // Diagonal: only if both adjacent orthogonal cells are walkable
      if (dir.dc !== 0 && dir.dr !== 0) {
        if (!isWalkable(cc + dir.dc, cr) || !isWalkable(cc, cr + dir.dr)) {
          continue;
        }
      }

      const tentativeG = gScore[currentKey] + dir.cost;
      if (tentativeG >= gScore[nKey]) continue;

      cameFrom[nKey] = currentKey;
      gScore[nKey] = tentativeG;
      fScore[nKey] = tentativeG + heuristic(nc, nr, goal.c, goal.r);

      if (!inOpen[nKey]) {
        open.push(nKey);
        inOpen[nKey] = 1;
      }
    }
  }

  // No path found
  return [];
}

/** Reconstruct path from cameFrom map, returning world coordinates */
function reconstructPath(cameFrom, endKey) {
  const path = [];
  let key = endKey;
  while (key !== -1) {
    const r = Math.floor(key / COLS);
    const c = key % COLS;
    path.push(toWorld(c, r));
    key = cameFrom[key];
  }
  path.reverse();
  return path;
}

// ── Debug drawing ──

/**
 * Draw the path as a cyan dashed line with a circle at the destination.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x,y}>} path
 */
export function drawPathDebug(ctx, path) {
  if (!path || path.length < 2) return;

  ctx.save();
  ctx.strokeStyle = 'cyan';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Small circle at destination
  const dest = path[path.length - 1];
  ctx.beginPath();
  ctx.arc(dest.x, dest.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = 'cyan';
  ctx.fill();

  ctx.restore();
}
