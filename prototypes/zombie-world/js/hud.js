// ── HUD + 무기 교체 + 게임 화면 (좀비 월드) ──
import { state, W, H, HUD_H, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H, ITEM_BAR_H, resetGame, getTotalAmmo } from './game.js?v=16';
import { registerZone } from './input.js?v=16';
import { playStart, playGameOver, playNewRecord, playUIPause, playUIResume, playUIClick, playWeaponSwitch } from './audio.js?v=16';
import { requestGyro, resetGyroRef, isGyroEnabled } from './gyro.js?v=16';
import { openSettings } from './settings.js?v=16';
import { generateBuildings } from './buildings.js?v=16';
import { buildGrid } from './pathfinding.js?v=16';

let gameOverTriggered = false;
let newBestScore = false;
let newBestWave = false;
let congratsTimer = 0;

// 일시정지 메뉴 버튼 영역
const PAUSE_BTN = { x: W - 44, y: 4, w: 40, h: 40 };
const MENU_BTN_W = 200;
const MENU_BTN_H = 50;
const MENU_Y_START = H * 0.4;
const MENU_GAP = 65;

/**
 * 무기 슬롯 터치 등록
 */
export function initHUD() {
  gameOverTriggered = false;
  newBestScore = false;
  newBestWave = false;
  congratsTimer = 0;

  // 일시정지 버튼 (HUD 영역)
  registerZone(
    PAUSE_BTN,
    {
      onTap() {
        if (state.screen === 'playing') {
          state.screen = 'paused';
          playUIPause();
        }
      },
    },
    20
  );

  // 일시정지 메뉴 버튼들 (priority 100 = paused에서도 동작)
  registerZone(
    { x: 0, y: 0, w: W, h: H },
    {
      onStart() {
        if (state.screen !== 'paused') return false;
      },
      onTap(x, y) {
        if (state.screen !== 'paused') return;
        const cx = W / 2;
        // Resume 버튼
        const resumeY = MENU_Y_START;
        if (x >= cx - MENU_BTN_W / 2 && x <= cx + MENU_BTN_W / 2 &&
            y >= resumeY && y <= resumeY + MENU_BTN_H) {
          state.screen = 'playing';
          playUIResume();
          return;
        }
        // Restart 버튼
        const restartY = MENU_Y_START + MENU_GAP;
        if (x >= cx - MENU_BTN_W / 2 && x <= cx + MENU_BTN_W / 2 &&
            y >= restartY && y <= restartY + MENU_BTN_H) {
          gameOverTriggered = false;
          resetGame();
          generateBuildings();
          buildGrid();
          playStart();
          return;
        }
        // Settings 버튼
        const settingsY = MENU_Y_START + MENU_GAP * 2;
        if (x >= cx - MENU_BTN_W / 2 && x <= cx + MENU_BTN_W / 2 &&
            y >= settingsY && y <= settingsY + MENU_BTN_H) {
          openSettings();
          playUIClick();
          return;
        }
        // Exit 버튼
        const exitY = MENU_Y_START + MENU_GAP * 3;
        if (x >= cx - MENU_BTN_W / 2 && x <= cx + MENU_BTN_W / 2 &&
            y >= exitY && y <= exitY + MENU_BTN_H) {
          state.screen = 'title';
          playUIClick();
          return;
        }
      },
    },
    100
  );

  // 무기 슬롯 영역 (7개 + 주머니)
  const WEAPONS = ['pistol', 'bow', 'sniper', 'mg', 'crossbow', 'flamethrower', 'flashlight', 'pouch'];
  const slotW = W / WEAPONS.length;
  registerZone(
    { x: 0, y: CONTROLS_TOP, w: W, h: SLOT_H },
    {
      onTap(x, _y) {
        if (state.screen !== 'playing') return;
        const prev = state.currentWeapon;
        const idx = Math.min(WEAPONS.length - 1, Math.floor(x / slotW));
        state.currentWeapon = WEAPONS[idx];
        if (state.currentWeapon !== prev) playWeaponSwitch();
      },
    },
    10
  );
}

