# Zombie World v2 - Survivor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the tower defense game into a survivor game where the player character can descend from towers, walk the map to collect items, and fight zombies with 3 fixed towers, ruined city buildings as obstacles, and sound-based zombie AI.

**Architecture:** The redesign adds a player entity (player.js), pathfinding grid (pathfinding.js), building obstacles (buildings.js), and door system (integrated into wall.js). The game state gains a `player` object tracking position, HP, and on-tower/ground status. Touch input adds a map-tap-to-move zone. Zombies switch from mixed AI to pure sound-chasing with straight-line movement.

**Tech Stack:** HTML5 Canvas 2D, ES6 Modules, vanilla JavaScript. No external libraries.

**Cache bust version:** All `?v=13` imports become `?v=14` at the end.

---

## Task 1: Add Player State & 3 Towers to game.js

**Files:**
- Modify: `prototypes/zombie-world/js/game.js`

**Step 1: Add player state to the state object**

After `tower` (line 108), add:

```javascript
// 플레이어
player: {
  x: W / 2,
  y: 590,
  hp: 100,
  maxHp: 100,
  speed: 200,        // px/s (zombies ~10-30)
  size: 16,          // radius
  onTower: 0,        // -1 = ground, 0/1/2 = tower index
  path: [],          // A* waypoints [{x,y}, ...]
  pathIdx: 0,
  moving: false,
  hitFlash: 0,
},
```

**Step 2: Change tower to towers array (3 towers)**

Replace line 108 `tower: { hp: 200, maxHp: 200, x: W / 2 },` with:

```javascript
towers: [
  { hp: 200, maxHp: 200, x: 90 },   // left
  { hp: 200, maxHp: 200, x: 270 },  // center
  { hp: 200, maxHp: 200, x: 450 },  // right
],
activeTower: 0, // which tower the player is on (when onTower >= 0)
```

**Step 3: Add buildings array to state**

After `particles: [],` (line 126), add:

```javascript
buildings: [],    // { x, y, w, h } collision rects
doors: [          // 3 doors between wall segments
  { x: 135, open: false },
  { x: 270, open: false },
  { x: 405, open: false },
],
```

**Step 4: Update resetGame()**

Update `resetGame()` to initialize player, 3 towers, buildings, doors:

```javascript
state.player = {
  x: 270, y: 590, hp: 100, maxHp: 100, speed: 200, size: 16,
  onTower: 1, path: [], pathIdx: 0, moving: false, hitFlash: 0,
};
state.towers = [
  { hp: 200, maxHp: 200, x: 90 },
  { hp: 200, maxHp: 200, x: 270 },
  { hp: 200, maxHp: 200, x: 450 },
];
state.activeTower = 1;
state.buildings = [];
state.doors = [
  { x: 135, open: false },
  { x: 270, open: false },
  { x: 405, open: false },
];
```

Remove the old `state.tower = { ... }` line.

**Step 5: Update isGameOver()**

Change from `state.tower.hp <= 0` to `state.player.hp <= 0`.

**Step 6: Update getTotalAmmo()**

No change needed (already weapon-based).

**Step 7: Add helper to get current tower**

```javascript
export function getCurrentTower() {
  const idx = state.player.onTower;
  if (idx < 0) return null;
  return state.towers[idx];
}
```

**Step 8: Add TOWER_POSITIONS constant**

```javascript
export const TOWER_POSITIONS = [
  { x: 90 },   // left
  { x: 270 },  // center
  { x: 450 },  // right
];
```

**Step 9: Commit**

```bash
git add prototypes/zombie-world/js/game.js
git commit -m "feat(v2): add player state, 3 towers, buildings, doors to game.js"
```

---

## Task 2: Create buildings.js - Ruined City Map

**Files:**
- Create: `prototypes/zombie-world/js/buildings.js`

**Step 1: Write the building generation + rendering module**

