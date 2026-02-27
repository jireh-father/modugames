// ── HUD + 무기 교체 + 게임 화면 ──
import { state, W, H, HUD_H, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H, resetGame, getTotalAmmo } from './game.js?v=4';
import { registerZone } from './input.js?v=4';
import { playStart, playGameOver } from './audio.js?v=4';
import { requestGyro, resetGyroRef, isGyroEnabled, isGyroSupported } from './gyro.js?v=4';

let gameOverTriggered = false;

/**
 * 무기 슬롯 터치 등록
 */
export function initHUD() {
  gameOverTriggered = false;

  // 무기 슬롯 영역
  registerZone(
    { x: 0, y: CONTROLS_TOP, w: W, h: SLOT_H },
    {
      onTap(x, y) {
        if (state.screen !== 'playing') return;
        if (x < W / 2) {
          state.currentWeapon = 'pistol';
        } else {
          state.currentWeapon = 'bow';
        }
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

  // 웨이브 + 남은 과녁
  if (state.wave > 0) {
    ctx.fillStyle = '#c0a060';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    const remaining = state.targets.filter(t => t.alive && t.type !== 'supply').length;
    ctx.fillText(`WAVE ${state.wave}  ×${remaining}`, W / 2, 20);
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

  const p = state.pistol;
  const b = state.bow;
  const pistolTotal = p.magazineBullets + p.reserveBullets + p.specialBullets + (p.chambered ? 1 : 0);
  const bowTotal = b.arrows + b.specialArrows;

  ctx.fillText(`탄:${pistolTotal} 화살:${bowTotal}`, W - 10, 22);

  // 하이스코어
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.fillText(`BEST: ${state.bestScore}`, W - 10, 38);

  // 자이로 상태
  if (isGyroEnabled()) {
    ctx.fillStyle = 'rgba(100,255,100,0.4)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GYRO', W / 2, 12);
  }
}

/**
 * 무기 슬롯 그리기
 */
export function drawWeaponSlots(ctx) {
  const y = CONTROLS_TOP;

  // 배경
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, y, W, SLOT_H);

  // 권총 슬롯
  const pistolActive = state.currentWeapon === 'pistol';
  ctx.fillStyle = pistolActive ? 'rgba(255,200,100,0.3)' : 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, y, W / 2, SLOT_H);

  ctx.fillStyle = pistolActive ? '#ffcc66' : '#888';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('권총', W / 4, y + 26);

  // 활 슬롯
  const bowActive = state.currentWeapon === 'bow';
  ctx.fillStyle = bowActive ? 'rgba(150,200,100,0.3)' : 'rgba(255,255,255,0.05)';
  ctx.fillRect(W / 2, y, W / 2, SLOT_H);

  ctx.fillStyle = bowActive ? '#aaddaa' : '#888';
  ctx.fillText('활', W * 3 / 4, y + 26);

  // 구분선
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2, y);
  ctx.lineTo(W / 2, y + SLOT_H);
  ctx.stroke();
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

  // 하이스코어
  if (state.bestScore > 0) {
    ctx.fillStyle = '#666';
    ctx.font = '14px monospace';
    ctx.fillText(`BEST SCORE: ${state.bestScore}`, W / 2, H * 0.7);
  }

  // 무기 미리보기
  ctx.fillStyle = '#444';
  ctx.font = '12px monospace';
  ctx.fillText('🔫 권총  ×  🏹 활', W / 2, H * 0.8);
}

/**
 * 게임 오버 화면
 */
export function drawGameOver(ctx) {
  // 반투명 오버레이
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);

  // GAME OVER
  ctx.fillStyle = '#cc3333';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', W / 2, H * 0.3);

  // 점수
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(`${state.score}`, W / 2, H * 0.42);
  ctx.fillStyle = '#aaa';
  ctx.font = '14px monospace';
  ctx.fillText('SCORE', W / 2, H * 0.42 + 24);

  // 웨이브 + 최대 콤보
  ctx.fillStyle = '#c0a060';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`WAVE ${state.wave}`, W / 2, H * 0.52);

  ctx.fillStyle = '#ffdd44';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`MAX COMBO: ${state.maxCombo}`, W / 2, H * 0.58);

  // 하이스코어
  const isNew = state.score > state.bestScore;
  if (isNew) {
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('NEW BEST!', W / 2, H * 0.63);
  } else {
    ctx.fillStyle = '#666';
    ctx.font = '14px monospace';
    ctx.fillText(`BEST: ${state.bestScore}`, W / 2, H * 0.63);
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

  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    localStorage.setItem('tr_best', String(state.score));
  }

  state.screen = 'gameover';
  playGameOver();
}

/**
 * 타이틀/게임오버 터치 처리 등록
 */
export function initScreenHandlers() {
  registerZone(
    { x: 0, y: 0, w: W, h: H },
    {
      onTap() {
        if (state.screen === 'title') {
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
