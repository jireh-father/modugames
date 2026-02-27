// ── 과녁 시스템 (웨이브 기반 - 순차 스폰) ──
import { state, W, RANGE_TOP, RANGE_BOTTOM } from './game.js?v=12';
import { worldToScreen } from './renderer.js?v=12';
import { playTargetHit, playSupplyDrop, playWallHit, playWallBreak, playWaveStart, playWaveClear, playExplosion, playBulletMiss } from './audio.js?v=12';
import { spawnParticles } from './particles.js?v=12';

// 거리별 배율
const DIST_MULTIPLIER = [1, 2, 3]; // near, mid, far

/**
 * 웨이브 난이도 패턴 (무한 스케일링)
 *
 * 5웨이브 사이클: 워밍업→스피드→보너스→장애물→보스
 * 사이클 반복하며 기본 수치 상승
 */
function getWaveConfig(wave) {
  const cycle = Math.floor((wave - 1) / 5);
  const phase = ((wave - 1) % 5) + 1;

  const baseCount = 2 + cycle;
  const baseSpeed = 0.15 + cycle * 0.12;
  const baseSizeScale = Math.max(0.4, 1 - cycle * 0.08);

  let normals = 0, fasts = 0, golds = 0, bonuses = 0, supplies = 0, obstacles = 0;
  let walledTargets = 0; // 벽 뒤 과녁 (활로만 공격 가능)
  let sizeScale = baseSizeScale;
  let moveSpeed = baseSpeed;

  switch (phase) {
    case 1: // 워밍업
      normals = baseCount;
      supplies = 1;
      moveSpeed *= 0.5;
      break;
    case 2: // 스피드
      normals = Math.max(1, baseCount - 1);
      fasts = 1 + Math.floor(cycle / 2);
      supplies = 1;
      moveSpeed *= 1.3;
      break;
    case 3: // 보너스
      normals = baseCount;
      golds = 1;
      bonuses = cycle >= 1 ? 1 : 0;
      supplies = 1 + Math.floor(cycle / 2);
      break;
    case 4: // 장애물 + 벽뒤 과녁
      normals = baseCount;
      fasts = Math.min(1 + cycle, 3);
      supplies = 1;
      obstacles = 1 + Math.min(cycle, 3);
      walledTargets = 1 + Math.min(cycle, 2); // 벽 뒤 과녁
      break;
    case 5: // 보스웨이브
      normals = baseCount + 1;
      fasts = 1 + Math.floor(cycle / 2);
      golds = 1;
      bonuses = 1;
      supplies = 2;
      obstacles = Math.min(cycle, 3);
      walledTargets = Math.min(1 + cycle, 3); // 보스웨이브에도 벽뒤 과녁
      sizeScale *= 0.85;
      moveSpeed *= 1.2;
      break;
  }

  // 과녁 캡
  const total = normals + fasts + golds + bonuses + walledTargets;
  if (total > 10) normals = Math.max(1, normals - (total - 10));
  moveSpeed = Math.min(moveSpeed, 1.5);
  sizeScale = Math.max(sizeScale, 0.35);

  // 제한시간: 과녁 수 * 기본 시간 (사이클 올라가면 줄어듦)
  const totalTargets = normals + fasts + golds + bonuses + walledTargets;
  const timePerTarget = Math.max(3, 6 - cycle * 0.5);
  const timeLimit = totalTargets * timePerTarget;

  return { normals, fasts, golds, bonuses, supplies, obstacles, walledTargets, sizeScale, moveSpeed, timeLimit };
}

/**
 * 웨이브 시작: 스폰 대기열 생성 (순차적으로 등장)
 */