```javascript
// ── 폐허 도시 건물 시스템 ──
import { W, state, FIELD_TOP, WALL_Y, TOWER_Y, FIELD_BOTTOM, TOWER_POSITIONS } from './game.js?v=14';

const GRID_SIZE = 20;
const COLS = Math.floor(W / GRID_SIZE);  // 27
const ROWS = Math.floor((WALL_Y - FIELD_TOP) / GRID_SIZE); // ~23

// 건물이 배치될 수 없는 영역 (타워 근처, 벽 근처)
function isSafeZone(x, y, w, h) {
  // 벽 근처 (y > WALL_Y - 60)
  if (y + h > WALL_Y - 60) return true;
  // 화면 상단 스폰 영역 (y < FIELD_TOP + 40)
  if (y < FIELD_TOP + 40) return true;
  // 타워 바로 위 영역
  for (const tp of TOWER_POSITIONS) {
    if (x < tp.x + 50 && x + w > tp.x - 50 && y + h > WALL_Y - 80) return true;
  }
  return false;
}

// 건물 간 겹침 체크
function overlaps(a, b, margin = 25) {
  return a.x < b.x + b.w + margin && a.x + a.w > b.x - margin &&
         a.y < b.y + b.h + margin && a.y + a.h > b.y - margin;
}

/**
 * 건물 랜덤 생성
 */
export function generateBuildings() {
  const buildings = [];
  const attempts = 80;
  const minW = 40, maxW = 120;
  const minH = 40, maxH = 80;
  const fieldH = WALL_Y - FIELD_TOP - 100; // usable field height

  for (let i = 0; i < attempts; i++) {
    const bw = minW + Math.random() * (maxW - minW);
    const bh = minH + Math.random() * (maxH - minH);
    const bx = 20 + Math.random() * (W - 40 - bw);
    const by = FIELD_TOP + 50 + Math.random() * (fieldH - bh);

    const b = { x: bx, y: by, w: bw, h: bh };

    if (isSafeZone(bx, by, bw, bh)) continue;
    if (buildings.some(existing => overlaps(existing, b))) continue;

    // 부서진 건물 여부 (30% 확률)
    b.ruined = Math.random() < 0.3;
    b.color = b.ruined ? '#4a3a2a' : '#5a5a5a';
    b.borderColor = b.ruined ? '#3a2a1a' : '#444';

    buildings.push(b);
    if (buildings.length >= 12) break; // max 12 buildings
  }

  state.buildings = buildings;
}

/**
 * 점이 건물 내부인지 체크
 */
export function isInsideBuilding(x, y, margin = 0) {
  for (const b of state.buildings) {
    if (x >= b.x - margin && x <= b.x + b.w + margin &&
        y >= b.y - margin && y <= b.y + b.h + margin) {
      return true;
    }
  }
  return false;
}

/**
 * 사각형이 건물과 충돌하는지 체크
 */
export function collidesWithBuilding(x, y, size) {
  for (const b of state.buildings) {
    if (x + size > b.x && x - size < b.x + b.w &&
        y + size > b.y && y - size < b.y + b.h) {
      return true;
    }
  }
  return false;
}

/**
 * 건물 렌더링
 */
export function drawBuildings(ctx) {
  for (const b of state.buildings) {
    // 건물 본체
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    // 테두리
    ctx.strokeStyle = b.borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    if (b.ruined) {
      // 부서진 건물: 금 표현
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      // 대각선 금
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + b.h * 0.3);
      ctx.lineTo(b.x + b.w * 0.5, b.y + b.h * 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(b.x + b.w * 0.6, b.y);
      ctx.lineTo(b.x + b.w, b.y + b.h * 0.5);
      ctx.stroke();
      // 모서리 무너짐 (삼각형 잘라내기)
      ctx.fillStyle = '#2a2a2a'; // 바닥색
      ctx.beginPath();
      ctx.moveTo(b.x + b.w, b.y);
      ctx.lineTo(b.x + b.w - 15, b.y);
      ctx.lineTo(b.x + b.w, b.y + 12);
      ctx.closePath();
      ctx.fill();
    } else {
      // 온전한 건물: 창문
      const winSize = 8;
      const winGap = 16;
      ctx.fillStyle = 'rgba(100,150,200,0.2)';
      for (let wx = b.x + 10; wx + winSize < b.x + b.w - 5; wx += winGap) {
        for (let wy = b.y + 10; wy + winSize < b.y + b.h - 5; wy += winGap) {
          ctx.fillRect(wx, wy, winSize, winSize);
        }
      }
    }
  }
}
```

**Step 2: Commit**

```bash
git add prototypes/zombie-world/js/buildings.js
git commit -m "feat(v2): add buildings.js - ruined city building generation + collision"
```

---

## Task 3: Create pathfinding.js - A* Grid Pathfinding

**Files:**
- Create: `prototypes/zombie-world/js/pathfinding.js`

**Step 1: Write the A* pathfinding module**

