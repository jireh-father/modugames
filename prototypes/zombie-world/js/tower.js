// ── 타워 렌더링 ──
import { W, state, TOWER_Y } from './game.js?v=1';

const TOWER_X = W / 2;
const TOWER_SIZE = 24;

export function drawTower(ctx) {
  const t = state.tower;
  const hpRatio = t.hp / t.maxHp;

  // Tower base (diamond shape)
  ctx.fillStyle = hpRatio > 0.5 ? '#ccaa44' : hpRatio > 0.25 ? '#aa8833' : '#884422';
  ctx.beginPath();
  ctx.moveTo(TOWER_X, TOWER_Y - TOWER_SIZE);       // top
  ctx.lineTo(TOWER_X + TOWER_SIZE, TOWER_Y);        // right
  ctx.lineTo(TOWER_X, TOWER_Y + TOWER_SIZE * 0.6);  // bottom
  ctx.lineTo(TOWER_X - TOWER_SIZE, TOWER_Y);        // left
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
  ctx.moveTo(TOWER_X, TOWER_Y);
  ctx.lineTo(TOWER_X + dx * barrelLen, TOWER_Y + dy * barrelLen);
  ctx.stroke();

  // HP bar below tower
  const barW = 60;
  const barY = TOWER_Y + TOWER_SIZE * 0.6 + 4;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(TOWER_X - barW / 2, barY, barW, 5);
  ctx.fillStyle = hpRatio > 0.5 ? '#44ff44' : hpRatio > 0.25 ? '#ffff44' : '#ff4444';
  ctx.fillRect(TOWER_X - barW / 2, barY, barW * hpRatio, 5);

  // "TOWER" label
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TOWER', TOWER_X, barY + 14);
}