/**
 * HUD 그리기 (상단)
 */
export function drawHUD(ctx) {
  // 배경
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, HUD_H);

  // 점수 (좌측)
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`${state.score}`, 10, 32);

  // Stage 정보 (중앙)
  if (state.wave > 0) {
    const zombieCount = state.zombies.filter(z => z.alive).length + state.waveSpawnQueue.length;
    const icon = state.isNight ? '\uD83C\uDF19' : '\u2600';

    ctx.textAlign = 'center';
    ctx.fillStyle = state.isNight ? '#8888cc' : '#c0a060';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(`Stage ${state.wave} ${icon}  x${zombieCount}`, W / 2, 20);
  }

  // 콤보 (중앙 아래)
  if (state.combo > 1) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffdd44';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`x${state.combo} COMBO`, W / 2, 36);
  }

  // 탄약 현황 (우측)
  const totalAmmo = getTotalAmmo();
  const lowAmmo = totalAmmo <= 3;
  ctx.textAlign = 'right';

  if (lowAmmo && Math.sin(state.time * 8) > 0) {
    ctx.fillStyle = '#ff4444';
  } else {
    ctx.fillStyle = '#aaa';
  }
  ctx.font = '12px monospace';
  ctx.fillText(`AMMO:${totalAmmo}`, W - 10, 18);

  // 플레이어 HP 바 (우측, 넓게)
  const pHpRatio = Math.max(0, state.player.hp / state.player.maxHp);
  const hpBarX = W - 95;
  const hpBarW = 80;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(hpBarX, 22, hpBarW, 7);
  ctx.fillStyle = pHpRatio > 0.5 ? '#44ff44' : pHpRatio > 0.25 ? '#ffff44' : '#ff4444';
  ctx.fillRect(hpBarX, 22, hpBarW * pHpRatio, 7);
  ctx.fillStyle = '#ccc';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('HP', hpBarX - 3, 30);

  // 배고픔 바 (HP 바 아래)
  const hungerRatio = Math.max(0, state.hunger / state.hungerMax);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(hpBarX, 32, hpBarW, 5);
  const hungerFlash = hungerRatio < 0.3 && Math.sin(state.time * 8) > 0;
  ctx.fillStyle = hungerFlash ? '#ff4444' : hungerRatio > 0.5 ? '#ffaa44' : hungerRatio > 0.25 ? '#ffff44' : '#ff6644';
  ctx.fillRect(hpBarX, 32, hpBarW * hungerRatio, 5);
  ctx.fillStyle = '#ccc';
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('🍖', hpBarX - 3, 37);

  // 타워 상태 점 3개 (우측 배고픔 바 아래)
  const dotY = 43;
  const dotR = 4;
  const dotSpacing = 14;
  const dotStartX = W - 95 + (80 - dotSpacing * 2) / 2; // center 3 dots under HP bar
  const labels = ['L', 'C', 'R'];
  for (let i = 0; i < 3; i++) {
    const t = state.towers[i];
    const dx = dotStartX + i * dotSpacing;
    const tHpRatio = t.hp / t.maxHp;
    ctx.fillStyle = tHpRatio <= 0 ? '#ff4444' : tHpRatio > 0.5 ? '#44ff44' : '#ffff44';
    ctx.beginPath();
    ctx.arc(dx, dotY, dotR, 0, Math.PI * 2);
    ctx.fill();
    // label
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], dx, dotY + 11);
  }

  // 자이로 상태
  if (isGyroEnabled()) {
    ctx.fillStyle = 'rgba(100,255,100,0.4)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GYRO', W / 2, 12);
  }

  // 일시정지 버튼 (II 아이콘)
  if (state.screen === 'playing') {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(PAUSE_BTN.x + 12, PAUSE_BTN.y + 10, 5, 20);
    ctx.fillRect(PAUSE_BTN.x + 23, PAUSE_BTN.y + 10, 5, 20);
  }
}

