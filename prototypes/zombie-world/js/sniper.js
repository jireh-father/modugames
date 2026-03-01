// ── 저격총 시스템: 볼트액션 + 권총식 탄창 ──
import { state, W, H, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H, ITEM_BAR_H, FIELD_TOP, TOWER_Y } from './game.js?v=31';
import { registerZone } from './input.js?v=31';
import { fireProjectile } from './projectiles.js?v=31';
import { playSniperShot, playSniperBoltUp, playSniperBoltDown, playSniperLoad, playScopeZoom } from './audio.js?v=31';
import { spawnParticles } from './particles.js?v=31';

const CTRL_Y = CONTROLS_TOP + SLOT_H + ITEM_BAR_H;
const CTRL_H = CONTROLS_BOTTOM - CTRL_Y;
const WEAPON_W = W;
const COL_W = WEAPON_W / 3;

// ── 일반 모드 드래그 상태 ──
let boltDragY = 0;
let boltDragging = false;
let triggerDragging = false;
let triggerLastX = 0;
let triggerTotalDragX = 0;
let magDragY = 0;
let magDragging = false;

// ── 재장전 팝업 상태 ──
let bulletDrag = null;   // {x, y} 총알 드래그 중
let magPopupDrag = null; // {x, y} 탄창 드래그 중

// 재장전 팝업 레이아웃 상수
const POPUP_Y = CTRL_Y;
const POPUP_H = CTRL_H;
const POPUP_GUN_Y = POPUP_Y + 10;
const POPUP_GUN_H = 70;
const POPUP_CONTENT_Y = POPUP_GUN_Y + POPUP_GUN_H + 10;
const POPUP_CONTENT_H = POPUP_H - POPUP_GUN_H - 30;
const MAG_AREA_X = 10;
const MAG_AREA_W = WEAPON_W / 2 - 15;
const AMMO_AREA_X = WEAPON_W / 2 + 5;
const AMMO_AREA_W = WEAPON_W / 2 - 15;
const GUN_DROP = { x: WEAPON_W / 2 - 50, y: POPUP_GUN_Y, w: 100, h: POPUP_GUN_H };

