# Tactical Range - Requirements & Feature Document

## Overview
Tactical Range is an HTML5 Canvas shooting range survival game (540x960) built with ES Modules. The player aims and shoots targets at a 3D-perspective indoor shooting range using 5 weapons (pistol, bow, sniper rifle, machine gun, crossbow), surviving through increasingly difficult waves.

## Tech Stack
- **Rendering**: HTML5 Canvas 2D (`540x960` fixed resolution, CSS-scaled)
- **Architecture**: ES Modules with `?v=N` cache busting
- **Deployment**: GitHub Pages via `gh-pages` branch
- **Storage**: `localStorage` for settings and best records

## Core Systems

### 1. Screen States
- `title` - Title screen with BEST SCORE, BEST WAVE, SETTINGS button, tap to start
- `playing` - Active gameplay
- `paused` - Pause menu overlay (RESUME, RESTART, SETTINGS, EXIT)
- `settings` - Settings menu (accessible from title and pause)
- `gameover` - Game over overlay with score summary and records

### 2. Input System (`input.js`)
- Unified touch/mouse input via zone-based priority system
- `registerZone(zone, callbacks, priority)` - Higher priority checked first
- Callbacks: `onStart`, `onMove`, `onEnd`, `onTap`
- `onStart() { return false; }` pattern to skip handler and fall through
- Screen state filtering:
  - `paused`/`settings` screens: only priority -1 and 100 handlers
  - Non-playing screens: only negative priority handlers

### 3. Aiming System (`aiming.js`)
- **Direct-drag joystick**: finger delta maps directly to aim movement
- `aimX`, `aimY` range: -1 to 1
- Sensitivity controlled by `settings.dragSens` (default 0.009, range 0.003-0.018)
- Joystick zone: bottom-left (`JOYSTICK_W = 110`)
- Y-axis locked during bow drawing

### 4. Gyroscope Aiming (`gyro.js`)
- Device orientation-based aiming (gamma for X, beta for Y)
- Both axes inverted (`-dGamma`, `-dBeta`)
- Sensitivity: `settings.gyroSens` (default 0.03, range 0.01-0.06)
- Can be toggled ON/OFF via settings

### 5. 3D Perspective Rendering (`renderer.js`)
- Vanishing point at `(W/2, RANGE_TOP + RANGE_H * 0.15)`
- Perspective formula: `p = 1 - z * 0.85` (z=0 near, z=1 far)
- `worldToScreen(x, y, z, aimX, aimY)` converts world to screen coords
- Aim range: `AIM_RANGE_X = 350`, `AIM_RANGE_Y = 280`
- Indoor shooting range aesthetic with ceiling lights, floor, side walls

### 6. Crosshair (`renderer.js`)
- Red crosshair at aim position
- Moves across screen based on `aimX`/`aimY`

## Weapons

### Pistol (`pistol.js`)
- **Fire**: Instant on trigger touch (`onStart`) - no drag-release
- **Magazine**: 6 rounds (upgradable to 12 via item), manual reload
- **Reload sequence**: Slide lock -> magazine out -> new magazine in -> slide release
- **Slide interaction**: Drag down for rack and reload
- **Magazine interaction**: Drag down to eject, drag-and-drop in reload popup
- **Special ammo**: Penetrating bullets (yellow, pass through obstacles)
- **Bullet trajectory**: Straight line, `vz = 3.0`, slight spread (0.015)
- **Controls**: 3-column layout (slide | trigger | magazine)

### Bow (`bow.js`)
- **Draw**: Hold and pull down to charge (0-1 power)
- **Release**: Fire arrow on release
- **Arrow trajectory**: Parabolic arc (gravity 0.6, initial upward velocity)
- **Arrow properties**: Pass through obstacles (arc over), penetrate targets (multi-kill)
- **Special arrows**: Explosive (area damage, radius 0.3)
- **Nock**: Must drag arrow from quiver to bow before drawing
- **Controls**: 2-column layout (quiver | bow+string)

