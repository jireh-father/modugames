// ── Web Audio 사운드 합성 ──
let actx = null;

function ensureCtx() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

// 터치 시 AudioContext 활성화
document.addEventListener('touchstart', ensureCtx, { once: true });
document.addEventListener('mousedown', ensureCtx, { once: true });

function noise(duration, volume = 0.3, filterFreq = 3000) {
  const ctx = ensureCtx();
  const len = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * volume;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();
}

function tone(freq, duration, type = 'sine', volume = 0.2) {
  const ctx = ensureCtx();
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function sweep(startFreq, endFreq, duration, type = 'sine', volume = 0.2) {
  const ctx = ensureCtx();
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

// ── 권총 사운드 ──
export function playGunshot() {
  noise(0.15, 0.5, 2000);
  tone(150, 0.08, 'square', 0.3);
  // 총구 반동 저음
  tone(60, 0.12, 'sine', 0.25);
}

export function playSlideRack() {
  noise(0.06, 0.2, 4000);
  tone(800, 0.04, 'square', 0.15);
  setTimeout(() => {
    noise(0.04, 0.15, 3000);
    tone(600, 0.03, 'square', 0.12);
  }, 40);
}

export function playMagOut() {
  tone(500, 0.03, 'square', 0.1);
  noise(0.05, 0.1, 2000);
  setTimeout(() => tone(300, 0.04, 'square', 0.08), 30);
}

export function playMagIn() {
  tone(700, 0.04, 'square', 0.15);
  setTimeout(() => {
    tone(900, 0.02, 'square', 0.1);
    noise(0.03, 0.12, 3000);
  }, 30);
}

export function playBulletLoad() {
  tone(1200, 0.02, 'sine', 0.1);
  tone(800, 0.03, 'triangle', 0.06);
}

// ── 활 사운드 ──
export function playBowDraw() {
  sweep(200, 400, 0.3, 'sawtooth', 0.08);
  // 나무 삐걱이는 소리
  sweep(100, 150, 0.3, 'triangle', 0.04);
}

export function playBowRelease() {
  sweep(500, 150, 0.15, 'triangle', 0.2);
  noise(0.05, 0.15, 5000);
  // 시위 진동
  tone(80, 0.2, 'sine', 0.1);
}

export function playArrowPick() {
  sweep(800, 1200, 0.08, 'sine', 0.08);
}

export function playArrowNock() {
  tone(1000, 0.03, 'sine', 0.1);
  setTimeout(() => tone(1200, 0.02, 'sine', 0.06), 20);
}

// ── 화살 폭발 ──
export function playExplosion() {
  noise(0.4, 0.6, 1200);
  tone(60, 0.3, 'sine', 0.4);
  tone(40, 0.4, 'square', 0.2);
  setTimeout(() => noise(0.3, 0.3, 600), 50);
  setTimeout(() => tone(30, 0.3, 'sine', 0.15), 100);
}

// ── 타겟/장애물 사운드 ──
export function playTargetHit() {
  noise(0.08, 0.3, 1500);
  tone(300, 0.1, 'triangle', 0.15);
  tone(600, 0.06, 'sine', 0.08);
}

export function playWallHit() {
  noise(0.1, 0.25, 800);
  tone(120, 0.08, 'square', 0.15);
}

export function playWallBreak() {
  noise(0.3, 0.5, 1000);
  tone(80, 0.2, 'square', 0.3);
  setTimeout(() => {
    noise(0.2, 0.3, 600);
    tone(50, 0.15, 'sine', 0.2);
  }, 60);
  setTimeout(() => noise(0.15, 0.15, 400), 150);
}

export function playBulletMiss() {
  // 빗나감 쇳소리
  sweep(2000, 800, 0.08, 'sine', 0.06);
}

// ── 보급/아이템 사운드 ──
export function playSupplyDrop() {
  noise(0.5, 0.08, 800);
  sweep(300, 150, 0.3, 'triangle', 0.06);
}

export function playItemDrop() {
  tone(500, 0.04, 'sine', 0.08);
  setTimeout(() => tone(400, 0.06, 'triangle', 0.06), 40);
}

export function playItemPickup() {
  tone(600, 0.05, 'sine', 0.15);
  setTimeout(() => tone(900, 0.05, 'sine', 0.15), 60);
  setTimeout(() => tone(1200, 0.04, 'sine', 0.1), 120);
}

// ── 콤보/점수 사운드 ──
export function playCombo(count) {
  const base = 400 + count * 80;
  tone(base, 0.1, 'sine', 0.15);
  setTimeout(() => tone(base * 1.5, 0.1, 'sine', 0.15), 80);
  if (count >= 5) {
    setTimeout(() => tone(base * 2, 0.08, 'sine', 0.1), 160);
  }
}

// ── 웨이브 사운드 ──
export function playWaveStart() {
  tone(400, 0.1, 'sine', 0.12);
  setTimeout(() => tone(500, 0.1, 'sine', 0.12), 100);
  setTimeout(() => tone(700, 0.15, 'sine', 0.15), 200);
}

export function playWaveClear() {
  tone(600, 0.1, 'sine', 0.15);
  setTimeout(() => tone(800, 0.1, 'sine', 0.15), 80);
  setTimeout(() => tone(1000, 0.1, 'sine', 0.18), 160);
  setTimeout(() => tone(1200, 0.15, 'sine', 0.2), 240);
}

// ── 게임 상태 사운드 ──
export function playGameOver() {
  sweep(400, 100, 0.5, 'sawtooth', 0.2);
  setTimeout(() => sweep(300, 80, 0.4, 'sawtooth', 0.15), 200);
  setTimeout(() => tone(60, 0.5, 'sine', 0.2), 400);
}

export function playStart() {
  tone(500, 0.1, 'sine', 0.15);
  setTimeout(() => tone(700, 0.1, 'sine', 0.15), 100);
  setTimeout(() => tone(1000, 0.15, 'sine', 0.2), 200);
}

export function playNewRecord() {
  tone(800, 0.1, 'sine', 0.2);
  setTimeout(() => tone(1000, 0.1, 'sine', 0.2), 100);
  setTimeout(() => tone(1200, 0.1, 'sine', 0.22), 200);
  setTimeout(() => tone(1600, 0.2, 'sine', 0.25), 300);
  setTimeout(() => {
    tone(1200, 0.15, 'sine', 0.15);
    tone(1600, 0.15, 'sine', 0.15);
  }, 450);
}

export function playSlowMo() {
  sweep(800, 200, 0.4, 'sawtooth', 0.12);
  tone(100, 0.5, 'sine', 0.15);
  setTimeout(() => sweep(600, 150, 0.3, 'triangle', 0.08), 100);
}

// ── 저격총 사운드 ──
export function playSniperShot() {
  noise(0.25, 0.6, 1500);
  tone(100, 0.15, 'square', 0.4);
  tone(40, 0.2, 'sine', 0.35);
  setTimeout(() => noise(0.2, 0.2, 800), 50);
  // 에코
  setTimeout(() => noise(0.15, 0.12, 600), 150);
  setTimeout(() => noise(0.1, 0.06, 400), 300);
}

export function playSniperBoltUp() {
  noise(0.04, 0.15, 3500);
  tone(600, 0.03, 'square', 0.12);
}

export function playSniperBoltDown() {
  noise(0.05, 0.18, 3000);
  tone(500, 0.04, 'square', 0.15);
  setTimeout(() => tone(700, 0.02, 'square', 0.08), 30);
}

export function playSniperLoad() {
  tone(900, 0.03, 'sine', 0.1);
  setTimeout(() => tone(1100, 0.02, 'sine', 0.08), 25);
}

export function playScopeZoom() {
  sweep(300, 600, 0.15, 'sine', 0.06);
}

// ── 기관총 사운드 ──
export function playMGShot() {
  noise(0.06, 0.35, 2500);
  tone(120, 0.05, 'square', 0.25);
  tone(50, 0.06, 'sine', 0.15);
}

export function playMGBurstEnd() {
  noise(0.1, 0.1, 1000);
  tone(80, 0.08, 'sine', 0.08);
}

export function playMGCock() {
  noise(0.08, 0.2, 3000);
  tone(400, 0.04, 'square', 0.12);
  setTimeout(() => {
    noise(0.06, 0.15, 2500);
    tone(350, 0.03, 'square', 0.1);
  }, 50);
}

export function playMGOverheat() {
  sweep(800, 200, 0.4, 'sawtooth', 0.1);
  noise(0.3, 0.15, 600);
}

export function playMGCooldown() {
  sweep(200, 500, 0.2, 'sine', 0.06);
  noise(0.2, 0.08, 400);
}

// ── 크로스보우 사운드 ──
export function playCrossbowShoot() {
  sweep(400, 100, 0.12, 'triangle', 0.2);
  noise(0.08, 0.2, 4000);
  tone(60, 0.15, 'sine', 0.12);
}

export function playCrossbowCrank() {
  // 크랭크 감기 - 톱니 소리
  tone(200, 0.04, 'sawtooth', 0.08);
  setTimeout(() => tone(220, 0.04, 'sawtooth', 0.08), 50);
  setTimeout(() => tone(240, 0.04, 'sawtooth', 0.08), 100);
}

export function playCrossbowLoad() {
  tone(800, 0.03, 'sine', 0.1);
  noise(0.03, 0.08, 3000);
  setTimeout(() => tone(1000, 0.02, 'sine', 0.06), 20);
}

// ── UI 사운드 ──
export function playUIClick() {
  tone(800, 0.03, 'square', 0.1);
}

export function playUIPause() {
  sweep(600, 300, 0.1, 'sine', 0.12);
}

export function playUIResume() {
  sweep(300, 600, 0.1, 'sine', 0.12);
}

export function playWeaponSwitch() {
  tone(500, 0.03, 'triangle', 0.1);
  setTimeout(() => tone(700, 0.03, 'triangle', 0.1), 30);
}

// ── 좀비 사운드 ──
export function playZombieGroan() {
  // 낮은 주파수 톱니파 스윕: 80→60 Hz, 0.5초, 낮은 음량
  sweep(80, 60, 0.5, 'sawtooth', 0.08);
}

export function playZombieHit() {
  // 짧은 노이즈 버스트: 0.05초, 밴드패스 필터 800Hz
  noise(0.05, 0.25, 800);
}

export function playZombieDeath() {
  // 하강 톤: 200→50 Hz 사인파, 0.3초, 빠른 페이드
  sweep(200, 50, 0.3, 'sine', 0.2);
}

export function playTowerHit() {
  // 금속 쨍 소리: 800Hz 사인파 + 빠른 감쇠, 0.15초
  tone(800, 0.15, 'sine', 0.25);
  tone(1200, 0.08, 'triangle', 0.1);
}

export function playMineExplosion() {
  // 폭발: 노이즈 + 사인파 스윕 200→50, 0.5초, 큰 음량
  noise(0.5, 0.6, 1500);
  sweep(200, 50, 0.5, 'sine', 0.4);
  tone(40, 0.4, 'square', 0.3);
  setTimeout(() => noise(0.3, 0.3, 600), 80);
}

export function playDayComplete() {
  // 승리 징글: C5, E5, G5 3음 상승, 각 0.15초
  tone(523, 0.15, 'sine', 0.18);                    // C5
  setTimeout(() => tone(659, 0.15, 'sine', 0.18), 150); // E5
  setTimeout(() => tone(784, 0.2, 'sine', 0.22), 300);  // G5
}
