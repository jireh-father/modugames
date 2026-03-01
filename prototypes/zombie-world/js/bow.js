// ── 활 시스템: 화살통 + 활 (좌우 조준 + 당기기=거리) ──
import { state, W, H, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H, ITEM_BAR_H, FIELD_TOP, TOWER_Y, getFireOrigin } from './game.js?v=16';
import { registerZone } from './input.js?v=16';
import { fireProjectile } from './projectiles.js?v=16';
import { playBowDraw, playBowRelease, playArrowNock, playArrowPick } from './audio.js?v=16';
import { spawnParticles } from './particles.js?v=16';

const CTRL_Y = CONTROLS_TOP + SLOT_H + ITEM_BAR_H;
const CTRL_H = CONTROLS_BOTTOM - CTRL_Y;

// 2-column layout: quiver (left 25%) | bow (right 75%)
const QUIVER_W = Math.floor(W * 0.25);
const BOW_W = W - QUIVER_W;

// 타겟 위치 (필드 위)
let targetX = W / 2;
let targetY = 300;

// 화살 드래그 상태
let arrowDrag = null; // { x, y }

// 활 터치 상태
let bowTouchActive = false;
let bowStartY = 0;     // 터치 시작 Y (당기기 계산용)
let bowLastX = 0;       // 이전 X (좌우 이동 delta용)

export function initBow() {
  // ── 화살통 영역 (왼쪽 25%) ──
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
        // 활 영역에 드롭 → 장전
        if (x >= QUIVER_W) {
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

  // ── 활 영역 (오른쪽 75%) - 좌우 조준 + 시위 당기기 + 발사 ──
  registerZone(
    { x: QUIVER_W, y: CTRL_Y, w: BOW_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'bow') return false;
        bowTouchActive = true;
        bowLastX = x;
        bowStartY = y;
        const b = state.bow;
        if (b.arrowNocked && !b.drawing) {
          b.drawing = true;
          b.drawPower = 0;
          playBowDraw();
        }
      },
      onMove(x, y) {
        if (state.currentWeapon !== 'bow' || !bowTouchActive) return;
        const b = state.bow;

        // 좌우 드래그 → 항상 조준 각도 조절 (장전/미장전/당기는 중 모두)
        const frameDx = x - bowLastX;
        bowLastX = x;
        const aimSens = 0.005;
        state.aimAngle -= frameDx * aimSens; while (state.aimAngle < 0) state.aimAngle += Math.PI * 2; while (state.aimAngle >= Math.PI * 2) state.aimAngle -= Math.PI * 2;

        // 아래로 당기기 → drawPower (장전 상태일 때만)
        if (b.drawing) {
          const dy = y - bowStartY;
          b.drawPower = Math.min(1, Math.max(0, dy / 120));
        }

        // 타겟 위치 계산 (aimAngle + drawPower로 거리 결정)
        updateTargetFromAim();
      },
      onEnd(x, y) {
        if (state.currentWeapon !== 'bow') return;
        const b = state.bow;
        bowTouchActive = false;

        if (b.drawing && b.arrowNocked) {
          if (b.drawPower > 0.15) {
            const isSpecial = b._specialNocked || false;
            fireProjectile('arrow', state.aimAngle, isSpecial, b.drawPower, { x: targetX, y: targetY });
            playBowRelease();
            const bowCX = QUIVER_W + BOW_W / 2;
            spawnParticles(bowCX, CTRL_Y + CTRL_H * 0.35, 'bowString');
            b.arrowNocked = false;
            b._specialNocked = false;
          }
          b.drawing = false;
          b.drawPower = 0;
        }
      },
    },
    5
  );

  // 초기 타겟 위치 설정
  updateTargetFromAim();
}

/**
 * aimAngle + drawPower → 타겟 좌표 계산
 * drawPower가 높을수록 멀리 (타워에서 FIELD_TOP 쪽으로)
 */
