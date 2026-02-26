// ── 발사체 시스템 (탄환 + 화살) ──
import { state } from './game.js';
import { worldToScreen } from './renderer.js';

/**
 * 발사체 생성
 * @param {string} type - 'bullet' | 'arrow'
 * @param {number} aimX - 조준 X (-1~1)
 * @param {number} aimY - 조준 Y (-1~1)
 * @param {boolean} special - 관통탄/폭발화살 여부
 * @param {number} power - 화살 파워 (0~1, 총알은 무시)
 */
export function fireProjectile(type, aimX, aimY, special = false, power = 1) {
  const proj = {
    type,
    special,
    // 3D 월드 좌표 (시작: 카메라 앞)
    x: 0,      // 좌우 (에이밍에 따라)
    y: 0,      // 상하
    z: 0,      // 깊이 (0=가까움, 1=멀리)
    // 속도
    vx: aimX * 0.3,
    vy: aimY * 0.2,
    vz: type === 'bullet' ? 3.0 : 1.5 + power * 1.5, // 총알은 빠르고, 화살은 파워에 따라
    // 중력 (화살만)
    gravity: type === 'arrow' ? 0.3 : 0,
    power,
    alive: true,
    trail: [], // 잔상 (화살용)
    time: 0,
  };

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
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;

    // 중력 (화살 포물선)
    if (p.gravity) {
      p.vy += p.gravity * dt;
    }

    // 잔상 기록 (화살)
    if (p.type === 'arrow') {
      p.trail.push({ x: p.x, y: p.y, z: p.z });
      if (p.trail.length > 8) p.trail.shift();
    }

    // 범위 벗어남 → 빗나감
    if (p.z > 1.2 || p.z < -0.1 || Math.abs(p.x) > 2 || Math.abs(p.y) > 2) {
      p.alive = false;
      missedThisFrame++;
    }

    if (!p.alive) {
      state.projectiles.splice(i, 1);
    }
  }
}

/**
 * 발사체 렌더링
 */
export function drawProjectiles(ctx, aimX, aimY) {
  for (const p of state.projectiles) {
    const scr = worldToScreen(p.x, p.y, p.z, aimX, aimY);

    if (p.type === 'bullet') {
      // 총알 - 작은 원
      const r = 3 * scr.scale;
      ctx.fillStyle = p.special ? '#ffcc00' : '#ffa500';
      ctx.beginPath();
      ctx.arc(scr.sx, scr.sy, Math.max(1, r), 0, Math.PI * 2);
      ctx.fill();

      // 총알 궤적
      if (p.time < 0.1) {
        ctx.strokeStyle = p.special ? 'rgba(255,204,0,0.5)' : 'rgba(255,165,0,0.3)';
        ctx.lineWidth = 2 * scr.scale;
        ctx.beginPath();
        const back = worldToScreen(p.x - p.vx * 0.05, p.y - p.vy * 0.05, p.z - p.vz * 0.05, aimX, aimY);
        ctx.moveTo(back.sx, back.sy);
        ctx.lineTo(scr.sx, scr.sy);
        ctx.stroke();
      }
    } else if (p.type === 'arrow') {
      // 화살 잔상
      if (p.trail.length > 1) {
        for (let i = 1; i < p.trail.length; i++) {
          const t = p.trail[i];
          const ts = worldToScreen(t.x, t.y, t.z, aimX, aimY);
          const alpha = i / p.trail.length * 0.3;
          ctx.strokeStyle = p.special ? `rgba(255,100,0,${alpha})` : `rgba(180,160,100,${alpha})`;
          ctx.lineWidth = 1;
          const prev = p.trail[i - 1];
          const ps = worldToScreen(prev.x, prev.y, prev.z, aimX, aimY);
          ctx.beginPath();
          ctx.moveTo(ps.sx, ps.sy);
          ctx.lineTo(ts.sx, ts.sy);
          ctx.stroke();
        }
      }

      // 화살 본체
      const len = 15 * scr.scale;
      const angle = Math.atan2(p.vy, p.vz);
      ctx.strokeStyle = p.special ? '#ff6600' : '#c0a060';
      ctx.lineWidth = 2 * scr.scale;
      ctx.beginPath();
      ctx.moveTo(scr.sx - Math.cos(angle) * len, scr.sy + Math.sin(angle) * len * 0.5);
      ctx.lineTo(scr.sx + Math.cos(angle) * len, scr.sy - Math.sin(angle) * len * 0.5);
      ctx.stroke();

      // 화살촉
      ctx.fillStyle = p.special ? '#ff4400' : '#888';
      ctx.beginPath();
      const tipX = scr.sx + Math.cos(angle) * len;
      const tipY = scr.sy - Math.sin(angle) * len * 0.5;
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - 5 * scr.scale, tipY - 3 * scr.scale);
      ctx.lineTo(tipX - 5 * scr.scale, tipY + 3 * scr.scale);
      ctx.closePath();
      ctx.fill();
    }
  }
}
