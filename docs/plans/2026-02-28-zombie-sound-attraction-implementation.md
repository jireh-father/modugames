# Zombie Sound Attraction System - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform zombie AI from path-based movement to sound-attraction based movement, add weapon range/penetration, new sound-lure items, real-time day/night cycle, and replace inventory bar with pouch tab UI.

**Architecture:** Add a `soundSources[]` array to game state. Weapons/items emit sounds at origin and impact points. Zombies wander randomly in idle state, switch to attracted state when sound is within hearing range, and must reach the sound location before returning to idle. Walls are physical obstacles zombies push through (not targets). Day/night cycles independently on a 60s timer.

**Tech Stack:** Vanilla JS ES Modules, Canvas 2D, Web Audio API synthesis

---

### Task 1: Add Sound Source System to Game State

**Files:**
- Modify: `prototypes/zombie-world/js/game.js`

**Step 1: Add soundSources array and weapon config to state**

Add to `state` object after `hazards: []`:
```js
soundSources: [],    // { x, y, intensity, range, timer, duration, type }
```

Add weapon range/damage config as a new export:
```js
export const WEAPON_PROFILES = {
  pistol:   { range: 400, damage: 2, originSound: 250, impactSound: 80,  penetrate: 0 },
  bow:      { range: 500, damage: 3, originSound: 0,   impactSound: 50,  penetrate: 1 },
  sniper:   { range: 9999, damage: 5, originSound: 400, impactSound: 150, penetrate: 99 },
  mg:       { range: 350, damage: 1, originSound: 350, impactSound: 60,  penetrate: 0 },
  crossbow: { range: 450, damage: 4, originSound: 80,  impactSound: 60,  penetrate: 1 },
};
```

Add to `resetGame()`:
```js
state.soundSources = [];
state.dayNightTimer = 0;    // real-time day/night cycle timer (60s cycle)
```

Remove `waveTimeLimit` from state and resetGame (no longer needed).

Add `dayNightTimer: 0` to initial state.

**Step 2: Add emitSound helper function**

```js
export function emitSound(x, y, range, duration = 1.0, type = 'generic') {
  state.soundSources.push({ x, y, intensity: 1, range, timer: duration, duration, type });
}
```

**Step 3: Add updateSounds function**

```js
export function updateSounds(dt) {
  for (let i = state.soundSources.length - 1; i >= 0; i--) {
    const s = state.soundSources[i];
    s.timer -= dt;
    s.intensity = Math.max(0, s.timer / s.duration);
    if (s.timer <= 0) {
      state.soundSources.splice(i, 1);
    }
  }
}
```

**Step 4: Commit**
```
feat: add sound source system to game state
```

---

### Task 2: Rewrite Zombie AI for Sound Attraction

**Files:**
- Modify: `prototypes/zombie-world/js/zombies.js`

**Step 1: Add zombie state fields to spawnZombie**

Replace zombie movement state with sound-attraction fields:
```js
// Replace targetWallIdx, pastWall, attackingWall, attackingTower with:
state: 'idle',        // 'idle' | 'attracted' | 'arrived'
targetX: null,        // sound target X
targetY: null,        // sound target Y
idleDir: Math.random() * Math.PI * 2,  // random wander direction
idleDirTimer: 2 + Math.random() * 2,   // time until direction change
arrivedTimer: 0,      // time spent at arrived location
hearingRange: 300,    // how far this zombie can hear (default)
```

Keep: `alive, hp, maxHp, speed, size, color, hitFlash, walkPhase, zigzagPhase, rammed, statusEffects, buffed, gold`

**Step 2: Rewrite updateZombies movement logic**

For each zombie:

1. **Idle state**: Wander randomly
   - Move in `idleDir` direction at 30% speed
   - Decrement `idleDirTimer`, pick new random direction when it hits 0
   - Bounce off screen edges (0-W, FIELD_TOP-FIELD_BOTTOM)
   - Check for sounds: find strongest `soundSource` within `hearingRange`
   - If sound found → set `targetX/Y`, switch to `'attracted'`

2. **Attracted state**: Move toward target
   - Move toward `targetX, targetY` at full speed
   - Runner/spider: zigzag while moving
   - Rammer: 2x speed when within 100px of target
   - Check for wall collision en-route (if zombie y approaches wall y and wall hp > 0):
     - Apply wallDmg continuously while pushing through
     - Wall break allows passage
   - When within 15px of target: switch to `'arrived'`, set `arrivedTimer = 1.5`
   - **New stronger sound**: if a stronger sound appears within hearing range, update target
   - When attracted to tower area (gun sound), zombie reaches tower → deal tower damage

