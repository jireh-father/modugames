// ── 인벤토리 바 UI + 드래그 사용 시스템 ──
import { state, W, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H, ITEM_BAR_H, FIELD_TOP, FIELD_BOTTOM, WALL_Y, TOWER_Y } from './game.js?v=12';
import { registerZone } from './input.js?v=12';
import { useInventoryItem } from './items.js?v=12';
import { drawItemIcon } from './items.js?v=12';
import { playItemPickup } from './audio.js?v=12';
import { spawnParticles } from './particles.js?v=12';

// ── 레이아웃 상수 ──
const BAR_Y = CONTROLS_TOP + SLOT_H;       // 아이템 바 시작 Y (무기 슬롯 바로 아래)
const BAR_H = ITEM_BAR_H;                  // 35px
const SLOT_W = 54;                          // 각 아이템 슬롯 너비
const MAX_SLOTS = Math.floor(W / SLOT_W);   // ~10

// 드래그 대상 아이템 (필드 위치 지정 필요)
const DRAG_ITEMS = new Set(['brick', 'medkit', 'mine', 'molotov', 'bomb', 'toy', 'firecracker', 'radio']);

// ── 드래그 상태 ──
let dragItem = null;     // { id, label, color } 드래그 중인 아이템
let dragX = 0, dragY = 0;

/**
 * 인벤토리 바 입력 등록
 */
export function initInventory() {
  // 인벤토리 바 (일반 모드) + 주머니 그리드 전체 영역
  registerZone(
    { x: 0, y: BAR_Y, w: W, h: CONTROLS_BOTTOM - BAR_Y },
    {
      onStart(x, y) {
        if (state.screen !== 'playing') return false;

        const isPouch = state.currentWeapon === 'pouch';
        const inv = state.inventory;

        if (isPouch) {
          // 주머니 그리드에서 아이템 선택
          const cols = 2;
          const cellW = W / cols;
          const cellH = 42;
          const startY = BAR_Y + 4;

          const col = Math.floor(x / cellW);
          const row = Math.floor((y - startY) / cellH);
          const idx = row * cols + col;

          if (idx < 0 || idx >= inv.length) return false;
          const item = inv[idx];
          if (!item || item.count <= 0) return false;

          if (DRAG_ITEMS.has(item.id)) {
            dragItem = { id: item.id, label: item.label, color: item.color };
            dragX = x;
            dragY = y;
          } else {
            if (useInventoryItem(item.id, 0, 0)) {
              playItemPickup();
              spawnParticles(x, y, 'scoreText', {
                text: item.label,
                color: '#44ff44',
                fontSize: 12,
              });
            }
          }
        } else {
          // 일반 바 모드 (BAR_H 높이만)
          if (y > BAR_Y + BAR_H) return false;

          const slotIdx = Math.floor(x / SLOT_W);
          if (slotIdx < 0 || slotIdx >= inv.length) return false;

          const item = inv[slotIdx];
          if (!item || item.count <= 0) return false;

          if (DRAG_ITEMS.has(item.id)) {
            dragItem = { id: item.id, label: item.label, color: item.color };
            dragX = x;
            dragY = y;
          } else {
            if (useInventoryItem(item.id, 0, 0)) {
              playItemPickup();
              spawnParticles(x, y, 'scoreText', {
                text: item.label,
                color: '#44ff44',
                fontSize: 12,
              });
            }
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
              if (y >= 480 && y <= 560) {
                used = useInventoryItem('brick', x, y);
              }
              break;
            case 'medkit':
              if (y >= 560 && y <= 620) {
                used = useInventoryItem('medkit', x, y);
              }
              break;
            case 'mine':
            case 'molotov':
            case 'bomb':
            case 'toy':
            case 'firecracker':
            case 'radio':
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
    8
  );
}

/**
 * 인벤토리 바 렌더링 (일반 모드) + 주머니 그리드 (pouch 모드)
 */
export function drawInventory(ctx) {
  if (state.screen !== 'playing') return;

  const inv = state.inventory;
  const isPouch = state.currentWeapon === 'pouch';

  if (isPouch) {
    drawPouchGrid(ctx, inv);
  } else {
    if (inv.length === 0 && !dragItem) return;
    drawInventoryBar(ctx, inv);
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

function drawInventoryBar(ctx, inv) {
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
}

/**
 * 주머니 그리드 UI (2열 레이아웃, 아이템 바 + 무기 컨트롤 영역 사용)
 */
function drawPouchGrid(ctx, inv) {
  const gridY = BAR_Y;
  const gridH = CONTROLS_BOTTOM - BAR_Y;

  // 배경
  ctx.fillStyle = '#0d0a08';
  ctx.fillRect(0, gridY, W, gridH);

  // 상단 구분선
  ctx.strokeStyle = 'rgba(180,160,140,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, gridY);
  ctx.lineTo(W, gridY);
  ctx.stroke();

  if (inv.length === 0) {
    ctx.fillStyle = '#555';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('아이템 없음', W / 2, gridY + gridH / 2);
    return;
  }

  // 2열 그리드
  const cols = 2;
  const cellW = W / cols;
  const cellH = 42;
  const startY = gridY + 4;

  for (let i = 0; i < inv.length; i++) {
    const item = inv[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * cellW;
    const cy = startY + row * cellH;

    // 셀이 보이는 영역 밖이면 스킵
    if (cy + cellH > CONTROLS_BOTTOM) break;

    // 슬롯 배경
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(cx + 2, cy + 1, cellW - 4, cellH - 2);

    // 아이콘
    const iconX = cx + 22;
    const iconY = cy + cellH / 2;
    ctx.save();
    ctx.translate(iconX, iconY);
    ctx.scale(0.8, 0.8);
    drawItemIcon(ctx, item, 0, 0);
    ctx.restore();

    // 이름 + 수량
    ctx.fillStyle = item.color || '#ccc';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(item.label, cx + 42, cy + cellH / 2 - 2);

    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.fillText(`x${item.count}`, cx + 42, cy + cellH / 2 + 12);

    // 세로 구분선 (왼쪽 열의 오른쪽)
    if (col === 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + cellW, cy);
      ctx.lineTo(cx + cellW, cy + cellH);
      ctx.stroke();
    }

    // 가로 구분선
    if (row > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 4, cy);
      ctx.lineTo(cx + cellW - 4, cy);
      ctx.stroke();
    }
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
      const segCenters = [67, 202, 337, 472];
      const segWidths = 135;
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
      const towerX = state.tower.x;
      ctx.strokeStyle = 'rgba(255,68,68,0.7)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(towerX, TOWER_Y, 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,68,68,0.15)';
      ctx.beginPath();
      ctx.arc(towerX, TOWER_Y, 40, 0, Math.PI * 2);
      ctx.fill();
      // 라벨
      ctx.fillStyle = 'rgba(255,68,68,0.8)';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('HP 회복', towerX, TOWER_Y - 48);
      break;
    }
    case 'mine':
    case 'molotov':
    case 'bomb':
    case 'toy':
    case 'firecracker':
    case 'radio': {
      // 필드 위 타겟 크로스헤어
      if (dragY >= FIELD_TOP && dragY <= FIELD_BOTTOM) {
        const radiusMap = { bomb: 80, mine: 60, molotov: 50, toy: 75, firecracker: 150, radio: 100 };
        const radius = radiusMap[dragItem.id] || 50;
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
