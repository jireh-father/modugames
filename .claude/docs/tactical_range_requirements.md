# Tactical Range - Requirements & Feature Document

## Overview
Tactical Range is an HTML5 Canvas shooting range survival game (540x960) built with ES Modules. The player aims and shoots targets at a 3D-perspective indoor shooting range using pistol and bow weapons, surviving through increasingly difficult waves.

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
- **Magazine**: 6 rounds, manual reload
- **Reload sequence**: Slide lock → magazine out → new magazine in → slide release
- **Slide interaction**: Drag up/down for rack and reload
- **Magazine interaction**: Tap to eject, tap to insert
- **Special ammo**: Penetrating bullets (yellow, pass through obstacles)
- **Bullet trajectory**: Straight line, `vz = 3.0`

### Bow (`bow.js`)
- **Draw**: Hold and pull down to charge (0-1 power)
- **Release**: Fire arrow on release
- **Arrow trajectory**: Parabolic arc (gravity 0.6, initial upward velocity)
- **Arrow properties**: Pass through obstacles (arc over), penetrate targets (multi-kill)
- **Special arrows**: Explosive (area damage, radius 0.3)
- **Nock**: Must nock arrow before drawing

## Target System (`targets.js`)

### Target Types
| Type | Size | Movement | Score | Special |
|------|------|----------|-------|---------|
| `normal` | 1.0 | Oscillating | Ring-based | Standard |
| `fast` | 0.6 | 1.5x speed | Ring-based | Smaller, faster |
| `gold` | 1.0 | Oscillating | Ring-based | Sparkle effect |
| `bonus` | 0.7 | Static | Ring-based | Blinks, time-limited |
| `supply` | 1.0 | Falls down | N/A | Drops ammo/items |
| `walled` | 0.9 | Static | Ring-based (blue) | Behind wall, arrow-only |

### Scoring System
- **Ring score**: 1-10 based on hit distance from center
- **Distance multiplier**: near(z<0.4)=1x, mid(0.4-0.7)=2x, far(z>0.7)=3x
- **Arrow multi-kill**: Penetration hits multiply score
- **Combo multiplier**: combo >= 2 gives `1 + combo * 0.5` multiplier
- **Scale**: All scores x100
- **Formula**: `ringScore * distMul * arrowMul * comboMul * 100`
- **Wave clear bonus**: `Math.floor(remainingTimeRatio * wave * 1000)`
- **Arrow explosion multi-hit**: `500 * distMul` per extra target

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

### Obstacles & Walls
- **Standard obstacles**: Brown wooden barriers that block bullets
  - Arrows arc over them via parabolic trajectory
  - Penetrating (special) bullets pass through
- **Walled targets**: Dedicated walls with targets placed behind them
  - Blue-colored targets indicate arrow-only
  - Wall shows hit counter (`hits/5`)
  - After 5 bullet hits to same wall, wall breaks (penetration)
  - Crack effects shown on damaged walls
  - Bow icon displayed above walled targets

## Items & Power-ups (`items.js`)
- Drop from supply crates and combo milestones
- Types include: extra bullets, extra arrows, special ammo, slow-mo

## Effects

### Particles (`particles.js`)
- `woodChips` - On target/obstacle hit
- `hitMarker` - On target hit
- `muzzleFlash` - On pistol fire
- `explosion` - On explosive arrow impact / wall break
- `comboText` - Combo counter display
- `scoreText` - Score popup with color coding

### Slow Motion
- Triggers on last shot (1 total ammo remaining)
- Duration: 3 seconds
- Game speed: 0.3x (real-time continues for timers)
- Red overlay + "LAST SHOT!" text

## Audio (`audio.js`)
- Gunshot, target hit, supply drop, combo sounds

## UI/HUD (`hud.js`)

### In-Game HUD
- Top bar: wave number, score, best score+wave, pause button
- Bottom: weapon slots, joystick area, weapon-specific controls

### Pause Menu
- Dark overlay with 4 buttons:
  - RESUME (green #4a8)
  - RESTART (red #a84)
  - SETTINGS (gray #668)
  - EXIT (dark red #844)
- Pause icon (||) in top-right corner

### Game Over Screen
- Final score, max combo, wave reached
- Best score and best wave records (separate tracking)
- Flashing "NEW BEST!" text for broken records
- "DOUBLE RECORD!" for both records broken
- RESTART and EXIT buttons

### Title Screen
- Game title "TACTICAL RANGE"
- Best score and best wave display
- Settings button (gear icon)
- Tap to start

## Settings (`settings.js`)

### Configurable Options
| Setting | Key | Range | Default | Step |
|---------|-----|-------|---------|------|
| Joystick Sensitivity | `dragSens` | 0.003-0.018 | 0.009 | 0.001 |
| Gyro Sensitivity | `gyroSens` | 0.01-0.06 | 0.03 | 0.005 |
| Gyro ON/OFF | `gyroOn` | boolean | true | - |

### UI Elements
- Slider bars with left/right arrows and direct tap
- Default value marker (yellow vertical line)
- Value display below each slider
- Gyro ON/OFF toggle buttons
- DEFAULT button to reset all
- BACK button to return

### Persistence
- `localStorage` keys: `tr_drag_sens`, `tr_gyro_sens`, `tr_gyro_on`
- `tr_best` (best score), `tr_best_wave` (best wave)

## Game Layout
```
┌──────────────────────┐ 0
│       HUD (48px)     │
├──────────────────────┤ 48 (RANGE_TOP)
│                      │
│   Shooting Range     │
│   (3D Perspective)   │
│                      │
├──────────────────────┤ 672 (RANGE_BOTTOM / CONTROLS_TOP)
│  Weapon Slots (40px) │
├──────────────────────┤
│ Joystick │  Weapon   │
│ (110px)  │ Controls  │
│          │           │
└──────────────────────┘ 960
```

## File Structure
```
prototypes/tactical-range/
├── index.html          # Entry point (cache v=20260227i)
├── js/
│   ├── game.js         # Constants, state, reset
│   ├── main.js         # Game loop, imports
│   ├── input.js        # Touch/mouse zone system
│   ├── renderer.js     # 3D perspective, crosshair
│   ├── aiming.js       # Joystick direct-drag
│   ├── gyro.js         # Gyroscope aiming
│   ├── pistol.js       # Pistol weapon system
│   ├── bow.js          # Bow weapon system
│   ├── projectiles.js  # Bullet/arrow trajectories
│   ├── targets.js      # Wave system, hit detection, obstacles, walls
│   ├── items.js        # Power-up drops
│   ├── particles.js    # Visual effects
│   ├── audio.js        # Sound effects
│   ├── hud.js          # All UI screens
│   └── settings.js     # Settings menu
```

## Cache Versioning
- JS modules: `?v=9`
- HTML: `?v=20260227i`
- Bump on every deploy

## Deployment
1. Commit changes to `main`
2. Push to remote
3. Checkout `gh-pages` branch
4. Copy files from `main`
5. Commit and push `gh-pages`
6. Return to `main`
