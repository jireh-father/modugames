// ── 인벤토리 바 UI + 드래그 사용 시스템 ──
import { state, W, CONTROLS_TOP, SLOT_H, ITEM_BAR_H, FIELD_TOP, FIELD_BOTTOM, WALL_Y, TOWER_Y } from './game.js?v=5';
import { registerZone } from './input.js?v=5';
import { useInventoryItem } from './items.js?v=5';
import { drawItemIcon } from './items.js?v=5';
import { playItemPickup } from './audio.js?v=5';
import { spawnParticles } from './particles.js?v=5';

// ── 레이아웃 상수 ──
const BAR_Y = CONTROLS_TOP + SLOT_H;       // 아이템 바 시작 Y (무기 슬롯 바로 아래)
const BAR_H = ITEM_BAR_H;                  // 35px
const SLOT_W = 54;                          // 각 아이템 슬롯 너비
const MAX_SLOTS = Math.floor(W / SLOT_W);   // ~10

// 드래그 대상 아이템 (필드 위치 지정 필요)
const DRAG_ITEMS = new Set(['brick', 'medkit', 'mine', 'molotov', 'bomb']);

// ── 드래그 상태 ──
let dragItem = null;     // { id, label, color } 드래그 중인 아이템
let dragX = 0, dragY = 0;

/**
 * 인벤토리 바 입력 등록
 */
export function initInventory() {
  registerZone(
    { x: 0, y: BAR_Y, w: W, h: BAR_H },
    {
      onStart(x, y) {
        if (state.screen !== 'playing') return false;
        const slotIdx = Math.floor(x / SLOT_W);
        const inv = state.inventory;
        if (slotIdx < 0 || slotIdx >= inv.length) return false;

        const item = inv[slotIdx];
        if (!item || item.count <= 0) return false;

        if (DRAG_ITEMS.has(item.id)) {
          // 드래그 아이템: 드래그 시작
          dragItem = { id: item.id, label: item.label, color: item.color };
          dragX = x;
          dragY = y;
        } else {
          // 즉시 사용 아이템: 탭으로 바로 사용
          if (useInventoryItem(item.id, 0, 0)) {
            playItemPickup();
            spawnParticles(x, y, 'scoreText', {
              text: item.label,
              color: '#44ff44',
              fontSize: 12,
            });
          }
        }
      },
      onMove(x, y) {
        if (dragItem) {
          dragX = x;
          dragY = y;
        }
      },
      onEnd(x, y) {
        if (!dragItem) return;

        // 드래그를 위로 올려서 필드에 놓았는지 체크
        if (y < BAR_Y) {
          let used = false;

          switch (dragItem.id) {
            case 'brick':
              // 벽 영역 근처 (y 480~560)
              if (y >= 480 && y <= 560) {
                used = useInventoryItem('brick', x, y);
              }
              break;
            case 'medkit':
              // 타워 영역 근처 (y 560~620)
              if (y >= 560 && y <= 620) {
                used = useInventoryItem('medkit', x, y);
              }
              break;
            case 'mine':
            case 'molotov':
            case 'bomb':
              // 필드 영역 내
              if (y >= FIELD_TOP && y <= FIELD_BOTTOM) {
                used = useInventoryItem(dragItem.id, x, y);
              }
              break;
          }

          if (used) {
            playItemPickup();
            spawnParticles(x, y, 'scoreText', {
              text: dragItem.label,
              color: '#44ff44',
              fontSize: 12,
            });
          }
        }

        dragItem = null;
      },
    },
    8 // 무기 컨트롤(5~6)보다 높은 우선순위
  );
}

/**
 * 인벤토리 바 렌더링
 */