```javascript
// ── A* 그리드 경로탐색 (플레이어 전용) ──
import { W, state, FIELD_TOP, WALL_Y, FIELD_BOTTOM, TOWER_Y } from './game.js?v=14';

const GRID = 20;                          // 타일 크기 (px)
const COLS = Math.ceil(W / GRID);         // 27
const ROWS = Math.ceil((FIELD_BOTTOM - FIELD_TOP) / GRID); // ~30

let grid = [];  // 0 = walkable, 1 = blocked

/**
 * 그리드 빌드 (건물 + 벽 기반)
 * 게임 시작 시, 벽 상태 변경 시 호출
 */
export function buildGrid() {
  grid = new Array(ROWS * COLS).fill(0);

  // 건물 영역 블록
  for (const b of state.buildings) {
    const x0 = Math.floor((b.x) / GRID);
    const y0 = Math.floor((b.y - FIELD_TOP) / GRID);
    const x1 = Math.ceil((b.x + b.w) / GRID);
    const y1 = Math.ceil((b.y + b.h - FIELD_TOP) / GRID);
    for (let r = Math.max(0, y0); r < Math.min(ROWS, y1); r++) {
      for (let c = Math.max(0, x0); c < Math.min(COLS, x1); c++) {
        grid[r * COLS + c] = 1;
      }
    }
  }

  // 벽 영역 블록 (문 위치 제외)
  const wallRow = Math.floor((WALL_Y - FIELD_TOP) / GRID);
  const wallRows = 2; // 벽 두께 ~40px = 2 rows
  for (let r = wallRow; r < wallRow + wallRows && r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      grid[r * COLS + c] = 1;
    }
  }

  // 문 위치는 통과 가능 (벽 구간 사이)
  for (const door of state.doors) {
    const dc = Math.floor(door.x / GRID);
    for (let r = wallRow; r < wallRow + wallRows && r < ROWS; r++) {
      // 문 너비 = 2 타일
      if (dc >= 0 && dc < COLS) grid[r * COLS + dc] = 0;
      if (dc + 1 < COLS) grid[r * COLS + dc + 1] = 0;
    }
  }
}

/**
 * 월드 좌표 → 그리드 좌표
 */
function toGrid(wx, wy) {
  return {
    c: Math.floor(wx / GRID),
    r: Math.floor((wy - FIELD_TOP) / GRID),
  };
}

/**
 * 그리드 좌표 → 월드 좌표 (중심)
 */
function toWorld(c, r) {
  return {
    x: c * GRID + GRID / 2,
    y: r * GRID + FIELD_TOP + GRID / 2,
  };
}

function isWalkable(c, r) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
  return grid[r * COLS + c] === 0;
}

/**
 * A* 경로탐색
 * @returns {Array<{x, y}>} 월드 좌표 경로 (비어있으면 경로 없음)
 */
export function findPath(fromX, fromY, toX, toY) {
  const start = toGrid(fromX, fromY);
  const end = toGrid(toX, toY);

  // 범위 보정
  start.c = Math.max(0, Math.min(COLS - 1, start.c));
  start.r = Math.max(0, Math.min(ROWS - 1, start.r));
  end.c = Math.max(0, Math.min(COLS - 1, end.c));
  end.r = Math.max(0, Math.min(ROWS - 1, end.r));

  // 목적지가 장애물이면 가장 가까운 walkable 타일 찾기
  if (!isWalkable(end.c, end.r)) {
    const near = findNearestWalkable(end.c, end.r);
    if (!near) return [];
    end.c = near.c;
    end.r = near.r;
  }

  if (!isWalkable(start.c, start.r)) {
    const near = findNearestWalkable(start.c, start.r);
    if (!near) return [];
    start.c = near.c;
    start.r = near.r;
  }

  // A* 알고리즘
  const key = (c, r) => r * COLS + c;
  const open = [{ c: start.c, r: start.r, g: 0, f: 0 }];
  const cameFrom = new Map();
  const gScore = new Map();
  gScore.set(key(start.c, start.r), 0);

  const heuristic = (c, r) => Math.abs(c - end.c) + Math.abs(r - end.r);

  open[0].f = heuristic(start.c, start.r);

  const dirs = [
    [0, -1], [0, 1], [-1, 0], [1, 0],  // 4방향
    [-1, -1], [-1, 1], [1, -1], [1, 1], // 대각선
  ];

  let iterations = 0;
  const maxIter = 2000;

  while (open.length > 0 && iterations++ < maxIter) {
    // 최소 f-score 노드 찾기
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];

    if (current.c === end.c && current.r === end.r) {
      // 경로 재구성
      const path = [];
      let k = key(current.c, current.r);
      while (cameFrom.has(k)) {
        const { c, r } = { c: k % COLS, r: Math.floor(k / COLS) };
        path.unshift(toWorld(c, r));
        k = cameFrom.get(k);
      }
      return path;
    }

    for (const [dc, dr] of dirs) {
      const nc = current.c + dc;
      const nr = current.r + dr;
      if (!isWalkable(nc, nr)) continue;

      // 대각선 이동 시 양쪽이 열려있어야 함
      if (dc !== 0 && dr !== 0) {
        if (!isWalkable(current.c + dc, current.r) || !isWalkable(current.c, current.r + dr)) continue;
      }

      const moveCost = (dc !== 0 && dr !== 0) ? 1.414 : 1;
      const tentativeG = (gScore.get(key(current.c, current.r)) || 0) + moveCost;
      const nk = key(nc, nr);

      if (!gScore.has(nk) || tentativeG < gScore.get(nk)) {
        gScore.set(nk, tentativeG);
        cameFrom.set(nk, key(current.c, current.r));
        open.push({ c: nc, r: nr, g: tentativeG, f: tentativeG + heuristic(nc, nr) });
      }
    }
  }

  return []; // 경로 없음
}

function findNearestWalkable(c, r) {
  for (let radius = 1; radius < 10; radius++) {
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) continue;
        if (isWalkable(c + dc, r + dr)) return { c: c + dc, r: r + dr };
      }
    }
  }
  return null;
}

/**
 * 디버그: 그리드 시각화
 */
export function drawPathDebug(ctx, path) {
  if (!path || path.length === 0) return;

  ctx.strokeStyle = 'rgba(0,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // 목적지 표시
  const last = path[path.length - 1];
  ctx.strokeStyle = 'rgba(0,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(last.x, last.y, 8, 0, Math.PI * 2);
  ctx.stroke();
}

export { GRID, COLS, ROWS, toGrid, toWorld, isWalkable };
```

