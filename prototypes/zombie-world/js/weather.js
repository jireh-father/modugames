// ── 날씨 시스템 ──
import { W, H, state, FIELD_TOP, FIELD_BOTTOM } from './game.js?v=31';

// ── 날씨 타입 ──
const WEATHER_TYPES = ['clear', 'rain', 'fog', 'storm'];
const WEATHER_WEIGHTS = [40, 30, 20, 10];
const TOTAL_WEIGHT = WEATHER_WEIGHTS.reduce((s, w) => s + w, 0);

// ── 빗방울 파티클 풀 ──
const MAX_DROPS = 120;
const rainDrops = [];
for (let i = 0; i < MAX_DROPS; i++) {
  rainDrops.push({ x: 0, y: 0, len: 0, speed: 0, active: false });
}

// ── 번개 플래시 ──
let flashAlpha = 0;
let flashTimer = 0;

// ── 날씨 결정 (5x5 블록 단위, 600초 주기) ──
export function getWeather(cx, cy, worldTime) {
  const blockX = Math.floor(cx / 5);
  const blockY = Math.floor(cy / 5);
  const period = Math.floor(worldTime / 600);
  let seed = ((blockX * 73856 + blockY * 19349 + period * 8191) & 0x7fffffff) || 1;

  // 간단한 LCG
  seed = (seed * 16807) % 2147483647;
  const roll = (seed & 0x7fffffff) / 2147483647 * TOTAL_WEIGHT;

  let acc = 0;
  for (let i = 0; i < WEATHER_TYPES.length; i++) {
    acc += WEATHER_WEIGHTS[i];
    if (roll <= acc) return WEATHER_TYPES[i];
  }
  return 'clear';
}

// ── 날씨 효과 배율 ──
export function getWeatherEffects(weather) {
  switch (weather) {
    case 'rain':  return { visibility: 0.7, moveMul: 0.9, fireFuelMul: 2,        soundMul: 0.5, bowAccMul: 1.0 };
    case 'fog':   return { visibility: 0.4, moveMul: 1.0, fireFuelMul: 1,        soundMul: 1.0, bowAccMul: 1.0 };
    case 'storm': return { visibility: 0.5, moveMul: 0.8, fireFuelMul: Infinity, soundMul: 1.3, bowAccMul: 0.7 };
    default:      return { visibility: 1.0, moveMul: 1.0, fireFuelMul: 1,        soundMul: 1.0, bowAccMul: 1.0 };
  }
}

// ── 날씨 업데이트 ──
export function updateWeather(dt, cx, cy, worldTime) {
  const newWeather = getWeather(cx, cy, worldTime);
  if (newWeather !== state.currentWeather) {
    state.currentWeather = newWeather;
    // 빗방울 초기화
    if (newWeather === 'rain' || newWeather === 'storm') {
      initRainDrops();
    }
  }

  // 비/폭풍 빗방울 업데이트
  if (state.currentWeather === 'rain' || state.currentWeather === 'storm') {
    updateRainDrops(dt);
  }

  // 폭풍 번개 플래시
  if (state.currentWeather === 'storm') {
    flashTimer -= dt;
    if (flashTimer <= 0) {
      flashTimer = 3 + Math.random() * 7; // 3~10초마다
      flashAlpha = 0.6 + Math.random() * 0.3;
    }
    if (flashAlpha > 0) {
      flashAlpha -= dt * 2;
      if (flashAlpha < 0) flashAlpha = 0;
    }
  }
}

// ── 빗방울 초기화 ──
function initRainDrops() {
  for (const d of rainDrops) {
    resetDrop(d);
    d.y = FIELD_TOP + Math.random() * (FIELD_BOTTOM - FIELD_TOP); // 초기 위치 분산
  }
}

function resetDrop(d) {
  d.x = Math.random() * W;
  d.y = FIELD_TOP - Math.random() * 40;
  d.len = 8 + Math.random() * 12;
  d.speed = 400 + Math.random() * 300;
  d.active = true;
}

function updateRainDrops(dt) {
  const windX = state.currentWeather === 'storm' ? 150 : 50;
  for (const d of rainDrops) {
    if (!d.active) { resetDrop(d); continue; }
    d.y += d.speed * dt;
    d.x += windX * dt;
    if (d.y > FIELD_BOTTOM + 10 || d.x > W + 20) {
      resetDrop(d);
    }
  }
}

// ── 날씨 렌더링 ──
export function drawWeatherOverlay(ctx) {
  const weather = state.currentWeather;
  if (!weather || weather === 'clear') return;

  ctx.save();

  if (weather === 'rain' || weather === 'storm') {
    // 빗방울
    ctx.strokeStyle = weather === 'storm' ? 'rgba(180,200,220,0.35)' : 'rgba(150,180,220,0.25)';
    ctx.lineWidth = 1;
    for (const d of rainDrops) {
      if (!d.active) continue;
      const windAngle = weather === 'storm' ? 0.3 : 0.1;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.len * windAngle, d.y + d.len);
      ctx.stroke();
    }

    // 바닥 습기 효과
    ctx.fillStyle = 'rgba(100,120,140,0.08)';
    ctx.fillRect(0, FIELD_TOP, W, FIELD_BOTTOM - FIELD_TOP);
  }

  if (weather === 'fog') {
    // 안개: 가장자리 진하게, 중앙 약하게
    const gradient = ctx.createRadialGradient(W / 2, (FIELD_TOP + FIELD_BOTTOM) / 2, 50,
                                               W / 2, (FIELD_TOP + FIELD_BOTTOM) / 2, 350);
    gradient.addColorStop(0, 'rgba(180,180,180,0.05)');
    gradient.addColorStop(0.5, 'rgba(150,150,160,0.15)');
    gradient.addColorStop(1, 'rgba(120,120,130,0.35)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, FIELD_TOP, W, FIELD_BOTTOM - FIELD_TOP);
  }

  if (weather === 'storm') {
    // 번개 플래시
    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(255,255,240,${flashAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }

    // 어두운 오버레이
    ctx.fillStyle = 'rgba(0,0,20,0.12)';
    ctx.fillRect(0, FIELD_TOP, W, FIELD_BOTTOM - FIELD_TOP);
  }

  ctx.restore();
}

// ── 날씨 아이콘 텍스트 ──
export function getWeatherIcon(weather) {
  switch (weather) {
    case 'rain':  return '\uD83C\uDF27'; // 🌧
    case 'fog':   return '\uD83C\uDF2B'; // 🌫
    case 'storm': return '\u26A1'; // ⚡
    default:      return '';
  }
}
