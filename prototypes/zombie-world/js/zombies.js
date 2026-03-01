// ── 좀비 시스템 (소리-유인 AI, 웨이브, 충돌) ──
import { W, state, WALL_Y, TOWER_Y, WEAPON_PROFILES, emitSound } from './game.js?v=17';
import { getWallY, getWallSegments } from './wall.js?v=17';
import { playZombieHit, playZombieDeath, playWallHit, playWallBreak, playTowerHit,
         playSplitterSplit, playRammerCharge, playChainLightning,
         playFreezeApply, playPoisonApply } from './audio.js?v=17';

const WALL_SEGMENTS = getWallSegments();

// ── 좀비 타입 설정 ──
const ZOMBIE_TYPES = {
  walker:      { color: '#66cc44', size: 14, hp: 2,  speed: 10,  wallDmg: 2,  score: 20  },
  runner:      { color: '#ee3333', size: 10, hp: 1,  speed: 23,  wallDmg: 1,  score: 15  },
  tank:        { color: '#9944cc', size: 20, hp: 8,  speed: 5,   wallDmg: 5,  score: 80  },
  rammer:      { color: '#ee8822', size: 18, hp: 5,  speed: 13,  wallDmg: 2,  score: 60  },
  necromancer: { color: '#440066', size: 14, hp: 4,  speed: 5,   wallDmg: 0,  score: 100 },
  splitter:    { color: '#44cc22', size: 14, hp: 3,  speed: 10,  wallDmg: 2,  score: 40  },
  bigone:      { color: '#990000', size: 30, hp: 20, speed: 3,   wallDmg: 8,  score: 300 },
  spider:      { color: '#999999', size: 7,  hp: 1,  speed: 30,  wallDmg: 1,  score: 10  },
};

// ── x 위치 → 벽 세그먼트 인덱스 (0~3) ──
function xToWallIdx(x) {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < 4; i++) {
    const seg = WALL_SEGMENTS[i];
    const cx = seg.x + seg.w / 2;
    const dist = Math.abs(x - cx);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// ── 좀비 스폰 ──
function spawnZombie(type, x, hpMul = 1, speedMul = 1, overrides = {}) {
  const cfg = ZOMBIE_TYPES[type];
  if (!cfg) return;

  const hp = Math.ceil(cfg.hp * hpMul);
  const z = {
    type,
    x,
    y: overrides.y !== undefined ? overrides.y : -20,
    hp,
    maxHp: hp,
    speed: cfg.speed * speedMul,
    size: overrides.size || cfg.size,
    color: overrides.color || cfg.color,
    alive: true,
    hitFlash: 0,
    walkPhase: Math.random() * Math.PI * 2,
    zigzagPhase: Math.random() * Math.PI * 2,
    rammed: false,
    statusEffects: { frozen: 0, poisoned: 0 },
    buffed: false,
    gold: overrides.gold || false,
    // ── Sound-attraction AI ──
    aiState: 'idle',
    targetX: null,
    targetY: null,
    moveDir: null,       // 이동 방향 벡터 {x, y} — 타겟 통과 후에도 유지
    hearingRange: 1200,
    noiseTimer: 0,
    soundThreshold: 0,   // 현재 반응 중인 소리 크기 (이보다 작은 소리 무시)
    soundCooldown: 0,    // threshold 유지 시간 (초)
  };

  state.zombies.push(z);
  return z;
}

// 사운드 쓰로틀링
let wallHitSoundTimer = 0;
let towerHitSoundTimer = 0;

// ── 가장 큰 소리 찾기 (범위 내에서 loudness 기준) ──
// zombie_shuffle 소리는 가장 익숙한 소리이므로 loudness를 1/4로 취급
function findLoudestSound(z, minLoudness = 0) {
  let best = null;
  let bestLoudness = minLoudness;
  for (const s of state.soundSources) {
    const dist = Math.hypot(z.x - s.x, z.y - s.y);
    if (dist < s.range && dist < z.hearingRange) {
      // 좀비 소리는 가장 익숙 → loudness 1/4 감쇄
      const baseLoudness = s.type === 'zombie_shuffle' ? (s.loudness || s.range) * 0.25
                                                       : (s.loudness || s.range);
      // 유효 크기 = baseLoudness × 거리 감쇠 (가까울수록 크게 느낌)
      const effectiveLoudness = baseLoudness * (1 - dist / s.range);
      if (effectiveLoudness > bestLoudness) {
        bestLoudness = effectiveLoudness;
        best = s;
      }
    }
  }
  return best;
}

// ── 가장 가까운 타워 찾기 ──
function findNearestTower(x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const t of state.towers) {
    if (t.hp <= 0) continue;
    const dist = Math.hypot(x - t.x, y - TOWER_Y);
    if (dist < bestDist) {
      bestDist = dist;
      best = t;
    }
  }
  return { tower: best, dist: bestDist };
}

