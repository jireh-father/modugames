// ── 플레이어 캐릭터 시스템 (지상 이동, 타워 승하강) ──
import { W, state, TOWER_Y, FIELD_TOP, FIELD_BOTTOM, emitSound } from './game.js?v=18';
import { findPath, drawPathDebug } from './pathfinding.js?v=18';
import { collidesWithBuilding, pushOutOfBuildings } from './buildings.js?v=18';
import { registerZone } from './input.js?v=18';
import { world, canMove, startTransition } from './world.js?v=18';
import { enterInterior, getNearbyBuilding } from './interior.js?v=18';
import { getFatigueSpeedMul } from './fatigue.js?v=18';

// ── 내부: 타워 탑승 ──
function climbTower(index) {
  const p = state.player;
  const tower = state.towers[index];
  if (!tower || tower.hp <= 0) return;

  p.onTower = index;
  p.x = tower.x;
  p.y = TOWER_Y;
  p.path = [];
  p.pathIdx = 0;
  p.moving = false;
  state.activeTower = index;
}

// ── 타워에서 내려오기 ──
export function descendFromTower() {
  const p = state.player;
  if (p.onTower < 0) return;

  const tower = state.towers[p.onTower];
  p.x = tower.x;
  p.y = TOWER_Y + 30;
  p.onTower = -1;
  p.path = [];
  p.pathIdx = 0;
  p.moving = false;
}

// ── initPlayer: 필드 탭 이동 존 등록 ──
export function initPlayer() {
  registerZone(
    { x: 0, y: FIELD_TOP, w: W, h: FIELD_BOTTOM - FIELD_TOP },
    {
      onTap(x, y) {
        if (state.screen !== 'playing') return;
        const p = state.player;

        // 타워 위에 있으면 필드 탭 무시
        if (p.onTower >= 0) return;

        // 건물에 걸려있으면 먼저 밀어냄 (pathfinding 시작점 보정)
        if (collidesWithBuilding(p.x, p.y, p.size)) {
          const pushed = pushOutOfBuildings(p.x, p.y, p.size);
          p.x = pushed.x;
          p.y = pushed.y;
        }

        // 타워 클릭 체크
        for (let i = 0; i < state.towers.length; i++) {
          const t = state.towers[i];
          if (t.hp <= 0) continue;
          const tapDist = Math.hypot(x - t.x, y - TOWER_Y);
          if (tapDist < 40) {
            // 플레이어가 타워 근처면 즉시 탑승
            const playerDist = Math.hypot(p.x - t.x, p.y - TOWER_Y);
            if (playerDist < 40) {
              climbTower(i);
            } else {
              // 멀리 있으면 타워까지 경로 이동 후 자동 탑승
              p.targetTower = i;
              const path = findPath(p.x, p.y, t.x, TOWER_Y);
              if (path.length > 0) {
                p.path = path;
                p.pathIdx = 0;
                p.moving = true;
              }
            }
            return;
          }
        }

        // 건물 탭 → 가까우면 진입
        for (const b of state.buildings) {
          if (!b.type) continue; // 베이스맵 건물은 진입 불가
          if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            const cx = b.x + b.w / 2;
            const cy = b.y + b.h / 2;
            const playerDist = Math.hypot(p.x - cx, p.y - cy);
            if (playerDist < Math.max(b.w, b.h) / 2 + 30) {
              enterInterior(b);
              return;
            }
            // 멀면 건물 앞까지 이동
            break;
          }
        }

        // 일반 경로 탐색 후 이동
        p.targetTower = -1;
        const path = findPath(p.x, p.y, x, y);
        if (path.length > 0) {
          p.path = path;
          p.pathIdx = 0;
          p.moving = true;
        }
      },
    },
    2 // 우선순위 2 (타워 3, 아이템 15보다 낮음)
  );
}

// ── initDescendButton: 내려가기 버튼 존 등록 ──

const DESCEND_BTN = { w: 80, h: 36 };

export function initDescendButton() {
  // 버튼 위치는 활성 타워 아래에 동적으로 결정되므로
  // 넓은 영역을 등록하고 탭 시 버튼 영역 내인지 체크
  registerZone(
    { x: 0, y: TOWER_Y + 20, w: W, h: 60 },
    {
      onTap(x, y) {
        if (state.screen !== 'playing') return;
        const p = state.player;
        if (p.onTower < 0) return;

        const tower = state.towers[p.onTower];
        const btnX = tower.x - DESCEND_BTN.w / 2;
        const btnY = TOWER_Y + 28;

        if (x >= btnX && x <= btnX + DESCEND_BTN.w &&
            y >= btnY && y <= btnY + DESCEND_BTN.h) {
          descendFromTower();
        }
      },
    },
    4 // 타워(3)보다 약간 높은 우선순위
  );
}

