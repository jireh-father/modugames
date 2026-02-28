// ── 2D 탑다운 발사체 시스템 ──
import { state, W, TOWER_Y, WEAPON_PROFILES, emitSound, getFireOrigin } from './game.js?v=14';

export const PROJ_TO_WEAPON = {
  bullet: 'pistol', arrow: 'bow', sniper: 'sniper', mgBullet: 'mg', bolt: 'crossbow'
};

/**
 * 발사체 생성
 * @param {string} type - 'bullet' | 'arrow' | 'sniper' | 'mgBullet' | 'bolt'
 * @param {number} aimAngle - 조준 각도 (라디안)
 * @param {boolean} special - 관통탄/폭발화살 여부
 * @param {number} power - 화살/볼트 파워 (0~1)
 * @param {object} [targetPos] - 화살용 타겟 좌표 {x, y}
 */
export function fireProjectile(type, aimAngle, special = false, power = 1, targetPos = null) {
  // Spread as angle offset
  let spreadAngle = 0;
  if (type === 'bullet') spreadAngle = (Math.random() - 0.5) * 0.03;
  else if (type === 'mgBullet') spreadAngle = (Math.random() - 0.5) * 0.06;
  else if (type === 'sniper') spreadAngle = (Math.random() - 0.5) * 0.006;

  const finalAngle = aimAngle + spreadAngle;
  const fdx = Math.cos(finalAngle);
  const fdy = -Math.sin(finalAngle); // canvas Y is inverted

  // Speed (pixels per second)
  let speed = 800;
  if (type === 'arrow') speed = 300 + power * 400;
  else if (type === 'sniper') speed = 1200;
  else if (type === 'mgBullet') speed = 900;
  else if (type === 'bolt') speed = 500;

  // Max range from weapon profiles
  const wpName = PROJ_TO_WEAPON[type];
  const wp = wpName ? WEAPON_PROFILES[wpName] : null;
  let maxRange = wp ? wp.range : 9999;
  if (type === 'arrow') maxRange = Math.min(200 + power * 500, maxRange);
  else if (type === 'bolt') maxRange = Math.min(150 + power * 400, maxRange);

  // Check buff effects (only apply to non-arrow/bolt projectiles)
  const isGun = type !== 'arrow' && type !== 'bolt';
  const freeze = isGun && state.buffs.freezeShots > 0;
  const chain = isGun && state.buffs.chainShots > 0;
  const poison = isGun && state.buffs.poisonShots > 0;

  const origin = getFireOrigin();
  const proj = {
    type,
    special,
    x: origin.x,
    y: origin.y,
    dx: fdx,
    dy: fdy,
    speed,
    maxRange,
    traveled: 0,
    alive: true,
    trail: [],
    time: 0,
    power,
    freeze,
    chain,
    poison,
    damage: wp ? wp.damage : 1,
    penetrateLeft: wp ? wp.penetrate : 0,
  };

  // 화살: 포물선 비행 (타겟 지점으로 날아감)
  if (type === 'arrow' && targetPos) {
    proj.arcTarget = { x: targetPos.x, y: targetPos.y };
    proj.arcStartX = origin.x;
    proj.arcStartY = origin.y;
    const dist = Math.hypot(targetPos.x - origin.x, targetPos.y - origin.y);
    proj.arcDuration = Math.max(0.4, dist / (300 + power * 300)); // 비행 시간
    proj.arcTime = 0;
    proj.arcDescending = false; // 하강 중인지
    proj.arcLandRadius = 30; // 낙하지점 관통 판정 범위
  }

  // Emit origin sound
  if (wp && wp.originSound > 0) {
    emitSound(origin.x, origin.y, wp.originSound, 0.8, 'weapon');
  }

  // Consume buff shots
  if (freeze) state.buffs.freezeShots--;
  if (chain) state.buffs.chainShots--;
  if (poison) state.buffs.poisonShots--;

  state.projectiles.push(proj);
}

// 프레임당 빗나감 카운트
export let missedThisFrame = 0;

/**
 * 발사체 업데이트
 */
export function updateProjectiles(dt) {
  missedThisFrame = 0;
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];
    p.time += dt;

    if (p.type === 'arrow' && p.arcTarget) {
      // 화살: 포물선 비행
      p.arcTime += dt;
      const t = Math.min(p.arcTime / p.arcDuration, 1);

      // x,y 선형 보간 + 포물선 높이 오프셋
      const prevX = p.x, prevY = p.y;
      p.x = p.arcStartX + (p.arcTarget.x - p.arcStartX) * t;
      // y도 선형 보간하되, 포물선 높이 추가 (하늘로 올라갔다 내려옴)
      const baseY = p.arcStartY + (p.arcTarget.y - p.arcStartY) * t;
      const arcHeight = Math.hypot(p.arcTarget.x - p.arcStartX, p.arcTarget.y - p.arcStartY) * 0.3;
      const arcOffset = -4 * arcHeight * t * (1 - t); // 포물선: 0→peak→0
      p.y = baseY + arcOffset;

      // 이동 방향 업데이트 (렌더링용)
      const ddx = p.x - prevX;
      const ddy = p.y - prevY;
      const dLen = Math.hypot(ddx, ddy);
      if (dLen > 0.1) {
        p.dx = ddx / dLen;
        p.dy = ddy / dLen;
      }

      // 하강 여부 (t > 0.5이면 하강 중)
      p.arcDescending = t > 0.5;

      // 트레일
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 12) p.trail.shift();

      // 도착
      if (t >= 1) {
        p.alive = false;
        missedThisFrame++;
      }
    } else {
      // 일반 직선 발사체
      const move = p.speed * dt;
      p.x += p.dx * move;
      p.y += p.dy * move;
      p.traveled += move;

      // Trail for bolts
      if (p.type === 'bolt') {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 8) p.trail.shift();
      }

      // Out of bounds or max range reached
      if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > 1000 || p.traveled >= p.maxRange) {
        p.alive = false;
        missedThisFrame++;
      }
    }

    if (!p.alive) {
      state.projectiles.splice(i, 1);
    }
  }
}

