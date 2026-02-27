// ── 활 시스템: 렌더링 + 조작 ──
import { state, W, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H, ITEM_BAR_H } from './game.js?v=7';
import { registerZone } from './input.js?v=7';
import { fireProjectile } from './projectiles.js?v=7';
import { playBowDraw, playBowRelease, playArrowPick, playArrowNock } from './audio.js?v=7';
import { spawnParticles } from './particles.js?v=7';

const JOYSTICK_W = 0; // 다이얼 기반 조준으로 조이스틱 오프셋 불필요

const CTRL_Y = CONTROLS_TOP + SLOT_H + ITEM_BAR_H;
const CTRL_H = CONTROLS_BOTTOM - CTRL_Y;
const WEAPON_W = W - JOYSTICK_W; // 조이스틱 제외 무기 영역
const QUIVER_W = WEAPON_W * 0.25;
const BOW_W = WEAPON_W - QUIVER_W;

// 드래그 상태
let arrowDrag = null; // {x, y} 화살 드래그 중
let stringDragY = 0;
let stringDragging = false;
let bowTouching = false; // 활 영역 터치 중 (조준용)
let stringLastX = 0; // 드래그 중 조준용 이전 좌표
let stringLastY = 0;

export function initBow() {
  // 화살통 영역 (조이스틱 우측 25%)
  registerZone(
    { x: JOYSTICK_W, y: CTRL_Y, w: QUIVER_W, h: CTRL_H },
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
        const bowCenterX = JOYSTICK_W + QUIVER_W + BOW_W * 0.5;
        const bowCenterY = CTRL_Y + CTRL_H * 0.35;
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

  // 활+시위 영역 (오른쪽 75%) - 항상 좌우 드래그=조준, 화살 장전 시 아래로 드래그=시위 당기기
  registerZone(
    { x: JOYSTICK_W + QUIVER_W, y: CTRL_Y, w: BOW_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'bow') return false;
        bowTouching = true;
        stringLastX = x;
        stringLastY = y;
        if (state.bow.arrowNocked) {
          stringDragging = true;
          stringDragY = 0;
          state.bow.drawing = true;
          playBowDraw();
        }
      },
      onMove(x, y, dx, dy) {
        if (!bowTouching || state.currentWeapon !== 'bow') return;
        // 좌우 드래그로 항상 조준 이동 (장전 전후 모두)
        const frameDx = x - stringLastX;
        stringLastX = x;
        stringLastY = y;
        const aimSens = 0.005;
        state.aimAngle = Math.max(0.15, Math.min(Math.PI - 0.15, state.aimAngle - frameDx * aimSens));
        // 시위 당기기 (화살 장전 시에만)
        if (stringDragging) {
          stringDragY = Math.max(0, Math.min(100, dy));
          state.bow.drawPower = stringDragY / 100;
        }
      },
      onEnd(x, y, dx, dy) {
        bowTouching = false;
        if (!stringDragging || state.currentWeapon !== 'bow') { stringDragging = false; return; }
        stringDragging = false;
        const b = state.bow;
        b.drawing = false;

        // 충분히 당겼으면 발사
        if (b.drawPower > 0.15 && b.arrowNocked) {
          const isSpecial = b._specialNocked || false;
          fireProjectile('arrow', state.aimAngle, isSpecial, b.drawPower);
          playBowRelease();
          const bowCX = JOYSTICK_W + QUIVER_W + BOW_W * 0.5;
          spawnParticles(bowCX, CTRL_Y + CTRL_H * 0.35, 'bowString');
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

  const ox = JOYSTICK_W; // 조이스틱 오프셋

  // 영역 구분선
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ox, CTRL_Y);
  ctx.lineTo(ox, CONTROLS_BOTTOM);
  ctx.moveTo(ox + QUIVER_W, CTRL_Y);
  ctx.lineTo(ox + QUIVER_W, CONTROLS_BOTTOM);
  ctx.stroke();

  // ── 왼쪽: 화살통 ──
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('화살통', ox + QUIVER_W / 2, CTRL_Y + 14);

  // 화살통 몸체
  const qx = ox + QUIVER_W / 2 - 20;
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
  ctx.fillText(`${b.arrows}`, ox + QUIVER_W / 2 - 10, CONTROLS_BOTTOM - 10);
  if (b.specialArrows > 0) {
    ctx.fillStyle = '#ff6600';
    ctx.fillText(`+${b.specialArrows}`, ox + QUIVER_W / 2 + 15, CONTROLS_BOTTOM - 10);
  }

  // ── 오른쪽: 활 (가로 배치 - 위쪽 활, 아래로 시위 당김) ──
  const bowCX = ox + QUIVER_W + BOW_W * 0.5;
  const bowCY = CTRL_Y + CTRL_H * 0.35;
  const bowW = BOW_W * 0.75; // 가로 길이

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('활', bowCX, CTRL_Y + 14);

  // 활 몸체 (가로 곡선 - 위로 볼록)
  ctx.strokeStyle = '#8B5E3C';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(bowCX - bowW / 2, bowCY);
  ctx.quadraticCurveTo(bowCX, bowCY - 40, bowCX + bowW / 2, bowCY);
  ctx.stroke();

  // 활 나무 질감
  ctx.strokeStyle = '#6B3E1C';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bowCX - bowW / 2 + 2, bowCY);
  ctx.quadraticCurveTo(bowCX, bowCY - 38, bowCX + bowW / 2 - 2, bowCY);
  ctx.stroke();

  // 시위 (아래로 당겨짐)
  const stringPull = stringDragging ? stringDragY * 0.4 : 0;
  ctx.strokeStyle = '#c0a060';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bowCX - bowW / 2, bowCY);
  ctx.lineTo(bowCX, bowCY + stringPull);
  ctx.lineTo(bowCX + bowW / 2, bowCY);
  ctx.stroke();

  // 장전된 화살 (세로 - 촉이 위를 향함)
  if (b.arrowNocked) {
    const arrowY = bowCY + stringPull;
    const isSpec = b._specialNocked;
    ctx.strokeStyle = isSpec ? '#ff6600' : '#c0a060';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bowCX, arrowY + 60);
    ctx.lineTo(bowCX, arrowY - 10);
    ctx.stroke();
    // 화살촉 (위를 향함)
    ctx.fillStyle = isSpec ? '#ff4400' : '#888';
    ctx.beginPath();
    ctx.moveTo(bowCX, arrowY - 15);
    ctx.lineTo(bowCX - 4, arrowY - 5);
    ctx.lineTo(bowCX + 4, arrowY - 5);
    ctx.closePath();
    ctx.fill();
    // 깃털 (아래쪽)
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

  // 파워 게이지 (오른쪽에 세로로)
  if (b.drawing && b.drawPower > 0) {
    const gaugeX = ox + QUIVER_W + BOW_W - 25;
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

  // 드래그 중인 화살 (세로 - 촉이 위)
  if (arrowDrag) {
    ctx.strokeStyle = '#c0a060';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(arrowDrag.x, arrowDrag.y + 30);
    ctx.lineTo(arrowDrag.x, arrowDrag.y - 30);
    ctx.stroke();
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.moveTo(arrowDrag.x, arrowDrag.y - 35);
    ctx.lineTo(arrowDrag.x - 4, arrowDrag.y - 25);
    ctx.lineTo(arrowDrag.x + 4, arrowDrag.y - 25);
    ctx.closePath();
    ctx.fill();
  }

  // 힌트 텍스트
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  if (!b.arrowNocked) {
    ctx.fillText('화살통→활: 장전 | ←→조준', bowCX, CONTROLS_BOTTOM - 8);
  } else if (!b.drawing) {
    ctx.fillText('↓시위 | ←→조준', bowCX, CONTROLS_BOTTOM - 8);
  } else {
    ctx.fillText('놓으면 발사! ←→조준', bowCX, CONTROLS_BOTTOM - 8);
  }

  ctx.restore();
}
