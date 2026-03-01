// ── 세이브/로드 시스템 ──
import { state } from './game.js?v=20';
import { world, chunkKey, generateChunk, loadChunkEntities, setChunkLoaders } from './world.js?v=20';

const SAVE_KEY = 'zw_save_v3';

// ── 세이브 ──
export function saveGame() {
  const data = {
    version: 3,
    score: state.score,
    worldTime: state.worldTime,
    time: state.time,
    difficulty: state.difficulty,
    currentWeapon: state.currentWeapon,
    player: {
      x: state.player.x,
      y: state.player.y,
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      speed: state.player.speed,
      size: state.player.size,
      onTower: state.player.onTower,
    },
    pistol: { ...state.pistol },
    bow: { ...state.bow },
    sniper: { ...state.sniper },
    mg: { ...state.mg },
    crossbow: { ...state.crossbow },
    flamethrower: { ...state.flamethrower },
    flashlight: { ...state.flashlight },
    inventory: state.inventory.map(i => ({ ...i })),
    hunger: state.hunger,
    fatigue: state.fatigue,
    day: state.day,
    isNight: state.isNight,
    dayNightTimer: state.dayNightTimer,
    wave: state.wave,
    currentWeather: state.currentWeather,
    walls: state.walls.map(w => ({ hp: w.hp, maxHp: w.maxHp, upgrades: w.upgrades || 0 })),
    worldSeed: world.seed,
    currentCx: world.currentCx,
    currentCy: world.currentCy,
    discovered: [...world.discovered],
    // 청크 델타 (변경된 건물 looted 상태만 저장)
    chunkDeltas: serializeChunkDeltas(),
  };

  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

// ── 로드 ──
export function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;

  try {
    const data = JSON.parse(raw);
    if (data.version !== 3) return false;

    // 월드 시드 복원
    world.seed = data.worldSeed;
    world.chunks.clear();
    world.discovered.clear();
    world.currentCx = data.currentCx;
    world.currentCy = data.currentCy;
    world.transitioning = false;

    // 발견된 청크 복원
    for (const key of data.discovered) {
      world.discovered.add(key);
    }

    // 게임 상태 복원
    state.score = data.score;
    state.worldTime = data.worldTime;
    state.time = data.time || 0;
    state.difficulty = data.difficulty || 0;
    state.currentWeapon = data.currentWeapon || 'pistol';
    state.hunger = data.hunger;
    state.fatigue = data.fatigue;
    state.day = data.day;
    state.isNight = data.isNight;
    state.dayNightTimer = data.dayNightTimer;
    state.wave = data.wave;
    state.currentWeather = data.currentWeather || 'clear';
    state.sleeping = false;

    // 벽 업그레이드 복원
    if (data.walls) {
      for (let i = 0; i < 4; i++) {
        if (data.walls[i]) {
          state.walls[i].hp = data.walls[i].hp;
          state.walls[i].maxHp = data.walls[i].maxHp;
          state.walls[i].upgrades = data.walls[i].upgrades || 0;
        }
      }
    }

    // 무기 상태 복원
    if (data.pistol) Object.assign(state.pistol, data.pistol);
    if (data.bow) Object.assign(state.bow, data.bow);
    if (data.sniper) Object.assign(state.sniper, data.sniper);
    if (data.mg) Object.assign(state.mg, data.mg);
    if (data.crossbow) Object.assign(state.crossbow, data.crossbow);
    if (data.flamethrower) Object.assign(state.flamethrower, data.flamethrower);
    if (data.flashlight) Object.assign(state.flashlight, data.flashlight);

    // 인벤토리 복원
    state.inventory = data.inventory || [];

    // 청크 델타 복원 (looted 건물 상태)
    if (data.chunkDeltas) {
      deserializeChunkDeltas(data.chunkDeltas);
    }

    // 현재 청크 로드
    const chunk = generateChunk(data.currentCx, data.currentCy);
    chunk.discovered = true;
    loadChunkEntities(chunk);
    state.currentChunk = chunk;

    // 플레이어 위치 복원
    const p = data.player;
    state.player.x = p.x;
    state.player.y = p.y;
    state.player.hp = p.hp;
    state.player.maxHp = p.maxHp;
    state.player.onTower = p.onTower || -1;
    state.player.moving = false;
    state.player.path = [];
    state.player.pathIdx = 0;
    state.player.hitFlash = 0;

    state.screen = 'playing';
    return true;
  } catch (e) {
    return false;
  }
}

// ── 세이브 존재 여부 ──
export function hasSave() {
  return !!localStorage.getItem(SAVE_KEY);
}

// ── 세이브 삭제 ──
export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

// ── 청크 델타 직렬화 (looted 건물 + 탈것 상태) ──
function serializeChunkDeltas() {
  const deltas = {};
  for (const [key, chunk] of world.chunks) {
    const delta = {};
    // looted 건물
    const lootedIndices = [];
    for (let i = 0; i < chunk.buildings.length; i++) {
      if (chunk.buildings[i].looted) {
        lootedIndices.push(i);
      }
    }
    if (lootedIndices.length > 0) delta.looted = lootedIndices;

    // 탈것 상태 (위치, 연료, 파손)
    const vehicles = chunk.savedVehicles || chunk.vehicles || [];
    if (vehicles.length > 0) {
      delta.vehicles = vehicles.map(v => ({
        type: v.type, x: v.x, y: v.y,
        fuel: v.fuel === Infinity ? -1 : v.fuel,
        broken: v.broken,
      }));
    }

    if (Object.keys(delta).length > 0) {
      deltas[key] = delta;
    }
  }
  return deltas;
}

// ── 청크 델타 역직렬화 ──
function deserializeChunkDeltas(deltas) {
  for (const [key, delta] of Object.entries(deltas)) {
    const [cx, cy] = key.split(',').map(Number);
    const chunk = generateChunk(cx, cy);
    if (delta.looted) {
      for (const idx of delta.looted) {
        if (chunk.buildings[idx]) {
          chunk.buildings[idx].looted = true;
        }
      }
    }
    if (delta.vehicles) {
      chunk.vehicles = delta.vehicles.map(v => ({
        ...v,
        fuel: v.fuel === -1 ? Infinity : v.fuel,
        fuelMax: v.fuel === -1 ? Infinity : (v.fuelMax || 100),
      }));
      chunk.savedVehicles = chunk.vehicles.map(v => ({ ...v }));
    }
  }
}
