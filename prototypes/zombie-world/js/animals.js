// ── 동물 시스템 (배고픔 + 사냥) ──
import { W, state, FIELD_TOP, FIELD_BOTTOM, WALL_Y } from './game.js?v=311';
import { collidesWithBuilding } from './buildings.js?v=311';

const ANIMAL_TYPES = {
  chicken: { color: '#ffcc66', size: 12, speed: 40,  fleeSpeed: 80,  meat: 25, bodyColor: '#ffcc66', headColor: '#ff8844' },
  rabbit:  { color: '#cc9966', size: 11, speed: 25,  fleeSpeed: 60,  meat: 30, bodyColor: '#cc9966', headColor: '#ddbbaa' },
  rat:     { color: '#999999', size: 8,  speed: 50,  fleeSpeed: 100, meat: 15, bodyColor: '#888888', headColor: '#aaaaaa' },
  pigeon:  { color: '#aaaacc', size: 9,  speed: 30,  fleeSpeed: 70,  meat: 20, bodyColor: '#9999bb', headColor: '#bbbbdd' },
  frog:    { color: '#66cc66', size: 9,  speed: 15,  fleeSpeed: 35,  meat: 20, bodyColor: '#55bb55', headColor: '#77dd77' },
};

const ANIMAL_NAMES = Object.keys(ANIMAL_TYPES);
const ANIMAL_RESPAWN_INTERVAL = 30; // 30초마다 1마리 리스폰
const MAX_ANIMALS = 8;
let respawnTimer = 0;

/**
 * 동물 스폰
 */
export function spawnAnimals(count) {
  for (let i = 0; i < count; i++) {
    spawnOneAnimal();
  }
}

function spawnOneAnimal() {
  const type = ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)];
  const cfg = ANIMAL_TYPES[type];
  let x, y, attempts = 0;
  do {
    x = 30 + Math.random() * (W - 60);
    y = FIELD_TOP + 20 + Math.random() * (WALL_Y - FIELD_TOP - 60);
    attempts++;
  } while (collidesWithBuilding(x, y, cfg.size) && attempts < 20);

  state.animals.push({
    type,
    x, y,
    alive: true,
    speed: cfg.speed,
    fleeSpeed: cfg.fleeSpeed,
    size: cfg.size,
    fleeing: false,
    fleeAngle: 0,
    wanderAngle: Math.random() * Math.PI * 2,
    wanderTimer: 1 + Math.random() * 3,
  });
}

/**
 * 동물 업데이트
 */
export function updateAnimals(dt) {
  // 리스폰
  if (state.animals.length < MAX_ANIMALS) {
    respawnTimer += dt;
    if (respawnTimer >= ANIMAL_RESPAWN_INTERVAL) {
      respawnTimer = 0;
      spawnOneAnimal();
    }
  }

  const p = state.player;

  for (let i = state.animals.length - 1; i >= 0; i--) {
    const a = state.animals[i];
    if (!a.alive) { state.animals.splice(i, 1); continue; }

    const cfg = ANIMAL_TYPES[a.type];
    const distToPlayer = Math.hypot(a.x - p.x, a.y - p.y);

    // 플레이어 접근 시 도주 (100px)
    if (p.onTower < 0 && distToPlayer < 100) {
      a.fleeing = true;
      a.fleeAngle = Math.atan2(a.y - p.y, a.x - p.x);
    }

    // 플레이어 근접 시 잡힘 (25px)
    if (p.onTower < 0 && distToPlayer < 25) {
      a.alive = false;
      // 고기 아이템을 인벤토리에 직접 추가
      const existing = state.inventory.find(it => it.id === 'meat');
      if (existing) {
        existing.count++;
      } else {
        state.inventory.push({ id: 'meat', count: 1 });
      }
      continue;
    }

    // 이동
    let moveSpeed, angle;
    if (a.fleeing) {
      moveSpeed = a.fleeSpeed * dt;
      angle = a.fleeAngle;
      // 3초 후 도주 해제
      a.wanderTimer -= dt;
      if (distToPlayer > 150 || a.wanderTimer <= -3) {
        a.fleeing = false;
        a.wanderTimer = 1 + Math.random() * 3;
      }
    } else {
      moveSpeed = a.speed * dt;
      angle = a.wanderAngle;
      a.wanderTimer -= dt;
      if (a.wanderTimer <= 0) {
        a.wanderAngle = Math.random() * Math.PI * 2;
        a.wanderTimer = 2 + Math.random() * 4;
      }
    }

    let nx = a.x + Math.cos(angle) * moveSpeed;
    let ny = a.y + Math.sin(angle) * moveSpeed;

    // 경계 체크
    nx = Math.max(10, Math.min(W - 10, nx));
    ny = Math.max(FIELD_TOP + 10, Math.min(WALL_Y - 10, ny));

    // 건물 충돌
    if (!collidesWithBuilding(nx, ny, a.size)) {
      a.x = nx;
      a.y = ny;
    } else {
      a.wanderAngle = Math.random() * Math.PI * 2;
    }

    // 좀비에 의한 사망 (끌린 좀비만, 20px 이내)
    for (const z of state.zombies) {
      if (!z.alive || z.aiState === 'idle') continue;
      if (Math.hypot(a.x - z.x, a.y - z.y) < 20) {
        a.alive = false;
        break;
      }
    }
  }
}

/**
 * 동물 렌더링
 */
export function drawAnimals(ctx) {
  for (const a of state.animals) {
    if (!a.alive) continue;
    const cfg = ANIMAL_TYPES[a.type];
    const { x, y, size } = a;

    ctx.save();

    // 몸체
    ctx.fillStyle = cfg.bodyColor;
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.6, size * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 머리
    ctx.fillStyle = cfg.headColor;
    ctx.beginPath();
    ctx.arc(x + size * 0.4, y - size * 0.1, size * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // 눈
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x + size * 0.5, y - size * 0.15, 1, 0, Math.PI * 2);
    ctx.fill();

    // 다리 (간단)
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - size * 0.2, y + size * 0.3);
    ctx.lineTo(x - size * 0.2, y + size * 0.6);
    ctx.moveTo(x + size * 0.2, y + size * 0.3);
    ctx.lineTo(x + size * 0.2, y + size * 0.6);
    ctx.stroke();

    // 도주 중 표시
    if (a.fleeing) {
      ctx.fillStyle = 'rgba(255,100,100,0.5)';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('!', x, y - size);
    }

    ctx.restore();
  }
}