**Step 2: Commit**

```bash
git add prototypes/zombie-world/js/pathfinding.js
git commit -m "feat(v2): add pathfinding.js - A* grid pathfinding for player"
```

---

## Task 4: Create player.js - Player Character

**Files:**
- Create: `prototypes/zombie-world/js/player.js`

**Step 1: Write the player character module**

```javascript
// ── 플레이어 캐릭터 시스템 ──
import { W, state, TOWER_Y, FIELD_TOP, FIELD_BOTTOM, WALL_Y, getCurrentTower } from './game.js?v=14';
import { registerZone } from './input.js?v=14';
import { findPath, buildGrid, drawPathDebug } from './pathfinding.js?v=14';
import { collidesWithBuilding } from './buildings.js?v=14';

const PICKUP_RANGE = 30;    // 아이템 자동 수집 범위
const TOWER_CLIMB_RANGE = 40; // 타워에 올라갈 수 있는 범위

/**
 * 플레이어 입력 등록
 */
export function initPlayer() {
  // 맵 터치 이동 (지상 상태일 때)
  registerZone(
    { x: 0, y: FIELD_TOP, w: W, h: FIELD_BOTTOM - FIELD_TOP },
    {
      onTap(x, y) {
        if (state.screen !== 'playing') return;
        if (state.player.onTower >= 0) return; // 타워 위면 무시

        // 타워 근처 탭 → 올라가기
        for (let i = 0; i < state.towers.length; i++) {
          const t = state.towers[i];
          if (t.hp <= 0) continue; // 파괴된 타워
          const dist = Math.hypot(state.player.x - t.x, state.player.y - TOWER_Y);
          if (dist < TOWER_CLIMB_RANGE) {
            climbTower(i);
            return;
          }
        }

        // 이동 명령
        movePlayerTo(x, y);
      },
    },
    2 // 타워(3)보다 낮은 우선순위, items(15)보다 낮음
  );
}

/**
 * 플레이어 이동 명령
 */
function movePlayerTo(targetX, targetY) {
  const p = state.player;
  const path = findPath(p.x, p.y, targetX, targetY);
  if (path.length > 0) {
    p.path = path;
    p.pathIdx = 0;
    p.moving = true;
  }
}

/**
 * 타워에 올라가기
 */
function climbTower(towerIdx) {
  const p = state.player;
  const t = state.towers[towerIdx];
  if (t.hp <= 0) return;

  p.onTower = towerIdx;
  p.x = t.x;
  p.y = TOWER_Y;
  p.moving = false;
  p.path = [];
  state.activeTower = towerIdx;
}

/**
 * 타워에서 내려오기
 */
export function descendFromTower() {
  const p = state.player;
  if (p.onTower < 0) return;

  const t = state.towers[p.onTower];
  p.x = t.x;
  p.y = TOWER_Y + 30; // 타워 아래로
  p.onTower = -1;
  p.moving = false;
  p.path = [];
}

/**
 * 플레이어 업데이트
 */
export function updatePlayer(dt) {
  const p = state.player;

  // 타워 위에 있을 때
  if (p.onTower >= 0) {
    const t = state.towers[p.onTower];
    // 타워 파괴 시 강제 하차
    if (t.hp <= 0) {
      descendFromTower();
    } else {
      p.x = t.x;
      p.y = TOWER_Y;
    }
    return;
  }

  // 지상 이동
  if (p.moving && p.path.length > 0) {
    const target = p.path[p.pathIdx];
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 5) {
      p.pathIdx++;
      if (p.pathIdx >= p.path.length) {
        p.moving = false;
        p.path = [];
      }
    } else {
      const step = p.speed * dt;
      p.x += (dx / dist) * Math.min(step, dist);
      p.y += (dy / dist) * Math.min(step, dist);
    }
  }

  // 아이템 자동 수집
  for (let i = state.items.length - 1; i >= 0; i--) {
    const item = state.items[i];
    if (!item.grounded) continue; // 아직 떨어지는 중
    const dist = Math.hypot(p.x - item.x, p.y - item.y);
    if (dist < PICKUP_RANGE) {
      // 수집 처리는 items.js의 applyItem 사용
      item.pickedUp = true; // 플래그 세팅, items.js에서 처리
    }
  }

  // 좀비 접촉 대미지
  p.hitFlash = Math.max(0, p.hitFlash - dt);
  for (const z of state.zombies) {
    if (!z.alive) continue;
    const dist = Math.hypot(p.x - z.x, p.y - z.y);
    if (dist < p.size + z.size) {
      p.hp -= 2 * dt; // 초당 2 대미지
      p.hitFlash = 0.15;
    }
  }

  // 화면 경계 제한
  p.x = Math.max(p.size, Math.min(W - p.size, p.x));
  p.y = Math.max(FIELD_TOP + p.size, Math.min(FIELD_BOTTOM - p.size, p.y));
}

/**
 * 플레이어 렌더링
 */
export function drawPlayer(ctx) {
  const p = state.player;
  if (p.onTower >= 0) return; // 타워 위면 표시 안 함

  ctx.save();
  ctx.translate(p.x, p.y);

  // 히트 플래시
  if (p.hitFlash > 0) {
    ctx.globalAlpha = 0.5 + Math.sin(p.hitFlash * 30) * 0.3;
  }

  // 몸체 (파란색 원)
  ctx.fillStyle = '#4488ff';
  ctx.beginPath();
  ctx.arc(0, 0, p.size * 0.7, 0, Math.PI * 2);
  ctx.fill();

  // 머리
  ctx.fillStyle = '#ffcc88';
  ctx.beginPath();
  ctx.arc(0, -p.size * 0.5, p.size * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // 테두리
  ctx.strokeStyle = '#2266dd';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, p.size * 0.7, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  // HP 바 (머리 위)
  if (p.hp < p.maxHp) {
    const barW = 30;
    const barY = p.y - p.size - 8;
    const ratio = p.hp / p.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(p.x - barW / 2, barY, barW, 4);
    ctx.fillStyle = ratio > 0.5 ? '#44ff44' : ratio > 0.25 ? '#ffff44' : '#ff4444';
    ctx.fillRect(p.x - barW / 2, barY, barW * Math.max(0, ratio), 4);
  }

  // 이동 경로 표시
  if (p.moving && p.path.length > p.pathIdx) {
    drawPathDebug(ctx, p.path.slice(p.pathIdx));
  }
}

/**
 * "내려오기" 버튼 렌더링 + 입력
 */
let descendBtnRect = { x: 0, y: 0, w: 0, h: 0 };

export function initDescendButton() {
  // 내려오기 버튼 (타워 위에서만 활성)
  registerZone(
    { x: 0, y: FIELD_BOTTOM - 50, w: W, h: 50 },
    {
      onTap(x, y) {
        if (state.screen !== 'playing') return;
        if (state.player.onTower < 0) return;
        // 버튼 영역 체크
        const t = state.towers[state.player.onTower];
        if (Math.abs(x - t.x) < 30 && y > FIELD_BOTTOM - 45) {
          descendFromTower();
        }
      },
    },
    4
  );
}

export function drawDescendButton(ctx) {
  if (state.player.onTower < 0) return;
  if (state.screen !== 'playing') return;

  const t = state.towers[state.player.onTower];
  const bx = t.x;
  const by = FIELD_BOTTOM - 20;

  // 버튼 배경
  ctx.fillStyle = 'rgba(255,100,50,0.7)';
  ctx.beginPath();
  ctx.roundRect(bx - 25, by - 12, 50, 24, 6);
  ctx.fill();

  // 아래 화살표
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(bx - 8, by - 4);
  ctx.lineTo(bx + 8, by - 4);
  ctx.lineTo(bx, by + 6);
  ctx.closePath();
  ctx.fill();

  // 라벨
  ctx.fillStyle = '#fff';
  ctx.font = '7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('내려가기', bx, by + 18);
}
```