// ── 건물 충돌 체크 ──
function zombieCollidesBuilding(x, y, size) {
  for (const b of state.buildings) {
    if (x + size > b.x && x - size < b.x + b.w &&
        y + size > b.y && y - size < b.y + b.h) {
      return true;
    }
  }
  return false;
}

// ── 좀비 간 분리 물리 (겹침 방지) ──
function applySeparation() {
  const zombies = state.zombies;
  for (let i = 0; i < zombies.length; i++) {
    const a = zombies[i];
    if (!a.alive) continue;
    let pushX = 0, pushY = 0;
    for (let j = i + 1; j < zombies.length; j++) {
      const b = zombies[j];
      if (!b.alive) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy);
      const minDist = (a.size + b.size) * 0.8;
      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const force = overlap * 0.5;
        pushX += nx * force;
        pushY += ny * force;
        b.x -= nx * force;
        b.y -= ny * force;
      }
    }
    a.x += pushX;
    a.y += pushY;
  }
}

// ── 좀비 업데이트 ──
function updateZombies(dt) {
  wallHitSoundTimer -= dt;
  towerHitSoundTimer -= dt;

  for (let i = state.zombies.length - 1; i >= 0; i--) {
    const z = state.zombies[i];
    if (!z.alive) continue;

    // ── 상태이상 처리 ──
    if (z.statusEffects.frozen > 0) z.statusEffects.frozen -= dt;
    if (z.statusEffects.poisoned > 0) {
      z.statusEffects.poisoned -= dt;
      z.hp -= 1 * dt;
      z.hitFlash = Math.max(z.hitFlash, 0.05);
    }
    if (z.statusEffects.burning > 0) {
      z.statusEffects.burning -= dt;
      z.hp -= 1.5 * dt;
      z.hitFlash = Math.max(z.hitFlash, 0.05);
    }
    if (z.hitFlash > 0) z.hitFlash -= dt;

    const frozen = z.statusEffects.frozen > 0;
    const speedMul = (frozen ? 0.5 : 1) * (z.buffed ? 1.3 : 1);

    // ── AI 상태 머신 (idle / attracted) ──
    if (z.aiState === 'idle') {
      // 주변을 랜덤으로 느리게 배회 (기본 속도의 30%)
      const wanderSpeed = z.speed * 0.3 * speedMul;
      z.zigzagPhase += dt * 1.2;
      const wanderAngle = z.zigzagPhase * 0.7 + Math.sin(z.zigzagPhase * 0.3) * 2;
      let newX = z.x + Math.cos(wanderAngle) * wanderSpeed * dt;
      let newY = z.y + Math.sin(wanderAngle) * wanderSpeed * dt;

      newX = Math.max(5, Math.min(W - 5, newX));
      newY = Math.max(48, Math.min(640, newY));

      if (!zombieCollidesBuilding(newX, newY, z.size)) {
        z.x = newX;
        z.y = newY;
      } else if (!zombieCollidesBuilding(newX, z.y, z.size)) {
        z.x = newX;
      } else if (!zombieCollidesBuilding(z.x, newY, z.size)) {
        z.y = newY;
      }

      // idle 벽 충돌 체크
      const idleWallIdx = xToWallIdx(z.x);
      const idleWallY = getWallY(idleWallIdx);
      const idleWallSeg = WALL_SEGMENTS[idleWallIdx];
      if (z.y >= idleWallY && z.y <= idleWallY + 20 &&
          z.x >= idleWallSeg.x && z.x <= idleWallSeg.x + idleWallSeg.w) {
        if (state.walls[idleWallIdx].hp > 0) {
          z.y = idleWallY;
        }
      }

      // 소리 면역 쿨다운 감소
      if (z.soundCooldown > 0) {
        z.soundCooldown -= dt;
        if (z.soundCooldown <= 0) {
          z.soundThreshold = 0;
          z.soundCooldown = 0;
        }
      }

      // 소리 감지 (threshold 이상만 반응)
      const sound = findLoudestSound(z, z.soundThreshold);
      if (sound) {
        // 소리에 원래 목적지가 있으면 그곳으로, 없으면 소리 발생 위치로
        const dest = sound.target || { x: sound.x, y: sound.y };
        z.targetX = dest.x;
        z.targetY = dest.y;
        const ddx = dest.x - z.x;
        const ddy = dest.y - z.y;
        const ddist = Math.hypot(ddx, ddy);
        if (ddist > 0) {
          z.moveDir = { x: ddx / ddist, y: ddy / ddist };
        }
        // 반응한 소리 크기를 threshold로 설정 (3초간 이보다 작은 소리 무시)
        const heardLoudness = (sound.loudness || sound.range) * (1 - Math.hypot(z.x - sound.x, z.y - sound.y) / sound.range);
        z.soundThreshold = heardLoudness * 0.7; // 70% 이상의 소리에만 재반응
        z.soundCooldown = 3;
        z.aiState = 'attracted';
      }

    } else if (z.aiState === 'attracted') {
      // 끌린 좀비 셔플 소음 (체인 전파용 — 원래 목적지 좌표 전달)
      z.noiseTimer -= dt;
      if (z.noiseTimer <= 0) {
        z.noiseTimer = 0.5;
        const shuffleTarget = (z.targetX != null && z.targetY != null)
          ? { x: z.targetX, y: z.targetY } : null;
        emitSound(z.x, z.y, 240, 0.3, 'zombie_shuffle', shuffleTarget);
      }

      // 타겟 방향으로 직선 이동 (타겟 지나쳐도 계속 진행)
      const dx = z.targetX - z.x;
      const dy = z.targetY - z.y;
      const dist = Math.hypot(dx, dy);

      // 현재 이동 방향 결정: 타겟이 아직 멀면 타겟 방향, 아니면 저장된 방향 유지
      let nx, ny;
      if (dist > 5) {
        nx = dx / dist;
        ny = dy / dist;
        z.moveDir = { x: nx, y: ny };
      } else {
        nx = z.moveDir ? z.moveDir.x : 0;
        ny = z.moveDir ? z.moveDir.y : 1;
      }

      let moveSpeed = z.speed * speedMul * 1.5; // 끌린 좀비 1.5배속

      // 러너/스파이더: 지그재그
      let newX = z.x, newY = z.y;
      if (z.type === 'runner' || z.type === 'spider') {
        z.zigzagPhase += dt * (z.type === 'spider' ? 8 : 5);
        const zigAmp = z.type === 'spider' ? 40 : 25;
        const zigOffset = Math.sin(z.zigzagPhase) * zigAmp;
        newX += nx * moveSpeed * dt + (-ny) * zigOffset * dt * 3;
        newY += ny * moveSpeed * dt + nx * zigOffset * dt * 3;
      } else if (z.type === 'rammer') {
        if (dist < 100) {
          moveSpeed *= 2;
          if (dist > 95 && dist < 100) playRammerCharge();
        }
        newX += nx * moveSpeed * dt;
        newY += ny * moveSpeed * dt;
      } else {
        newX += nx * moveSpeed * dt;
        newY += ny * moveSpeed * dt;
      }

      newX = Math.max(5, Math.min(W - 5, newX));
      newY = Math.max(48, Math.min(640, newY));

      // ── 건물 충돌 체크 — 슬라이딩: 막히면 각 축 개별 시도 ──
      if (!zombieCollidesBuilding(newX, newY, z.size)) {
        z.x = newX;
        z.y = newY;
      } else if (!zombieCollidesBuilding(newX, z.y, z.size)) {
        z.x = newX; // X만 이동 (벽을 따라 수평 슬라이딩)
      } else if (!zombieCollidesBuilding(z.x, newY, z.size)) {
        z.y = newY; // Y만 이동 (벽을 따라 수직 슬라이딩)
      }

      // ── 벽 충돌 체크 (위치 정지 + 래머 1회) ──
      const wallIdx = xToWallIdx(z.x);
      const wallY = getWallY(wallIdx);
      const wallSeg = WALL_SEGMENTS[wallIdx];

      if (z.y >= wallY && z.y <= wallY + 20 &&
          z.x >= wallSeg.x && z.x <= wallSeg.x + wallSeg.w) {
        if (state.walls[wallIdx].hp > 0) {
          z.y = wallY; // 벽 앞에서 정지

          if (state.buffs.shieldTimer <= 0) {
            // 래머 돌진 1회 데미지
            if (z.type === 'rammer' && !z.rammed) {
              state.walls[wallIdx].hp -= 15;
              if (state.walls[wallIdx].hp < 0) state.walls[wallIdx].hp = 0;
              z.rammed = true;
              playWallHit();
            }
          }
        }
      }

      // ── 타워 충돌 체크 (가장 가까운 타워) ──
      const nearest = findNearestTower(z.x, z.y);
      if (nearest.tower && nearest.dist < 20) {
        if (state.buffs.shieldTimer <= 0) {
          nearest.tower.hp -= ZOMBIE_TYPES[z.type].wallDmg * dt;
          if (nearest.tower.hp < 0) nearest.tower.hp = 0;
          if (towerHitSoundTimer <= 0) {
            playTowerHit();
            towerHitSoundTimer = 1;
          }
        }
      }

      // 소리 면역 쿨다운 감소
      if (z.soundCooldown > 0) {
        z.soundCooldown -= dt;
        if (z.soundCooldown <= 0) {
          z.soundThreshold = 0;
          z.soundCooldown = 0;
        }
      }

      // 새 소리 감지 — threshold 이상이고 현재보다 큰 소리만 반응
      const newSound = findLoudestSound(z, z.soundThreshold);
      if (newSound) {
        const newLoudness = (newSound.loudness || newSound.range) * (1 - Math.hypot(z.x - newSound.x, z.y - newSound.y) / newSound.range);
        // 더 큰 소리면 방향 전환 + threshold 갱신 (원래 목적지 좌표 사용)
        const dest = newSound.target || { x: newSound.x, y: newSound.y };
        z.targetX = dest.x;
        z.targetY = dest.y;
        const sdx = dest.x - z.x;
        const sdy = dest.y - z.y;
        const sdist = Math.hypot(sdx, sdy);
        if (sdist > 0) {
          z.moveDir = { x: sdx / sdist, y: sdy / sdist };
        }
        z.soundThreshold = newLoudness * 0.7;
        z.soundCooldown = 3;
      }
    }

    // 걷기 애니메이션 (idle에서도 제자리걸음 가능하도록)
    z.walkPhase += dt * z.speed * 0.1;
    z.buffed = false;

    // 사망 체크
    if (z.hp <= 0) {
      z.alive = false;
      handleZombieDeath(z, i);
    }
  }

  // ── 네크로맨서 오라 ──
  for (const necro of state.zombies) {
    if (!necro.alive || necro.type !== 'necromancer') continue;
    for (const z of state.zombies) {
      if (!z.alive || z === necro) continue;
      const dist = Math.hypot(necro.x - z.x, necro.y - z.y);
      if (dist < 80) {
        z.hp = Math.min(z.maxHp, z.hp + 1 * dt);
        z.buffed = true;
      }
    }
  }

  // ── 화염 전파 (불붙은 좀비 → 접촉 좀비) ──
  for (let i = 0; i < state.zombies.length; i++) {
    const a = state.zombies[i];
    if (!a.alive || !a.statusEffects.burning || a.statusEffects.burning <= 0) continue;
    for (let j = 0; j < state.zombies.length; j++) {
      if (i === j) continue;
      const b = state.zombies[j];
      if (!b.alive || (b.statusEffects.burning && b.statusEffects.burning > 0)) continue;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < 10) {
        if (!b.statusEffects.burning) b.statusEffects.burning = 0;
        b.statusEffects.burning = 1.5;
      }
    }
  }

  // ── 벽 압력 시스템 (세그먼트별 데미지) ──
  if (state.buffs.shieldTimer <= 0) {
    const wallPressure = [0, 0, 0, 0];
    const wallAttackers = [0, 0, 0, 0];

    for (const z of state.zombies) {
      if (!z.alive || z.y < WALL_Y - 50) continue;
      const segIdx = xToWallIdx(z.x);
      const wallY = getWallY(segIdx);
      const wallSeg = WALL_SEGMENTS[segIdx];
      if (z.x < wallSeg.x || z.x > wallSeg.x + wallSeg.w) continue;
      if (state.walls[segIdx].hp <= 0) continue;

      const wallDmg = z.type === 'necromancer' ? 0 : ZOMBIE_TYPES[z.type].wallDmg;
      if (z.y >= wallY - 5) {
        wallAttackers[segIdx]++;
        wallPressure[segIdx] += wallDmg;
      } else {
        wallPressure[segIdx] += 0.5;
      }
    }

    for (let i = 0; i < 4; i++) {
      if (wallAttackers[i] > 0 && state.walls[i].hp > 0) {
        const baseDmg = wallPressure[i];
        const maxDmg = wallAttackers[i] * 3;
        const finalDmg = Math.min(baseDmg, maxDmg);
        const prevHp = state.walls[i].hp;
        state.walls[i].hp -= finalDmg * dt;
        if (state.walls[i].hp < 0) state.walls[i].hp = 0;

        if (wallHitSoundTimer <= 0 && finalDmg > 0) {
          playWallHit();
          wallHitSoundTimer = 0.8;
        }
        if (prevHp > 0 && state.walls[i].hp <= 0) playWallBreak();
      }
    }
  }

  // ── 좀비 간 분리 물리 (겹침 방지) ──
  applySeparation();

  // 죽은 좀비 제거
  for (let i = state.zombies.length - 1; i >= 0; i--) {
    if (!state.zombies[i].alive) state.zombies.splice(i, 1);
  }

  // 웨이브 스폰 큐
  for (let i = state.waveSpawnQueue.length - 1; i >= 0; i--) {
    const entry = state.waveSpawnQueue[i];
    entry.delay -= dt;
    if (entry.delay <= 0) {
      spawnZombie(entry.type, entry.x, entry.hpMul, entry.speedMul, entry.overrides || {});
      state.waveSpawnQueue.splice(i, 1);
    }
  }

  // 웨이브 클리어 체크
  if (!state.waveCleared && state.wave > 0) {
    const allDead = state.zombies.filter(z => z.alive).length === 0;
    const queueEmpty = state.waveSpawnQueue.length === 0;
    if (allDead && queueEmpty) state.waveCleared = true;
  }
}

