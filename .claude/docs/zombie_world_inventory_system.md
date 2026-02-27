# Zombie World - Item Inventory System

## Overview
Items dropped from zombies are now split into two categories:
- **Auto-apply items** (ammo) are applied immediately on pickup.
- **Inventory items** are stored in a bar below the weapon slots for manual use.

## Layout
- Canvas: 540x960
- HUD: 0-48
- Field: 48-640
- Weapon slots: 672-712 (CONTROLS_TOP to CONTROLS_TOP + SLOT_H)
- **Item bar: 712-747** (CONTROLS_TOP + SLOT_H to CONTROLS_TOP + SLOT_H + ITEM_BAR_H)
- Weapon controls: 747-960 (CONTROLS_TOP + SLOT_H + ITEM_BAR_H to CONTROLS_BOTTOM)

## Item Categories

### Auto-apply (immediate on pickup)
- bullet3, bullet6, arrow2, arrow5, sniperAmmo, mgAmmo, bolt2

### Inventory - Drag items (drag to field target)
- **brick**: Drag to wall area (y 480-560) to repair nearest wall segment +25 HP
- **medkit**: Drag to tower area (y 560-620) to heal tower +30 HP
- **mine**: Drag to field to place mine
- **molotov**: Drag to field to create fire zone
- **bomb**: Drag to field to damage zombies in radius

### Inventory - Tap items (use immediately from bar)
- shield, speedBoost, freeze, chain, poison, magUpgrade, goldBullet, explosiveArrow

## Files Modified
- `game.js`: Added ITEM_BAR_H constant (35), inventory[] state, resetGame() clears inventory
- `items.js`: Split applyItem() into auto-apply vs addToInventory(), added useInventoryItem() export, exported drawItemIcon()
- `inventory.js`: **NEW** - Inventory bar UI, drag-to-use system, field overlay highlights
- `pistol.js`, `bow.js`, `sniper.js`, `mg.js`, `crossbow.js`: CTRL_Y offset += ITEM_BAR_H
- `hud.js`: drawControlsBg() draws item bar background + shifted weapon controls background
- `main.js`: Added initInventory(), drawInventory(), drawInventoryDragOverlay() calls