**Step 2: Commit**

```bash
git add prototypes/zombie-world/js/player.js
git commit -m "feat(v2): add player.js - player character, movement, climbing, descending"
```

---

## Task 5: Update tower.js - 3 Fixed Towers

**Files:**
- Modify: `prototypes/zombie-world/js/tower.js`

**Step 1: Rewrite tower.js for 3 fixed towers, no dragging**

Remove all drag logic. Draw 3 towers. Show which tower player is on.

```javascript
// ── 타워 렌더링 (3개 고정) ──
import { W, state, TOWER_Y, FIELD_BOTTOM } from './game.js?v=14';

const TOWER_SIZE = 24;

export function initTower() {
  // 드래그 삭제 - 타워 고정
}

export function drawTowers(ctx) {
  for (let i = 0; i < state.towers.length; i++) {
    const t = state.towers[i];
    const tx = t.x;
    const hpRatio = t.hp / t.maxHp;
    const isActive = state.player.onTower === i;

    if (t.hp <= 0) {
      // 파괴된 타워
      ctx.fillStyle = 'rgba(80,60,40,0.4)';
      ctx.beginPath();
      ctx.moveTo(tx, TOWER_Y - TOWER_SIZE * 0.5);
      ctx.lineTo(tx + TOWER_SIZE * 0.7, TOWER_Y);
      ctx.lineTo(tx, TOWER_Y + TOWER_SIZE * 0.3);
      ctx.lineTo(tx - TOWER_SIZE * 0.7, TOWER_Y);
      ctx.closePath();
      ctx.fill();

      // 잔해 표시
      ctx.fillStyle = '#555';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('파괴됨', tx, TOWER_Y + TOWER_SIZE + 10);
      continue;
    }

    // 타워 본체 (다이아몬드)
    ctx.fillStyle = isActive
      ? (hpRatio > 0.5 ? '#ddbb55' : hpRatio > 0.25 ? '#bb9944' : '#995533')
      : (hpRatio > 0.5 ? '#998855' : hpRatio > 0.25 ? '#887744' : '#664433');
    ctx.beginPath();
    ctx.moveTo(tx, TOWER_Y - TOWER_SIZE);
    ctx.lineTo(tx + TOWER_SIZE, TOWER_Y);
    ctx.lineTo(tx, TOWER_Y + TOWER_SIZE * 0.6);
    ctx.lineTo(tx - TOWER_SIZE, TOWER_Y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = isActive ? '#ffdd66' : '#aa9955';
    ctx.lineWidth = isActive ? 3 : 1;
    ctx.stroke();

    // 포탑 (활성 타워만)
    if (isActive) {
      const barrelLen = 18;
      const dx = Math.cos(state.aimAngle);
      const dy = -Math.sin(state.aimAngle);
      ctx.strokeStyle = '#ff6644';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tx, TOWER_Y);
      ctx.lineTo(tx + dx * barrelLen, TOWER_Y + dy * barrelLen);
      ctx.stroke();
    }

    // HP 바
    const barW = 50;
    const barY = TOWER_Y + TOWER_SIZE * 0.6 + 4;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(tx - barW / 2, barY, barW, 4);
    ctx.fillStyle = hpRatio > 0.5 ? '#44ff44' : hpRatio > 0.25 ? '#ffff44' : '#ff4444';
    ctx.fillRect(tx - barW / 2, barY, barW * hpRatio, 4);

    // 플레이어가 위에 있을 때 표시
    if (isActive) {
      ctx.fillStyle = '#4488ff';
      ctx.beginPath();
      ctx.arc(tx, TOWER_Y - TOWER_SIZE - 8, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
```

