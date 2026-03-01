// ── 건물 내부 시스템 ──
import { W, H, state, emitSound, isBaseMap } from './game.js?v=311';
import { seededRng, chunkSeed, world } from './world.js?v=311';
import { registerZone } from './input.js?v=311';
import { startSleep } from './fatigue.js?v=311';

// ── 건물 유형별 루트 테이블 ──
const LOOT_TABLES = {
  house:       { items: ['food','medkit','brick'], count: [1,3], zombies: [0,1] },
  apartment:   { items: ['food','medkit','brick'], count: [1,4], zombies: [0,2] },
  convenience: { items: ['food','food','medkit'], count: [2,5], zombies: [1,2] },
  supermarket: { items: ['food','food','food','medkit'], count: [3,8], zombies: [2,4] },
  gunshop:     { items: ['bullet','bullet','arrow','bolt'], count: [2,5], zombies: [2,3] },
  police:      { items: ['bullet','bullet','bullet','medkit'], count: [3,6], zombies: [3,5] },
  hospital:    { items: ['medkit','medkit','medkit','food'], count: [3,6], zombies: [2,4] },
  pharmacy:    { items: ['medkit','medkit','food'], count: [1,3], zombies: [0,2] },
  warehouse:   { items: ['brick','brick','food','medkit','bullet'], count: [2,6], zombies: [1,3] },
  factory:     { items: ['fuel','brick','bomb','mine'], count: [2,4], zombies: [1,3] },
  gasstation:  { items: ['fuel','fuel','food'], count: [1,3], zombies: [0,2] },
  school:      { items: ['food','brick','medkit'], count: [2,5], zombies: [1,3] },
  church:      { items: ['food','medkit'], count: [0,2], zombies: [0,1] },
  library:     { items: ['food','brick'], count: [1,2], zombies: [0,1] },
  firestation: { items: ['medkit','fuel','brick'], count: [2,4], zombies: [1,2] },
  restaurant:  { items: ['food','food','food'], count: [2,5], zombies: [1,3] },
  garage:      { items: ['fuel','brick','mine'], count: [1,3], zombies: [0,2] },
  military:    { items: ['bullet','bullet','bullet','bomb','medkit'], count: [4,8], zombies: [4,5] },
  ruin:        { items: ['brick','food'], count: [0,2], zombies: [1,3] },
  bunker:      { items: ['bullet','bullet','medkit','bomb','food'], count: [5,10], zombies: [3,5] },
};

// ── 아이템 색상 매핑 ──
const ITEM_COLORS = {
  food: '#ffaa44', medkit: '#ff4444', brick: '#aa8844',
  bullet: '#ffdd44', arrow: '#88cc88', bolt: '#88ccaa',
  fuel: '#ff8844', bomb: '#ff6644', mine: '#cc8844',
};

// ── 내부 상수 ──
const MARGIN = 30;
const ROOM_X = MARGIN;
const ROOM_Y = 60;
const ROOM_W = W - MARGIN * 2;
const ROOM_H = H - 180;
const EXIT_BTN = { x: W / 2 - 60, y: H - 55, w: 120, h: 40 };
const BED_POS = { x: ROOM_X + ROOM_W - 70, y: ROOM_Y + 30, w: 50, h: 30 };

// ── 내부 생성 ──
export function generateInterior(building) {
  const seed = chunkSeed(world.currentCx, world.currentCy, world.seed)
    ^ (Math.floor(building.x) * 7919 + Math.floor(building.y) * 6271);
  const rng = seededRng(seed);
  const table = LOOT_TABLES[building.type] || LOOT_TABLES.ruin;

  const itemCount = table.count[0] + Math.floor(rng() * (table.count[1] - table.count[0] + 1));
  const zombieCount = table.zombies[0] + Math.floor(rng() * (table.zombies[1] - table.zombies[0] + 1));

  const items = [];
  for (let i = 0; i < itemCount; i++) {
    const itemId = table.items[Math.floor(rng() * table.items.length)];
    items.push({
      id: itemId,
      x: ROOM_X + 30 + Math.floor(rng() * (ROOM_W - 60)),
      y: ROOM_Y + 40 + Math.floor(rng() * (ROOM_H - 80)),
      collected: false,
    });
  }

  const zombies = [];
  for (let i = 0; i < zombieCount; i++) {
    zombies.push({
      x: ROOM_X + 30 + Math.floor(rng() * (ROOM_W - 60)),
      y: ROOM_Y + 40 + Math.floor(rng() * (ROOM_H - 80)),
      hp: 2 + Math.floor(rng() * 3),
      maxHp: 2 + Math.floor(rng() * 3),
      speed: 30 + Math.floor(rng() * 20),
      alive: true,
      attackTimer: 0,
    });
  }

  const hasBed = (building.type === 'house' || building.type === 'apartment');

  return { items, zombies, hasBed, cleared: false };
}