### Sniper Rifle (`sniper.js`)
- **Fire**: Instant on trigger tap - single shot, high damage (1.5x score bonus)
- **Bolt-action**: Manual bolt cycle after each shot
  - Drag up: Open bolt (eject casing) - auto-opens on fire
  - Drag down: Close bolt (chamber new round from reserve)
- **Scope**: Hold right button to activate scope zoom
  - Dark vignette overlay with circular clear view
  - Precise mil-dot crosshair inside scope
  - Zoom level 2x-6x displayed
  - Scope center follows crosshair position
- **Projectile**: Very fast (`vz = 5.0`), minimal spread (0.003), penetrates targets and obstacles
- **Ammo**: Single chambered round + reserve rounds (start: 3)
- **Controls**: 3-column layout (bolt | trigger | scope)

### Machine Gun (`mg.js`)
- **Fire**: Hold to auto-fire at 10 rounds/sec
- **Overheating**: Heat gauge increases per shot (0.04/shot), decreases when not firing (0.15/sec)
  - At 100% heat: forced cooldown, weapon locks
  - Must manually re-cock after overheat cooldown (heat < 30%)
- **Cocking**: Tap cocking handle (top-right) to ready weapon
- **Projectile**: Fast (`vz = 3.5`), high spread (0.025), does not penetrate
- **Ammo**: 30-round belt, auto-reloads from reserve when empty
- **Visual**: Barrel glows red when hot, muzzle flash during firing
- **Controls**: Full-width hold-to-fire area + cocking handle

### Crossbow (`crossbow.js`)
- **Fire**: Tap center to fire when loaded and cocked
- **Crank loading**: Drag down on crank area to cock the crossbow (progress bar)
  - Must complete ~90% of crank stroke to cock
- **Bolt loading**: Drag bolt from bolt slot to crossbow center after cocking
- **Bolt trajectory**: Slight parabolic arc (gravity 0.3, arcs over obstacles)
- **Bolt properties**: Penetrates targets (multi-kill like arrows)
- **Ammo**: Bolts (start: 3)
- **Controls**: 3-column layout (bolt slot | crossbow body | crank)

## Projectile Types

| Type | Speed | Spread | Penetrates Targets | Arcs Over Obstacles | Score Bonus |
|------|-------|--------|-------------------|-------------------|-------------|
| `bullet` | 3.0 | 0.015 | No | No | 1x |
| `arrow` | 0.4-0.75 | 0 | Yes (multi-kill) | Yes | 1x |
| `sniper` | 5.0 | 0.003 | Yes (multi-kill) | No (pierces) | 1.5x |
| `mgBullet` | 3.5 | 0.025 | No | No | 1x |
| `bolt` | 2.0 | 0 | Yes (multi-kill) | Yes (slight arc) | 1x |

## Target System (`targets.js`)

### Target Types
| Type | Size | Movement | Score | Special |
|------|------|----------|-------|---------|
| `normal` | 1.0 | Oscillating | Ring-based | Standard |
| `fast` | 0.6 | 1.5x speed | Ring-based | Smaller, faster |
| `gold` | 1.0 | Oscillating | Ring-based | Sparkle effect |
| `bonus` | 0.7 | Static | Ring-based | Blinks, time-limited |
| `supply` | 1.0 | Falls down | N/A | Drops ammo/items |
| `walled` | 0.9 | Static | Ring-based (blue) | Behind wall, arrow/bolt only |

### Scoring System
- **Ring score**: 1-10 based on hit distance from center
- **Distance multiplier**: near(z<0.4)=1x, mid(0.4-0.7)=2x, far(z>0.7)=3x
- **Penetration multi-kill**: Arrow/sniper/bolt hits multiply score
- **Combo multiplier**: combo >= 2 gives `1 + combo * 0.5` multiplier
- **Scale**: All scores x100
- **Formula**: `ringScore * distMul * arrowMul * sniperBonus * comboMul * 100`
- **Wave clear bonus**: `Math.floor(remainingTimeRatio * wave * 1000)`
- **Arrow explosion multi-hit**: `500 * distMul` per extra target
- **Far target hitbox**: `distBonus = 1 + z * 0.4` (1.0x to 1.4x)

