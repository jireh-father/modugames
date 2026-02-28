// ── 활 시스템: 조이스틱 조준 + X 마커 ──
import { state, W, H, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H, ITEM_BAR_H, FIELD_TOP, TOWER_Y } from './game.js?v=12';
import { registerZone } from './input.js?v=12';
import { fireProjectile } from './projectiles.js?v=12';
import { playBowDraw, playBowRelease, playArrowNock } from './audio.js?v=12';
import { spawnParticles } from './particles.js?v=12';

const CTRL_Y = CONTROLS_TOP + SLOT_H + ITEM_BAR_H;
const CTRL_H = CONTROLS_BOTTOM - CTRL_Y;

// 2-column layout: bow (left 60%) | joystick (right 40%)
const BOW_W = Math.floor(W * 0.6);
const JOY_W = W - BOW_W;

// 조이스틱 상수
const JOY_CX = BOW_W + JOY_W / 2;
const JOY_CY = CTRL_Y + CTRL_H / 2;
const JOY_R = Math.min(JOY_W, CTRL_H) * 0.35; // 조이스틱 반경

// 조이스틱 상태
let joyActive = false;
let joyDx = 0, joyDy = 0; // -1~1 정규화

// 타겟 위치 (필드 위)
let targetX = W / 2;
let targetY = 200;