// ── 베이스 캠프 내부 생성 (안전, 침대 항상 있음) ──
export function generateBaseCampInterior() {
  return {
    items: [],
    zombies: [],
    hasBed: true,
    cleared: true,
    isBaseCamp: true,
  };
}

// ── 초기화 (입력 존 등록) ──
export function initInterior() {
  // 내부 전체 영역 탭 핸들러
  registerZone(
    { x: 0, y: 0, w: W, h: H },
    {
      onStart() {
        if (state.screen !== 'interior') return false;
      },
      onTap(x, y) {
        if (state.screen !== 'interior') return;
        const interior = state.interior;
        if (!interior) return;

        // EXIT 버튼
        if (x >= EXIT_BTN.x && x <= EXIT_BTN.x + EXIT_BTN.w &&
            y >= EXIT_BTN.y && y <= EXIT_BTN.y + EXIT_BTN.h) {
          exitInterior();
          return;
        }

        // 침대 탭 → 수면
        if (interior.hasBed && !state.sleeping) {
          if (x >= BED_POS.x && x <= BED_POS.x + BED_POS.w &&
              y >= BED_POS.y && y <= BED_POS.y + BED_POS.h) {
            const duration = isBaseMap() ? 10 : 20;
            startSleep(duration, 'bed');
            return;
          }
        }

        // 아이템 수집 (30px 이내)
        for (const item of interior.items) {
          if (item.collected) continue;
          const dist = Math.hypot(x - item.x, y - item.y);
          if (dist < 30) {
            collectInteriorItem(item);
            return;
          }
        }

        // 이동 (룸 영역 내)
        if (x >= ROOM_X && x <= ROOM_X + ROOM_W &&
            y >= ROOM_Y && y <= ROOM_Y + ROOM_H) {
          state.interiorPlayer.targetX = x;
          state.interiorPlayer.targetY = y;
        }
      },
    },
    60 // worldmap(50)보다 높게
  );
}

// ── 내부 진입 ──
export function enterInterior(building) {
  // 이미 약탈된 건물도 진입 가능 (좀비/아이템 없음)
  if (!building._interior) {
    building._interior = generateInterior(building);
  }
  state.interior = building._interior;
  state.interiorBuilding = building;
  state.interiorPlayer = {
    x: ROOM_X + ROOM_W / 2,
    y: ROOM_Y + ROOM_H - 40,
    targetX: ROOM_X + ROOM_W / 2,
    targetY: ROOM_Y + ROOM_H - 40,
    attackTimer: 0,
  };
  state.screen = 'interior';
}

// ── 베이스 캠프 진입 ──
let _baseCampInterior = null;
export function enterBaseCamp() {
  if (!_baseCampInterior) {
    _baseCampInterior = generateBaseCampInterior();
  }
  state.interior = _baseCampInterior;
  state.interiorBuilding = { type: 'basecamp', x: 0, y: 0, w: 100, h: 100 };
  state.interiorPlayer = {
    x: ROOM_X + ROOM_W / 2,
    y: ROOM_Y + ROOM_H - 40,
    targetX: ROOM_X + ROOM_W / 2,
    targetY: ROOM_Y + ROOM_H - 40,
    attackTimer: 0,
  };
  state.screen = 'interior';
}

// ── 내부 퇴장 ──
function exitInterior() {
  // 약탈 체크: 아이템 모두 수집 + 좀비 모두 사망
  const interior = state.interior;
  if (interior) {
    const allCollected = interior.items.every(i => i.collected);
    const allDead = interior.zombies.every(z => !z.alive);
    if (allCollected && allDead) {
      interior.cleared = true;
      if (state.interiorBuilding) {
        state.interiorBuilding.looted = true;
      }
    }
  }
  state.interior = null;
  state.interiorBuilding = null;
  state.interiorPlayer = null;
  state.screen = 'playing';
}

