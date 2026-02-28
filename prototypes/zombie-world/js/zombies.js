// ── 좀비 시스템 (소리-유인 AI, 웨이브, 충돌) ──
import { W, state, WALL_Y, TOWER_Y, WEAPON_PROFILES, emitSound } from './game.js?v=13';
import { getWallY, getWallSegments } from './wall.js?v=13';
import { playZombieHit, playZombieDeath, playWallHit, playWallBreak, playTowerHit,
         playSplitterSplit, playRammerCharge, playChainLightning,
         playFreezeApply, playPoisonApply } from './audio.js?v=13';

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
    idleDir: Math.random() * Math.PI * 2,
    idleDirTimer: 2 + Math.random() * 2,
    arrivedTimer: 0,
    hearingRange: 300,
  };

  state.zombies.push(z);
  return z;
}

// 사운드 쓰로틀링
let wallHitSoundTimer = 0;
let towerHitSoundTimer = 0;

// ── 가장 가까운 소리 찾기 ──
function findClosestSound(z) {
  let best = null;
  let bestDist = Infinity;
  for (const s of state.soundSources) {
    const dist = Math.hypot(z.x - s.x, z.y - s.y);
    if (dist < s.range && dist < z.hearingRange && dist < bestDist) {
      bestDist = dist;
      best = s;
    }
  }
  return best;
}

// ── 좀비 업데이트 ──
function updateZombies(dt) {
  const TOWER_X = state.tower.x;
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

    // ── AI 상태 머신 ──
    if (z.aiState === 'idle') {
      // 천천히 무작위 이동
      z.idleDirTimer -= dt;
      if (z.idleDirTimer <= 0) {
        z.idleDir = Math.random() * Math.PI * 2;
        z.idleDirTimer = 2 + Math.random() * 2;
      }

      const idleSpeed = z.speed * 0.3 * speedMul;
      z.x += Math.cos(z.idleDir) * idleSpeed * dt;
      z.y += Math.sin(z.idleDir) * idleSpeed * dt;

      // 화면 바운드 반사
      if (z.x < 5) { z.x = 5; z.idleDir = Math.PI - z.idleDir; }
      if (z.x > W - 5) { z.x = W - 5; z.idleDir = Math.PI - z.idleDir; }
      if (z.y < 48) { z.y = 48; z.idleDir = -z.idleDir; }
      if (z.y > 640) { z.y = 640; z.idleDir = -z.idleDir; }

      // 소리 감지
      const sound = findClosestSound(z);
      if (sound) {
        z.targetX = sound.x;
        z.targetY = sound.y;
        z.aiState = 'attracted';
      }

    } else if (z.aiState === 'attracted') {
      // 타겟을 향해 이동
      const dx = z.targetX - z.x;
      const dy = z.targetY - z.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 1) {
        const nx = dx / dist;
        const ny = dy / dist;
        let moveSpeed = z.speed * speedMul;

        // 러너/스파이더: 지그재그
        if (z.type === 'runner' || z.type === 'spider') {
          z.zigzagPhase += dt * (z.type === 'spider' ? 8 : 5);
          const zigAmp = z.type === 'spider' ? 40 : 25;
          const zigOffset = Math.sin(z.zigzagPhase) * zigAmp;
          z.x += nx * moveSpeed * dt + (-ny) * zigOffset * dt * 3;
          z.y += ny * moveSpeed * dt + nx * zigOffset * dt * 3;
        } else if (z.type === 'rammer') {
          if (dist < 100) {
            moveSpeed *= 2;
            if (dist > 95 && dist < 100) playRammerCharge();
          }
          z.x += nx * moveSpeed * dt;
          z.y += ny * moveSpeed * dt;
        } else {
          z.x += nx * moveSpeed * dt;
          z.y += ny * moveSpeed * dt;
        }

        z.x = Math.max(5, Math.min(W - 5, z.x));
        z.y = Math.max(48, Math.min(640, z.y));

        // ── 벽 충돌 체크 ──
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

              const prevHp = state.walls[wallIdx].hp;
              const wallDmg = z.type === 'necromancer' ? 0 : ZOMBIE_TYPES[z.type].wallDmg;
              state.walls[wallIdx].hp -= wallDmg * dt;
              if (state.walls[wallIdx].hp < 0) state.walls[wallIdx].hp = 0;

              if (wallHitSoundTimer <= 0 && wallDmg > 0) {
                playWallHit();
                wallHitSoundTimer = 0.8;
              }
              if (prevHp > 0 && state.walls[wallIdx].hp <= 0) playWallBreak();
            }
          }
        }

        // ── 타워 충돌 체크 ──
        const distToTower = Math.hypot(z.x - TOWER_X, z.y - TOWER_Y);
        if (distToTower < 20) {
          if (state.buffs.shieldTimer <= 0) {
            state.tower.hp -= ZOMBIE_TYPES[z.type].wallDmg * dt;
            if (state.tower.hp < 0) state.tower.hp = 0;
            if (towerHitSoundTimer <= 0) {
              playTowerHit();
              towerHitSoundTimer = 1;
            }
          }
        }
      }

      // 타겟 도달 체크
      const distToTarget = Math.hypot(z.targetX - z.x, z.targetY - z.y);
      if (distToTarget < 15) {
        z.aiState = 'arrived';
        z.arrivedTimer = 1.5;
      }

      // 더 가까운 새 소리 체크
      const newSound = findClosestSound(z);
      if (newSound) {
        const newDist = Math.hypot(z.x - newSound.x, z.y - newSound.y);
        if (newDist < distToTarget) {
          z.targetX = newSound.x;
          z.targetY = newSound.y;
        }
      }

    } else if (z.aiState === 'arrived') {
      z.arrivedTimer -= dt;

      if (z.arrivedTimer <= 0) {
        z.aiState = 'idle';
        z.idleDir = Math.random() * Math.PI * 2;
        z.idleDirTimer = 2 + Math.random() * 2;
      }

      // 대기 중에도 새 소리 감지
      const sound = findClosestSound(z);
      if (sound) {
        z.targetX = sound.x;
        z.targetY = sound.y;
        z.aiState = 'attracted';
      }
    }

    // 걷기 애니메이션
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
          // 타워→타겟 거리 vs 타워→좀비 거리 비교
          const towerToTarget = Math.hypot(p.arcTarget.x - state.tower.x, p.arcTarget.y - TOWER_Y);
          const towerToZombie = Math.hypot(z.x - state.tower.x, z.y - TOWER_Y);
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
  function addToQueue(type, count, overrides = {}) {
    for (let i = 0; i < count; i++) {
      const x = 30 + Math.random() * (W - 60);
      const y = 60 + Math.random() * 440;
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

export { spawnZombie, updateZombies, checkZombieHits, drawZombies, startWave, drawWaveBanner, ZOMBIE_TYPES };
