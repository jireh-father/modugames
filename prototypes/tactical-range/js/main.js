// ── Tactical Range - 메인 게임 루프 ──
import { W, H, state, isGameOver } from './game.js?v=6';
import { initJoystick, updateJoystick, drawJoystick } from './aiming.js?v=6';
import { drawRange, drawCrosshair } from './renderer.js?v=6';
import { initPistol, drawPistol } from './pistol.js?v=6';
import { initBow, drawBow } from './bow.js?v=6';
import { updateProjectiles, drawProjectiles, missedThisFrame } from './projectiles.js?v=6';
import { updateTargets, checkHits, drawTargets, drawWaveBanner } from './targets.js?v=6';
import { tryDropItem, initItems, updateItems, drawItems } from './items.js?v=6';
import { updateParticles, drawParticles } from './particles.js?v=6';
import {
  initHUD, drawHUD, drawWeaponSlots, drawControlsBg,
  drawTitle, drawGameOver, triggerGameOver, initScreenHandlers,
} from './hud.js?v=6';
import { playCombo } from './audio.js?v=6';
import { spawnParticles } from './particles.js?v=6';

// ── 캔버스 셋업 ──
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

function resize() {
  const scale = Math.min(innerWidth / W, innerHeight / H);
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = (W * scale) + 'px';
  canvas.style.height = (H * scale) + 'px';
}
resize();
addEventListener('resize', resize);

// ── 입력 초기화 ──
initScreenHandlers();
initHUD();
initJoystick();
initPistol();
initBow();
initItems();

// ── 게임 루프 ──
let lastTime = 0;

function loop(time) {
  requestAnimationFrame(loop);
  const rawDt = (time - lastTime) / 1000;
  lastTime = time;
  const dt = Math.min(rawDt, 0.05);

  // 슬로모션
  const gameDt = state.slowMo ? dt * 0.3 : dt;

  update(gameDt, dt);
  draw();
}

function update(dt, realDt) {
  if (state.screen !== 'playing') return;

  state.time += dt;
  state.difficulty = Math.min(state.wave / 20, 1);

  // 조이스틱 기반 조준
  updateJoystick(dt);

  // 슬로모션 타이머
  if (state.slowMo) {
    state.slowMoTimer -= realDt;
    if (state.slowMoTimer <= 0) {
      state.slowMo = false;
    }
  }

  // 시스템 업데이트
  updateProjectiles(dt);
  updateTargets(dt);
  updateItems(dt);
  updateParticles(dt);

  // 충돌 판정
  const hits = checkHits(state.projectiles);

  for (const hit of hits) {
    // 콤보 배율 적용: 3연속부터 x1.5, x2.0, x2.5...
    const comboMul = state.combo >= 2 ? 1 + state.combo * 0.5 : 1;
    const finalScore = Math.floor(hit.score * comboMul);

    state.score += finalScore;
    state.combo++;
    state.maxCombo = Math.max(state.maxCombo, state.combo);

    // 콤보 이펙트
    if (state.combo >= 3) {
      playCombo(state.combo);
      const scrY = 100;
      spawnParticles(W / 2, scrY, 'comboText', { text: `${state.combo}x COMBO!` });
    }

    // 점수 이펙트
    spawnParticles(W / 2, 80, 'scoreText', {
      text: `+${finalScore}`,
      color: finalScore >= 20 ? '#ff4444' : finalScore >= 10 ? '#ffcc44' : '#ffffff',
    });

    // 아이템 드랍
    tryDropItem(hit.type, state.combo);
  }

  // 콤보 리셋: 범위 밖으로 나간 발사체가 있으면 빗나감 → 콤보 리셋
  if (missedThisFrame > 0 && hits.length === 0) {
    state.combo = 0;
  }

  // 마지막 1발 슬로모션
  const totalAmmo = state.pistol.magazineBullets + state.pistol.reserveBullets +
    state.pistol.specialBullets + (state.pistol.chambered ? 1 : 0) +
    state.bow.arrows + state.bow.specialArrows;
  if (totalAmmo === 1 && !state.slowMo) {
    state.slowMo = true;
    state.slowMoTimer = 3;
  }

  // 게임 오버 체크
  if (isGameOver() && state.projectiles.length === 0) {
    triggerGameOver();
  }
}

function draw() {
  // 타이틀 화면
  if (state.screen === 'title') {
    drawTitle(ctx);
    return;
  }

  // 게임 화면 배경
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, W, H);

  // 사격장 배경 (월드 고정 - 조준이동에 따라 움직이지 않음)
  drawRange(ctx, 0, 0);

  // 과녁 (월드 고정)
  drawTargets(ctx, 0, 0);

  // 발사체 (월드 고정)
  drawProjectiles(ctx, 0, 0);

  // 아이템
  drawItems(ctx);

  // 파티클
  drawParticles(ctx);

  // 십자선
  drawCrosshair(ctx);

  // 웨이브 배너
  drawWaveBanner(ctx, W, H);

  // 슬로모션 오버레이
  if (state.slowMo) {
    ctx.fillStyle = 'rgba(255,0,0,0.05)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,100,100,0.8)';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LAST SHOT!', W / 2, 70);
  }

  // HUD
  drawHUD(ctx);

  // 조작부 배경
  drawControlsBg(ctx);

  // 무기 슬롯
  drawWeaponSlots(ctx);

  // 조이스틱
  drawJoystick(ctx);

  // 무기별 조작 UI
  drawPistol(ctx);
  drawBow(ctx);

  // 게임 오버 오버레이
  if (state.screen === 'gameover') {
    drawGameOver(ctx);
  }
}

requestAnimationFrame(loop);
