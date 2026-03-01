// ── 탈것 시스템 ──
import { W, state, emitSound, FIELD_TOP, FIELD_BOTTOM } from './game.js?v=20';

// ── 탈것 타입 설정 ──
export const VEHICLE_TYPES = {
  bicycle:    { speed: 400, noise: 0,   fuelMax: Infinity, cargo: 1,  hitDmg: 1, color: '#88bbff', size: 12 },
  motorcycle: { speed: 600, noise: 320, fuelMax: 50,       cargo: 3,  hitDmg: 3, color: '#dd8844', size: 16 },
  car:        { speed: 800, noise: 480, fuelMax: 100,      cargo: 8,  hitDmg: 5, color: '#aaaacc', size: 24 },
  truck:      { speed: 500, noise: 480, fuelMax: 150,      cargo: 20, hitDmg: 8, color: '#889966', size: 32 },
};

// 스폰 가중치
const SPAWN_WEIGHTS = [
  { type: 'bicycle',    weight: 30 },
  { type: 'motorcycle', weight: 25 },
  { type: 'car',        weight: 25 },
  { type: 'truck',      weight: 15 },
];
const TOTAL_WEIGHT = SPAWN_WEIGHTS.reduce((s, v) => s + v.weight, 0);

function pickVehicleType(rng) {
  let r = rng() * TOTAL_WEIGHT;
  for (const v of SPAWN_WEIGHTS) {
    r -= v.weight;
    if (r <= 0) return v.type;
  }
  return 'bicycle';
}

// ── 탈것 생성 (world.js에서 호출) ──
export function spawnChunkVehicles(rng, buildings) {
  const vehicles = [];
  // 0~2대 스폰
  const count = rng() < 0.15 ? 0 : rng() < 0.5 ? 1 : 2;

  for (let i = 0; i < count; i++) {
    const type = pickVehicleType(rng);
    const cfg = VEHICLE_TYPES[type];
    // 건물과 겹치지 않는 위치
    let x, y, overlaps;
    let attempts = 0;
    do {
      x = 30 + Math.floor(rng() * (W - 60));
      y = FIELD_TOP + 30 + Math.floor(rng() * (FIELD_BOTTOM - FIELD_TOP - 60));
      overlaps = false;
      for (const b of buildings) {
        if (x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 20 && y < b.y + b.h + 20) {
          overlaps = true; break;
        }
      }
      attempts++;
    } while (overlaps && attempts < 20);

    if (!overlaps) {
      vehicles.push({
        type,
        x, y,
        fuel: cfg.fuelMax === Infinity ? Infinity : cfg.fuelMax * (0.3 + rng() * 0.7),
        fuelMax: cfg.fuelMax,
        broken: false,
      });
    }
  }
  return vehicles;
}

// ── 탈것 업데이트 ──
export function updateVehicles(dt) {
  if (!state.riding) return;
  const v = state.riding;
  const cfg = VEHICLE_TYPES[v.type];

  // 탑승 중 위치 동기화
  v.x = state.player.x;
  v.y = state.player.y;

  // 연료 소모 (이동 중일 때만)
  if (state.player.moving && cfg.fuelMax !== Infinity) {
    v.fuel -= (cfg.speed / 200) * dt;
    if (v.fuel <= 0) {
      v.fuel = 0;
      // 연료 소진 → 강제 하차
      state.riding = null;
    }
  }

  // 이동 소음
  if (state.player.moving && cfg.noise > 0) {
    emitSound(v.x, v.y, cfg.noise, 0.3, 'vehicle');
  }
}

// ── 탈것-좀비 충돌 ──
export function checkVehicleCollisions() {
  if (!state.riding || !state.player.moving) return;
  const v = state.riding;
  const cfg = VEHICLE_TYPES[v.type];
  const hitSize = cfg.size + 5;

  for (const z of state.zombies) {
    if (!z.alive) continue;
    const dx = z.x - v.x;
    const dy = z.y - v.y;
    const dist = Math.hypot(dx, dy);
    if (dist < hitSize + (z.size || 12)) {
      z.hp -= cfg.hitDmg;
      // 밀어내기
      if (dist > 0) {
        z.x += (dx / dist) * 40;
        z.y += (dy / dist) * 40;
      }
      if (z.hp <= 0) {
        z.alive = false;
        state.score += 5;
      }
    }
  }
}

// ── 탑승/하차 ──
export function boardVehicle(vehicle) {
  state.riding = vehicle;
}

export function dismountVehicle() {
  if (!state.riding) return;
  state.riding = null;
}

