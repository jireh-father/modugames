// ── 자이로/가속도 센서 조준 시스템 ──
// 기존 조이스틱과 병행 사용. 폰 기울기 방향+속도에 비례해 조준점 이동.
import { state } from './game.js';

const GYRO_SENS = 0.0015; // 회전 속도 → 조준 이동 감도
let enabled = false;
let supported = false;
let permissionDenied = false;

/**
 * 자이로 초기화: iOS 권한 요청 포함
 * 타이틀/게임오버 화면에서 사용자 터치 후 호출
 */
export async function requestGyro() {
  if (enabled || permissionDenied) return;

  // iOS 13+ 권한 요청 필요
  if (typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const perm = await DeviceMotionEvent.requestPermission();
      if (perm !== 'granted') {
        permissionDenied = true;
        return;
      }
    } catch (e) {
      permissionDenied = true;
      return;
    }
  }

  if (typeof DeviceMotionEvent === 'undefined') return;

  window.addEventListener('devicemotion', onDeviceMotion);
  enabled = true;
  supported = true;
}

function onDeviceMotion(e) {
  const rate = e.rotationRate;
  if (!rate) return;

  // rotationRate (deg/s):
  //   gamma = 좌우 회전 → aimX
  //   beta  = 상하 회전 → aimY
  const gx = rate.gamma || 0; // deg/s 좌우
  const gy = rate.beta || 0;  // deg/s 상하

  state.aimX = Math.max(-1, Math.min(1, state.aimX - gx * GYRO_SENS));
  state.aimY = Math.max(-1, Math.min(1, state.aimY + gy * GYRO_SENS));
}

export function isGyroEnabled() { return enabled; }
export function isGyroSupported() { return supported || typeof DeviceMotionEvent !== 'undefined'; }
