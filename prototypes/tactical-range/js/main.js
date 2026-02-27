// ── Tactical Range - 메인 게임 루프 ──
import { W, H, state, isGameOver } from './game.js?v=10';
import { initJoystick, updateJoystick, drawJoystick } from './aiming.js?v=10';
import { drawRange, drawCrosshair } from './renderer.js?v=10';
import { initPistol, drawPistol } from './pistol.js?v=10';
import { initBow, drawBow } from './bow.js?v=10';
import { updateProjectiles, drawProjectiles, missedThisFrame } from './projectiles.js?v=10';
import { updateTargets, checkHits, drawTargets, drawWaveBanner, getWaveClearBonus } from './targets.js?v=10';
import { tryDropItem, initItems, updateItems, drawItems } from './items.js?v=10';
import { updateParticles, drawParticles } from './particles.js?v=10';
import {
  initHUD, drawHUD, drawWeaponSlots, drawControlsBg,
  drawTitle, drawGameOver, drawPauseMenu, triggerGameOver, initScreenHandlers,
} from './hud.js?v=10';
import { playCombo } from './audio.js?v=10';
import { spawnParticles } from './particles.js?v=10';
import { initSettings, drawSettings } from './settings.js?v=10';

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
  // paused 상태도 여기서 이미 걸러짐 (screen === 'paused')

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
    // 콤보 배율: 3연속부터 x1.5, x2.0, x2.5...
    const comboMul = state.combo >= 2 ? 1 + state.combo * 0.5 : 1;
    const finalScore = Math.floor(hit.score * comboMul);

    state.score += finalScore;
    state.combo++;
    state.maxCombo = Math.max(state.maxCombo, state.combo);

    // 콤보 이펙트
    if (state.combo >= 3) {
      playCombo(state.combo);
      spawnParticles(W / 2, 100, 'comboText', { text: `${state.combo}x COMBO!` });
    }

    // 화살 멀티킬 이펙트
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
    // 클리어 직후 1프레임만 보너스 적용
    const bonus = getWaveClearBonus();
    if (bonus > 0) {
      state.score += bonus;
    }
  }

  // 콤보 리셋
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

  // 설정 화면
  if (state.screen === 'settings') {
    drawSettings(ctx);
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

  // 일시정지 오버레이
  if (state.screen === 'paused') {
    drawPauseMenu(ctx);
  }

  // 게임 오버 오버레이
  if (state.screen === 'gameover') {
    drawGameOver(ctx);
  }
}

requestAnimationFrame(loop);