3. **Arrived state**: Linger at location
   - Decrement `arrivedTimer`
   - When timer hits 0: switch to `'idle'`, pick new random direction
   - Still check for new sounds (can be re-attracted immediately)

**Step 3: Update wall collision during attracted movement**

When zombie is attracted and its path crosses a wall segment:
- Check if zombie Y is at wall Y level AND wall segment has hp > 0
- Apply continuous wall damage (wallDmg * dt) while zombie is at wall
- When wall hp reaches 0, zombie passes through
- Sound: throttled playWallHit, playWallBreak on wall destruction

When zombie reaches tower position (within 20px of state.tower):
- Apply tower damage continuously (wallDmg * dt)
- Throttled playTowerHit

**Step 4: Keep necromancer special behavior**

Necromancer still heals/buffs nearby zombies. Moves toward sounds like other zombies but with its slow speed.

**Step 5: Keep splitter death behavior**

Mini-spiders spawned on splitter death start in `idle` state at splitter's position.

**Step 6: Remove wave-based isNight setting from startWave**

Remove `state.isNight = waveInDay >= 4;` from startWave — day/night is now independent.

**Step 7: Commit**
```
feat: rewrite zombie AI for sound-attraction movement
```

---

### Task 3: Add Weapon Range and Penetration

**Files:**
- Modify: `prototypes/zombie-world/js/projectiles.js`
- Modify: `prototypes/zombie-world/js/zombies.js` (checkZombieHits)

**Step 1: Update fireProjectile to use WEAPON_PROFILES**

Import `WEAPON_PROFILES` and `emitSound` from game.js.

Map projectile types to weapon profiles:
```js
const PROJ_TO_WEAPON = {
  bullet: 'pistol', arrow: 'bow', sniper: 'sniper', mgBullet: 'mg', bolt: 'crossbow'
};
```

Set maxRange from WEAPON_PROFILES for ALL projectile types (not just arrows/bolts):
```js
const wp = WEAPON_PROFILES[PROJ_TO_WEAPON[type]];
let maxRange = wp ? wp.range : 9999;
```

Emit origin sound when firing (at tower position):
```js
if (wp && wp.originSound > 0) {
  emitSound(state.tower.x, TOWER_Y, wp.originSound, 0.8, 'weapon');
}
```

Store `damage` on projectile from WEAPON_PROFILES:
```js
proj.damage = wp ? wp.damage : 1;
proj.penetrateLeft = wp ? wp.penetrate : 0;  // remaining penetrations
```

**Step 2: Update checkZombieHits for damage-based penetration**

In `zombies.js`, replace `PROJ_DAMAGE` table and `PIERCING_TYPES` set:
- Use `p.damage` directly from the projectile
- On hit: `z.hp -= p.damage`
- Emit impact sound at zombie position: `emitSound(z.x, z.y, wp.impactSound, 0.5, 'impact')`
- Penetration: if `p.penetrateLeft > 0`, decrement and continue; else `p.alive = false`
- Sniper (penetrateLeft=99) effectively passes through everything

**Step 3: Commit**
```
feat: add weapon range limits and penetration system
```

---

### Task 4: Update Firing Line to Show Weapon Range

**Files:**
- Modify: `prototypes/zombie-world/js/renderer.js`

**Step 1: Import WEAPON_PROFILES, update drawFiringLine**

```js
import { WEAPON_PROFILES } from './game.js?v=10';
```

Replace fixed `lineLen = 600` with:
```js
const wp = WEAPON_PROFILES[state.currentWeapon];
const lineLen = wp ? Math.min(wp.range, 600) : 600;
```

Add a range-end marker (small crosshair or dot at the end of the line).

**Step 2: Commit**
```
feat: firing line shows weapon range limit
```

---

### Task 5: Real-Time Day/Night Cycle

**Files:**
- Modify: `prototypes/zombie-world/js/daynight.js`

**Step 1: Rewrite updateDayNight for time-based cycling**

Replace wave-based night detection with timer-based:
```js
export function updateDayNight(dt) {
  state.dayNightTimer += dt;
  const CYCLE = 60;       // 60 second full cycle
  const DAY_RATIO = 40/60; // 40s day, 20s night

  const phase = (state.dayNightTimer % CYCLE) / CYCLE;
  const targetNight = phase >= DAY_RATIO ? 1 : 0;

  // Smooth transition
  const transSpeed = 0.5;
  if (state.nightDarkness < targetNight) {
    state.nightDarkness = Math.min(targetNight, state.nightDarkness + transSpeed * dt);
  } else if (state.nightDarkness > targetNight) {
    state.nightDarkness = Math.max(targetNight, state.nightDarkness - transSpeed * dt);
  }

  state.isNight = state.nightDarkness > 0.5;
}
```

