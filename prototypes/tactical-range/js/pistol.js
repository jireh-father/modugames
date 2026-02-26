// ── 권총 시스템: 렌더링 + 조작 ──
import { state, W, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H, JOYSTICK_W } from './game.js';
import { registerZone } from './input.js';
import { fireProjectile } from './projectiles.js';
import { playGunshot, playSlideRack, playMagOut, playMagIn, playBulletLoad } from './audio.js';
import { spawnParticles } from './particles.js';

const CTRL_Y = CONTROLS_TOP + SLOT_H;
const CTRL_H = CONTROLS_BOTTOM - CTRL_Y;
const WEAPON_W = W - JOYSTICK_W; // 조이스틱 제외 무기 영역
const COL_W = WEAPON_W / 3;

// 드래그 상태
let slideDragY = 0;
let slideDragging = false;
let triggerDragY = 0;
let triggerDragging = false;
let magDragX = 0;
let magDragging = false;
let bulletDrag = null; // {fromX, fromY, x, y}

// 총알통 영역 (오른쪽 탄창 영역 내)
const AMMO_BOX = { x: JOYSTICK_W + COL_W * 2 + 10, y: CTRL_Y + CTRL_H - 60, w: 60, h: 50 };

export function initPistol() {
  // 슬라이드 영역 (왼쪽)
  registerZone(
    { x: JOYSTICK_W, y: CTRL_Y, w: COL_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'pistol') return false;
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
        // 아래로 충분히 드래그 후 놓기 → 장전
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

  // 방아쇠 영역 (가운데) - 아래로 드래그하면 발사
  registerZone(
    { x: JOYSTICK_W + COL_W, y: CTRL_Y, w: COL_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'pistol') return false;
        triggerDragging = true;
        triggerDragY = 0;
      },
      onMove(x, y, dx, dy) {
        if (!triggerDragging || state.currentWeapon !== 'pistol') return;
        triggerDragY = Math.max(0, Math.min(40, dy)); // 아래로 드래그
      },
      onEnd(x, y, dx, dy) {
        if (!triggerDragging || state.currentWeapon !== 'pistol') return;
        triggerDragging = false;
        const p = state.pistol;
        // 방아쇠 충분히 당김 + 장전 상태 → 발사
        if (triggerDragY > 20 && p.chambered) {
          p.chambered = false;
          const isSpecial = p.specialBullets > 0;
          if (isSpecial) p.specialBullets--;

          fireProjectile('bullet', state.aimX, state.aimY, isSpecial);
          playGunshot();
          spawnParticles(W / 2, CONTROLS_TOP - 10, 'muzzleFlash');

          // 수동 장전: 슬라이드를 직접 당겨야 다음 탄 장전
          p.slideBack = true;
        }
        triggerDragY = 0;
      },
    },
    5
  );

  // 탄창 영역 (오른쪽) - 분리/삽입/탄환 넣기
  registerZone(
    { x: JOYSTICK_W + COL_W * 2, y: CTRL_Y, w: COL_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'pistol') return false;
        const p = state.pistol;
        magDragging = false;
        bulletDrag = null;

        // 총알통에서 시작 → 탄환 드래그
        if (p.magazineOut && x >= AMMO_BOX.x && x <= AMMO_BOX.x + AMMO_BOX.w
            && y >= AMMO_BOX.y && y <= AMMO_BOX.y + AMMO_BOX.h
            && p.reserveBullets > 0) {
          bulletDrag = { fromX: x, fromY: y, x, y };
          return;
        }

        magDragging = true;
        magDragX = 0;
      },
      onMove(x, y, dx, dy) {
        if (state.currentWeapon !== 'pistol') return;
        if (bulletDrag) {
          bulletDrag.x = x;
          bulletDrag.y = y;
          return;
        }
        if (!magDragging) return;
        magDragX = dx;
      },
      onEnd(x, y, dx, dy) {
        if (state.currentWeapon !== 'pistol') return;
        const p = state.pistol;

        // 탄환 드래그 → 탄창 위치에 드롭
        if (bulletDrag) {
          const magCX = JOYSTICK_W + COL_W * 2 + 50;
          const magArea = { x: magCX - 30, y: CTRL_Y + 20, w: 60, h: 120 };
          if (bulletDrag.x >= magArea.x && bulletDrag.x <= magArea.x + magArea.w
              && bulletDrag.y >= magArea.y && bulletDrag.y <= magArea.y + magArea.h
              && p.magazineOut && p.magazineBullets < p.magazineMax) {
            p.magazineBullets++;
            p.reserveBullets--;
            playBulletLoad();
          }
          bulletDrag = null;
          return;
        }

        if (!magDragging) return;
        magDragging = false;

        // 왼쪽 드래그 → 탄창 분리
        if (!p.magazineOut && magDragX < -40) {
          p.magazineOut = true;
          p.chambered = false;
          playMagOut();
        }
        // 오른쪽 드래그 → 탄창 삽입
        else if (p.magazineOut && magDragX > 40) {
          p.magazineOut = false;
          playMagIn();
        }

        magDragX = 0;
      },
    },
    5
  );
}