// ── 좀비 사망 처리 ──
function handleZombieDeath(z, _idx) {
  playZombieDeath();

  if (z.type === 'splitter') {
    playSplitterSplit();
    for (let j = 0; j < 2; j++) {
      const offsetX = (j === 0 ? -12 : 12);
      const mini = spawnZombie('spider', z.x + offsetX, 1, 1, { color: '#44cc22', size: 7 });
      if (mini) {
        mini.hp = 1; mini.maxHp = 1; mini.speed = 60; mini.y = z.y;
      }
    }
  }

  if (z.type === 'bigone') state.bigOneKilled = true;
  if (state.waveZombiesLeft > 0) state.waveZombiesLeft--;
}

// ── 발사체 충돌 판정 ──
function checkZombieHits(projectiles) {
  const hits = [];

  for (const p of projectiles) {
    if (!p.alive) continue;

    // 화살: 하강 중에만 타격 가능 (포물선 비행)
    if (p.type === 'arrow' && p.arcTarget) {
      if (!p.arcDescending) continue; // 상승 중엔 좀비 위를 날아감
    }

    for (const z of state.zombies) {
      if (!z.alive) continue;

      const dist = Math.hypot(p.x - z.x, p.y - z.y);
      if (dist < z.size) {
        const damage = p.damage || 1;
        z.hp -= damage;
        z.hitFlash = 0.15;

        playZombieHit();

        if (p.freeze) { z.statusEffects.frozen = 3; playFreezeApply(); }
        if (p.poison) { z.statusEffects.poisoned = 5; playPoisonApply(); }

        if (p.chain) {
          const nearby = state.zombies
            .filter(oz => oz.alive && oz !== z && Math.hypot(oz.x - z.x, oz.y - z.y) < 80)
            .sort((a, b) => Math.hypot(a.x - z.x, a.y - z.y) - Math.hypot(b.x - z.x, b.y - z.y))
            .slice(0, 2);
          for (const oz of nearby) { oz.hp -= 1; oz.hitFlash = 0.15; }
          if (nearby.length > 0) playChainLightning();
        }

        // 착탄 소리 방출
        const PROJ_TO_WEAPON = { bullet:'pistol', arrow:'bow', sniper:'sniper', mgBullet:'mg', bolt:'crossbow' };
        const wpName = PROJ_TO_WEAPON[p.type];
        const wp = wpName ? WEAPON_PROFILES[wpName] : null;
        if (wp && wp.impactSound > 0) emitSound(z.x, z.y, wp.impactSound, 0.5, 'impact');

        // 관통: 화살은 낙하지점 뒤쪽(타워에서 더 먼 쪽) 좀비에게만 관통
        if (p.type === 'arrow' && p.arcTarget) {
          // 발사 타워(가장 가까운 타워) 기준으로 거리 비교
          const shooterTower = findNearestTower(p.arcTarget.x, p.arcTarget.y);
          const sTowerX = shooterTower.tower ? shooterTower.tower.x : 270;
          const towerToTarget = Math.hypot(p.arcTarget.x - sTowerX, p.arcTarget.y - TOWER_Y);
          const towerToZombie = Math.hypot(z.x - sTowerX, z.y - TOWER_Y);
          const isBehindTarget = towerToZombie >= towerToTarget - 5; // 타겟보다 뒤(멀리)에 있는지
          if (isBehindTarget && p.penetrateLeft > 0) {
            p.penetrateLeft--;
          } else {
            p.alive = false;
          }
        } else if (p.penetrateLeft !== undefined && p.penetrateLeft > 0) {
          p.penetrateLeft--;
        } else {
          p.alive = false;
        }

        // 점수
        const distBonus = 1 + (WALL_Y - z.y) / WALL_Y;
        const baseScore = ZOMBIE_TYPES[z.type] ? ZOMBIE_TYPES[z.type].score : 20;
        const score = Math.floor(baseScore * distBonus);
        hits.push({ type: z.type, score, x: z.x, y: z.y });

        if (!p.alive) break;
      }
    }
  }
  return hits;
}

