// ── 낮/밤 사이클 & 손전등 효과 ──
import { W, H, state, TOWER_Y, getFireOrigin } from './game.js?v=311';

/**
 * 낮/밤 상태 업데이트
 * 웨이브 4,5 → 밤 (nightDarkness → 1), 나머지 → 낮 (nightDarkness → 0)
 */
export function updateDayNight(dt) {
  state.dayNightTimer += dt;
  const CYCLE = 360;         // 6분(360초) 풀 사이클
  const DAY_RATIO = 240/360; // 240초 낮, 120초 밤

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

  const darkness = state.nightDarkness * 0.7; // 밤 최대 어둠 70% (좀비 가시성 확보)

  // 어둠 오버레이
  ctx.save();
  ctx.fillStyle = `rgba(0,0,20,${darkness})`;
  ctx.fillRect(-W, 0, W * 3, H);

  // 손전등 원뿔 (타워 → 조준 방향)
  const coneLen = 500;
  const coneAngle = 0.35; // ~20도 반각

  ctx.globalCompositeOperation = 'destination-out';

  const origin = getFireOrigin();
  const grad = ctx.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, coneLen);
  grad.addColorStop(0, `rgba(0,0,0,${darkness * 0.9})`);
  grad.addColorStop(0.7, `rgba(0,0,0,${darkness * 0.5})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);

  const leftAngle = state.aimAngle + coneAngle;
  const rightAngle = state.aimAngle - coneAngle;
  ctx.lineTo(
    origin.x + Math.cos(leftAngle) * coneLen,
    origin.y - Math.sin(leftAngle) * coneLen
  );
  ctx.lineTo(
    origin.x + Math.cos(rightAngle) * coneLen,
    origin.y - Math.sin(rightAngle) * coneLen
  );
  ctx.closePath();
  ctx.fill();

  // 플레이어 손전등 (지상에서 ON일 때 200px 원형 시야)
  if (state.flashlight.on && state.player.onTower < 0) {
    const px = state.player.x, py = state.player.y;
    const flR = 200;
    const flGrad = ctx.createRadialGradient(px, py, 0, px, py, flR);
    flGrad.addColorStop(0, `rgba(0,0,0,${darkness * 0.95})`);
    flGrad.addColorStop(0.6, `rgba(0,0,0,${darkness * 0.6})`);
    flGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = flGrad;
    ctx.beginPath();
    ctx.arc(px, py, flR, 0, Math.PI * 2);
    ctx.fill();
  }

  // 타워 서치라이트 (밤에 각 타워가 원형 회전 조명)
  for (let i = 0; i < state.towers.length; i++) {
    const t = state.towers[i];
    if (t.hp <= 0) continue;
    const slAngle = state.time * (Math.PI * 2 / 8) + i * (Math.PI * 2 / 3); // 8초 주기, 타워별 위상차
    const slDist = 200; // 타워에서 조명 중심까지 거리
    const slR = 120;    // 조명 반경
    const slX = t.x + Math.cos(slAngle) * slDist;
    const slY = TOWER_Y - Math.sin(slAngle) * slDist;
    const slGrad = ctx.createRadialGradient(slX, slY, 0, slX, slY, slR);
    slGrad.addColorStop(0, `rgba(0,0,0,${darkness * 0.7})`);
    slGrad.addColorStop(0.5, `rgba(0,0,0,${darkness * 0.3})`);
    slGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = slGrad;
    ctx.beginPath();
    ctx.arc(slX, slY, slR, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 조명 영역에 강한 노란빛 글로우 (좀비 포함 전체 밝게) ──
  ctx.globalCompositeOperation = 'lighter';

  const glowAlpha = state.nightDarkness * 0.55;

  // 타워 조준 조명 — 넓고 강하게
  {
    const o = getFireOrigin();
    const gLen = 500;
    const gAngle = 0.4; // 약간 더 넓은 각도
    const gGrad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, gLen);
    gGrad.addColorStop(0, `rgba(255,245,180,${glowAlpha})`);
    gGrad.addColorStop(0.4, `rgba(255,230,120,${glowAlpha * 0.6})`);
    gGrad.addColorStop(0.8, `rgba(255,220,100,${glowAlpha * 0.15})`);
    gGrad.addColorStop(1, 'rgba(255,220,100,0)');
    ctx.fillStyle = gGrad;
    ctx.beginPath();
    ctx.moveTo(o.x, o.y);
    const la = state.aimAngle + gAngle;
    const ra = state.aimAngle - gAngle;
    ctx.lineTo(o.x + Math.cos(la) * gLen, o.y - Math.sin(la) * gLen);
    ctx.lineTo(o.x + Math.cos(ra) * gLen, o.y - Math.sin(ra) * gLen);
    ctx.closePath();
    ctx.fill();
  }

  // 플레이어 손전등 노란빛
  if (state.flashlight.on && state.player.onTower < 0) {
    const px = state.player.x, py = state.player.y;
    const fGrad = ctx.createRadialGradient(px, py, 0, px, py, 220);
    fGrad.addColorStop(0, `rgba(255,245,180,${glowAlpha * 0.9})`);
    fGrad.addColorStop(0.4, `rgba(255,230,120,${glowAlpha * 0.5})`);
    fGrad.addColorStop(0.8, `rgba(255,220,100,${glowAlpha * 0.1})`);
    fGrad.addColorStop(1, 'rgba(255,220,100,0)');
    ctx.fillStyle = fGrad;
    ctx.beginPath();
    ctx.arc(px, py, 220, 0, Math.PI * 2);
    ctx.fill();
  }

  // 타워 서치라이트 노란빛
  for (let i = 0; i < state.towers.length; i++) {
    const t = state.towers[i];
    if (t.hp <= 0) continue;
    const slAngle = state.time * (Math.PI * 2 / 8) + i * (Math.PI * 2 / 3);
    const slX = t.x + Math.cos(slAngle) * 200;
    const slY = TOWER_Y - Math.sin(slAngle) * 200;
    const sGrad = ctx.createRadialGradient(slX, slY, 0, slX, slY, 130);
    sGrad.addColorStop(0, `rgba(255,245,180,${glowAlpha * 0.8})`);
    sGrad.addColorStop(0.3, `rgba(255,230,120,${glowAlpha * 0.4})`);
    sGrad.addColorStop(0.7, `rgba(255,220,100,${glowAlpha * 0.1})`);
    sGrad.addColorStop(1, 'rgba(255,220,100,0)');
    ctx.fillStyle = sGrad;
    ctx.beginPath();
    ctx.arc(slX, slY, 130, 0, Math.PI * 2);
    ctx.fill();
  }

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