function updateTargetFromAim() {
  const b = state.bow;
  const power = b.drawing ? b.drawPower : 0;

  // 최소~최대 사거리 (발사 기준점으로부터의 거리)
  const origin = getFireOrigin();
  const minDist = 80;
  const maxDist = origin.y - FIELD_TOP - 20;
  const dist = minDist + power * (maxDist - minDist);

  // aimAngle 방향으로 dist만큼 이동 (Y는 위쪽이 -)
  targetX = origin.x + Math.cos(state.aimAngle) * dist;
  targetY = origin.y - Math.sin(state.aimAngle) * dist;

  // 필드 경계 클램핑
  targetX = Math.max(20, Math.min(W - 20, targetX));
  targetY = Math.max(FIELD_TOP + 10, Math.min(origin.y - 30, targetY));
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
  ctx.stroke();

  // 레이블
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('화살통', QUIVER_W / 2, CTRL_Y + 14);
  ctx.fillText('활', QUIVER_W + BOW_W / 2, CTRL_Y + 14);

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

  // ── 오른쪽: 활 ──
  const bowCX = QUIVER_W + BOW_W / 2;
  const bowCY = CTRL_Y + CTRL_H * 0.4;
  const bowLen = BOW_W * 0.55;

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
  const stringPull = b.drawing ? b.drawPower * 50 : 0;
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

  // 파워 게이지 (당기는 중)
  if (b.drawing && b.drawPower > 0) {
    const gaugeX = QUIVER_W + 8;
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

  // 조준 방향 표시 (활 위에 화살표)
  const aimIndicatorR = 30;
  const aimIX = bowCX + Math.cos(state.aimAngle) * aimIndicatorR;
  const aimIY = bowCY - Math.sin(state.aimAngle) * aimIndicatorR - 50;
  ctx.strokeStyle = 'rgba(255,150,80,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bowCX, bowCY - 50);
  ctx.lineTo(aimIX, aimIY);
  ctx.stroke();
  // 화살표 끝
  ctx.fillStyle = 'rgba(255,150,80,0.6)';
  ctx.beginPath();
  ctx.arc(aimIX, aimIY, 4, 0, Math.PI * 2);
  ctx.fill();

  // 힌트
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  if (b.arrows + b.specialArrows <= 0 && !b.arrowNocked) {
    ctx.fillText('화살 없음!', bowCX, CONTROLS_BOTTOM - 8);
  } else if (!b.arrowNocked) {
    ctx.fillText('화살통→활: 장전', bowCX, CONTROLS_BOTTOM - 8);
  } else if (!b.drawing) {
    ctx.fillText('←→조준  ↓당기기', bowCX, CONTROLS_BOTTOM - 8);
  } else {
    ctx.fillText('놓으면 발사! ←→조준', bowCX, CONTROLS_BOTTOM - 8);
  }

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

    // 활 영역 위에 있으면 하이라이트
    if (arrowDrag.x >= QUIVER_W) {
      ctx.strokeStyle = 'rgba(192,160,96,0.5)';
      ctx.lineWidth = 3;
      const bx = bowCX - bowLen / 2 - 10;
      const by = bowCY - 30;
      ctx.strokeRect(bx, by, bowLen + 20, 80);
    }
  }

  ctx.restore();
}

/**
 * X 마커 오버레이 (필드 위에 타겟 표시)
 */
export function drawBowTargetOverlay(ctx) {
  if (state.currentWeapon !== 'bow') return;

  // 활 영역을 터치 중이거나 당기는 중일 때 타겟 표시
  updateTargetFromAim();

  ctx.save();

  const b = state.bow;
  const alpha = b.drawing ? 0.8 : (bowTouchActive ? 0.5 : 0.3);

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

  // 거리 원 (당기는 중)
  if (b.drawing && b.drawPower > 0) {
    ctx.fillStyle = `rgba(255,100,50,0.08)`;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 25 + b.drawPower * 10, 0, Math.PI * 2);
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
