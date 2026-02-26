// ── 사격장 배경 렌더링 + 원근감 ──
import { W, RANGE_TOP, RANGE_BOTTOM } from './game.js';

const RANGE_H = RANGE_BOTTOM - RANGE_TOP;
const VP_X = W / 2; // 소실점 X
const VP_Y = RANGE_TOP + RANGE_H * 0.15; // 소실점 Y (상단 근처)

/**
 * 3D 월드 좌표 → 2D 캔버스 좌표 변환
 * @param {number} x - 좌우 위치 (-1~1, 0=중앙)
 * @param {number} y - 상하 위치 (-1~1, 0=중앙)
 * @param {number} z - 깊이 (0=가까움, 1=멀리)
 * @param {number} aimX - 에이밍 X 오프셋 (-1~1)
 * @param {number} aimY - 에이밍 Y 오프셋 (-1~1)
 * @returns {{sx: number, sy: number, scale: number}}
 */
export function worldToScreen(x, y, z, aimX = 0, aimY = 0) {
  const perspective = 1 - z * 0.85; // z=0 → 1.0, z=1 → 0.15
  const aimOffX = aimX * 220;
  const aimOffY = aimY * 150;

  const baseX = VP_X + (x * W * 0.5) * perspective - aimOffX * perspective;
  const baseY = VP_Y + (RANGE_H * 0.7) * (1 - z) + (y * RANGE_H * 0.3) * perspective - aimOffY * perspective;

  return {
    sx: baseX,
    sy: baseY,
    scale: perspective,
  };
}

/**
 * 사격장 배경 그리기
 */
export function drawRange(ctx, aimX, aimY) {
  const rangeH = RANGE_H;

  // 배경 (어두운 실내)
  const bgGrad = ctx.createLinearGradient(0, RANGE_TOP, 0, RANGE_BOTTOM);
  bgGrad.addColorStop(0, '#1a1208');
  bgGrad.addColorStop(0.3, '#2a1f10');
  bgGrad.addColorStop(1, '#3a2a15');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, RANGE_TOP, W, rangeH);

  // 소실점 기준 원근 레인
  const aimOffX = aimX * 220;
  const aimOffY = aimY * 150;
  const vpx = VP_X - aimOffX;
  const vpy = VP_Y - aimOffY;

  // 바닥
  ctx.fillStyle = '#2d2215';
  ctx.beginPath();
  ctx.moveTo(vpx - 40, vpy + 20);
  ctx.lineTo(vpx + 40, vpy + 20);
  ctx.lineTo(W + 50, RANGE_BOTTOM);
  ctx.lineTo(-50, RANGE_BOTTOM);
  ctx.fill();

  // 레인 구분선
  ctx.strokeStyle = 'rgba(255,220,150,0.08)';
  ctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(vpx + i * 10, vpy + 20);
    ctx.lineTo(W / 2 + i * 140, RANGE_BOTTOM);
    ctx.stroke();
  }

  // 거리 표시선 (가로)
  for (let d = 0; d < 5; d++) {
    const z = d / 5;
    const p = worldToScreen(0, 0, z, aimX, aimY);
    const spread = W * (1 - z * 0.7);
    ctx.strokeStyle = `rgba(255,200,100,${0.04 + d * 0.02})`;
    ctx.beginPath();
    ctx.moveTo(p.sx - spread / 2, p.sy);
    ctx.lineTo(p.sx + spread / 2, p.sy);
    ctx.stroke();
  }

  // 천장 조명
  for (let i = 0; i < 3; i++) {
    const z = 0.2 + i * 0.3;
    const p = worldToScreen(0, -0.8, z, aimX, aimY);
    const r = 15 * p.scale;
    const glow = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 4);
    glow.addColorStop(0, 'rgba(255,230,150,0.15)');
    glow.addColorStop(1, 'rgba(255,230,150,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(p.sx - r * 4, p.sy - r * 4, r * 8, r * 8);

    ctx.fillStyle = '#ffeeaa';
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 좌우 벽
  ctx.fillStyle = '#251a0d';
  // 왼쪽
  ctx.beginPath();
  ctx.moveTo(0, RANGE_TOP);
  ctx.lineTo(vpx - 60, vpy);
  ctx.lineTo(0, RANGE_BOTTOM);
  ctx.lineTo(0, RANGE_TOP);
  ctx.fill();
  // 오른쪽
  ctx.beginPath();
  ctx.moveTo(W, RANGE_TOP);
  ctx.lineTo(vpx + 60, vpy);
  ctx.lineTo(W, RANGE_BOTTOM);
  ctx.lineTo(W, RANGE_TOP);
  ctx.fill();
}

/**
 * 십자선 그리기
 */
export function drawCrosshair(ctx) {
  const cx = W / 2;
  const cy = (RANGE_TOP + RANGE_BOTTOM) / 2;
  const size = 16;

  ctx.strokeStyle = 'rgba(255,80,80,0.8)';
  ctx.lineWidth = 2;
  // 가로
  ctx.beginPath();
  ctx.moveTo(cx - size, cy);
  ctx.lineTo(cx - 4, cy);
  ctx.moveTo(cx + 4, cy);
  ctx.lineTo(cx + size, cy);
  ctx.stroke();
  // 세로
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx, cy - 4);
  ctx.moveTo(cx, cy + 4);
  ctx.lineTo(cx, cy + size);
  ctx.stroke();
  // 중앙 점
  ctx.fillStyle = 'rgba(255,80,80,0.9)';
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();
}