**Step 2: Commit**

```bash
git add prototypes/zombie-world/js/tower.js
git commit -m "feat(v2): rewrite tower.js - 3 fixed towers, no drag, active indicator"
```

---

## Task 6: Update wall.js - Add Door System

**Files:**
- Modify: `prototypes/zombie-world/js/wall.js`

**Step 1: Add door rendering to drawWalls()**

After the existing wall segment rendering, add door drawing at the 3 junction points (x=135, 270, 405). Doors are always passable for the player (pathfinding marks them walkable). Visually show doors as gaps in the wall.

Add at the end of `drawWalls()`:

```javascript
// 문 렌더링 (벽 구간 사이)
for (const door of state.doors) {
  const doorW = 30;
  const doorX = door.x - doorW / 2;
  const doorY = WALL_Y + 5; // 벽 중앙

  // 문틀
  ctx.strokeStyle = '#8b7355';
  ctx.lineWidth = 2;
  ctx.strokeRect(doorX, doorY - 15, doorW, 30);

  // 문 (나무색)
  ctx.fillStyle = '#6b5335';
  ctx.fillRect(doorX + 2, doorY - 13, doorW - 4, 26);

  // 손잡이
  ctx.fillStyle = '#ffcc44';
  ctx.beginPath();
  ctx.arc(doorX + doorW - 8, doorY, 3, 0, Math.PI * 2);
  ctx.fill();
}
```

**Step 2: Commit**

```bash
git add prototypes/zombie-world/js/wall.js
git commit -m "feat(v2): add door rendering to wall.js"
```

---

## Task 7: Update zombies.js - Pure Sound-Chasing AI + Player Attack

**Files:**
- Modify: `prototypes/zombie-world/js/zombies.js`

**Step 1: Change zombie AI to pure sound-chasing with straight-line movement**

