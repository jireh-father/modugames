// ── 월드 시스템 (Chunk 기반 무한 맵) ──
import { W, state, FIELD_TOP, FIELD_BOTTOM, WALL_Y } from './game.js?v=19';
import { spawnChunkVehicles } from './vehicle.js?v=19';

// ── 시드 기반 난수 생성기 ──
export function seededRng(seed) {
  let s = seed | 0;
  if (s === 0) s = 1;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s & 0x7fffffff) / 2147483647;
  };
}

// ── 청크 좌표로 시드 생성 ──
export function chunkSeed(cx, cy, worldSeed) {
  return ((worldSeed + cx * 73856093 + cy * 19349663) & 0x7fffffff) || 1;
}

// ── 월드 상태 ──
export const world = {
  seed: 0,
  chunks: new Map(),
  currentCx: 0,
  currentCy: 0,
  discovered: new Set(),
  transitioning: false,
  transDir: null,
  transProgress: 0,
};

// ── 청크 키 헬퍼 ──
export function chunkKey(cx, cy) { return `${cx},${cy}`; }

// ── 좀비 타입 이름 (맵별 배치용) ──
const ZOMBIE_TYPE_NAMES = ['walker','runner','tank','rammer','splitter','spider'];

// ── 건물 타입 (가중치 기반) ──
const BUILDING_TYPES = [
  { id: 'house', weight: 15 },
  { id: 'apartment', weight: 10 },
  { id: 'convenience', weight: 12 },
  { id: 'supermarket', weight: 5 },
  { id: 'gunshop', weight: 3 },
  { id: 'police', weight: 2 },
  { id: 'hospital', weight: 3 },
  { id: 'pharmacy', weight: 8 },
  { id: 'warehouse', weight: 6 },
  { id: 'factory', weight: 4 },
  { id: 'gasstation', weight: 5 },
  { id: 'school', weight: 5 },
  { id: 'church', weight: 4 },
  { id: 'library', weight: 4 },
  { id: 'firestation', weight: 3 },
  { id: 'restaurant', weight: 8 },
  { id: 'garage', weight: 5 },
  { id: 'military', weight: 1 },
  { id: 'ruin', weight: 10 },
  { id: 'bunker', weight: 1 },
];
const TOTAL_BWEIGHT = BUILDING_TYPES.reduce((s, b) => s + b.weight, 0);

function pickBuildingType(rng) {
  let r = rng() * TOTAL_BWEIGHT;
  for (const bt of BUILDING_TYPES) {
    r -= bt.weight;
    if (r <= 0) return bt.id;
  }
  return 'ruin';
}

// ── 좀비 구성 결정 ──
function generateZombieConfig(rng, dist, isBase) {
  if (isBase) {
    return { types: ['walker'], density: 15, hpMul: 1, speedMul: 1 };
  }
  const roll = rng();
  let types;
  if (roll < 0.3) {
    types = [ZOMBIE_TYPE_NAMES[Math.floor(rng() * ZOMBIE_TYPE_NAMES.length)]];
  } else if (roll < 0.8) {
    const count = 2 + Math.floor(rng() * 2);
    types = [];
    while (types.length < count) {
      const t = ZOMBIE_TYPE_NAMES[Math.floor(rng() * ZOMBIE_TYPE_NAMES.length)];
      if (!types.includes(t)) types.push(t);
    }
  } else {
    types = [...ZOMBIE_TYPE_NAMES];
  }

  const density = Math.floor(15 + dist * 5 + rng() * 10);
  const hpMul = 1 + dist * 0.1;
  const speedMul = 1 + Math.min(dist * 0.03, 0.5);

  return { types, density: Math.min(density, 60), hpMul, speedMul };
}

