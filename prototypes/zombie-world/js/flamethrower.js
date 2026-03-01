// ── 화염방사기 시스템: 연료 + 지속 발사 ──
import { state, W, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H, ITEM_BAR_H, TOWER_Y, emitSound, getFireOrigin } from './game.js?v=19';
import { registerZone } from './input.js?v=19';
import { spawnParticles } from './particles.js?v=19';
import { playFlameLoop, playFlameStop } from './audio.js?v=19';
import { getWeatherEffects } from './weather.js?v=19';

const CTRL_Y = CONTROLS_TOP + SLOT_H + ITEM_BAR_H;
const CTRL_H = CONTROLS_BOTTOM - CTRL_Y;

// 2-column: fuel tank (left 30%) | flamethrower (right 70%)
const TANK_W = Math.floor(W * 0.30);
const GUN_W = W - TANK_W;

const FUEL_RATE = 15;  // 초당 연료 소모
const DAMAGE_RATE = 1.5; // 초당 데미지 (v3 밸런스: 3→1.5)
const FLAME_RANGE = 180; // 화염 사거리
const FLAME_SPREAD = 0.4; // 화염 확산 각도 (라디안)

let gunHeld = false;
let gunLastX = 0;
let flameSoundTimer = 0;

// 연료 드래그
let fuelDrag = null;

export function initFlamethrower() {
  // ── 연료통 영역 (왼쪽 30%) ──
  registerZone(
    { x: 0, y: CTRL_Y, w: TANK_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'flamethrower') return false;
        if (state.flamethrower.reserveFuel <= 0) return false;
        fuelDrag = { x, y };
      },
      onMove(x, y) {
        if (fuelDrag) { fuelDrag.x = x; fuelDrag.y = y; }
      },
      onEnd(x, y) {
        if (!fuelDrag) return;
        const f = state.flamethrower;
        // 오른쪽 영역에 드롭 → 충전
        if (x >= TANK_W && f.fuel < f.fuelMax && f.reserveFuel > 0) {
          const refill = Math.min(f.fuelMax - f.fuel, f.reserveFuel, 30);
          f.reserveFuel -= refill;
          f.fuel += refill;
        }
        fuelDrag = null;
      },
    },
    5
  );

  // ── 화염방사기 영역 (오른쪽 70%) ──
  registerZone(
    { x: TANK_W, y: CTRL_Y, w: GUN_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'flamethrower') return false;
        gunHeld = true;
        gunLastX = x;
      },
      onMove(x, y) {
        if (state.currentWeapon !== 'flamethrower' || !gunHeld) return;
        // 좌우 드래그로 조준
        const frameDx = x - gunLastX;
        gunLastX = x;
        const aimSens = 0.005;
        state.aimAngle -= frameDx * aimSens; while (state.aimAngle < 0) state.aimAngle += Math.PI * 2; while (state.aimAngle >= Math.PI * 2) state.aimAngle -= Math.PI * 2;
      },
      onEnd() {
        gunHeld = false;
        state.flamethrower.firing = false;
      },
    },
    5
  );
}