**Step 2: Commit**
```
feat: independent real-time day/night cycle (40s day, 20s night)
```

---

### Task 6: Add Sound Lure Items

**Files:**
- Modify: `prototypes/zombie-world/js/items.js`
- Modify: `prototypes/zombie-world/js/inventory.js`
- Modify: `prototypes/zombie-world/js/audio.js`

**Step 1: Add new item definitions to items.js**

Add to ITEM_TYPES array:
```js
{ id: 'toy',         label: '장난감',    weight: 10, color: '#ff88cc' },
{ id: 'firecracker', label: '폭죽',     weight: 8,  color: '#ff4400' },
{ id: 'radio',       label: '라디오',    weight: 6,  color: '#44aaff' },
```

Add to INVENTORY_IDS set: `'toy', 'firecracker', 'radio'`
Add to DRAG_ITEMS set in inventory.js: `'toy', 'firecracker', 'radio'`

**Step 2: Add useInventoryItem cases**

```js
case 'toy':
  // Persistent sound source for 5s
  emitSound(targetX, targetY, 150, 5, 'toy');
  // Add to hazards-like system for visual
  state.soundLures.push({ x: targetX, y: targetY, timer: 5, type: 'toy', range: 150 });
  playToyActivate();
  break;
case 'firecracker':
  // Sound for 3s, then explode
  emitSound(targetX, targetY, 300, 3, 'firecracker');
  state.soundLures.push({ x: targetX, y: targetY, timer: 3, type: 'firecracker', range: 300, explodeOnEnd: true });
  playFirecrackerThrow();
  break;
case 'radio':
  // Long duration sound
  emitSound(targetX, targetY, 200, 10, 'radio');
  state.soundLures.push({ x: targetX, y: targetY, timer: 10, type: 'radio', range: 200 });
  playRadioActivate();
  break;
```

Add `soundLures: []` to game state and resetGame.

**Step 3: Add sound lure update logic**

Create `updateSoundLures(dt)` in items.js or a new lures module:
- Decrement timer
- Re-emit sound each frame (refresh the sound source so it persists)
- On timer end: if firecracker, do explosion (same as bomb: area damage + particles)
- Remove when timer <= 0

**Step 4: Add sound lure rendering**

Draw pulsing circles at lure positions showing their sound range. Different colors per type:
- Toy: pink pulse
- Firecracker: red pulse + sparkle particles
- Radio: blue pulse + music note symbols

**Step 5: Add drawItemIcon cases for new items**

```js
// toy - 작은 삐에로/인형
// firecracker - 빨간 폭죽
// radio - 라디오 박스
```

**Step 6: Add audio functions**

In audio.js, add:
- `playToyActivate()` - cute jingle
- `playFirecrackerThrow()` - fizz/sparkle
- `playRadioActivate()` - static + music

**Step 7: Commit**
```
feat: add sound lure items (toy, firecracker, radio)
```

---

### Task 7: Sound Source Visualization

**Files:**
- Modify: `prototypes/zombie-world/js/renderer.js` or create new render in main draw

**Step 1: Draw sound source ripples on field**

In the main draw loop (or renderer.js), draw sound sources as expanding circles:
```js
export function drawSoundSources(ctx) {
  for (const s of state.soundSources) {
    const alpha = s.intensity * 0.3;
    const pulse = Math.sin(Date.now() / 200) * 0.1;
    ctx.strokeStyle = `rgba(255,255,100,${alpha + pulse})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.range * s.intensity, 0, Math.PI * 2);
    ctx.stroke();
    // Inner ripple
    ctx.strokeStyle = `rgba(255,200,50,${alpha * 1.5})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.range * s.intensity * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}
```

**Step 2: Commit**
```
feat: visualize sound sources as ripple circles
```

---

### Task 8: Replace Inventory Bar with Pouch Tab

**Files:**
- Modify: `prototypes/zombie-world/js/hud.js`
- Modify: `prototypes/zombie-world/js/inventory.js`
- Modify: `prototypes/zombie-world/js/game.js`

**Step 1: Add pouch tab to weapon slots in hud.js**

