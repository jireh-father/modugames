# Zombie World v2.1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 11 new features to zombie-world v2: flashlight, tower climb fix, sound propagation, building bullet collision, movement bug fix, 360-degree aiming, zombie speed boost, HP-based player speed, movement noise, shoe items, hunger + animals.

**Architecture:** All features are ES6 modules in `prototypes/zombie-world/js/`. New modules: `flashlight.js`, `animals.js`. State lives in `game.js`. Canvas 540x960, cache version `?v=15`.

**Tech Stack:** Vanilla JS, HTML5 Canvas 2D, ES6 Modules

---

## Parallel Batch Organization

### Batch 1 (6 parallel agents - independent files)
- Task 1: Flashlight system (flashlight.js NEW, game.js, hud.js, daynight.js)
- Task 4: Building bullet collision (projectiles.js, buildings.js)
- Task 6: 360-degree aiming (pistol.js, bow.js, sniper.js, mg.js, crossbow.js, flamethrower.js, gyro.js)
- Task 7: Attracted zombie speed boost (zombies.js)
- Task 8: Player HP-based speed (player.js)
- Task 11: Hunger + Animals (animals.js NEW, game.js, hud.js, items.js)

### Batch 2 (after Batch 1 merges - touches same files)
- Task 2: Tower climb bug fix (player.js)
- Task 3: Sound propagation (zombies.js)
- Task 5: Player top movement bug fix (player.js, pathfinding.js)
- Task 9: Player movement noise (player.js, game.js)
- Task 10: Shoe items (items.js, player.js, game.js)

### Batch 3 (final)
- Task 12: Wire all into main.js, bump cache v=15, integration test
- Task 13: Deploy to gh-pages

---

## Task 1: Flashlight System

**Files:**
- Create: `prototypes/zombie-world/js/flashlight.js`
- Modify: `prototypes/zombie-world/js/game.js` (add flashlight state + battery item)
- Modify: `prototypes/zombie-world/js/hud.js` (add flashlight weapon icon)
- Modify: `prototypes/zombie-world/js/daynight.js` (add player flashlight + tower searchlights)
- Modify: `prototypes/zombie-world/js/items.js` (add battery drop)

**game.js changes:**
```js
// In state object, add after flamethrower:
flashlight: {
  on: false,
  battery: 0,       // 0~100, starts empty
  batteryMax: 100,
  drainRate: 100/30, // depletes in 30 seconds
},

// In WEAPON_PROFILES, add:
flashlight: { range: 0, damage: 0, originSound: 0, impactSound: 0, penetrate: 0 },

// In resetGame(), add:
state.flashlight = { on: false, battery: 0, batteryMax: 100, drainRate: 100/30 };
```

**flashlight.js** (new file):
- `initFlashlight()`: register ON/OFF toggle zone in controls area, register battery drag zone
- `updateFlashlight(dt)`: drain battery when on, auto-off when depleted
- `drawFlashlightControls(ctx)`: battery gauge bar, ON/OFF button, battery slot icon
- Export all three functions

**Controls layout** (when flashlight weapon selected):
- Left: battery gauge (vertical bar, 60px tall)
- Center: ON/OFF toggle button (big circle, green=on, red=off)
- Right: "battery" slot where user drags battery from inventory

**hud.js changes:**
- Add flashlight icon (8th slot) to WEAPONS array: `{ id: 'flashlight', color: '#ffee88', bg: '...' }`
- Draw flashlight icon: circle + rays pattern

**daynight.js changes:**
- In `drawNightOverlay()`: if `state.flashlight.on && state.player.onTower < 0`, draw 200px radius circle around player position (destination-out)
- Add tower searchlights: for each alive tower, draw rotating 120px radius circle at distance 200px from tower, angle = `state.time * (2*PI/8)` (8 second rotation)

**items.js changes:**
- Add 'battery' to item definitions (auto-apply: adds 100 to flashlight.battery, capped at batteryMax)
- Add battery to drop table (5% base chance)

**Commit:** `feat: flashlight system with battery + tower searchlights`

---

## Task 2: Tower Climb Bug Fix

**Files:**
- Modify: `prototypes/zombie-world/js/player.js`