export function initSniper() {
  // ── 볼트 영역 (왼쪽) - 위로 드래그: 볼트 열기, 아래로: 볼트 닫기 ──
  registerZone(
    { x: 0, y: CTRL_Y, w: COL_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'sniper' || state.sniper.reloadMode) return false;
        boltDragging = true;
        boltDragY = 0;
      },
      onMove(x, y, dx, dy) {
        if (!boltDragging || state.currentWeapon !== 'sniper') return;
        boltDragY = Math.max(-60, Math.min(60, dy));
      },
      onEnd(x, y, dx, dy) {
        if (!boltDragging || state.currentWeapon !== 'sniper') return;
        boltDragging = false;
        const s = state.sniper;

        if (boltDragY < -30 && !s.boltOpen) {
          // 위로 드래그 → 볼트 열기 (탄피 배출)
          s.boltOpen = true;
          s.chambered = false;
          playSniperBoltUp();
        } else if (boltDragY > 30 && s.boltOpen) {
          // 아래로 드래그 → 볼트 닫기 (탄창에서 새 탄 장전)
          if (s.magazineBullets > 0) {
            s.magazineBullets--;
            s.chambered = true;
            s.boltOpen = false;
            playSniperBoltDown();
          } else {
            s.boltOpen = false;
            playSniperBoltDown();
          }
        }
        boltDragY = 0;
      },
    },
    5
  );

  // ── 방아쇠 영역 (가운데) - 터치+좌우 드래그=조준, 놓으면 발사 ──
  registerZone(
    { x: COL_W, y: CTRL_Y, w: COL_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'sniper' || state.sniper.reloadMode) return false;
        triggerDragging = true;
        triggerLastX = x;
        triggerTotalDragX = 0;
      },
      onMove(x, y) {
        if (!triggerDragging || state.currentWeapon !== 'sniper') return;
        const frameDx = x - triggerLastX;
        triggerTotalDragX += Math.abs(frameDx);
        triggerLastX = x;
        const aimSens = 0.005;
        state.aimAngle -= frameDx * aimSens; while (state.aimAngle < 0) state.aimAngle += Math.PI * 2; while (state.aimAngle >= Math.PI * 2) state.aimAngle -= Math.PI * 2;
      },
      onEnd() {
        if (!triggerDragging || state.currentWeapon !== 'sniper') { triggerDragging = false; return; }
        triggerDragging = false;

        if (triggerTotalDragX >= 10) return;

        const s = state.sniper;
        if (s.chambered && !s.boltOpen) {
          s.chambered = false;
          fireProjectile('sniper', state.aimAngle);
          playSniperShot();
          spawnParticles(W / 2, CONTROLS_TOP - 10, 'muzzleFlash');
          // 자동 볼트 열림
          s.boltOpen = true;
        }
      },
    },
    5
  );

  // ── 탄창 영역 (오른쪽) - 아래로 드래그하면 분리 & 재장전 팝업 ──
  registerZone(
    { x: COL_W * 2, y: CTRL_Y, w: COL_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'sniper' || state.sniper.reloadMode) return false;
        magDragging = true;
        magDragY = 0;
      },
      onMove(x, y, dx, dy) {
        if (!magDragging || state.currentWeapon !== 'sniper') return;
        magDragY = Math.max(0, dy);
      },
      onEnd(x, y, dx, dy) {
        if (!magDragging || state.currentWeapon !== 'sniper') return;
        magDragging = false;
        const s = state.sniper;
        if (magDragY > 40) {
          s.magazineOut = true;
          s.chambered = false;
          s.reloadMode = true;
          playSniperBoltUp();
        }
        magDragY = 0;
      },
    },
    5
  );

  // ── 재장전 팝업 영역 (전체 무기 영역) ──
  registerZone(
    { x: 0, y: CTRL_Y, w: WEAPON_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'sniper' || !state.sniper.reloadMode) return false;
        const s = state.sniper;
        bulletDrag = null;
        magPopupDrag = null;

        // 총알통 영역에서 시작 → 총알 드래그
        if (x >= AMMO_AREA_X && x <= AMMO_AREA_X + AMMO_AREA_W
            && y >= POPUP_CONTENT_Y && y <= POPUP_CONTENT_Y + POPUP_CONTENT_H
            && s.reserveRounds > 0) {
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
        if (!state.sniper.reloadMode) return;
        if (bulletDrag) { bulletDrag.x = x; bulletDrag.y = y; return; }
        if (magPopupDrag) { magPopupDrag.x = x; magPopupDrag.y = y; }
      },
      onEnd(x, y) {
        if (!state.sniper.reloadMode) return;
        const s = state.sniper;

        // 총알 드래그 → 탄창에 드롭
        if (bulletDrag) {
          if (x >= MAG_AREA_X && x <= MAG_AREA_X + MAG_AREA_W
              && y >= POPUP_CONTENT_Y && y <= POPUP_CONTENT_Y + POPUP_CONTENT_H
              && s.magazineBullets < s.magazineMax) {
            s.magazineBullets++;
            s.reserveRounds--;
            playSniperLoad();
          }
          bulletDrag = null;
          return;
        }

        // 탄창 드래그 → 총에 삽입
        if (magPopupDrag) {
          if (x >= GUN_DROP.x && x <= GUN_DROP.x + GUN_DROP.w
              && y >= GUN_DROP.y && y <= GUN_DROP.y + GUN_DROP.h) {
            s.magazineOut = false;
            s.reloadMode = false;
            playSniperBoltDown();
          }
          magPopupDrag = null;
          return;
        }
      },
    },
    6 // 팝업이 일반 조작보다 우선
  );
}

// ── 업데이트 (스코프 제거 후 최소화) ──
export function updateSniper(dt) {
  // 현재는 특별 업데이트 없음
}

// ── 스코프 오버레이 (제거 - 빈 함수) ──
export function drawScopeOverlay(ctx) {
  // 스코프 기능 제거됨
}

// ── 조작부 렌더링 ──
export function drawSniper(ctx) {
  if (state.currentWeapon !== 'sniper') return;

  const s = state.sniper;

  if (s.reloadMode) {
    drawReloadPopup(ctx);
    return;
  }

  drawNormalMode(ctx);
}