/**
 * 발사체 렌더링 (2D 탑다운)
 */
export function drawProjectiles(ctx) {
  for (const p of state.projectiles) {
    if (p.type === 'bullet') {
      // 총알 - 작은 원 + 짧은 트레일
      const r = 3;
      ctx.fillStyle = p.special ? '#ffcc00' : '#ffa500';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      // 버프 표시
      if (p.freeze) {
        ctx.strokeStyle = 'rgba(100,200,255,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (p.poison) {
        ctx.strokeStyle = 'rgba(100,255,100,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 트레일
      if (p.time < 0.1) {
        const trailLen = 12;
        ctx.strokeStyle = p.special ? 'rgba(255,204,0,0.4)' : 'rgba(255,165,0,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - p.dx * trailLen, p.y - p.dy * trailLen);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    } else if (p.type === 'sniper') {
      // 저격탄 - 밝은 트레이서
      const r = 4;
      ctx.fillStyle = '#66bbff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      // 밝은 글로우
      ctx.fillStyle = 'rgba(100,180,255,0.3)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 2, 0, Math.PI * 2);
      ctx.fill();

      // 긴 트레이서 라인
      if (p.time < 0.15) {
        const trailLen = 30;
        ctx.strokeStyle = 'rgba(100,180,255,0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x - p.dx * trailLen, p.y - p.dy * trailLen);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    } else if (p.type === 'mgBullet') {
      // 기관총탄 - 작은 점
      const r = 2;
      ctx.fillStyle = '#ffaa44';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();

      // 짧은 트레일
      if (p.time < 0.06) {
        const trailLen = 8;
        ctx.strokeStyle = 'rgba(255,170,68,0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x - p.dx * trailLen, p.y - p.dy * trailLen);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    } else if (p.type === 'arrow') {
      // 화살 - 포물선 비행

      // 낙하지점 그림자 (타겟 위치에 표시)
      if (p.arcTarget) {
        const landAlpha = p.arcDescending ? 0.4 : 0.15;
        ctx.fillStyle = `rgba(180,160,100,${landAlpha})`;
        ctx.beginPath();
        ctx.arc(p.arcTarget.x, p.arcTarget.y, p.arcLandRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 잔상
      if (p.trail.length > 1) {
        for (let i = 1; i < p.trail.length; i++) {
          const t = p.trail[i];
          const prev = p.trail[i - 1];
          const alpha = i / p.trail.length * 0.4;
          ctx.strokeStyle = p.special ? `rgba(255,100,0,${alpha})` : `rgba(180,160,100,${alpha})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(t.x, t.y);
          ctx.stroke();
        }
      }

      // 화살 크기 (높이에 따라 작아짐 - 하늘에 있을때)
      const heightScale = p.arcTarget ? (p.arcDescending ? 1 : 0.6) : 1;

      // 본체
      const len = 16 * heightScale;
      ctx.strokeStyle = p.special ? '#ff6600' : '#c0a060';
      ctx.lineWidth = 3 * heightScale;
      ctx.beginPath();
      ctx.moveTo(p.x - p.dx * len, p.y - p.dy * len);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      // 화살촉
      const headSize = 4 * heightScale;
      ctx.fillStyle = p.special ? '#ff4400' : '#aaa';
      ctx.beginPath();
      ctx.moveTo(p.x + p.dx * headSize, p.y + p.dy * headSize);
      ctx.lineTo(p.x + p.dy * headSize, p.y - p.dx * headSize);
      ctx.lineTo(p.x - p.dy * headSize, p.y + p.dx * headSize);
      ctx.closePath();
      ctx.fill();

      // 깃털
      const tailX = p.x - p.dx * len;
      const tailY = p.y - p.dy * len;
      const featherSize = 5 * heightScale;
      ctx.fillStyle = p.special ? 'rgba(255,100,0,0.6)' : 'rgba(160,130,80,0.6)';
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(tailX + p.dy * featherSize, tailY - p.dx * featherSize);
      ctx.lineTo(tailX - p.dx * featherSize, tailY - p.dy * featherSize);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(tailX - p.dy * featherSize, tailY + p.dx * featherSize);
      ctx.lineTo(tailX - p.dx * featherSize, tailY - p.dy * featherSize);
      ctx.closePath();
      ctx.fill();
    } else if (p.type === 'bolt') {
      // 크로스보우 볼트 - 짧은 녹색 선 + 촉
      // 잔상
      if (p.trail.length > 1) {
        for (let i = 1; i < p.trail.length; i++) {
          const t = p.trail[i];
          const prev = p.trail[i - 1];
          const alpha = i / p.trail.length * 0.4;
          ctx.strokeStyle = `rgba(100,255,100,${alpha})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(t.x, t.y);
          ctx.stroke();
        }
      }

      // 본체
      const len = 12;
      ctx.strokeStyle = '#88ff88';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p.x - p.dx * len, p.y - p.dy * len);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      // 볼트 촉
      ctx.fillStyle = '#44cc44';
      ctx.beginPath();
      ctx.moveTo(p.x + p.dx * 3, p.y + p.dy * 3);
      ctx.lineTo(p.x + p.dy * 3, p.y - p.dx * 3);
      ctx.lineTo(p.x - p.dy * 3, p.y + p.dx * 3);
      ctx.closePath();
      ctx.fill();
    }
  }
}
