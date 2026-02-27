// ── 입력 시스템: 터치/마우스 드래그를 통합 관리 ──
import { W, H, state } from './game.js?v=7';

const canvas = document.getElementById('c');

// 현재 포인터 상태
export const pointer = {
  down: false,
  x: 0, y: 0,        // 현재 위치 (캔버스 좌표)
  startX: 0, startY: 0, // 드래그 시작 위치
  dx: 0, dy: 0,       // 프레임간 이동량
  dragDx: 0, dragDy: 0, // 드래그 시작부터 총 이동량
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
  handlers.push({ zone, callbacks, priority, active: false });
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

// 이벤트 핸들링
let activeHandler = null;

function onDown(cx, cy) {
  pointer.down = true;
  pointer.x = cx; pointer.y = cy;
  pointer.startX = cx; pointer.startY = cy;
  pointer.dx = 0; pointer.dy = 0;
  pointer.dragDx = 0; pointer.dragDy = 0;

  activeHandler = null;
  for (const h of handlers) {
    // 타이틀/게임오버 화면에서는 음수 우선순위(화면 전환) 핸들러만 허용
    if (state.screen !== 'playing' && h.priority >= 0) continue;
    if (inZone(cx, cy, h.zone)) {
      // onStart가 false를 반환하면 이 핸들러를 건너뛰고 다음 핸들러 시도
      if (h.callbacks.onStart) {
        const result = h.callbacks.onStart(cx, cy);
        if (result === false) continue;
      }
      activeHandler = h;
      h.active = true;
      break;
    }
  }
}

function onMove(cx, cy) {
  pointer.dx = cx - pointer.x;
  pointer.dy = cy - pointer.y;
  pointer.x = cx;
  pointer.y = cy;
  pointer.dragDx = cx - pointer.startX;
  pointer.dragDy = cy - pointer.startY;

  if (activeHandler && activeHandler.callbacks.onMove) {
    activeHandler.callbacks.onMove(cx, cy, pointer.dragDx, pointer.dragDy);
  }
}

function onUp(cx, cy) {
  const wasDrag = Math.abs(pointer.dragDx) > 5 || Math.abs(pointer.dragDy) > 5;

  if (activeHandler) {
    if (activeHandler.callbacks.onEnd) {
      activeHandler.callbacks.onEnd(cx, cy, pointer.dragDx, pointer.dragDy);
    }
    if (!wasDrag && activeHandler.callbacks.onTap) {
      activeHandler.callbacks.onTap(cx, cy);
    }
    activeHandler.active = false;
    activeHandler = null;
  }

  pointer.down = false;
  pointer.dx = 0;
  pointer.dy = 0;
}

// 마우스 이벤트
canvas.addEventListener('mousedown', e => {
  const p = toCanvas(e.clientX, e.clientY);
  onDown(p.x, p.y);
});
canvas.addEventListener('mousemove', e => {
  const p = toCanvas(e.clientX, e.clientY);
  onMove(p.x, p.y);
});
canvas.addEventListener('mouseup', e => {
  const p = toCanvas(e.clientX, e.clientY);
  onUp(p.x, p.y);
});

// 터치 이벤트
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.touches[0];
  const p = toCanvas(t.clientX, t.clientY);
  onDown(p.x, p.y);
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const t = e.touches[0];
  const p = toCanvas(t.clientX, t.clientY);
  onMove(p.x, p.y);
}, { passive: false });
canvas.addEventListener('touchend', e => {
  e.preventDefault();
  const p = { x: pointer.x, y: pointer.y };
  onUp(p.x, p.y);
}, { passive: false });
