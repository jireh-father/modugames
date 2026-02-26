// ── 과녁 시스템 ──
import { state, W, RANGE_TOP, RANGE_BOTTOM } from './game.js';
import { worldToScreen } from './renderer.js';
import { playTargetHit, playSupplyDrop } from './audio.js';
import { spawnParticles } from './particles.js';

// 과녁 스폰 타이머
let spawnTimer = 0;
let supplyTimer = 0;

// 거리별 배율
const DIST_MULTIPLIER = [1, 2, 3]; // near, mid, far

/**
 * 과녁 생성
 */
function spawnTarget(type = 'normal') {
  const diff = state.difficulty;
  const z = type === 'supply' ? 0.1 : (0.2 + Math.random() * 0.7); // 깊이
  const x = (Math.random() - 0.5) * 1.5;
  const y = (Math.random() - 0.5) * 0.6;

  const baseSize = type === 'fast' ? 0.6 : type === 'bonus' ? 0.7 : 1;
  const sizeScale = 1 - diff * 0.4;

  const target = {
    type, // normal | fast | gold | bonus | supply
    x, y, z,
    size: baseSize * sizeScale,
    // 이동
    moveSpeed: type === 'fast' ? 0.8 : type === 'supply' ? 0 : diff * 0.5,
    moveDir: Math.random() > 0.5 ? 1 : -1,
    moveRange: 0.6 + Math.random() * 0.4,
    originX: x,
    // 보급품은 위에서 낙하
    fallSpeed: type === 'supply' ? 0.15 : 0,
    originY: type === 'supply' ? -0.8 : y,
    // 보너스는 시간 제한
    lifeTime: type === 'bonus' ? 2 + Math.random() * 2 : Infinity,
    alive: true,
    time: 0,
    hitPoints: [], // 명중 자국
  };

  if (type === 'supply') {
    target.y = -0.8;
    target.x = (Math.random() - 0.5) * 1.0;
    target.z = 0.3 + Math.random() * 0.3;
  }

  state.targets.push(target);
}

/**
 * 장애물 생성
 */
function spawnObstacle() {
  const z = 0.3 + Math.random() * 0.4;
  const x = (Math.random() - 0.5) * 1.2;
  state.obstacles.push({
    x, y: 0, z,
    w: 0.2 + Math.random() * 0.2,
    h: 0.3 + Math.random() * 0.3,
  });
}

/**
 * 과녁 업데이트
 */
export function updateTargets(dt) {
  const diff = state.difficulty;
  spawnTimer -= dt;
  supplyTimer -= dt;

  // 스폰 간격: 초반 넉넉 → 후반 빡빡
  const spawnInterval = Math.max(0.8, 3 - diff * 2);
  if (spawnTimer <= 0 && state.targets.length < 8) {
    spawnTimer = spawnInterval;

    // 과녁 종류 결정
    const r = Math.random();
    if (r < 0.05 + diff * 0.05) {
      spawnTarget('bonus');
    } else if (r < 0.15 - diff * 0.05) {
      spawnTarget('gold');
    } else if (diff > 0.3 && r < 0.3) {
      spawnTarget('fast');
    } else {
      spawnTarget('normal');
    }

    // 장애물 추가 (중반 이후)
    if (diff > 0.3 && state.obstacles.length < Math.floor(diff * 4) && Math.random() < 0.3) {
      spawnObstacle();
    }
  }

  // 보급품 스폰
  const supplyInterval = Math.max(8, 20 - diff * 10);
  if (supplyTimer <= 0) {
    supplyTimer = supplyInterval;
    spawnTarget('supply');
    playSupplyDrop();
  }

  // 과녁 업데이트
  for (let i = state.targets.length - 1; i >= 0; i--) {
    const t = state.targets[i];
    t.time += dt;

    // 좌우 이동
    if (t.moveSpeed > 0 && t.type !== 'supply') {
      t.x = t.originX + Math.sin(t.time * t.moveSpeed * Math.PI) * t.moveRange * t.moveDir;
    }

    // 보급품 낙하
    if (t.fallSpeed > 0) {
      t.y += t.fallSpeed * dt;
      t.x += Math.sin(t.time * 2) * 0.1 * dt; // 흔들림
      if (t.y > 0.8) t.alive = false; // 화면 밖으로 사라짐
    }

    // 수명
    if (t.time > t.lifeTime) t.alive = false;

    if (!t.alive) {
      state.targets.splice(i, 1);
    }
  }
}

