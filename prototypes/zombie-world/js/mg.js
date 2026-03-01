// ── 기관총 시스템: 탄띠 + 자동 연사 ──
import { state, W, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H, ITEM_BAR_H } from './game.js?v=311';
import { registerZone } from './input.js?v=311';
import { fireProjectile } from './projectiles.js?v=311';
import { playMGShot, playMGBurstEnd, playMGCock } from './audio.js?v=311';
import { spawnParticles } from './particles.js?v=311';

const CTRL_Y = CONTROLS_TOP + SLOT_H + ITEM_BAR_H;
const CTRL_H = CONTROLS_BOTTOM - CTRL_Y;

// 3-column layout: belt (left) | gun (center) | spare ammo (right)
const COL_W = W / 3;

const FIRE_RATE = 0.1; // 초당 10발
const BELT_MAX = 30;   // 탄띠 최대 장탄수

// 드래그 상태
let ammoDrag = null; // { x, y } 총알 드래그 중 (오른쪽→왼쪽)
let gunHeld = false; // 기관총 터치 중 (발사 활성화)

export function initMG() {
  // ── 탄띠 영역 (왼쪽) ──
  registerZone(
    { x: 0, y: CTRL_Y, w: COL_W, h: CTRL_H },
    {
      onStart() { return false; }, // 탄띠 영역은 드롭 대상일 뿐
    },
    5
  );

  // ── 중앙: 총 몸체 (터치하면 발사 + 좌우 드래그로 조준) ──
  registerZone(
    { x: COL_W, y: CTRL_Y, w: COL_W, h: CTRL_H },
    {
      _lastX: 0,
      onStart(x, y) {
        if (state.currentWeapon !== 'mg') return false;
        this._lastX = x;
        gunHeld = true;
      },
      onMove(x) {
        if (state.currentWeapon !== 'mg') return;
        const frameDx = x - this._lastX;
        this._lastX = x;
        const aimSens = 0.005;
        state.aimAngle -= frameDx * aimSens; while (state.aimAngle < 0) state.aimAngle += Math.PI * 2; while (state.aimAngle >= Math.PI * 2) state.aimAngle -= Math.PI * 2;
      },
      onEnd() {
        gunHeld = false;
        state.mg.firing = false;
      },
    },
    5
  );

  // ── 여분 총알 영역 (오른쪽) - 드래그 시작 ──
  registerZone(
    { x: COL_W * 2, y: CTRL_Y, w: COL_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'mg') return false;
        if (state.mg.reserveAmmo <= 0) return false;
        ammoDrag = { x, y };
      },
      onMove(x, y) {
        if (ammoDrag) {
          ammoDrag.x = x;
          ammoDrag.y = y;
        }
      },
      onEnd(x, y) {
        if (!ammoDrag) return;
        const m = state.mg;
        // 왼쪽 탄띠 영역에 드롭했으면 장전
        if (x < COL_W && m.ammo < BELT_MAX && m.reserveAmmo > 0) {
          const reload = Math.min(BELT_MAX - m.ammo, m.reserveAmmo, 10); // 한번에 최대 10발
          m.reserveAmmo -= reload;
          m.ammo += reload;
          playMGCock();
        }
        ammoDrag = null;
      },
    },
    5
  );
}

export function updateMG(dt) {
  if (state.currentWeapon !== 'mg') {
    state.mg.firing = false;
    gunHeld = false;
    return;
  }

  const m = state.mg;

  // 기관총 터치 중 + 탄띠에 탄약 있으면 연사
  if (gunHeld && m.ammo > 0) {
    m.firing = true;
    m.fireTimer += dt;
    const effectiveRate = state.buffs.speedTimer > 0 ? FIRE_RATE * 0.5 : FIRE_RATE;
    while (m.fireTimer >= effectiveRate && m.ammo > 0) {
      m.fireTimer -= effectiveRate;
      m.ammo--;
      fireProjectile('mgBullet', state.aimAngle);
      playMGShot();
      spawnParticles(W / 2, CONTROLS_TOP - 10, 'muzzleFlash');
    }
    if (m.ammo <= 0) {
      m.firing = false;
      playMGBurstEnd();
    }
  } else {
    if (m.firing && !gunHeld) playMGBurstEnd();
    m.firing = false;
    m.fireTimer = 0;
  }
}