Key changes to the AI state machine:
1. Remove random idle movement - zombies stand still if no sound
2. `attracted` state: move in straight line toward sound, stop at buildings/walls (no pathfinding)
3. When reaching sound location, keep pushing in same direction
4. On new sound: change direction
5. Attack player on contact (not just tower)

Replace the AI update section (approximately lines 120-260):

- **idle**: Stand still. Listen for sounds. If sound heard → attracted.
- **attracted**: Move straight toward `targetX, targetY`. If colliding with building, stop (keep trying to push). If at wall, damage wall. If near player (ground), damage player. If near tower, damage tower. On arrival at target, keep moving in same direction. Listen for new sounds.

**Step 2: Add player damage logic**

In collision section, after wall/tower damage, add:

```javascript
// 플레이어 접촉 대미지 (player.js에서도 체크하지만 여기서도)
if (state.player.onTower < 0) {
  const distToPlayer = Math.hypot(z.x - state.player.x, z.y - state.player.y);
  if (distToPlayer < z.size + state.player.size) {
    // player.js handles the damage
  }
}
```

**Step 3: Change tower references from `state.tower` to `state.towers[i]`**

All references to `state.tower.x` and `state.tower.hp` need to reference the nearest tower from `state.towers[]`.

**Step 4: Commit**

```bash
git add prototypes/zombie-world/js/zombies.js
git commit -m "feat(v2): rewrite zombie AI - sound-chasing, straight-line, player attack"
```

---

## Task 8: Update items.js - Ground Drop + Persistent Items

**Files:**
- Modify: `prototypes/zombie-world/js/items.js`

**Step 1: Change item spawning to drop at zombie death position**

Modify `tryDropItem()` to accept zombie x, y and spawn items there instead of random field positions.

**Step 2: Remove item lifetime/despawn**

Remove the 8-second timer and blinking. Items persist forever on the ground.

**Step 3: Change pickup to player-walk-to-collect**

Remove the field tap-to-pickup zone. Instead, items are collected when the player walks within 30px (handled in player.js). Add `pickedUp` flag processing in `updateItems()`.

**Step 4: Add item tap → player walks to it**

Register a zone that, when an item is tapped, sends the player to walk to that location.

**Step 5: Commit**

```bash
git add prototypes/zombie-world/js/items.js
git commit -m "feat(v2): items drop at zombie position, persist forever, walk-to-collect"
```

---

## Task 9: Update renderer.js - Ruined City Background

**Files:**
- Modify: `prototypes/zombie-world/js/renderer.js`

**Step 1: Replace grass field with ruined city**

