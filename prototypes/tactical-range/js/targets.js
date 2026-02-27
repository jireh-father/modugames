// ── 과녁 시스템 (웨이브 기반) ──
import { state, W, RANGE_TOP, RANGE_BOTTOM } from './game.js?v=5';
import { worldToScreen } from './renderer.js?v=5';
import { playTargetHit, playSupplyDrop } from './audio.js?v=5';
import { spawnParticles } from './particles.js?v=5';

// 거리별 배율
const DIST_MULTIPLIER = [1, 2, 3]; // near, mid, far

let supplyTimer = 0;

/**
 * 웨이브 난이도 패턴 (무한 스케일링)
 *
 * 5웨이브 단위 사이클:
 *   x1: 워밍업 - normal만, 적은 수
 *   x2: 스피드 - fast 등장
 *   x3: 보너스 - gold + bonus 등장
 *   x4: 장애물 - 장애물 추가
 *   x5: 보스웨이브 - 전부 많이 + 작은 과녁
 *
 * 사이클 반복하며 기본 수치가 올라감
 */
function getWaveConfig(wave) {
  const w = wave;
  const cycle = Math.floor((w - 1) / 5);  // 0, 1, 2, ... (사이클 번호)
  const phase = ((w - 1) % 5) + 1;        // 1~5 (사이클 내 페이즈)

  // 기본 수치: 사이클마다 증가
  const baseCount = 2 + cycle;             // 2, 3, 4, 5...
  const baseSpeed = 0.15 + cycle * 0.12;   // 0.15, 0.27, 0.39...
  const baseSizeScale = Math.max(0.4, 1 - cycle * 0.08); // 1.0, 0.92, 0.84...

  let normals = 0, fasts = 0, golds = 0, bonuses = 0, obstacles = 0;
  let sizeScale = baseSizeScale;
  let moveSpeed = baseSpeed;

  switch (phase) {
    case 1: // 워밍업
      normals = baseCount;
      moveSpeed *= 0.5;
      break;
    case 2: // 스피드
      normals = Math.max(1, baseCount - 1);
      fasts = 1 + Math.floor(cycle / 2);
      moveSpeed *= 1.3;
      break;
    case 3: // 보너스
      normals = baseCount;
      golds = 1;
      bonuses = cycle >= 1 ? 1 : 0;
      break;
    case 4: // 장애물
      normals = baseCount;
      fasts = Math.min(1 + cycle, 3);
      obstacles = 1 + Math.min(cycle, 3);
      break;
    case 5: // 보스웨이브
      normals = baseCount + 1;
      fasts = 1 + Math.floor(cycle / 2);
      golds = 1;
      bonuses = 1;
      obstacles = Math.min(cycle, 3);
      sizeScale *= 0.85;
      moveSpeed *= 1.2;
      break;
  }

  // 총 과녁 캡: 최대 10개
  const total = normals + fasts + golds + bonuses;
  if (total > 10) {
    normals = Math.max(1, normals - (total - 10));
  }

  // 속도/크기 캡
  moveSpeed = Math.min(moveSpeed, 1.5);
  sizeScale = Math.max(sizeScale, 0.35);

  return { normals, fasts, golds, bonuses, obstacles, sizeScale, moveSpeed };
}

/**
 * 웨이브 시작: 과녁 일괄 배치
 */
function startWave() {
  state.wave++;
  state.waveCleared = false;

  const config = getWaveConfig(state.wave);
  const totalTargets = config.normals + config.fasts + config.golds + config.bonuses;
  state.waveTargetsLeft = totalTargets;

  // 장애물 초기화 후 재배치
  state.obstacles = [];
  for (let i = 0; i < config.obstacles; i++) {
    spawnObstacle();
  }

  // 과녁 배치 (겹치지 않게 분산)
  const positions = generatePositions(totalTargets);
  let idx = 0;

  for (let i = 0; i < config.normals; i++) {
    spawnTarget('normal', positions[idx++], config);
  }
  for (let i = 0; i < config.fasts; i++) {
    spawnTarget('fast', positions[idx++], config);
  }
  for (let i = 0; i < config.golds; i++) {
    spawnTarget('gold', positions[idx++], config);
  }
  for (let i = 0; i < config.bonuses; i++) {
    spawnTarget('bonus', positions[idx++], config);
  }
}

/**
 * 겹치지 않는 위치 생성
 */
function generatePositions(count) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    let x, y, z, ok;
    let tries = 0;
    do {
      z = 0.2 + Math.random() * 0.7;
      x = (Math.random() - 0.5) * 1.4;
      y = (Math.random() - 0.5) * 0.5;
      ok = true;
      for (const p of positions) {
        if (Math.abs(p.z - z) < 0.15 && Math.hypot(p.x - x, p.y - y) < 0.25) {
          ok = false;
          break;
        }
      }
      tries++;
    } while (!ok && tries < 30);
    positions.push({ x, y, z });
  }
  return positions;
}

