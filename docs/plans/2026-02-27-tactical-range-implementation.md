# Tactical Range Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 리얼 조작감 사격장 서바이벌 게임 - 권총과 활을 실제처럼 조작하며 과녁을 맞추는 무한 서바이벌

**Architecture:** ES 모듈 기반 멀티파일 구조. index.html이 각 JS 모듈을 로드. Canvas 2D로 렌더링, Web Audio API로 사운드 합성. 게임 상태는 game.js에서 중앙 관리, 각 시스템(무기, 과녁, 아이템 등)은 독립 모듈.

**Tech Stack:** Vanilla HTML5 Canvas, ES Modules (`<script type="module">`), Web Audio API, localStorage

**파일 구조:**
```
prototypes/tactical-range/
├── index.html          # 메인 HTML (캔버스 + 모듈 로드)
├── js/
│   ├── main.js         # 엔트리포인트, 게임 루프
│   ├── game.js         # 게임 상태 관리 (점수, 난이도, 서바이벌)
│   ├── renderer.js     # 사격장 배경, 원근감 렌더링
│   ├── input.js        # 터치/마우스 드래그 시스템
│   ├── aiming.js       # 에이밍 (시야 이동, 조준선)
│   ├── pistol.js       # 권총 조작 (장전, 발사, 재장전)
│   ├── bow.js          # 활 조작 (화살 장전, 시위, 발사)
│   ├── targets.js      # 과녁 시스템 (5종류 + 이동 + 장애물)
│   ├── projectiles.js  # 탄환/화살 물리 + 충돌
│   ├── items.js        # 아이템 드랍 & 줍기
│   ├── audio.js        # Web Audio 사운드 합성
│   ├── hud.js          # HUD (점수, 콤보, 탄약)
│   └── particles.js    # 파티클 (화염, 파편, 이펙트)
```

---

### Task 1: 프로젝트 스캐폴딩 + 캔버스 셋업

**Files:**
- Create: `prototypes/tactical-range/index.html`
- Create: `prototypes/tactical-range/js/main.js`
- Create: `prototypes/tactical-range/js/game.js`

