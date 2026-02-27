// ── 설정 메뉴 ──
import { state, W, H } from './game.js?v=4';
import { registerZone } from './input.js?v=4';
import { playUIClick } from './audio.js?v=4';

// 설정값 범위
const DRAG_MIN = 0.003, DRAG_MAX = 0.018, DRAG_STEP = 0.001, DRAG_DEFAULT = 0.009;
const GYRO_MIN = 0.01, GYRO_MAX = 0.06, GYRO_STEP = 0.005, GYRO_DEFAULT = 0.03;

// 설정 상태 (localStorage에서 불러오기)
export const settings = {
  dragSens: parseFloat(localStorage.getItem('tr_drag_sens') || String(DRAG_DEFAULT)),
  gyroSens: parseFloat(localStorage.getItem('tr_gyro_sens') || String(GYRO_DEFAULT)),
  gyroOn: localStorage.getItem('tr_gyro_on') !== 'false', // 기본 ON
};

function save() {
  localStorage.setItem('tr_drag_sens', String(settings.dragSens));
  localStorage.setItem('tr_gyro_sens', String(settings.gyroSens));
  localStorage.setItem('tr_gyro_on', String(settings.gyroOn));
}

// 이전 화면 기억 (설정 나갈 때 돌아가기)
let prevScreen = 'title';

export function openSettings() {
  prevScreen = state.screen;
  state.screen = 'settings';
}

export function closeSettings() {
  save();
  state.screen = prevScreen;
}

// UI 레이아웃
const LABEL_X = 40;
const BAR_X = 170;
const BAR_W = 250;
const BAR_H = 30;
const ARROW_W = 40;
const ROW_H = 70;
const START_Y = 260;

// 슬라이더 정보
const sliders = [
  { label: '조이스틱 감도', key: 'dragSens', min: DRAG_MIN, max: DRAG_MAX, step: DRAG_STEP, def: DRAG_DEFAULT, fmt: v => v.toFixed(3) },
  { label: '자이로 감도', key: 'gyroSens', min: GYRO_MIN, max: GYRO_MAX, step: GYRO_STEP, def: GYRO_DEFAULT, fmt: v => v.toFixed(3) },
];

/**
 * 설정 터치 등록 (priority 100 = settings에서 동작)
 */
export function initSettings() {
  registerZone(
    { x: 0, y: 0, w: W, h: H },
    {
      onStart() {
        if (state.screen !== 'settings') return false;
      },
      onTap(x, y) {
        if (state.screen !== 'settings') return;

        // 슬라이더 좌/우 화살표
        for (let i = 0; i < sliders.length; i++) {
          const s = sliders[i];
          const rowY = START_Y + i * ROW_H;

          // 왼쪽 화살표
          if (x >= BAR_X - ARROW_W && x <= BAR_X && y >= rowY && y <= rowY + BAR_H) {
            settings[s.key] = Math.max(s.min, +(settings[s.key] - s.step).toFixed(4));
            save(); playUIClick();
            return;
          }
          // 오른쪽 화살표
          if (x >= BAR_X + BAR_W && x <= BAR_X + BAR_W + ARROW_W && y >= rowY && y <= rowY + BAR_H) {
            settings[s.key] = Math.min(s.max, +(settings[s.key] + s.step).toFixed(4));
            save(); playUIClick();
            return;
          }
          // 바 직접 탭 → 해당 위치로 값 설정
          if (x >= BAR_X && x <= BAR_X + BAR_W && y >= rowY && y <= rowY + BAR_H) {
            const ratio = (x - BAR_X) / BAR_W;
            const raw = s.min + ratio * (s.max - s.min);
            settings[s.key] = +(Math.round(raw / s.step) * s.step).toFixed(4);
            settings[s.key] = Math.max(s.min, Math.min(s.max, settings[s.key]));
            save(); playUIClick();
            return;
          }
        }

        // 자이로 ON/OFF 토글
        const toggleY = START_Y + sliders.length * ROW_H;
        if (y >= toggleY && y <= toggleY + BAR_H) {
          const onX = BAR_X;
          const offX = BAR_X + 100;
          if (x >= onX && x <= onX + 80) {
            settings.gyroOn = true;
            save(); playUIClick();
            return;
          }
          if (x >= offX && x <= offX + 80) {
            settings.gyroOn = false;
            save(); playUIClick();
            return;
          }
        }

        // BACK 버튼
        const backY = H * 0.75;
        if (x >= W / 2 - 100 && x <= W / 2 + 100 && y >= backY && y <= backY + 50) {
          closeSettings(); playUIClick();
          return;
        }

        // DEFAULT 버튼
        const defY = H * 0.65;
        if (x >= W / 2 - 80 && x <= W / 2 + 80 && y >= defY && y <= defY + 40) {
          settings.dragSens = DRAG_DEFAULT;
          settings.gyroSens = GYRO_DEFAULT;
          settings.gyroOn = true;
          save(); playUIClick();
          return;
        }
      },
    },
    100
  );
}

