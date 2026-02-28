// ── 타워 렌더링 (3개 고정 타워) ──
import { state, TOWER_Y } from './game.js?v=15';

const TOWER_SIZE = 24;

export function initTower() {
  // 타워는 고정이므로 입력 존 등록 불필요
}

export function drawTowers(ctx) {
  const towers = state.towers;

  for (let i = 0; i < towers.length; i++) {
    const t = towers[i];
    const tx = t.x;
    const hpRatio = t.hp / t.maxHp;
    const isActive = state.player.onTower === i;
    const destroyed = t.hp <= 0;

    if (destroyed) {
      // ── 파괴된 타워: 흐릿한 다이아몬드 ──
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#555';
      ctx.beginPath();
      ctx.moveTo(tx, TOWER_Y - TOWER_SIZE);
      ctx.lineTo(tx + TOWER_SIZE, TOWER_Y);
      ctx.lineTo(tx, TOWER_Y + TOWER_SIZE * 0.6);
      ctx.lineTo(tx - TOWER_SIZE, TOWER_Y);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // "파괴됨" 라벨
      ctx.fillStyle = 'rgba(255,80,80,0.7)';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('파괴됨', tx, TOWER_Y + TOWER_SIZE * 0.6 + 14);
      continue;
    }

    // ── 타워 다이아몬드 ──
    if (isActive) {
      // 활성 타워: 밝은 색상
      ctx.fillStyle = hpRatio > 0.5 ? '#ccaa44' : hpRatio > 0.25 ? '#aa8833' : '#884422';
    } else {
      // 비활성 타워: 어두운 색상
      ctx.fillStyle = hpRatio > 0.5 ? '#887733' : hpRatio > 0.25 ? '#665522' : '#553311';
    }

    ctx.beginPath();
    ctx.moveTo(tx, TOWER_Y - TOWER_SIZE);       // top
    ctx.lineTo(tx + TOWER_SIZE, TOWER_Y);        // right
    ctx.lineTo(tx, TOWER_Y + TOWER_SIZE * 0.6);  // bottom
    ctx.lineTo(tx - TOWER_SIZE, TOWER_Y);        // left
    ctx.closePath();
    ctx.fill();

    if (isActive) {
      // 활성 타워: 금색 테두리 3px
      ctx.strokeStyle = '#ffdd66';
      ctx.lineWidth = 3;
    } else {
      // 비활성 타워: 얇은 테두리 1px
      ctx.strokeStyle = '#998844';
      ctx.lineWidth = 1;
    }
    ctx.stroke();

    // ── 조준 방향 배럴 (활성 타워만) ──
    if (isActive) {
      const barrelLen = 18;
      const dx = Math.cos(state.aimAngle);
      const dy = -Math.sin(state.aimAngle);
      ctx.strokeStyle = '#ff6644';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tx, TOWER_Y);
      ctx.lineTo(tx + dx * barrelLen, TOWER_Y + dy * barrelLen);
      ctx.stroke();
    }

    // ── HP 바 (각 타워 아래, 50px) ──
    const barW = 50;
    const barY = TOWER_Y + TOWER_SIZE * 0.6 + 4;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(tx - barW / 2, barY, barW, 5);
    ctx.fillStyle = hpRatio > 0.5 ? '#44ff44' : hpRatio > 0.25 ? '#ffff44' : '#ff4444';
    ctx.fillRect(tx - barW / 2, barY, barW * hpRatio, 5);

    // ── 플레이어 표시 (활성 타워 위 파란 점) ──
    if (isActive) {
      ctx.fillStyle = '#44aaff';
      ctx.beginPath();
      ctx.arc(tx, TOWER_Y - TOWER_SIZE - 8, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
