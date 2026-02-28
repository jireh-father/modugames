// ── 활 시스템: 화살통 + 활 + 조이스틱 조준 ──
import { state, W, H, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H, ITEM_BAR_H, FIELD_TOP, TOWER_Y } from './game.js?v=12';
import { registerZone } from './input.js?v=12';
import { fireProjectile } from './projectiles.js?v=12';
import { playBowDraw, playBowRelease, playArrowNock, playArrowPick } from './audio.js?v=12';
import { spawnParticles } from './particles.js?v=12';

const CTRL_Y = CONTROLS_TOP + SLOT_H + ITEM_BAR_H;
const CTRL_H = CONTROLS_BOTTOM - CTRL_Y;

// 3-column layout: quiver (left 20%) | bow (center 50%) | joystick (right 30%)
const QUIVER_W = Math.floor(W * 0.20);
const JOY_W = Math.floor(W * 0.30);
const BOW_W = W - QUIVER_W - JOY_W;

// 조이스틱 상수
const JOY_CX = QUIVER_W + BOW_W + JOY_W / 2;
const JOY_CY = CTRL_Y + CTRL_H / 2;
const JOY_R = Math.min(JOY_W, CTRL_H) * 0.30; // 작은 조이스틱

// 조이스틱 상태
let joyActive = false;
let joyDx = 0, joyDy = 0; // -1~1 정규화

// 타겟 위치 (필드 위)
let targetX = W / 2;
let targetY = 200;

// 화살 드래그 상태
let arrowDrag = null; // { x, y }

export function initBow() {
  // ── 화살통 영역 (왼쪽 20%) ──
  registerZone(
    { x: 0, y: CTRL_Y, w: QUIVER_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'bow') return false;
        const b = state.bow;
        if (b.arrows + b.specialArrows > 0 && !b.arrowNocked) {
          arrowDrag = { x, y };
          playArrowPick();
        }
      },
      onMove(x, y) {
        if (arrowDrag && state.currentWeapon === 'bow') {
          arrowDrag.x = x;
          arrowDrag.y = y;
        }
      },
      onEnd(x, y) {
        if (!arrowDrag || state.currentWeapon !== 'bow') { arrowDrag = null; return; }
        const b = state.bow;
        // 활 중앙 영역에 드롭 → 장전
        const bowCenterX = QUIVER_W + BOW_W / 2;
        const bowCenterY = CTRL_Y + CTRL_H * 0.4;
        const dist = Math.hypot(x - bowCenterX, y - bowCenterY);
        if (dist < 70) {
          b.arrowNocked = true;
          if (b.arrows > 0) b.arrows--;
          else if (b.specialArrows > 0) { b.specialArrows--; b._specialNocked = true; }
          playArrowNock();
        }
        arrowDrag = null;
      },
    },
    5
  );

  // ── 활 영역 (가운데 50%) - 시위 당기기 + 발사 ──
  registerZone(
    { x: QUIVER_W, y: CTRL_Y, w: BOW_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'bow') return false;
        const b = state.bow;
        if (!b.arrowNocked) return false;
        b.drawing = true;
        b.drawPower = 0;
        playBowDraw();
      },
      onMove(x, y, dx, dy) {
        if (state.currentWeapon !== 'bow' || !state.bow.drawing) return;
        state.bow.drawPower = Math.min(1, Math.max(0, dy / 100));
      },
      onEnd(x, y, dx, dy) {
        if (state.currentWeapon !== 'bow') return;
        const b = state.bow;
        if (!b.drawing) return;
        b.drawing = false;

        if (b.drawPower > 0.15 && b.arrowNocked) {
          const isSpecial = b._specialNocked || false;
          fireProjectile('arrow', state.aimAngle, isSpecial, b.drawPower, { x: targetX, y: targetY });
          playBowRelease();
          const bowCX = QUIVER_W + BOW_W / 2;
          spawnParticles(bowCX, CTRL_Y + CTRL_H * 0.35, 'bowString');
          b.arrowNocked = false;
          b._specialNocked = false;
        }
        b.drawPower = 0;
      },
    },
    5
  );

  // ── 조이스틱 영역 (오른쪽 30%) ──
  registerZone(
    { x: QUIVER_W + BOW_W, y: CTRL_Y, w: JOY_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'bow') return false;
        joyActive = true;
        updateJoystick(x, y);
      },
      onMove(x, y) {
        if (!joyActive || state.currentWeapon !== 'bow') return;
        updateJoystick(x, y);
      },
      onEnd() {
        joyActive = false;
        joyDx = 0;
        joyDy = 0;
      },
    },
    5
  );
}