**Current bug:** `initPlayer()` registers a field tap zone. When tapping near a tower, it immediately sets `state.player.onTower = towerIdx` regardless of distance.

**Fix in player.js `initPlayer()` onTap handler:**
```js
// When player is on ground and taps near a tower:
// Instead of instant climb, set path to tower position
// Then in updatePlayer(), check if arrived at tower → auto-climb
const towerClickRange = 40;
for (let i = 0; i < state.towers.length; i++) {
  const t = state.towers[i];
  if (t.hp <= 0) continue;
  const distToTower = Math.hypot(x - t.x, y - TOWER_Y);
  if (distToTower < towerClickRange) {
    // Check if player is close enough to climb directly
    const playerDist = Math.hypot(state.player.x - t.x, state.player.y - TOWER_Y);
    if (playerDist < 40) {
      // Close enough - climb immediately
      state.player.onTower = i;
      state.player.x = t.x;
      state.player.y = TOWER_Y;
      state.player.moving = false;
      state.player.path = [];
    } else {
      // Far away - pathfind to tower, store target tower index
      state.player.targetTower = i;
      const path = findPath(state.player.x, state.player.y, t.x, TOWER_Y);
      if (path.length > 0) {
        state.player.path = path;
        state.player.pathIdx = 0;
        state.player.moving = true;
      }
    }
    return;
  }
}
```

**In updatePlayer()** - add auto-climb check after path following:
```js
// After movement update, check if arrived at target tower
if (state.player.targetTower >= 0 && !state.player.moving) {
  const t = state.towers[state.player.targetTower];
  if (t && t.hp > 0) {
    const dist = Math.hypot(state.player.x - t.x, state.player.y - TOWER_Y);
    if (dist < 40) {
      state.player.onTower = state.player.targetTower;
      state.player.x = t.x;
      state.player.y = TOWER_Y;
    }
  }
  state.player.targetTower = -1;
}
```

**In game.js state.player, add:** `targetTower: -1`
**In resetGame(), add:** `targetTower: -1`

**Commit:** `fix: tower climb requires walking to tower first`

---

## Task 3: Sound Propagation (Infinite Chain)

**Files:**
- Modify: `prototypes/zombie-world/js/zombies.js`

**Mechanic:** Attracted zombies that are moving emit low-level noise every 0.5s. Nearby idle zombies hear this and become attracted too, creating an infinite chain reaction.

**In spawnZombie(), add to zombie object:**
```js
noiseTimer: 0,  // countdown to next noise emission
```

**In updateZombies(), inside `attracted` block, add noise emission:**
```js
// Attracted zombies emit shuffling noise every 0.5s
z.noiseTimer -= dt;
if (z.noiseTimer <= 0) {
  z.noiseTimer = 0.5;
  emitSound(z.x, z.y, 60, 0.3, 'zombie_shuffle');
}
```

That's it - the existing `findClosestSound()` in idle zombies will pick up these zombie_shuffle sounds and become attracted. The chain propagates naturally.

**Commit:** `feat: infinite sound propagation - attracted zombies emit noise`

---

## Task 4: Building Bullet Collision

**Files:**
- Modify: `prototypes/zombie-world/js/projectiles.js`
- Read: `prototypes/zombie-world/js/buildings.js` (import `isInsideBuilding`)

**In projectiles.js:**
```js
// Add import at top:
import { isInsideBuilding } from './buildings.js?v=15';

// In updateProjectiles(), after position update, before zombie hit check:
// Skip building collision for arcing arrows (they fly over)
if (!(p.type === 'arrow' && p.arcTarget && !p.arcDescending)) {
  if (isInsideBuilding(p.x, p.y, 0)) {
    p.alive = false;
    // Spark particle
    spawnParticle('spark', p.x, p.y); // if particle system supports it
    continue;
  }
}
```

**Commit:** `feat: bullets blocked by buildings`

---

## Task 5: Player Top Movement Bug Fix

**Files:**
- Modify: `prototypes/zombie-world/js/player.js`
- Modify: `prototypes/zombie-world/js/pathfinding.js`

