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
export const DIAL_R = 80;                    // half-circle dial radius

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
  currentWeapon: 'pistol', // pistol | bow | sniper | mg | crossbow

  // 권총
  pistol: {
    magazineBullets: 6,
    magazineMax: 6,
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
    reserveRounds: 3,
    scoping: false,
    scopeZoom: 0, // 0~1
  },

  // 기관총
  mg: {
    ammo: 30,
    reserveAmmo: 0,
    heat: 0,       // 0~1 과열도
    overheated: false,
    firing: false,
    fireTimer: 0,
    cocked: true,
  },

  // 크로스보우
  crossbow: {
    bolts: 3,
    loaded: false,
    cranking: false,
    crankProgress: 0, // 0~1
    cocked: false,     // 크랭크 완료 여부
  },

  // 성벽 (4구간)
  walls: [
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
  ],

  // 타워
  tower: { hp: 200, maxHp: 200 },

  // 낮/밤
  day: 1,
  isNight: false,        // true for waves 4,5
  nightDarkness: 0,      // 0~1 interpolation

  // 엔티티 배열
  zombies: [],
  mines: [],             // placed mines on field
  hazards: [],           // fire/poison areas
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

  // 웨이브
  wave: 0,
  waveZombiesLeft: 0,    // 이번 웨이브에서 남은 좀비 수
  waveSpawnQueue: [],    // 순차 스폰 대기열
  waveCleared: false,
  wavePause: 0,          // 웨이브 간 대기 시간
  waveTimer: 0,          // 웨이브 경과 시간
  waveTimeLimit: 0,      // 웨이브 제한 시간

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
    magazineBullets: 6, magazineMax: 6, reserveBullets: 0,
    chambered: false, magazineOut: false, slideBack: true, specialBullets: 0, reloadMode: false,
  };
  state.bow = {
    arrows: 3, specialArrows: 0, arrowNocked: false, drawPower: 0, drawing: false,
  };
  state.sniper = {
    chambered: true, boltOpen: false, reserveRounds: 3, scoping: false, scopeZoom: 0,
  };
  state.mg = {
    ammo: 30, reserveAmmo: 0, heat: 0, overheated: false, firing: false, fireTimer: 0, cocked: true,
  };
  state.crossbow = {
    bolts: 3, loaded: false, cranking: false, crankProgress: 0, cocked: false,
  };
  state.walls = [
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
    { hp: 100, maxHp: 100, rebuilding: false, rebuildTimer: 0 },
  ];
  state.tower = { hp: 200, maxHp: 200 };
  state.day = 1;
  state.isNight = false;
  state.nightDarkness = 0;
  state.zombies = [];
  state.mines = [];
  state.hazards = [];
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
  state.waveTimer = 0;
  state.waveTimeLimit = 0;
  state.slowMo = false;
  state.slowMoTimer = 0;
}

export function getTotalAmmo() {
  const p = state.pistol;
  const b = state.bow;
  const s = state.sniper;
  const m = state.mg;
  const c = state.crossbow;
  return p.magazineBullets + p.reserveBullets + p.specialBullets + (p.chambered ? 1 : 0)
    + b.arrows + b.specialArrows + (b.arrowNocked ? 1 : 0)
    + s.reserveRounds + (s.chambered ? 1 : 0)
    + m.ammo + m.reserveAmmo
    + c.bolts + (c.loaded ? 1 : 0);
}

export function isGameOver() {
  return state.tower.hp <= 0;
}