export function updateFlamethrower(dt) {
  if (state.currentWeapon !== 'flamethrower') {
    state.flamethrower.firing = false;
    gunHeld = false;
    return;
  }

  const f = state.flamethrower;

  const weatherFx = getWeatherEffects(state.currentWeather);

  if (gunHeld && f.fuel > 0 && weatherFx.fireFuelMul !== Infinity) {
    f.firing = true;

    // 연료 소모 (날씨 영향)
    const effectiveRate = (state.buffs.speedTimer > 0 ? FUEL_RATE * 0.7 : FUEL_RATE) * weatherFx.fireFuelMul;
    f.fuel -= effectiveRate * dt;
    if (f.fuel <= 0) {
      f.fuel = 0;
      f.firing = false;
    }

    // 화염 사운드
    flameSoundTimer -= dt;
    if (flameSoundTimer <= 0) {
      playFlameLoop();
      flameSoundTimer = 0.2;
    }

    // 소리 방출 (좀비 유인)
    const origin = getFireOrigin();
    emitSound(origin.x, origin.y, 320, 0.3, 'weapon');

    // 화염 영역 내 좀비 데미지
    const angle = state.aimAngle;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    for (const z of state.zombies) {
      if (!z.alive) continue;
      const dx = z.x - origin.x;
      const dy = -(z.y - origin.y); // canvas Y 반전
      const dist = Math.hypot(dx, dy);
      if (dist > FLAME_RANGE || dist < 10) continue;

      // 각도 체크
      const zA = Math.atan2(dy, dx);
      let angleDiff = zA - angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      if (Math.abs(angleDiff) > FLAME_SPREAD) continue;

      // 거리에 따른 데미지 감쇠
      const falloff = 1 - (dist / FLAME_RANGE) * 0.5;
      z.hp -= DAMAGE_RATE * falloff * dt;
      z.hitFlash = 0.05;

      // 불 상태이상 (짧은 지속화상)
      if (!z.statusEffects.burning) z.statusEffects.burning = 0;
      z.statusEffects.burning = 1.5;
    }

    // 화염 파티클
    f.flameTimer = (f.flameTimer || 0) + dt;
    if (f.flameTimer > 0.03) {
      f.flameTimer = 0;
      const pAngle = angle + (Math.random() - 0.5) * FLAME_SPREAD * 2;
      const pDist = 30 + Math.random() * (FLAME_RANGE - 30);
      const px = origin.x + Math.cos(pAngle) * pDist;
      const py = origin.y - Math.sin(pAngle) * pDist;
      spawnParticles(px, py, 'fireSmall');
    }
  } else {
    if (f.firing) {
      f.firing = false;
      playFlameStop();
    }
    flameSoundTimer = 0;
  }
}