export function drawMG(ctx) {
  if (state.currentWeapon !== 'mg') return;

  const m = state.mg;
  const baseY = CTRL_Y + 20;

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
  ctx.fillText('탄띠', COL_W / 2, CTRL_Y + 14);
  ctx.fillText('기관총', COL_W * 1.5, CTRL_Y + 14);
  ctx.fillText('여분탄', COL_W * 2.5, CTRL_Y + 14);

  // ── 왼쪽: 탄띠 ──
  const beltCX = COL_W / 2;
  const beltBoxX = beltCX - 50;
  const beltBoxY = baseY + 10;
  const beltBoxW = 100;
  const beltBoxH = 140;

  // 탄띠 상자
  ctx.fillStyle = '#3a3a2a';
  ctx.fillRect(beltBoxX, beltBoxY, beltBoxW, beltBoxH);
  ctx.strokeStyle = '#5a5a3a';
  ctx.lineWidth = 1;
  ctx.strokeRect(beltBoxX, beltBoxY, beltBoxW, beltBoxH);

  // 탄띠 총알들 (2열 * 최대 15행)
  const cols = 2;
  const bulletW = 38;
  const bulletH = 8;
  const gapY = 1;
  for (let i = 0; i < BELT_MAX; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const bx = beltBoxX + 8 + col * (bulletW + 8);
    const by = beltBoxY + 5 + row * (bulletH + gapY);
    if (by + bulletH > beltBoxY + beltBoxH) break;
    if (i < m.ammo) {
      // 총알 있음
      ctx.fillStyle = '#cca040';
      ctx.fillRect(bx, by, bulletW, bulletH);
      ctx.fillStyle = '#aa7020';
      ctx.fillRect(bx, by, bulletW * 0.3, bulletH); // 탄두 부분
    } else {
      // 빈 슬롯
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(bx, by, bulletW, bulletH);
    }
  }

  // 탄띠 수
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${m.ammo}/${BELT_MAX}`, beltCX, beltBoxY + beltBoxH + 20);

  // 발사 상태 표시
  if (m.firing && m.ammo > 0) {
    const flash = Math.sin(Date.now() / 80) > 0;
    ctx.fillStyle = flash ? 'rgba(255,200,50,0.4)' : 'rgba(255,100,30,0.3)';
    ctx.fillRect(beltBoxX, beltBoxY, beltBoxW, beltBoxH);
    ctx.fillStyle = '#ff4';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FIRING', beltCX, beltBoxY + beltBoxH + 36);
  } else if (m.ammo === 0) {
    ctx.fillStyle = '#f44';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EMPTY', beltCX, beltBoxY + beltBoxH + 36);
  }

  // ── 가운데: 기관총 몸체 (총구 위를 향함) ──
  const gunCX = COL_W * 1.5;
  const gunCY = baseY + 70;

  // 총열 (위로 향함)
  ctx.fillStyle = '#555';
  ctx.fillRect(gunCX - 5, gunCY - 60, 10, 50);
  // 총열 홀
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(gunCX, gunCY - 60, 4, 0, Math.PI * 2);
  ctx.fill();

  // 총 몸체
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(gunCX - 30, gunCY - 15, 60, 50);
  // 방열판 (좌측)
  ctx.fillStyle = '#444';
  ctx.fillRect(gunCX - 35, gunCY - 10, 8, 40);
  // 탄띠 입구 (왼쪽)
  ctx.fillStyle = '#222';
  ctx.fillRect(gunCX - 30, gunCY, 12, 8);

  // 손잡이
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(gunCX - 8, gunCY + 30, 16, 50);
  ctx.fillRect(gunCX + 10, gunCY + 40, 18, 30); // 피스톨 그립

  // 머즐 플래시 (발사 중)
  if (m.firing && m.ammo > 0) {
    ctx.fillStyle = `rgba(255,200,50,${0.4 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(gunCX, gunCY - 65, 6 + Math.random() * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,200,${0.2 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(gunCX, gunCY - 70, 3 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // 힌트
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('꾹:연사 ←→조준', gunCX, CONTROLS_BOTTOM - 8);

  // ── 오른쪽: 여분 총알 ──
  const spareCX = COL_W * 2.5;
  const spareBoxX = COL_W * 2 + 15;
  const spareBoxY = baseY + 15;
  const spareBoxW = COL_W - 30;
  const spareBoxH = 120;

  // 총알통 상자
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(spareBoxX, spareBoxY, spareBoxW, spareBoxH);
  ctx.strokeStyle = '#6a5a3a';
  ctx.lineWidth = 2;
  ctx.strokeRect(spareBoxX, spareBoxY, spareBoxW, spareBoxH);

  // 여분 총알들
  const spareCols = Math.floor(spareBoxW / 14);
  const maxShow = spareCols * 8;
  for (let i = 0; i < Math.min(m.reserveAmmo, maxShow); i++) {
    const bx = spareBoxX + 5 + (i % spareCols) * 14;
    const by = spareBoxY + 8 + Math.floor(i / spareCols) * 14;
    ctx.fillStyle = '#cca040';
    ctx.fillRect(bx, by, 10, 10);
    ctx.fillStyle = '#aa7020';
    ctx.fillRect(bx, by, 10, 4);
  }
  if (m.reserveAmmo > maxShow) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`+${m.reserveAmmo - maxShow}`, spareCX, spareBoxY + spareBoxH - 8);
  }

  // 여분 총알 수
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${m.reserveAmmo}`, spareCX, spareBoxY + spareBoxH + 20);

  // 힌트
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('→탄띠로 드래그', spareCX, CONTROLS_BOTTOM - 8);

  // ── 드래그 중인 총알 ──
  if (ammoDrag) {
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#ffcc44';
    ctx.fillRect(ammoDrag.x - 8, ammoDrag.y - 8, 16, 16);
    ctx.fillStyle = '#aa7020';
    ctx.fillRect(ammoDrag.x - 8, ammoDrag.y - 8, 16, 6);
    ctx.globalAlpha = 1;

    // 왼쪽 탄띠 위에 있으면 하이라이트
    if (ammoDrag.x < COL_W && m.ammo < BELT_MAX) {
      ctx.strokeStyle = 'rgba(255,200,100,0.6)';
      ctx.lineWidth = 3;
      ctx.strokeRect(beltBoxX - 2, beltBoxY - 2, beltBoxW + 4, beltBoxH + 4);
    }
  }

  ctx.restore();
}