function startWave() {
  state.wave++;
  state.waveCleared = false;
  state.waveTimer = 0;
  playWaveStart();

  const config = getWaveConfig(state.wave);
  const totalTargets = config.normals + config.fasts + config.golds + config.bonuses + config.walledTargets;
  state.waveTargetsLeft = totalTargets;
  state.waveTimeLimit = config.timeLimit;

  // 장애물 배치
  state.obstacles = [];
  for (let i = 0; i < config.obstacles; i++) {
    spawnObstacle();
  }

  // 벽뒤 과녁 스폰 (전용 벽 + 그 뒤의 과녁)
  for (let i = 0; i < config.walledTargets; i++) {
    spawnWalledTarget(config);
  }

  // 기본 과녁은 즉시 스폰
  for (let i = 0; i < config.normals; i++) {
    const pos = generateOnePosition();
    spawnTarget('normal', pos, config);
  }

  // 특수 과녁 + 보급품은 랜덤 딜레이로 대기열
  const specials = [];
  for (let i = 0; i < config.fasts; i++) specials.push('fast');
  for (let i = 0; i < config.golds; i++) specials.push('gold');
  for (let i = 0; i < config.bonuses; i++) specials.push('bonus');
  for (let i = 0; i < config.supplies; i++) specials.push('supply');

  // 셔플
  for (let i = specials.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [specials[i], specials[j]] = [specials[j], specials[i]];
  }

  const queue = [];
  let delay = 1.5 + Math.random() * 2; // 첫 특수는 1.5~3.5초 후
  for (const type of specials) {
    const pos = generateOnePosition();
    queue.push({ type, pos, delay, config });
    delay += 1.0 + Math.random() * 2.5;
  }

  state.waveSpawnQueue = queue;
}

/**
 * 웨이브에 따른 최대 거리 계산
 * wave 1: 0.4, wave 5: 0.54, wave 10: 0.71, wave 16+: 0.9 (캡)
 */
function getMaxZ() {
  return Math.min(0.9, 0.35 + state.wave * 0.035);
}

/**
 * 단일 위치 생성 (기존 과녁과 겹치지 않게, 웨이브에 따라 거리 스케일링)
 */
function generateOnePosition() {
  const maxZ = getMaxZ();
  let x, y, z;
  let tries = 0;
  do {
    z = 0.2 + Math.random() * (maxZ - 0.2);
    x = (Math.random() - 0.5) * 1.4;
    y = (Math.random() - 0.5) * 0.5;
    let ok = true;
    for (const t of state.targets) {
      if (t.type === 'supply') continue;
      if (Math.abs(t.z - z) < 0.15 && Math.hypot(t.x - x, t.y - y) < 0.25) {
        ok = false;
        break;
      }
    }
    if (ok) break;
    tries++;
  } while (tries < 20);
  return { x, y, z };
}

/**
 * 과녁 생성
 */
