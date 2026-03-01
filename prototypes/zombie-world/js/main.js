// ── Zombie World - 메인 게임 루프 ──
import { W, H, WORLD_W, state, isGameOver, getTotalAmmo, updateSounds, updateCamera } from './game.js?v=16';
import { initDial, updateDial, drawDial } from './aiming.js?v=16';
import { drawField, drawFiringLine, drawSoundSources } from './renderer.js?v=16';
import { initPistol, drawPistol } from './pistol.js?v=16';
import { initBow, drawBow, drawBowTargetOverlay } from './bow.js?v=16';
import { initSniper, updateSniper, drawSniper, drawScopeOverlay } from './sniper.js?v=16';
import { initMG, updateMG, drawMG } from './mg.js?v=16';
import { initCrossbow, drawCrossbow } from './crossbow.js?v=16';
import { initFlamethrower, updateFlamethrower, drawFlamethrower, drawFlameOverlay } from './flamethrower.js?v=16';
import { updateProjectiles, drawProjectiles, missedThisFrame } from './projectiles.js?v=16';
import { updateZombies, checkZombieHits, drawZombies, startWave, drawWaveBanner } from './zombies.js?v=16';
import { updateWalls, drawWalls } from './wall.js?v=16';
import { drawTowers, initTower } from './tower.js?v=16';
import { updateDayNight, drawNightOverlay } from './daynight.js?v=16';
import { tryDropItem, initItems, updateItems, drawItems, updateSoundLures, drawSoundLures } from './items.js?v=16';
import { updateParticles, drawParticles, spawnParticles } from './particles.js?v=16';
import {
  initHUD, drawHUD, drawWeaponSlots, drawControlsBg,
  drawTitle, drawGameOver, drawPauseMenu, triggerGameOver, initScreenHandlers,
} from './hud.js?v=16';
import { playCombo, playSlowMo, playBulletMiss, playWaveStart, playWaveClear } from './audio.js?v=16';
import { initSettings, drawSettings } from './settings.js?v=16';
import { updateMines, updateHazards, drawMines, drawHazards } from './hazards.js?v=16';
import { initInventory, drawInventory, drawInventoryDragOverlay } from './inventory.js?v=16';
import { generateBuildings, drawBuildings } from './buildings.js?v=16';
import { buildGrid } from './pathfinding.js?v=16';
import { initPlayer, updatePlayer, drawPlayer, initDescendButton, drawDescendButton } from './player.js?v=16';
import { initFlashlight, updateFlashlight, drawFlashlightControls } from './flashlight.js?v=16';
import { spawnAnimals, updateAnimals, drawAnimals } from './animals.js?v=16';

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
initDial();
initPistol();
initBow();
initSniper();
initMG();
initCrossbow();
initFlamethrower();
initItems();
initInventory();
initTower();
initSettings();
generateBuildings();
buildGrid();
initPlayer();
initDescendButton();
initFlashlight();

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

  // 첫 웨이브 시작 (게임 시작 직후)
  if (state.wave === 0) {
    startWave(1);
    playWaveStart();
    // 초기 동물 스폰 + 시작 식량
    spawnAnimals(5);
    state.inventory.push({ id: 'food', count: 3 });
  }

  // 낮/밤 사이클
  updateDayNight(dt);

  // 조준 다이얼
  updateDial(dt);

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
  updateFlamethrower(dt);

  // 버프 타이머
  if (state.buffs.shieldTimer > 0) state.buffs.shieldTimer -= dt;
  if (state.buffs.speedTimer > 0) state.buffs.speedTimer -= dt;

  // 소리 시스템 업데이트
  updateSounds(dt);
  updateSoundLures(dt);

  // 시스템 업데이트
  updateProjectiles(dt);
  updateZombies(dt);
  updateWalls(dt);

  // 플레이어 업데이트
  updatePlayer(dt);

  // 손전등 업데이트
  updateFlashlight(dt);

  // 배고픔 감소
  state.hunger -= state.hungerRate * dt;
  if (state.hunger < 0) state.hunger = 0;
  // 배고픔 0이면 HP 감소 (5/s)
  if (state.hunger <= 0) {
    state.player.hp -= 5 * dt;
    if (state.player.hp < 0) state.player.hp = 0;
  }

  // 동물 업데이트
  updateAnimals(dt);

  // 지뢰 업데이트
  updateMines(dt);

  // 위험 지역 업데이트
  updateHazards(dt);

  // 아이템 & 파티클
  updateItems(dt);
  updateParticles(dt);

  // 충돌 판정: 프로젝타일 vs 좀비
  const hits = checkZombieHits(state.projectiles);

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

    const scoreText = `+${finalScore}`;
    spawnParticles(hit.x, hit.y - 20, 'scoreText', {
      text: scoreText,
      color: finalScore >= 50 ? '#ff4444' : finalScore >= 20 ? '#ffcc44' : '#ffffff',
    });

    // 빅원 킬 시 3~5개 드랍
    if (hit.type === 'bigone') {
      const dropCount = 3 + Math.floor(Math.random() * 3);
      tryDropItem(hit.type, state.combo, hit.x, hit.y, dropCount);
    } else {
      tryDropItem(hit.type, state.combo, hit.x, hit.y);
    }
  }

  // 스테이지 관리 — 클리어 후 다음 낮↔밤 전환까지 대기
  if (state.waveCleared && !state.waveWaitForTransition) {
    // 방금 클리어됨 (zombies.js 또는 여기서 감지) → 전환 대기 시작
    state.waveClearedDuringNight = state.isNight;
    state.waveWaitForTransition = true;
    playWaveClear();
  } else if (state.waveWaitForTransition) {
    // 낮밤 전환 감지: isNight이 클리어 시점과 달라지면 다음 웨이브 시작
    if (state.isNight !== state.waveClearedDuringNight) {
      startWave(state.wave + 1);
      playWaveStart();
      state.waveWaitForTransition = false;
    }
  }

  // 콤보 리셋 + 빗나감 소리
  if (missedThisFrame > 0 && hits.length === 0) {
    state.combo = 0;
    playBulletMiss();
  }

  // 카메라 업데이트
  updateCamera();

  // 게임 오버 체크 (플레이어 HP 기반)
  if (isGameOver()) {
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

  // ── 월드 공간 렌더링 (카메라 이동) ──
  ctx.save();
  ctx.translate(-state.camera.x, 0);

  // 필드
  drawField(ctx);

  // 건물 (장애물)
  drawBuildings(ctx);

  // 성벽
  drawWalls(ctx);

  // 타워
  drawTowers(ctx);

  // 내려가기 버튼 (타워 위일 때)
  drawDescendButton(ctx);

  // 발사선
  drawFiringLine(ctx);

  // 활 타겟 X 마커
  drawBowTargetOverlay(ctx);

  // 화염방사기 범위 오버레이
  drawFlameOverlay(ctx);

  // 소리 시각화
  drawSoundSources(ctx);
  drawSoundLures(ctx);

  // 좀비
  drawZombies(ctx);

  // 동물
  drawAnimals(ctx);

  // 플레이어
  drawPlayer(ctx);

  // 지뢰 렌더링
  drawMines(ctx);

  // 위험 지역 렌더링
  drawHazards(ctx);

  // 프로젝타일
  drawProjectiles(ctx);

  // 아이템
  drawItems(ctx);

  // 인벤토리 드래그 오버레이 (필드 위 타겟 하이라이트)
  drawInventoryDragOverlay(ctx);

  // 파티클
  drawParticles(ctx);

  // 밤 오버레이
  drawNightOverlay(ctx);

  ctx.restore();
  // ── 월드 공간 렌더링 끝 ──

  // ── 스크린 공간 렌더링 (카메라 무관) ──

  // 웨이브 배너
  drawWaveBanner(ctx, W, H);

  // 슬로모션 오버레이
  if (state.slowMo) {
    ctx.fillStyle = 'rgba(255,0,0,0.05)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,100,100,0.8)';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SLOW MOTION', W / 2, 70);
  }

  // HUD (상단)
  drawHUD(ctx);

  // 컨트롤 배경
  drawControlsBg(ctx);

  // 무기 슬롯
  drawWeaponSlots(ctx);

  // 인벤토리 바
  drawInventory(ctx);

  // 조준 다이얼
  drawDial(ctx);

  // 무기별 조작 UI
  drawPistol(ctx);
  drawBow(ctx);
  drawSniper(ctx);
  drawMG(ctx);
  drawCrossbow(ctx);
  drawFlamethrower(ctx);

  // 손전등 조작 UI
  drawFlashlightControls(ctx);

  // 스코프 오버레이 (저격총)
  drawScopeOverlay(ctx);

  // 일시정지
  if (state.screen === 'paused') {
    drawPauseMenu(ctx);
  }

  // 게임 오버
  if (state.screen === 'gameover') {
    drawGameOver(ctx);
  }
}

requestAnimationFrame(loop);
