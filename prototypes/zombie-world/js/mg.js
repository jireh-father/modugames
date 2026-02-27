// ── 기관총 시스템: 연사 + 과열 ──
import { state, W, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H } from './game.js?v=1';

const JOYSTICK_W = 0; // 다이얼 기반 조준으로 조이스틱 오프셋 불필요
import { registerZone } from './input.js?v=1';
import { fireProjectile } from './projectiles.js?v=1';
import { playMGShot, playMGBurstEnd, playMGCock, playMGOverheat, playMGCooldown } from './audio.js?v=1';
import { spawnParticles } from './particles.js?v=1';

const CTRL_Y = CONTROLS_TOP + SLOT_H;
const CTRL_H = CONTROLS_BOTTOM - CTRL_Y;
const WEAPON_W = W - JOYSTICK_W;

const FIRE_RATE = 0.1; // 초당 10발
const HEAT_PER_SHOT = 0.04; // 발당 과열 증가
const COOL_RATE = 0.15; // 초당 과열 감소
const OVERHEAT_THRESHOLD = 1.0;
const COOLDOWN_TIME = 2.0; // 과열 후 강제 쿨다운

let triggerHeld = false;

export function initMG() {
  // ── 전체 무기 영역: 누르고 있으면 연사 ──
  registerZone(
    { x: JOYSTICK_W, y: CTRL_Y, w: WEAPON_W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'mg') return false;
        const m = state.mg;
        if (m.overheated || !m.cocked) return false;
        triggerHeld = true;
        m.firing = true;
      },
      onMove() {},
      onEnd() {
        if (state.currentWeapon !== 'mg') return;
        triggerHeld = false;
        state.mg.firing = false;
        if (state.mg.fireTimer > 0) playMGBurstEnd();
      },
    },
    5
  );

  // ── 코킹 핸들 (우측 상단 탭) ──
  registerZone(
    { x: JOYSTICK_W + WEAPON_W - 80, y: CTRL_Y, w: 80, h: 50 },
    {
      onTap() {
        if (state.currentWeapon !== 'mg') return;
        const m = state.mg;
        if (!m.cocked && m.ammo > 0) {
          m.cocked = true;
          playMGCock();
        }
        // 과열 후 수동 코킹으로 재시작
        if (m.overheated && m.heat <= 0.3) {
          m.overheated = false;
          m.cocked = true;
          playMGCock();
        }
      },
    },
    6
  );
}

export function updateMG(dt) {
  if (state.currentWeapon !== 'mg') {
    state.mg.firing = false;
    triggerHeld = false;
    return;
  }

  const m = state.mg;

  // 과열 쿨다운
  if (m.overheated) {
    m.heat = Math.max(0, m.heat - COOL_RATE * 1.5 * dt);
    if (m.heat <= 0.2) {
      playMGCooldown();
    }
  } else {
    // 일반 냉각
    if (!m.firing) {
      m.heat = Math.max(0, m.heat - COOL_RATE * dt);
    }
  }

  // 연사 중
  if (m.firing && !m.overheated && m.cocked && m.ammo > 0) {
    m.fireTimer += dt;
    const effectiveRate = state.buffs.speedTimer > 0 ? FIRE_RATE * 0.5 : FIRE_RATE;
    while (m.fireTimer >= effectiveRate && m.ammo > 0) {
      m.fireTimer -= effectiveRate;
      m.ammo--;
      fireProjectile('mgBullet', state.aimAngle);
      playMGShot();
      spawnParticles(W / 2, CONTROLS_TOP - 10, 'muzzleFlash');

      m.heat += HEAT_PER_SHOT;
      if (m.heat >= OVERHEAT_THRESHOLD) {
        m.overheated = true;
        m.firing = false;
        m.cocked = false;
        triggerHeld = false;
        playMGOverheat();
        break;
      }
    }

    if (m.ammo <= 0) {
      m.firing = false;
      m.cocked = false;
      triggerHeld = false;
      // 예비탄 자동 재장전
      if (m.reserveAmmo > 0) {
        const reload = Math.min(30, m.reserveAmmo);
        m.reserveAmmo -= reload;
        m.ammo = reload;
      }
    }
  }
}

export function drawMG(ctx) {
  if (state.currentWeapon !== 'mg') return;

  const m = state.mg;
  const ox = JOYSTICK_W;
  const baseY = CTRL_Y + 20;

  ctx.save();

  // 구분선
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ox, CTRL_Y);
  ctx.lineTo(ox, CONTROLS_BOTTOM);
  ctx.stroke();

  // 레이블
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('기관총', ox + WEAPON_W / 2, CTRL_Y + 14);

  // ── 총 몸체 ──
  const gunCX = ox + WEAPON_W / 2;
  const gunCY = baseY + 60;

  // 몸통
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(gunCX - 80, gunCY - 15, 160, 30);
  // 총열
  ctx.fillStyle = m.heat > 0.5 ? `rgb(${140 + m.heat * 115}, ${60 - m.heat * 30}, ${30})` : '#555';
  ctx.fillRect(gunCX - 100, gunCY - 8, 40, 16);
  // 탄띠 구멍
  ctx.fillStyle = '#222';
  ctx.fillRect(gunCX + 50, gunCY - 5, 30, 10);
  // 손잡이
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(gunCX + 10, gunCY + 10, 20, 40);

  // 코킹 핸들
  const cockX = ox + WEAPON_W - 40;
  const cockY = CTRL_Y + 25;
  ctx.fillStyle = m.cocked ? '#666' : '#aa4';
  ctx.fillRect(cockX - 25, cockY - 12, 50, 24);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.strokeRect(cockX - 25, cockY - 12, 50, 24);
  ctx.fillStyle = '#fff';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(m.cocked ? '코킹됨' : '코킹', cockX, cockY + 4);

  // ── 과열 게이지 ──
  const gaugeX = ox + 15;
  const gaugeY = baseY + 120;
  const gaugeW = WEAPON_W - 30;
  const gaugeH = 16;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(gaugeX, gaugeY, gaugeW, gaugeH);

  // 과열 바
  const heatW = m.heat * gaugeW;
  const heatColor = m.overheated ? '#f44' : m.heat > 0.7 ? '#fa4' : m.heat > 0.4 ? '#ff4' : '#4f4';
  ctx.fillStyle = heatColor;
  ctx.fillRect(gaugeX, gaugeY, heatW, gaugeH);

  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(gaugeX, gaugeY, gaugeW, gaugeH);

  // 과열 텍스트
  if (m.overheated) {
    const flash = Math.sin(Date.now() / 100) > 0;
    if (flash) {
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('OVERHEAT!', ox + WEAPON_W / 2, gaugeY - 5);
    }
  }

  // ── 탄약 수 ──
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${m.ammo}`, ox + WEAPON_W / 2 - 30, gaugeY + gaugeH + 25);

  if (m.reserveAmmo > 0) {
    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.fillText(`+${m.reserveAmmo}`, ox + WEAPON_W / 2 + 30, gaugeY + gaugeH + 25);
  }

  // 머즐 플래시 효과 (연사 중)
  if (m.firing && m.ammo > 0) {
    ctx.fillStyle = `rgba(255,200,50,${0.3 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(gunCX - 100, gunCY, 8 + Math.random() * 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 힌트
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('꾹 누르기: 연사 | 과열 주의!', ox + WEAPON_W / 2, CONTROLS_BOTTOM - 8);

  ctx.restore();
}