// ── 아이템 수집 ──
function collectInteriorItem(item) {
  item.collected = true;
  // 인벤토리에 추가
  const existing = state.inventory.find(i => i.id === item.id);
  if (existing) {
    existing.count++;
  } else {
    state.inventory.push({ id: item.id, count: 1 });
  }
}

// ── 업데이트 ──
export function updateInterior(dt) {
  if (!state.interior || !state.interiorPlayer) return;

  const ip = state.interiorPlayer;
  const interior = state.interior;

  // 플레이어 이동
  const dx = ip.targetX - ip.x;
  const dy = ip.targetY - ip.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 3) {
    const speed = 150;
    const step = Math.min(speed * dt, dist);
    ip.x += (dx / dist) * step;
    ip.y += (dy / dist) * step;
  }

  // 플레이어 경계 클램핑
  ip.x = Math.max(ROOM_X + 10, Math.min(ROOM_X + ROOM_W - 10, ip.x));
  ip.y = Math.max(ROOM_Y + 10, Math.min(ROOM_Y + ROOM_H - 10, ip.y));

  // 좀비 AI
  for (const z of interior.zombies) {
    if (!z.alive) continue;

    const zdx = ip.x - z.x;
    const zdy = ip.y - z.y;
    const zdist = Math.hypot(zdx, zdy);

    // 100px 이내면 추격
    if (zdist < 100 && zdist > 15) {
      z.x += (zdx / zdist) * z.speed * dt;
      z.y += (zdy / zdist) * z.speed * dt;
    } else if (zdist >= 100) {
      // 랜덤 배회
      z.x += (Math.random() - 0.5) * z.speed * 0.3 * dt;
      z.y += (Math.random() - 0.5) * z.speed * 0.3 * dt;
    }

    // 좀비 경계 클램핑
    z.x = Math.max(ROOM_X + 10, Math.min(ROOM_X + ROOM_W - 10, z.x));
    z.y = Math.max(ROOM_Y + 10, Math.min(ROOM_Y + ROOM_H - 10, z.y));

    // 접촉 공격 (15px 이내, 2hp/s)
    if (zdist < 15) {
      state.player.hp -= 2 * dt;
      if (state.player.hp < 0) state.player.hp = 0;
      ip.hitFlash = 0.15;
    }
  }

  // 플레이어 자동 공격 (가장 가까운 좀비, 쿨다운 0.5초)
  ip.attackTimer -= dt;
  if (ip.attackTimer <= 0) {
    let nearest = null;
    let nearestDist = 80; // 근접 공격 범위
    for (const z of interior.zombies) {
      if (!z.alive) continue;
      const d = Math.hypot(ip.x - z.x, ip.y - z.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = z;
      }
    }
    if (nearest) {
      const wpn = state.currentWeapon;
      let dmg = 3; // 기본 근접 공격
      if (wpn === 'pistol' || wpn === 'mg') dmg = 2;
      if (wpn === 'sniper' || wpn === 'bow' || wpn === 'crossbow') dmg = 4;

      nearest.hp -= dmg;
      emitSound(ip.x, ip.y, 100, 0.3, 'attack');
      ip.attackTimer = 0.5;

      if (nearest.hp <= 0) {
        nearest.alive = false;
        state.score += 5;
      }
    }
  }

  // hitFlash 감소
  if (ip.hitFlash > 0) {
    ip.hitFlash -= dt;
    if (ip.hitFlash < 0) ip.hitFlash = 0;
  }

  // 게임 오버 체크
  if (state.player.hp <= 0) {
    state.interior = null;
    state.interiorBuilding = null;
    state.interiorPlayer = null;
    // game.js의 isGameOver() → main.js에서 triggerGameOver() 처리
  }
}