Change `drawField()`:
- Floor: dark asphalt (#2a2a2a)
- Road markings: dashed white/yellow lines
- Rubble particles: small gray dots scattered
- Remove green grass and sky gradient
- Keep spawn area red tint
- Keep interior dark brown tint

**Step 2: Commit**

```bash
git add prototypes/zombie-world/js/renderer.js
git commit -m "feat(v2): ruined city background in renderer.js"
```

---

## Task 10: Update hud.js - Player HP + 3 Tower Status

**Files:**
- Modify: `prototypes/zombie-world/js/hud.js`

**Step 1: Replace tower HP bar with player HP bar**

Change the HUD to show:
- Player HP bar (prominent, top-right area)
- 3 small tower HP indicators (mini bars or icons)

**Step 2: Update game over screen**

Change "TOWER DESTROYED" to "YOU DIED" or "생존 실패".

**Step 3: Update isGameOver reference**

Change from `tower.hp <= 0` check to `player.hp <= 0`.

**Step 4: Commit**

```bash
git add prototypes/zombie-world/js/hud.js
git commit -m "feat(v2): HUD shows player HP, 3 tower status indicators"
```

---

## Task 11: Update main.js - Wire Everything Together

**Files:**
- Modify: `prototypes/zombie-world/js/main.js`

**Step 1: Add new imports**

```javascript
import { generateBuildings, drawBuildings } from './buildings.js?v=14';
import { buildGrid } from './pathfinding.js?v=14';
import { initPlayer, updatePlayer, drawPlayer, initDescendButton, drawDescendButton } from './player.js?v=14';
```

**Step 2: Update init section**

After `resetGame()`:
```javascript
generateBuildings();
buildGrid();
initPlayer();
initDescendButton();
```

**Step 3: Update update loop**

Add `updatePlayer(dt)` after zombie updates.

**Step 4: Update draw loop**

Add in field rendering section:
```javascript
drawBuildings(ctx);  // after field background
drawPlayer(ctx);     // after zombies
drawDescendButton(ctx); // after tower
```

Replace `drawTower(ctx)` with `drawTowers(ctx)` (from updated tower.js).

**Step 5: Update game over check**

Change from `state.tower.hp <= 0` to `state.player.hp <= 0`.

**Step 6: Commit**

```bash
git add prototypes/zombie-world/js/main.js
git commit -m "feat(v2): wire up buildings, pathfinding, player in main.js"
```

---

## Task 12: Update All Weapon Modules - Tower Reference Changes

**Files:**
- Modify: `prototypes/zombie-world/js/pistol.js`
- Modify: `prototypes/zombie-world/js/bow.js`
- Modify: `prototypes/zombie-world/js/sniper.js`
- Modify: `prototypes/zombie-world/js/mg.js`
- Modify: `prototypes/zombie-world/js/crossbow.js`
- Modify: `prototypes/zombie-world/js/flamethrower.js`
- Modify: `prototypes/zombie-world/js/projectiles.js`
- Modify: `prototypes/zombie-world/js/aiming.js`

**Step 1: Update all `state.tower.x` references**

Every weapon module references `state.tower.x` for the firing origin. Change to:
```javascript
const towerX = state.player.onTower >= 0
  ? state.towers[state.player.onTower].x
  : state.player.x;
```

Or use a helper function from game.js:
```javascript
export function getFireOrigin() {
  if (state.player.onTower >= 0) {
    return { x: state.towers[state.player.onTower].x, y: TOWER_Y };
  }
  return { x: state.player.x, y: state.player.y };
}
```

Add `getFireOrigin` to game.js and use it everywhere `state.tower.x` / `TOWER_Y` was used for firing.

**Step 2: Update projectiles.js**

Change `state.tower.x` in fireProjectile to use `getFireOrigin()`.

**Step 3: Commit**

```bash
git add prototypes/zombie-world/js/*.js
git commit -m "feat(v2): update all weapons to use getFireOrigin() for player/tower position"
```

---

## Task 13: Update inventory.js - Adapt to Player on Ground

**Files:**
- Modify: `prototypes/zombie-world/js/inventory.js`

**Step 1: Inventory items available on ground**

The inventory bar should still work when the player is on the ground. Drag items should deploy at the player's position or the tapped field position.

- Medkit: heal player (not tower)
- Brick: repair closest tower (not just wall)
- Mine/molotov/bomb: place at field position

**Step 2: Commit**

```bash
git add prototypes/zombie-world/js/inventory.js
git commit -m "feat(v2): adapt inventory for ground player, medkit heals player"
```

---

## Task 14: Bump All Cache Versions to v=14

**Files:**
- Modify: All `.js` files in `prototypes/zombie-world/js/`
- Modify: `prototypes/zombie-world/index.html`

**Step 1: Replace all `?v=13` with `?v=14`**

Search and replace across all JS files.

**Step 2: Commit**

```bash
git add prototypes/zombie-world/
git commit -m "chore: bump cache version to v=14"
```

---

## Task 15: Integration Testing + Bug Fixes

**Step 1: Test the game in browser**

Open the game and verify:
1. Title screen loads
2. Game starts with 3 towers visible
3. Player starts on center tower
4. Weapon controls work from tower
5. "내려가기" button appears and works
6. Player walks to tapped location (A* pathfinding)
7. Buildings are visible and player walks around them
8. Zombies move toward sound sources in straight lines
9. Zombies stop at buildings (no pathfinding)
10. Items drop at zombie death locations
11. Items persist (don't disappear)
12. Player picks up items by walking near them
13. Player can climb back onto towers
14. Tower destruction doesn't end game
15. Player HP = 0 → game over
16. Doors visible in walls

**Step 2: Fix any bugs found**

**Step 3: Commit fixes**

---

## Task 16: Deploy to gh-pages

**Step 1: Deploy**

```bash
git checkout gh-pages
git checkout main -- prototypes/zombie-world/
git add prototypes/zombie-world/
git commit -m "deploy: zombie world v2 - survivor redesign"
git push origin gh-pages
git checkout main
```

---

## Execution Order & Dependencies

```
Task 1 (game.js state) → required by all others
Task 2 (buildings.js) → required by Task 3
Task 3 (pathfinding.js) → required by Task 4
Task 4 (player.js) → required by Tasks 5, 7, 8
Task 5 (tower.js) → independent after Task 1
Task 6 (wall.js doors) → independent after Task 1
Task 7 (zombies.js) → needs Tasks 1, 4
Task 8 (items.js) → needs Tasks 1, 4
Task 9 (renderer.js) → independent after Task 1
Task 10 (hud.js) → needs Task 1
Task 11 (main.js) → needs Tasks 1-10
Task 12 (weapons) → needs Task 1
Task 13 (inventory.js) → needs Task 1
Task 14 (cache bump) → after all code changes
Task 15 (testing) → after Task 14
Task 16 (deploy) → after Task 15
```

**Critical path:** 1 → 2 → 3 → 4 → 11 → 14 → 15 → 16
