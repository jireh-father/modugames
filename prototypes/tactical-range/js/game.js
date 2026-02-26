// ── 게임 상수 ──
export const W = 540, H = 960;
export const HUD_H = 48;
export const RANGE_TOP = HUD_H;
export const RANGE_BOTTOM = Math.floor(H * 0.7); // 672
export const CONTROLS_TOP = RANGE_BOTTOM;
export const CONTROLS_BOTTOM = H;
export const SLOT_H = 40; // 무기 슬롯 높이

// ── 게임 상태 ──
export const state = {
  screen: 'title', // title | playing | gameover
  score: 0,
  combo: 0,
  maxCombo: 0,
  bestScore: parseInt(localStorage.getItem('tr_best') || '0'),
  time: 0,
  difficulty: 0, // 0~1

  // 에이밍 (화면 중앙 기준 오프셋)
  aimX: 0, // -1 ~ 1
  aimY: 0, // -1 ~ 1

  // 무기 선택
  currentWeapon: 'pistol', // pistol | bow

  // 권총
  pistol: {
    magazineBullets: 6,
    magazineMax: 6,
    reserveBullets: 0,
    chambered: true,
    magazineOut: false,
    slideBack: false,
    specialBullets: 0,
  },

  // 활
  bow: {
    arrows: 3,
    specialArrows: 0,
    arrowNocked: false,
    drawPower: 0,
    drawing: false,
  },

  // 엔티티 배열
  targets: [],
  projectiles: [],
  items: [],
  particles: [],
  obstacles: [],

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
  state.aimX = 0;
  state.aimY = 0;
  state.currentWeapon = 'pistol';
  state.pistol = {
    magazineBullets: 6, magazineMax: 6, reserveBullets: 0,
    chambered: true, magazineOut: false, slideBack: false, specialBullets: 0,
  };
  state.bow = {
    arrows: 3, specialArrows: 0, arrowNocked: false, drawPower: 0, drawing: false,
  };
  state.targets = [];
  state.projectiles = [];
  state.items = [];
  state.particles = [];
  state.obstacles = [];
  state.slowMo = false;
  state.slowMoTimer = 0;
}

export function getTotalAmmo() {
  const p = state.pistol;
  const b = state.bow;
  return p.magazineBullets + p.reserveBullets + p.specialBullets
    + (p.chambered ? 1 : 0) + b.arrows + b.specialArrows
    + (b.arrowNocked ? 1 : 0);
}

export function isGameOver() {
  return getTotalAmmo() <= 0;
}