// ── 렌더링 ──
export function drawInterior(ctx) {
  const interior = state.interior;
  const building = state.interiorBuilding;
  const ip = state.interiorPlayer;
  if (!interior || !building || !ip) return;

  // 전체 배경
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, W, H);

  // 바닥
  ctx.fillStyle = '#2a2518';
  ctx.fillRect(ROOM_X, ROOM_Y, ROOM_W, ROOM_H);

  // 벽 테두리
  ctx.strokeStyle = '#4a4a3a';
  ctx.lineWidth = 2;
  ctx.strokeRect(ROOM_X, ROOM_Y, ROOM_W, ROOM_H);

  // 건물 유형 제목
  const isBaseCamp = interior.isBaseCamp;
  ctx.fillStyle = isBaseCamp ? '#88ccaa' : '#aaa';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(isBaseCamp ? 'BASE CAMP' : building.type.toUpperCase(), W / 2, 40);

  // 베이스 캠프 안전 표시
  if (isBaseCamp) {
    ctx.fillStyle = '#4a8866';
    ctx.font = '10px monospace';
    ctx.fillText('SAFE ZONE', W / 2, 52);
  }

  // 침대
  if (interior.hasBed) {
    ctx.fillStyle = '#664422';
    ctx.fillRect(BED_POS.x, BED_POS.y, BED_POS.w, BED_POS.h);
    ctx.fillStyle = '#88aacc';
    ctx.fillRect(BED_POS.x + 2, BED_POS.y + 2, BED_POS.w - 4, BED_POS.h - 4);
    ctx.fillStyle = '#fff';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BED', BED_POS.x + BED_POS.w / 2, BED_POS.y + BED_POS.h / 2 + 3);
  }

  // 아이템
  for (const item of interior.items) {
    if (item.collected) continue;
    const color = ITEM_COLORS[item.id] || '#ffdd44';

    // 빛나는 효과
    const glow = ctx.createRadialGradient(item.x, item.y, 0, item.x, item.y, 12);
    glow.addColorStop(0, color);
    glow.addColorStop(0.5, color + '88');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(item.x, item.y, 12, 0, Math.PI * 2);
    ctx.fill();

    // 아이콘 점
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(item.x, item.y, 5, 0, Math.PI * 2);
    ctx.fill();

    // 라벨
    ctx.fillStyle = '#fff';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(item.id, item.x, item.y + 16);
  }

  // 좀비
  for (const z of interior.zombies) {
    if (!z.alive) continue;

    ctx.fillStyle = '#44aa44';
    ctx.beginPath();
    ctx.arc(z.x, z.y, 10, 0, Math.PI * 2);
    ctx.fill();

    // 눈
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(z.x - 3, z.y - 3, 2, 0, Math.PI * 2);
    ctx.arc(z.x + 3, z.y - 3, 2, 0, Math.PI * 2);
    ctx.fill();

    // HP 바
    if (z.hp < z.maxHp) {
      const barW = 16;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(z.x - barW / 2, z.y - 16, barW, 3);
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(z.x - barW / 2, z.y - 16, barW * (z.hp / z.maxHp), 3);
    }
  }

  // 플레이어
  ctx.save();
  if (ip.hitFlash > 0 && Math.sin(ip.hitFlash * 40) > 0) {
    ctx.globalAlpha = 0.4;
  }
  ctx.fillStyle = '#4488ff';
  ctx.beginPath();
  ctx.arc(ip.x, ip.y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2266dd';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 머리
  ctx.fillStyle = '#ffcc88';
  ctx.beginPath();
  ctx.arc(ip.x, ip.y - 14, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 공격 범위 표시 (근접)
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(ip.x, ip.y, 80, 0, Math.PI * 2);
  ctx.stroke();

  // EXIT 버튼
  ctx.fillStyle = '#884444';
  ctx.fillRect(EXIT_BTN.x, EXIT_BTN.y, EXIT_BTN.w, EXIT_BTN.h);
  ctx.strokeStyle = '#aa6666';
  ctx.lineWidth = 1;
  ctx.strokeRect(EXIT_BTN.x, EXIT_BTN.y, EXIT_BTN.w, EXIT_BTN.h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', W / 2, EXIT_BTN.y + 26);

  // 남은 아이템/좀비 카운트
  const itemsLeft = interior.items.filter(i => !i.collected).length;
  const zombiesLeft = interior.zombies.filter(z => z.alive).length;
  ctx.fillStyle = '#888';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`Items: ${itemsLeft}  Zombies: ${zombiesLeft}`, ROOM_X + 5, H - 65);
}

// ── 건물 진입 가능 여부 + 가장 가까운 건물 반환 ──
export function getNearbyBuilding(px, py, maxDist) {
  let nearest = null;
  let nearestDist = maxDist;
  for (const b of state.buildings) {
    // 건물 중심까지 거리
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const d = Math.hypot(px - cx, py - cy);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = b;
    }
  }
  return nearest;
}