// ── updatePlayer: 이동, 충돌, 아이템 줍기, 좀비 접촉 피해 ──
export function updatePlayer(dt) {
  const p = state.player;

  // ── 타워 위에 있을 때 ──
  if (p.onTower >= 0) {
    const tower = state.towers[p.onTower];

    // 파괴된 타워에서 강제 하차
    if (tower.hp <= 0) {
      descendFromTower();
      return;
    }

    // 타워 위치에 동기화
    p.x = tower.x;
    p.y = TOWER_Y;
    return;
  }

  // ── 지상: 경로 따라 이동 ──
  if (p.moving && p.path.length > 0 && p.pathIdx < p.path.length) {
    const target = p.path[p.pathIdx];
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 3) {
      // 웨이포인트 도착 → 다음 웨이포인트
      p.pathIdx++;
      if (p.pathIdx >= p.path.length) {
        p.moving = false;
        p.path = [];
        p.pathIdx = 0;
      }
    } else {
      // 웨이포인트를 향해 이동
      const nx = dx / dist;
      const ny = dy / dist;
      // HP 비례 이동속도 (최소 30%)
      const hpRatio = Math.max(0.3, p.hp / p.maxHp);
      const fatigueMul = getFatigueSpeedMul();
      const moveSpeed = p.speed * hpRatio * fatigueMul;
      const step = moveSpeed * dt;

      let newX = p.x + nx * step;
      let newY = p.y + ny * step;

      // 건물 충돌 체크 — 슬라이딩 + 모서리 밀어내기
      if (!collidesWithBuilding(newX, newY, p.size)) {
        p.x = newX;
        p.y = newY;
      } else if (!collidesWithBuilding(newX, p.y, p.size)) {
        p.x = newX; // X만 이동 (벽을 따라 수평 슬라이딩)
      } else if (!collidesWithBuilding(p.x, newY, p.size)) {
        p.y = newY; // Y만 이동 (벽을 따라 수직 슬라이딩)
      } else {
        // 모서리에 완전히 걸림 → 건물에서 밀어내고 다음 웨이포인트로 건너뜀
        const pushed = pushOutOfBuildings(p.x, p.y, p.size);
        p.x = pushed.x;
        p.y = pushed.y;
        // 현재 웨이포인트 건너뛰기 (무한 멈춤 방지)
        if (p.pathIdx < p.path.length) p.pathIdx++;
      }
    }
  }

  // ── 타워 자동 탑승 (경로 이동 완료 시) ──
  if (p.targetTower >= 0 && !p.moving) {
    const t = state.towers[p.targetTower];
    if (t && t.hp > 0) {
      const tdist = Math.hypot(p.x - t.x, p.y - TOWER_Y);
      if (tdist < 40) {
        climbTower(p.targetTower);
      }
    }
    p.targetTower = -1;
  }

  // ── 이동 소음 (지상 이동 시) ──
  if (p.onTower < 0 && p.moving) {
    p.moveNoiseTimer -= dt;
    if (p.moveNoiseTimer <= 0) {
      p.moveNoiseTimer = 0.5;
      const noiseRange = p.shoeType === 'stealth' ? 0
                       : p.shoeType === 'silent' ? 60
                       : p.moveNoiseRange;
      if (noiseRange > 0) {
        emitSound(p.x, p.y, noiseRange, 0.3, 'footstep');
      }
    }
    // 신발 타이머 감소
    if (p.shoeTimer > 0) {
      p.shoeTimer -= dt;
      if (p.shoeTimer <= 0) {
        p.shoeType = null;
      }
    }
  }

  // ── 자동 아이템 줍기 (지상, 30px 이내) ──
  for (const item of state.items) {
    if (item.collected || !item.grounded) continue;
    const dist = Math.hypot(p.x - item.screenX, p.y - item.screenY);
    if (dist < 30) {
      item.pickedUp = true;
    }
  }

  // ── 좀비 접촉 피해 (2 HP/초) ──
  for (const z of state.zombies) {
    if (!z.alive) continue;
    const dist = Math.hypot(p.x - z.x, p.y - z.y);
    if (dist < p.size + z.size) {
      p.hp -= 2 * dt;
      p.hitFlash = 0.15;
      if (p.hp < 0) p.hp = 0;
    }
  }

  // ── hitFlash 감소 ──
  if (p.hitFlash > 0) {
    p.hitFlash -= dt;
    if (p.hitFlash < 0) p.hitFlash = 0;
  }

  // ── 건물 겹침 보정 (매 프레임 — 멈춰있어도 건물 안이면 밀어냄) ──
  if (collidesWithBuilding(p.x, p.y, p.size)) {
    const pushed = pushOutOfBuildings(p.x, p.y, p.size);
    p.x = pushed.x;
    p.y = pushed.y;
  }

  // ── 맵 경계 이동 체크 (전환 중이 아닐 때만) ──
  if (!world.transitioning && p.onTower < 0) {
    const edgeMargin = 2;
    if (p.x <= edgeMargin && canMove(world.currentCx, world.currentCy, 'left')) {
      startTransition('left');
      p.moving = false; p.path = []; p.pathIdx = 0;
      return;
    }
    if (p.x >= W - edgeMargin && canMove(world.currentCx, world.currentCy, 'right')) {
      startTransition('right');
      p.moving = false; p.path = []; p.pathIdx = 0;
      return;
    }
    if (p.y <= FIELD_TOP + edgeMargin && canMove(world.currentCx, world.currentCy, 'up')) {
      startTransition('up');
      p.moving = false; p.path = []; p.pathIdx = 0;
      return;
    }
    if (p.y >= FIELD_BOTTOM - edgeMargin && canMove(world.currentCx, world.currentCy, 'down')) {
      startTransition('down');
      p.moving = false; p.path = []; p.pathIdx = 0;
      return;
    }
  }

  // ── 경계 클램핑 ──
  p.x = Math.max(p.size, Math.min(W - p.size, p.x));
  p.y = Math.max(FIELD_TOP + p.size, Math.min(FIELD_BOTTOM - p.size, p.y));
}

