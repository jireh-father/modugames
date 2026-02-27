// ── 좀비 시스템 (8종 AI, 웨이브, 충돌) ──
import { W, state, WALL_Y, TOWER_Y } from './game.js?v=7';
import { getWallY, getWallSegments } from './wall.js?v=7';

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

// ── 프로젝타일 데미지 테이블 ──
const PROJ_DAMAGE = {
  bullet: 1,
  arrow: 2,
  sniper: 3,
  mgBullet: 1,
  bolt: 2,
};

// 관통형 발사체 (적중 후에도 계속 진행)
const PIERCING_TYPES = new Set(['sniper', 'arrow', 'bolt']);

// ── x 위치 → 벽 세그먼트 인덱스 (0~3) ──
function xToWallIdx(x) {
  // Map x position to closest wall segment
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
    y: -20,
    hp,
    maxHp: hp,
    speed: cfg.speed * speedMul,
    size: overrides.size || cfg.size,
    color: overrides.color || cfg.color,
    targetWallIdx: xToWallIdx(x),
    pastWall: false,
    attackingWall: false,
    attackingTower: false,
    hitFlash: 0,
    walkPhase: Math.random() * Math.PI * 2,
    zigzagPhase: Math.random() * Math.PI * 2,
    rammed: false,
    alive: true,
    statusEffects: { frozen: 0, poisoned: 0 },
    buffed: false,
    gold: overrides.gold || false,
  };

  state.zombies.push(z);
  return z;
}

