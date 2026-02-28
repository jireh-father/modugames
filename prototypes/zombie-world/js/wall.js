// ── 성벽 시스템 (4구간) ──
import { W, state, WALL_Y } from './game.js?v=13';
import { playWallRebuildComplete } from './audio.js?v=13';

// 4 wall segments - positions along the arc
const WALL_SEGMENTS = [
  { x: 0, w: 135 },     // segment 0 (leftmost)
  { x: 135, w: 135 },   // segment 1
  { x: 270, w: 135 },   // segment 2
  { x: 405, w: 135 },   // segment 3 (rightmost)
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
        playWallRebuildComplete();
      }
    }
  }

  // Check if no zombies near broken walls -> start rebuilding
  for (let i = 0; i < 4; i++) {
    if (state.walls[i].hp <= 0 && !state.walls[i].rebuilding) {
      const seg = WALL_SEGMENTS[i];
      const wy = getWallY(i);
      const nearbyZombie = state.zombies.some(z =>
        z.alive && z.x >= seg.x - 20 && z.x <= seg.x + seg.w + 20 &&
        z.y >= wy - 30 && z.y <= wy + 50
      );
      if (!nearbyZombie) {
        state.walls[i].rebuilding = true;
        state.walls[i].rebuildTimer = 5;
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
