// ── HUD + 무기 교체 + 게임 화면 ──
import { state, W, H, HUD_H, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H, resetGame, getTotalAmmo } from './game.js?v=11';
import { registerZone } from './input.js?v=11';
import { playStart, playGameOver, playNewRecord, playUIPause, playUIResume, playUIClick, playWeaponSwitch } from './audio.js?v=11';
import { requestGyro, resetGyroRef, isGyroEnabled, isGyroSupported } from './gyro.js?v=11';
import { openSettings } from './settings.js?v=11';

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
        // paused 상태가 아니면 이 핸들러를 건너뛰고 다음 핸들러로
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

  // 무기 슬롯 영역 (5개)
  const WEAPONS = ['pistol', 'bow', 'sniper', 'mg', 'crossbow'];
  const slotW = W / WEAPONS.length;
  registerZone(
    { x: 0, y: CONTROLS_TOP, w: W, h: SLOT_H },
    {
      onTap(x, y) {
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

  // 점수
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`${state.score}`, 10, 32);

  // 웨이브 + 남은 과녁 + 타이머
  if (state.wave > 0 && !state.waveCleared) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c0a060';
    ctx.font = 'bold 12px monospace';
    const remaining = state.targets.filter(t => t.alive && t.type !== 'supply').length;
    const queueLeft = state.waveSpawnQueue.filter(q => q.type !== 'supply').length;
    ctx.fillText(`WAVE ${state.wave}  ×${remaining + queueLeft}`, W / 2, 20);

    // 타이머 바
    const timeLeft = Math.max(0, state.waveTimeLimit - state.waveTimer);
    const ratio = timeLeft / state.waveTimeLimit;
    const barW = 120;
    const barX = W / 2 - barW / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(barX, 26, barW, 5);
    ctx.fillStyle = ratio > 0.5 ? '#4f4' : ratio > 0.25 ? '#fa4' : '#f44';
    ctx.fillRect(barX, 26, barW * ratio, 5);
  }

  // 콤보
  ctx.textAlign = 'left';
  if (state.combo > 1) {
    ctx.fillStyle = '#ffdd44';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`×${state.combo} COMBO`, 120, 30);
  }

  // 탄약 현황 (오른쪽)
  const totalAmmo = getTotalAmmo();
  const lowAmmo = totalAmmo <= 3;

  ctx.textAlign = 'right';

  if (lowAmmo && Math.sin(state.time * 8) > 0) {
    ctx.fillStyle = '#ff4444';
  } else {
    ctx.fillStyle = '#aaa';
  }
  ctx.font = '12px monospace';

  const ammo = getTotalAmmo();
  ctx.fillText(`AMMO:${ammo}`, W - 10, 22);

  // 하이스코어 (점수 + 웨이브)
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.fillText(`BEST: ${state.bestScore} W${state.bestWave}`, W - 10, 38);

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
 * 무기 슬롯 그리기
 */
