// ── 반원 다이얼 조준 시스템 ──
import { state, W, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H } from './game.js?v=2';
import { registerZone } from './input.js?v=2';

const CTRL_Y = CONTROLS_TOP + SLOT_H;
const CTRL_H = CONTROLS_BOTTOM - CTRL_Y;
const DIAL_CX = W / 2;
const DIAL_CY = CTRL_Y + CTRL_H * 0.65; // dial center
const DIAL_R = 75;
const THUMB_R = 14;

let active = false;

function angleFromTouch(x, y) {
  const dx = x - DIAL_CX;
  const dy = DIAL_CY - y; // flip Y
  let angle = Math.atan2(dy, dx);
  // Clamp to upper half (0 to pi)
  if (angle < 0.15) angle = 0.15;       // ~8 deg from right
  if (angle > Math.PI - 0.15) angle = Math.PI - 0.15; // ~8 deg from left
  return angle;
}

export function initDial() {
  registerZone(
    { x: DIAL_CX - DIAL_R - 20, y: CTRL_Y, w: DIAL_R * 2 + 40, h: CTRL_H },
    {
      onStart(x, y) {
        active = true;
        state.aimAngle = angleFromTouch(x, y);
      },
      onMove(x, y) {
        if (!active) return;
        state.aimAngle = angleFromTouch(x, y);
      },
      onEnd() {
        active = false;
      },
    },
    5 // same priority as old joystick
  );
}

export function updateDial(dt) {
  // Nothing needed per-frame
}

export function drawDial(ctx) {
  ctx.save();

  // Dial arc (upper half)
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(DIAL_CX, DIAL_CY, DIAL_R, Math.PI, 0, false); // pi to 0 = left to right arc
  ctx.stroke();

  // Tick marks at 30 deg intervals
  for (let deg = 0; deg <= 180; deg += 30) {
    const rad = deg * Math.PI / 180;
    const inner = DIAL_R - 8;
    const outer = DIAL_R + 4;
    ctx.strokeStyle = deg === 90 ? 'rgba(255,100,100,0.5)' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = deg === 90 ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(DIAL_CX + Math.cos(rad) * inner, DIAL_CY - Math.sin(rad) * inner);
    ctx.lineTo(DIAL_CX + Math.cos(rad) * outer, DIAL_CY - Math.sin(rad) * outer);
    ctx.stroke();
  }

  // Current angle thumb
  const thumbX = DIAL_CX + Math.cos(state.aimAngle) * DIAL_R;
  const thumbY = DIAL_CY - Math.sin(state.aimAngle) * DIAL_R;

  ctx.fillStyle = active ? 'rgba(255,100,80,0.7)' : 'rgba(255,200,100,0.4)';
  ctx.beginPath();
  ctx.arc(thumbX, thumbY, THUMB_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = active ? '#ff6644' : 'rgba(255,200,100,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Direction line from center to thumb
  ctx.strokeStyle = 'rgba(255,100,80,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(DIAL_CX, DIAL_CY);
  ctx.lineTo(thumbX, thumbY);
  ctx.stroke();

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('\uC870\uC900', DIAL_CX, CTRL_Y + 12);

  ctx.restore();
}