/**
 * 무기 슬롯 그리기 (아이콘)
 */
export function drawWeaponSlots(ctx) {
  const y = CONTROLS_TOP;
  const weapons = [
    { id: 'pistol', color: '#ffcc66', bg: 'rgba(255,200,100,0.3)' },
    { id: 'bow', color: '#aaddaa', bg: 'rgba(150,200,100,0.3)' },
    { id: 'sniper', color: '#88bbff', bg: 'rgba(100,150,255,0.3)' },
    { id: 'mg', color: '#ffaa66', bg: 'rgba(255,150,80,0.3)' },
    { id: 'crossbow', color: '#88ff88', bg: 'rgba(100,255,100,0.3)' },
    { id: 'flamethrower', color: '#ff8844', bg: 'rgba(255,120,50,0.3)' },
    { id: 'flashlight', color: '#ffee88', bg: 'rgba(255,238,136,0.3)' },
    { id: 'pouch', color: '#ccbbaa', bg: 'rgba(180,160,140,0.3)' },
  ];
  const slotW = W / weapons.length;

  // 배경
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, y, W, SLOT_H);

  for (let i = 0; i < weapons.length; i++) {
    const w = weapons[i];
    const active = state.currentWeapon === w.id;
    const sx = i * slotW;
    const cx = sx + slotW / 2;
    const cy = y + SLOT_H / 2;

    ctx.fillStyle = active ? w.bg : 'rgba(255,255,255,0.05)';
    ctx.fillRect(sx, y, slotW, SLOT_H);

    const c = active ? w.color : '#888';
    drawWeaponIcon(ctx, w.id, cx, cy, c);

    // 구분선
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx, y + SLOT_H);
      ctx.stroke();
    }
  }
}

