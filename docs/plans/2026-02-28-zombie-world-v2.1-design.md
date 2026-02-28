# Zombie World v2.1 - 11 Feature Upgrade Design

## 1. Flashlight System
- Weapon tab 8th slot: flashlight
- Controls: battery gauge + ON/OFF button + drag battery from inventory to gauge
- Battery: 30s usage, auto-off when depleted
- Vision: 200px radius circle around player (daynight overlay cut)
- Tower searchlights: 120px radius, circular rotation pattern (8s period), night only

## 2. Tower Climb Bug Fix
- Ground player must walk to tower (40px range) before climbing
- Tap tower when far → pathfind to tower → auto-climb on arrival

## 3. Sound Propagation (Infinite Chain)
- Attracted zombies emit noise (60px range, every 0.5s)
- Nearby idle zombies hear → become attracted → emit own noise → chain continues
- Creates wave-like propagation from gunshot origin

## 4. Building Bullet Collision
- Projectiles check building collision in updateProjectiles
- Bullet hits building → alive = false + spark particle
- Arrow arc exempted (flies over buildings)

## 5. Player Top Movement Bug Fix
- Check pathfinding grid bounds for y < 60 area
- Ensure player can move in full FIELD_TOP to FIELD_BOTTOM range
- Fix any clamp issues in player.js movement

## 6. 360-Degree Aiming
- Remove angle clamp (currently ~160 degrees upward)
- Allow full 0~2π rotation
- Firing line and range extend in all directions

## 7. Attracted Zombie Speed Boost
- Attracted zombies: 1.5x base speed
- Stacking excitement: up to 2x max

## 8. Player HP-Based Speed
- speed = baseSpeed * max(0.3, hp / maxHp)
- HP 100% = 200px/s, HP 50% = 100px/s, HP ≤30% = 60px/s minimum

## 9. Player Movement Noise
- Moving player emits noise every 0.5s (range 40px)
- Attracts nearby zombies

## 10. Shoe Items (2 types)
- Silent shoes: noise range 40→15px, duration 60s
- Stealth shoes: noise range 0px, duration 30s
- Inventory items, zombie drops

## 11. Hunger + Animal System
- Hunger gauge: 100→0 in 180s (3 min), death at 0
- HUD: hunger bar display
- Food items: start with 3, +30 hunger per use
- 5 animals: chicken(fast), rabbit(medium), rat(very fast), pigeon(flying), frog(slow)
- Animals: random spawn, idle wander, flee on player approach
- Kill → meat drop → hunger recovery