### Wave System
5-phase repeating cycle with scaling difficulty:

| Phase | Name | Targets | Special |
|-------|------|---------|---------|
| 1 | Warmup | normals + 1 supply | 0.5x speed |
| 2 | Speed | normals + fasts + 1 supply | 1.3x speed |
| 3 | Bonus | normals + gold + bonus + supplies | Normal speed |
| 4 | Obstacle | normals + fasts + walls + **walled targets** | Obstacles block bullets |
| 5 | Boss | normals + fasts + gold + bonus + **walled targets** | 0.85x size, 1.2x speed |

- **Cycle scaling**: Each cycle increases base count, speed, and reduces size
- **Spawn timing**: Normal targets spawn immediately, specials on random delays
- **Time limit**: `totalTargets * max(3, 6 - cycle * 0.5)` seconds
- **Distance scaling**: `getMaxZ() = min(0.9, 0.35 + wave * 0.035)` - easier waves = closer

### Obstacles & Walls
- **Standard obstacles**: Brown wooden barriers that block bullets/mg
  - Arrows/bolts arc over them via parabolic trajectory
  - Penetrating (special) bullets and sniper rounds pass through
- **Walled targets**: Dedicated walls with targets placed behind them
  - Blue-colored targets indicate arrow/bolt-only
  - Wall shows hit counter (`hits/5`)
  - After 5 bullet hits to same wall, wall breaks (penetration)
  - Crack effects shown on damaged walls
  - Bow icon displayed above walled targets

## Items & Power-ups (`items.js`)

### Item Types
| Item | Label | Weight | Effect |
|------|-------|--------|--------|
| `bullet3` | 탄환x3 | 25 | +3 pistol reserve bullets |
| `bullet6` | 탄환x6 | 12 | +6 pistol reserve bullets |
| `arrow2` | 화살x2 | 25 | +2 bow arrows |
| `arrow5` | 화살x5 | 12 | +5 bow arrows |
| `goldBullet` | 관통탄 | 5 | +1 pistol penetrating bullet |
| `explosiveArrow` | 폭발화살 | 5 | +1 explosive arrow |
| `magUpgrade` | 탄창+2 | 4 | Pistol magazine max +2 (cap 12) |
| `sniperAmmo` | 저격탄x2 | 8 | +2 sniper reserve rounds |
| `mgAmmo` | 기관총탄x30 | 8 | +30 MG reserve ammo |
| `bolt2` | 볼트x2 | 8 | +2 crossbow bolts |

### Drop Conditions
- Gold target hit: guaranteed drop
- Supply crate hit: guaranteed drop
- Combo milestones (3, 5, 10, 15...): guaranteed drop
- Normal hit: 15% chance
- Weighted random selection from item table

### Item Behavior
- Physics: bounce up then fall to ground
- Life: 8 seconds, blinks when < 2s remaining
- Collection: tap within 40px radius
- Life bar shown when < 4s remaining

## Effects

### Particles (`particles.js`)
- `woodChips` - On target/obstacle hit
- `hitMarker` - On target hit
- `muzzleFlash` - On any weapon fire
- `explosion` - On explosive arrow impact / wall break
- `comboText` - Combo counter display
- `scoreText` - Score popup with color coding
- `bowString` - Bow string vibration effect

### Slow Motion
- Triggers on last shot (1 total ammo remaining across all weapons)
- Duration: 3 seconds
- Game speed: 0.3x (real-time continues for timers)
- Red overlay + "LAST SHOT!" text

## Audio (`audio.js`)
All sounds synthesized via Web Audio API (no audio files).

### Weapon Sounds
- **Pistol**: gunshot, slide rack, mag out, mag in, bullet load
- **Bow**: draw (wood creak), release (string vibration), arrow pick, arrow nock
- **Sniper**: shot (with echo), bolt up, bolt down, load, scope zoom
- **Machine Gun**: shot (rapid), burst end, cock, overheat warning, cooldown
- **Crossbow**: shoot, crank (gear teeth), bolt load