// ── drawPlayer: 지상에 있을 때만 렌더링 ──
export function drawPlayer(ctx) {
  const p = state.player;

  // 타워 위면 그리지 않음 (tower.js에서 파란 점으로 표시)
  if (p.onTower >= 0) return;

  ctx.save();

  // 히트 플래시 (깜빡임)
  if (p.hitFlash > 0) {
    const blink = Math.sin(p.hitFlash * 40) > 0;
    if (blink) {
      ctx.globalAlpha = 0.4;
    }
  }

  const x = p.x;
  const y = p.y;
  const r = p.size * 0.7;

  // ── 몸통 (파란 원) ──
  ctx.fillStyle = '#4488ff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // 몸통 테두리
  ctx.strokeStyle = '#2266dd';
  ctx.lineWidth = 2;
  ctx.stroke();

  // ── 머리 (살색 원, 위쪽) ──
  const headR = r * 0.55;
  const headY = y - r - headR * 0.3;
  ctx.fillStyle = '#ffcc88';
  ctx.beginPath();
  ctx.arc(x, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  // 머리 테두리
  ctx.strokeStyle = '#2266dd';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();

  // ── HP 바 (피격 시에만 표시) ──
  if (p.hp < p.maxHp) {
    const barW = 30;
    const barH = 4;
    const barX = x - barW / 2;
    const barY = headY - headR - 6;
    const hpRatio = Math.max(0, p.hp / p.maxHp);

    // 배경
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, barW, barH);

    // HP
    ctx.fillStyle = hpRatio > 0.5 ? '#44ff44' : hpRatio > 0.25 ? '#ffff44' : '#ff4444';
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
  }

  // ── 경로 디버그 (이동 중일 때) ──
  if (p.moving && p.path.length > 1) {
    // 현재 위치부터 남은 경로만 그리기
    const remainingPath = [{ x: p.x, y: p.y }, ...p.path.slice(p.pathIdx)];
    drawPathDebug(ctx, remainingPath);
  }
}

// ── drawDescendButton: 타워 위일 때 하단에 내려가기 버튼 표시 ──
export function drawDescendButton(ctx) {
  const p = state.player;
  if (p.onTower < 0) return;

  const tower = state.towers[p.onTower];
  if (!tower || tower.hp <= 0) return;

  const btnW = DESCEND_BTN.w;
  const btnH = DESCEND_BTN.h;
  const btnX = tower.x - btnW / 2;
  const btnY = TOWER_Y + 28;
  const cornerR = 8;

  ctx.save();

  // ── 주황색 둥근 사각형 ──
  ctx.fillStyle = '#ee8822';
  ctx.beginPath();
  ctx.moveTo(btnX + cornerR, btnY);
  ctx.lineTo(btnX + btnW - cornerR, btnY);
  ctx.arcTo(btnX + btnW, btnY, btnX + btnW, btnY + cornerR, cornerR);
  ctx.lineTo(btnX + btnW, btnY + btnH - cornerR);
  ctx.arcTo(btnX + btnW, btnY + btnH, btnX + btnW - cornerR, btnY + btnH, cornerR);
  ctx.lineTo(btnX + cornerR, btnY + btnH);
  ctx.arcTo(btnX, btnY + btnH, btnX, btnY + btnH - cornerR, cornerR);
  ctx.lineTo(btnX, btnY + cornerR);
  ctx.arcTo(btnX, btnY, btnX + cornerR, btnY, cornerR);
  ctx.closePath();
  ctx.fill();

  // 테두리
  ctx.strokeStyle = '#cc6611';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ── 하얀 아래쪽 화살표 ──
  const arrowX = btnX + 16;
  const arrowCY = btnY + btnH / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(arrowX - 6, arrowCY - 4);
  ctx.lineTo(arrowX + 6, arrowCY - 4);
  ctx.lineTo(arrowX + 6, arrowCY + 1);
  ctx.lineTo(arrowX + 9, arrowCY + 1);
  ctx.lineTo(arrowX, arrowCY + 8);
  ctx.lineTo(arrowX - 9, arrowCY + 1);
  ctx.lineTo(arrowX - 6, arrowCY + 1);
  ctx.closePath();
  ctx.fill();

  // ── "내려가기" 레이블 ──
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('내려가기', btnX + btnW / 2 + 8, btnY + btnH / 2);

  ctx.restore();
}
