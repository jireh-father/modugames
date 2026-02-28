// ── 2D 탑다운 발사체 시스템 ──
import { state, W, TOWER_Y } from './game.js?v=10';

/**
 * 발사체 생성
 * @param {string} type - 'bullet' | 'arrow' | 'sniper' | 'mgBullet' | 'bolt'
 * @param {number} aimAngle - 조준 각도 (라디안)
 * @param {boolean} special - 관통탄/폭발화살 여부
 * @param {number} power - 화살/볼트 파워 (0~1)
 */
export function fireProjectile(type, aimAngle, special = false, power = 1) {
  // Spread as angle offset
  let spreadAngle = 0;
  if (type === 'bullet') spreadAngle = (Math.random() - 0.5) * 0.03;
  else if (type === 'mgBullet') spreadAngle = (Math.random() - 0.5) * 0.06;
  else if (type === 'sniper') spreadAngle = (Math.random() - 0.5) * 0.006;

  const finalAngle = aimAngle + spreadAngle;
  const fdx = Math.cos(finalAngle);
  const fdy = -Math.sin(finalAngle); // canvas Y is inverted

  // Speed (pixels per second)
  let speed = 800;
  if (type === 'arrow') speed = 300 + power * 400;
  else if (type === 'sniper') speed = 1200;
  else if (type === 'mgBullet') speed = 900;
  else if (type === 'bolt') speed = 500;

  // Max range for arrows/bolts (based on power)
  let maxRange = 9999;
  if (type === 'arrow') maxRange = 200 + power * 500;
  else if (type === 'bolt') maxRange = 150 + power * 400;

  // Check buff effects (only apply to non-arrow/bolt projectiles)
  const isGun = type !== 'arrow' && type !== 'bolt';
  const freeze = isGun && state.buffs.freezeShots > 0;
  const chain = isGun && state.buffs.chainShots > 0;
  const poison = isGun && state.buffs.poisonShots > 0;

  const proj = {
    type,
    special,
    x: state.tower.x,
    y: TOWER_Y,
    dx: fdx,
    dy: fdy,
    speed,
    maxRange,
    traveled: 0,
    alive: true,
    trail: [],
    time: 0,
    power,
    freeze,
    chain,
    poison,
  };

  // Consume buff shots
  if (freeze) state.buffs.freezeShots--;
  if (chain) state.buffs.chainShots--;
  if (poison) state.buffs.poisonShots--;

  state.projectiles.push(proj);
}

// 프레임당 빗나감 카운트
export let missedThisFrame = 0;

/**
 * 발사체 업데이트
 */
export function updateProjectiles(dt) {
  missedThisFrame = 0;
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.time += dt;

    const move = p.speed * dt;
    p.x += p.dx * move;
    p.y += p.dy * move;
    p.traveled += move;

    // Trail for arrows/bolts
    if (p.type === 'arrow' || p.type === 'bolt') {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 8) p.trail.shift();
    }

    // Out of bounds or max range reached
    if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > 1000 || p.traveled >= p.maxRange) {
      p.alive = false;
      missedThisFrame++;
    }

    if (!p.alive) {
      state.projectiles.splice(i, 1);
    }
  }
}

/**
 * 발사체 렌더링 (2D 탑다운)
 */