export function initBow() {
  // ── 활 영역 (왼쪽 60%) - 터치하면 시위 당기기, 놓으면 발사 ──
  registerZone(
    { x: 0, y: CTRL_Y, w: BOW_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'bow') return false;
        const b = state.bow;
        if (b.arrows + b.specialArrows <= 0) return false;

        // 자동 장전 + 시위 당기기 시작
        if (!b.arrowNocked) {
          b.arrowNocked = true;
          if (b.arrows > 0) b.arrows--;
          else if (b.specialArrows > 0) { b.specialArrows--; b._specialNocked = true; }
          playArrowNock();
        }
        b.drawing = true;
        b.drawPower = 0;
        playBowDraw();
      },
      onMove(x, y, dx, dy) {
        if (state.currentWeapon !== 'bow' || !state.bow.drawing) return;
        // 아래로 드래그할수록 파워 증가
        state.bow.drawPower = Math.min(1, Math.max(0, dy / 100));
      },
      onEnd(x, y, dx, dy) {
        if (state.currentWeapon !== 'bow') return;
        const b = state.bow;
        if (!b.drawing) return;
        b.drawing = false;

        // 충분히 당겼으면 발사
        if (b.drawPower > 0.15 && b.arrowNocked) {
          const isSpecial = b._specialNocked || false;
          fireProjectile('arrow', state.aimAngle, isSpecial, b.drawPower);
          playBowRelease();
          spawnParticles(BOW_W / 2, CTRL_Y + CTRL_H * 0.35, 'bowString');
          b.arrowNocked = false;
          b._specialNocked = false;
        }
        b.drawPower = 0;
      },
    },
    5
  );

  // ── 조이스틱 영역 (오른쪽 40%) - 조준점 이동 ──
  registerZone(
    { x: BOW_W, y: CTRL_Y, w: JOY_W, h: CTRL_H },
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
  // 조이스틱 → 타겟 위치 계산
  // x: 화면 중앙 기준 좌우
  // y: 위로 갈수록 멀리 (필드 상단)
  targetX = W / 2 + joyDx * (W / 2 - 30);
  targetY = TOWER_Y - 100 + joyDy * (TOWER_Y - FIELD_TOP - 50) * -1;
  targetY = Math.max(FIELD_TOP + 10, Math.min(TOWER_Y - 30, targetY));

  // 타겟 위치에 따라 조준 각도 업데이트
  const aimDx = targetX - state.tower.x;
  const aimDy = -(targetY - TOWER_Y); // canvas Y 반전
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
  ctx.moveTo(BOW_W, CTRL_Y);
  ctx.lineTo(BOW_W, CONTROLS_BOTTOM);
  ctx.stroke();

  // 레이블
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('활', BOW_W / 2, CTRL_Y + 14);
  ctx.fillText('조준', JOY_CX, CTRL_Y + 14);

  // ── 왼쪽: 활 + 화살 ──
  const bowCX = BOW_W / 2;
  const bowCY = CTRL_Y + CTRL_H * 0.4;
  const bowLen = BOW_W * 0.55;

  // 화살 수 표시 (상단 좌측)
  ctx.fillStyle = '#c0a060';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`화살: ${b.arrows}`, 10, CTRL_Y + 14);
  if (b.specialArrows > 0) {
    ctx.fillStyle = '#ff6600';
    ctx.fillText(`+${b.specialArrows}`, 85, CTRL_Y + 14);
  }

  // 활 몸체 (가로 곡선 - 위로 볼록)
  ctx.strokeStyle = '#8B5E3C';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(bowCX - bowLen / 2, bowCY);
  ctx.quadraticCurveTo(bowCX, bowCY - 40, bowCX + bowLen / 2, bowCY);
  ctx.stroke();

  // 활 나무 질감
  ctx.strokeStyle = '#6B3E1C';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bowCX - bowLen / 2 + 2, bowCY);
  ctx.quadraticCurveTo(bowCX, bowCY - 38, bowCX + bowLen / 2 - 2, bowCY);
  ctx.stroke();

  // 시위 (아래로 당겨짐)
  const stringPull = b.drawing ? b.drawPower * 40 : 0;
  ctx.strokeStyle = '#c0a060';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bowCX - bowLen / 2, bowCY);
  ctx.lineTo(bowCX, bowCY + stringPull);
  ctx.lineTo(bowCX + bowLen / 2, bowCY);
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

  // 파워 게이지 (왼쪽에 세로)
  if (b.drawing && b.drawPower > 0) {
    const gaugeX = 8;
    const gaugeH = CTRL_H * 0.6;
    const gaugeY = CTRL_Y + (CTRL_H - gaugeH) / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(gaugeX, gaugeY, 12, gaugeH);

    const filled = b.drawPower * gaugeH;
    const gaugeColor = b.drawPower > 0.8 ? '#f44' : b.drawPower > 0.5 ? '#fa4' : '#4f4';
    ctx.fillStyle = gaugeColor;
    ctx.fillRect(gaugeX, gaugeY + gaugeH - filled, 12, filled);

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.strokeRect(gaugeX, gaugeY, 12, gaugeH);

    ctx.fillStyle = '#fff';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(Math.floor(b.drawPower * 100) + '%', gaugeX + 6, gaugeY - 5);
  }

  // 힌트
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  if (b.arrows + b.specialArrows <= 0) {
    ctx.fillText('화살 없음!', bowCX, CONTROLS_BOTTOM - 8);
  } else if (!b.arrowNocked) {
    ctx.fillText('터치: 장전+당기기', bowCX, CONTROLS_BOTTOM - 8);
  } else if (!b.drawing) {
    ctx.fillText('↓당기고 놓기: 발사', bowCX, CONTROLS_BOTTOM - 8);
  } else {
    ctx.fillText('놓으면 발사!', bowCX, CONTROLS_BOTTOM - 8);
  }

  // ── 오른쪽: 조이스틱 ──
  // 외곽 원
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(JOY_CX, JOY_CY, JOY_R, 0, Math.PI * 2);
  ctx.stroke();

  // 십자선 (가이드)
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(JOY_CX - JOY_R, JOY_CY);
  ctx.lineTo(JOY_CX + JOY_R, JOY_CY);
  ctx.moveTo(JOY_CX, JOY_CY - JOY_R);
  ctx.lineTo(JOY_CX, JOY_CY + JOY_R);
  ctx.stroke();

  // 조이스틱 핸들
  const handleX = JOY_CX + joyDx * JOY_R;
  const handleY = JOY_CY + joyDy * JOY_R;
  const handleR = 18;

  // 핸들에서 중심으로 선
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

  // 힌트
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('조준점 이동', JOY_CX, CONTROLS_BOTTOM - 8);

  ctx.restore();
}

/**
 * X 마커 오버레이 (필드 위에 타겟 표시)
 * main.js에서 필드 렌더링 후 호출
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

  // X 중앙 점
  ctx.fillStyle = `rgba(255,150,80,${alpha})`;
  ctx.beginPath();
  ctx.arc(targetX, targetY, 3, 0, Math.PI * 2);
  ctx.fill();

  // 글로우
  if (joyActive) {
    ctx.fillStyle = `rgba(255,100,50,0.1)`;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 25, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
