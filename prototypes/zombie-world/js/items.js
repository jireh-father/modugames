// ── 아이템 드랍 & 줍기 시스템 (좀비 월드) ──
import { state, W, FIELD_TOP, FIELD_BOTTOM } from './game.js?v=8';
import { registerZone } from './input.js?v=8';
import { playItemPickup, playItemDrop } from './audio.js?v=8';
import { spawnParticles } from './particles.js?v=8';

// 자동 적용 아이템 (탄약류) - 줍자마자 바로 적용
const AUTO_APPLY_IDS = new Set([
  'bullet3', 'bullet6', 'arrow2', 'arrow5',
  'sniperAmmo', 'mgAmmo', 'bolt2',
]);

// 인벤토리 아이템 - 인벤토리에 저장 후 수동 사용
const INVENTORY_IDS = new Set([
  'brick', 'medkit', 'mine', 'molotov', 'bomb',
  'shield', 'speedBoost', 'freeze', 'chain', 'poison',
  'magUpgrade', 'goldBullet', 'explosiveArrow',
]);

// ── 아이템 정의 ──
const ITEM_TYPES = [
  // 탄약류
  { id: 'bullet3',       label: '탄환x3',     weight: 25, color: '#cca040' },
  { id: 'bullet6',       label: '탄환x6',     weight: 12, color: '#cca040' },
  { id: 'arrow2',        label: '화살x2',     weight: 25, color: '#c0a060' },
  { id: 'arrow5',        label: '화살x5',     weight: 12, color: '#c0a060' },
  { id: 'sniperAmmo',    label: '저격탄x2',   weight: 8,  color: '#66aaff' },
  { id: 'mgAmmo',        label: '기관총탄x30', weight: 8,  color: '#ff8844' },
  { id: 'bolt2',         label: '볼트x2',     weight: 8,  color: '#88ff88' },
  // 특수탄
  { id: 'magUpgrade',    label: '탄창+2',     weight: 4,  color: '#ffcc00' },
  { id: 'goldBullet',    label: '관통탄',     weight: 5,  color: '#ffcc00' },
  { id: 'explosiveArrow', label: '폭발화살',  weight: 5,  color: '#ff6600' },
  // 좀비 월드 전용
  { id: 'brick',         label: '벽돌',       weight: 20, color: '#aa7744' },
  { id: 'medkit',        label: 'HP+30',      weight: 10, color: '#ff4444' },
  { id: 'mine',          label: '지뢰',       weight: 8,  color: '#cc2222' },
  { id: 'molotov',       label: '화염병',     weight: 8,  color: '#ff6600' },
  { id: 'freeze',        label: '냉동탄x3',   weight: 6,  color: '#44ccff' },
  { id: 'chain',         label: '전기x3',     weight: 5,  color: '#ffff44' },
  { id: 'poison',        label: '독x3',       weight: 5,  color: '#44ff44' },
  { id: 'shield',        label: '방어막5초',   weight: 3,  color: '#4488ff' },
  { id: 'speedBoost',    label: '속도2배',    weight: 3,  color: '#ff44ff' },
  { id: 'bomb',          label: '폭탄',       weight: 2,  color: '#ff0000' },
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
 * 아이템 효과 적용 (자동 적용 아이템만 즉시 적용, 나머지는 인벤토리로)
 */
function applyItem(item) {
  if (INVENTORY_IDS.has(item.id)) {
    addToInventory(item);
    return;
  }

  // 자동 적용 아이템 (탄약류)
  switch (item.id) {
    case 'bullet3': state.pistol.reserveBullets += 3; break;
    case 'bullet6': state.pistol.reserveBullets += 6; break;
    case 'arrow2':  state.bow.arrows += 2; break;
    case 'arrow5':  state.bow.arrows += 5; break;
    case 'sniperAmmo': state.sniper.reserveRounds += 2; break;
    case 'mgAmmo':  state.mg.reserveAmmo += 30; break;
    case 'bolt2':   state.crossbow.bolts += 2; break;
  }
}

/**
 * 인벤토리에 아이템 추가
 */
function addToInventory(item) {
  const existing = state.inventory.find(i => i.id === item.id);
  if (existing) {
    existing.count++;
  } else {
    state.inventory.push({
      id: item.id,
      label: item.label,
      color: item.color,
      count: 1,
    });
  }
}

/**
 * 인벤토리 아이템 사용 (inventory.js에서 호출)
 * @param {string} itemId - 아이템 ID
 * @param {number} targetX - 타겟 X 좌표
 * @param {number} targetY - 타겟 Y 좌표
 * @returns {boolean} 사용 성공 여부
 */
export function useInventoryItem(itemId, targetX, targetY) {
  const inv = state.inventory.find(i => i.id === itemId);
  if (!inv || inv.count <= 0) return false;

  switch (itemId) {
    case 'brick': {
      // 가장 가까운 벽 구간에 +25
      const segCenters = [80, 205, 335, 460];
      let best = 0;
      for (let i = 1; i < 4; i++) {
        if (Math.abs(targetX - segCenters[i]) < Math.abs(targetX - segCenters[best])) best = i;
      }
      state.walls[best].hp = Math.min(state.walls[best].maxHp, state.walls[best].hp + 25);
      break;
    }
    case 'medkit':
      state.tower.hp = Math.min(state.tower.maxHp, state.tower.hp + 30);
      break;
    case 'mine':
      state.mines.push({
        x: Math.max(30, Math.min(510, targetX)),
        y: Math.max(100, Math.min(500, targetY)),
        radius: 60,
        damage: 5,
      });
      break;
    case 'molotov':
      state.hazards.push({
        type: 'fire',
        x: Math.max(30, Math.min(510, targetX)),
        y: Math.max(100, Math.min(500, targetY)),
        radius: 50,
        damage: 2,
        timer: 3,
      });
      break;
    case 'bomb':
      for (const z of state.zombies) {
        if (Math.hypot(z.x - targetX, z.y - targetY) < 80) {
          z.hp -= 5;
          z.hitFlash = 0.15;
        }
      }
      spawnParticles(targetX, targetY, 'explosion');
      break;
    case 'shield':
      state.buffs.shieldTimer = 5;
      break;
    case 'speedBoost':
      state.buffs.speedTimer = 10;
      break;
    case 'freeze':
      state.buffs.freezeShots += 3;
      break;
    case 'chain':
      state.buffs.chainShots += 3;
      break;
    case 'poison':
      state.buffs.poisonShots += 3;
      break;
    case 'magUpgrade':
      state.pistol.magazineMax = Math.min(12, state.pistol.magazineMax + 2);
      break;
    case 'goldBullet':
      state.pistol.specialBullets += 1;
      break;
    case 'explosiveArrow':
      state.bow.specialArrows += 1;
      break;
    default:
      return false;
  }

  inv.count--;
  if (inv.count <= 0) {
    state.inventory.splice(state.inventory.indexOf(inv), 1);
  }
  return true;
}

/**
 * 아이템 드랍 조건 체크 (좀비 킬 후 호출)
 * @param {string} zombieType - 좀비 종류
 * @param {number} combo - 현재 콤보 수
 * @param {number} [dropCount] - 강제 드랍 횟수 (빅원 등)
 */
export function tryDropItem(zombieType, combo, dropCount) {
  // 빅원: 3~5개 동시 드랍
  if (dropCount && dropCount > 1) {
    for (let i = 0; i < dropCount; i++) {
      dropSingleItem();
    }
    return;
  }

  let shouldDrop = false;

  // 1. 금색 좀비 → 확정
  if (zombieType === 'gold') shouldDrop = true;
  // 2. 빅원 킬 → 확정 (dropCount가 지정되지 않았을 때 폴백)
  else if (zombieType === 'bigone') shouldDrop = true;
  // 3. 콤보 보너스 (3, 5, 10, 15...)
  else if (combo > 0 && (combo === 3 || combo === 5 || combo >= 10 && combo % 5 === 0)) shouldDrop = true;
  // 4. 일반 확률 드랍 (15%)
  else if (Math.random() < 0.15) shouldDrop = true;

  if (!shouldDrop) return;
  dropSingleItem();
}

function dropSingleItem() {
  const item = pickWeightedItem();
  const screenX = W * 0.15 + Math.random() * W * 0.7;
  const screenY = FIELD_BOTTOM - 80 - Math.random() * 100;

  playItemDrop();
  state.items.push({
    ...item,
    screenX,
    screenY,
    vy: -60,
    gravity: 200,
    grounded: false,
    groundY: screenY + 40 + Math.random() * 30,
    life: 8,
    time: 0,
    collected: false,
  });
}

/**
 * 아이템 줍기 등록 (터치 영역)
 */
export function initItems() {
  registerZone(
    { x: 0, y: FIELD_TOP, w: W, h: FIELD_BOTTOM - FIELD_TOP },
    {
      onTap(x, y) {
        let closest = null;
        let closestDist = 40;

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
          applyItem(closest);
          playItemPickup();
          spawnParticles(closest.screenX, closest.screenY, 'scoreText', {
            text: closest.label,
            color: '#44ff44',
            fontSize: 14,
          });
        }
      },
    },
    2
  );
}

