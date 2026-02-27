// ── 저격총 시스템: 볼트액션 + 스코프 ──
import { state, W, H, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H, JOYSTICK_W, RANGE_TOP, RANGE_BOTTOM } from './game.js?v=1';
import { registerZone } from './input.js?v=1';
import { fireProjectile } from './projectiles.js?v=1';
import { playSniperShot, playSniperBoltUp, playSniperBoltDown, playSniperLoad, playScopeZoom } from './audio.js?v=1';
import { spawnParticles } from './particles.js?v=1';
import { getCrosshairScreen } from './renderer.js?v=1';

const CTRL_Y = CONTROLS_TOP + SLOT_H;
const CTRL_H = CONTROLS_BOTTOM - CTRL_Y;
const WEAPON_W = W - JOYSTICK_W;
const COL_W = WEAPON_W / 3;

// 드래그 상태
let boltDragY = 0;
let boltDragging = false;
let scopeDragging = false;

export function initSniper() {
  // ── 볼트 영역 (왼쪽) - 위로 드래그: 볼트 열기, 아래로: 볼트 닫기 ──
  registerZone(
    { x: JOYSTICK_W, y: CTRL_Y, w: COL_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'sniper') return false;
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
          // 아래로 드래그 → 볼트 닫기 (새 탄 장전)
          if (s.reserveRounds > 0) {
            s.reserveRounds--;
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

  // ── 방아쇠 영역 (가운데) - 탭 즉시 발사 ──
  registerZone(
    { x: JOYSTICK_W + COL_W, y: CTRL_Y, w: COL_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'sniper') return false;
        const s = state.sniper;
        if (s.chambered && !s.boltOpen) {
          s.chambered = false;
          fireProjectile('sniper', state.aimX, state.aimY, false);
          playSniperShot();
          spawnParticles(W / 2, CONTROLS_TOP - 10, 'muzzleFlash');
          // 자동 볼트 열림 (반동)
          s.boltOpen = true;
        }
      },
      onEnd() {},
    },
    5
  );

  // ── 스코프 영역 (오른쪽) - 길게 누르면 스코프 ON ──
  registerZone(
    { x: JOYSTICK_W + COL_W * 2, y: CTRL_Y, w: COL_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'sniper') return false;
        scopeDragging = true;
        state.sniper.scoping = true;
        playScopeZoom();
      },
      onEnd() {
        if (state.currentWeapon !== 'sniper') return;
        scopeDragging = false;
        state.sniper.scoping = false;
      },
    },
    5
  );
}

// ── 스코프 줌 업데이트 ──
export function updateSniper(dt) {
  if (state.currentWeapon !== 'sniper') {
    state.sniper.scoping = false;
    state.sniper.scopeZoom = 0;
    return;
  }
  const s = state.sniper;
  if (s.scoping) {
    s.scopeZoom = Math.min(1, s.scopeZoom + dt * 3);
  } else {
    s.scopeZoom = Math.max(0, s.scopeZoom - dt * 5);
  }
}

// ── 스코프 오버레이 렌더링 (사격장 위에 그려짐) ──
export function drawScopeOverlay(ctx) {
  const s = state.sniper;
  if (s.scopeZoom <= 0) return;

  const alpha = s.scopeZoom;
  const { cx, cy } = getCrosshairScreen();

  // 스코프 원 크기 (줌에 따라 커짐)
  const scopeR = 60 + alpha * 100;

  // 스코프 밖은 어둡게
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${alpha * 0.85})`;
  ctx.fillRect(0, RANGE_TOP, W, RANGE_BOTTOM - RANGE_TOP);

  // 스코프 원 (안은 밝게 = 클리어)
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, scopeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  // 스코프 테두리
  ctx.strokeStyle = `rgba(40,40,40,${alpha})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, scopeR, 0, Math.PI * 2);
  ctx.stroke();

  // 스코프 내부 십자선 (얇고 정밀)
  ctx.strokeStyle = `rgba(255,80,80,${alpha * 0.7})`;
  ctx.lineWidth = 1;
  // 가로
  ctx.beginPath();
  ctx.moveTo(cx - scopeR + 10, cy);
  ctx.lineTo(cx - 8, cy);
  ctx.moveTo(cx + 8, cy);
  ctx.lineTo(cx + scopeR - 10, cy);
  ctx.stroke();
  // 세로
  ctx.beginPath();
  ctx.moveTo(cx, cy - scopeR + 10);
  ctx.lineTo(cx, cy - 8);
  ctx.moveTo(cx, cy + 8);
  ctx.lineTo(cx, cy + scopeR - 10);
  ctx.stroke();

  // 밀 닷 (거리 눈금)
  ctx.fillStyle = `rgba(255,80,80,${alpha * 0.5})`;
  for (let i = 1; i <= 3; i++) {
    const d = i * 20;
    ctx.beginPath();
    ctx.arc(cx, cy + d, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy - d, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 배율 표시
  const zoom = (2 + alpha * 4).toFixed(1);
  ctx.fillStyle = `rgba(255,255,255,${alpha * 0.5})`;
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${zoom}x`, cx + scopeR - 15, cy + scopeR - 15);
}

// ── 조작부 렌더링 ──
export function drawSniper(ctx) {
  if (state.currentWeapon !== 'sniper') return;

  const s = state.sniper;
  const ox = JOYSTICK_W;
  const baseY = CTRL_Y + 30;

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
  ctx.fillText('방아쇠', ox + COL_W * 1.5, CTRL_Y + 14);
  ctx.fillText('스코프', ox + COL_W * 2.5, CTRL_Y + 14);

  // ── 볼트 영역 ──
  const boltX = ox + COL_W / 2;
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
  const trigX = ox + COL_W * 1.5;
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
  ctx.fillText('탭: 발사', trigX, CONTROLS_BOTTOM - 8);

  // ── 스코프 버튼 ──
  const scopeX = ox + COL_W * 2.5;
  const scopeY = baseY + 70;

  // 스코프 아이콘 (원 + 십자)
  ctx.strokeStyle = s.scoping ? '#6af' : '#666';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(scopeX, scopeY, 25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(scopeX - 20, scopeY);
  ctx.lineTo(scopeX + 20, scopeY);
  ctx.moveTo(scopeX, scopeY - 20);
  ctx.lineTo(scopeX, scopeY + 20);
  ctx.stroke();

  // 남은 탄수
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${s.reserveRounds + (s.chambered ? 1 : 0)}`, scopeX, scopeY + 50);

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.fillText('꾹: 스코프', scopeX, CONTROLS_BOTTOM - 8);

  ctx.restore();
}