/**
 * 과녁 생성
 */
function spawnTarget(type, pos, config) {
  const baseSize = type === 'fast' ? 0.6 : type === 'bonus' ? 0.7 : 1;

  const target = {
    type,
    x: pos.x, y: pos.y, z: pos.z,
    size: baseSize * config.sizeScale,
    moveSpeed: type === 'fast' ? config.moveSpeed * 1.5 : type === 'bonus' ? 0 : config.moveSpeed,
    moveDir: Math.random() > 0.5 ? 1 : -1,
    moveRange: 0.3 + Math.random() * 0.3,
    originX: pos.x,
    fallSpeed: 0,
    originY: pos.y,
    lifeTime: type === 'bonus' ? 3 + state.wave * 0.5 : Infinity,
    alive: true,
    time: 0,
    hitPoints: [],
  };

  state.targets.push(target);
}

/**
 * 보급품 과녁 생성
 */
function spawnSupply() {
  const target = {
    type: 'supply',
    x: (Math.random() - 0.5) * 1.0,
    y: -0.8,
    z: 0.3 + Math.random() * 0.3,
    size: 1,
    moveSpeed: 0,
    moveDir: 1,
    moveRange: 0,
    originX: 0,
    fallSpeed: 0.15,
    originY: -0.8,
    lifeTime: Infinity,
    alive: true,
    time: 0,
    hitPoints: [],
  };
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
  // 웨이브 시작 (게임 시작 or 웨이브 클리어 후)
  if (state.wave === 0) {
    state.wavePause = 0.5;
  }

  // 웨이브 간 대기
  if (state.waveCleared || state.wave === 0) {
    state.wavePause -= dt;
    if (state.wavePause <= 0) {
      startWave();
    }
    // 대기 중에도 보급품/기존 과녁 업데이트
  }

  // 보급품 스폰 (3웨이브마다)
  if (state.wave > 0) {
    supplyTimer -= dt;
    const supplyInterval = Math.max(8, 18 - state.wave * 1.5);
    if (supplyTimer <= 0) {
      supplyTimer = supplyInterval;
      spawnSupply();
      playSupplyDrop();
    }
  }

  // 웨이브 클리어 체크: 보급품 제외 과녁이 다 사라졌는지
  if (state.wave > 0 && !state.waveCleared) {
    const remaining = state.targets.filter(t => t.alive && t.type !== 'supply').length;
    if (remaining === 0 && state.waveTargetsLeft <= 0) {
      state.waveCleared = true;
      state.wavePause = 1.5; // 다음 웨이브 전 대기
    }
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
      t.x += Math.sin(t.time * 2) * 0.1 * dt;
      if (t.y > 0.8) t.alive = false;
    }

    // 수명
    if (t.time > t.lifeTime) {
      t.alive = false;
      // 보너스 타임아웃은 빗나감으로 안 침 (웨이브 카운트에서는 빼야 함)
      if (t.type === 'bonus') {
        state.waveTargetsLeft = Math.max(0, state.waveTargetsLeft - 1);
      }
    }

    if (!t.alive) {
      state.targets.splice(i, 1);
    }
  }
}

/**
 * 발사체와 과녁 충돌 판정
 */