/**
 * 아이템 업데이트 (물리 + 수명)
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
    if (blinking) continue;

    // 아이템 배경 빛
    ctx.fillStyle = `rgba(255,255,100,0.15)`;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();

    // 아이콘 그리기
    drawItemIcon(ctx, item, x, y);

    // 레이블
    ctx.fillStyle = item.color || '#fff';
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

/**
 * 아이템별 아이콘 그리기
 */
export function drawItemIcon(ctx, item, x, y) {
  const id = item.id;
  const c = item.color || '#fff';

  if (id === 'magUpgrade') {
    // 금색 탄창
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(x - 6, y - 10, 12, 20);
    ctx.fillStyle = '#ff9900';
    ctx.fillRect(x - 6, y - 10, 12, 6);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('+', x, y + 4);
  } else if (id === 'sniperAmmo') {
    ctx.fillStyle = '#66aaff';
    ctx.fillRect(x - 3, y - 10, 6, 20);
    ctx.fillStyle = '#4488cc';
    ctx.fillRect(x - 3, y - 10, 6, 7);
  } else if (id === 'mgAmmo') {
    ctx.fillStyle = '#ff8844';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x - 8 + i * 6, y - 5, 4, 10);
    }
  } else if (id === 'bolt2') {
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
  } else if (id.startsWith('bullet') || id === 'goldBullet') {
    const special = id === 'goldBullet';
    ctx.fillStyle = special ? '#ffcc00' : '#cca040';
    ctx.fillRect(x - 4, y - 8, 8, 16);
    ctx.fillStyle = special ? '#ffaa00' : '#aa7020';
    ctx.fillRect(x - 4, y - 8, 8, 6);
  } else if (id.startsWith('arrow') || id === 'explosiveArrow') {
    const special = id === 'explosiveArrow';
    ctx.strokeStyle = special ? '#ff6600' : '#c0a060';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 12, y);
    ctx.lineTo(x + 12, y);
    ctx.stroke();
    ctx.fillStyle = special ? '#ff4400' : '#888';
    ctx.beginPath();
    ctx.moveTo(x - 15, y);
    ctx.lineTo(x - 9, y - 3);
    ctx.lineTo(x - 9, y + 3);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'brick') {
    // 벽돌 - 사각형
    ctx.fillStyle = c;
    ctx.fillRect(x - 8, y - 5, 16, 10);
    ctx.strokeStyle = '#886633';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 8, y - 5, 16, 10);
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x, y + 5);
    ctx.stroke();
  } else if (id === 'medkit') {
    // 의료 키트 - 빨간 십자
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - 8, y - 8, 16, 16);
    ctx.fillStyle = c;
    ctx.fillRect(x - 2, y - 7, 4, 14);
    ctx.fillRect(x - 7, y - 2, 14, 4);
  } else if (id === 'mine') {
    // 지뢰 - 원 + X
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff6666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4);
    ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4);
    ctx.stroke();
  } else if (id === 'molotov') {
    // 화염병 - 병 모양
    ctx.fillStyle = c;
    ctx.fillRect(x - 3, y - 8, 6, 12);
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.arc(x, y - 10, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'freeze') {
    // 냉동탄 - 눈꽃
    ctx.fillStyle = c;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('*', x, y + 5);
  } else if (id === 'chain') {
    // 전기 - 번개
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 8);
    ctx.lineTo(x + 2, y - 1);
    ctx.lineTo(x - 2, y + 1);
    ctx.lineTo(x + 3, y + 8);
    ctx.stroke();
  } else if (id === 'poison') {
    // 독 - 물방울
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#227722';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('~', x, y + 3);
  } else if (id === 'shield') {
    // 방어막 - 방패
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x + 7, y - 3);
    ctx.lineTo(x + 5, y + 6);
    ctx.lineTo(x, y + 8);
    ctx.lineTo(x - 5, y + 6);
    ctx.lineTo(x - 7, y - 3);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'speedBoost') {
    // 속도 부스트 - 화살표
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x + 6, y + 2);
    ctx.lineTo(x + 2, y + 2);
    ctx.lineTo(x + 2, y + 8);
    ctx.lineTo(x - 2, y + 8);
    ctx.lineTo(x - 2, y + 2);
    ctx.lineTo(x - 6, y + 2);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'bomb') {
    // 폭탄 - 원 + 심지
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y + 2, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffaa00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 3, y - 5);
    ctx.lineTo(x + 6, y - 9);
    ctx.stroke();
    // 불꽃
    ctx.fillStyle = '#ffdd00';
    ctx.beginPath();
    ctx.arc(x + 6, y - 10, 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 기본 (알 수 없는 아이템)
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}
