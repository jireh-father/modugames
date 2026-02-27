// ── 권총 시스템: 렌더링 + 조작 ──
import { state, W, H, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H } from './game.js?v=3';
import { registerZone } from './input.js?v=3';
import { fireProjectile } from './projectiles.js?v=3';
import { playGunshot, playSlideRack, playMagOut, playMagIn, playBulletLoad } from './audio.js?v=3';
import { spawnParticles } from './particles.js?v=3';

const JOYSTICK_W = 0; // 다이얼 기반 조준으로 조이스틱 오프셋 불필요

const CTRL_Y = CONTROLS_TOP + SLOT_H;
const CTRL_H = CONTROLS_BOTTOM - CTRL_Y;
const WEAPON_W = W - JOYSTICK_W;
const COL_W = WEAPON_W / 3;

// ── 일반 모드 드래그 상태 ──
let slideDragY = 0;
let slideDragging = false;
let triggerDragY = 0;
let triggerDragging = false;
let triggerLastX = 0;
let magDragY = 0;
let magDragging = false;

// ── 재장전 팝업 상태 ──
let bulletDrag = null;   // {x, y} 총알 드래그 중
let magPopupDrag = null; // {x, y} 탄창 드래그 중 (위로 올려서 삽입)

// 재장전 팝업 레이아웃 상수
const POPUP_Y = CTRL_Y;
const POPUP_H = CTRL_H;
const POPUP_GUN_Y = POPUP_Y + 10;
const POPUP_GUN_H = 70;
const POPUP_CONTENT_Y = POPUP_GUN_Y + POPUP_GUN_H + 10;
const POPUP_CONTENT_H = POPUP_H - POPUP_GUN_H - 30;
const MAG_AREA_X = JOYSTICK_W + 10;
const MAG_AREA_W = WEAPON_W / 2 - 15;
const AMMO_AREA_X = JOYSTICK_W + WEAPON_W / 2 + 5;
const AMMO_AREA_W = WEAPON_W / 2 - 15;
// 총 드롭 영역 (탄창을 위로 올려놓는 곳)
const GUN_DROP = { x: JOYSTICK_W + WEAPON_W / 2 - 50, y: POPUP_GUN_Y, w: 100, h: POPUP_GUN_H };