/**
 * 발사체와 과녁 충돌 판정
 * @returns {Array} 명중 결과 [{target, hitDist, score}]
 */
export function checkHits(projectiles) {
  const results = [];

  for (let pi = projectiles.length - 1; pi >= 0; pi--) {
    const p = projectiles[pi];
    if (!p.alive) continue;

    // 장애물 체크 (관통탄 제외)
    if (!p.special) {
      for (const obs of state.obstacles) {
        const dz = Math.abs(p.z - obs.z);
        const dx = Math.abs(p.x - obs.x);
        const dy = Math.abs(p.y - obs.y);
        if (dz < 0.05 && dx < obs.w / 2 && dy < obs.h / 2) {
          p.alive = false;
          // 장애물 명중 이펙트
          const scr = worldToScreen(p.x, p.y, p.z, state.aimX, state.aimY);
          spawnParticles(scr.sx, scr.sy, 'woodChips', { count: 3 });
          break;
        }
      }
      if (!p.alive) continue;
    }

    // 과녁 체크
    for (let ti = state.targets.length - 1; ti >= 0; ti--) {
      const t = state.targets[ti];
      if (!t.alive) continue;

      const dz = Math.abs(p.z - t.z);
      if (dz > 0.08) continue; // Z 근접해야 판정

      const hitRadius = t.size * 0.15;
      const dx = p.x - t.x;
      const dy = p.y - t.y;
      const dist = Math.hypot(dx, dy);

      if (dist < hitRadius) {
        // 명중!
        const hitDist = dist / hitRadius; // 0=정중앙, 1=외곽
        const ringScore = Math.max(1, Math.ceil(10 * (1 - hitDist)));
        const distZone = t.z < 0.4 ? 0 : t.z < 0.7 ? 1 : 2;
        const distMul = DIST_MULTIPLIER[distZone];

        p.alive = false;
        t.alive = false;

        // 명중 자국
        const scr = worldToScreen(t.x, t.y, t.z, state.aimX, state.aimY);
        spawnParticles(scr.sx, scr.sy, 'woodChips');
        spawnParticles(scr.sx, scr.sy, 'hitMarker');

        // 폭발 화살
        if (p.type === 'arrow' && p.special) {
          spawnParticles(scr.sx, scr.sy, 'explosion');
          // 범위 피해 - 주변 과녁도 제거
          for (const other of state.targets) {
            if (other === t || !other.alive) continue;
            const odist = Math.hypot(other.x - t.x, other.y - t.y);
            if (odist < 0.3 && Math.abs(other.z - t.z) < 0.15) {
              other.alive = false;
              results.push({ target: other, hitDist: 0.5, score: 5 * distMul, type: t.type });
            }
          }
        }

        const score = ringScore * distMul;
        results.push({ target: t, hitDist, score, type: t.type });
        playTargetHit();

        break; // 하나의 발사체는 하나의 과녁만
      }
    }
  }

  return results;
}

/**
 * 과녁 렌더링
 */