// ── 좀비 업데이트 ──
function updateZombies(dt) {
  const TOWER_X = state.tower.x;

  for (let i = state.zombies.length - 1; i >= 0; i--) {
    const z = state.zombies[i];
    if (!z.alive) continue;

    // ── 상태이상 처리 ──
    if (z.statusEffects.frozen > 0) z.statusEffects.frozen -= dt;
    if (z.statusEffects.poisoned > 0) {
      z.statusEffects.poisoned -= dt;
      z.hp -= 1 * dt; // 1 dmg/s
      z.hitFlash = Math.max(z.hitFlash, 0.05);
    }

    // 히트 플래시 감소
    if (z.hitFlash > 0) z.hitFlash -= dt;

    const frozen = z.statusEffects.frozen > 0;
    const speedMul = (frozen ? 0.5 : 1) * (z.buffed ? 1.3 : 1);
    const wallY = getWallY(z.targetWallIdx);
    const wallSeg = WALL_SEGMENTS[z.targetWallIdx];
    const wallCenterX = wallSeg.x + wallSeg.w / 2;

    // ── 이동 & 행동 ──
    if (!z.pastWall && !z.attackingTower) {
      if (!z.attackingWall) {
        // --- 벽에 도달하지 않은 상태 ---

        // 네크로맨서: 벽에서 80px 뒤에서 정지
        if (z.type === 'necromancer') {
          const stopY = wallY - 80;
          if (z.y < stopY) {
            z.y += z.speed * dt * speedMul;
            if (z.y > stopY) z.y = stopY;
            // 벽 중앙을 향해 x 이동
            const dxToWall = wallCenterX - z.x;
            if (Math.abs(dxToWall) > 2) {
              z.x += Math.sign(dxToWall) * z.speed * 0.5 * dt * speedMul;
            }
          }
          // 네크로맨서는 벽에 도달하지 않음
        } else if (z.type === 'runner' || z.type === 'spider') {
          // 러너/스파이더: 지그재그 이동
          z.zigzagPhase += dt * (z.type === 'spider' ? 8 : 5);
          const zigAmp = z.type === 'spider' ? 40 : 25;
          const zigOffset = Math.sin(z.zigzagPhase) * zigAmp;

          z.y += z.speed * dt * speedMul;

          // x를 벽 중앙 + 지그재그 오프셋으로
          const targetX = wallCenterX + zigOffset;
          const dxToTarget = targetX - z.x;
          z.x += dxToTarget * dt * 3;

          // 화면 바운드
          z.x = Math.max(5, Math.min(W - 5, z.x));

          // 벽 도달 체크
          if (z.y >= wallY) {
            z.y = wallY;
            if (state.walls[z.targetWallIdx].hp > 0) {
              z.attackingWall = true;
            } else {
              z.pastWall = true;
            }
          }
        } else if (z.type === 'rammer') {
          // 래머: 직진, 벽 100px 근처에서 속도 2배
          const distToWall = wallY - z.y;
          const ramSpeedMul = distToWall < 100 ? 2 : 1;
          z.y += z.speed * dt * speedMul * ramSpeedMul;

          // 벽 중앙을 향해 x 이동
          const dxToWall = wallCenterX - z.x;
          if (Math.abs(dxToWall) > 2) {
            z.x += Math.sign(dxToWall) * z.speed * 0.3 * dt * speedMul;
          }

          // 벽 도달 체크
          if (z.y >= wallY) {
            z.y = wallY;
            if (state.walls[z.targetWallIdx].hp > 0) {
              z.attackingWall = true;
              // 래머 돌진 데미지 (1회)
              if (!z.rammed && state.buffs.shieldTimer <= 0) {
                state.walls[z.targetWallIdx].hp -= 15;
                if (state.walls[z.targetWallIdx].hp < 0) state.walls[z.targetWallIdx].hp = 0;
                z.rammed = true;
              }
            } else {
              z.pastWall = true;
            }
          }
        } else {
          // 워커, 탱커, 스플리터, 빅원: 직선 이동
          z.y += z.speed * dt * speedMul;

          // 벽 중앙을 향해 x 이동
          const dxToWall = wallCenterX - z.x;
          if (Math.abs(dxToWall) > 2) {
            z.x += Math.sign(dxToWall) * z.speed * 0.3 * dt * speedMul;
          }

          // 벽 도달 체크
          if (z.y >= wallY) {
            z.y = wallY;
            if (state.walls[z.targetWallIdx].hp > 0) {
              z.attackingWall = true;
            } else {
              z.pastWall = true;
            }
          }
        }
      } else {
        // --- 벽을 공격 중 ---
        if (state.walls[z.targetWallIdx].hp > 0) {
          if (state.buffs.shieldTimer <= 0) {
            state.walls[z.targetWallIdx].hp -= z.type === 'necromancer' ? 0 : ZOMBIE_TYPES[z.type].wallDmg * dt;
            if (state.walls[z.targetWallIdx].hp < 0) state.walls[z.targetWallIdx].hp = 0;
          }
        } else {
          // 벽 파괴됨 → 침투
          z.attackingWall = false;
          z.pastWall = true;
        }
      }
    } else if (z.pastWall && !z.attackingTower) {
      // --- 벽을 넘어 타워로 진격 ---
      const dxToTower = TOWER_X - z.x;
      const dyToTower = TOWER_Y - z.y;
      const distToTower = Math.hypot(dxToTower, dyToTower);

      if (distToTower > 20) {
        const nx = dxToTower / distToTower;
        const ny = dyToTower / distToTower;
        z.x += nx * z.speed * dt * speedMul;
        z.y += ny * z.speed * dt * speedMul;
      } else {
        // 타워 도달
        z.attackingTower = true;
      }
    } else if (z.attackingTower) {
      // --- 타워 공격 중 ---
      if (state.buffs.shieldTimer <= 0) {
        state.tower.hp -= ZOMBIE_TYPES[z.type].wallDmg * dt;
        if (state.tower.hp < 0) state.tower.hp = 0;
      }
    }

    // ── 걷기 애니메이션 ──
    z.walkPhase += dt * z.speed * 0.1;

    // ── 버프 리셋 (매 프레임 리셋 후 네크로가 다시 적용) ──
    z.buffed = false;

    // ── 사망 체크 ──
    if (z.hp <= 0) {
      z.alive = false;
      handleZombieDeath(z, i);
    }
  }

  // ── 네크로맨서 오라: 주변 좀비 회복 + 버프 ──
  for (const necro of state.zombies) {
    if (!necro.alive || necro.type !== 'necromancer') continue;

    for (const z of state.zombies) {
      if (!z.alive || z === necro) continue;
      const dist = Math.hypot(necro.x - z.x, necro.y - z.y);
      if (dist < 80) {
        // 회복: +1 HP/s (최대 HP 초과 불가)
        z.hp = Math.min(z.maxHp, z.hp + 1 * dt);
        z.buffed = true;
      }
    }
  }

  // ── 죽은 좀비 제거 ──
  for (let i = state.zombies.length - 1; i >= 0; i--) {
    if (!state.zombies[i].alive) {
      state.zombies.splice(i, 1);
    }
  }

  // ── 웨이브 스폰 큐 처리 ──
  for (let i = state.waveSpawnQueue.length - 1; i >= 0; i--) {
    const entry = state.waveSpawnQueue[i];
    entry.delay -= dt;
    if (entry.delay <= 0) {
      spawnZombie(entry.type, entry.x, entry.hpMul, entry.speedMul, entry.overrides || {});
      state.waveSpawnQueue.splice(i, 1);
    }
  }

  // ── 웨이브 클리어 체크 ──
  if (!state.waveCleared && state.wave > 0) {
    const allDead = state.zombies.filter(z => z.alive).length === 0;
    const queueEmpty = state.waveSpawnQueue.length === 0;
    if (allDead && queueEmpty) {
      state.waveCleared = true;
    }
  }
}