export function checkHits(projectiles) {
  const results = [];

  for (let pi = projectiles.length - 1; pi >= 0; pi--) {
    const p = projectiles[pi];
    if (!p.alive) continue;

    // 장애물 체크 (관통탄/화살 제외)
    if (!p.special && p.type !== 'arrow') {
      for (const obs of state.obstacles) {
        const dz = Math.abs(p.z - obs.z);
        const dx = Math.abs(p.x - obs.x);
        const dy = Math.abs(p.y - obs.y);
        if (dz < 0.05 && dx < obs.w / 2 && dy < obs.h / 2) {
          p.alive = false;
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
      if (dz > 0.08) continue;

      const hitRadius = t.size * 0.15;
      const dx = p.x - t.x;
      const dy = p.y - t.y;
      const dist = Math.hypot(dx, dy);

      if (dist < hitRadius) {
        const hitDist = dist / hitRadius;
        const ringScore = Math.max(1, Math.ceil(10 * (1 - hitDist)));
        const distZone = t.z < 0.4 ? 0 : t.z < 0.7 ? 1 : 2;
        const distMul = DIST_MULTIPLIER[distZone];

        if (p.type !== 'arrow') p.alive = false;
        t.alive = false;

        // 웨이브 카운트 감소 (보급품 제외)
        if (t.type !== 'supply') {
          state.waveTargetsLeft = Math.max(0, state.waveTargetsLeft - 1);
        }

        const scr = worldToScreen(t.x, t.y, t.z, state.aimX, state.aimY);
        spawnParticles(scr.sx, scr.sy, 'woodChips');
        spawnParticles(scr.sx, scr.sy, 'hitMarker');

        // 폭발 화살
        if (p.type === 'arrow' && p.special) {
          spawnParticles(scr.sx, scr.sy, 'explosion');
          for (const other of state.targets) {
            if (other === t || !other.alive) continue;
            const odist = Math.hypot(other.x - t.x, other.y - t.y);
            if (odist < 0.3 && Math.abs(other.z - t.z) < 0.15) {
              other.alive = false;
              if (other.type !== 'supply') {
                state.waveTargetsLeft = Math.max(0, state.waveTargetsLeft - 1);
              }
              results.push({ target: other, hitDist: 0.5, score: 5 * distMul, type: t.type });
            }
          }
        }

        const score = ringScore * distMul;
        results.push({ target: t, hitDist, score, type: t.type });
        playTargetHit();

        if (p.type !== 'arrow') break;
      }
    }
  }

  return results;
}

/**
 * 과녁 렌더링
 */
export function drawTargets(ctx, aimX, aimY) {
  // 장애물
  for (const obs of state.obstacles) {
    const scr = worldToScreen(obs.x, obs.y, obs.z, aimX, aimY);
    const w = obs.w * 300 * scr.scale;
    const h = obs.h * 300 * scr.scale;

    let hasTargetBehind = false;
    for (const t of state.targets) {
      if (t.z > obs.z && Math.abs(t.x - obs.x) < obs.w && Math.abs(t.y - obs.y) < obs.h * 1.5) {
        hasTargetBehind = true;
        break;
      }
    }

    ctx.globalAlpha = hasTargetBehind ? 0.35 : 1;

    ctx.fillStyle = '#4a3520';
    ctx.fillRect(scr.sx - w / 2, scr.sy - h, w, h);
    ctx.strokeStyle = '#5a4530';
    ctx.lineWidth = 2 * scr.scale;
    ctx.strokeRect(scr.sx - w / 2, scr.sy - h, w, h);

    ctx.strokeStyle = 'rgba(90,70,50,0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const ly = scr.sy - h + (h / 4) * (i + 1);
      ctx.moveTo(scr.sx - w / 2 + 2, ly);
      ctx.lineTo(scr.sx + w / 2 - 2, ly);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  // 과녁 (깊이순)
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

/**
 * 웨이브 배너 그리기 (HUD에서 호출)
 */
export function drawWaveBanner(ctx, w, h) {
  if (state.wave <= 0) return;

  // 웨이브 클리어 배너
  if (state.waveCleared) {
    ctx.fillStyle = 'rgba(255,200,100,0.9)';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WAVE CLEAR!', w / 2, h * 0.35);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '14px monospace';
    ctx.fillText(`NEXT WAVE...`, w / 2, h * 0.35 + 30);
    return;
  }

  // 웨이브 시작 직후 배너 (1.5초간)
  const firstTarget = state.targets.find(t => t.type !== 'supply');
  if (firstTarget && firstTarget.time < 1.5) {
    const alpha = Math.max(0, 1 - firstTarget.time / 1.5);
    ctx.fillStyle = `rgba(255,200,100,${alpha})`;
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${state.wave}`, w / 2, h * 0.35);
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

  if (target.type === 'bonus') {
    const blink = Math.sin(target.time * 8) > 0;
    if (!blink) ctx.globalAlpha = 0.5;
  }

  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(x - 3, y, 6, r * 1.5);

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

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.moveTo(x - boxSize, y - boxSize * 1.5);
  ctx.quadraticCurveTo(x, y - boxSize * 2.5, x + boxSize, y - boxSize * 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,200,200,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(180,180,180,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - boxSize, y - boxSize * 1.5);
  ctx.lineTo(x - boxSize * 0.3, y - boxSize * 0.3);
  ctx.moveTo(x + boxSize, y - boxSize * 1.5);
  ctx.lineTo(x + boxSize * 0.3, y - boxSize * 0.3);
  ctx.stroke();

  ctx.fillStyle = '#6a5a3a';
  ctx.fillRect(x - boxSize * 0.4, y - boxSize * 0.4, boxSize * 0.8, boxSize * 0.8);
  ctx.strokeStyle = '#8a7a5a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - boxSize * 0.4, y - boxSize * 0.4, boxSize * 0.8, boxSize * 0.8);

  ctx.strokeStyle = '#cc0000';
  ctx.lineWidth = 3;
  const s = boxSize * 0.2;
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x + s, y);
  ctx.moveTo(x, y - s);
  ctx.lineTo(x, y + s);
  ctx.stroke();
}
