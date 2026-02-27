# Zombie World Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a top-down 2D tower defense shooter where the player defends castle walls from zombie waves, reusing the Tactical Range weapon system.

**Architecture:** Copy the entire `prototypes/tactical-range/` to `prototypes/zombie-world/`, then replace the 3D perspective renderer with a 2D top-down system, replace targets with zombies, add wall/tower defense mechanics, and swap the joystick with a half-circle dial aimer. Weapon modules (pistol, bow, sniper, mg, crossbow) are reused with minimal changes.

**Tech Stack:** HTML5 Canvas, ES Modules, Web Audio API (all synthesized, no audio files)

---

## Phase 1: Project Scaffold & Core Systems

### Task 1: Copy project and verify it loads

**Files:**
- Copy: `prototypes/tactical-range/` → `prototypes/zombie-world/`
- Modify: `prototypes/zombie-world/index.html`

**Step 1: Copy the project directory**

```bash
cp -r prototypes/tactical-range prototypes/zombie-world
```

**Step 2: Update index.html title and cache version**

Change `<title>Tactical Range</title>` to `<title>Zombie World</title>`.
Change script src version to `?v=1`.

**Step 3: Update all JS import versions to `?v=1`**

Search and replace all `?v=12` to `?v=1` across all `.js` files in `prototypes/zombie-world/js/`.

**Step 4: Verify the copy loads in browser**

