// ── 활 시스템: 렌더링 + 조작 ──
import { state, W, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H } from './game.js';
import { registerZone } from './input.js';
import { fireProjectile } from './projectiles.js';
import { playBowDraw, playBowRelease, playArrowPick, playArrowNock } from './audio.js';
import { spawnParticles } from './particles.js';

const CTRL_Y = CONTROLS_TOP + SLOT_H;
const CTRL_H = CONTROLS_BOTTOM - CTRL_Y;
const QUIVER_W = W * 0.25;
const BOW_W = W - QUIVER_W;

// 드래그 상태
let arrowDrag = null; // {x, y} 화살 드래그 중
let stringDragY = 0;
let stringDragging = false;

export function initBow() {
  // 화살통 영역 (왼쪽 25%)
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
        // 활 중앙 영역에 드롭했는지 체크
        const bowCenterX = QUIVER_W + BOW_W * 0.4;
        const bowCenterY = CTRL_Y + CTRL_H / 2;
        const dist = Math.hypot(x - bowCenterX, y - bowCenterY);
        if (dist < 60) {
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

  // 활+시위 영역 (오른쪽 75%)
  registerZone(
    { x: QUIVER_W, y: CTRL_Y, w: BOW_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'bow') return false;
        if (state.bow.arrowNocked) {
          stringDragging = true;
          stringDragY = 0;
          state.bow.drawing = true;
          playBowDraw();
        }
      },
      onMove(x, y, dx, dy) {
        if (!stringDragging || state.currentWeapon !== 'bow') return;
        stringDragY = Math.max(0, Math.min(100, dy));
        state.bow.drawPower = stringDragY / 100;
      },
      onEnd(x, y, dx, dy) {
        if (!stringDragging || state.currentWeapon !== 'bow') return;
        stringDragging = false;
        const b = state.bow;
        b.drawing = false;

        // 충분히 당겼으면 발사
        if (b.drawPower > 0.15 && b.arrowNocked) {
          const isSpecial = b._specialNocked || false;
          fireProjectile('arrow', state.aimX, state.aimY, isSpecial, b.drawPower);
          playBowRelease();
          const bowCX = QUIVER_W + BOW_W * 0.4;
          spawnParticles(bowCX, CTRL_Y + CTRL_H / 2, 'bowString');
          b.arrowNocked = false;
          b._specialNocked = false;
        }
        b.drawPower = 0;
        stringDragY = 0;
      },
    },
    5
  );
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

  // ── 왼쪽: 화살통 ──
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('화살통', QUIVER_W / 2, CTRL_Y + 14);

  // 화살통 몸체
  const qx = QUIVER_W / 2 - 20;
  const qy = baseY + 20;
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(qx, qy, 40, 160);
  ctx.strokeStyle = '#7a5a2a';
  ctx.lineWidth = 2;
  ctx.strokeRect(qx, qy, 40, 160);

  // 화살들
  const totalArrows = b.arrows + b.specialArrows;
  for (let i = 0; i < Math.min(totalArrows, 8); i++) {
    const ax = qx + 8 + i * 4;
    const isSpec = i >= b.arrows;
    ctx.strokeStyle = isSpec ? '#ff6600' : '#c0a060';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax, qy + 10);
    ctx.lineTo(ax, qy + 140);
    ctx.stroke();
    // 화살촉
    ctx.fillStyle = isSpec ? '#ff4400' : '#888';
    ctx.beginPath();
    ctx.moveTo(ax, qy + 5);
    ctx.lineTo(ax - 3, qy + 15);
    ctx.lineTo(ax + 3, qy + 15);
    ctx.closePath();
    ctx.fill();
  }

  // 화살 수
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${b.arrows}`, QUIVER_W / 2 - 10, CONTROLS_BOTTOM - 10);
  if (b.specialArrows > 0) {
    ctx.fillStyle = '#ff6600';
    ctx.fillText(`+${b.specialArrows}`, QUIVER_W / 2 + 15, CONTROLS_BOTTOM - 10);
  }

  // ── 오른쪽: 활 ──
  const bowCX = QUIVER_W + BOW_W * 0.4;
  const bowCY = CTRL_Y + CTRL_H / 2;
  const bowH = CTRL_H * 0.8;

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('활', bowCX, CTRL_Y + 14);

  // 활 몸체 (곡선)
  ctx.strokeStyle = '#8B5E3C';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(bowCX - 15, bowCY - bowH / 2);
  ctx.quadraticCurveTo(bowCX + 40, bowCY, bowCX - 15, bowCY + bowH / 2);
  ctx.stroke();

  // 활 나무 질감
  ctx.strokeStyle = '#6B3E1C';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bowCX - 14, bowCY - bowH / 2 + 2);
  ctx.quadraticCurveTo(bowCX + 38, bowCY, bowCX - 14, bowCY + bowH / 2 - 2);
  ctx.stroke();

  // 시위
  const stringPull = stringDragging ? stringDragY * 0.4 : 0;
  ctx.strokeStyle = '#c0a060';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bowCX - 15, bowCY - bowH / 2);
  ctx.lineTo(bowCX - 15 + stringPull, bowCY);
  ctx.lineTo(bowCX - 15, bowCY + bowH / 2);
  ctx.stroke();

  // 장전된 화살
  if (b.arrowNocked) {
    const arrowX = bowCX - 15 + stringPull;
    const isSpec = b._specialNocked;
    ctx.strokeStyle = isSpec ? '#ff6600' : '#c0a060';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(arrowX - 60, bowCY);
    ctx.lineTo(arrowX + 10, bowCY);
    ctx.stroke();
    // 화살촉
    ctx.fillStyle = isSpec ? '#ff4400' : '#888';
    ctx.beginPath();
    ctx.moveTo(arrowX - 65, bowCY);
    ctx.lineTo(arrowX - 55, bowCY - 4);
    ctx.lineTo(arrowX - 55, bowCY + 4);
    ctx.closePath();
    ctx.fill();
  }

  // 파워 게이지
  if (b.drawing && b.drawPower > 0) {
    const gaugeX = QUIVER_W + BOW_W - 30;
    const gaugeH = CTRL_H * 0.7;
    const gaugeY = CTRL_Y + (CTRL_H - gaugeH) / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(gaugeX, gaugeY, 15, gaugeH);

    const filled = b.drawPower * gaugeH;
    const gaugeColor = b.drawPower > 0.8 ? '#f44' : b.drawPower > 0.5 ? '#fa4' : '#4f4';
    ctx.fillStyle = gaugeColor;
    ctx.fillRect(gaugeX, gaugeY + gaugeH - filled, 15, filled);

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.strokeRect(gaugeX, gaugeY, 15, gaugeH);

    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Math.floor(b.drawPower * 100) + '%', gaugeX + 7, gaugeY - 5);
  }

  // 드래그 중인 화살
  if (arrowDrag) {
    ctx.strokeStyle = '#c0a060';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(arrowDrag.x - 30, arrowDrag.y);
    ctx.lineTo(arrowDrag.x + 30, arrowDrag.y);
    ctx.stroke();
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.moveTo(arrowDrag.x - 35, arrowDrag.y);
    ctx.lineTo(arrowDrag.x - 25, arrowDrag.y - 3);
    ctx.lineTo(arrowDrag.x - 25, arrowDrag.y + 3);
    ctx.closePath();
    ctx.fill();
  }

  // 힌트 텍스트
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  if (!b.arrowNocked) {
    ctx.fillText('화살통→활: 장전', bowCX, CONTROLS_BOTTOM - 8);
  } else if (!b.drawing) {
    ctx.fillText('↓드래그: 시위 당기기', bowCX, CONTROLS_BOTTOM - 8);
  } else {
    ctx.fillText('놓으면 발사!', bowCX, CONTROLS_BOTTOM - 8);
  }

  ctx.restore();
}