export function drawPistol(ctx) {
  if (state.currentWeapon !== 'pistol') return;

  const p = state.pistol;
  const baseY = CTRL_Y + 30;

  ctx.save();

  const ox = JOYSTICK_W; // 조이스틱 오프셋

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

  // 레이블 (슬라이드 | 방아쇠 | 탄창)
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('슬라이드', ox + COL_W / 2, CTRL_Y + 14);
  ctx.fillText('방아쇠', ox + COL_W * 1.5, CTRL_Y + 14);
  ctx.fillText('탄창', ox + COL_W * 2.5, CTRL_Y + 14);

  // ── 왼쪽: 슬라이드 ──
  const slideOff = slideDragging ? slideDragY : 0;
  const slideX = ox + COL_W / 2;
  const slideY = baseY + 50 + slideOff;

  // 총 몸체
  const gunGrad = ctx.createLinearGradient(slideX - 30, 0, slideX + 30, 0);
  gunGrad.addColorStop(0, '#444');
  gunGrad.addColorStop(0.5, '#666');
  gunGrad.addColorStop(1, '#444');
  ctx.fillStyle = gunGrad;
  ctx.fillRect(slideX - 30, baseY + 40, 60, 120);

  // 슬라이드
  const slideGrad = ctx.createLinearGradient(slideX - 28, 0, slideX + 28, 0);
  slideGrad.addColorStop(0, '#555');
  slideGrad.addColorStop(0.3, '#888');
  slideGrad.addColorStop(0.7, '#888');
  slideGrad.addColorStop(1, '#555');
  ctx.fillStyle = slideGrad;
  ctx.fillRect(slideX - 28, slideY - 10, 56, 50);

  // 슬라이드 세레이션
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const ly = slideY - 5 + i * 9;
    ctx.beginPath();
    ctx.moveTo(slideX - 25, ly);
    ctx.lineTo(slideX + 25, ly);
    ctx.stroke();
  }

  // 장전 상태 표시
  ctx.fillStyle = p.chambered ? '#4a4' : (p.slideBack ? '#a44' : '#aa4');
  ctx.beginPath();
  ctx.arc(slideX, slideY - 18, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(p.chambered ? '장전됨' : '↓드래그: 장전', slideX, CONTROLS_BOTTOM - 8);

  // ── 가운데: 방아쇠 ──
  const trigX = ox + COL_W + COL_W / 2;
  const trigY = baseY + 80;
  const trigOff = triggerDragging ? triggerDragY : 0;

  // 트리거 가드
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(trigX, trigY, 35, 0.3, Math.PI - 0.3);
  ctx.stroke();

  // 방아쇠 (아래로 움직임)
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
  ctx.fillText('↓드래그: 발사', trigX, CONTROLS_BOTTOM - 8);

  // ── 오른쪽: 탄창 ──
  const magColX = ox + COL_W * 2;

  if (p.magazineOut) {
    // 분리된 탄창
    const magX = magColX + 50 + (magDragging ? magDragX : 0);
    const magY = baseY + 30;
    drawMagazine(ctx, magX, magY, p.magazineBullets, p.magazineMax);

    // 총알통
    ctx.fillStyle = '#4a3a2a';
    ctx.strokeStyle = '#6a5a3a';
    ctx.lineWidth = 2;
    ctx.fillRect(AMMO_BOX.x, AMMO_BOX.y, AMMO_BOX.w, AMMO_BOX.h);
    ctx.strokeRect(AMMO_BOX.x, AMMO_BOX.y, AMMO_BOX.w, AMMO_BOX.h);

    // 총알통 내 총알들
    ctx.fillStyle = '#cca040';
    const cols = 5;
    for (let i = 0; i < Math.min(p.reserveBullets, 10); i++) {
      const bx = AMMO_BOX.x + 8 + (i % cols) * 11;
      const by = AMMO_BOX.y + 12 + Math.floor(i / cols) * 18;
      drawBulletSmall(ctx, bx, by);
    }
    if (p.reserveBullets > 10) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`+${p.reserveBullets - 10}`, AMMO_BOX.x + AMMO_BOX.w / 2, AMMO_BOX.y + AMMO_BOX.h - 3);
    }

    // 드래그 중인 총알
    if (bulletDrag) {
      ctx.fillStyle = '#ffcc44';
      drawBulletSmall(ctx, bulletDrag.x, bulletDrag.y);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('← 분리됨 / →삽입', magColX + COL_W / 2, CONTROLS_BOTTOM - 8);
  } else {
    // 장착된 탄창 (왼쪽 드래그 힌트)
    const magX = magColX + 50 + (magDragging ? Math.min(0, magDragX) : 0);
    drawMagazine(ctx, magX, baseY + 50, p.magazineBullets, p.magazineMax);

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('←드래그: 탄창 분리', magColX + COL_W / 2, CONTROLS_BOTTOM - 8);
  }

  ctx.restore();
}

function drawMagazine(ctx, x, y, bullets, max) {
  // 탄창 외형
  ctx.fillStyle = '#555';
  ctx.fillRect(x - 15, y, 30, 80);
  ctx.strokeStyle = '#777';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 15, y, 30, 80);

  // 탄환 표시
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

  // 탄 수 텍스트
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
