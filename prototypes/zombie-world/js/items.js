// ── 아이템 드랍 & 줍기 시스템 ──
import { state, W, RANGE_TOP, RANGE_BOTTOM } from './game.js?v=1';
import { worldToScreen } from './renderer.js?v=1';
import { registerZone } from './input.js?v=1';
import { playItemPickup, playCombo, playItemDrop } from './audio.js?v=1';
import { spawnParticles } from './particles.js?v=1';

// 아이템 정의
const ITEM_TYPES = [
  { id: 'bullet3', label: '탄환×3', weight: 25, apply: () => { state.pistol.reserveBullets += 3; } },
  { id: 'bullet6', label: '탄환×6', weight: 12, apply: () => { state.pistol.reserveBullets += 6; } },
  { id: 'arrow2', label: '화살×2', weight: 25, apply: () => { state.bow.arrows += 2; } },
  { id: 'arrow5', label: '화살×5', weight: 12, apply: () => { state.bow.arrows += 5; } },
  { id: 'goldBullet', label: '관통탄', weight: 5, apply: () => { state.pistol.specialBullets += 1; } },
  { id: 'explosiveArrow', label: '폭발화살', weight: 5, apply: () => { state.bow.specialArrows += 1; } },
  { id: 'magUpgrade', label: '탄창+2', weight: 4, apply: () => { state.pistol.magazineMax = Math.min(12, state.pistol.magazineMax + 2); } },
  { id: 'sniperAmmo', label: '저격탄×2', weight: 8, apply: () => { state.sniper.reserveRounds += 2; } },
  { id: 'mgAmmo', label: '기관총탄×30', weight: 8, apply: () => { state.mg.reserveAmmo += 30; } },
  { id: 'bolt2', label: '볼트×2', weight: 8, apply: () => { state.crossbow.bolts += 2; } },
];

function pickWeightedItem() {
  const totalWeight = ITEM_TYPES.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * totalWeight;
  for (const item of ITEM_TYPES) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return ITEM_TYPES[0];
}

/**
 * 아이템 드랍 조건 체크 (과녁 명중 후 호출)
 * @param {string} targetType - 과녁 종류
 * @param {number} combo - 현재 콤보 수
 */
export function tryDropItem(targetType, combo) {
  let shouldDrop = false;

  // 1. 금색 과녁 → 확정
  if (targetType === 'gold') shouldDrop = true;
  // 2. 보급품 → 확정
  else if (targetType === 'supply') shouldDrop = true;
  // 3. 콤보 보너스 (3, 5, 10, 15...)
  else if (combo > 0 && (combo === 3 || combo === 5 || combo % 5 === 0)) shouldDrop = true;
  // 4. 일반 확률 드랍 (15%)
  else if (Math.random() < 0.15) shouldDrop = true;

  if (!shouldDrop) return;

  const item = pickWeightedItem();
  const screenX = W * 0.15 + Math.random() * W * 0.7;
  const screenY = RANGE_BOTTOM - 80 - Math.random() * 100;

  playItemDrop();
  state.items.push({
    ...item,
    screenX,
    screenY,
    vy: -60, // 위로 튀었다가
    gravity: 200,
    grounded: false,
    groundY: screenY + 40 + Math.random() * 30,
    life: 8, // 8초 후 사라짐
    time: 0,
    collected: false,
  });
}

/**
 * 아이템 줍기 등록 (터치 영역)
 */
export function initItems() {
  registerZone(
    { x: 0, y: RANGE_TOP, w: W, h: RANGE_BOTTOM - RANGE_TOP },
    {
      onTap(x, y) {
        // 가장 가까운 아이템 줍기
        let closest = null;
        let closestDist = 40; // 최소 터치 범위

        for (const item of state.items) {
          if (item.collected) continue;
          const dist = Math.hypot(x - item.screenX, y - item.screenY);
          if (dist < closestDist) {
            closest = item;
            closestDist = dist;
          }
        }

        if (closest) {
          closest.collected = true;
          closest.apply();
          playItemPickup();
          spawnParticles(closest.screenX, closest.screenY, 'scoreText', {
            text: closest.label,
            color: '#44ff44',
            fontSize: 14,
          });
        }
      },
    },
    2 // 에이밍보다 높은 우선순위
  );
}

