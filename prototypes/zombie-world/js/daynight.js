// ── 낮/밤 사이클 & 손전등 효과 ──
import { W, H, state, TOWER_Y } from './game.js?v=11';

/**
 * 낮/밤 상태 업데이트
 * 웨이브 4,5 → 밤 (nightDarkness → 1), 나머지 → 낮 (nightDarkness → 0)
 */
export function updateDayNight(dt) {
  state.dayNightTimer += dt;
  const CYCLE = 60;        // 60초 풀 사이클
  const DAY_RATIO = 40/60; // 40초 낮, 20초 밤

  const phase = (state.dayNightTimer % CYCLE) / CYCLE;
  const targetNight = phase >= DAY_RATIO ? 1 : 0;

  // 부드러운 전환 (0.5/s)
  const transSpeed = 0.5;
  if (state.nightDarkness < targetNight) {
    state.nightDarkness = Math.min(targetNight, state.nightDarkness + transSpeed * dt);
  } else if (state.nightDarkness > targetNight) {
    state.nightDarkness = Math.max(targetNight, state.nightDarkness - transSpeed * dt);
  }

  state.isNight = state.nightDarkness > 0.5;
}

/**
 * 밤 오버레이 + 손전등 원뿔 그리기
 * destination-out 합성으로 어둠 속에서 손전등 영역을 오려냄
 */
export function drawNightOverlay(ctx) {
  if (state.nightDarkness <= 0) return;

  const darkness = state.nightDarkness * 0.85;

  // 어둠 오버레이
  ctx.save();
  ctx.fillStyle = `rgba(0,0,20,${darkness})`;
  ctx.fillRect(0, 0, W, H);

  // 손전등 원뿔 (타워 → 조준 방향)
  const coneLen = 500;
  const coneAngle = 0.35; // ~20도 반각

  ctx.globalCompositeOperation = 'destination-out';

  const grad = ctx.createRadialGradient(state.tower.x, TOWER_Y, 0, state.tower.x, TOWER_Y, coneLen);
  grad.addColorStop(0, `rgba(0,0,0,${darkness * 0.9})`);
  grad.addColorStop(0.7, `rgba(0,0,0,${darkness * 0.5})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(state.tower.x, TOWER_Y);

  const leftAngle = state.aimAngle + coneAngle;
  const rightAngle = state.aimAngle - coneAngle;
  ctx.lineTo(
    state.tower.x + Math.cos(leftAngle) * coneLen,
    TOWER_Y - Math.sin(leftAngle) * coneLen
  );
  ctx.lineTo(
    state.tower.x + Math.cos(rightAngle) * coneLen,
    TOWER_Y - Math.sin(rightAngle) * coneLen
  );
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * 좀비 눈 그리기 (어둠 속 빨간 점)
 */
export function drawZombieEyes(ctx, zombie) {
  if (state.nightDarkness < 0.3) return;

  const eyeR = 2;
  const offset = zombie.size * 0.3;

  ctx.fillStyle = `rgba(255,0,0,${state.nightDarkness * 0.8})`;
  ctx.beginPath();
  ctx.arc(zombie.x - offset, zombie.y - zombie.size - 2, eyeR, 0, Math.PI * 2);
  ctx.arc(zombie.x + offset, zombie.y - zombie.size - 2, eyeR, 0, Math.PI * 2);
  ctx.fill();
}
