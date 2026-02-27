// ── 타워 렌더링 + 이동 ──
import { W, state, TOWER_Y, FIELD_BOTTOM } from './game.js?v=9';
import { registerZone } from './input.js?v=9';

const TOWER_SIZE = 24;
const TOWER_ZONE_H = FIELD_BOTTOM - TOWER_Y + TOWER_SIZE; // tower area height

// ── 타워 드래그 이동 ──
const GRAB_RADIUS = 50; // 타워 근처 터치해야 잡힘
let dragging = false;
let dragOffsetX = 0;    // 터치점과 타워 중심 간 오프셋

export function initTower() {
  registerZone(
    { x: 0, y: TOWER_Y - TOWER_SIZE, w: W, h: TOWER_ZONE_H + TOWER_SIZE },
    {
      onStart(x, y) {
        if (state.screen !== 'playing') return false;
        const dist = Math.hypot(x - state.tower.x, y - TOWER_Y);
        if (dist > GRAB_RADIUS) return false; // 타워 근처가 아니면 무시
        dragging = true;
        dragOffsetX = state.tower.x - x;
      },
      onMove(x, _y) {
        if (!dragging) return;
        state.tower.x = Math.max(TOWER_SIZE, Math.min(W - TOWER_SIZE, x + dragOffsetX));
      },
      onEnd() {
        dragging = false;
      },
    },
    3 // 필드보다 높은 우선순위
  );
}

export function drawTower(ctx) {
  const t = state.tower;
  const tx = t.x;
  const hpRatio = t.hp / t.maxHp;

  // Tower base (diamond shape)
  ctx.fillStyle = hpRatio > 0.5 ? '#ccaa44' : hpRatio > 0.25 ? '#aa8833' : '#884422';
  ctx.beginPath();
  ctx.moveTo(tx, TOWER_Y - TOWER_SIZE);       // top
  ctx.lineTo(tx + TOWER_SIZE, TOWER_Y);        // right
  ctx.lineTo(tx, TOWER_Y + TOWER_SIZE * 0.6);  // bottom
  ctx.lineTo(tx - TOWER_SIZE, TOWER_Y);        // left
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#ffdd66';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Turret direction indicator (small line showing aim angle)
  const barrelLen = 18;
  const dx = Math.cos(state.aimAngle);
  const dy = -Math.sin(state.aimAngle);
  ctx.strokeStyle = '#ff6644';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tx, TOWER_Y);
  ctx.lineTo(tx + dx * barrelLen, TOWER_Y + dy * barrelLen);
  ctx.stroke();

  // HP bar below tower
  const barW = 60;
  const barY = TOWER_Y + TOWER_SIZE * 0.6 + 4;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(tx - barW / 2, barY, barW, 5);
  ctx.fillStyle = hpRatio > 0.5 ? '#44ff44' : hpRatio > 0.25 ? '#ffff44' : '#ff4444';
  ctx.fillRect(tx - barW / 2, barY, barW * hpRatio, 5);

  // "TOWER" label
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TOWER', tx, barY + 14);
}