Change WEAPONS array from 5 to 6 entries:
```js
const WEAPONS = ['pistol', 'bow', 'sniper', 'mg', 'crossbow', 'pouch'];
```

In drawWeaponSlots, add pouch entry:
```js
{ id: 'pouch', label: '주머니', color: '#ddaa66', bg: 'rgba(200,160,80,0.3)' },
```

When pouch tab is selected, don't show weapon controls — show pouch grid instead.

**Step 2: Rewrite inventory.js for pouch grid UI**

When `state.currentWeapon === 'pouch'`:
- Draw a 2-column grid below weapon slots
- Each cell: 50% width, ~60px tall
- Shows item icon (scaled) + item name + count
- Drag from grid cell to field for DRAG_ITEMS
- Tap for instant-use items (buffs)

Remove old inventory bar rendering (drawInventory single row).
Remove old ITEM_BAR_H usage from controls layout.

**Step 3: Update drawControlsBg in hud.js**

Remove the ITEM_BAR_H strip from controls background. The pouch grid replaces it and only shows when pouch tab is active.

**Step 4: Handle weapon tab tap for pouch**

In initHUD, when pouch is tapped, set `state.currentWeapon = 'pouch'`. No weapon fires in pouch mode.

**Step 5: Commit**
```
feat: replace inventory bar with pouch tab (2-column grid)
```

---

### Task 9: Wire Sound Emission to Existing Items

**Files:**
- Modify: `prototypes/zombie-world/js/items.js`
- Modify: `prototypes/zombie-world/js/hazards.js`

**Step 1: Add sound emission to bomb/molotov/mine**

In items.js useInventoryItem:
- bomb: `emitSound(targetX, targetY, 250, 1.0, 'explosion')`
- molotov: continuous sound handled by hazard update

In hazards.js:
- Molotov fire hazards emit `emitSound(h.x, h.y, 100, 0.3, 'fire')` periodically (every 0.5s while active)
- Mine explosion: `emitSound(mine.x, mine.y, 200, 0.8, 'explosion')`

**Step 2: Commit**
```
feat: existing items emit sound to attract zombies
```

---

### Task 10: Update Main Loop Integration

**Files:**
- Modify: `prototypes/zombie-world/js/main.js`

**Step 1: Import and call new update functions**

```js
import { updateSounds, emitSound } from './game.js?v=11';
import { drawSoundSources } from './renderer.js?v=11';
```

In update():
- Call `updateSounds(dt)` after other updates
- Call `updateSoundLures(dt)` if lures module exists

In draw():
- Call `drawSoundSources(ctx)` after drawField, before drawZombies

**Step 2: Update stage progression**

Remove wave-in-day system. Stages are now simple sequential:
- Stage N spawns zombies
- All dead → 5s pause → Stage N+1
- Remove day-based difficulty; use `state.wave` directly for scaling

Simplify startWave: remove switch/case for waveInDay. Instead:
```js
function startWave(stageNum) {
  const baseCount = 4 + stageNum * 2;
  const hpMul = 1 + (stageNum - 1) * 0.1;
  const speedMul = 1 + (stageNum - 1) * 0.05;
  // Mix zombie types based on stage number
  addToQueue('walker', baseCount);
  if (stageNum >= 2) addToQueue('runner', Math.floor(baseCount * 0.5));
  if (stageNum >= 3) addToQueue('tank', Math.floor(baseCount * 0.3));
  // etc...
}
```

**Step 3: Update wave clear pause to 5 seconds**

Change `const pauseTime = state.wave % 5 === 0 ? 5 : 3;` to `const pauseTime = 5;`

**Step 4: Remove combo reset on miss**

Combo system still works but missing doesn't reset it (no penalty for sound).

**Step 5: Commit**
```
feat: integrate sound system into main loop, simplify stage system
```

---

### Task 11: Bump Version and Deploy

**Files:**
- All files in `prototypes/zombie-world/`

**Step 1: Bump v=10 to v=11 in all imports**

```bash
find prototypes/zombie-world -type f \( -name "*.js" -o -name "*.html" \) -exec sed -i 's/?v=10/?v=11/g' {} +
```

**Step 2: Commit and deploy**

```bash
git add prototypes/zombie-world/
git commit -m "feat: zombie sound attraction system - full redesign"
git push origin main
git push origin main:gh-pages --force
```

---

## Execution Order

Tasks 1-3 are the core system changes (must be sequential).
Task 4-5 are independent visual/cycle changes.
Task 6-7 add new content.
Task 8 is the UI overhaul.
Task 9-10 wire everything together.
Task 11 deploys.