**Root cause:** In pathfinding.js `buildGrid()`, the grid starts at row 0 = y 48 (FIELD_TOP). But the grid clamp or building placement might block upper rows. Also in player.js, `newY = Math.max(48, ...)` clamps correctly but the pathfinding destination may not find valid nodes near the top.

**Fix in pathfinding.js:**
- Ensure grid row 0 (y=48~68) is walkable unless blocked by a building
- Check `GRID_START_Y` matches `FIELD_TOP` (48)

**Fix in player.js updatePlayer():**
- Change movement clamp from `Math.max(48, ...)` to `Math.max(FIELD_TOP, ...)`
- Ensure path-following doesn't stop early when y approaches FIELD_TOP

**Commit:** `fix: player can move to top of map`

---

## Task 6: 360-Degree Aiming

**Files (all angle clamps to remove):**
- Modify: `prototypes/zombie-world/js/pistol.js:92` — remove `Math.max(0.15, Math.min(Math.PI - 0.15, ...))`
- Modify: `prototypes/zombie-world/js/bow.js:86` — same
- Modify: `prototypes/zombie-world/js/sniper.js:97` — same
- Modify: `prototypes/zombie-world/js/mg.js:46` — same
- Modify: `prototypes/zombie-world/js/crossbow.js:76` — same
- Modify: `prototypes/zombie-world/js/flamethrower.js:69` — same
- Modify: `prototypes/zombie-world/js/gyro.js:60` — same

**Change in each file:** Replace angle clamp with wrap-around:
```js
// Before:
state.aimAngle = Math.max(0.15, Math.min(Math.PI - 0.15, state.aimAngle - frameDx * aimSens));

// After:
state.aimAngle = state.aimAngle - frameDx * aimSens;
// Wrap to 0~2PI
while (state.aimAngle < 0) state.aimAngle += Math.PI * 2;
while (state.aimAngle >= Math.PI * 2) state.aimAngle -= Math.PI * 2;
```

**renderer.js** firing line already uses `Math.cos/sin(aimAngle)` so it will work for all angles automatically.

**Commit:** `feat: 360-degree aiming - remove angle clamp`

---

## Task 7: Attracted Zombie Speed Boost

**Files:**
- Modify: `prototypes/zombie-world/js/zombies.js`

**In updateZombies(), inside `attracted` block:**
```js
// Before: let moveSpeed = z.speed * speedMul;
// After:
let moveSpeed = z.speed * speedMul * 1.5; // attracted zombies 50% faster
```

**Commit:** `feat: attracted zombies move 50% faster`

---

## Task 8: Player HP-Based Speed

**Files:**
- Modify: `prototypes/zombie-world/js/player.js`

**In updatePlayer(), where speed is used for path following:**
```js
// Calculate speed based on HP ratio (minimum 30%)
const hpRatio = Math.max(0.3, state.player.hp / state.player.maxHp);
const moveSpeed = state.player.speed * hpRatio;
```

Use `moveSpeed` instead of `state.player.speed` for path movement calculations.

**Commit:** `feat: player speed scales with HP (min 30%)`

---

## Task 9: Player Movement Noise

**Files:**
- Modify: `prototypes/zombie-world/js/player.js`
- Modify: `prototypes/zombie-world/js/game.js` (add shoe state)

**In game.js state.player, add:**
```js
moveNoiseRange: 40,   // base noise range
moveNoiseTimer: 0,    // countdown
shoeType: null,       // null | 'silent' | 'stealth'
shoeTimer: 0,         // remaining duration
```

**In player.js updatePlayer(), when player is moving on ground:**
```js
if (state.player.onTower < 0 && state.player.moving) {
  state.player.moveNoiseTimer -= dt;
  if (state.player.moveNoiseTimer <= 0) {
    state.player.moveNoiseTimer = 0.5;
    const noiseRange = state.player.shoeType === 'stealth' ? 0
                     : state.player.shoeType === 'silent' ? 15
                     : 40;
    if (noiseRange > 0) {
      emitSound(state.player.x, state.player.y, noiseRange, 0.3, 'footstep');
    }
  }
  // Shoe timer countdown
  if (state.player.shoeTimer > 0) {
    state.player.shoeTimer -= dt;
    if (state.player.shoeTimer <= 0) {
      state.player.shoeType = null;
    }
  }
}
```

