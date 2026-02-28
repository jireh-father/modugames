# Zombie World: Sound Attraction Redesign

## Core Concept
Zombies react only to sound. They wander randomly until they hear something, then move toward the sound source. They must reach the exact sound location before stopping. This creates tactical gameplay around noise management — every shot attracts zombies toward the tower.

## Zombie AI State Machine

### States
1. **Idle (서성거리기)**: Random slow wandering, direction changes every 2-4s
2. **Attracted (유인됨)**: Moving toward a sound source at full speed
3. **Arrived (도착)**: Reached sound location, pause 1-2s, then back to Idle

### Sound Reaction Rules
- Zombies respond to the strongest sound within their hearing range
- A new, stronger sound overrides current target
- Zombies MUST reach the sound location — they don't stop early
- If a zombie's path hits a wall, it pushes/damages the wall (not "attacking" — just pushing through)
- When pushing through wall, wall takes continuous damage until zombie passes or wall breaks

## Sound System

### Sound Source Data Structure
```js
state.soundSources = [
  { x, y, intensity, range, timer, duration, type }
]
```

### Weapon Sound Profiles (origin = tower position, impact = hit location)

| Weapon | Range(px) | Damage | Origin Sound | Impact Sound | Penetration |
|--------|-----------|--------|-------------|-------------|-------------|
| Pistol | 400 | 2 | 250px | 80px | None |
| Bow | 500 | 3 | 0 (silent) | 50px | 1 zombie |
| Sniper | Screen end | 5 | 400px | 150px | Full penetration |
| MG | 350 | 1 | 350px | 60px | None |
| Crossbow | 450 | 4 | 80px | 60px | 1 zombie |

- Firing creates sound at tower position (origin) and at impact point
- Aim line renders only up to weapon range
- Projectiles disappear at max range
- Penetration: arrow/bolt pass through 1 zombie (damage deducted), sniper passes through all

### Sound Lure Items (New)

| Item | Sound Range | Duration | Special |
|------|------------|----------|---------|
| Toy (장난감) | 150px | 5s | Pure sound lure, no damage |
| Firecracker (폭죽) | 300px | 3s | Explodes at end, area damage |
| Radio (라디오) | 200px | 10s | Long duration lure |

- Thrown to field location (same as molotov/bomb mechanic)
- Creates persistent sound source that attracts zombies

### Existing Items That Create Sound
- Bomb: explosion sound (250px)
- Molotov: fire crackle (100px, continuous while burning)
- Mine: explosion sound (200px on detonation)

## Stage System

### Progression
- No time limit, no speed bonus
- Kill all zombies → stage clear
- 5-second pause between stages
- Next stage spawns more/tougher zombies

### Game Over Conditions
- Tower HP reaches 0 (zombies pushed through walls to tower)
- Zombies drop items on death, so complete ammo depletion is rare

### Day/Night Cycle
- Independent of stages, runs on real-time clock
- 60-second cycle: 40s day + 20s night
- Night: screen darkens, flashlight cone in aim direction
- Zombie red eyes visible in darkness

## UI Changes

### Item Window → Pouch Tab
- Remove current inventory bar at bottom
- Add 6th weapon tab with pouch/bag icon (주머니)
- When pouch tab selected: show 2-column vertical grid
- Each cell: item icon + name + quantity
- Usage: drag item from grid to field (same as current drag-to-place)

### Aim Line Changes
- Aim line extends only to weapon's max range
- Dashed line with range indicator
- Consistent across all weapons (currently only some have lines)

### Wall Behavior
- Walls still exist as physical barriers
- Zombies don't "target" walls — they push through when heading to sound
- Wall takes damage from zombie pushing
- Wall can still be repaired with brick item
- If no zombies pushing, walls auto-rebuild (existing behavior)

## Zombie Types (Kept, Behavior Adjusted)
All zombie types remain but their movement is now sound-based:
- **Walker**: Standard hearing range, normal speed
- **Runner**: Fast, zigzag even while attracted
- **Tank**: Slow but pushes through walls fast (high wall damage)
- **Rammer**: Charges when close to sound source
- **Necromancer**: Heals nearby zombies, follows sounds
- **Splitter**: Splits on death, mini-zombies also react to sound
- **Big One**: Boss, guaranteed drops
- **Spider**: Fast, erratic, small

## Buff System (Kept)
- Freeze, chain lightning, poison shots still work
- Shield, speed boost still work
- These don't create sound (silent effects)