// ── 웨이브 시작 (무한 스테이지 스케일링) ──
function startWave(stageNum) {
  // 스테이지 1 = 워커 100마리, 이후 스테이지당 +15
  const baseCount = 85 + stageNum * 15;
  // HP/속도 무한 스케일: 로그 곡선으로 천천히 증가
  const hpMul = 1 + (stageNum - 1) * 0.15;
  const speedMul = 1 + Math.min((stageNum - 1) * 0.04, 1.5); // 최대 2.5배속 캡
  const queue = [];

  // 좀비를 맵 전체에 퍼뜨림 (y: 60 ~ 500, 벽 위 영역)
  // 건물과 겹치지 않는 위치에 배치
  function addToQueue(type, count, overrides = {}) {
    const sz = ZOMBIE_TYPES[type] ? ZOMBIE_TYPES[type].size : 14;
    for (let i = 0; i < count; i++) {
      let x, y, tries = 0;
      do {
        x = 30 + Math.random() * (W - 60);
        y = 60 + Math.random() * 440;
        tries++;
      } while (tries < 20 && zombieCollidesBuilding(x, y, sz));
      queue.push({ type, x, hpMul, speedMul, delay: 0, overrides: { ...overrides, y } });
    }
  }

  // 워커: 항상 메인 비중
  addToQueue('walker', baseCount);

  // 스테이지 2+: 러너 (빠른 좀비)
  if (stageNum >= 2) addToQueue('runner', Math.floor(baseCount * 0.3));

  // 스테이지 3+: 탱크 (체력 높음)
  if (stageNum >= 3) addToQueue('tank', Math.floor(baseCount * 0.1));

  // 스테이지 4+: 래머 (돌진)
  if (stageNum >= 4) addToQueue('rammer', Math.floor(baseCount * 0.1));

  // 스테이지 5+: 스플리터 (분열)
  if (stageNum >= 5) addToQueue('splitter', Math.floor(baseCount * 0.1));

  // 스테이지 6+: 네크로맨서 (힐러)
  if (stageNum >= 6) addToQueue('necromancer', Math.floor(baseCount * 0.05));

  // 스테이지 7+: 스파이더 (빠르고 작음)
  if (stageNum >= 7) addToQueue('spider', Math.floor(baseCount * 0.2));

  // 스테이지 8+: 3스테이지마다 빅원 보스급
  if (stageNum >= 8 && stageNum % 3 === 0) {
    addToQueue('bigone', 1 + Math.floor(stageNum / 5));
  }

  // 5스테이지마다 골드 보너스 무리 (스테이지 비례)
  if (stageNum % 5 === 0) {
    addToQueue('walker', 10 + stageNum * 2, { gold: true });
  }

  state.waveSpawnQueue = queue;
  state.wave = stageNum;
  state.waveCleared = false;
  state.waveZombiesLeft = queue.length;
}