export function initPistol() {
  // ── 슬라이드 영역 (왼쪽) ──
  registerZone(
    { x: JOYSTICK_W, y: CTRL_Y, w: COL_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'pistol' || state.pistol.reloadMode) return false;
        slideDragging = true;
        slideDragY = 0;
      },
      onMove(x, y, dx, dy) {
        if (!slideDragging || state.currentWeapon !== 'pistol') return;
        slideDragY = Math.max(0, Math.min(60, dy));
      },
      onEnd(x, y, dx, dy) {
        if (!slideDragging || state.currentWeapon !== 'pistol') return;
        slideDragging = false;
        const p = state.pistol;
        if (slideDragY > 30 && !p.magazineOut && p.magazineBullets > 0 && !p.chambered) {
          p.magazineBullets--;
          p.chambered = true;
          p.slideBack = false;
          playSlideRack();
        }
        slideDragY = 0;
      },
    },
    5
  );

  // ── 방아쇠 영역 (가운데) - 터치+좌우 드래그=조준, 놓으면 발사 ──
  registerZone(
    { x: JOYSTICK_W + COL_W, y: CTRL_Y, w: COL_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'pistol' || state.pistol.reloadMode) return false;
        triggerDragging = true;
        triggerDragY = 20; // 시각 피드백용
        triggerLastX = x;
      },
      onMove(x, y, dx, dy) {
        if (!triggerDragging || state.currentWeapon !== 'pistol') return;
        triggerDragY = Math.max(0, Math.min(40, dy));
        // 좌우 드래그로 조준 이동
        const frameDx = x - triggerLastX;
        triggerLastX = x;
        const aimSens = 0.005;
        state.aimAngle = Math.max(0.15, Math.min(Math.PI - 0.15, state.aimAngle - frameDx * aimSens));
      },
      onEnd() {
        if (!triggerDragging || state.currentWeapon !== 'pistol') { triggerDragging = false; return; }
        triggerDragging = false;
        triggerDragY = 0;

        // 놓으면 발사
        const p = state.pistol;
        if (p.chambered) {
          p.chambered = false;
          const isSpecial = p.specialBullets > 0;
          if (isSpecial) p.specialBullets--;

          fireProjectile('bullet', state.aimAngle, isSpecial);
          playGunshot();
          spawnParticles(W / 2, CONTROLS_TOP - 10, 'muzzleFlash');

          // 반자동: 탄창에 탄이 남아있으면 자동 장전
          if (p.magazineBullets > 0) {
            p.magazineBullets--;
            p.chambered = true;
            p.slideBack = false;
          } else {
            p.slideBack = true;
          }
        }
      },
    },
    5
  );

  // ── 탄창 영역 (오른쪽) - 아래로 드래그하면 분리 & 팝업 ──
  registerZone(
    { x: JOYSTICK_W + COL_W * 2, y: CTRL_Y, w: COL_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'pistol' || state.pistol.reloadMode) return false;
        magDragging = true;
        magDragY = 0;
      },
      onMove(x, y, dx, dy) {
        if (!magDragging || state.currentWeapon !== 'pistol') return;
        magDragY = Math.max(0, dy); // 아래로만
      },
      onEnd(x, y, dx, dy) {
        if (!magDragging || state.currentWeapon !== 'pistol') return;
        magDragging = false;
        const p = state.pistol;
        // 아래로 충분히 드래그 → 탄창 분리 + 재장전 팝업
        if (magDragY > 40) {
          p.magazineOut = true;
          p.chambered = false;
          p.reloadMode = true;
          playMagOut();
        }
        magDragY = 0;
      },
    },
    5
  );

  // ── 재장전 팝업 영역 (전체 무기 영역 사용) ──
  registerZone(
    { x: JOYSTICK_W, y: CTRL_Y, w: WEAPON_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'pistol' || !state.pistol.reloadMode) return false;
        const p = state.pistol;
        bulletDrag = null;
        magPopupDrag = null;

        // 총알통 영역에서 시작 → 총알 드래그
        if (x >= AMMO_AREA_X && x <= AMMO_AREA_X + AMMO_AREA_W
            && y >= POPUP_CONTENT_Y && y <= POPUP_CONTENT_Y + POPUP_CONTENT_H
            && p.reserveBullets > 0) {
          bulletDrag = { x, y };
          return;
        }

        // 탄창 영역에서 시작 → 탄창 드래그
        if (x >= MAG_AREA_X && x <= MAG_AREA_X + MAG_AREA_W
            && y >= POPUP_CONTENT_Y && y <= POPUP_CONTENT_Y + POPUP_CONTENT_H) {
          magPopupDrag = { x, y };
          return;
        }
      },
      onMove(x, y) {
        if (!state.pistol.reloadMode) return;
        if (bulletDrag) {
          bulletDrag.x = x;
          bulletDrag.y = y;
          return;
        }
        if (magPopupDrag) {
          magPopupDrag.x = x;
          magPopupDrag.y = y;
        }
      },
      onEnd(x, y) {
        if (!state.pistol.reloadMode) return;
        const p = state.pistol;

        // 총알 드래그 → 탄창 영역에 드롭
        if (bulletDrag) {
          if (x >= MAG_AREA_X && x <= MAG_AREA_X + MAG_AREA_W
              && y >= POPUP_CONTENT_Y && y <= POPUP_CONTENT_Y + POPUP_CONTENT_H
              && p.magazineBullets < p.magazineMax) {
            p.magazineBullets++;
            p.reserveBullets--;
            playBulletLoad();
          }
          bulletDrag = null;
          return;
        }

        // 탄창 드래그 → 총 위치에 드롭 → 삽입
        if (magPopupDrag) {
          if (x >= GUN_DROP.x && x <= GUN_DROP.x + GUN_DROP.w
              && y >= GUN_DROP.y && y <= GUN_DROP.y + GUN_DROP.h) {
            p.magazineOut = false;
            p.reloadMode = false;
            playMagIn();
          }
          magPopupDrag = null;
          return;
        }
      },
    },
    6 // 팝업이 일반 조작보다 우선
  );
}

// ═══════════════════════════════════════════
// 렌더링
// ═══════════════════════════════════════════

export function drawPistol(ctx) {
  if (state.currentWeapon !== 'pistol') return;

  const p = state.pistol;

  if (p.reloadMode) {
    drawReloadPopup(ctx);
    return;
  }

  drawNormalMode(ctx);
}

