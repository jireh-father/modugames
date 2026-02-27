// ── Tactical Range - 메인 게임 루프 ──
import { W, H, state, isGameOver, getTotalAmmo } from './game.js?v=11';
import { initJoystick, updateJoystick, drawJoystick } from './aiming.js?v=11';
import { drawRange, drawCrosshair } from './renderer.js?v=11';
import { initPistol, drawPistol } from './pistol.js?v=11';
import { initBow, drawBow } from './bow.js?v=11';
import { initSniper, updateSniper, drawSniper, drawScopeOverlay } from './sniper.js?v=11';
import { initMG, updateMG, drawMG } from './mg.js?v=11';
import { initCrossbow, drawCrossbow } from './crossbow.js?v=11';
import { updateProjectiles, drawProjectiles, missedThisFrame } from './projectiles.js?v=11';
import { updateTargets, checkHits, drawTargets, drawWaveBanner, getWaveClearBonus } from './targets.js?v=11';
import { tryDropItem, initItems, updateItems, drawItems } from './items.js?v=11';
import { updateParticles, drawParticles } from './particles.js?v=11';
import {
  initHUD, drawHUD, drawWeaponSlots, drawControlsBg,
  drawTitle, drawGameOver, drawPauseMenu, triggerGameOver, initScreenHandlers,
} from './hud.js?v=11';
import { playCombo, playSlowMo, playBulletMiss } from './audio.js?v=11';
import { spawnParticles } from './particles.js?v=11';
import { initSettings, drawSettings } from './settings.js?v=11';

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
initSniper();
initMG();
initCrossbow();
initItems();
initSettings();

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

  // 무기별 업데이트
  updateSniper(dt);
  updateMG(dt);

  // 시스템 업데이트
  updateProjectiles(dt);
  updateTargets(dt);
  updateItems(dt);
  updateParticles(dt);

  // 충돌 판정
  const hits = checkHits(state.projectiles);

  for (const hit of hits) {
    const comboMul = state.combo >= 2 ? 1 + state.combo * 0.5 : 1;
    const finalScore = Math.floor(hit.score * comboMul);

    state.score += finalScore;
    state.combo++;
    state.maxCombo = Math.max(state.maxCombo, state.combo);

    if (state.combo >= 3) {
      playCombo(state.combo);
      spawnParticles(W / 2, 100, 'comboText', { text: `${state.combo}x COMBO!` });
    }

    const arrowMul = hit.arrowMulti || 1;
    let scoreText = `+${finalScore}`;
    if (arrowMul > 1) scoreText += ` (${arrowMul}x MULTI!)`;

    spawnParticles(W / 2, 80, 'scoreText', {
      text: scoreText,
      color: arrowMul > 1 ? '#ff44ff' : finalScore >= 20 ? '#ff4444' : finalScore >= 10 ? '#ffcc44' : '#ffffff',
    });

    tryDropItem(hit.type, state.combo);
  }

  // 웨이브 클리어 보너스
  if (state.waveCleared && state.wavePause > 1.4) {
    const bonus = getWaveClearBonus();
    if (bonus > 0) {
      state.score += bonus;
    }
  }

  // 콤보 리셋 + 빗나감 소리
  if (missedThisFrame > 0 && hits.length === 0) {
    state.combo = 0;
    playBulletMiss();
  }

  // 마지막 1발 슬로모션
  const totalAmmo = getTotalAmmo();
  if (totalAmmo === 1 && !state.slowMo) {
    state.slowMo = true;
    state.slowMoTimer = 3;
    playSlowMo();
  }

  // 게임 오버 체크
  if (isGameOver() && state.projectiles.length === 0) {
    triggerGameOver();
  }
}

function draw() {
  if (state.screen === 'title') {
    drawTitle(ctx);
    return;
  }

  if (state.screen === 'settings') {
    drawSettings(ctx);
    return;
  }

  // 게임 화면 배경
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, W, H);

  drawRange(ctx, 0, 0);
  drawTargets(ctx, 0, 0);
  drawProjectiles(ctx, 0, 0);
  drawItems(ctx);
  drawParticles(ctx);
  drawCrosshair(ctx);

  // 스코프 오버레이 (저격총 스코프 줌)
  drawScopeOverlay(ctx);

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

  drawHUD(ctx);
  drawControlsBg(ctx);
  drawWeaponSlots(ctx);
  drawJoystick(ctx);

  // 무기별 조작 UI
  drawPistol(ctx);
  drawBow(ctx);
  drawSniper(ctx);
  drawMG(ctx);
  drawCrossbow(ctx);

  if (state.screen === 'paused') {
    drawPauseMenu(ctx);
  }

  if (state.screen === 'gameover') {
    drawGameOver(ctx);
  }
}

requestAnimationFrame(loop);