function drawNormalMode(ctx) {
  const s = state.sniper;
  const baseY = CTRL_Y + 30;

  ctx.save();

  // 영역 구분선
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(COL_W, CTRL_Y);
  ctx.lineTo(COL_W, CONTROLS_BOTTOM);
  ctx.moveTo(COL_W * 2, CTRL_Y);
  ctx.lineTo(COL_W * 2, CONTROLS_BOTTOM);
  ctx.stroke();

  // 레이블
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('볼트', COL_W / 2, CTRL_Y + 14);
  ctx.fillText('방아쇠', COL_W * 1.5, CTRL_Y + 14);
  ctx.fillText('탄창', COL_W * 2.5, CTRL_Y + 14);

  // ── 볼트 영역 ──
  const boltX = COL_W / 2;
  const boltOff = boltDragging ? boltDragY : 0;

  // 총 몸체
  ctx.fillStyle = '#3a4a3a';
  ctx.fillRect(boltX - 35, baseY + 30, 70, 130);
  // 볼트 핸들
  const handleY = baseY + 70 + boltOff;
  ctx.fillStyle = s.boltOpen ? '#aaa' : '#666';
  ctx.fillRect(boltX - 10, handleY - 15, 20, 40);
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.arc(boltX + 12, handleY, 8, 0, Math.PI * 2);
  ctx.fill();

  // 상태 표시등
  ctx.fillStyle = s.chambered ? '#4a4' : (s.boltOpen ? '#aa4' : '#a44');
  ctx.beginPath();
  ctx.arc(boltX, handleY - 22, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(s.boltOpen ? '↓닫기: 장전' : '↑열기: 볼트', boltX, CONTROLS_BOTTOM - 8);

  // ── 방아쇠 ──
  const trigX = COL_W * 1.5;
  const trigY = baseY + 80;

  ctx.strokeStyle = '#556';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(trigX, trigY, 35, 0.3, Math.PI - 0.3);
  ctx.stroke();

  ctx.fillStyle = s.chambered ? '#6af' : '#555';
  ctx.beginPath();
  ctx.moveTo(trigX, trigY - 15);
  ctx.lineTo(trigX + 8, trigY);
  ctx.lineTo(trigX, trigY + 20);
  ctx.lineTo(trigX - 8, trigY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.fillText('드래그:조준 놓기:발사', trigX, CONTROLS_BOTTOM - 8);

  // ── 탄창 (권총식 10칸) ──
  const magColX = COL_W * 2;
  const magX = magColX + COL_W / 2;
  const magOff = magDragging ? Math.min(magDragY, 60) : 0;
  drawMagazine(ctx, magX, baseY + 30 + magOff, s.magazineBullets, s.magazineMax);

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('↓드래그: 탄창 분리', magColX + COL_W / 2, CONTROLS_BOTTOM - 8);

  ctx.restore();
}

// ── 재장전 팝업 (권총과 동일한 구조) ──
function drawReloadPopup(ctx) {
  const s = state.sniper;

  ctx.save();

  // 배경
  ctx.fillStyle = 'rgba(20,15,10,0.95)';
  ctx.fillRect(0, POPUP_Y, WEAPON_W, POPUP_H);
  ctx.strokeStyle = 'rgba(100,150,255,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(1, POPUP_Y + 1, WEAPON_W - 2, POPUP_H - 2);

  // ── 상단: 총 실루엣 ──
  ctx.fillStyle = '#2a2520';
  ctx.fillRect(GUN_DROP.x, GUN_DROP.y, GUN_DROP.w, GUN_DROP.h);
  ctx.strokeStyle = 'rgba(100,150,255,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(GUN_DROP.x, GUN_DROP.y, GUN_DROP.w, GUN_DROP.h);

  // 저격총 실루엣
  const gunCX = GUN_DROP.x + GUN_DROP.w / 2;
  const gunCY = GUN_DROP.y + GUN_DROP.h / 2;
  ctx.fillStyle = '#555';
  ctx.fillRect(gunCX - 45, gunCY - 8, 90, 16); // 긴 몸체
  ctx.fillStyle = '#444';
  ctx.fillRect(gunCX + 5, gunCY + 2, 12, 25);  // 그립
  // 스코프
  ctx.fillStyle = '#666';
  ctx.fillRect(gunCX - 20, gunCY - 14, 30, 6);
  // 탄창 슬롯
  ctx.strokeStyle = '#6688cc';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(gunCX - 5, gunCY + 4, 18, 20);
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(100,150,255,0.5)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('↑탄창을 여기로', gunCX, GUN_DROP.y + GUN_DROP.h - 4);

  // ── 구분선 ──
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  const midX = WEAPON_W / 2;
  ctx.beginPath();
  ctx.moveTo(midX, POPUP_CONTENT_Y);
  ctx.lineTo(midX, POPUP_CONTENT_Y + POPUP_CONTENT_H);
  ctx.stroke();

  // ── 왼쪽: 탄창 ──
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('탄창', MAG_AREA_X + MAG_AREA_W / 2, POPUP_CONTENT_Y + 14);

  if (magPopupDrag) {
    drawMagazine(ctx, magPopupDrag.x, magPopupDrag.y - 40, s.magazineBullets, s.magazineMax);
  } else {
    drawMagazine(ctx, MAG_AREA_X + MAG_AREA_W / 2, POPUP_CONTENT_Y + 30, s.magazineBullets, s.magazineMax);
  }

  // ── 오른쪽: 총알통 ──
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('총알통', AMMO_AREA_X + AMMO_AREA_W / 2, POPUP_CONTENT_Y + 14);

  const boxX = AMMO_AREA_X + 10;
  const boxY = POPUP_CONTENT_Y + 25;
  const boxW = AMMO_AREA_W - 20;
  const boxH = POPUP_CONTENT_H - 50;
  ctx.fillStyle = '#3a3a4a';
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeStyle = '#5a5a6a';
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  // 저격총 탄환 (더 큰 총알)
  const cols = Math.floor(boxW / 20);
  for (let i = 0; i < Math.min(s.reserveRounds, cols * 5); i++) {
    const bx = boxX + 8 + (i % cols) * 20;
    const by = boxY + 12 + Math.floor(i / cols) * 24;
    drawSniperBullet(ctx, bx, by);
  }
  if (s.reserveRounds > cols * 5) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`+${s.reserveRounds - cols * 5}`, AMMO_AREA_X + AMMO_AREA_W / 2, boxY + boxH - 5);
  }

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`× ${s.reserveRounds}`, AMMO_AREA_X + AMMO_AREA_W / 2, POPUP_CONTENT_Y + POPUP_CONTENT_H - 5);

  // ── 드래그 중인 총알 ──
  if (bulletDrag) {
    drawSniperBullet(ctx, bulletDrag.x, bulletDrag.y);
    if (bulletDrag.x >= MAG_AREA_X && bulletDrag.x <= MAG_AREA_X + MAG_AREA_W
        && bulletDrag.y >= POPUP_CONTENT_Y && s.magazineBullets < s.magazineMax) {
      ctx.strokeStyle = 'rgba(100,150,255,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(MAG_AREA_X, POPUP_CONTENT_Y + 20, MAG_AREA_W, POPUP_CONTENT_H - 30);
    }
  }

  // ── 탄창 드래그 → 총 하이라이트 ──
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
  ctx.fillText('총알→탄창 / 탄창↑총', WEAPON_W / 2, CONTROLS_BOTTOM - 5);

  ctx.restore();
}

// ── 공통 렌더링 헬퍼 ──

function drawMagazine(ctx, x, y, bullets, max) {
  // 저격총 탄창 (길쭉한 형태)
  ctx.fillStyle = '#4a4a55';
  ctx.fillRect(x - 18, y, 36, 100);
  ctx.strokeStyle = '#6a6a77';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 18, y, 36, 100);

  for (let i = 0; i < max; i++) {
    const by = y + 88 - i * 9;
    if (i < bullets) {
      ctx.fillStyle = '#88aacc';
      ctx.fillRect(x - 13, by, 26, 7);
      ctx.fillStyle = '#6688aa';
      ctx.fillRect(x - 13, by, 8, 7);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(x - 13, by, 26, 7);
    }
  }

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${bullets}/${max}`, x, y - 5);
}

function drawSniperBullet(ctx, x, y) {
  // 저격 탄환 (약간 더 큰 탄두)
  ctx.fillStyle = '#88aacc';
  ctx.fillRect(x - 4, y - 9, 8, 18);
  ctx.fillStyle = '#6688aa';
  ctx.fillRect(x - 4, y - 9, 8, 6);
}