// ── 좀비 사망 처리 ──
function handleZombieDeath(z, _idx) {
  // 스플리터: 미니좀비 2마리 분열
  if (z.type === 'splitter') {
    for (let j = 0; j < 2; j++) {
      const offsetX = (j === 0 ? -12 : 12);
      const mini = spawnZombie('spider', z.x + offsetX, 1, 1, {
        color: '#44cc22',
        size: 7,
      });
      if (mini) {
        mini.hp = 1;
        mini.maxHp = 1;
        mini.speed = 60;
        mini.y = z.y;
        mini.targetWallIdx = z.targetWallIdx;
        mini.pastWall = z.pastWall;
      }
    }
  }

  // 빅원 사망 플래그
  if (z.type === 'bigone') {
    state.bigOneKilled = true;
  }

  // 남은 좀비 수 감소
  if (state.waveZombiesLeft > 0) {
    state.waveZombiesLeft--;
  }
}

// ── 발사체 충돌 판정 ──
function checkZombieHits(projectiles) {
  const hits = [];

  for (const p of projectiles) {
    if (!p.alive) continue;

    for (const z of state.zombies) {
      if (!z.alive) continue;

      const dist = Math.hypot(p.x - z.x, p.y - z.y);
      if (dist < z.size) {
        // 데미지 계산
        const damage = PROJ_DAMAGE[p.type] || 1;
        z.hp -= damage;
        z.hitFlash = 0.15;

        // 상태이상 적용
        if (p.freeze) z.statusEffects.frozen = 3;
        if (p.poison) z.statusEffects.poisoned = 5;

        // 체인 라이트닝: 주변 2마리에 1 데미지
        if (p.chain) {
          const nearby = state.zombies
            .filter(oz => oz.alive && oz !== z && Math.hypot(oz.x - z.x, oz.y - z.y) < 80)
            .sort((a, b) => Math.hypot(a.x - z.x, a.y - z.y) - Math.hypot(b.x - z.x, b.y - z.y))
            .slice(0, 2);
          for (const oz of nearby) {
            oz.hp -= 1;
            oz.hitFlash = 0.15;
          }
        }

        // 관통 여부
        if (!PIERCING_TYPES.has(p.type)) {
          p.alive = false;
        }

        // 점수 계산
        const distBonus = 1 + (WALL_Y - z.y) / WALL_Y;
        const nightBonus = state.isNight ? 1.5 : 1;
        const baseScore = ZOMBIE_TYPES[z.type] ? ZOMBIE_TYPES[z.type].score : 20;
        const score = Math.floor(baseScore * distBonus * nightBonus);

        hits.push({ type: z.type, score, x: z.x, y: z.y });

        // 비관통 발사체는 첫 적중 후 중단
        if (!p.alive) break;
      }
    }
  }

  return hits;
}