Open `prototypes/zombie-world/index.html` and confirm the game loads (it will still look like Tactical Range - that's expected).

**Step 5: Commit**

```bash
git add prototypes/zombie-world/
git commit -m "feat: scaffold zombie-world project from tactical-range copy"
```

---

### Task 2: Rewrite game.js - new game state

**Files:**
- Modify: `prototypes/zombie-world/js/game.js`

Replace the game state with zombie-world specific state. Keep weapon states identical. Replace targets/obstacles with zombies, add wall/tower/daynight state.

**Step 1: Rewrite game.js**

Key changes to the state object:
- Keep: `W`, `H`, `HUD_H`, `CONTROLS_TOP`, `CONTROLS_BOTTOM`, `SLOT_H`
- Remove: `RANGE_TOP`, `RANGE_BOTTOM`, `JOYSTICK_W`
- Add layout constants:
  ```js
  export const FIELD_TOP = HUD_H;           // 48 - field starts after HUD
  export const WALL_Y = 520;                // wall arc center Y
  export const TOWER_Y = 590;               // tower position Y
  export const FIELD_BOTTOM = 640;          // field area ends
  export const DIAL_R = 80;                 // half-circle dial radius
  ```
- Replace `aimX/aimY` with `aimAngle` (radians, π/2 = straight up, 0 = right, π = left)
  ```js
  aimAngle: Math.PI / 2, // default: straight up (12 o'clock)
  ```
- Add wall state:
  ```js
  walls: [
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
  ],
  ```
- Add tower state:
  ```js
  tower: { hp: 200, maxHp: 200 },
  ```
- Add day/night state:
  ```js
  day: 1,
  isNight: false,        // true for waves 4,5
  nightDarkness: 0,      // 0~1 interpolation
  ```
- Replace `targets`/`obstacles` with:
  ```js
  zombies: [],
  mines: [],             // placed mines on field
  hazards: [],           // fire/poison areas
  ```
- Keep: `projectiles`, `items`, `particles`, `wave*`, `slowMo*`
- Add: `zombiesInside: 0` (count of zombies past the wall)
- Add buffs:
  ```js
  buffs: {
    shieldTimer: 0,      // wall invincibility
    speedTimer: 0,       // fire rate boost
    freezeShots: 0,      // remaining freeze shots
    chainShots: 0,       // remaining chain shots
    poisonShots: 0,      // remaining poison shots
  },
  ```
- Add localStorage keys: `zw_best` / `zw_best_wave`

**Step 2: Update resetGame()**

Reset all new state fields. Keep weapon resets identical.

**Step 3: Update isGameOver()**

Change to: `return state.tower.hp <= 0;`

(No longer ammo-based game over - it's tower HP based.)

**Step 4: Keep getTotalAmmo() as-is**

Still useful for HUD display.

**Step 5: Commit**

```bash
git commit -m "feat: rewrite game.js with zombie-world state (walls, tower, day/night)"
```

---

### Task 3: Rewrite renderer.js - top-down 2D background

**Files:**
- Modify: `prototypes/zombie-world/js/renderer.js`

Replace the 3D perspective renderer with a top-down 2D field renderer. No more `worldToScreen` - everything is direct screen coordinates.

**Step 1: Remove worldToScreen and all 3D perspective code**

**Step 2: Write new drawField(ctx)**

Draw in this order:
1. **Sky gradient** (top area, y=0 to FIELD_TOP): dark blue (night) or light blue (day), interpolated by `state.nightDarkness`
2. **Ground** (FIELD_TOP to FIELD_BOTTOM): dark green grass with subtle grid pattern
3. **Spawn zone indicator** (y=48 to y=150): subtle red tint showing where zombies appear
4. **Path indicators**: subtle darker lines from spawn to wall segments

**Step 3: Export drawField instead of drawRange**

```js
export function drawField(ctx) { ... }
```

**Step 4: Remove drawCrosshair, getCrosshairScreen, AIM_RANGE_X/Y, worldToScreen exports**

These are replaced by the firing line drawn from the tower in the aiming system.

**Step 5: Add drawFiringLine(ctx)**

Draw a dotted line from tower position (W/2, TOWER_Y) outward at `state.aimAngle`:
```js
export function drawFiringLine(ctx) {
  const tx = W / 2, ty = TOWER_Y;
  const dx = Math.cos(state.aimAngle);
  const dy = -Math.sin(state.aimAngle); // negative because canvas Y is down
  const lineLen = 600; // extends past top of screen

  ctx.save();
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = 'rgba(255,80,80,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx + dx * lineLen, ty + dy * lineLen);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
```

**Step 6: Commit**

```bash
git commit -m "feat: replace 3D renderer with top-down 2D field renderer"
```

---

### Task 4: Create wall.js - castle wall system

**Files:**
- Create: `prototypes/zombie-world/js/wall.js`

**Step 1: Implement wall rendering and logic**

The wall is a tapered elliptical arc across the screen at y≈WALL_Y. 4 segments, each ~130px wide with small gaps between them.

```js
import { W, state, WALL_Y } from './game.js?v=1';

// 4 wall segments - positions along the arc
const WALL_SEGMENTS = [
  { x: 20, w: 120 },    // segment 0 (leftmost)
  { x: 145, w: 120 },   // segment 1
  { x: 275, w: 120 },   // segment 2
  { x: 400, w: 120 },   // segment 3 (rightmost)
];
const WALL_H = 20;       // wall thickness
const WALL_ARC_DIP = 30; // elliptical curvature amount (center dips lower)

export function getWallSegments() { return WALL_SEGMENTS; }
export function getWallY(segIdx) {
  // Elliptical: center segments are slightly lower (closer to tower)
  const cx = WALL_SEGMENTS[segIdx].x + WALL_SEGMENTS[segIdx].w / 2;
  const ratio = (cx - W / 2) / (W / 2); // -1 to 1
  return WALL_Y + WALL_ARC_DIP * (1 - ratio * ratio); // parabolic arc
}

export function updateWalls(dt) {
  for (let i = 0; i < 4; i++) {
    const w = state.walls[i];
    if (w.rebuilding) {
      w.rebuildTimer -= dt;
      if (w.rebuildTimer <= 0) {
        w.rebuilding = false;
        w.hp = 50; // rebuilt at half HP
      }
    }
  }

  // Check if all inside zombies are dead → start rebuilding broken walls
  const insideZombies = state.zombies.filter(z => z.pastWall);
  if (insideZombies.length === 0) {
    for (let i = 0; i < 4; i++) {
      if (state.walls[i].hp <= 0 && !state.walls[i].rebuilding) {
        state.walls[i].rebuilding = true;
        state.walls[i].rebuildTimer = 5; // 5 seconds to rebuild
      }
    }
  }
}

export function drawWalls(ctx) {
  for (let i = 0; i < 4; i++) {
    const seg = WALL_SEGMENTS[i];
    const w = state.walls[i];
    const wy = getWallY(i);

    if (w.hp <= 0 && !w.rebuilding) {
      // Destroyed - draw rubble
      ctx.fillStyle = 'rgba(100,80,60,0.3)';
      ctx.fillRect(seg.x, wy, seg.w, WALL_H);
      // Rubble dots
      ctx.fillStyle = '#665544';
      for (let j = 0; j < 5; j++) {
        ctx.fillRect(seg.x + j * 25 + 5, wy + 5, 8, 8);
      }
      continue;
    }

    if (w.rebuilding) {
      // Rebuilding animation - blinking outline
      const blink = Math.sin(Date.now() / 200) > 0 ? 0.6 : 0.2;
      ctx.fillStyle = `rgba(150,150,100,${blink})`;
      ctx.fillRect(seg.x, wy, seg.w, WALL_H);
      // Progress bar
      const progress = 1 - w.rebuildTimer / 5;
      ctx.fillStyle = '#88ff88';
      ctx.fillRect(seg.x, wy + WALL_H + 2, seg.w * progress, 3);
      continue;
    }

    // Normal wall - color by HP
    const hpRatio = w.hp / w.maxHp;
    let color;
    if (hpRatio > 0.6) color = '#778866';      // green-gray (healthy)
    else if (hpRatio > 0.3) color = '#aa9944';  // yellow (damaged)
    else color = '#aa4444';                       // red (critical)

    ctx.fillStyle = color;
    ctx.fillRect(seg.x, wy, seg.w, WALL_H);

    // Stone texture lines
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    for (let j = 0; j < 4; j++) {
      ctx.beginPath();
      ctx.moveTo(seg.x + j * 30 + 15, wy);
      ctx.lineTo(seg.x + j * 30 + 15, wy + WALL_H);
      ctx.stroke();
    }

    // HP bar above wall
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(seg.x, wy - 6, seg.w, 4);
    ctx.fillStyle = hpRatio > 0.6 ? '#44ff44' : hpRatio > 0.3 ? '#ffff44' : '#ff4444';
    ctx.fillRect(seg.x, wy - 6, seg.w * hpRatio, 4);
  }
}
```

**Step 2: Commit**

```bash
git commit -m "feat: add wall.js with 4-segment castle wall system"
```

---

### Task 5: Create tower.js - central tower

**Files:**
- Create: `prototypes/zombie-world/js/tower.js`

**Step 1: Implement tower rendering**

Tower is a triangle/diamond shape at center bottom of the field. Shows HP bar and the player's "turret" direction indicator.

```js
import { W, state, TOWER_Y } from './game.js?v=1';

const TOWER_X = W / 2;
const TOWER_SIZE = 24;

export function drawTower(ctx) {
  const t = state.tower;
  const hpRatio = t.hp / t.maxHp;

  // Tower base (diamond shape)
  ctx.fillStyle = hpRatio > 0.5 ? '#ccaa44' : hpRatio > 0.25 ? '#aa8833' : '#884422';
  ctx.beginPath();
  ctx.moveTo(TOWER_X, TOWER_Y - TOWER_SIZE);       // top
  ctx.lineTo(TOWER_X + TOWER_SIZE, TOWER_Y);        // right
  ctx.lineTo(TOWER_X, TOWER_Y + TOWER_SIZE * 0.6);  // bottom
  ctx.lineTo(TOWER_X - TOWER_SIZE, TOWER_Y);        // left
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#ffdd66';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Turret direction indicator (small line showing aim angle)
  const barrelLen = 18;
  const dx = Math.cos(state.aimAngle);
  const dy = -Math.sin(state.aimAngle);
  ctx.strokeStyle = '#ff6644';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(TOWER_X, TOWER_Y);
  ctx.lineTo(TOWER_X + dx * barrelLen, TOWER_Y + dy * barrelLen);
  ctx.stroke();

  // HP bar below tower
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(TOWER_X - 30, TOWER_Y + TOWER_SIZE * 0.6 + 4, 60, 5);
  ctx.fillStyle = hpRatio > 0.5 ? '#44ff44' : hpRatio > 0.25 ? '#ffff44' : '#ff4444';
  ctx.fillRect(TOWER_X - 30, TOWER_Y + TOWER_SIZE * 0.6 + 4, 60 * hpRatio, 5);

  // "TOWER" label
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TOWER', TOWER_X, TOWER_Y + TOWER_SIZE * 0.6 + 14);
}
```

**Step 2: Commit**

```bash
git commit -m "feat: add tower.js with central tower rendering"
```

---

### Task 6: Rewrite aiming.js - half-circle dial

**Files:**
- Modify: `prototypes/zombie-world/js/aiming.js`

Replace the joystick with a half-circle dial at the bottom center of the controls area. The dial controls `state.aimAngle` which ranges from 0 (right / 3 o'clock) to π (left / 9 o'clock), with π/2 being straight up (12 o'clock).

**Step 1: Rewrite aiming.js entirely**

Key design:
- Dial center: (W/2, CONTROLS_BOTTOM - 40) — near bottom of controls area
- Dial radius: 80px
- Only the top half of the circle is interactive (angles π to 0, i.e. left to right)
- Dragging along the arc sets the angle
- Visual: arc outline + thumb indicator at current angle + angle text

```js
import { state, W, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H } from './game.js?v=1';
import { registerZone } from './input.js?v=1';

const CTRL_Y = CONTROLS_TOP + SLOT_H;
const CTRL_H = CONTROLS_BOTTOM - CTRL_Y;
const DIAL_CX = W / 2;
const DIAL_CY = CTRL_Y + CTRL_H * 0.65; // dial center
const DIAL_R = 75;
const THUMB_R = 14;

let active = false;

function angleFromTouch(x, y) {
  const dx = x - DIAL_CX;
  const dy = DIAL_CY - y; // flip Y
  let angle = Math.atan2(dy, dx);
  // Clamp to upper half (0 to π)
  if (angle < 0.15) angle = 0.15;       // ~8° from right
  if (angle > Math.PI - 0.15) angle = Math.PI - 0.15; // ~8° from left
  return angle;
}

export function initDial() {
  registerZone(
    { x: DIAL_CX - DIAL_R - 20, y: CTRL_Y, w: DIAL_R * 2 + 40, h: CTRL_H },
    {
      onStart(x, y) {
        active = true;
        state.aimAngle = angleFromTouch(x, y);
      },
      onMove(x, y) {
        if (!active) return;
        state.aimAngle = angleFromTouch(x, y);
      },
      onEnd() {
        active = false;
      },
    },
    5 // same priority as old joystick
  );
}

export function updateDial(dt) {
  // Nothing needed per-frame
}

export function drawDial(ctx) {
  ctx.save();

  // Dial arc (upper half)
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(DIAL_CX, DIAL_CY, DIAL_R, Math.PI, 0, false); // π to 0 = left to right arc
  ctx.stroke();

  // Tick marks at 30° intervals
  for (let deg = 0; deg <= 180; deg += 30) {
    const rad = deg * Math.PI / 180;
    const inner = DIAL_R - 8;
    const outer = DIAL_R + 4;
    ctx.strokeStyle = deg === 90 ? 'rgba(255,100,100,0.5)' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = deg === 90 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(DIAL_CX + Math.cos(rad) * inner, DIAL_CY - Math.sin(rad) * inner);
    ctx.lineTo(DIAL_CX + Math.cos(rad) * outer, DIAL_CY - Math.sin(rad) * outer);
    ctx.stroke();
  }

  // Current angle thumb
  const thumbX = DIAL_CX + Math.cos(state.aimAngle) * DIAL_R;
  const thumbY = DIAL_CY - Math.sin(state.aimAngle) * DIAL_R;

  ctx.fillStyle = active ? 'rgba(255,100,80,0.7)' : 'rgba(255,200,100,0.4)';
  ctx.beginPath();
  ctx.arc(thumbX, thumbY, THUMB_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = active ? '#ff6644' : 'rgba(255,200,100,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Direction line from center to thumb
  ctx.strokeStyle = 'rgba(255,100,80,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(DIAL_CX, DIAL_CY);
  ctx.lineTo(thumbX, thumbY);
  ctx.stroke();

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('조준', DIAL_CX, CTRL_Y + 12);

  ctx.restore();
}
```

**Step 2: Commit**

```bash
git commit -m "feat: replace joystick with half-circle dial aiming system"
```

---

### Task 7: Rewrite projectiles.js - 2D top-down ballistics

**Files:**
- Modify: `prototypes/zombie-world/js/projectiles.js`

Replace 3D ray-marching projectiles with 2D screen-space projectiles that travel along `aimAngle` from the tower position.

**Step 1: Rewrite fireProjectile()**

Projectiles now have `x, y` in screen coordinates and travel along a direction vector.
- Bullets: straight line at aimAngle, hit first zombie in path
- Arrows/bolts: travel a set distance based on power, can pass over near zombies
- Sniper: straight line, pierces through all zombies

```js
import { state, W, TOWER_Y } from './game.js?v=1';

const TOWER_X = W / 2;

export function fireProjectile(type, aimAngle, special = false, power = 1) {
  const dx = Math.cos(aimAngle);
  const dy = -Math.sin(aimAngle); // canvas Y is inverted

  // Spread
  let spreadAngle = 0;
  if (type === 'bullet') spreadAngle = (Math.random() - 0.5) * 0.03;
  else if (type === 'mgBullet') spreadAngle = (Math.random() - 0.5) * 0.06;
  else if (type === 'sniper') spreadAngle = (Math.random() - 0.5) * 0.006;

  const finalAngle = aimAngle + spreadAngle;
  const fdx = Math.cos(finalAngle);
  const fdy = -Math.sin(finalAngle);

  // Speed (pixels per second)
  let speed = 800;
  if (type === 'arrow') speed = 300 + power * 400;
  else if (type === 'sniper') speed = 1200;
  else if (type === 'mgBullet') speed = 900;
  else if (type === 'bolt') speed = 500;

  // Max range for arrows/bolts (based on power)
  let maxRange = 9999;
  if (type === 'arrow') maxRange = 200 + power * 500;
  else if (type === 'bolt') maxRange = 150 + power * 400;

  const proj = {
    type,
    special,
    x: TOWER_X,
    y: TOWER_Y,
    dx: fdx,
    dy: fdy,
    speed,
    maxRange,
    traveled: 0,
    alive: true,
    trail: [],
    time: 0,
    // For freeze/chain/poison buff application
    freeze: state.buffs.freezeShots > 0 && type !== 'arrow' && type !== 'bolt',
    chain: state.buffs.chainShots > 0 && type !== 'arrow' && type !== 'bolt',
    poison: state.buffs.poisonShots > 0 && type !== 'arrow' && type !== 'bolt',
  };

  // Consume buff shots
  if (proj.freeze) state.buffs.freezeShots--;
  if (proj.chain) state.buffs.chainShots--;
  if (proj.poison) state.buffs.poisonShots--;

  state.projectiles.push(proj);
}
```

**Step 2: Rewrite updateProjectiles()**

```js
export let missedThisFrame = 0;

export function updateProjectiles(dt) {
  missedThisFrame = 0;
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.time += dt;

    const move = p.speed * dt;
    p.x += p.dx * move;
    p.y += p.dy * move;
    p.traveled += move;

    // Trail for arrows/bolts
    if (p.type === 'arrow' || p.type === 'bolt') {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 8) p.trail.shift();
    }

    // Out of bounds or max range reached
    if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > 1000 || p.traveled >= p.maxRange) {
      p.alive = false;
      missedThisFrame++;
    }

    if (!p.alive) {
      state.projectiles.splice(i, 1);
    }
  }
}
```

**Step 3: Rewrite drawProjectiles()**

Draw projectiles as screen-space 2D entities (no worldToScreen).
- Bullets: small colored circle + short trail
- Arrows: line with arrowhead in travel direction
- Sniper: bright tracer line
- MG bullets: small dots
- Bolts: short green line

**Step 4: Commit**

```bash
git commit -m "feat: rewrite projectiles.js for 2D top-down ballistics"
```

---

## Phase 2: Zombie System

### Task 8: Create zombies.js - zombie spawning, AI, rendering

**Files:**
- Create: `prototypes/zombie-world/js/zombies.js`

This is the largest new file. It replaces `targets.js` entirely.

**Step 1: Define zombie type configs**

```js
const ZOMBIE_TYPES = {
  walker:      { color: '#66cc44', size: 14, hp: 2,  speed: 30,  wallDmg: 2,  score: 20  },
  runner:      { color: '#ee3333', size: 10, hp: 1,  speed: 70,  wallDmg: 1,  score: 15  },
  tank:        { color: '#9944cc', size: 20, hp: 8,  speed: 15,  wallDmg: 5,  score: 80  },
  rammer:      { color: '#ee8822', size: 18, hp: 5,  speed: 40,  wallDmg: 2,  score: 60  },
  necromancer: { color: '#440066', size: 14, hp: 4,  speed: 15,  wallDmg: 0,  score: 100 },
  splitter:    { color: '#44cc22', size: 14, hp: 3,  speed: 30,  wallDmg: 2,  score: 40  },
  bigone:      { color: '#990000', size: 30, hp: 20, speed: 10,  wallDmg: 8,  score: 300 },
  spider:      { color: '#999999', size: 7,  hp: 1,  speed: 90,  wallDmg: 1,  score: 10  },
};
```

**Step 2: Implement spawnZombie(type, x)**

Create a zombie object with:
```js
{
  type, x, y: -20 (spawn above screen top),
  hp, maxHp, speed, size, color,
  targetWallIdx (nearest wall segment based on x),
  pastWall: false,
  attackingWall: false,
  attackingTower: false,
  hitFlash: 0, // red flash timer on damage
  walkPhase: Math.random() * Math.PI * 2, // animation phase
  zigzagPhase: 0, // for spider/runner
  rammed: false, // for rammer (one-time charge)
  alive: true,
  statusEffects: { frozen: 0, poisoned: 0 }, // timers
  buffed: false, // necromancer buff
}
```

**Step 3: Implement updateZombies(dt)**

For each zombie:
1. Apply status effects (frozen = 50% speed, poisoned = 1 dmg/s)
2. Movement based on state:
   - If not at wall: move toward wall (y increases), with type-specific patterns
     - Walker: straight down
     - Runner: slight zigzag (sin wave on x)
     - Spider: heavy zigzag
     - Rammer: straight, accelerates near wall for charge
     - Necromancer: stops at y = WALL_Y - 80 (stays behind)
   - If at wall (and wall alive): attack wall (reduce HP per second)
   - If wall broken: move past wall toward tower
   - If at tower: attack tower
3. Necromancer aura: heal nearby zombies +1 HP/s, speed buff 1.3x
4. Rammer charge: when reaching wall, deal 15 damage once, then normal attack
5. Check alive (hp <= 0 → death)
6. On death:
   - Splitter → spawn 2 mini zombies
   - BigOne → drop 3-5 items
   - Others → chance to drop item

**Step 4: Implement checkZombieHits(projectiles)**

For each projectile, check collision with zombies (circle-to-point distance):
- Hit radius = zombie.size
- On hit: reduce zombie HP by weapon damage (bullet=1, arrow=2, sniper=3, mgBullet=1, bolt=2)
- Piercing types (sniper, arrow, bolt) continue through
- Non-piercing (bullet, mgBullet) stop on first hit
- Apply buff effects (freeze, chain, poison)
- Return array of { zombie, score, position } for scoring

**Step 5: Implement drawZombies(ctx)**

Draw each zombie as minimal geometric figure:
- Body: filled ellipse (color based on type)
- Head: smaller circle on top
- Arms/legs: 4 short lines, animated with walkPhase
- HP bar above head (only if HP < maxHp)
- Status effect indicators (blue snowflake for frozen, green drops for poison)
- Necromancer: purple aura circle around it
- Hit flash: brief red overlay

**Step 6: Implement wave spawning system**

```js
export function startWave(wave) { ... }
```

Based on wave number within the 5-wave day cycle:
- Wave 1 (Dawn): `baseCount` walkers + 1 supply
- Wave 2 (Day): `baseCount` walkers + `baseCount/2` runners
- Wave 3 (Sunset): mix + gold zombies (guaranteed drops)
- Wave 4 (Night): tanks + rammers
- Wave 5 (Midnight): bigone (if day >= 3) + everything

Scaling per day:
```js
const day = Math.ceil(wave / 5);
const baseCount = 4 + day * 2;
const hpMul = 1 + (day - 1) * 0.15;
const speedMul = 1 + (day - 1) * 0.08;
```

Use a spawn queue with staggered delays (0.5-2 seconds between spawns).

**Step 7: Commit**

```bash
git commit -m "feat: add zombies.js with 8 types, AI, spawning, hit detection"
```

---

### Task 9: Create daynight.js - day/night cycle & flashlight

**Files:**
- Create: `prototypes/zombie-world/js/daynight.js`

**Step 1: Implement night overlay**

```js
import { W, H, state, TOWER_Y } from './game.js?v=1';

const TOWER_X = W / 2;

export function updateDayNight(dt) {
  const waveInDay = ((state.wave - 1) % 5) + 1;
  const targetNight = waveInDay >= 4 ? 1 : 0;
  // Smooth transition
  const transSpeed = 0.5;
  if (state.nightDarkness < targetNight) {
    state.nightDarkness = Math.min(targetNight, state.nightDarkness + transSpeed * dt);
  } else if (state.nightDarkness > targetNight) {
    state.nightDarkness = Math.max(targetNight, state.nightDarkness - transSpeed * dt);
  }
  state.isNight = state.nightDarkness > 0.5;
}

export function drawNightOverlay(ctx) {
  if (state.nightDarkness <= 0) return;

  const darkness = state.nightDarkness * 0.85; // max 85% dark

  // Dark overlay
  ctx.fillStyle = `rgba(0,0,20,${darkness})`;
  ctx.fillRect(0, 0, W, H);

  // Flashlight cone from tower in aim direction
  const coneLen = 500;
  const coneAngle = 0.35; // ~20 degrees half-angle
  const dx = Math.cos(state.aimAngle);
  const dy = -Math.sin(state.aimAngle);

  // Use composite operation to "cut out" the flashlight area
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';

  const grad = ctx.createRadialGradient(TOWER_X, TOWER_Y, 0, TOWER_X, TOWER_Y, coneLen);
  grad.addColorStop(0, `rgba(0,0,0,${darkness * 0.9})`);
  grad.addColorStop(0.7, `rgba(0,0,0,${darkness * 0.5})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(TOWER_X, TOWER_Y);
  const leftAngle = state.aimAngle + coneAngle;
  const rightAngle = state.aimAngle - coneAngle;
  ctx.lineTo(TOWER_X + Math.cos(leftAngle) * coneLen, TOWER_Y - Math.sin(leftAngle) * coneLen);
  ctx.lineTo(TOWER_X + Math.cos(rightAngle) * coneLen, TOWER_Y - Math.sin(rightAngle) * coneLen);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

export function drawZombieEyes(ctx, zombie) {
  // Only visible in darkness, outside flashlight cone
  if (state.nightDarkness < 0.3) return;
  const eyeR = 2;
  const offset = zombie.size * 0.3;
  ctx.fillStyle = `rgba(255,0,0,${state.nightDarkness * 0.8})`;
  ctx.beginPath();
  ctx.arc(zombie.x - offset, zombie.y - zombie.size - 2, eyeR, 0, Math.PI * 2);
  ctx.arc(zombie.x + offset, zombie.y - zombie.size - 2, eyeR, 0, Math.PI * 2);
  ctx.fill();
}
```

**Step 2: Commit**

```bash
git commit -m "feat: add daynight.js with night overlay and flashlight cone"
```

---

## Phase 3: Items, HUD, & Integration

### Task 10: Rewrite items.js - zombie-world items

**Files:**
- Modify: `prototypes/zombie-world/js/items.js`

Keep the drop/pickup/physics system. Replace item types with zombie-world variants.

**Step 1: Replace item type definitions**

Remove old target-specific items. Add:
- Ammo types: bullet3, bullet6, arrow2, arrow5, sniperAmmo, mgAmmo, bolt2 (keep existing)
- New items: brick, medkit, mine, molotov, freeze, chain, poison, shield, speedBoost, bomb, magUpgrade
- Each with: label, color, icon drawing function, apply function, drop weight

**Step 2: Update applyItem() for new item effects**

```js
case 'brick':
  // Find lowest HP wall segment, add 25
  const lowest = state.walls.reduce((min, w, i) => w.hp < state.walls[min].hp ? i : min, 0);
  state.walls[lowest].hp = Math.min(state.walls[lowest].maxHp, state.walls[lowest].hp + 25);
  break;
case 'medkit':
  state.tower.hp = Math.min(state.tower.maxHp, state.tower.hp + 30);
  break;
case 'mine':
  // Place mine at random field position
  state.mines.push({ x: 50 + Math.random() * (W - 100), y: 200 + Math.random() * 300, radius: 60, damage: 5 });
  break;
case 'molotov':
  // Create fire hazard at random field position
  state.hazards.push({ type: 'fire', x: 50 + Math.random() * (W - 100), y: 200 + Math.random() * 250, radius: 50, damage: 2, timer: 3 });
  break;
case 'freeze':
  state.buffs.freezeShots += 3;
  break;
case 'chain':
  state.buffs.chainShots += 3;
  break;
case 'poison':
  state.buffs.poisonShots += 3;
  break;
case 'shield':
  state.buffs.shieldTimer = 5;
  break;
case 'speedBoost':
  state.buffs.speedTimer = 10;
  break;
case 'bomb':
  // Instant: deal 5 damage to all zombies
  for (const z of state.zombies) {
    z.hp -= 5;
    z.hitFlash = 0.15;
  }
  break;
```

**Step 3: Update drop weight table**

Higher weights for essential items (ammo, bricks), lower for powerful effects (bomb, shield).

**Step 4: Commit**

```bash
git commit -m "feat: rewrite items.js with zombie-world item types and effects"
```

---

### Task 11: Rewrite hud.js - zombie-world HUD

**Files:**
- Modify: `prototypes/zombie-world/js/hud.js`

**Step 1: Update top HUD bar**

Replace wave/target display with:
- Left: Score
- Center: `Day N - Wave M` + zombie count remaining + day/night icon
- Right: Total ammo + tower HP indicator
- Below walls: wall segment HP summary (mini icons)

**Step 2: Update title screen**

- Title: "ZOMBIE WORLD" in dark red
- Subtitle: "성벽을 지켜라"
- Show weapon icons preview
- "TAP TO START"

**Step 3: Update game over screen**

- "TOWER DESTROYED" or "DAY N SURVIVED"
- Show: day reached, total kills, best score
- Restart button

**Step 4: Update wave banner**

Show "Dawn / Day / Sunset / Night / Midnight" + wave number.
Show "DAY N COMPLETE" between days.

**Step 5: Keep weapon slots and pause menu as-is**

These work identically.

**Step 6: Commit**

```bash
git commit -m "feat: rewrite hud.js with zombie-world UI (day/night, wall HP, tower HP)"
```

---

### Task 12: Rewrite main.js - zombie-world game loop

**Files:**
- Modify: `prototypes/zombie-world/js/main.js`

**Step 1: Update imports**

Replace:
- `drawRange, drawCrosshair` → `drawField, drawFiringLine` from renderer.js
- `initJoystick, updateJoystick, drawJoystick` → `initDial, updateDial, drawDial` from aiming.js
- `updateTargets, checkHits, drawTargets, drawWaveBanner, getWaveClearBonus` → imports from zombies.js
- Add imports: `updateWalls, drawWalls` from wall.js
- Add imports: `drawTower` from tower.js
- Add imports: `updateDayNight, drawNightOverlay` from daynight.js

**Step 2: Update init calls**

Replace `initJoystick()` with `initDial()`.

**Step 3: Rewrite update()**

```js
function update(dt, realDt) {
  if (state.screen !== 'playing') return;

  state.time += dt;

  // Day/night cycle
  updateDayNight(dt);

  // Aim dial (no update needed but keep pattern)
  updateDial(dt);

  // Weapon updates
  updateSniper(dt);
  updateMG(dt);

  // Buff timers
  if (state.buffs.shieldTimer > 0) state.buffs.shieldTimer -= dt;
  if (state.buffs.speedTimer > 0) state.buffs.speedTimer -= dt;

  // Systems
  updateProjectiles(dt);
  updateZombies(dt);
  updateWalls(dt);
  updateMines(dt);
  updateHazards(dt);
  updateItems(dt);
  updateParticles(dt);

  // Collision: projectiles vs zombies
  const hits = checkZombieHits(state.projectiles);
  // ... scoring logic (similar to current but HP-based)

  // Wave management
  if (state.zombies.length === 0 && state.waveSpawnQueue.length === 0 && !state.waveCleared) {
    state.waveCleared = true;
    state.wavePause = 0;
  }
  if (state.waveCleared) {
    state.wavePause += dt;
    const pauseTime = state.wave % 5 === 0 ? 5 : 3; // longer pause between days
    if (state.wavePause >= pauseTime) {
      startWave(state.wave + 1);
    }
  }

  // Game over check
  if (state.tower.hp <= 0) {
    triggerGameOver();
  }

  // Slow-mo (keep existing)
  if (state.slowMo) {
    state.slowMoTimer -= realDt;
    if (state.slowMoTimer <= 0) state.slowMo = false;
  }
}
```

**Step 4: Rewrite draw()**

Draw order:
1. `drawField(ctx)` - background
2. `drawWalls(ctx)` - castle walls
3. `drawTower(ctx)` - player tower
4. `drawFiringLine(ctx)` - aim direction
5. `drawZombies(ctx)` - enemies
6. `drawMines(ctx)` / `drawHazards(ctx)` - field items
7. `drawProjectiles(ctx)` - bullets
8. `drawItems(ctx)` - pickups
9. `drawParticles(ctx)` - effects
10. `drawNightOverlay(ctx)` - darkness + flashlight
11. `drawWaveBanner(ctx)` - wave text
12. Slow-mo overlay
13. `drawHUD(ctx)` - top bar
14. `drawControlsBg(ctx)` - controls background
15. `drawWeaponSlots(ctx)` - weapon tabs
16. `drawDial(ctx)` - aim dial
17. Weapon UI draws (pistol, bow, etc.)
18. Pause/gameover overlays

**Step 5: Commit**

```bash
git commit -m "feat: rewrite main.js game loop for zombie-world systems"
```

---

## Phase 4: Weapon Adaptations & Audio

### Task 13: Adapt weapon modules for 2D firing

**Files:**
- Modify: `prototypes/zombie-world/js/pistol.js`
- Modify: `prototypes/zombie-world/js/bow.js`
- Modify: `prototypes/zombie-world/js/sniper.js`
- Modify: `prototypes/zombie-world/js/mg.js`
- Modify: `prototypes/zombie-world/js/crossbow.js`

**Step 1: Update fireProjectile calls in all 5 weapons**

In each weapon, the firing call changes from:
```js
fireProjectile('bullet', state.aimX, state.aimY, special);
```
to:
```js
fireProjectile('bullet', state.aimAngle, special);
```

This is a minimal search-and-replace in each weapon file.

**Step 2: Update bow.js power-to-range mapping**

The bow's `drawPower` now maps to projectile range instead of arc height. The `fireProjectile` call passes `power` which determines max travel distance.

**Step 3: Remove sniper scope's 3D zoom effect**

The scope in top-down doesn't make sense as a zoom. Instead, change it to a "precision mode" that reduces spread even further and shows a laser sight line. Simplify `drawScopeOverlay` to draw a tight laser beam along aim direction.

**Step 4: MG fire rate adjustment with speed buff**

Check `state.buffs.speedTimer > 0` and halve the fire interval.

**Step 5: Commit**

```bash
git commit -m "feat: adapt 5 weapon modules for 2D angle-based firing"
```

---

### Task 14: Update audio.js - zombie sounds

**Files:**
- Modify: `prototypes/zombie-world/js/audio.js`

**Step 1: Add zombie sound effects (synthesized)**

- `playZombieGroan()`: low-frequency oscillator sweep (80→60 Hz, 0.5s)
- `playZombieHit()`: short noise burst (0.05s, bandpass 800Hz)
- `playZombieDeath()`: descending tone (200→50 Hz, 0.3s)
- `playWallHit()`: thud sound (noise + low sine, 0.1s)
- `playWallBreak()`: crash sound (noise burst, 0.3s, multiple tones)
- `playTowerHit()`: metallic clang (high sine 800Hz, short)
- `playMineExplosion()`: explosion (noise + sine sweep 200→50, 0.5s)
- `playItemPickup()`: existing pickup sound (keep)
- `playWaveStart()`: horn sound (saw wave 440Hz, 0.3s)
- `playDayComplete()`: victory jingle (ascending 3-note)

**Step 2: Commit**

```bash
git commit -m "feat: add zombie-world synthesized sound effects"
```

---

## Phase 5: Polish & Deploy

### Task 15: Update index.html and final integration

**Files:**
- Modify: `prototypes/zombie-world/index.html`

**Step 1: Delete targets.js from zombie-world (replaced by zombies.js)**

```bash
rm prototypes/zombie-world/js/targets.js
```

**Step 2: Verify all imports resolve correctly**

Check that main.js imports match actual file exports. Run in browser and check console for module errors.

**Step 3: Fix any remaining import references to removed files**

**Step 4: Bump cache version in index.html**

**Step 5: Commit**

```bash
git commit -m "feat: finalize zombie-world integration, remove unused targets.js"
```

---

### Task 16: Add mines and hazards system

**Files:**
- Create or add to: `prototypes/zombie-world/js/hazards.js`

**Step 1: Implement mine system**

Mines sit on the field. When a zombie walks within `mine.radius`, it explodes:
- Deal damage to all zombies in radius
- Spawn explosion particles
- Remove mine

**Step 2: Implement fire/poison hazard zones**

Hazards are timed areas on the field:
- Fire: 2 damage/second to zombies inside, lasts 3 seconds
- Draw as semi-transparent colored circle with animation

**Step 3: Draw mines and hazards**

- Mine: small red circle with crosshatch pattern
- Fire: orange flickering circle
- Poison: green bubbling circle

**Step 4: Commit**

```bash
git commit -m "feat: add mines and hazard zones (fire, poison)"
```

---

### Task 17: Visual polish and particle effects

**Files:**
- Modify: `prototypes/zombie-world/js/particles.js`

**Step 1: Add zombie-specific particle types**

- `zombieDeath`: green/red splatter in type color
- `wallHit`: gray stone chips
- `wallBreak`: large stone chunk burst
- `explosion`: orange/red expanding ring
- `healPulse`: green upward floating crosses (necromancer)
- `freezeEffect`: blue ice crystals

**Step 2: Commit**

```bash
git commit -m "feat: add zombie-themed particle effects"
```

---

### Task 18: Testing and deployment

**Step 1: Open in browser and test each system**

Verify:
- [ ] Title screen shows "ZOMBIE WORLD"
- [ ] Game starts on tap
- [ ] Half-circle dial controls aim angle
- [ ] Firing line shows direction
- [ ] All 5 weapons fire in the aimed direction
- [ ] Zombies spawn and walk toward wall
- [ ] Zombies attack wall (HP decreases)
- [ ] Broken wall allows zombie entry
- [ ] Zombies attack tower after entry
- [ ] Tower HP 0 = game over
- [ ] Items drop and can be picked up
- [ ] Brick repairs wall
- [ ] Medkit heals tower
- [ ] Night waves darken screen with flashlight
- [ ] Wave progression works (5 per day)
- [ ] All 8 zombie types have distinct behavior
- [ ] Mines and hazards function
- [ ] Sounds play correctly
- [ ] Pause/settings work

**Step 2: Fix any bugs found during testing**

**Step 3: Deploy to GitHub Pages**

```bash
git push origin main
git push origin main:gh-pages --force
```

**Step 4: Final commit**

```bash
git commit -m "feat: zombie-world complete - tower defense shooter with 8 zombie types"
```

---

## Task Dependency Graph

```
Task 1 (scaffold)
  ├→ Task 2 (game.js)
  │    ├→ Task 3 (renderer.js)
  │    ├→ Task 4 (wall.js)
  │    ├→ Task 5 (tower.js)
  │    ├→ Task 6 (aiming.js)
  │    └→ Task 7 (projectiles.js)
  │         └→ Task 8 (zombies.js)
  │              └→ Task 9 (daynight.js)
  │                   └→ Task 10 (items.js)
  │                        └→ Task 11 (hud.js)
  │                             └→ Task 12 (main.js) ← integrates everything
  │                                  ├→ Task 13 (weapon adapts)
  │                                  ├→ Task 14 (audio)
  │                                  ├→ Task 15 (cleanup)
  │                                  ├→ Task 16 (hazards)
  │                                  └→ Task 17 (particles)
  └→ Task 18 (test & deploy) ← after all above
```
