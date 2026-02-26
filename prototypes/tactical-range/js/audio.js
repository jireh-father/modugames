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

// ── 사운드 이펙트 ──
export function playGunshot() {
  noise(0.15, 0.5, 2000);
  tone(150, 0.08, 'square', 0.3);
}

export function playSlideRack() {
  tone(800, 0.04, 'square', 0.15);
  setTimeout(() => tone(600, 0.03, 'square', 0.12), 40);
}

export function playMagOut() {
  tone(500, 0.03, 'square', 0.1);
}

export function playMagIn() {
  tone(700, 0.04, 'square', 0.15);
  setTimeout(() => tone(900, 0.02, 'square', 0.1), 30);
}

export function playBulletLoad() {
  tone(1200, 0.02, 'sine', 0.1);
}

export function playBowDraw() {
  sweep(200, 400, 0.3, 'sawtooth', 0.08);
}

export function playBowRelease() {
  sweep(500, 150, 0.15, 'triangle', 0.2);
  noise(0.05, 0.1, 5000);
}

export function playArrowPick() {
  sweep(800, 1200, 0.08, 'sine', 0.08);
}

export function playArrowNock() {
  tone(1000, 0.03, 'sine', 0.1);
}

export function playTargetHit() {
  noise(0.08, 0.3, 1500);
  tone(300, 0.1, 'triangle', 0.15);
}

export function playSupplyDrop() {
  noise(0.5, 0.05, 800);
}

export function playItemPickup() {
  tone(600, 0.05, 'sine', 0.15);
  setTimeout(() => tone(900, 0.05, 'sine', 0.15), 60);
}

export function playCombo(count) {
  const base = 400 + count * 80;
  tone(base, 0.1, 'sine', 0.15);
  setTimeout(() => tone(base * 1.5, 0.1, 'sine', 0.15), 80);
}

export function playGameOver() {
  sweep(400, 100, 0.5, 'sawtooth', 0.2);
}

export function playStart() {
  tone(500, 0.1, 'sine', 0.15);
  setTimeout(() => tone(700, 0.1, 'sine', 0.15), 100);
  setTimeout(() => tone(1000, 0.15, 'sine', 0.2), 200);
}