// ── 좀비 렌더링 ──
function drawZombies(ctx) {
  for (const z of state.zombies) {
    if (!z.alive) continue;
    const { x, y, size, color, walkPhase } = z;
    ctx.save();

    if (z.type === 'necromancer') {
      ctx.fillStyle = 'rgba(100, 0, 180, 0.08)';
      ctx.beginPath(); ctx.arc(x, y, 80, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(100, 0, 180, 0.25)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 80, 0, Math.PI * 2); ctx.stroke();
    }
    if (z.gold) {
      ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
      ctx.beginPath(); ctx.arc(x, y, size + 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, size + 6, 0, Math.PI * 2); ctx.stroke();
    }
    if (z.type === 'bigone') {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y, size * 0.8, size * 1.1, 0, 0, Math.PI * 2); ctx.stroke();
    }

    const legSwing = Math.sin(walkPhase) * 6;
    const legLen = size * 0.5;
    ctx.strokeStyle = z.gold ? '#ccaa00' : color;
    ctx.lineWidth = z.type === 'bigone' ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(x - size * 0.2, y + size * 0.4); ctx.lineTo(x - size * 0.2 + legSwing, y + size * 0.4 + legLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + size * 0.2, y + size * 0.4); ctx.lineTo(x + size * 0.2 - legSwing, y + size * 0.4 + legLen); ctx.stroke();

    const bodyColor = z.gold ? '#ffd700' : color;
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.ellipse(x, y, size * 0.7 * 0.5, size * 0.5, 0, 0, Math.PI * 2); ctx.fill();

    const headR = size * 0.25;
    const headY = y - size * 0.4;
    ctx.fillStyle = bodyColor;
    ctx.beginPath(); ctx.arc(x, headY, headR, 0, Math.PI * 2); ctx.fill();

    const armSwing = Math.sin(walkPhase + Math.PI * 0.5) * 5;
    const armLen = size * 0.45;
    ctx.strokeStyle = z.gold ? '#ccaa00' : color;
    ctx.lineWidth = z.type === 'bigone' ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(x - size * 0.35, y - size * 0.15); ctx.lineTo(x - size * 0.35 - armLen * 0.5 + armSwing, y - size * 0.15 + armLen * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + size * 0.35, y - size * 0.15); ctx.lineTo(x + size * 0.35 + armLen * 0.5 - armSwing, y - size * 0.15 + armLen * 0.6); ctx.stroke();

    if (z.hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 50, 50, ${Math.min(z.hitFlash / 0.15, 1) * 0.6})`;
      ctx.beginPath(); ctx.ellipse(x, y, size * 0.7 * 0.5, size * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, headY, headR, 0, Math.PI * 2); ctx.fill();
    }
    if (z.statusEffects.frozen > 0) {
      ctx.fillStyle = 'rgba(100, 180, 255, 0.3)';
      ctx.beginPath(); ctx.ellipse(x, y, size * 0.5, size * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#aaddff'; ctx.font = `${Math.max(8, size * 0.4)}px monospace`; ctx.textAlign = 'center';
      ctx.fillText('*', x, headY - headR - 2);
    }
    if (z.statusEffects.poisoned > 0) {
      ctx.fillStyle = '#44ff44';
      for (let d = 0; d < 3; d++) {
        const ddx = (d - 1) * 5; const ddy = Math.sin(z.walkPhase * 2 + d) * 3;
        ctx.beginPath(); ctx.arc(x + ddx, y + size * 0.3 + ddy, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (z.statusEffects.burning > 0) {
      ctx.fillStyle = `rgba(255, 100, 0, ${0.3 + Math.random() * 0.2})`;
      ctx.beginPath(); ctx.ellipse(x, y, size * 0.5, size * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff6600';
      for (let d = 0; d < 3; d++) {
        const fx = x + (d - 1) * 4; const fy = y - size * 0.3 - Math.random() * 6;
        ctx.beginPath(); ctx.arc(fx, fy, 2 + Math.random() * 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (z.hp < z.maxHp) {
      const barW = size * 1.2; const barH = 2; const barY = headY - headR - 5;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fillRect(x - barW / 2, barY, barW, barH);
      const hpRatio = Math.max(0, z.hp / z.maxHp);
      ctx.fillStyle = hpRatio > 0.5 ? '#44ff44' : hpRatio > 0.25 ? '#ffff44' : '#ff4444';
      ctx.fillRect(x - barW / 2, barY, barW * hpRatio, barH);
    }
    ctx.restore();
  }
}

// ── 웨이브 배너 렌더링 ──
function drawWaveBanner(ctx, w, h) {
  if (state.wavePause > 0) {
    const alpha = Math.min(state.wavePause, 1);
    ctx.fillStyle = `rgba(0, 0, 0, ${0.5 * alpha})`;
    ctx.fillRect(0, h * 0.3, w, h * 0.15);
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`Stage ${state.wave + 1}`, w / 2, h * 0.39);
  }
}

// ── 청크 기반 좀비 스폰 ──
function spawnChunkZombies(chunk) {
  const cfg = chunk.zombieConfig;
  const count = cfg.density;
  for (let i = 0; i < count; i++) {
    const type = cfg.types[Math.floor(Math.random() * cfg.types.length)];
    const sz = ZOMBIE_TYPES[type] ? ZOMBIE_TYPES[type].size : 14;
    let x, y, tries = 0;
    do {
      x = 30 + Math.random() * (W - 60);
      y = 60 + Math.random() * 440;
      tries++;
    } while (tries < 20 && zombieCollidesBuilding(x, y, sz));
    spawnZombie(type, x, cfg.hpMul, cfg.speedMul, { y });
  }
}

export { spawnZombie, updateZombies, checkZombieHits, drawZombies, startWave, drawWaveBanner, spawnChunkZombies, ZOMBIE_TYPES };