**Step 1:** `index.html` 생성 - 캔버스 + 스타일 + 모듈 로드

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<title>Tactical Range</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#111; display:flex; justify-content:center; align-items:center; height:100vh; overflow:hidden; touch-action:none; }
canvas { display:block; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script type="module" src="js/main.js"></script>
</body>
</html>
```

**Step 2:** `game.js` 생성 - 게임 상태 중앙 관리

```javascript
// 게임 상수
export const W = 540, H = 960;
export const RANGE_TOP = 48;        // HUD 아래
export const RANGE_BOTTOM = 672;    // 사격장 하단 (70%)
export const CONTROLS_TOP = 672;    // 조작부 상단
export const CONTROLS_BOTTOM = 960;

// 게임 상태
export const state = {
  screen: 'title',  // title | playing | gameover
  score: 0,
  combo: 0,
  maxCombo: 0,
  highScore: parseInt(localStorage.getItem('tr_high') || '0'),
  time: 0,           // 경과 시간 (난이도 계산용)
  difficulty: 0,     // 0~1 난이도 진행도

  // 에이밍
  aimX: 0,  // -1 ~ 1 (좌우)
  aimY: 0,  // -1 ~ 1 (상하)

  // 무기
  currentWeapon: 'pistol',  // pistol | bow

  // 권총 탄약
  pistol: {
    magazineBullets: 6,   // 탄창 내 탄환 수
    magazineMax: 6,
    reserveBullets: 0,    // 예비 탄환
    chambered: false,     // 약실 장전 여부
    magazineOut: false,   // 탄창 분리 상태
    slideBack: false,     // 슬라이드 후퇴 상태
    specialBullets: 0,    // 금색 관통탄
  },

  // 활 탄약
  bow: {
    arrows: 3,
    specialArrows: 0,     // 폭발 화살
    arrowNocked: false,   // 화살 장전 상태
    drawPower: 0,         // 시위 당김 파워 0~1
  },

  targets: [],
  projectiles: [],
  items: [],
  particles: [],
  obstacles: [],
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
  state.pistol = { magazineBullets: 6, magazineMax: 6, reserveBullets: 0, chambered: true, magazineOut: false, slideBack: false, specialBullets: 0 };
  state.bow = { arrows: 3, specialArrows: 0, arrowNocked: false, drawPower: 0 };
  state.targets = [];
  state.projectiles = [];
  state.items = [];
  state.particles = [];
  state.obstacles = [];
}

export function isGameOver() {
  const p = state.pistol;
  const b = state.bow;
  const totalAmmo = p.magazineBullets + p.reserveBullets + p.specialBullets + (p.chambered ? 1 : 0) + b.arrows + b.specialArrows;
  return totalAmmo <= 0;
}
```

**Step 3:** `main.js` 생성 - 게임 루프

```javascript
import { W, H, state } from './game.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

function resize() {
  const scale = Math.min(innerWidth / W, innerHeight / H);
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = (W * scale) + 'px';
  canvas.style.height = (H * scale) + 'px';
}
resize();
addEventListener('resize', resize);

let lastTime = 0;

function loop(time) {
  requestAnimationFrame(loop);
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  update(dt);
  draw();
}

function update(dt) {
  if (state.screen !== 'playing') return;
  state.time += dt;
  state.difficulty = Math.min(state.time / 180, 1); // 3분에 걸쳐 최대 난이도
}

function draw() {
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, W, H);

  // placeholder
  ctx.fillStyle = '#fff';
  ctx.font = '24px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Tactical Range', W/2, H/2);
  ctx.font = '14px monospace';
  ctx.fillText('Screen: ' + state.screen, W/2, H/2 + 30);
}