// ── 가장 가까운 탈것 찾기 ──
export function getNearbyVehicle(x, y, maxDist = 35) {
  let best = null;
  let bestDist = maxDist;
  for (const v of state.vehicles) {
    if (v.broken && v.fuel <= 0) continue;
    const d = Math.hypot(v.x - x, v.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = v;
    }
  }
  return best;
}

// ── 탈것 렌더링 ──
export function drawVehicles(ctx) {
  for (const v of state.vehicles) {
    // 탑승 중인 탈것은 플레이어 위치에서 그림
    const isRiding = state.riding === v;
    const x = isRiding ? state.player.x : v.x;
    const y = isRiding ? state.player.y : v.y;
    const cfg = VEHICLE_TYPES[v.type];

    ctx.save();

    // 탑승 중이면 글로우
    if (isRiding) {
      ctx.shadowColor = cfg.color;
      ctx.shadowBlur = 8;
    }

    ctx.fillStyle = cfg.color;
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1.5;

    switch (v.type) {
      case 'bicycle': {
        // 두 바퀴
        ctx.beginPath();
        ctx.arc(x - 8, y, 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + 8, y, 6, 0, Math.PI * 2);
        ctx.stroke();
        // 프레임
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 8, y);
        ctx.lineTo(x, y - 6);
        ctx.lineTo(x + 8, y);
        ctx.stroke();
        // 핸들
        ctx.beginPath();
        ctx.moveTo(x - 2, y - 8);
        ctx.lineTo(x + 2, y - 8);
        ctx.stroke();
        break;
      }
      case 'motorcycle': {
        // 몸체
        ctx.beginPath();
        ctx.ellipse(x, y, 14, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // 바퀴
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(x - 10, y + 4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 10, y + 4, 5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'car': {
        // 차체
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - 14, y - 10, 28, 20, 4);
        else ctx.rect(x - 14, y - 10, 28, 20);
        ctx.fill();
        ctx.stroke();
        // 창문
        ctx.fillStyle = 'rgba(150,200,255,0.4)';
        ctx.fillRect(x - 8, y - 8, 16, 6);
        // 바퀴
        ctx.fillStyle = '#333';
        ctx.fillRect(x - 16, y - 6, 4, 5);
        ctx.fillRect(x + 12, y - 6, 4, 5);
        ctx.fillRect(x - 16, y + 3, 4, 5);
        ctx.fillRect(x + 12, y + 3, 4, 5);
        break;
      }
      case 'truck': {
        // 캐빈
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - 10, y - 14, 20, 14, 3);
        else ctx.rect(x - 10, y - 14, 20, 14);
        ctx.fill();
        ctx.stroke();
        // 화물칸
        ctx.fillStyle = '#667755';
        ctx.fillRect(x - 14, y, 28, 16);
        ctx.strokeRect(x - 14, y, 28, 16);
        // 바퀴
        ctx.fillStyle = '#333';
        ctx.fillRect(x - 16, y - 8, 4, 5);
        ctx.fillRect(x + 12, y - 8, 4, 5);
        ctx.fillRect(x - 16, y + 6, 4, 5);
        ctx.fillRect(x + 12, y + 6, 4, 5);
        ctx.fillRect(x - 16, y + 12, 4, 5);
        ctx.fillRect(x + 12, y + 12, 4, 5);
        break;
      }
    }

    ctx.restore();

    // 연료 바 (탑승 중이 아닌 경우 표시)
    if (!isRiding && cfg.fuelMax !== Infinity) {
      const barW = 24;
      const fuelRatio = v.fuel / cfg.fuelMax;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x - barW / 2, y - cfg.size - 6, barW, 3);
      ctx.fillStyle = fuelRatio > 0.3 ? '#44cc44' : '#cc4444';
      ctx.fillRect(x - barW / 2, y - cfg.size - 6, barW * fuelRatio, 3);
    }
  }
}

// ── 하차 버튼 ──
const DISMOUNT_BTN = { x: W / 2 - 50, y: FIELD_BOTTOM + 10, w: 100, h: 30 };

export function drawDismountButton(ctx) {
  if (!state.riding) return;
  ctx.fillStyle = '#884444';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(DISMOUNT_BTN.x, DISMOUNT_BTN.y, DISMOUNT_BTN.w, DISMOUNT_BTN.h, 6);
  else ctx.rect(DISMOUNT_BTN.x, DISMOUNT_BTN.y, DISMOUNT_BTN.w, DISMOUNT_BTN.h);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('DISMOUNT', W / 2, DISMOUNT_BTN.y + 20);
}

export function initVehicleUI() {
  // 하차 버튼은 player.js에서 처리 (탑승 탭 통합)
}

export { DISMOUNT_BTN };
