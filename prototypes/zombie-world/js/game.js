// ── 게임 상수 ──
export const W = 540, H = 960;
export const HUD_H = 48;
export const FIELD_TOP = HUD_H;              // 48 - field starts after HUD
export const WALL_Y = 520;                   // wall arc center Y
export const TOWER_Y = 590;                  // tower position Y
export const FIELD_BOTTOM = 640;             // field area ends
export const CONTROLS_TOP = Math.floor(H * 0.7); // 672
export const CONTROLS_BOTTOM = H;
export const SLOT_H = 40;                    // 무기 슬롯 높이
export const ITEM_BAR_H = 35;               // 인벤토리 바 높이
export const DIAL_R = 80;                    // half-circle dial radius

// ── 무기 프로필 (사정거리, 공격력, 소리 범위) ──
// 소리 크기 등급: 0 무음 | 30 미미 | 50 작음 | 80 보통 | 120 큼 | 180 매우큼 | 250 폭발급
export const WEAPON_PROFILES = {
  pistol:   { range: 400, damage: 2, originSound: 120, impactSound: 50,  penetrate: 0 },
  bow:      { range: 500, damage: 3, originSound: 0,   impactSound: 30,  penetrate: 1 },
  sniper:   { range: 9999, damage: 5, originSound: 250, impactSound: 80,  penetrate: 99 },
  mg:       { range: 350, damage: 1, originSound: 180, impactSound: 30,  penetrate: 0 },
  crossbow: { range: 450, damage: 4, originSound: 30,  impactSound: 30,  penetrate: 1 },
  flamethrower: { range: 180, damage: 3, originSound: 80, impactSound: 0, penetrate: 0 },
  flashlight: { range: 0, damage: 0, originSound: 0, impactSound: 0, penetrate: 0 },
};

// ── 게임 상태 ──
export const state = {
  screen: 'title', // title | playing | paused | gameover
  score: 0,
  combo: 0,
  maxCombo: 0,
  bestScore: parseInt(localStorage.getItem('zw_best') || '0'),
  bestWave: parseInt(localStorage.getItem('zw_best_wave') || '0'),
  time: 0,
  difficulty: 0, // 0~1

  // 에이밍 (라디안, π/2 = 정면(12시), 0 = 오른쪽, π = 왼쪽)
  aimAngle: Math.PI / 2,

  // 무기 선택
  currentWeapon: 'pistol', // pistol | bow | sniper | mg | crossbow | flamethrower

  // 권총
  pistol: {
    magazineBullets: 10,
    magazineMax: 10,
    reserveBullets: 0,
    chambered: true,
    magazineOut: false,
    slideBack: false,
    specialBullets: 0,
    reloadMode: false,
  },

  // 활
  bow: {
    arrows: 3,
    specialArrows: 0,
    arrowNocked: false,
    drawPower: 0,
    drawing: false,
  },

  // 저격총
  sniper: {
    chambered: true,
    boltOpen: false,
    magazineBullets: 10,
    magazineMax: 10,
    reserveRounds: 0,
    magazineOut: false,
    reloadMode: false,
  },

  // 기관총
  mg: {
    ammo: 30,
    reserveAmmo: 0,
    firing: false,
    fireTimer: 0,
  },

  // 크로스보우
  crossbow: {
    bolts: 3,
    loaded: false,
    cranking: false,
    crankProgress: 0, // 0~1
    cocked: false,     // 크랭크 완료 여부
  },

  // 화염방사기
  flamethrower: {
    fuel: 100,
    fuelMax: 100,
    reserveFuel: 0,
    firing: false,
    flameTimer: 0,
  },

  // 성벽 (4구간)
  walls: [
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
  ],

  // 타워 3개 (좌/중/우 고정)
  towers: [
    { hp: 200, maxHp: 200, x: 90 },
    { hp: 200, maxHp: 200, x: 270 },
    { hp: 200, maxHp: 200, x: 450 },
  ],
  activeTower: 1, // 플레이어가 올라가 있는 타워 인덱스

  // 플레이어
  player: {
    x: 270,
    y: 590,
    hp: 100,
    maxHp: 100,
    speed: 200,
    size: 16,
    onTower: 1,      // -1 = 지상, 0/1/2 = 타워 인덱스
    path: [],
    pathIdx: 0,
    moving: false,
    hitFlash: 0,
  },

  // 건물 (장애물)
  buildings: [],

  // 벽의 문 (3곳)
  doors: [
    { x: 135, open: false },
    { x: 270, open: false },
    { x: 405, open: false },
  ],

  // 낮/밤
  day: 1,
  isNight: false,        // true for waves 4,5
  nightDarkness: 0,      // 0~1 interpolation

  // 인벤토리 (사용 아이템)
  inventory: [],

  // 엔티티 배열
  zombies: [],
  mines: [],             // placed mines on field
  hazards: [],           // fire/poison areas
  soundSources: [],      // { x, y, intensity, range, timer, duration, type }
  soundLures: [],        // persistent sound emitters (toy/firecracker/radio)
  projectiles: [],
  items: [],
  particles: [],

  // 버프
  buffs: {
    shieldTimer: 0,      // wall invincibility
    speedTimer: 0,       // fire rate boost
    freezeShots: 0,      // remaining freeze shots
    chainShots: 0,       // remaining chain shots
    poisonShots: 0,      // remaining poison shots
  },

  // 내부 침투 좀비 수
  zombiesInside: 0,

  // 낮/밤 타이머 (실시간 60초 주기)
  dayNightTimer: 0,

  // 웨이브 (스테이지)
  wave: 0,
  waveZombiesLeft: 0,    // 이번 웨이브에서 남은 좀비 수
  waveSpawnQueue: [],    // 순차 스폰 대기열
  waveCleared: false,
  wavePause: 0,          // 웨이브 간 대기 시간

  // 슬로모션
  slowMo: false,
  slowMoTimer: 0,
};