// ── 일반 모드 (슬라이드 | 방아쇠 | 탄창) ──
function drawNormalMode(ctx) {
  const p = state.pistol;
  const baseY = CTRL_Y + 30;
  const ox = JOYSTICK_W;

  ctx.save();

  // 영역 구분선
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ox, CTRL_Y);
  ctx.lineTo(ox, CONTROLS_BOTTOM);
  ctx.moveTo(ox + COL_W, CTRL_Y);
  ctx.lineTo(ox + COL_W, CONTROLS_BOTTOM);
  ctx.moveTo(ox + COL_W * 2, CTRL_Y);
  ctx.lineTo(ox + COL_W * 2, CONTROLS_BOTTOM);
  ctx.stroke();

  // 레이블
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('슬라이드', ox + COL_W / 2, CTRL_Y + 14);
  ctx.fillText('방아쇠', ox + COL_W * 1.5, CTRL_Y + 14);
  ctx.fillText('탄창', ox + COL_W * 2.5, CTRL_Y + 14);

  // ── 슬라이드 ──
  const slideOff = slideDragging ? slideDragY : 0;
  const slideX = ox + COL_W / 2;
  const slideY = baseY + 50 + slideOff;

  const gunGrad = ctx.createLinearGradient(slideX - 30, 0, slideX + 30, 0);
  gunGrad.addColorStop(0, '#444');
  gunGrad.addColorStop(0.5, '#666');
  gunGrad.addColorStop(1, '#444');
  ctx.fillStyle = gunGrad;
  ctx.fillRect(slideX - 30, baseY + 40, 60, 120);

  const slideGrad = ctx.createLinearGradient(slideX - 28, 0, slideX + 28, 0);
  slideGrad.addColorStop(0, '#555');
  slideGrad.addColorStop(0.3, '#888');
  slideGrad.addColorStop(0.7, '#888');
  slideGrad.addColorStop(1, '#555');
  ctx.fillStyle = slideGrad;
  ctx.fillRect(slideX - 28, slideY - 10, 56, 50);

  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const ly = slideY - 5 + i * 9;
    ctx.beginPath();
    ctx.moveTo(slideX - 25, ly);
    ctx.lineTo(slideX + 25, ly);
    ctx.stroke();
  }

  ctx.fillStyle = p.chambered ? '#4a4' : (p.slideBack ? '#a44' : '#aa4');
  ctx.beginPath();
  ctx.arc(slideX, slideY - 18, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(p.chambered ? '장전됨' : '↓드래그: 장전', slideX, CONTROLS_BOTTOM - 8);

  // ── 방아쇠 ──
  const trigX = ox + COL_W + COL_W / 2;
  const trigY = baseY + 80;
  const trigOff = triggerDragging ? triggerDragY : 0;

  ctx.strokeStyle = '#666';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(trigX, trigY, 35, 0.3, Math.PI - 0.3);
  ctx.stroke();

  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.moveTo(trigX, trigY - 15 + trigOff);
  ctx.lineTo(trigX + 8, trigY + trigOff);
  ctx.lineTo(trigX, trigY + 20 + trigOff);
  ctx.lineTo(trigX - 8, trigY + trigOff);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('드래그:조준 놓기:발사', trigX, CONTROLS_BOTTOM - 8);

  // ── 탄창 ──
  const magColX = ox + COL_W * 2;
  const magX = magColX + COL_W / 2;
  const magOff = magDragging ? Math.min(magDragY, 60) : 0;
  drawMagazine(ctx, magX, baseY + 50 + magOff, p.magazineBullets, p.magazineMax);

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('↓드래그: 탄창 분리', magColX + COL_W / 2, CONTROLS_BOTTOM - 8);

  ctx.restore();
}