export function drawInventory(ctx) {
  if (state.screen !== 'playing') return;

  const inv = state.inventory;
  if (inv.length === 0 && !dragItem) return;

  // 바 배경
  ctx.fillStyle = '#0d0a08';
  ctx.fillRect(0, BAR_Y, W, BAR_H);

  // 상단 구분선
  ctx.strokeStyle = 'rgba(255,200,100,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, BAR_Y);
  ctx.lineTo(W, BAR_Y);
  ctx.stroke();

  // 아이템 슬롯
  const count = Math.min(inv.length, MAX_SLOTS);
  for (let i = 0; i < count; i++) {
    const item = inv[i];
    const sx = i * SLOT_W;
    const cy = BAR_Y + BAR_H / 2;

    // 슬롯 배경
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(sx + 1, BAR_Y + 1, SLOT_W - 2, BAR_H - 2);

    // 아이콘 (축소 버전)
    ctx.save();
    ctx.translate(sx + SLOT_W / 2, cy);
    ctx.scale(0.7, 0.7);
    drawItemIcon(ctx, item, 0, 0);
    ctx.restore();

    // 개수 배지
    if (item.count > 1) {
      const badgeX = sx + SLOT_W - 8;
      const badgeY = BAR_Y + 8;
      ctx.fillStyle = '#cc3333';
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${item.count}`, badgeX, badgeY + 3);
    }

    // 구분선
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, BAR_Y + 3);
      ctx.lineTo(sx, BAR_Y + BAR_H - 3);
      ctx.stroke();
    }
  }

  // 드래그 중인 아이템 (바 위에 고스트)
  if (dragItem) {
    ctx.globalAlpha = 0.7;
    ctx.save();
    ctx.translate(dragX, dragY);
    ctx.scale(0.8, 0.8);
    drawItemIcon(ctx, dragItem, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;

    // 아이템 라벨
    ctx.fillStyle = dragItem.color || '#fff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(dragItem.label, dragX, dragY - 16);
  }
}

/**
 * 드래그 오버레이 렌더링 (필드 위에 타겟 하이라이트)
 * main.js의 draw()에서 필드 렌더링 후 호출
 */
export function drawInventoryDragOverlay(ctx) {
  if (!dragItem || state.screen !== 'playing') return;

  ctx.save();

  switch (dragItem.id) {
    case 'brick': {
      // 가장 가까운 벽 구간 하이라이트
      const segCenters = [80, 205, 335, 460];
      const segWidths = 120;
      let best = 0;
      for (let i = 1; i < 4; i++) {
        if (Math.abs(dragX - segCenters[i]) < Math.abs(dragX - segCenters[best])) best = i;
      }
      const sx = segCenters[best] - segWidths / 2;
      ctx.strokeStyle = 'rgba(170,120,68,0.7)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(sx, WALL_Y - 20, segWidths, 40);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(170,120,68,0.15)';
      ctx.fillRect(sx, WALL_Y - 20, segWidths, 40);
      // 라벨
      ctx.fillStyle = 'rgba(170,120,68,0.8)';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('벽 수리', segCenters[best], WALL_Y - 25);
      break;
    }
    case 'medkit': {
      // 타워 영역 하이라이트
      ctx.strokeStyle = 'rgba(255,68,68,0.7)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(W / 2, TOWER_Y, 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,68,68,0.15)';
      ctx.beginPath();
      ctx.arc(W / 2, TOWER_Y, 40, 0, Math.PI * 2);
      ctx.fill();
      // 라벨
      ctx.fillStyle = 'rgba(255,68,68,0.8)';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('HP 회복', W / 2, TOWER_Y - 48);
      break;
    }
    case 'mine':
    case 'molotov':
    case 'bomb': {
      // 필드 위 타겟 크로스헤어
      if (dragY >= FIELD_TOP && dragY <= FIELD_BOTTOM) {
        const radius = dragItem.id === 'bomb' ? 80 : dragItem.id === 'mine' ? 60 : 50;
        ctx.strokeStyle = `rgba(255,100,50,0.6)`;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(dragX, dragY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,100,50,0.1)';
        ctx.beginPath();
        ctx.arc(dragX, dragY, radius, 0, Math.PI * 2);
        ctx.fill();
        // 크로스헤어
        ctx.strokeStyle = 'rgba(255,100,50,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(dragX - 15, dragY);
        ctx.lineTo(dragX + 15, dragY);
        ctx.moveTo(dragX, dragY - 15);
        ctx.lineTo(dragX, dragY + 15);
        ctx.stroke();
      }
      break;
    }
  }

  ctx.restore();
}