/** 무기 아이콘 그리기 (캔버스 프리미티브) */
function drawWeaponIcon(ctx, id, cx, cy, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (id) {
    case 'pistol': {
      // 총열 (가로)
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 4);
      ctx.lineTo(cx + 10, cy - 4);
      ctx.lineTo(cx + 10, cy - 1);
      ctx.lineTo(cx - 4, cy - 1);
      ctx.closePath();
      ctx.fill();
      // 그립 (세로)
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 1);
      ctx.lineTo(cx + 3, cy - 1);
      ctx.lineTo(cx + 5, cy + 10);
      ctx.lineTo(cx, cy + 10);
      ctx.closePath();
      ctx.fill();
      // 트리거
      ctx.beginPath();
      ctx.moveTo(cx + 1, cy + 1);
      ctx.lineTo(cx - 3, cy + 5);
      ctx.stroke();
      break;
    }
    case 'bow': {
      // 활 몸체 (곡선)
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 12);
      ctx.quadraticCurveTo(cx - 12, cy, cx - 2, cy + 12);
      ctx.stroke();
      // 시위 (직선)
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 12);
      ctx.lineTo(cx - 2, cy + 12);
      ctx.stroke();
      // 화살
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy);
      ctx.lineTo(cx + 12, cy);
      ctx.stroke();
      // 화살촉
      ctx.beginPath();
      ctx.moveTo(cx + 14, cy);
      ctx.lineTo(cx + 10, cy - 3);
      ctx.lineTo(cx + 10, cy + 3);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'sniper': {
      // 긴 총열
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy - 3);
      ctx.lineTo(cx + 12, cy - 3);
      ctx.lineTo(cx + 12, cy);
      ctx.lineTo(cx - 6, cy);
      ctx.closePath();
      ctx.fill();
      // 스코프
      ctx.beginPath();
      ctx.arc(cx - 2, cy - 6, 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 3);
      ctx.lineTo(cx - 2, cy - 3);
      ctx.stroke();
      // 그립
      ctx.beginPath();
      ctx.moveTo(cx + 2, cy);
      ctx.lineTo(cx + 5, cy + 10);
      ctx.lineTo(cx + 8, cy + 10);
      ctx.lineTo(cx + 6, cy);
      ctx.closePath();
      ctx.fill();
      // 개머리판
      ctx.beginPath();
      ctx.moveTo(cx - 14, cy - 4);
      ctx.lineTo(cx - 14, cy + 2);
      ctx.stroke();
      break;
    }
    case 'mg': {
      // 총열 (두꺼움)
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy - 3);
      ctx.lineTo(cx + 10, cy - 3);
      ctx.lineTo(cx + 10, cy + 1);
      ctx.lineTo(cx - 6, cy + 1);
      ctx.closePath();
      ctx.fill();
      // 탄띠
      ctx.lineWidth = 1;
      for (let j = 0; j < 3; j++) {
        ctx.fillRect(cx - 10 + j * 5, cy + 4, 3, 6);
      }
      // 손잡이
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + 2, cy + 1);
      ctx.lineTo(cx + 4, cy + 10);
      ctx.stroke();
      // 방열구
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 5);
      ctx.lineTo(cx - 4, cy - 5);
      ctx.stroke();
      break;
    }
    case 'crossbow': {
      // 몸체 (가로)
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy);
      ctx.lineTo(cx + 12, cy);
      ctx.stroke();
      // 활 (가로 양쪽)
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 10);
      ctx.quadraticCurveTo(cx - 8, cy, cx - 2, cy + 10);
      ctx.stroke();
      // 시위
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy - 10);
      ctx.lineTo(cx + 4, cy);
      ctx.lineTo(cx - 2, cy + 10);
      ctx.stroke();
      // 볼트
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + 4, cy);
      ctx.lineTo(cx + 14, cy);
      ctx.stroke();
      break;
    }
    case 'flamethrower': {
      // 노즐
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy - 2);
      ctx.lineTo(cx + 8, cy - 2);
      ctx.lineTo(cx + 10, cy - 5);
      ctx.lineTo(cx + 12, cy - 2);
      ctx.lineTo(cx + 12, cy + 2);
      ctx.lineTo(cx + 10, cy + 5);
      ctx.lineTo(cx + 8, cy + 2);
      ctx.lineTo(cx - 3, cy + 2);
      ctx.closePath();
      ctx.fill();
      // 탱크
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 5);
      ctx.lineTo(cx - 3, cy - 5);
      ctx.lineTo(cx - 3, cy + 5);
      ctx.lineTo(cx - 5, cy + 5);
      ctx.lineTo(cx - 8, cy + 8);
      ctx.lineTo(cx - 10, cy + 8);
      ctx.lineTo(cx - 10, cy - 8);
      ctx.lineTo(cx - 8, cy - 8);
      ctx.closePath();
      ctx.fill();
      // 불꽃
      ctx.fillStyle = '#ff4400';
      ctx.globalAlpha = 0.7 + Math.random() * 0.3;
      ctx.beginPath();
      ctx.arc(cx + 15, cy, 3 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath();
      ctx.arc(cx + 14, cy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'flashlight': {
      // 몸체 (원통)
      ctx.fillRect(cx - 4, cy - 8, 8, 14);
      // 헤드 (넓은 부분)
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 8);
      ctx.lineTo(cx - 7, cy - 14);
      ctx.lineTo(cx + 7, cy - 14);
      ctx.lineTo(cx + 4, cy - 8);
      ctx.closePath();
      ctx.fill();
      // 빛 (위로 삼각형)
      ctx.fillStyle = state.flashlight.on ? 'rgba(255,238,136,0.5)' : 'rgba(255,238,136,0.15)';
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy - 14);
      ctx.lineTo(cx, cy - 22);
      ctx.lineTo(cx + 3, cy - 14);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'pouch': {
      // 주머니 몸체
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy - 4);
      ctx.quadraticCurveTo(cx - 10, cy + 8, cx, cy + 10);
      ctx.quadraticCurveTo(cx + 10, cy + 8, cx + 8, cy - 4);
      ctx.closePath();
      ctx.fill();
      // 끈
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 4);
      ctx.lineTo(cx - 3, cy - 8);
      ctx.lineTo(cx + 3, cy - 8);
      ctx.lineTo(cx + 6, cy - 4);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

