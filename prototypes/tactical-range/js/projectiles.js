// ── 발사체 시스템 (탄환 + 화살) ──
import { state, W, RANGE_TOP, RANGE_BOTTOM } from './game.js?v=8';
import { worldToScreen, AIM_RANGE_X, AIM_RANGE_Y } from './renderer.js?v=8';

const RANGE_H = RANGE_BOTTOM - RANGE_TOP;
const VP_X = W / 2;
const VP_Y = RANGE_TOP + RANGE_H * 0.15;
const CENTER_SX = W / 2;
const CENTER_SY = (RANGE_TOP + RANGE_BOTTOM) / 2;

/**
 * 깊이 z에서 십자선 화면 좌표에 대응하는 월드 (x, y) 계산
 * 월드는 고정(aim=0), 십자선이 화면 위를 이동하는 방식의 역변환
 * worldToScreen(x, y, z, 0, 0) = (sx, sy) 의 역함수
 */
function crosshairWorldAt(z, aimX, aimY) {
  const p = 1 - z * 0.85;
  // 십자선의 화면 좌표
  const sx = CENTER_SX + aimX * AIM_RANGE_X;
  const sy = CENTER_SY + aimY * AIM_RANGE_Y;

  // worldToScreen(x, y, z, 0, 0):
  //   sx = VP_X + (x * W/2) * p
  //   sy = VP_Y + RANGE_H*0.7*(1-z) + (y * RANGE_H*0.3) * p
  const wx = (sx - VP_X) / (W / 2 * p);
  const wy = (sy - VP_Y - RANGE_H * 0.7 * (1 - z)) / (RANGE_H * 0.3 * p);

  return { x: wx, y: wy };
}

/**
 * 발사체 생성
 * @param {string} type - 'bullet' | 'arrow'
 * @param {number} aimX - 조준 X (-1~1)
 * @param {number} aimY - 조준 Y (-1~1)
 * @param {boolean} special - 관통탄/폭발화살 여부
 * @param {number} power - 화살 파워 (0~1, 총알은 무시)
 */
export function fireProjectile(type, aimX, aimY, special = false, power = 1) {
  const start = crosshairWorldAt(0, aimX, aimY);

  const proj = {
    type,
    special,
    // 발사 시점의 조준 방향 기록 (깊이별 위치 계산용)
    firedAimX: aimX,
    firedAimY: aimY,
    x: start.x,
    y: start.y,
    z: 0,
    vz: type === 'bullet' ? 3.0 : (1.5 + power * 1.5) / 4,
    // 화살 포물선: 위로 올라갔다가 중력으로 내려옴 (장애물 넘기)
    gravityOffset: 0,
    gravity: type === 'arrow' ? 0.6 : 0,
    gravityVel: type === 'arrow' ? -0.35 * power : 0,
    power,
    alive: true,
    trail: [],
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
    p.z += p.vz * dt;

    // 현재 깊이에서 십자선 레이 위치 계산
    const ray = crosshairWorldAt(p.z, p.firedAimX, p.firedAimY);
    p.x = ray.x;
    p.y = ray.y;

    // 화살 중력 편차 (레이 위치 기준으로 아래로 처짐)
    if (p.gravity) {
      p.gravityVel += p.gravity * dt;
      p.gravityOffset += p.gravityVel * dt;
      p.y += p.gravityOffset;
    }

    // 잔상 기록 (화살)
    if (p.type === 'arrow') {
      p.trail.push({ x: p.x, y: p.y, z: p.z });
      if (p.trail.length > 8) p.trail.shift();
    }

    // 범위 벗어남 → 빗나감
    if (p.z > 1.2 || p.z < -0.1 || Math.abs(p.x) > 2 || Math.abs(p.y) > 3) {
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
        const prevZ = p.z - p.vz * 0.05;
        const prevRay = crosshairWorldAt(prevZ, p.firedAimX, p.firedAimY);
        const back = worldToScreen(prevRay.x, prevRay.y, prevZ, aimX, aimY);
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
          const alpha = i / p.trail.length * 0.5;
          ctx.strokeStyle = p.special ? `rgba(255,100,0,${alpha})` : `rgba(180,160,100,${alpha})`;
          ctx.lineWidth = 3 * ts.scale;
          const prev = p.trail[i - 1];
          const ps = worldToScreen(prev.x, prev.y, prev.z, aimX, aimY);
          ctx.beginPath();
          ctx.moveTo(ps.sx, ps.sy);
          ctx.lineTo(ts.sx, ts.sy);
          ctx.stroke();
        }
      }

      // 화살 본체
      const len = 25 * scr.scale;
      const angle = Math.atan2(p.gravityVel, p.vz);
      ctx.strokeStyle = p.special ? '#ff6600' : '#c0a060';
      ctx.lineWidth = 4 * scr.scale;
      ctx.beginPath();
      ctx.moveTo(scr.sx - Math.cos(angle) * len, scr.sy + Math.sin(angle) * len * 0.5);
      ctx.lineTo(scr.sx + Math.cos(angle) * len, scr.sy - Math.sin(angle) * len * 0.5);
      ctx.stroke();

      // 화살촉
      ctx.fillStyle = p.special ? '#ff4400' : '#aaa';
      ctx.beginPath();
      const tipX = scr.sx + Math.cos(angle) * len;
      const tipY = scr.sy - Math.sin(angle) * len * 0.5;
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - 8 * scr.scale, tipY - 5 * scr.scale);
      ctx.lineTo(tipX - 8 * scr.scale, tipY + 5 * scr.scale);
      ctx.closePath();
      ctx.fill();

      // 깃털
      const tailX = scr.sx - Math.cos(angle) * len;
      const tailY = scr.sy + Math.sin(angle) * len * 0.5;
      ctx.fillStyle = p.special ? 'rgba(255,100,0,0.6)' : 'rgba(160,130,80,0.6)';
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(tailX - 4 * scr.scale, tailY - 6 * scr.scale);
      ctx.lineTo(tailX + 6 * scr.scale, tailY);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(tailX - 4 * scr.scale, tailY + 6 * scr.scale);
      ctx.lineTo(tailX + 6 * scr.scale, tailY);
      ctx.closePath();
      ctx.fill();
    }
  }
}
