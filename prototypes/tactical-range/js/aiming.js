// ── 조이스틱 조준 시스템 ──
import { state, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H, JOYSTICK_W } from './game.js?v=12';
import { registerZone } from './input.js?v=12';
import { settings } from './settings.js?v=12';

const CTRL_Y = CONTROLS_TOP + SLOT_H;
const CTRL_H = CONTROLS_BOTTOM - CTRL_Y;
const JOY_CX = JOYSTICK_W / 2;          // 조이스틱 중심 X
const JOY_CY = CTRL_Y + CTRL_H / 2;     // 조이스틱 중심 Y
const JOY_R = 42;                         // 외곽 반지름
const THUMB_R = 16;                        // 엄지 반지름
const MAX_OFFSET = 35;                     // 최대 이동량

// 조이스틱 상태
let active = false;
let offsetX = 0;
let offsetY = 0;
let prevX = 0;
let prevY = 0;

export function initJoystick() {
  registerZone(
    { x: 0, y: CTRL_Y, w: JOYSTICK_W, h: CTRL_H },
    {
      onStart(x, y) {
        active = true;
        offsetX = 0;
        offsetY = 0;
        prevX = x;
        prevY = y;
      },
      onMove(x, y) {
        if (!active) return;

        // 드래그 델타 → 즉시 조준점 이동
        const dx = x - prevX;
        const dy = y - prevY;
        prevX = x;
        prevY = y;

        state.aimX = Math.max(-1, Math.min(1, state.aimX + dx * settings.dragSens));
        // 활 당기는 중에는 Y축 조준 비활성화 (좌우만 가능)
        if (!(state.currentWeapon === 'bow' && state.bow.drawing)) {
          state.aimY = Math.max(-1, Math.min(1, state.aimY + dy * settings.dragSens));
        }

        // 썸스틱 시각적 위치 (중심 기준)
        let ox = x - JOY_CX;
        let oy = y - JOY_CY;
        const dist = Math.hypot(ox, oy);
        if (dist > MAX_OFFSET) {
          ox = ox / dist * MAX_OFFSET;
          oy = oy / dist * MAX_OFFSET;
        }
        offsetX = ox;
        offsetY = oy;
      },
      onEnd() {
        active = false;
        offsetX = 0;
        offsetY = 0;
      },
    },
    5
  );
}

// 매 프레임 호출 (드래그 방식이라 여기선 할 일 없음)
export function updateJoystick(dt) {
}

export function drawJoystick(ctx) {
  ctx.save();

  // 외곽 원
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(JOY_CX, JOY_CY, JOY_R, 0, Math.PI * 2);
  ctx.stroke();

  // 십자 가이드
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(JOY_CX - JOY_R, JOY_CY);
  ctx.lineTo(JOY_CX + JOY_R, JOY_CY);
  ctx.moveTo(JOY_CX, JOY_CY - JOY_R);
  ctx.lineTo(JOY_CX, JOY_CY + JOY_R);
  ctx.stroke();

  // 엄지 (썸스틱)
  const thumbX = JOY_CX + offsetX;
  const thumbY = JOY_CY + offsetY;

  ctx.fillStyle = active ? 'rgba(255,200,100,0.6)' : 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.arc(thumbX, thumbY, THUMB_R, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = active ? 'rgba(255,200,100,0.8)' : 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(thumbX, thumbY, THUMB_R, 0, Math.PI * 2);
  ctx.stroke();

  // 레이블
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('조준', JOY_CX, CTRL_Y + 12);

  ctx.restore();
}