// ── 청크 생성 ──
export function generateChunk(cx, cy) {
  const key = chunkKey(cx, cy);
  if (world.chunks.has(key)) return world.chunks.get(key);

  const seed = chunkSeed(cx, cy, world.seed);
  const rng = seededRng(seed);
  const isBase = (cx === 0 && cy === 0);
  const distFromBase = Math.hypot(cx, cy);

  // ── 건물 생성 ──
  const buildings = [];
  if (!isBase) {
    const buildingCount = 6 + Math.floor(rng() * 8);
    const minY = FIELD_TOP + 30;
    const maxY = FIELD_BOTTOM - 30;
    for (let i = 0; i < buildingCount; i++) {
      const bw = 40 + Math.floor(rng() * 81);
      const bh = 40 + Math.floor(rng() * 41);
      const bx = Math.floor(rng() * (W - bw));
      const by = minY + Math.floor(rng() * (maxY - minY - bh));
      let overlap = false;
      for (const b of buildings) {
        if (bx < b.x + b.w + 20 && bx + bw > b.x - 20 &&
            by < b.y + b.h + 20 && by + bh > b.y - 20) {
          overlap = true; break;
        }
      }
      if (!overlap) {
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          type: pickBuildingType(rng),
          ruined: rng() < 0.3,
          looted: false,
        });
      }
    }
  }

  const zombieConfig = generateZombieConfig(rng, distFromBase, isBase);
  const animalCount = isBase ? 5 : Math.floor(2 + rng() * 4);
  const vehicles = isBase ? [] : spawnChunkVehicles(rng, buildings);

  const chunk = {
    cx, cy, seed, isBase,
    buildings,
    vehicles,
    zombieConfig,
    animalCount,
    items: [],
    discovered: false,
    loaded: false,
  };

  world.chunks.set(key, chunk);
  return chunk;
}

// ── 이동 가능 방향 체크 ──
export function canMove(cx, cy, direction) {
  if (cx === 0 && cy === 0) {
    if (direction === 'down') return false;
  }
  return true;
}

// ── 인접 청크 좌표 ──
export function getAdjacentCoords(cx, cy) {
  return [
    { cx: cx, cy: cy - 1, dir: 'up' },
    { cx: cx, cy: cy + 1, dir: 'down' },
    { cx: cx - 1, cy: cy, dir: 'left' },
    { cx: cx + 1, cy: cy, dir: 'right' },
  ];
}

// ── 전환 시작 ──
export function startTransition(dir) {
  if (world.transitioning) return;
  world.transitioning = true;
  world.transDir = dir;
  world.transProgress = 0;
}

// ── 전환 업데이트 ──
export function updateTransition(dt) {
  if (!world.transitioning) return false;
  world.transProgress += dt / 0.3;
  if (world.transProgress >= 1) {
    completeTransition();
    return true;
  }
  return false;
}

// ── 전환 완료 ──
function completeTransition() {
  const dir = world.transDir;
  let ncx = world.currentCx, ncy = world.currentCy;
  if (dir === 'left') ncx--;
  if (dir === 'right') ncx++;
  if (dir === 'up') ncy--;
  if (dir === 'down') ncy++;

  // 탑승 중인 탈것 저장 (청크 전환 시 이동)
  const ridingVehicle = state.riding ? { ...state.riding } : null;
  if (ridingVehicle) {
    // 이전 청크에서 탑승 중이던 탈것 제거
    const idx = state.vehicles.indexOf(state.riding);
    if (idx >= 0) state.vehicles.splice(idx, 1);
    state.riding = null;
  }

  // 이전 청크 엔티티 저장
  saveChunkEntities(world.currentCx, world.currentCy);

  // 새 청크로 이동
  world.currentCx = ncx;
  world.currentCy = ncy;
  const chunk = generateChunk(ncx, ncy);
  chunk.discovered = true;
  world.discovered.add(chunkKey(ncx, ncy));

  // 새 청크 엔티티 로드
  loadChunkEntities(chunk);
  state.currentChunk = chunk;

  // 플레이어 위치를 반대편으로
  const p = state.player;
  if (dir === 'left') p.x = W - p.size - 1;
  if (dir === 'right') p.x = p.size + 1;
  if (dir === 'up') p.y = FIELD_BOTTOM - p.size - 1;
  if (dir === 'down') p.y = FIELD_TOP + p.size + 1;

  // 탑승 중이던 탈것을 새 청크에 추가
  if (ridingVehicle) {
    ridingVehicle.x = p.x;
    ridingVehicle.y = p.y;
    state.vehicles.push(ridingVehicle);
    state.riding = ridingVehicle;
  }

  world.transitioning = false;
  world.transDir = null;
  world.transProgress = 0;
}

// ── 청크 엔티티 저장 ──
export function saveChunkEntities(cx, cy) {
  const key = chunkKey(cx, cy);
  const chunk = world.chunks.get(key);
  if (!chunk) return;
  chunk.savedZombies = state.zombies.map(z => ({ ...z }));
  chunk.savedAnimals = state.animals.map(a => ({ ...a }));
  chunk.savedItems = state.items.map(i => ({ ...i }));
  chunk.savedVehicles = state.vehicles.map(v => ({ ...v }));
}