// ── 웨이브 시작 ──
function startWave(waveNum) {
  const day = Math.ceil(waveNum / 5);
  const waveInDay = ((waveNum - 1) % 5) + 1;
  const baseCount = 4 + day * 2;
  const hpMul = 1 + (day - 1) * 0.15;
  const speedMul = 1 + (day - 1) * 0.08;

  const queue = [];
  let delayAccum = 0;

  function addToQueue(type, count, overrides = {}) {
    for (let i = 0; i < count; i++) {
      const x = 30 + Math.random() * (W - 60);
      delayAccum += 0.15 + Math.random() * 0.35;
      queue.push({ type, x, hpMul, speedMul, delay: delayAccum, overrides });
    }
  }

  // 낮/밤 설정
  state.isNight = waveInDay >= 4;

  switch (waveInDay) {
    case 1: // Dawn - 워커 소수
      addToQueue('walker', baseCount * 10);
      break;

    case 2: // Day - 러너 + 워커
      addToQueue('walker', baseCount * 10);
      addToQueue('runner', Math.floor(baseCount / 2) * 10);
      break;

    case 3: // Sunset - 워커 + 금색좀비
      addToQueue('walker', Math.floor(baseCount / 2) * 10);
      addToQueue('walker', 20, { gold: true }); // 금색 좀비
      break;

    case 4: // Night - 탱커 + 래머 + (네크로맨서)
      addToQueue('tank', Math.floor(baseCount / 2) * 10);
      addToQueue('rammer', 20);
      if (day >= 5) addToQueue('necromancer', 10);
      break;

    case 5: // Midnight - 혼합 + 보스
      addToQueue('walker', Math.floor(baseCount / 3) * 10);
      addToQueue('runner', Math.floor(baseCount / 3) * 10);
      addToQueue('tank', 20);
      addToQueue('rammer', 10);
      addToQueue('spider', 50);
      if (day >= 3) addToQueue('bigone', 3);
      if (day >= 8) addToQueue('splitter', 20);
      if (day >= 5) addToQueue('necromancer', 10);
      break;
  }

  // 총 좀비 수 계산
  const totalCount = queue.length;

  state.waveSpawnQueue = queue;
  state.wave = waveNum;
  state.waveCleared = false;
  state.waveZombiesLeft = totalCount;
  state.day = day;
  state.waveTimer = 0;
}