/**
 * 아이템 업데이트
 */
export function updateItems(dt) {
  for (let i = state.items.length - 1; i >= 0; i--) {
    const item = state.items[i];
    item.time += dt;

    // 물리
    if (!item.grounded) {
      item.vy += item.gravity * dt;
      item.screenY += item.vy * dt;
      if (item.screenY >= item.groundY) {
        item.screenY = item.groundY;
        item.grounded = true;
        item.vy = 0;
      }
    }

    // 수명
    item.life -= dt;
    if (item.life <= 0 || item.collected) {
      state.items.splice(i, 1);
    }
  }
}

/**
 * 아이템 렌더링
 */
export function drawItems(ctx) {
  for (const item of state.items) {
    if (item.collected) continue;

    const x = item.screenX;
    const y = item.screenY;
    const blinking = item.life < 2 && Math.sin(item.time * 10) > 0;

    if (blinking) continue; // 깜빡임 효과

    // 아이템 배경 빛
    ctx.fillStyle = 'rgba(255,255,100,0.15)';
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();

    // 아이콘
    const isAmmo = item.id.startsWith('bullet') || item.id === 'goldBullet';
    const isArrow = item.id.startsWith('arrow') || item.id === 'explosiveArrow';
    const isSpecial = item.id === 'goldBullet' || item.id === 'explosiveArrow' || item.id === 'magUpgrade';
    const isSniperAmmo = item.id === 'sniperAmmo';
    const isMGAmmo = item.id === 'mgAmmo';
    const isBolt = item.id === 'bolt2';

    if (item.id === 'magUpgrade') {
      // 탄창 업그레이드 - 금색 탄창 아이콘
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(x - 6, y - 10, 12, 20);
      ctx.fillStyle = '#ff9900';
      ctx.fillRect(x - 6, y - 10, 12, 6);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('+', x, y + 4);
    } else if (isSniperAmmo) {
      // 저격탄 - 긴 탄환
      ctx.fillStyle = '#66aaff';
      ctx.fillRect(x - 3, y - 10, 6, 20);
      ctx.fillStyle = '#4488cc';
      ctx.fillRect(x - 3, y - 10, 6, 7);
    } else if (isMGAmmo) {
      // 기관총탄 - 작은 탄 여러개
      ctx.fillStyle = '#ff8844';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x - 8 + i * 6, y - 5, 4, 10);
      }
    } else if (isBolt) {
      // 크로스보우 볼트
      ctx.strokeStyle = '#88ff88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y);
      ctx.stroke();
      ctx.fillStyle = '#44cc44';
      ctx.beginPath();
      ctx.moveTo(x - 13, y);
      ctx.lineTo(x - 7, y - 3);
      ctx.lineTo(x - 7, y + 3);
      ctx.closePath();
      ctx.fill();
    } else if (isAmmo) {
      ctx.fillStyle = isSpecial ? '#ffcc00' : '#cca040';
      ctx.fillRect(x - 4, y - 8, 8, 16);
      ctx.fillStyle = isSpecial ? '#ffaa00' : '#aa7020';
      ctx.fillRect(x - 4, y - 8, 8, 6);
    } else if (isArrow) {
      ctx.strokeStyle = isSpecial ? '#ff6600' : '#c0a060';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 12, y);
      ctx.lineTo(x + 12, y);
      ctx.stroke();
      ctx.fillStyle = isSpecial ? '#ff4400' : '#888';
      ctx.beginPath();
      ctx.moveTo(x - 15, y);
      ctx.lineTo(x - 9, y - 3);
      ctx.lineTo(x - 9, y + 3);
      ctx.closePath();
      ctx.fill();
    }

    // 레이블
    ctx.fillStyle = isSpecial ? '#ffcc00' : isSniperAmmo ? '#66aaff' : isMGAmmo ? '#ff8844' : isBolt ? '#88ff88' : '#fff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(item.label, x, y - 14);

    // 수명 바
    if (item.life < 4) {
      const barW = 20;
      const ratio = item.life / 8;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x - barW / 2, y + 12, barW, 3);
      ctx.fillStyle = item.life < 2 ? '#f44' : '#fa4';
      ctx.fillRect(x - barW / 2, y + 12, barW * ratio, 3);
    }
  }
}
