// ── 크로스보우 시스템: 크랭크 장전 + 볼트 발사 ──
import { state, W, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H, ITEM_BAR_H } from './game.js?v=20';
import { registerZone } from './input.js?v=20';
import { fireProjectile } from './projectiles.js?v=20';
import { playCrossbowShoot, playCrossbowCrank, playCrossbowLoad } from './audio.js?v=20';
import { spawnParticles } from './particles.js?v=20';

const JOYSTICK_W = 0; // 다이얼 기반 조준으로 조이스틱 오프셋 불필요

const CTRL_Y = CONTROLS_TOP + SLOT_H + ITEM_BAR_H;
const CTRL_H = CONTROLS_BOTTOM - CTRL_Y;
const WEAPON_W = W - JOYSTICK_W;
const COL_W = WEAPON_W / 3;

// 드래그 상태
let crankDragY = 0;
let crankDragging = false;
let boltDrag = null; // {x, y} 볼트 드래그
let bodyDragging = false;
let bodyLastX = 0;
let bodyTotalDragX = 0;

export function initCrossbow() {
  // ── 볼트 슬롯 (왼쪽) - 볼트를 드래그해서 크로스보우에 장전 ──
  registerZone(
    { x: JOYSTICK_W, y: CTRL_Y, w: COL_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'crossbow') return false;
        const c = state.crossbow;
        if (c.bolts > 0 && c.cocked && !c.loaded) {
          boltDrag = { x, y };
          return;
        }
        return false;
      },
      onMove(x, y) {
        if (boltDrag && state.currentWeapon === 'crossbow') {
          boltDrag.x = x;
          boltDrag.y = y;
        }
      },
      onEnd(x, y) {
        if (!boltDrag || state.currentWeapon !== 'crossbow') { boltDrag = null; return; }
        const c = state.crossbow;
        // 크로스보우 중앙에 드롭 → 장전
        const bowCX = JOYSTICK_W + COL_W + COL_W / 2;
        const bowCY = CTRL_Y + CTRL_H * 0.4;
        if (Math.hypot(x - bowCX, y - bowCY) < 70 && c.cocked && !c.loaded) {
          c.loaded = true;
          c.bolts--;
          playCrossbowLoad();
        }
        boltDrag = null;
      },
    },
    5
  );

  // ── 크로스보우 본체 (가운데) - 터치+좌우 드래그=조준, 놓으면 발사 ──
  registerZone(
    { x: JOYSTICK_W + COL_W, y: CTRL_Y, w: COL_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'crossbow') return false;
        bodyDragging = true;
        bodyLastX = x;
        bodyTotalDragX = 0;
      },
      onMove(x, y) {
        if (!bodyDragging || state.currentWeapon !== 'crossbow') return;
        const frameDx = x - bodyLastX;
        bodyTotalDragX += Math.abs(frameDx);
        bodyLastX = x;
        const aimSens = 0.005;
        state.aimAngle -= frameDx * aimSens; while (state.aimAngle < 0) state.aimAngle += Math.PI * 2; while (state.aimAngle >= Math.PI * 2) state.aimAngle -= Math.PI * 2;
      },
      onEnd() {
        if (!bodyDragging || state.currentWeapon !== 'crossbow') { bodyDragging = false; return; }
        bodyDragging = false;

        // 드래그로 조준했으면 발사하지 않음 (탭만 발사)
        if (bodyTotalDragX >= 10) return;

        const c = state.crossbow;
        if (c.loaded && c.cocked) {
          c.loaded = false;
          c.cocked = false;
          c.crankProgress = 0;
          fireProjectile('bolt', state.aimAngle, false, 1);
          playCrossbowShoot();
          spawnParticles(W / 2, CONTROLS_TOP - 10, 'muzzleFlash');
        }
      },
    },
    5
  );

  // ── 크랭크 영역 (오른쪽) - 아래로 반복 드래그: 크랭크 감기 ──
  registerZone(
    { x: JOYSTICK_W + COL_W * 2, y: CTRL_Y, w: COL_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'crossbow') return false;
        if (state.crossbow.cocked) return false;
        crankDragging = true;
        crankDragY = 0;
      },
      onMove(x, y, dx, dy) {
        if (!crankDragging || state.currentWeapon !== 'crossbow') return;
        crankDragY = Math.max(0, Math.min(80, dy));
        // 드래그 거리에 따라 크랭크 진행
        const c = state.crossbow;
        if (!c.cocked) {
          c.crankProgress = Math.min(1, crankDragY / 70);
        }
      },
      onEnd(x, y, dx, dy) {
        if (!crankDragging || state.currentWeapon !== 'crossbow') return;
        crankDragging = false;
        const c = state.crossbow;
        if (c.crankProgress >= 0.9) {
          c.cocked = true;
          c.crankProgress = 1;
          playCrossbowCrank();
        } else {
          // 부족하면 진행도 유지
        }
        crankDragY = 0;
      },
    },
    5
  );
}