// ── 재장전 팝업 ──
function drawReloadPopup(ctx) {
  const p = state.pistol;
  const ox = JOYSTICK_W;

  ctx.save();

  // 배경 (어두운 오버레이)
  ctx.fillStyle = 'rgba(20,15,10,0.95)';
  ctx.fillRect(ox, POPUP_Y, WEAPON_W, POPUP_H);
  ctx.strokeStyle = 'rgba(255,200,100,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(ox + 1, POPUP_Y + 1, WEAPON_W - 2, POPUP_H - 2);

  // ── 상단: 총 실루엣 (탄창 삽입 드롭 영역) ──
  ctx.fillStyle = '#2a2520';
  ctx.fillRect(GUN_DROP.x, GUN_DROP.y, GUN_DROP.w, GUN_DROP.h);
  ctx.strokeStyle = 'rgba(255,200,100,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(GUN_DROP.x, GUN_DROP.y, GUN_DROP.w, GUN_DROP.h);

  // 총 실루엣
  const gunCX = GUN_DROP.x + GUN_DROP.w / 2;
  const gunCY = GUN_DROP.y + GUN_DROP.h / 2;
  ctx.fillStyle = '#555';
  ctx.fillRect(gunCX - 35, gunCY - 12, 70, 24); // 몸체
  ctx.fillStyle = '#444';
  ctx.fillRect(gunCX - 5, gunCY + 5, 15, 25);   // 그립
  // 탄창 슬롯 표시 (비어있음)
  ctx.strokeStyle = '#aa8844';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(gunCX - 8, gunCY + 8, 20, 20);
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(255,200,100,0.5)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('↑탄창을 여기로', gunCX, GUN_DROP.y + GUN_DROP.h - 4);

  // ── 구분선 ──
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  const midX = JOYSTICK_W + WEAPON_W / 2;
  ctx.beginPath();
  ctx.moveTo(midX, POPUP_CONTENT_Y);
  ctx.lineTo(midX, POPUP_CONTENT_Y + POPUP_CONTENT_H);
  ctx.stroke();

  // ── 왼쪽: 탄창 ──
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('탄창', MAG_AREA_X + MAG_AREA_W / 2, POPUP_CONTENT_Y + 14);

  // 탄창 그리기 (드래그 중이면 드래그 위치에)
  if (magPopupDrag) {
    drawMagazine(ctx, magPopupDrag.x, magPopupDrag.y - 40, p.magazineBullets, p.magazineMax);
  } else {
    const magX = MAG_AREA_X + MAG_AREA_W / 2;
    const magY = POPUP_CONTENT_Y + 30;
    drawMagazine(ctx, magX, magY, p.magazineBullets, p.magazineMax);
  }

  // ── 오른쪽: 총알통 ──
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('총알통', AMMO_AREA_X + AMMO_AREA_W / 2, POPUP_CONTENT_Y + 14);

  // 총알통 상자
  const boxX = AMMO_AREA_X + 10;
  const boxY = POPUP_CONTENT_Y + 25;
  const boxW = AMMO_AREA_W - 20;
  const boxH = POPUP_CONTENT_H - 50;
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = '#6a5a3a';
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  // 총알들
  const cols = Math.floor(boxW / 16);
  for (let i = 0; i < Math.min(p.reserveBullets, cols * 6); i++) {
    const bx = boxX + 8 + (i % cols) * 16;
    const by = boxY + 14 + Math.floor(i / cols) * 22;
    drawBulletSmall(ctx, bx, by);
  }
  if (p.reserveBullets > cols * 6) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`+${p.reserveBullets - cols * 6}`, AMMO_AREA_X + AMMO_AREA_W / 2, boxY + boxH - 5);
  }

  // 남은 총알 수
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`× ${p.reserveBullets}`, AMMO_AREA_X + AMMO_AREA_W / 2, POPUP_CONTENT_Y + POPUP_CONTENT_H - 5);

  // ── 드래그 중인 총알 ──
  if (bulletDrag) {
    ctx.fillStyle = '#ffcc44';
    drawBulletSmall(ctx, bulletDrag.x, bulletDrag.y);
    // 탄창 위에 있으면 하이라이트
    if (bulletDrag.x >= MAG_AREA_X && bulletDrag.x <= MAG_AREA_X + MAG_AREA_W
        && bulletDrag.y >= POPUP_CONTENT_Y && p.magazineBullets < p.magazineMax) {
      ctx.strokeStyle = 'rgba(255,200,100,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(MAG_AREA_X, POPUP_CONTENT_Y + 20, MAG_AREA_W, POPUP_CONTENT_H - 30);
    }
  }

  // ── 탄창 드래그 중 → 총 위치 하이라이트 ──
  if (magPopupDrag) {
    if (magPopupDrag.y < GUN_DROP.y + GUN_DROP.h + 20) {
      ctx.strokeStyle = 'rgba(100,255,100,0.6)';
      ctx.lineWidth = 3;
      ctx.strokeRect(GUN_DROP.x - 2, GUN_DROP.y - 2, GUN_DROP.w + 4, GUN_DROP.h + 4);
    }
  }

  // 힌트
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('총알→탄창 / 탄창↑총', ox + WEAPON_W / 2, CONTROLS_BOTTOM - 5);

  ctx.restore();
}

// ── 공통 렌더링 헬퍼 ──

function drawMagazine(ctx, x, y, bullets, max) {
  ctx.fillStyle = '#555';
  ctx.fillRect(x - 15, y, 30, 80);
  ctx.strokeStyle = '#777';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 15, y, 30, 80);

  for (let i = 0; i < max; i++) {
    const by = y + 70 - i * 12;
    if (i < bullets) {
      ctx.fillStyle = '#cca040';
      ctx.fillRect(x - 10, by, 20, 10);
      ctx.fillStyle = '#aa7020';
      ctx.fillRect(x - 10, by, 6, 10);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x - 10, by, 20, 10);
    }
  }

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${bullets}/${max}`, x, y - 5);
}

function drawBulletSmall(ctx, x, y) {
  ctx.fillStyle = '#cca040';
  ctx.fillRect(x - 3, y - 7, 6, 14);
  ctx.fillStyle = '#aa7020';
  ctx.fillRect(x - 3, y - 7, 6, 5);
}