export { canvas, ctx };
requestAnimationFrame(loop);
```

**Step 4:** 브라우저에서 확인 - 검은 화면에 "Tactical Range" 텍스트 표시

**Step 5:** 커밋
```bash
git add prototypes/tactical-range/
git commit -m "feat: scaffold Tactical Range project with ES module structure"
```

---

### Task 2: 입력 시스템 (드래그 핸들러)

**Files:**
- Create: `prototypes/tactical-range/js/input.js`
- Modify: `prototypes/tactical-range/js/main.js`

모든 터치/마우스 입력을 추상화하는 모듈. 드래그 시작/이동/끝 이벤트를 영역별로 라우팅.

**구현:** 캔버스 좌표 변환, 멀티터치 미지원(단일 포인터), 드래그 상태 추적, 영역별 콜백 등록 시스템.

**커밋:** `feat: add input system with drag handling`

---

### Task 3: 사격장 배경 렌더링 + 원근감

**Files:**
- Create: `prototypes/tactical-range/js/renderer.js`
- Modify: `prototypes/tactical-range/js/main.js`

나무 벽, 바닥, 천장 조명, 사격 레인을 원근법으로 렌더링. 소실점 기반 원근감 함수 제공 (worldToScreen: 3D 좌표 → 2D 캔버스 좌표 변환).

**핵심 함수:**
- `worldToScreen(x, y, z)` → `{sx, sy, scale}` (z=0 가까움, z=1 멀리)
- `drawRange(ctx, aimX, aimY)` - 에이밍 오프셋 반영한 배경

**커밋:** `feat: add shooting range renderer with perspective`

---

### Task 4: 에이밍 시스템

**Files:**
- Create: `prototypes/tactical-range/js/aiming.js`
- Modify: `prototypes/tactical-range/js/main.js`

사격장 영역(상단 70%)을 드래그하면 시야가 이동. state.aimX, aimY 업데이트. 십자선(크로스헤어) 렌더링.

**커밋:** `feat: add aiming system with crosshair`

---

### Task 5: 권총 렌더링 + 조작

**Files:**
- Create: `prototypes/tactical-range/js/pistol.js`
- Modify: `prototypes/tactical-range/js/main.js`

하단 조작부에 권총 UI 렌더링. 3개 영역(탄창, 총기/슬라이드, 방아쇠)에서 드래그 제스처 감지.

**조작 구현:**
- 슬라이드: 아래로 드래그 후 놓기 → chambered = true
- 탄창 분리: 왼쪽 드래그 → magazineOut = true
- 탄환 넣기: 총알통→탄창 드래그 → magazineBullets++
- 탄창 삽입: 오른쪽 드래그 → magazineOut = false
- 방아쇠: 뒤로 드래그 → 발사 (chambered일 때만)

**커밋:** `feat: add pistol weapon with realistic reload controls`

---

### Task 6: 활 렌더링 + 조작

**Files:**
- Create: `prototypes/tactical-range/js/bow.js`
- Modify: `prototypes/tactical-range/js/main.js`

하단 조작부에 활 UI 렌더링. 화살통에서 드래그, 활 중앙에 드롭, 시위 아래로 당기기.

**조작 구현:**
- 화살통 드래그 → 화살 따라오기
- 활 중앙에 드롭 → arrowNocked = true
- 시위 아래로 드래그 → drawPower = 드래그 거리 / 최대거리
- 놓기 → 발사 (drawPower만큼 속도)

**커밋:** `feat: add bow weapon with draw-and-release controls`

---

### Task 7: 발사체 시스템 (탄환 + 화살)

**Files:**
- Create: `prototypes/tactical-range/js/projectiles.js`
- Modify: `prototypes/tactical-range/js/main.js`

발사 시 발사체 생성, 3D 공간에서 이동, 화면에 렌더링.
- 탄환: 직선 고속 이동
- 화살: 포물선 궤적 + 잔상

**커밋:** `feat: add projectile system with bullet and arrow physics`

---

### Task 8: 과녁 시스템

**Files:**
- Create: `prototypes/tactical-range/js/targets.js`
- Modify: `prototypes/tactical-range/js/main.js`

5종류 과녁 생성, 이동, 렌더링. 난이도에 따른 스폰 로직.
- 일반: 좌우 이동 (난이도↑ → 속도↑, 크기↓)
- 고속: 작고 빠름
- 금색: 아이템 확정 드랍
- 보너스: 잠깐 나타났다 사라짐
- 보급품: 낙하산 달고 위에서 낙하

장애물(가림막) 생성 및 렌더링도 포함.

**커밋:** `feat: add target system with 5 types and obstacles`

---

### Task 9: 충돌 감지 + 점수

**Files:**
- Modify: `prototypes/tactical-range/js/projectiles.js`
- Modify: `prototypes/tactical-range/js/targets.js`
- Modify: `prototypes/tactical-range/js/game.js`

발사체 ↔ 과녁 충돌 판정. 명중 부위(중앙~외곽) 점수 계산. 거리 배율. 콤보 시스템.

**점수 공식:** `부위점수(1~10) × 거리배율(1x/2x/3x) × 콤보배율`

**커밋:** `feat: add collision detection and scoring system`

---

### Task 10: 아이템 드랍 & 줍기

**Files:**
- Create: `prototypes/tactical-range/js/items.js`
- Modify: `prototypes/tactical-range/js/main.js`

드랍 조건 4가지 체크 → 아이템 생성 → 사격장에 떨어짐 → 터치로 줍기 → 탄약 추가. 시간 초과 시 깜빡이며 사라짐.

**커밋:** `feat: add item drop and pickup system`

---

### Task 11: HUD + 무기 교체

**Files:**
- Create: `prototypes/tactical-range/js/hud.js`
- Modify: `prototypes/tactical-range/js/main.js`

상단 HUD: 점수, 콤보, 탄약 현황. 하단 무기 슬롯(권총/활 탭 교체). 탄약 부족 시 빨간 점멸. 마지막 1발 슬로모션.

**커밋:** `feat: add HUD and weapon switching`

---

### Task 12: 사운드 시스템

**Files:**
- Create: `prototypes/tactical-range/js/audio.js`
- Modify: 각 무기/과녁/아이템 모듈에서 import

Web Audio API로 모든 효과음 프로시저럴 합성. 첫 터치 시 AudioContext 생성.

**사운드 목록:** 총성, 슬라이드, 탄창, 활시위, 화살, 과녁명중, 보급품낙하, 콤보, 게임오버

**커밋:** `feat: add procedural audio system`

---

### Task 13: 파티클 이펙트

**Files:**
- Create: `prototypes/tactical-range/js/particles.js`
- Modify: `prototypes/tactical-range/js/main.js`

총구 화염, 과녁 파편, 명중 이펙트, 콤보 텍스트 파티클.

**커밋:** `feat: add particle effects system`

---

### Task 14: 게임 오버 + 타이틀 화면

**Files:**
- Modify: `prototypes/tactical-range/js/main.js`
- Modify: `prototypes/tactical-range/js/hud.js`

타이틀 화면 (탭하여 시작), 게임 오버 화면 (최종 점수, 하이스코어, 재시작). localStorage 하이스코어 저장.

**커밋:** `feat: add title screen and game over with high score`

---

### Task 15: 1차 기획서 검증

**설계 문서 대조 체크리스트:**
- [ ] 화면 레이아웃 (70/30 비율)
- [ ] 에이밍 (좌우+상하 자유 조준)
- [ ] 권총 조작 (슬라이드↓, 탄창←분리, 탄환 드래그, 탄창→삽입, 방아쇠)
- [ ] 활 조작 (화살통→활 드래그, 시위↓당기기, 놓으면 발사)
- [ ] 과녁 5종류 (일반, 고속, 금색, 보너스, 보급품 낙하산)
- [ ] 장애물 (가림막)
- [ ] 점수 체계 (부위×거리×콤보)
- [ ] 드랍 조건 4가지
- [ ] 아이템 6종류
- [ ] 아이템 터치로 줍기
- [ ] 난이도 진행 (초반/중반/후반)
- [ ] 긴장감 연출 (빨간 점멸, 슬로모션)
- [ ] 사운드 9종
- [ ] 비주얼 (리얼리스틱 사격장)
- [ ] 무기 슬롯 탭 교체
- [ ] 서바이벌 루프 (탄약 소진 = 게임 오버)
- [ ] 시작 탄약 (권총 6발, 화살 3개)

**누락/불일치 항목 수정 후 커밋**

---

### Task 16: 2차 기획서 검증 + 폴리시

전체 플레이 흐름 시뮬레이션:
1. 타이틀 → 탭 → 게임 시작
2. 정지 과녁 등장 → 조준 → 장전 → 발사 → 명중
3. 콤보 → 아이템 드랍 → 줍기
4. 무기 교체 → 활 → 화살 장전 → 시위 당기기 → 발사
5. 난이도 상승 → 이동 과녁 + 장애물
6. 보급품 낙하산 → 사격 → 아이템
7. 탄약 소진 → 게임 오버 → 하이스코어
8. 재시작

**모든 플로우 동작 확인, 버그 수정 후 커밋**

---

### Task 17: 브라우저 테스트 + 버그 픽스

Playwright로 실제 브라우저에서 게임 실행:
1. 화면 렌더링 확인
2. 터치/클릭 입력 동작 확인
3. 권총 발사 플로우 테스트
4. 활 발사 플로우 테스트
5. 과녁 명중 + 점수 확인
6. 아이템 드랍 + 줍기 확인
7. 게임 오버 + 재시작 확인
8. 발견된 모든 버그 수정

**모든 버그 수정 완료 후 최종 커밋**