**Commit:** `feat: player emits footstep noise while moving`

---

## Task 10: Shoe Items (2 types)

**Files:**
- Modify: `prototypes/zombie-world/js/items.js`

**Add to item definitions:**
```js
// In useInventoryItem or applyItem:
case 'silent_shoes':
  state.player.shoeType = 'silent';
  state.player.shoeTimer = 60;
  break;
case 'stealth_shoes':
  state.player.shoeType = 'stealth';
  state.player.shoeTimer = 30;
  break;
```

**Add to drop table:** silent_shoes (3% chance), stealth_shoes (1% chance)

**Add icons:** silent_shoes = shoe with mute icon, stealth_shoes = shoe with X icon

**Commit:** `feat: shoe items - silent and stealth shoes`

---

## Task 11: Hunger + Animals System

**Files:**
- Create: `prototypes/zombie-world/js/animals.js`
- Modify: `prototypes/zombie-world/js/game.js` (add hunger state, animals array)
- Modify: `prototypes/zombie-world/js/hud.js` (add hunger bar)
- Modify: `prototypes/zombie-world/js/items.js` (add food/meat items)

**game.js changes:**
```js
// In state:
hunger: 100,          // 0~100, death at 0
hungerMax: 100,
hungerRate: 100/180,  // depletes in 180 seconds
animals: [],
food: 3,              // starting food count

// In resetGame():
state.hunger = 100;
state.food = 3;
state.animals = [];
```

**animals.js** (new file):
```js
const ANIMAL_TYPES = {
  chicken: { color: '#ffcc66', size: 8, speed: 40, fleeSpeed: 80, meat: 25 },
  rabbit:  { color: '#cc9966', size: 7, speed: 25, fleeSpeed: 60, meat: 30 },
  rat:     { color: '#999999', size: 5, speed: 50, fleeSpeed: 100, meat: 15 },
  pigeon:  { color: '#aaaacc', size: 6, speed: 30, fleeSpeed: 70, meat: 20 },
  frog:    { color: '#66cc66', size: 6, speed: 15, fleeSpeed: 35, meat: 20 },
};
```

- `spawnAnimals(count)`: spawn 8~12 animals randomly on map (avoid buildings/walls)
- `updateAnimals(dt)`: idle wander + flee when player within 80px + zombie kills animals too
- `drawAnimals(ctx)`: simple colored shapes per type
- Player auto-catches animal when within 15px → meat item added to inventory
- Animals respawn: 1 new animal every 30 seconds if count < 5

**hud.js changes:**
- Draw hunger bar next to HP bar (orange color, food icon)
- When hunger < 30%, flash warning

**items.js changes:**
- Add 'food' item: inventory use, +30 hunger
- Add 'meat' item: inventory use, +25 hunger
- Food icon: bread shape, Meat icon: drumstick shape

**Hunger update in player.js or main.js:**
```js
state.hunger -= state.hungerRate * dt;
if (state.hunger <= 0) { state.hunger = 0; state.player.hp = 0; }
```

**Commit:** `feat: hunger system + 5 animal types`

---

## Task 12: Integration (main.js + cache bump)

**Files:**
- Modify: `prototypes/zombie-world/js/main.js` (import new modules, wire update/draw)
- Modify: ALL files with `?v=14` → `?v=15`

**main.js additions:**
```js
import { initFlashlight, updateFlashlight, drawFlashlightControls } from './flashlight.js?v=15';
import { spawnAnimals, updateAnimals, drawAnimals } from './animals.js?v=15';

// In init: initFlashlight(), spawnAnimals(10)
// In update: updateFlashlight(dt), updateAnimals(dt), hunger drain
// In draw: drawAnimals(ctx), drawFlashlightControls(ctx)
```

**Cache bump:** Replace all `?v=14` with `?v=15` across all .js files and index.html.

**Commit:** `chore: wire v2.1 modules + bump cache v=15`

---

## Task 13: Deploy to gh-pages

**Steps:**
1. `git checkout gh-pages`
2. `git checkout main -- prototypes/zombie-world/`
3. `git add && git commit && git push`
4. `git checkout main`

**Commit:** `deploy: zombie world v2.1 - 11 new features`
