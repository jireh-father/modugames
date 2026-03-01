// ── 입력 시스템: 멀티터치 + 마우스 드래그 통합 관리 ──
import { W, H, state } from './game.js?v=16';

const canvas = document.getElementById('c');

// 현재 포인터 상태 (마우스 / 첫 번째 터치 호환용)
export const pointer = {
  down: false,
  x: 0, y: 0,
  startX: 0, startY: 0,
  dx: 0, dy: 0,
  dragDx: 0, dragDy: 0,
};

// 영역별 핸들러 등록
const handlers = [];

/**
 * 드래그 핸들러 등록
 * @param {object} zone - {x, y, w, h} 영역
 * @param {object} callbacks - {onStart, onMove, onEnd, onTap}
 * @param {number} priority - 높을수록 먼저 체크 (기본 0)
 */
export function registerZone(zone, callbacks, priority = 0) {
  handlers.push({ zone, callbacks, priority });
  handlers.sort((a, b) => b.priority - a.priority);
}

export function clearZones() {
  handlers.length = 0;
}

// 캔버스 좌표 변환
function toCanvas(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (W / rect.width),
    y: (clientY - rect.top) * (H / rect.height),
  };
}

function inZone(x, y, z) {
  return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
}

// ── 멀티터치 추적: touchId → { handler, startX, startY, x, y } ──
const activeTouches = new Map();

function touchDown(id, cx, cy) {
  for (const h of handlers) {
    if ((state.screen === 'paused' || state.screen === 'settings') && h.priority !== -1 && h.priority !== 100) continue;
    if (state.screen !== 'playing' && state.screen !== 'paused' && state.screen !== 'settings' && h.priority >= 0) continue;
    if (!inZone(cx, cy, h.zone)) continue;

    // onStart가 false를 반환하면 이 핸들러를 건너뛰고 다음 핸들러 시도
    if (h.callbacks.onStart) {
      const result = h.callbacks.onStart(cx, cy);
      if (result === false) continue;
    }

    activeTouches.set(id, {
      handler: h,
      startX: cx, startY: cy,
      x: cx, y: cy,
    });
    return;
  }
}

function touchMove(id, cx, cy) {
  const info = activeTouches.get(id);
  if (!info) return;

  const dragDx = cx - info.startX;
  const dragDy = cy - info.startY;
  info.x = cx;
  info.y = cy;

  if (info.handler.callbacks.onMove) {
    info.handler.callbacks.onMove(cx, cy, dragDx, dragDy);
  }
}

function touchUp(id) {
  const info = activeTouches.get(id);
  if (!info) return;

  const dragDx = info.x - info.startX;
  const dragDy = info.y - info.startY;
  const wasDrag = Math.abs(dragDx) > 5 || Math.abs(dragDy) > 5;

  if (info.handler.callbacks.onEnd) {
    info.handler.callbacks.onEnd(info.x, info.y, dragDx, dragDy);
  }
  if (!wasDrag && info.handler.callbacks.onTap) {
    info.handler.callbacks.onTap(info.x, info.y);
  }

  activeTouches.delete(id);
}

// ── 마우스 이벤트 (단일 포인터, ID='mouse') ──
canvas.addEventListener('mousedown', e => {
  const p = toCanvas(e.clientX, e.clientY);
  pointer.down = true;
  pointer.x = p.x; pointer.y = p.y;
  pointer.startX = p.x; pointer.startY = p.y;
  pointer.dx = 0; pointer.dy = 0;
  pointer.dragDx = 0; pointer.dragDy = 0;
  touchDown('mouse', p.x, p.y);
});
canvas.addEventListener('mousemove', e => {
  const p = toCanvas(e.clientX, e.clientY);
  pointer.dx = p.x - pointer.x;
  pointer.dy = p.y - pointer.y;
  pointer.x = p.x;
  pointer.y = p.y;
  pointer.dragDx = p.x - pointer.startX;
  pointer.dragDy = p.y - pointer.startY;
  touchMove('mouse', p.x, p.y);
});
canvas.addEventListener('mouseup', e => {
  touchUp('mouse');
  pointer.down = false;
  pointer.dx = 0;
  pointer.dy = 0;
});

// ── 터치 이벤트 (멀티터치 지원) ──
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  // changedTouches: 이번 이벤트에서 새로 추가된 터치만
  for (const t of e.changedTouches) {
    const p = toCanvas(t.clientX, t.clientY);
    touchDown(t.identifier, p.x, p.y);
  }
  // pointer 호환 (첫 번째 터치)
  const first = e.touches[0];
  if (first) {
    const p = toCanvas(first.clientX, first.clientY);
    pointer.down = true;
    pointer.x = p.x; pointer.y = p.y;
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const p = toCanvas(t.clientX, t.clientY);
    touchMove(t.identifier, p.x, p.y);
  }
  // pointer 호환
  const first = e.touches[0];
  if (first) {
    const p = toCanvas(first.clientX, first.clientY);
    pointer.dx = p.x - pointer.x;
    pointer.dy = p.y - pointer.y;
    pointer.x = p.x;
    pointer.y = p.y;
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  // changedTouches: 이번 이벤트에서 끝난 터치만
  for (const t of e.changedTouches) {
    touchUp(t.identifier);
  }
  // 모든 터치가 끝났으면 pointer 리셋
  if (e.touches.length === 0) {
    pointer.down = false;
    pointer.dx = 0;
    pointer.dy = 0;
  }
}, { passive: false });

canvas.addEventListener('touchcancel', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    touchUp(t.identifier);
  }
  if (e.touches.length === 0) {
    pointer.down = false;
    pointer.dx = 0;
    pointer.dy = 0;
  }
}, { passive: false });