function spawnTarget(type, pos, config) {
  if (type === 'supply') {
    spawnSupply();
    return;
  }

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

function spawnSupply() {
  playSupplyDrop();
  state.targets.push({
    type: 'supply',
    x: (Math.random() - 0.5) * 1.0,
    y: -0.8,
    z: 0.2 + Math.random() * Math.max(0.1, getMaxZ() - 0.3),
    size: 1,
    moveSpeed: 0, moveDir: 1, moveRange: 0, originX: 0,
    fallSpeed: 0.15, originY: -0.8,
    lifeTime: Infinity, alive: true, time: 0, hitPoints: [],
  });
}

function spawnObstacle() {
  const maxZ = getMaxZ();
  const z = 0.3 + Math.random() * Math.max(0.1, maxZ - 0.4);
  const x = (Math.random() - 0.5) * 1.2;
  state.obstacles.push({
    x, y: 0, z,
    w: 0.2 + Math.random() * 0.2,
    h: 0.3 + Math.random() * 0.3,
    hits: 0,        // 총알 피격 횟수
    maxHits: 5,     // 이 횟수 맞으면 관통
    broken: false,  // 관통 여부
    isWall: false,  // 벽뒤 과녁용 전용 벽 여부
  });
}

/**
 * 벽뒤 과녁 스폰: 전용 벽 + 그 뒤에 과녁 배치
 * 화살은 포물선으로 벽을 넘어서 맞출 수 있음
 */
function spawnWalledTarget(config) {
  // 벽 위치: 웨이브에 따른 거리 스케일링
  const maxZ = getMaxZ();
  const wallZ = 0.3 + Math.random() * Math.max(0.1, maxZ - 0.4);
  const wallX = (Math.random() - 0.5) * 1.0;

  // 벽 생성 (넓고 높은 전용 벽)
  const wall = {
    x: wallX, y: 0, z: wallZ,
    w: 0.25 + Math.random() * 0.1,
    h: 0.35 + Math.random() * 0.1,
    hits: 0,
    maxHits: 5,
    broken: false,
    isWall: true, // 벽뒤 과녁용 전용 벽
  };
  state.obstacles.push(wall);

  // 과녁은 벽 바로 뒤에 배치 (z가 더 큼 = 더 먼 곳)
  const targetZ = wallZ + 0.08 + Math.random() * 0.05;
  // X는 벽 범위 안에 (벽에 가려지도록)
  const targetX = wallX + (Math.random() - 0.5) * wall.w * 0.5;
  // Y는 벽보다 약간 위 (화살이 넘어서 맞출 수 있는 높이)
  const targetY = -0.1 - Math.random() * 0.15;

  const baseSize = config.sizeScale;
  const target = {
    type: 'walled', // 벽뒤 과녁 타입
    x: targetX, y: targetY, z: targetZ,
    size: baseSize * 0.9,
    moveSpeed: 0, // 벽뒤라 고정
    moveDir: 1,
    moveRange: 0,
    originX: targetX,
    fallSpeed: 0,
    originY: targetY,
    lifeTime: Infinity,
    alive: true,
    time: 0,
    hitPoints: [],
    wallRef: wall, // 연결된 벽 참조
  };
  state.targets.push(target);
}

/**
 * 과녁 업데이트
 */
export function updateTargets(dt) {
  // 첫 웨이브 즉시 시작
  if (state.wave === 0) {
    startWave();
    return;
  }

  // 웨이브 클리어 후 대기 → 다음 웨이브
  if (state.waveCleared) {
    state.wavePause -= dt;
    if (state.wavePause <= 0) {
      startWave();
    }
    // 클리어 중에도 기존 과녁(보급품 등) 업데이트
  }

  // 웨이브 타이머
  if (!state.waveCleared && state.wave > 0) {
    state.waveTimer += dt;
  }

  // 순차 스폰: 딜레이 도달한 과녁 생성
  const queue = state.waveSpawnQueue;
  while (queue.length > 0 && state.waveTimer >= queue[0].delay) {
    const item = queue.shift();
    spawnTarget(item.type, item.pos, item.config);
  }

  // 웨이브 클리어 체크: 대기열 비고 + 보급품 제외 과녁 다 사라짐
  if (state.wave > 0 && !state.waveCleared) {
    const nonSupplyInQueue = queue.filter(q => q.type !== 'supply').length;
    const remaining = state.targets.filter(t => t.alive && t.type !== 'supply').length;
    if (remaining === 0 && nonSupplyInQueue === 0) {
      state.waveCleared = true;
      state.wavePause = 1.5;
      playWaveClear();
    }
  }

  // 과녁 업데이트
  for (let i = state.targets.length - 1; i >= 0; i--) {
    const t = state.targets[i];
    t.time += dt;

    if (t.moveSpeed > 0 && t.type !== 'supply') {
      t.x = t.originX + Math.sin(t.time * t.moveSpeed * Math.PI) * t.moveRange * t.moveDir;
    }

    if (t.fallSpeed > 0) {
      t.y += t.fallSpeed * dt;
      t.x += Math.sin(t.time * 2) * 0.1 * dt;
      if (t.y > 0.8) t.alive = false;
    }

    if (t.time > t.lifeTime) {
      t.alive = false;
      if (t.type !== 'supply') {
        state.waveTargetsLeft = Math.max(0, state.waveTargetsLeft - 1);
      }
    }

    if (!t.alive) {
      state.targets.splice(i, 1);
    }
  }
}

/**
 * 웨이브 클리어 시 타임 보너스 계산
 */
export function getWaveClearBonus() {
  const timeLeft = Math.max(0, state.waveTimeLimit - state.waveTimer);
  const ratio = timeLeft / state.waveTimeLimit;
  // 남은 시간 비율 × 웨이브 번호 × 10
  return Math.floor(ratio * state.wave * 1000);
}

/**
 * 발사체와 과녁 충돌 판정
 */
export function checkHits(projectiles) {
  const results = [];

  for (let pi = projectiles.length - 1; pi >= 0; pi--) {
    const p = projectiles[pi];
    if (!p.alive) continue;

    // 화살 관통 멀티킬 카운터
    let arrowHitCount = 0;

    // 장애물 체크
    // 화살/볼트는 포물선으로 넘어가므로 장애물 무시
    // 관통탄/저격탄도 장애물 무시 (관통)
    const arcType = p.type === 'arrow' || p.type === 'bolt';
    const pierceType = p.special || p.type === 'sniper';
    if (!pierceType && !arcType) {
      for (const obs of state.obstacles) {
        if (obs.broken) continue; // 관통된 벽은 무시
        const dz = Math.abs(p.z - obs.z);
        const dx = Math.abs(p.x - obs.x);
        const dy = Math.abs(p.y - obs.y);
        if (dz < 0.05 && dx < obs.w / 2 && dy < obs.h / 2) {
          // 벽 피격 카운트
          obs.hits++;
          if (obs.hits >= obs.maxHits) {
            obs.broken = true;
            const scr = worldToScreen(obs.x, obs.y - obs.h * 0.3, obs.z, state.aimX, state.aimY);
            spawnParticles(scr.sx, scr.sy, 'explosion');
            playWallBreak();
          } else {
            playWallHit();
          }
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

      // 먼 거리 타겟 히트박스 보정: z가 클수록 약간 넓어짐
      const distBonus = 1 + t.z * 0.4; // z=0: 1.0x, z=0.5: 1.2x, z=1: 1.4x
      const hitRadius = t.size * 0.15 * distBonus;
      const dx = p.x - t.x;
      const dy = p.y - t.y;
      const dist = Math.hypot(dx, dy);

      if (dist < hitRadius) {
        const hitDist = dist / hitRadius;
        const ringScore = Math.max(1, Math.ceil(10 * (1 - hitDist)));
        const distZone = t.z < 0.4 ? 0 : t.z < 0.7 ? 1 : 2;
        const distMul = DIST_MULTIPLIER[distZone];

        // 관통: 화살/저격탄/볼트는 과녁을 뚫고 지나감
        const penetrates = p.type === 'arrow' || p.type === 'sniper' || p.type === 'bolt';
        if (!penetrates) p.alive = false;
        t.alive = false;

        if (t.type !== 'supply') {
          state.waveTargetsLeft = Math.max(0, state.waveTargetsLeft - 1);
        }

        const scr = worldToScreen(t.x, t.y, t.z, state.aimX, state.aimY);
        spawnParticles(scr.sx, scr.sy, 'woodChips');
        spawnParticles(scr.sx, scr.sy, 'hitMarker');

        // 폭발 화살
        if (p.type === 'arrow' && p.special) {
          spawnParticles(scr.sx, scr.sy, 'explosion');
          playExplosion();
          for (const other of state.targets) {
            if (other === t || !other.alive) continue;
            const odist = Math.hypot(other.x - t.x, other.y - t.y);
            if (odist < 0.3 && Math.abs(other.z - t.z) < 0.15) {
              other.alive = false;
              if (other.type !== 'supply') {
                state.waveTargetsLeft = Math.max(0, state.waveTargetsLeft - 1);
              }
              arrowHitCount++;
              results.push({ target: other, hitDist: 0.5, score: 500 * distMul, type: t.type, arrowMulti: arrowHitCount });
            }
          }
        }

        // 관통 멀티킬 배수 (화살/저격탄/볼트)
        if (penetrates) arrowHitCount++;
        const arrowMul = penetrates ? arrowHitCount : 1;

        // 저격탄 기본 배수 보너스
        const sniperBonus = p.type === 'sniper' ? 1.5 : 1;
        const score = Math.floor(ringScore * distMul * arrowMul * sniperBonus * 100);
        results.push({ target: t, hitDist, score, type: t.type, arrowMulti: arrowMul });
        playTargetHit();

        if (!penetrates) break;
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
    if (obs.broken) continue; // 관통된 벽은 렌더링 안함

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

    // 벽뒤 과녁용 전용 벽은 다른 색
    if (obs.isWall) {
      // 피격 정도에 따라 균열 표현
      const dmgRatio = obs.hits / obs.maxHits;
      ctx.fillStyle = dmgRatio > 0.6 ? '#5a3828' : dmgRatio > 0.3 ? '#4d3222' : '#3a2818';
      ctx.fillRect(scr.sx - w / 2, scr.sy - h, w, h);

      // 벽 테두리 (빨간 표시 = 활로만 공격 가능)
      ctx.strokeStyle = dmgRatio > 0.6 ? '#ff6644' : '#884422';
      ctx.lineWidth = 2 * scr.scale;
      ctx.strokeRect(scr.sx - w / 2, scr.sy - h, w, h);

      // 균열 효과
      if (obs.hits > 0) {
        ctx.strokeStyle = `rgba(255,150,50,${0.3 + dmgRatio * 0.5})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < obs.hits; i++) {
          const cx = scr.sx - w * 0.3 + (i * w * 0.6 / obs.maxHits);
          const cy = scr.sy - h * 0.3;
          ctx.beginPath();
          ctx.moveTo(cx, cy - h * 0.2);
          ctx.lineTo(cx + w * 0.05, cy);
          ctx.lineTo(cx - w * 0.03, cy + h * 0.2);
          ctx.stroke();
        }
      }

      // 피격 카운트 표시
      ctx.fillStyle = '#ff8844';
      ctx.font = `bold ${Math.max(10, 14 * scr.scale)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`${obs.hits}/${obs.maxHits}`, scr.sx, scr.sy - h - 4 * scr.scale);
    } else {
      ctx.fillStyle = '#4a3520';
      ctx.fillRect(scr.sx - w / 2, scr.sy - h, w, h);
      ctx.strokeStyle = '#5a4530';
      ctx.lineWidth = 2 * scr.scale;
      ctx.strokeRect(scr.sx - w / 2, scr.sy - h, w, h);
    }

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
 * 웨이브 배너 그리기
 */
export function drawWaveBanner(ctx, w, h) {
  if (state.wave <= 0) return;

  // 웨이브 클리어 배너 + 타임보너스
  if (state.waveCleared) {
    ctx.fillStyle = 'rgba(255,200,100,0.9)';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WAVE CLEAR!', w / 2, h * 0.32);

    const bonus = getWaveClearBonus();
    if (bonus > 0) {
      ctx.fillStyle = '#44ff44';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(`TIME BONUS +${bonus}`, w / 2, h * 0.32 + 32);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '14px monospace';
    ctx.fillText('NEXT WAVE...', w / 2, h * 0.32 + 58);
    return;
  }

  // 웨이브 시작 직후 배너
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
    walled: ['#88ccff', '#4488cc', '#88ccff', '#4488cc', '#2266aa'], // 파란색 = 벽뒤 과녁
  };

  const rings = colors[target.type] || colors.normal;
  if (target.type === 'bonus') {
    if (Math.sin(target.time * 8) <= 0) ctx.globalAlpha = 0.5;
  }

  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(x - 3, y, 6, r * 1.5);

  for (let i = 0; i < 5; i++) {
    const ringR = r * (1 - i / 5);
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

  // 벽뒤 과녁 활 아이콘 표시
  if (target.type === 'walled') {
    ctx.fillStyle = 'rgba(100,180,255,0.8)';
    ctx.font = `bold ${Math.max(8, r * 0.6)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('🏹', x, y - r - 4);
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