export function drawProjectiles(ctx) {
  for (const p of state.projectiles) {
    if (p.type === 'bullet') {
      // 총알 - 작은 원 + 짧은 트레일
      const r = 3;
      ctx.fillStyle = p.special ? '#ffcc00' : '#ffa500';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      // 버프 표시
      if (p.freeze) {
        ctx.strokeStyle = 'rgba(100,200,255,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (p.poison) {
        ctx.strokeStyle = 'rgba(100,255,100,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 트레일
      if (p.time < 0.1) {
        const trailLen = 12;
        ctx.strokeStyle = p.special ? 'rgba(255,204,0,0.4)' : 'rgba(255,165,0,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - p.dx * trailLen, p.y - p.dy * trailLen);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    } else if (p.type === 'sniper') {
      // 저격탄 - 밝은 트레이서
      const r = 4;
      ctx.fillStyle = '#66bbff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      // 밝은 글로우
      ctx.fillStyle = 'rgba(100,180,255,0.3)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 2, 0, Math.PI * 2);
      ctx.fill();

      // 긴 트레이서 라인
      if (p.time < 0.15) {
        const trailLen = 30;
        ctx.strokeStyle = 'rgba(100,180,255,0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x - p.dx * trailLen, p.y - p.dy * trailLen);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    } else if (p.type === 'mgBullet') {
      // 기관총탄 - 작은 점
      const r = 2;
      ctx.fillStyle = '#ffaa44';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      // 짧은 트레일
      if (p.time < 0.06) {
        const trailLen = 8;
        ctx.strokeStyle = 'rgba(255,170,68,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x - p.dx * trailLen, p.y - p.dy * trailLen);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    } else if (p.type === 'arrow') {
      // 화살 - 트레일 + 본체 + 화살촉 + 깃털
      // 잔상
      if (p.trail.length > 1) {
        for (let i = 1; i < p.trail.length; i++) {
          const t = p.trail[i];
          const prev = p.trail[i - 1];
          const alpha = i / p.trail.length * 0.5;
          ctx.strokeStyle = p.special ? `rgba(255,100,0,${alpha})` : `rgba(180,160,100,${alpha})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(t.x, t.y);
          ctx.stroke();
        }
      }

      // 본체 (이동방향을 따라 선)
      const len = 16;
      ctx.strokeStyle = p.special ? '#ff6600' : '#c0a060';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x - p.dx * len, p.y - p.dy * len);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      // 화살촉
      ctx.fillStyle = p.special ? '#ff4400' : '#aaa';
      ctx.beginPath();
      ctx.moveTo(p.x + p.dx * 4, p.y + p.dy * 4);
      ctx.lineTo(p.x + p.dy * 4, p.y - p.dx * 4);
      ctx.lineTo(p.x - p.dy * 4, p.y + p.dx * 4);
      ctx.closePath();
      ctx.fill();

      // 깃털 (후방)
      const tailX = p.x - p.dx * len;
      const tailY = p.y - p.dy * len;
      ctx.fillStyle = p.special ? 'rgba(255,100,0,0.6)' : 'rgba(160,130,80,0.6)';
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(tailX + p.dy * 5, tailY - p.dx * 5);
      ctx.lineTo(tailX - p.dx * 5, tailY - p.dy * 5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(tailX - p.dy * 5, tailY + p.dx * 5);
      ctx.lineTo(tailX - p.dx * 5, tailY - p.dy * 5);
      ctx.closePath();
      ctx.fill();
    } else if (p.type === 'bolt') {
      // 크로스보우 볼트 - 짧은 녹색 선 + 촉
      // 잔상
      if (p.trail.length > 1) {
        for (let i = 1; i < p.trail.length; i++) {
          const t = p.trail[i];
          const prev = p.trail[i - 1];
          const alpha = i / p.trail.length * 0.4;
          ctx.strokeStyle = `rgba(100,255,100,${alpha})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(t.x, t.y);
          ctx.stroke();
        }
      }

      // 본체
      const len = 12;
      ctx.strokeStyle = '#88ff88';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p.x - p.dx * len, p.y - p.dy * len);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      // 볼트 촉
      ctx.fillStyle = '#44cc44';
      ctx.beginPath();
      ctx.moveTo(p.x + p.dx * 3, p.y + p.dy * 3);
      ctx.lineTo(p.x + p.dy * 3, p.y - p.dx * 3);
      ctx.lineTo(p.x - p.dy * 3, p.y + p.dx * 3);
      ctx.closePath();
      ctx.fill();
    }
  }
}
