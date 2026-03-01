// ── 피로 & 수면 시스템 ──
import { state } from './game.js?v=31';
import { saveGame } from './save.js?v=31';

export function updateFatigue(dt) {
  // 수면 중이면 회복
  if (state.sleeping) {
    state.sleepTimer += dt;
    state.fatigue = Math.min(state.fatigueMax,
      state.fatigue + (state.fatigueMax / state.sleepDuration) * dt);
    if (state.sleepTimer >= state.sleepDuration) {
      state.sleeping = false;
      state.sleepTimer = 0;
      // 수면 완료 시 자동 저장
      saveGame();
    }
    return;
  }

  // 피로 감소
  state.fatigue -= state.fatigueRate * dt;
  if (state.fatigue < 0) state.fatigue = 0;

  // 피로 0이면 강제 수면
  if (state.fatigue <= 0 && !state.sleeping) {
    startSleep(30, 'forced');
  }
}

export function startSleep(duration, type) {
  state.sleeping = true;
  state.sleepTimer = 0;
  state.sleepDuration = duration;
  state.sleepType = type || 'normal';
}

export function getFatigueSpeedMul() {
  if (state.fatigue <= 25) return 0.6;
  if (state.fatigue <= 50) return 0.8;
  return 1.0;
}

export function getAimWobble() {
  if (state.fatigue <= 25) return 0.08;
  return 0;
}