function updateJoystick(x, y) {
  const dx = (x - JOY_CX) / JOY_R;
  const dy = (y - JOY_CY) / JOY_R;
  const dist = Math.hypot(dx, dy);
  if (dist > 1) {
    joyDx = dx / dist;
    joyDy = dy / dist;
  } else {
    joyDx = dx;
    joyDy = dy;
  }
  targetX = W / 2 + joyDx * (W / 2 - 30);
  // 조이스틱 위로 올리면 가까이(타워 쪽), 아래로 내리면 멀리(필드 상단)
  targetY = TOWER_Y - 100 + joyDy * (TOWER_Y - FIELD_TOP - 50);
  targetY = Math.max(FIELD_TOP + 10, Math.min(TOWER_Y - 30, targetY));

  const aimDx = targetX - state.tower.x;
  const aimDy = -(targetY - TOWER_Y);
  state.aimAngle = Math.atan2(aimDy, aimDx);
  state.aimAngle = Math.max(0.15, Math.min(Math.PI - 0.15, state.aimAngle));
}

export function drawBow(ctx) {
  if (state.currentWeapon !== 'bow') return;

  const b = state.bow;
  const baseY = CTRL_Y + 20;

  ctx.save();

  // 영역 구분선
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(QUIVER_W, CTRL_Y);
  ctx.lineTo(QUIVER_W, CONTROLS_BOTTOM);
  ctx.moveTo(QUIVER_W + BOW_W, CTRL_Y);
  ctx.lineTo(QUIVER_W + BOW_W, CONTROLS_BOTTOM);
  ctx.stroke();

  // 레이블
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('화살통', QUIVER_W / 2, CTRL_Y + 14);
  ctx.fillText('활', QUIVER_W + BOW_W / 2, CTRL_Y + 14);
  ctx.fillText('조준', JOY_CX, CTRL_Y + 14);

  // ── 왼쪽: 화살통 ──
  const qx = QUIVER_W / 2 - 18;
  const qy = baseY + 15;
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(qx, qy, 36, 150);
  ctx.strokeStyle = '#7a5a2a';
  ctx.lineWidth = 2;
  ctx.strokeRect(qx, qy, 36, 150);

  // 화살들
  const totalArrows = b.arrows + b.specialArrows;
  for (let i = 0; i < Math.min(totalArrows, 7); i++) {
    const ax = qx + 6 + i * 4;
    const isSpec = i >= b.arrows;
    ctx.strokeStyle = isSpec ? '#ff6600' : '#c0a060';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, qy + 8);
    ctx.lineTo(ax, qy + 130);
    ctx.stroke();
    // 화살촉
    ctx.fillStyle = isSpec ? '#ff4400' : '#888';
    ctx.beginPath();
    ctx.moveTo(ax, qy + 3);
    ctx.lineTo(ax - 3, qy + 12);
    ctx.lineTo(ax + 3, qy + 12);
    ctx.closePath();
    ctx.fill();
  }

  // 화살 수
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${b.arrows}`, QUIVER_W / 2 - 8, CONTROLS_BOTTOM - 10);
  if (b.specialArrows > 0) {
    ctx.fillStyle = '#ff6600';
    ctx.fillText(`+${b.specialArrows}`, QUIVER_W / 2 + 12, CONTROLS_BOTTOM - 10);
  }

  // ── 가운데: 활 ──
  const bowCX = QUIVER_W + BOW_W / 2;
  const bowCY = CTRL_Y + CTRL_H * 0.4;
  const bowLen = BOW_W * 0.7;

  // 활 몸체
  ctx.strokeStyle = '#8B5E3C';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(bowCX - bowLen / 2, bowCY);
  ctx.quadraticCurveTo(bowCX, bowCY - 40, bowCX + bowLen / 2, bowCY);
  ctx.stroke();

  ctx.strokeStyle = '#6B3E1C';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bowCX - bowLen / 2 + 2, bowCY);
  ctx.quadraticCurveTo(bowCX, bowCY - 38, bowCX + bowLen / 2 - 2, bowCY);
  ctx.stroke();

  // 시위
  const stringPull = b.drawing ? b.drawPower * 40 : 0;
  ctx.strokeStyle = '#c0a060';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bowCX - bowLen / 2, bowCY);
  ctx.lineTo(bowCX, bowCY + stringPull);
  ctx.lineTo(bowCX + bowLen / 2, bowCY);
  ctx.stroke();

  // 장전된 화살
  if (b.arrowNocked) {
    const arrowY = bowCY + stringPull;
    const isSpec = b._specialNocked;
    ctx.strokeStyle = isSpec ? '#ff6600' : '#c0a060';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bowCX, arrowY + 60);
    ctx.lineTo(bowCX, arrowY - 10);
    ctx.stroke();
    ctx.fillStyle = isSpec ? '#ff4400' : '#888';
    ctx.beginPath();
    ctx.moveTo(bowCX, arrowY - 15);
    ctx.lineTo(bowCX - 4, arrowY - 5);
    ctx.lineTo(bowCX + 4, arrowY - 5);
    ctx.closePath();
    ctx.fill();
    // 깃털
    ctx.fillStyle = isSpec ? 'rgba(255,100,0,0.5)' : 'rgba(192,160,96,0.5)';
    ctx.beginPath();
    ctx.moveTo(bowCX, arrowY + 55);
    ctx.lineTo(bowCX - 5, arrowY + 65);
    ctx.lineTo(bowCX, arrowY + 60);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bowCX, arrowY + 55);
    ctx.lineTo(bowCX + 5, arrowY + 65);
    ctx.lineTo(bowCX, arrowY + 60);
    ctx.closePath();
    ctx.fill();
  }

  // 파워 게이지
  if (b.drawing && b.drawPower > 0) {
    const gaugeX = QUIVER_W + 5;
    const gaugeH = CTRL_H * 0.6;
    const gaugeY = CTRL_Y + (CTRL_H - gaugeH) / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(gaugeX, gaugeY, 10, gaugeH);
    const filled = b.drawPower * gaugeH;
    const gaugeColor = b.drawPower > 0.8 ? '#f44' : b.drawPower > 0.5 ? '#fa4' : '#4f4';
    ctx.fillStyle = gaugeColor;
    ctx.fillRect(gaugeX, gaugeY + gaugeH - filled, 10, filled);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.strokeRect(gaugeX, gaugeY, 10, gaugeH);
    ctx.fillStyle = '#fff';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Math.floor(b.drawPower * 100) + '%', gaugeX + 5, gaugeY - 5);
  }

  // 힌트
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  if (b.arrows + b.specialArrows <= 0 && !b.arrowNocked) {
    ctx.fillText('화살 없음!', bowCX, CONTROLS_BOTTOM - 8);
  } else if (!b.arrowNocked) {
    ctx.fillText('화살통→활: 장전', bowCX, CONTROLS_BOTTOM - 8);
  } else if (!b.drawing) {
    ctx.fillText('↓당기고 놓기: 발사', bowCX, CONTROLS_BOTTOM - 8);
  } else {
    ctx.fillText('놓으면 발사!', bowCX, CONTROLS_BOTTOM - 8);
  }

  // ── 오른쪽: 조이스틱 ──
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(JOY_CX, JOY_CY, JOY_R, 0, Math.PI * 2);
  ctx.stroke();

  // 십자선
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(JOY_CX - JOY_R, JOY_CY);
  ctx.lineTo(JOY_CX + JOY_R, JOY_CY);
  ctx.moveTo(JOY_CX, JOY_CY - JOY_R);
  ctx.lineTo(JOY_CX, JOY_CY + JOY_R);
  ctx.stroke();

  // 핸들
  const handleX = JOY_CX + joyDx * JOY_R;
  const handleY = JOY_CY + joyDy * JOY_R;
  const handleR = 14;

  if (joyActive) {
    ctx.strokeStyle = 'rgba(200,160,96,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(JOY_CX, JOY_CY);
    ctx.lineTo(handleX, handleY);
    ctx.stroke();
  }

  ctx.fillStyle = joyActive ? 'rgba(200,160,96,0.6)' : 'rgba(150,130,100,0.3)';
  ctx.beginPath();
  ctx.arc(handleX, handleY, handleR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = joyActive ? '#c0a060' : 'rgba(150,130,100,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('조준', JOY_CX, CONTROLS_BOTTOM - 8);

  // ── 드래그 중인 화살 ──
  if (arrowDrag) {
    ctx.strokeStyle = '#c0a060';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(arrowDrag.x, arrowDrag.y + 25);
    ctx.lineTo(arrowDrag.x, arrowDrag.y - 25);
    ctx.stroke();
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.moveTo(arrowDrag.x, arrowDrag.y - 30);
    ctx.lineTo(arrowDrag.x - 3, arrowDrag.y - 22);
    ctx.lineTo(arrowDrag.x + 3, arrowDrag.y - 22);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * X 마커 오버레이 (필드 위에 타겟 표시)
 */
export function drawBowTargetOverlay(ctx) {
  if (state.currentWeapon !== 'bow') return;

  ctx.save();

  const alpha = joyActive ? 0.8 : 0.4;

  // X 마커
  const size = 12;
  ctx.strokeStyle = `rgba(255,100,50,${alpha})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(targetX - size, targetY - size);
  ctx.lineTo(targetX + size, targetY + size);
  ctx.moveTo(targetX + size, targetY - size);
  ctx.lineTo(targetX - size, targetY + size);
  ctx.stroke();

  // 중앙 점
  ctx.fillStyle = `rgba(255,150,80,${alpha})`;
  ctx.beginPath();
  ctx.arc(targetX, targetY, 3, 0, Math.PI * 2);
  ctx.fill();

  if (joyActive) {
    ctx.fillStyle = `rgba(255,100,50,0.1)`;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 25, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * 타겟 위치 (화살 낙하지점용)
 */
export function getBowTarget() {
  return { x: targetX, y: targetY };
}