/**
 * 설정 화면 그리기
 */
export function drawSettings(ctx) {
  // 배경
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, W, H);

  // 제목
  ctx.fillStyle = '#c0a060';
  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SETTINGS', W / 2, 200);

  // 슬라이더
  for (let i = 0; i < sliders.length; i++) {
    const s = sliders[i];
    const rowY = START_Y + i * ROW_H;
    const val = settings[s.key];
    const ratio = (val - s.min) / (s.max - s.min);
    const isDefault = Math.abs(val - s.def) < s.step * 0.5;

    // 라벨
    ctx.fillStyle = '#aaa';
    ctx.font = '13px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(s.label, LABEL_X, rowY + 20);

    // 왼쪽 화살표
    ctx.fillStyle = '#888';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('◀', BAR_X - ARROW_W / 2, rowY + 22);

    // 바 배경
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(BAR_X, rowY, BAR_W, BAR_H);

    // 기본값 마커 (세로선)
    const defRatio = (s.def - s.min) / (s.max - s.min);
    ctx.strokeStyle = 'rgba(255,200,100,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(BAR_X + defRatio * BAR_W, rowY);
    ctx.lineTo(BAR_X + defRatio * BAR_W, rowY + BAR_H);
    ctx.stroke();

    // 바 채움
    ctx.fillStyle = isDefault ? '#c0a060' : '#6a6';
    ctx.fillRect(BAR_X, rowY, BAR_W * ratio, BAR_H);

    // 핸들
    const handleX = BAR_X + BAR_W * ratio;
    ctx.fillStyle = '#fff';
    ctx.fillRect(handleX - 3, rowY - 2, 6, BAR_H + 4);

    // 오른쪽 화살표
    ctx.fillStyle = '#888';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('▶', BAR_X + BAR_W + ARROW_W / 2, rowY + 22);

    // 값 표시
    ctx.fillStyle = isDefault ? '#c0a060' : '#fff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(s.fmt(val), BAR_X + BAR_W / 2, rowY + BAR_H + 16);
  }

  // 자이로 ON/OFF
  const toggleY = START_Y + sliders.length * ROW_H;
  ctx.fillStyle = '#aaa';
  ctx.font = '13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('자이로', LABEL_X, toggleY + 20);

  // ON 버튼
  ctx.fillStyle = settings.gyroOn ? '#4a8' : 'rgba(255,255,255,0.1)';
  ctx.fillRect(BAR_X, toggleY, 80, BAR_H);
  ctx.fillStyle = settings.gyroOn ? '#fff' : '#666';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ON', BAR_X + 40, toggleY + 21);

  // OFF 버튼
  const offX = BAR_X + 100;
  ctx.fillStyle = !settings.gyroOn ? '#844' : 'rgba(255,255,255,0.1)';
  ctx.fillRect(offX, toggleY, 80, BAR_H);
  ctx.fillStyle = !settings.gyroOn ? '#fff' : '#666';
  ctx.fillText('OFF', offX + 40, toggleY + 21);

  // DEFAULT 버튼
  const defY = H * 0.65;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(W / 2 - 80, defY, 160, 40);
  ctx.fillStyle = '#c0a060';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('DEFAULT', W / 2, defY + 26);

  // BACK 버튼
  const backY = H * 0.75;
  ctx.fillStyle = '#4a8';
  ctx.fillRect(W / 2 - 100, backY, 200, 50);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('BACK', W / 2, backY + 33);
}
