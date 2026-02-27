// ── Zombie World - 메인 게임 루프 ──
import { W, H, state, isGameOver, getTotalAmmo } from './game.js?v=1';
import { initDial, updateDial, drawDial } from './aiming.js?v=1';
import { drawField, drawFiringLine } from './renderer.js?v=1';
import { initPistol, drawPistol } from './pistol.js?v=1';
import { initBow, drawBow } from './bow.js?v=1';
import { initSniper, updateSniper, drawSniper, drawScopeOverlay } from './sniper.js?v=1';
import { initMG, updateMG, drawMG } from './mg.js?v=1';
import { initCrossbow, drawCrossbow } from './crossbow.js?v=1';
import { updateProjectiles, drawProjectiles, missedThisFrame } from './projectiles.js?v=1';
import { updateZombies, checkZombieHits, drawZombies, startWave, drawWaveBanner } from './zombies.js?v=1';
import { updateWalls, drawWalls } from './wall.js?v=1';
import { drawTower } from './tower.js?v=1';
import { updateDayNight, drawNightOverlay } from './daynight.js?v=1';
import { tryDropItem, initItems, updateItems, drawItems } from './items.js?v=1';
import { updateParticles, drawParticles, spawnParticles } from './particles.js?v=1';
import {
  initHUD, drawHUD, drawWeaponSlots, drawControlsBg,
  drawTitle, drawGameOver, drawPauseMenu, triggerGameOver, initScreenHandlers,
} from './hud.js?v=1';
import { playCombo, playSlowMo, playBulletMiss } from './audio.js?v=1';
import { initSettings, drawSettings } from './settings.js?v=1';

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

  // 첫 웨이브 시작 (게임 시작 직후)
  if (state.wave === 0) {
    startWave(1);
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

  // 버프 타이머
  if (state.buffs.shieldTimer > 0) state.buffs.shieldTimer -= dt;
  if (state.buffs.speedTimer > 0) state.buffs.speedTimer -= dt;

  // 시스템 업데이트
  updateProjectiles(dt);
  updateZombies(dt);
  updateWalls(dt);

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
      tryDropItem(hit.type, state.combo, dropCount);
    } else {
      tryDropItem(hit.type, state.combo);
    }
  }

  // 웨이브 관리
  if (state.waveCleared) {
    state.wavePause += dt;
    const pauseTime = state.wave % 5 === 0 ? 5 : 3;
    if (state.wavePause >= pauseTime) {
      startWave(state.wave + 1);
      state.wavePause = 0;
    }
  } else if (!state.waveCleared && state.wave > 0) {
    // waveCleared는 zombies.js의 updateZombies에서 설정됨
    // 클리어되면 wavePause 리셋
    if (state.zombies.length === 0 && state.waveSpawnQueue.length === 0) {
      state.waveCleared = true;
      state.wavePause = 0;
    }
  }

  // 콤보 리셋 + 빗나감 소리
  if (missedThisFrame > 0 && hits.length === 0) {
    state.combo = 0;
    playBulletMiss();
  }

  // 게임 오버 체크 (타워 HP 기반)
  if (state.tower.hp <= 0) {
    triggerGameOver();
  }
}

/**
 * 지뢰 업데이트: 좀비와 접촉 시 폭발
 */
function updateMines(dt) {
  for (let i = state.mines.length - 1; i >= 0; i--) {
    const mine = state.mines[i];
    let exploded = false;

    for (const z of state.zombies) {
      if (!z.alive) continue;
      const dist = Math.hypot(z.x - mine.x, z.y - mine.y);
      if (dist < mine.radius * 0.5) {
        // 트리거: 폭발
        exploded = true;
        break;
      }
    }

    if (exploded) {
      // 폭발: 반경 내 모든 좀비에 데미지
      for (const z of state.zombies) {
        if (!z.alive) continue;
        const dist = Math.hypot(z.x - mine.x, z.y - mine.y);
        if (dist < mine.radius) {
          z.hp -= mine.damage;
          z.hitFlash = 0.15;
        }
      }
      // 폭발 파티클
      spawnParticles(mine.x, mine.y, 'explosion', { color: '#ff4400', count: 20 });
      state.mines.splice(i, 1);
    }
  }
}

/**
 * 위험 지역 업데이트: 시간 감소, 범위 내 좀비에 데미지
 */
function updateHazards(dt) {
  for (let i = state.hazards.length - 1; i >= 0; i--) {
    const hz = state.hazards[i];
    hz.timer -= dt;

    // 범위 내 좀비에 지속 데미지
    for (const z of state.zombies) {
      if (!z.alive) continue;
      const dist = Math.hypot(z.x - hz.x, z.y - hz.y);
      if (dist < hz.radius) {
        z.hp -= hz.damage * dt;
        z.hitFlash = Math.max(z.hitFlash, 0.03);
      }
    }

    if (hz.timer <= 0) {
      state.hazards.splice(i, 1);
    }
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

  // 필드
  drawField(ctx);

  // 성벽
  drawWalls(ctx);

  // 타워
  drawTower(ctx);

  // 발사선
  drawFiringLine(ctx);

  // 좀비
  drawZombies(ctx);

  // 지뢰 렌더링
  drawMines(ctx);

  // 위험 지역 렌더링
  drawHazardsVisual(ctx);

  // 프로젝타일
  drawProjectiles(ctx);

  // 아이템
  drawItems(ctx);

  // 파티클
  drawParticles(ctx);

  // 밤 오버레이
  drawNightOverlay(ctx);

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

  // 조준 다이얼
  drawDial(ctx);

  // 무기별 조작 UI
  drawPistol(ctx);
  drawBow(ctx);
  drawSniper(ctx);
  drawMG(ctx);
  drawCrossbow(ctx);

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

/**
 * 지뢰 렌더링
 */
function drawMines(ctx) {
  for (const mine of state.mines) {
    // 반경 표시
    ctx.fillStyle = 'rgba(255, 50, 50, 0.06)';
    ctx.beginPath();
    ctx.arc(mine.x, mine.y, mine.radius, 0, Math.PI * 2);
    ctx.fill();

    // 지뢰 본체
    ctx.fillStyle = '#cc2222';
    ctx.beginPath();
    ctx.arc(mine.x, mine.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // X 마크
    ctx.strokeStyle = '#ff6666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mine.x - 3, mine.y - 3);
    ctx.lineTo(mine.x + 3, mine.y + 3);
    ctx.moveTo(mine.x + 3, mine.y - 3);
    ctx.lineTo(mine.x - 3, mine.y + 3);
    ctx.stroke();
  }
}

/**
 * 위험 지역 렌더링
 */
function drawHazardsVisual(ctx) {
  for (const hz of state.hazards) {
    const flicker = 0.3 + Math.sin(state.time * 10 + hz.x) * 0.15;

    if (hz.type === 'fire') {
      // 불 지역 - 주황
      ctx.fillStyle = `rgba(255, 120, 30, ${flicker})`;
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2);
      ctx.fill();

      // 불꽃 테두리
      ctx.strokeStyle = `rgba(255, 80, 0, ${flicker + 0.1})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // 기타 (독 등) - 초록
      ctx.fillStyle = `rgba(80, 255, 80, ${flicker * 0.7})`;
      ctx.beginPath();
      ctx.arc(hz.x, hz.y, hz.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 남은 시간 표시
    if (hz.timer < 1) {
      ctx.fillStyle = `rgba(255,255,255,${hz.timer})`;
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${hz.timer.toFixed(1)}s`, hz.x, hz.y - hz.radius - 4);
    }
  }
}

requestAnimationFrame(loop);
