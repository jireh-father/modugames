// ── Zombie World - 메인 게임 루프 ──
import { W, H, state, isGameOver, getTotalAmmo, updateSounds, FIELD_TOP, FIELD_BOTTOM } from './game.js?v=18';
import { initDial, updateDial, drawDial } from './aiming.js?v=18';
import { drawField, drawFiringLine, drawSoundSources, drawTransitionOverlay } from './renderer.js?v=18';
import { initPistol, drawPistol } from './pistol.js?v=18';
import { initBow, drawBow, drawBowTargetOverlay } from './bow.js?v=18';
import { initSniper, updateSniper, drawSniper, drawScopeOverlay } from './sniper.js?v=18';
import { initMG, updateMG, drawMG } from './mg.js?v=18';
import { initCrossbow, drawCrossbow } from './crossbow.js?v=18';
import { initFlamethrower, updateFlamethrower, drawFlamethrower, drawFlameOverlay } from './flamethrower.js?v=18';
import { updateProjectiles, drawProjectiles, missedThisFrame } from './projectiles.js?v=18';
import { updateZombies, checkZombieHits, drawZombies, startWave, drawWaveBanner, spawnChunkZombies } from './zombies.js?v=18';
import { updateWalls, drawWalls } from './wall.js?v=18';
import { drawTowers, initTower } from './tower.js?v=18';
import { updateDayNight, drawNightOverlay } from './daynight.js?v=18';
import { tryDropItem, initItems, updateItems, drawItems, updateSoundLures, drawSoundLures } from './items.js?v=18';
import { updateParticles, drawParticles, spawnParticles } from './particles.js?v=18';
import {
  initHUD, drawHUD, drawWeaponSlots, drawControlsBg,
  drawTitle, drawGameOver, drawPauseMenu, triggerGameOver, initScreenHandlers,
} from './hud.js?v=18';
import { playCombo, playSlowMo, playBulletMiss, playWaveStart, playWaveClear } from './audio.js?v=18';
import { initSettings, drawSettings } from './settings.js?v=18';
import { updateMines, updateHazards, drawMines, drawHazards } from './hazards.js?v=18';
import { initInventory, drawInventory, drawInventoryDragOverlay } from './inventory.js?v=18';
import { generateBuildings, drawBuildings, loadChunkBuildings } from './buildings.js?v=18';
import { buildGrid } from './pathfinding.js?v=18';
import { initPlayer, updatePlayer, drawPlayer, initDescendButton, drawDescendButton } from './player.js?v=18';
import { initFlashlight, updateFlashlight, drawFlashlightControls } from './flashlight.js?v=18';
import { spawnAnimals, updateAnimals, drawAnimals } from './animals.js?v=18';
import { world, initWorld, setChunkLoaders, loadChunkEntities, updateTransition, updateAdjacentChunks } from './world.js?v=18';
import { setWorldRef } from './game.js?v=18';
import { initWorldMap, drawWorldMap } from './worldmap.js?v=18';
import { initInterior, updateInterior, drawInterior } from './interior.js?v=18';

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
// (v3: 건물/그리드는 loadChunkEntities에서 생성)
initPlayer();
initDescendButton();
initFlashlight();
initWorldMap();
initInterior();

// ── 월드 시스템 연결 ──
setWorldRef(world);
setChunkLoaders({
  spawnChunkZombies,
  spawnAnimals,
  loadChunkBuildings,
  buildGrid,
  generateBuildings,
});

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
  // 내부 화면 업데이트
  if (state.screen === 'interior') {
    state.time += dt;
    state.worldTime += dt;
    updateInterior(dt);
    if (isGameOver()) triggerGameOver();
    return;
  }

  if (state.screen !== 'playing') return;

  state.time += dt;
  state.worldTime += dt;

  // ── 청크 기반 초기화 (첫 프레임) ──
  if (!state.currentChunk) {
    const chunk = initWorld();
    loadChunkEntities(chunk);
    state.currentChunk = chunk;
    state.inventory.push({ id: 'food', count: 3 });
  }

  // ── 맵 전환 중이면 게임 업데이트 건너뜀 ──
  if (world.transitioning) {
    updateTransition(dt);
    return;
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

  // 인접 청크 소리 전파
  updateAdjacentChunks(dt);

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

  // ── 청크 좀비 리스폰 (30% 이하로 줄면 경계에서 보충) ──
  if (state.currentChunk) {
    const cfg = state.currentChunk.zombieConfig;
    const aliveCount = state.zombies.filter(z => z.alive).length;
    if (aliveCount < cfg.density * 0.3) {
      const reinforceCount = Math.floor(cfg.density * 0.2);
      for (let i = 0; i < reinforceCount; i++) {
        const type = cfg.types[Math.floor(Math.random() * cfg.types.length)];
        const edge = Math.floor(Math.random() * 4);
        let x, y;
        if (edge === 0) { x = Math.random() * W; y = FIELD_TOP - 10; }
        else if (edge === 1) { x = Math.random() * W; y = FIELD_BOTTOM + 10; }
        else if (edge === 2) { x = -10; y = FIELD_TOP + Math.random() * (FIELD_BOTTOM - FIELD_TOP); }
        else { x = W + 10; y = FIELD_TOP + Math.random() * (FIELD_BOTTOM - FIELD_TOP); }
        // spawnZombie는 zombies.js의 내부 함수, 대신 spawnChunkZombies 패턴 사용
        state.waveSpawnQueue.push({
          type, x, hpMul: cfg.hpMul, speedMul: cfg.speedMul, delay: Math.random() * 2,
          overrides: { y },
        });
      }
    }
  }

  // 콤보 리셋 + 빗나감 소리
  if (missedThisFrame > 0 && hits.length === 0) {
    state.combo = 0;
    playBulletMiss();
  }

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

  if (state.screen === 'interior') {
    drawInterior(ctx);
    return;
  }

  // 게임 화면 배경
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, W, H);

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

  // 맵 전환 오버레이
  drawTransitionOverlay(ctx);

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

  // 세계지도
  if (state.screen === 'worldmap') {
    drawWorldMap(ctx);
  }
}

requestAnimationFrame(loop);
