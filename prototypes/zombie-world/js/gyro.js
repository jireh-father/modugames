// ── 자이로 조준 시스템 ──
// DeviceOrientation 기반: 폰 기울기 각도 변화에 따라 조준점 이동
import { state } from './game.js?v=31';
import { settings } from './settings.js?v=31';

let enabled = false;
let supported = false;
let permissionDenied = false;

// 이전 프레임 각도 (델타 계산용)
let lastGamma = null; // 좌우 기울기 (-90~90)
let lastBeta = null;  // 앞뒤 기울기 (-180~180)

/**
 * 자이로 초기화: iOS 권한 요청 포함
 */
export async function requestGyro() {
  if (enabled || permissionDenied) return;

  // iOS 13+ 권한 요청
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const perm = await DeviceOrientationEvent.requestPermission();
      if (perm !== 'granted') {
        permissionDenied = true;
        return;
      }
    } catch (e) {
      permissionDenied = true;
      return;
    }
  }

  if (typeof DeviceOrientationEvent === 'undefined') return;

  window.addEventListener('deviceorientation', onOrientation);
  enabled = true;
  supported = true;
}

function onOrientation(e) {
  const gamma = e.gamma; // 좌우 기울기: 오른쪽 기울임 = 양수
  const beta = e.beta;   // 앞뒤 기울기: 위쪽(앞으로) 기울임 = 양수

  if (gamma === null || beta === null) return;

  if (lastGamma !== null && lastBeta !== null) {
    // 설정에서 자이로 꺼져 있으면 무시
    if (!settings.gyroOn) { lastGamma = gamma; lastBeta = beta; return; }

    let dGamma = gamma - lastGamma;
    let dBeta = beta - lastBeta;

    // 급격한 점프 무시 (기기 회전 등)
    if (Math.abs(dGamma) > 30) dGamma = 0;
    if (Math.abs(dBeta) > 30) dBeta = 0;

    // 기울기 반전: 오른쪽 기울기 → 조준 각도 감소 (오른쪽), 왼쪽 기울기 → 증가 (왼쪽)
    state.aimAngle += dGamma * settings.gyroSens * 0.02;
    while (state.aimAngle < 0) state.aimAngle += Math.PI * 2;
    while (state.aimAngle >= Math.PI * 2) state.aimAngle -= Math.PI * 2;
  }

  lastGamma = gamma;
  lastBeta = beta;
}

/** 게임 리셋 시 기준점 초기화 */
export function resetGyroRef() {
  lastGamma = null;
  lastBeta = null;
}

export function isGyroEnabled() { return enabled; }
export function isGyroSupported() { return supported || typeof DeviceOrientationEvent !== 'undefined'; }