// ── 좀비 렌더링 ──
function drawZombies(ctx) {
  for (const z of state.zombies) {
    if (!z.alive) continue;

    const { x, y, size, color, walkPhase } = z;

    ctx.save();

    // ── 네크로맨서 오라 ──
    if (z.type === 'necromancer') {
      ctx.fillStyle = 'rgba(100, 0, 180, 0.08)';
      ctx.beginPath();
      ctx.arc(x, y, 80, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(100, 0, 180, 0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, 80, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── 금색 좀비 글로우 ──
    if (z.gold) {
      ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
      ctx.beginPath();
      ctx.arc(x, y, size + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, size + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── 빅원 추가 디테일 (외곽 강조) ──
    if (z.type === 'bigone') {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y, size * 0.8, size * 1.1, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── 다리 (몸 아래) ──
    const legSwing = Math.sin(walkPhase) * 6;
    const legLen = size * 0.5;
    ctx.strokeStyle = z.gold ? '#ccaa00' : color;
    ctx.lineWidth = z.type === 'bigone' ? 3 : 2;

    // 왼쪽 다리
    ctx.beginPath();
    ctx.moveTo(x - size * 0.2, y + size * 0.4);
    ctx.lineTo(x - size * 0.2 + legSwing, y + size * 0.4 + legLen);
    ctx.stroke();

    // 오른쪽 다리 (반대 위상)
    ctx.beginPath();
    ctx.moveTo(x + size * 0.2, y + size * 0.4);
    ctx.lineTo(x + size * 0.2 - legSwing, y + size * 0.4 + legLen);
    ctx.stroke();

    // ── 몸통 (세로 타원) ──
    const bodyColor = z.gold ? '#ffd700' : color;
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.7 * 0.5, size * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── 머리 (원) ──
    const headR = size * 0.25;
    const headY = y - size * 0.4;
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(x, headY, headR, 0, Math.PI * 2);
    ctx.fill();

    // ── 팔 (몸 양옆) ──
    const armSwing = Math.sin(walkPhase + Math.PI * 0.5) * 5;
    const armLen = size * 0.45;
    ctx.strokeStyle = z.gold ? '#ccaa00' : color;
    ctx.lineWidth = z.type === 'bigone' ? 3 : 2;

    // 왼쪽 팔
    ctx.beginPath();
    ctx.moveTo(x - size * 0.35, y - size * 0.15);
    ctx.lineTo(x - size * 0.35 - armLen * 0.5 + armSwing, y - size * 0.15 + armLen * 0.6);
    ctx.stroke();

    // 오른쪽 팔
    ctx.beginPath();
    ctx.moveTo(x + size * 0.35, y - size * 0.15);
    ctx.lineTo(x + size * 0.35 + armLen * 0.5 - armSwing, y - size * 0.15 + armLen * 0.6);
    ctx.stroke();

    // ── 히트 플래시 (빨간 오버레이) ──
    if (z.hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 50, 50, ${Math.min(z.hitFlash / 0.15, 1) * 0.6})`;
      ctx.beginPath();
      ctx.ellipse(x, y, size * 0.7 * 0.5, size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, headY, headR, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── 냉동 표시 ──
    if (z.statusEffects.frozen > 0) {
      ctx.fillStyle = 'rgba(100, 180, 255, 0.3)';
      ctx.beginPath();
      ctx.ellipse(x, y, size * 0.5, size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      // 눈꽃 표시
      ctx.fillStyle = '#aaddff';
      ctx.font = `${Math.max(8, size * 0.4)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('*', x, headY - headR - 2);
    }

    // ── 독 표시 ──
    if (z.statusEffects.poisoned > 0) {
      ctx.fillStyle = '#44ff44';
      const dropSize = 2;
      for (let d = 0; d < 3; d++) {
        const dx = (d - 1) * 5;
        const dy = Math.sin(z.walkPhase * 2 + d) * 3;
        ctx.beginPath();
        ctx.arc(x + dx, y + size * 0.3 + dy, dropSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── HP 바 (체력이 깎인 경우만 표시) ──
    if (z.hp < z.maxHp) {
      const barW = size * 1.2;
      const barH = 2;
      const barY = headY - headR - 5;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(x - barW / 2, barY, barW, barH);

      const hpRatio = Math.max(0, z.hp / z.maxHp);
      ctx.fillStyle = hpRatio > 0.5 ? '#44ff44' : hpRatio > 0.25 ? '#ffff44' : '#ff4444';
      ctx.fillRect(x - barW / 2, barY, barW * hpRatio, barH);
    }

    ctx.restore();
  }
}

// ── 웨이브 배너 렌더링 ──
function drawWaveBanner(ctx, w, h) {
  const PHASE_NAMES = ['Dawn', 'Day', 'Sunset', 'Night', 'Midnight'];
  const PHASE_ICONS = ['\u2600', '\u2600', '\u2600', '\uD83C\uDF19', '\uD83C\uDF19'];

  if (state.wavePause > 0) {
    const alpha = Math.min(state.wavePause, 1);

    // 배경
    ctx.fillStyle = `rgba(0, 0, 0, ${0.5 * alpha})`;
    ctx.fillRect(0, h * 0.3, w, h * 0.2);

    ctx.textAlign = 'center';

    // Day 완료 배너 (5의 배수 웨이브 직후)
    if (state.wave > 0 && state.wave % 5 === 0) {
      ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
      ctx.font = 'bold 28px monospace';
      ctx.fillText(`DAY ${state.day} COMPLETE`, w / 2, h * 0.38);

      ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * alpha})`;
      ctx.font = '16px monospace';
      ctx.fillText('Preparing next day...', w / 2, h * 0.44);
    } else {
      // 다음 웨이브 배너
      const nextWave = state.wave + 1;
      const nextWaveInDay = ((nextWave - 1) % 5) + 1;
      const phaseName = PHASE_NAMES[nextWaveInDay - 1] || 'Dawn';
      const phaseIcon = PHASE_ICONS[nextWaveInDay - 1] || '';

      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.font = 'bold 24px monospace';
      ctx.fillText(`Wave ${nextWave}`, w / 2, h * 0.37);

      ctx.fillStyle = `rgba(200, 200, 200, ${0.8 * alpha})`;
      ctx.font = '14px monospace';
      ctx.fillText(`${phaseIcon} ${phaseName} - Day ${Math.ceil(nextWave / 5)}`, w / 2, h * 0.43);
    }
  }
}

export { spawnZombie, updateZombies, checkZombieHits, drawZombies, startWave, drawWaveBanner, ZOMBIE_TYPES };