// ── 청크 엔티티 로드 (외부에서 spawnChunkZombies, spawnAnimals, loadChunkBuildings, buildGrid 주입) ──
let _spawnChunkZombies = null;
let _spawnAnimals = null;
let _loadChunkBuildings = null;
let _buildGrid = null;
let _generateBuildings = null;

export function setChunkLoaders(fns) {
  _spawnChunkZombies = fns.spawnChunkZombies;
  _spawnAnimals = fns.spawnAnimals;
  _loadChunkBuildings = fns.loadChunkBuildings;
  _buildGrid = fns.buildGrid;
  _generateBuildings = fns.generateBuildings;
}

export function loadChunkEntities(chunk) {
  if (chunk.savedZombies) {
    state.zombies = chunk.savedZombies.map(z => ({ ...z }));
  } else {
    state.zombies = [];
    if (_spawnChunkZombies) _spawnChunkZombies(chunk);
  }
  if (chunk.savedAnimals) {
    state.animals = chunk.savedAnimals.map(a => ({ ...a }));
  } else {
    state.animals = [];
    if (_spawnAnimals) _spawnAnimals(chunk.animalCount);
  }
  state.items = chunk.savedItems ? chunk.savedItems.map(i => ({ ...i })) : [];
  state.vehicles = chunk.savedVehicles ? chunk.savedVehicles.map(v => ({ ...v })) : (chunk.vehicles ? chunk.vehicles.map(v => ({ ...v })) : []);
  state.riding = null; // 청크 전환 시 하차 (아래 completeTransition에서 재탑승 처리)
  // 베이스맵: 기존 건물 생성 (타워 회피 로직 포함), 비베이스: 청크 건물
  if (chunk.isBase) {
    if (_generateBuildings) _generateBuildings();
  } else {
    if (_loadChunkBuildings) _loadChunkBuildings(chunk);
  }
  if (_buildGrid) _buildGrid();

  // 비 베이스맵: 플레이어 지상 강제
  if (!chunk.isBase) {
    state.player.onTower = -1;
  }

  chunk.loaded = true;
}

// ── 월드 초기화 ──
export function initWorld() {
  world.seed = Date.now() & 0x7fffffff;
  world.chunks.clear();
  world.discovered.clear();
  world.currentCx = 0;
  world.currentCy = 0;
  world.transitioning = false;

  const baseChunk = generateChunk(0, 0);
  baseChunk.discovered = true;
  world.discovered.add(chunkKey(0, 0));

  return baseChunk;
}

// ── 인접 청크 틱-라이트 업데이트 (소리 전파) ──
export function updateAdjacentChunks(dt) {
  const adj = getAdjacentCoords(world.currentCx, world.currentCy);
  for (const { cx, cy } of adj) {
    const key = chunkKey(cx, cy);
    const chunk = world.chunks.get(key);
    if (!chunk || !chunk.savedZombies) continue;

    // 현재 맵의 소리가 경계를 넘으면 인접 맵 좀비 유인
    for (const sound of state.soundSources) {
      const dirCx = cx - world.currentCx;
      const dirCy = cy - world.currentCy;
      const edgeDist = distToChunkEdge(sound.x, sound.y, dirCx, dirCy);
      if (sound.range > edgeDist) {
        const targetEdge = getEdgePoint(dirCx, dirCy);
        for (const z of chunk.savedZombies) {
          if (!z.alive) continue;
          const dx = targetEdge.x - z.x;
          const dy = targetEdge.y - z.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 5) {
            z.x += (dx / dist) * z.speed * 0.1 * dt;
            z.y += (dy / dist) * z.speed * 0.1 * dt;
          }
        }
      }
    }
  }
}

// ── 경계까지 거리 계산 (소리 전파용) ──
export function distToChunkEdge(x, y, dirCx, dirCy) {
  if (dirCx < 0) return x;
  if (dirCx > 0) return W - x;
  if (dirCy < 0) return y - FIELD_TOP;
  if (dirCy > 0) return FIELD_BOTTOM - y;
  return Infinity;
}

// ── 경계 지점 반환 (소리 전파 시 좀비 이동 목표) ──
export function getEdgePoint(dirCx, dirCy) {
  if (dirCx < 0) return { x: 0, y: (FIELD_TOP + FIELD_BOTTOM) / 2 };
  if (dirCx > 0) return { x: W, y: (FIELD_TOP + FIELD_BOTTOM) / 2 };
  if (dirCy < 0) return { x: W / 2, y: FIELD_TOP };
  if (dirCy > 0) return { x: W / 2, y: FIELD_BOTTOM };
  return { x: W / 2, y: (FIELD_TOP + FIELD_BOTTOM) / 2 };
}