export function drawFlamethrower(ctx) {
  if (state.currentWeapon !== 'flamethrower') return;

  const f = state.flamethrower;
  const baseY = CTRL_Y + 20;

  ctx.save();

  // 영역 구분선
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(TANK_W, CTRL_Y);
  ctx.lineTo(TANK_W, CONTROLS_BOTTOM);
  ctx.stroke();

  // 레이블
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('연료', TANK_W / 2, CTRL_Y + 14);
  ctx.fillText('화염방사기', TANK_W + GUN_W / 2, CTRL_Y + 14);

  // ── 왼쪽: 연료통 ──
  const tankCX = TANK_W / 2;
  const tankX = tankCX - 40;
  const tankY = baseY + 10;
  const tankW = 80;
  const tankH = 130;

  // 탱크 외형
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(tankX, tankY, tankW, tankH);
  ctx.strokeStyle = '#5a4a2a';
  ctx.lineWidth = 2;
  ctx.strokeRect(tankX, tankY, tankW, tankH);

  // 연료 레벨
  const fuelRatio = f.reserveFuel / 200;
  const fuelH = Math.min(tankH - 4, fuelRatio * (tankH - 4));
  ctx.fillStyle = '#cc6600';
  ctx.fillRect(tankX + 2, tankY + tankH - 2 - fuelH, tankW - 4, fuelH);

  // 연료 수
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.floor(f.reserveFuel)}`, tankCX, tankY + tankH + 20);

  // 힌트
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.fillText('→방사기로 드래그', tankCX, CONTROLS_BOTTOM - 8);

  // ── 오른쪽: 화염방사기 ──
  const gunCX = TANK_W + GUN_W / 2;
  const gunCY = baseY + 70;

  // 본체
  ctx.fillStyle = '#444';
  ctx.fillRect(gunCX - 25, gunCY - 10, 50, 45);

  // 노즐 (위로 향함)
  ctx.fillStyle = '#555';
  ctx.fillRect(gunCX - 8, gunCY - 60, 16, 55);
  // 노즐 끝
  ctx.fillStyle = '#666';
  ctx.fillRect(gunCX - 12, gunCY - 65, 24, 10);

  // 연료 탱크 (측면)
  ctx.fillStyle = '#3a3a1a';
  ctx.fillRect(gunCX - 35, gunCY + 5, 15, 35);
  ctx.strokeStyle = '#5a5a2a';
  ctx.lineWidth = 1;
  ctx.strokeRect(gunCX - 35, gunCY + 5, 15, 35);

  // 연료 탱크 레벨
  const curRatio = f.fuel / f.fuelMax;
  const curFuelH = curRatio * 31;
  ctx.fillStyle = '#ff6600';
  ctx.fillRect(gunCX - 33, gunCY + 37 - curFuelH, 11, curFuelH);

  // 손잡이
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(gunCX - 8, gunCY + 30, 16, 50);
  ctx.fillRect(gunCX + 12, gunCY + 40, 16, 25);

  // 파일럿 라이트
  if (f.fuel > 0) {
    const flicker = 0.6 + Math.random() * 0.4;
    ctx.fillStyle = `rgba(255,120,20,${flicker * 0.6})`;
    ctx.beginPath();
    ctx.arc(gunCX, gunCY - 68, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 발사 중 화염 이펙트
  if (f.firing && f.fuel > 0) {
    const flicker = 0.7 + Math.random() * 0.3;
    // 큰 화염
    ctx.fillStyle = `rgba(255,100,0,${flicker * 0.5})`;
    ctx.beginPath();
    ctx.arc(gunCX, gunCY - 75, 12 + Math.random() * 8, 0, Math.PI * 2);
    ctx.fill();
    // 밝은 중심
    ctx.fillStyle = `rgba(255,200,50,${flicker * 0.4})`;
    ctx.beginPath();
    ctx.arc(gunCX, gunCY - 80, 6 + Math.random() * 5, 0, Math.PI * 2);
    ctx.fill();
    // 상태 텍스트
    ctx.fillStyle = '#ff6600';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FIRING', gunCX, CONTROLS_BOTTOM - 22);
  }

  // 연료 게이지 (본체 옆)
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.floor(f.fuel)}/${f.fuelMax}`, gunCX, gunCY + 90);

  if (f.fuel <= 0) {
    ctx.fillStyle = '#f44';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('EMPTY', gunCX, CONTROLS_BOTTOM - 22);
  }

  // 힌트
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('꾹:발사 ←→조준', gunCX, CONTROLS_BOTTOM - 8);

  // ── 드래그 중인 연료 ──
  if (fuelDrag) {
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.arc(fuelDrag.x, fuelDrag.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cc5500';
    ctx.beginPath();
    ctx.arc(fuelDrag.x, fuelDrag.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 방사기 위에 있으면 하이라이트
    if (fuelDrag.x >= TANK_W && f.fuel < f.fuelMax) {
      ctx.strokeStyle = 'rgba(255,150,50,0.6)';
      ctx.lineWidth = 3;
      ctx.strokeRect(gunCX - 40, gunCY - 70, 80, 170);
    }
  }

  ctx.restore();
}

/**
 * 필드 위에 화염 범위 오버레이 표시
 */
export function drawFlameOverlay(ctx) {
  if (state.currentWeapon !== 'flamethrower') return;
  const f = state.flamethrower;
  if (!gunHeld && !f.firing) return;

  ctx.save();
  const angle = state.aimAngle;
  const fo = getFireOrigin();
  const tx = fo.x;
  const ty = fo.y;

  // 화염 부채꼴 영역 표시
  const alpha = f.firing ? 0.15 : 0.06;
  ctx.fillStyle = `rgba(255,100,0,${alpha})`;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  // canvas에서 위쪽이 - 이므로 각도 반전
  ctx.arc(tx, ty, FLAME_RANGE, -(angle + FLAME_SPREAD), -(angle - FLAME_SPREAD));
  ctx.closePath();
  ctx.fill();

  // 외곽선
  ctx.strokeStyle = `rgba(255,100,0,${f.firing ? 0.4 : 0.15})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.arc(tx, ty, FLAME_RANGE, -(angle + FLAME_SPREAD), -(angle - FLAME_SPREAD));
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}