export function resetGame() {
  state.screen = 'playing';
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.time = 0;
  state.difficulty = 0;
  state.aimAngle = Math.PI / 2;
  state.currentWeapon = 'pistol';
  state.pistol = {
    magazineBullets: 10, magazineMax: 10, reserveBullets: 52,
    chambered: false, magazineOut: false, slideBack: true, specialBullets: 0, reloadMode: false,
  };
  state.bow = {
    arrows: 30, specialArrows: 0, arrowNocked: false, drawPower: 0, drawing: false,
  };
  state.sniper = {
    chambered: true, boltOpen: false, magazineBullets: 10, magazineMax: 10, reserveRounds: 50, magazineOut: false, reloadMode: false,
  };
  state.mg = {
    ammo: 30, reserveAmmo: 270, firing: false, fireTimer: 0,
  };
  state.crossbow = {
    bolts: 30, loaded: false, cranking: false, crankProgress: 0, cocked: false,
  };
  state.flamethrower = {
    fuel: 100, fuelMax: 100, reserveFuel: 200, firing: false, flameTimer: 0,
  };
  state.walls = [
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
  ];
  state.towers = [
    { hp: 200, maxHp: 200, x: 90 },
    { hp: 200, maxHp: 200, x: 270 },
    { hp: 200, maxHp: 200, x: 450 },
  ];
  state.activeTower = 1;
  state.player = {
    x: 270, y: 590, hp: 100, maxHp: 100, speed: 200, size: 16,
    onTower: 1, path: [], pathIdx: 0, moving: false, hitFlash: 0,
  };
  state.buildings = [];
  state.doors = [
    { x: 135, open: false },
    { x: 270, open: false },
    { x: 405, open: false },
  ];
  state.day = 1;
  state.isNight = false;
  state.nightDarkness = 0;
  state.inventory = [];
  state.zombies = [];
  state.mines = [];
  state.hazards = [];
  state.soundSources = [];
  state.soundLures = [];
  state.projectiles = [];
  state.items = [];
  state.particles = [];
  state.buffs = {
    shieldTimer: 0,
    speedTimer: 0,
    freezeShots: 0,
    chainShots: 0,
    poisonShots: 0,
  };
  state.zombiesInside = 0;
  state.wave = 0;
  state.waveZombiesLeft = 0;
  state.waveSpawnQueue = [];
  state.waveCleared = false;
  state.wavePause = 0;
  state.dayNightTimer = 0;
  state.slowMo = false;
  state.slowMoTimer = 0;
}

export function getTotalAmmo() {
  const p = state.pistol;
  const b = state.bow;
  const s = state.sniper;
  const m = state.mg;
  const c = state.crossbow;
  const f = state.flamethrower;
  return p.magazineBullets + p.reserveBullets + p.specialBullets + (p.chambered ? 1 : 0)
    + b.arrows + b.specialArrows + (b.arrowNocked ? 1 : 0)
    + s.magazineBullets + s.reserveRounds + (s.chambered ? 1 : 0)
    + m.ammo + m.reserveAmmo
    + c.bolts + (c.loaded ? 1 : 0)
    + Math.floor(f.fuel) + f.reserveFuel;
}

export function isGameOver() {
  return state.player.hp <= 0;
}

// 현재 플레이어가 올라가 있는 타워 (없으면 null)
export function getCurrentTower() {
  const idx = state.player.onTower;
  if (idx < 0) return null;
  return state.towers[idx];
}

// 타워 위치 상수
export const TOWER_POSITIONS = [
  { x: 90 },
  { x: 270 },
  { x: 450 },
];

// 발사 기준점 (타워 위 = 타워 좌표, 지상 = 플레이어 좌표)
export function getFireOrigin() {
  if (state.player.onTower >= 0) {
    return { x: state.towers[state.player.onTower].x, y: TOWER_Y };
  }
  return { x: state.player.x, y: state.player.y };
}

// ── 소리 시스템 ──
export function emitSound(x, y, range, duration = 1.0, type = 'generic') {
  if (range <= 0) return;
  // 밤에는 소리가 40% 더 멀리 퍼짐
  const actualRange = state.isNight ? range * 1.4 : range;
  // loudness = 원본 range (밤 보정 전). 좀비가 소리 크기 비교에 사용
  state.soundSources.push({ x, y, intensity: 1, range: actualRange, loudness: range, timer: duration, duration, type });
}

export function updateSounds(dt) {
  for (let i = state.soundSources.length - 1; i >= 0; i--) {
    const s = state.soundSources[i];
    s.timer -= dt;
    s.intensity = Math.max(0, s.timer / s.duration);
    if (s.timer <= 0) {
      state.soundSources.splice(i, 1);
    }
  }
}
