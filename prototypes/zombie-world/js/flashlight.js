// ── 손전등 시스템 ──
import { state, W, CONTROLS_TOP, CONTROLS_BOTTOM, SLOT_H, ITEM_BAR_H } from './game.js?v=311';
import { registerZone } from './input.js?v=311';

const CTRL_Y = CONTROLS_TOP + SLOT_H + ITEM_BAR_H;
const CTRL_H = CONTROLS_BOTTOM - CTRL_Y;

let batteryDragActive = false;

/**
 * 손전등 입력 등록
 */
export function initFlashlight() {
  // ON/OFF 토글 버튼 (컨트롤 중앙)
  registerZone(
    { x: W / 2 - 40, y: CTRL_Y + 20, w: 80, h: 80 },
    {
      onTap() {
        if (state.screen !== 'playing') return;
        if (state.currentWeapon !== 'flashlight') return;
        if (state.flashlight.battery <= 0 && !state.flashlight.on) return;
        state.flashlight.on = !state.flashlight.on;
      },
    },
    8
  );

  // 배터리 드래그 영역 (인벤토리 → 배터리 게이지)
  registerZone(
    { x: 0, y: CTRL_Y, w: W, h: CTRL_H },
    {
      onStart(x, y) {
        if (state.currentWeapon !== 'flashlight') return false;
        // 인벤토리에 배터리가 있는지 확인
        const batteryItem = state.inventory.find(it => it.id === 'battery');
        if (!batteryItem || batteryItem.count <= 0) return false;
        batteryDragActive = true;
      },
      onMove() {},
      onEnd(x, y) {
        if (!batteryDragActive) return;
        batteryDragActive = false;
        // 배터리 게이지 영역에 놓았는지 확인 (좌측)
        if (x < W / 2 - 50 && y >= CTRL_Y && y <= CTRL_Y + CTRL_H) {
          const batteryItem = state.inventory.find(it => it.id === 'battery');
          if (batteryItem && batteryItem.count > 0) {
            batteryItem.count--;
            if (batteryItem.count <= 0) {
              state.inventory = state.inventory.filter(it => it.id !== 'battery');
            }
            state.flashlight.battery = state.flashlight.batteryMax;
          }
        }
      },
    },
    6
  );
}

/**
 * 손전등 업데이트
 */
export function updateFlashlight(dt) {
  if (!state.flashlight.on) return;
  state.flashlight.battery -= state.flashlight.drainRate * dt;
  if (state.flashlight.battery <= 0) {
    state.flashlight.battery = 0;
    state.flashlight.on = false;
  }
}

/**
 * 손전등 컨트롤 UI 그리기
 */
export function drawFlashlightControls(ctx) {
  if (state.currentWeapon !== 'flashlight') return;

  const cy = CTRL_Y;
  const ch = CTRL_H;

  // 배터리 게이지 (좌측)
  const gaugeX = 40;
  const gaugeY = cy + 20;
  const gaugeW = 30;
  const gaugeH = ch - 40;
  const batteryRatio = state.flashlight.battery / state.flashlight.batteryMax;

  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(gaugeX, gaugeY, gaugeW, gaugeH);
  ctx.fillStyle = batteryRatio > 0.3 ? '#44ff44' : batteryRatio > 0.1 ? '#ffff44' : '#ff4444';
  const fillH = gaugeH * batteryRatio;
  ctx.fillRect(gaugeX, gaugeY + gaugeH - fillH, gaugeW, fillH);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.strokeRect(gaugeX, gaugeY, gaugeW, gaugeH);

  // 배터리 탑 (양극)
  ctx.fillStyle = '#888';
  ctx.fillRect(gaugeX + 10, gaugeY - 5, 10, 5);

  // 배터리 텍스트
  ctx.fillStyle = '#aaa';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('배터리', gaugeX + gaugeW / 2, gaugeY + gaugeH + 12);
  ctx.fillText(`${Math.ceil(batteryRatio * 100)}%`, gaugeX + gaugeW / 2, gaugeY - 10);

  // ON/OFF 버튼 (중앙)
  const btnX = W / 2;
  const btnY = cy + ch / 2;
  const btnR = 30;

  ctx.beginPath();
  ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2);
  ctx.fillStyle = state.flashlight.on ? 'rgba(255,255,100,0.4)' : 'rgba(100,100,100,0.3)';
  ctx.fill();
  ctx.strokeStyle = state.flashlight.on ? '#ffee88' : '#666';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 전원 아이콘
  ctx.strokeStyle = state.flashlight.on ? '#ffee88' : '#888';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(btnX, btnY + 2, 12, -Math.PI * 0.8, -Math.PI * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(btnX, btnY - 14);
  ctx.lineTo(btnX, btnY - 4);
  ctx.stroke();

  ctx.fillStyle = '#ccc';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(state.flashlight.on ? 'ON' : 'OFF', btnX, btnY + btnR + 14);

  // 인벤토리 배터리 안내 (우측)
  const batteryItem = state.inventory.find(it => it.id === 'battery');
  const batteryCount = batteryItem ? batteryItem.count : 0;
  ctx.fillStyle = '#888';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`🔋 x${batteryCount}`, W - 60, cy + ch / 2);
  ctx.fillStyle = '#666';
  ctx.font = '8px monospace';
  ctx.fillText('드래그→게이지', W - 60, cy + ch / 2 + 14);
}