export function drawWeaponSlots(ctx) {
  const y = CONTROLS_TOP;
  const weapons = [
    { id: 'pistol', label: '권총', color: '#ffcc66', bg: 'rgba(255,200,100,0.3)' },
    { id: 'bow', label: '활', color: '#aaddaa', bg: 'rgba(150,200,100,0.3)' },
    { id: 'sniper', label: '저격', color: '#88bbff', bg: 'rgba(100,150,255,0.3)' },
    { id: 'mg', label: '기관총', color: '#ffaa66', bg: 'rgba(255,150,80,0.3)' },
    { id: 'crossbow', label: '석궁', color: '#88ff88', bg: 'rgba(100,255,100,0.3)' },
  ];
  const slotW = W / weapons.length;

  // 배경
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, y, W, SLOT_H);

  for (let i = 0; i < weapons.length; i++) {
    const w = weapons[i];
    const active = state.currentWeapon === w.id;
    const sx = i * slotW;

    ctx.fillStyle = active ? w.bg : 'rgba(255,255,255,0.05)';
    ctx.fillRect(sx, y, slotW, SLOT_H);

    ctx.fillStyle = active ? w.color : '#888';
    ctx.font = `bold ${slotW > 100 ? 11 : 9}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(w.label, sx + slotW / 2, y + 26);

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

/**
 * 조작부 배경
 */
export function drawControlsBg(ctx) {
  ctx.fillStyle = '#1a1510';
  ctx.fillRect(0, CONTROLS_TOP + SLOT_H, W, CONTROLS_BOTTOM - CONTROLS_TOP - SLOT_H);
}

/**
 * 타이틀 화면
 */
export function drawTitle(ctx) {
  // 배경
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, W, H);

  // 제목
  ctx.fillStyle = '#c0a060';
  ctx.font = 'bold 40px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TACTICAL', W / 2, H * 0.3);
  ctx.fillText('RANGE', W / 2, H * 0.3 + 48);

  // 부제
  ctx.fillStyle = '#888';
  ctx.font = '14px monospace';
  ctx.fillText('리얼 조작감 사격장 서바이벌', W / 2, H * 0.3 + 90);

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
      ctx.fillText(`BEST WAVE: ${state.bestWave}`, W / 2, H * 0.73);
    }
  }

  // 무기 미리보기
  ctx.fillStyle = '#555';
  ctx.font = '11px monospace';
  ctx.fillText('권총 | 활 | 저격총 | 기관총 | 석궁', W / 2, H * 0.82);

  // 설정 버튼
  ctx.fillStyle = '#555';
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('⚙ SETTINGS', W / 2, H * 0.92);
}

/**
 * 일시정지 메뉴 그리기
 */
export function drawPauseMenu(ctx) {
  // 반투명 오버레이
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, W, H);

  // PAUSED
  ctx.fillStyle = '#c0a060';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', W / 2, H * 0.28);

  // 현재 점수/웨이브 표시
  ctx.fillStyle = '#888';
  ctx.font = '14px monospace';
  ctx.fillText(`SCORE: ${state.score}  |  WAVE ${state.wave}`, W / 2, H * 0.34);

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

    // 버튼 배경
    ctx.fillStyle = buttons[i].color;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bx, by, MENU_BTN_W, MENU_BTN_H, 8);
    } else {
      ctx.rect(bx, by, MENU_BTN_W, MENU_BTN_H);
    }
    ctx.fill();

    // 버튼 텍스트
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(buttons[i].label, W / 2, by + 33);
  }
}

/**
 * 게임 오버 화면
 */
export function drawGameOver(ctx) {
  // 축하 타이머 갱신
  congratsTimer += 0.016;

  // 반투명 오버레이
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);

  // GAME OVER
  ctx.fillStyle = '#cc3333';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', W / 2, H * 0.25);

  // 점수
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(`${state.score}`, W / 2, H * 0.35);
  ctx.fillStyle = '#aaa';
  ctx.font = '14px monospace';
  ctx.fillText('SCORE', W / 2, H * 0.35 + 22);

  // 웨이브 + 최대 콤보
  ctx.fillStyle = '#c0a060';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`WAVE ${state.wave}`, W / 2, H * 0.45);

  ctx.fillStyle = '#ffdd44';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`MAX COMBO: ${state.maxCombo}`, W / 2, H * 0.50);

  // 기록 표시 (점수 기록 + 웨이브 기록 따로)
  let recordY = H * 0.56;

  // 점수 기록
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

  // 웨이브 기록
  if (newBestWave) {
    const flash = 0.7 + Math.sin(congratsTimer * 6 + 1) * 0.3;
    ctx.fillStyle = `rgba(255,170,68,${flash})`;
    ctx.font = 'bold 18px monospace';
    ctx.fillText('NEW BEST WAVE!', W / 2, recordY);
  } else {
    ctx.fillStyle = '#666';
    ctx.font = '14px monospace';
    ctx.fillText(`BEST WAVE: ${state.bestWave}`, W / 2, recordY);
  }
  recordY += 24;

  // 둘 다 갱신 시 축하 메시지
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
  ctx.fillText('TAP TO RETRY', W / 2, H * 0.78);
}

/**
 * 게임 오버 처리
 */
export function triggerGameOver() {
  if (gameOverTriggered) return;
  gameOverTriggered = true;

  // 점수 기록
  newBestScore = state.score > state.bestScore;
  if (newBestScore) {
    state.bestScore = state.score;
    localStorage.setItem('tr_best', String(state.score));
  }

  // 웨이브 기록
  newBestWave = state.wave > state.bestWave;
  if (newBestWave) {
    state.bestWave = state.wave;
    localStorage.setItem('tr_best_wave', String(state.wave));
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
          requestGyro(); // iOS 사용자 제스처 내에서 권한 요청
          resetGyroRef();
          resetGame();
          playStart();
        } else if (state.screen === 'gameover') {
          gameOverTriggered = false;
          requestGyro();
          resetGyroRef();
          resetGame();
          playStart();
        }
      },
    },
    -1 // 가장 낮은 우선순위
  );
}