/**
 * 조작부 배경
 */
export function drawControlsBg(ctx) {
  // 아이템 바 배경
  ctx.fillStyle = '#0d0a08';
  ctx.fillRect(0, CONTROLS_TOP + SLOT_H, W, ITEM_BAR_H);

  // 무기 컨트롤 배경 (아이템 바 아래)
  ctx.fillStyle = '#1a1510';
  ctx.fillRect(0, CONTROLS_TOP + SLOT_H + ITEM_BAR_H, W, CONTROLS_BOTTOM - CONTROLS_TOP - SLOT_H - ITEM_BAR_H);
}

/**
 * 타이틀 화면
 */
export function drawTitle(ctx) {
  // 배경
  ctx.fillStyle = '#0a0808';
  ctx.fillRect(0, 0, W, H);

  // 제목
  ctx.fillStyle = '#880000';
  ctx.font = 'bold 42px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ZOMBIE', W / 2, H * 0.28);
  ctx.fillText('WORLD', W / 2, H * 0.28 + 50);

  // 부제
  ctx.fillStyle = '#ddd';
  ctx.font = '16px monospace';
  ctx.fillText('\uC131\uBCBD\uC744 \uC9C0\uCF1C\uB77C', W / 2, H * 0.28 + 90);

  // 시작 안내
  const alpha = 0.5 + Math.sin(Date.now() / 500) * 0.3;
  ctx.fillStyle = `rgba(255,200,100,${alpha})`;
  ctx.font = 'bold 18px monospace';
  ctx.fillText('TAP TO START', W / 2, H * 0.6);

  // 기록 표시
  if (state.bestScore > 0 || state.bestWave > 0) {
    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    if (state.bestScore > 0) {
      ctx.fillText(`BEST SCORE: ${state.bestScore}`, W / 2, H * 0.68);
    }
    if (state.bestWave > 0) {
      ctx.fillText(`BEST STAGE: ${state.bestWave}`, W / 2, H * 0.73);
    }
  }

  // 무기 미리보기
  ctx.fillStyle = '#555';
  ctx.font = '11px monospace';
  ctx.fillText('\uAD8C\uCD1D | \uD65C | \uC800\uACA9 | MG | \uC11D\uAD81 | \uD654\uC5FC', W / 2, H * 0.82);

  // 설정 버튼
  ctx.fillStyle = '#555';
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('\u2699 SETTINGS', W / 2, H * 0.92);
}

/**
 * 일시정지 메뉴 그리기
 */
export function drawPauseMenu(ctx) {
  // 반투명 오버레이
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, W, H);

  // PAUSED
  ctx.fillStyle = '#880000';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', W / 2, H * 0.28);

  // 현재 점수/웨이브 표시
  ctx.fillStyle = '#888';
  ctx.font = '14px monospace';
  ctx.fillText(`SCORE: ${state.score}  |  Stage ${state.wave}`, W / 2, H * 0.34);

  // 메뉴 버튼들
  const buttons = [
    { label: 'RESUME', color: '#4a8' },
    { label: 'RESTART', color: '#a84' },
    { label: 'SETTINGS', color: '#668' },
    { label: 'EXIT', color: '#844' },
  ];

  for (let i = 0; i < buttons.length; i++) {
    const by = MENU_Y_START + i * MENU_GAP;
    const bx = W / 2 - MENU_BTN_W / 2;

    ctx.fillStyle = buttons[i].color;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bx, by, MENU_BTN_W, MENU_BTN_H, 8);
    } else {
      ctx.rect(bx, by, MENU_BTN_W, MENU_BTN_H);
    }
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(buttons[i].label, W / 2, by + 33);
  }
}

/**
 * 게임 오버 화면
 */
