// ── 에이밍 시스템 ──
import { state, W, RANGE_TOP, RANGE_BOTTOM } from './game.js';
import { registerZone } from './input.js';

const AIM_SPEED = 0.005;
const AIM_MAX = 1;

export function initAiming() {
  registerZone(
    { x: 0, y: RANGE_TOP, w: W, h: RANGE_BOTTOM - RANGE_TOP },
    {
      onMove(x, y, totalDx, totalDy) {
        // pointer.dx 기반이 아니라 매 프레임 이동량 사용
      },
      onStart() {},
      onEnd() {},
    },
    0 // 낮은 우선순위 (아이템 줍기보다 뒤에)
  );
}

// main.js의 update에서 매 프레임 호출
export function updateAiming(dx, dy) {
  state.aimX = Math.max(-AIM_MAX, Math.min(AIM_MAX, state.aimX + dx * AIM_SPEED));
  state.aimY = Math.max(-AIM_MAX, Math.min(AIM_MAX, state.aimY + dy * AIM_SPEED));
}