export function drawTargets(ctx, aimX, aimY) {
  // 장애물 먼저
  for (const obs of state.obstacles) {
    const scr = worldToScreen(obs.x, obs.y, obs.z, aimX, aimY);
    const w = obs.w * 300 * scr.scale;
    const h = obs.h * 300 * scr.scale;

    ctx.fillStyle = '#4a3520';
    ctx.fillRect(scr.sx - w / 2, scr.sy - h, w, h);
    ctx.strokeStyle = '#5a4530';
    ctx.lineWidth = 2 * scr.scale;
    ctx.strokeRect(scr.sx - w / 2, scr.sy - h, w, h);

    // 나무 무늬
    ctx.strokeStyle = 'rgba(90,70,50,0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const ly = scr.sy - h + (h / 4) * (i + 1);
      ctx.moveTo(scr.sx - w / 2 + 2, ly);
      ctx.lineTo(scr.sx + w / 2 - 2, ly);
      ctx.stroke();
    }
  }

  // 과녁 (깊이순 정렬: 먼 것 먼저)
  const sorted = [...state.targets].sort((a, b) => b.z - a.z);

  for (const t of sorted) {
    const scr = worldToScreen(t.x, t.y, t.z, aimX, aimY);
    const baseR = t.size * 40 * scr.scale;

    if (t.type === 'supply') {
      drawSupply(ctx, scr.sx, scr.sy, baseR, t);
    } else {
      drawTargetCircle(ctx, scr.sx, scr.sy, baseR, t);
    }
  }
}

function drawTargetCircle(ctx, x, y, r, target) {
  const colors = {
    normal: ['#f5e6c8', '#d4341b', '#f5e6c8', '#d4341b', '#d4341b'],
    fast: ['#ddd', '#666', '#ddd', '#666', '#333'],
    gold: ['#ffe44d', '#ffcc00', '#ff9900', '#ff6600', '#ff3300'],
    bonus: ['#ff6666', '#ff0000', '#cc0000', '#990000', '#660000'],
  };

  const rings = colors[target.type] || colors.normal;
  const ringCount = 5;

  // 보너스: 깜빡임
  if (target.type === 'bonus') {
    const blink = Math.sin(target.time * 8) > 0;
    if (!blink) {
      ctx.globalAlpha = 0.5;
    }
  }

  // 과녁 받침대
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(x - 3, y, 6, r * 1.5);

  // 과녁 링
  for (let i = 0; i < ringCount; i++) {
    const ringR = r * (1 - i / ringCount);
    ctx.fillStyle = rings[i];
    ctx.beginPath();
    ctx.arc(x, y, ringR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 금색 반짝임
  if (target.type === 'gold') {
    const sparkle = Math.sin(target.time * 5) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255,255,200,${sparkle * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function drawSupply(ctx, x, y, r, target) {
  const boxSize = r * 1.2;

  // 낙하산
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.moveTo(x - boxSize, y - boxSize * 1.5);
  ctx.quadraticCurveTo(x, y - boxSize * 2.5, x + boxSize, y - boxSize * 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,200,200,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 줄
  ctx.strokeStyle = 'rgba(180,180,180,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - boxSize, y - boxSize * 1.5);
  ctx.lineTo(x - boxSize * 0.3, y - boxSize * 0.3);
  ctx.moveTo(x + boxSize, y - boxSize * 1.5);
  ctx.lineTo(x + boxSize * 0.3, y - boxSize * 0.3);
  ctx.stroke();

  // 상자
  ctx.fillStyle = '#6a5a3a';
  ctx.fillRect(x - boxSize * 0.4, y - boxSize * 0.4, boxSize * 0.8, boxSize * 0.8);
  ctx.strokeStyle = '#8a7a5a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - boxSize * 0.4, y - boxSize * 0.4, boxSize * 0.8, boxSize * 0.8);

  // + 마크
  ctx.strokeStyle = '#cc0000';
  ctx.lineWidth = 3;
  const s = boxSize * 0.2;
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x + s, y);
  ctx.moveTo(x, y - s);
  ctx.lineTo(x, y + s);
  ctx.stroke();

  // 흔들림 효과
  const sway = Math.sin(target.time * 3) * 3;
  ctx.translate(sway, 0);
  ctx.translate(-sway, 0);
}