export function drawCrossbow(ctx) {
  if (state.currentWeapon !== 'crossbow') return;

  const c = state.crossbow;
  const ox = JOYSTICK_W;
  const baseY = CTRL_Y + 20;

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
  ctx.fillText('볼트', ox + COL_W / 2, CTRL_Y + 14);
  ctx.fillText('크로스보우', ox + COL_W * 1.5, CTRL_Y + 14);
  ctx.fillText('크랭크', ox + COL_W * 2.5, CTRL_Y + 14);

  // ── 볼트 슬롯 (왼쪽) ──
  const slotX = ox + COL_W / 2;
  const slotY = baseY + 40;

  // 볼트통
  ctx.fillStyle = '#3a4a3a';
  ctx.fillRect(slotX - 20, slotY, 40, 120);
  ctx.strokeStyle = '#5a6a5a';
  ctx.lineWidth = 1;
  ctx.strokeRect(slotX - 20, slotY, 40, 120);

  // 볼트들
  for (let i = 0; i < Math.min(c.bolts, 6); i++) {
    const by = slotY + 10 + i * 18;
    ctx.strokeStyle = '#88ff88';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(slotX - 12, by);
    ctx.lineTo(slotX + 12, by);
    ctx.stroke();
    ctx.fillStyle = '#44cc44';
    ctx.beginPath();
    ctx.moveTo(slotX - 15, by);
    ctx.lineTo(slotX - 9, by - 2);
    ctx.lineTo(slotX - 9, by + 2);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${c.bolts}`, slotX, CONTROLS_BOTTOM - 20);

  // ── 크로스보우 본체 (가운데) ──
  const bowCX = ox + COL_W + COL_W / 2;
  const bowCY = baseY + 60;

  // 스톡 (세로)
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(bowCX - 8, bowCY - 10, 16, 100);
  // 활 부분 (가로)
  ctx.strokeStyle = '#4a6a4a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(bowCX - 55, bowCY);
  ctx.quadraticCurveTo(bowCX, bowCY - 25, bowCX + 55, bowCY);
  ctx.stroke();

  // 시위
  const stringPull = c.cocked ? 0 : 20;
  ctx.strokeStyle = c.cocked ? '#8a8' : '#666';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bowCX - 55, bowCY);
  ctx.lineTo(bowCX, bowCY + stringPull);
  ctx.lineTo(bowCX + 55, bowCY);
  ctx.stroke();

  // 장전된 볼트
  if (c.loaded) {
    ctx.strokeStyle = '#88ff88';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bowCX, bowCY - 10);
    ctx.lineTo(bowCX, bowCY + 40);
    ctx.stroke();
    ctx.fillStyle = '#44cc44';
    ctx.beginPath();
    ctx.moveTo(bowCX, bowCY - 15);
    ctx.lineTo(bowCX - 4, bowCY - 5);
    ctx.lineTo(bowCX + 4, bowCY - 5);
    ctx.closePath();
    ctx.fill();
  }

  // 상태
  ctx.fillStyle = c.loaded ? '#4f4' : c.cocked ? '#aa4' : '#a44';
  ctx.beginPath();
  ctx.arc(bowCX, bowCY - 35, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  if (!c.cocked) ctx.fillText('크랭크→코킹', bowCX, CONTROLS_BOTTOM - 8);
  else if (!c.loaded) ctx.fillText('볼트→장전', bowCX, CONTROLS_BOTTOM - 8);
  else ctx.fillText('드래그:조준 놓기:발사', bowCX, CONTROLS_BOTTOM - 8);

  // ── 크랭크 (오른쪽) ──
  const crankX = ox + COL_W * 2.5;
  const crankY = baseY + 70;

  // 크랭크 몸체
  ctx.fillStyle = '#555';
  ctx.beginPath();
  ctx.arc(crankX, crankY, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#777';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 크랭크 핸들 (회전)
  const angle = c.crankProgress * Math.PI * 2;
  const hx = crankX + Math.cos(angle) * 22;
  const hy = crankY + Math.sin(angle) * 22;
  ctx.fillStyle = c.cocked ? '#4a4' : '#aa8844';
  ctx.beginPath();
  ctx.arc(hx, hy, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(crankX, crankY);
  ctx.lineTo(hx, hy);
  ctx.stroke();

  // 크랭크 진행도 바
  const barY = crankY + 45;
  const barW = COL_W - 20;
  const barX = ox + COL_W * 2 + 10;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(barX, barY, barW, 8);
  ctx.fillStyle = c.cocked ? '#4a4' : '#aa8844';
  ctx.fillRect(barX, barY, barW * c.crankProgress, 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, 8);

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(c.cocked ? '코킹완료!' : '↓드래그: 감기', crankX, CONTROLS_BOTTOM - 8);

  // 드래그 중인 볼트
  if (boltDrag) {
    ctx.strokeStyle = '#88ff88';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(boltDrag.x, boltDrag.y + 15);
    ctx.lineTo(boltDrag.x, boltDrag.y - 15);
    ctx.stroke();
    ctx.fillStyle = '#44cc44';
    ctx.beginPath();
    ctx.moveTo(boltDrag.x, boltDrag.y - 20);
    ctx.lineTo(boltDrag.x - 4, boltDrag.y - 10);
    ctx.lineTo(boltDrag.x + 4, boltDrag.y - 10);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
