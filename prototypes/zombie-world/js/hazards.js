// ── 지뢰 & 위험 지역 (화염/독) 시스템 ──
import { state, emitSound } from './game.js?v=311';
import { spawnParticles } from './particles.js?v=311';
import { playMineExplosion, playFireDamage } from './audio.js?v=311';

let hazardSoundTimer = 0;

/**
 * 지뢰 업데이트: 좀비와 접촉 시 폭발
 */
export function updateMines(dt) {
  for (let i = state.mines.length - 1; i >= 0; i--) {
    const mine = state.mines[i];
    let exploded = false;

    // 좀비 접근 감지
    for (const z of state.zombies) {
      if (!z.alive) continue;
      const dist = Math.hypot(z.x - mine.x, z.y - mine.y);
      if (dist < mine.radius * 0.5) {
        exploded = true;
        break;
      }
    }

    if (exploded) {
      // 폭발: 반경 내 모든 좀비에 데미지
      for (const z of state.zombies) {
        if (!z.alive) continue;
        const dist = Math.hypot(z.x - mine.x, z.y - mine.y);
        if (dist < mine.radius) {
          z.hp -= mine.damage;
          z.hitFlash = 0.15;
        }
      }
      spawnParticles(mine.x, mine.y, 'explosion', { count: 15 });
      emitSound(mine.x, mine.y, 800, 1.0, 'explosion');
      playMineExplosion();
      state.mines.splice(i, 1);
    }
  }
}

/**
 * 위험 지역 업데이트: 시간 감소, 범위 내 좀비에 지속 데미지
 */
export function updateHazards(dt) {
  hazardSoundTimer -= dt;
  let anyHit = false;

  for (let i = state.hazards.length - 1; i >= 0; i--) {
    const h = state.hazards[i];
    h.timer -= dt;

    // 범위 내 좀비에 지속 데미지
    for (const z of state.zombies) {
      if (!z.alive) continue;
      const dist = Math.hypot(z.x - h.x, z.y - h.y);
      if (dist < h.radius) {
        z.hp -= h.damage * dt;
        z.hitFlash = Math.max(z.hitFlash, 0.03);
        anyHit = true;
      }
    }

    if (h.timer <= 0) {
      state.hazards.splice(i, 1);
    }
  }

  if (anyHit && hazardSoundTimer <= 0) {
    playFireDamage();
    hazardSoundTimer = 0.6;
  }
}

/**
 * 지뢰 렌더링
 */
export function drawMines(ctx) {
  for (const mine of state.mines) {
    // 반경 표시
    ctx.fillStyle = 'rgba(200,50,50,0.3)';
    ctx.beginPath();
    ctx.arc(mine.x, mine.y, mine.radius, 0, Math.PI * 2);
    ctx.fill();

    // 지뢰 본체
    ctx.fillStyle = '#cc2222';
    ctx.beginPath();
    ctx.arc(mine.x, mine.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // X 마크
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mine.x - 4, mine.y - 4);
    ctx.lineTo(mine.x + 4, mine.y + 4);
    ctx.moveTo(mine.x + 4, mine.y - 4);
    ctx.lineTo(mine.x - 4, mine.y + 4);
    ctx.stroke();
  }
}

/**
 * 위험 지역 렌더링 (화염/독)
 */
export function drawHazards(ctx) {
  for (const h of state.hazards) {
    const alpha = 0.3 + Math.sin(Date.now() / 100) * 0.1;

    if (h.type === 'fire') {
      ctx.fillStyle = `rgba(255,100,0,${alpha})`;
    } else {
      ctx.fillStyle = `rgba(50,200,50,${alpha})`;
    }

    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
    ctx.fill();

    // 테두리
    ctx.strokeStyle = h.type === 'fire' ? 'rgba(255,150,0,0.5)' : 'rgba(80,255,80,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 남은 시간 표시
    if (h.timer < 1) {
      ctx.fillStyle = `rgba(255,255,255,${h.timer})`;
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${h.timer.toFixed(1)}s`, h.x, h.y - h.radius - 4);
    }
  }
}