### Game Sounds
- Target hit, wall hit, wall break, bullet miss
- Explosion, supply drop, item drop, item pickup
- Combo (pitch scales with count), wave start, wave clear
- Game over, start, new record, slow-mo activation
- UI: click, pause, resume, weapon switch

## UI/HUD (`hud.js`)

### In-Game HUD
- Top bar: wave number, score, best score+wave, total ammo, pause button
- Bottom: 5 weapon slots, joystick area, weapon-specific controls

### Weapon Slots (5)
| Slot | Color (Active) | Background |
|------|---------------|------------|
| 권총 (Pistol) | #ffcc66 | rgba(255,200,100,0.3) |
| 활 (Bow) | #aaddaa | rgba(150,200,100,0.3) |
| 저격 (Sniper) | #88bbff | rgba(100,150,255,0.3) |
| 기관총 (MG) | #ffaa66 | rgba(255,150,80,0.3) |
| 석궁 (Crossbow) | #88ff88 | rgba(100,255,100,0.3) |

### Pause Menu
- Dark overlay with 4 buttons: RESUME, RESTART, SETTINGS, EXIT

### Game Over Screen
- Final score, max combo, wave reached
- Best score and best wave records (separate tracking)
- Flashing "NEW BEST!" text for broken records

### Title Screen
- Game title "TACTICAL RANGE"
- Best score and best wave display
- Weapon list preview
- Settings button + tap to start

## Settings (`settings.js`)

### Configurable Options
| Setting | Key | Range | Default | Step |
|---------|-----|-------|---------|------|
| Joystick Sensitivity | `dragSens` | 0.003-0.018 | 0.009 | 0.001 |
| Gyro Sensitivity | `gyroSens` | 0.01-0.06 | 0.03 | 0.005 |
| Gyro ON/OFF | `gyroOn` | boolean | true | - |

### Persistence
- `localStorage` keys: `tr_drag_sens`, `tr_gyro_sens`, `tr_gyro_on`
- `tr_best` (best score), `tr_best_wave` (best wave)

## Game Layout
```
+----------------------+ 0
|       HUD (48px)     |
+----------------------+ 48 (RANGE_TOP)
|                      |
|   Shooting Range     |
|   (3D Perspective)   |
|                      |
+----------------------+ 672 (RANGE_BOTTOM / CONTROLS_TOP)
| 5 Weapon Slots(40px) |
+----------------------+
| Joystick |  Weapon   |
| (110px)  | Controls  |
|          |           |
+----------------------+ 960
```

## File Structure
```
prototypes/tactical-range/
+-- index.html          # Entry point (cache v=20260227n)
+-- js/
    +-- game.js         # Constants, state (5 weapons), reset
    +-- main.js         # Game loop, imports all modules
    +-- input.js        # Touch/mouse zone system
    +-- renderer.js     # 3D perspective, crosshair
    +-- aiming.js       # Joystick direct-drag
    +-- gyro.js         # Gyroscope aiming
    +-- pistol.js       # Pistol weapon system
    +-- bow.js          # Bow weapon system
    +-- sniper.js       # Sniper rifle (bolt-action + scope)
    +-- mg.js           # Machine gun (auto-fire + overheat)
    +-- crossbow.js     # Crossbow (crank + bolt loading)
    +-- projectiles.js  # All projectile types + trajectories
    +-- targets.js      # Wave system, hit detection, obstacles, walls
    +-- items.js        # Power-up drops (10 item types)
    +-- particles.js    # Visual effects
    +-- audio.js        # Sound effects (all synthesized)
    +-- hud.js          # All UI screens (5 weapon slots)
    +-- settings.js     # Settings menu
```

## Cache Versioning
- JS modules: `?v=11`
- HTML: `?v=20260227n`
- Bump on every deploy

## Deployment
1. Commit changes to `main`
2. Push to remote
3. Checkout `gh-pages` branch
4. Copy files from `main`
5. Commit and push `gh-pages`
6. Return to `main`
