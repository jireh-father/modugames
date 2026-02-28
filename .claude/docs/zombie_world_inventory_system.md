# Zombie World - Item & Inventory System (v13 - Ground Player)

## Overview
Items dropped from zombies are split into two categories:
- **Auto-apply items** (ammo) are applied immediately on pickup
- **Inventory items** are stored and used manually via inventory bar or pouch grid

## Layout
- Canvas: 540x960
- HUD: 0-48
- Field: 48-640 (wall at y=520, tower at y=590)
- Weapon slots: 672-712 (6 tabs: 5 weapons + pouch)
- Item bar: 712-747 (shown in non-pouch weapon tabs)
- Weapon controls: 747-960
- Pouch mode: 712-960 (full 2-column grid replaces bar + controls)

## Weapon Slots (6 tabs)
1. 권총 (Pistol)
2. 활 (Bow)
3. 저격 (Sniper)
4. 기관총 (MG)
5. 석궁 (Crossbow)
6. **주머니 (Pouch)** - opens 2-column item grid, no weapon fires

## Item Categories

### Auto-apply (immediate on pickup)
- bullet3, bullet6, arrow2, arrow5, sniperAmmo, mgAmmo, bolt2

### Inventory - Drag items (drag to field target)
- **brick**: Drag to wall area (y 480-560) to repair nearest wall segment +25 HP; drag to tower area (y 560-640) to repair nearest tower +25 HP
- **medkit**: Drag near player (within 80px of player position) to heal player +30 HP (works on tower or ground)
- **mine**: Drag to field to place mine (explosion sound 200px on detonation)
- **molotov**: Drag to field to create fire zone (sound 100px, 3s)
- **bomb**: Drag to field to damage zombies (sound 250px)
- **toy**: Drag to field, sound lure 150px for 5s
- **firecracker**: Drag to field, sound lure 300px for 3s + explosion on end
- **radio**: Drag to field, sound lure 200px for 10s

### Inventory - Tap items (use immediately)
- shield, speedBoost, freeze, chain, poison, magUpgrade, goldBullet, explosiveArrow

## Pouch Grid UI
- Shown when 6th weapon tab (주머니) is selected
- 2-column vertical grid filling item bar + weapon controls area
- Each cell: icon (0.8x scale) + label + count (×N)
- Drag-to-field for DRAG_ITEMS, tap for instant-use items
- Empty state: "아이템 없음" centered text

## Drag Overlay Highlights
- brick: nearest wall segment dashed outline (when drag Y < 560); nearest tower circle (when drag Y >= 560)
- medkit: circle around player position (uses getFireOrigin - tower when on tower, ground position when on ground)
- mine/molotov/bomb: explosion radius circle + crosshair
- toy/firecracker/radio: sound range circle + crosshair

## Sound Lure System
- `state.soundLures[]` tracks active lure items on field
- Re-emit sound every ~0.5s to keep attracting zombies
- Firecracker explodes on timer end (80px radius, 5 damage)
- Visual: pulsing circles + type icons (♪/♫)

## Files
- `game.js`: ITEM_BAR_H, inventory[], soundLures[], emitSound()
- `items.js`: Item definitions, auto-apply/inventory split, useInventoryItem(), sound lure update/draw, drawItemIcon()
- `inventory.js`: Inventory bar (normal mode) + pouch grid (pouch mode), drag system, overlay highlights
- `hud.js`: 6 weapon slots including pouch tab, drawControlsBg()
- `main.js`: Calls updateSoundLures(), drawSoundLures()
- `hazards.js`: Mine explosion emits sound