export function drawGameOver(ctx) {
  congratsTimer += 0.016;

  // 반투명 오버레이
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);

  // 생존 실패
  ctx.fillStyle = '#cc3333';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('생존 실패', W / 2, H * 0.25);

  // 점수
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(`${state.score}`, W / 2, H * 0.37);
  ctx.fillStyle = '#aaa';
  ctx.font = '14px monospace';
  ctx.fillText('SCORE', W / 2, H * 0.37 + 22);

  // Stage 도달
  ctx.fillStyle = '#c0a060';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`Stage ${state.wave}`, W / 2, H * 0.46);

  // 최대 콤보
  ctx.fillStyle = '#ffdd44';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`MAX COMBO: ${state.maxCombo}`, W / 2, H * 0.51);

  // 기록 표시
  let recordY = H * 0.57;

  if (newBestScore) {
    const flash = 0.7 + Math.sin(congratsTimer * 6) * 0.3;
    ctx.fillStyle = `rgba(255,68,68,${flash})`;
    ctx.font = 'bold 18px monospace';
    ctx.fillText('NEW BEST SCORE!', W / 2, recordY);
  } else {
    ctx.fillStyle = '#666';
    ctx.font = '14px monospace';
    ctx.fillText(`BEST SCORE: ${state.bestScore}`, W / 2, recordY);
  }
  recordY += 24;

  if (newBestWave) {
    const flash = 0.7 + Math.sin(congratsTimer * 6 + 1) * 0.3;
    ctx.fillStyle = `rgba(255,170,68,${flash})`;
    ctx.font = 'bold 18px monospace';
    ctx.fillText('NEW BEST STAGE!', W / 2, recordY);
  } else {
    ctx.fillStyle = '#666';
    ctx.font = '14px monospace';
    ctx.fillText(`BEST STAGE: ${state.bestWave}`, W / 2, recordY);
  }
  recordY += 24;

  if (newBestScore && newBestWave) {
    const bigFlash = 0.6 + Math.sin(congratsTimer * 4) * 0.4;
    ctx.fillStyle = `rgba(255,215,0,${bigFlash})`;
    ctx.font = 'bold 14px monospace';
    ctx.fillText('DOUBLE RECORD!', W / 2, recordY);
  }

  // 재시작
  const alpha = 0.5 + Math.sin(Date.now() / 500) * 0.3;
  ctx.fillStyle = `rgba(255,200,100,${alpha})`;
  ctx.font = 'bold 18px monospace';
  ctx.fillText('TAP TO RESTART', W / 2, H * 0.78);
}

/**
 * 게임 오버 처리
 */
export function triggerGameOver() {
  if (gameOverTriggered) return;
  gameOverTriggered = true;

  // 점수 기록 (zw_ prefix)
  newBestScore = state.score > state.bestScore;
  if (newBestScore) {
    state.bestScore = state.score;
    localStorage.setItem('zw_best', String(state.score));
  }

  // 웨이브 기록
  newBestWave = state.wave > state.bestWave;
  if (newBestWave) {
    state.bestWave = state.wave;
    localStorage.setItem('zw_best_wave', String(state.wave));
  }

  congratsTimer = 0;
  state.screen = 'gameover';
  playGameOver();
  if (newBestScore || newBestWave) {
    setTimeout(() => playNewRecord(), 600);
  }
}

/**
 * 타이틀/게임오버 터치 처리 등록
 */
export function initScreenHandlers() {
  registerZone(
    { x: 0, y: 0, w: W, h: H },
    {
      onTap(x, y) {
        if (state.screen === 'title') {
          // 설정 버튼 영역 (하단)
          if (y >= H * 0.88 && y <= H * 0.96 && x >= W / 2 - 80 && x <= W / 2 + 80) {
            openSettings();
            return;
          }
          requestGyro();
          resetGyroRef();
          resetGame();
          generateBuildings();
          buildGrid();
          playStart();
        } else if (state.screen === 'gameover') {
          gameOverTriggered = false;
          requestGyro();
          resetGyroRef();
          resetGame();
          generateBuildings();
          buildGrid();
          playStart();
        }
      },
    },
    -1
  );
}
