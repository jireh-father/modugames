// ── 건물 (폐허 도시 장애물) ──
import { W, state, FIELD_TOP, WALL_Y, TOWER_POSITIONS, isBaseMap } from './game.js?v=20';

// ── 건물 유형별 비주얼 ──
const BUILDING_VISUALS = {
  house:       { fill: '#5a5a5a', accent: '#8ab4d6', icon: 'H' },
  apartment:   { fill: '#5a5a6a', accent: '#8ab4d6', icon: 'A' },
  convenience: { fill: '#5a6a5a', accent: '#88dd88', icon: '$' },
  supermarket: { fill: '#5a6a5a', accent: '#66cc66', icon: 'SM' },
  gunshop:     { fill: '#6a5a5a', accent: '#dd8888', icon: 'G' },
  police:      { fill: '#4a4a6a', accent: '#8888dd', icon: 'P' },
  hospital:    { fill: '#5a5a5a', accent: '#dd4444', icon: '+' },
  pharmacy:    { fill: '#5a6a5a', accent: '#44dd44', icon: 'Rx' },
  warehouse:   { fill: '#5a5a4a', accent: '#aa9966', icon: 'W' },
  factory:     { fill: '#4a4a4a', accent: '#aa8844', icon: 'F' },
  gasstation:  { fill: '#5a5a5a', accent: '#dd8844', icon: 'GS' },
  school:      { fill: '#5a5a6a', accent: '#88aadd', icon: 'Sc' },
  church:      { fill: '#6a6a6a', accent: '#ddddaa', icon: 'Ch' },
  library:     { fill: '#5a5a4a', accent: '#bbaa88', icon: 'Li' },
  firestation: { fill: '#6a4a4a', accent: '#ff6644', icon: 'FS' },
  restaurant:  { fill: '#5a4a4a', accent: '#ddaa44', icon: 'R' },
  garage:      { fill: '#4a4a4a', accent: '#888888', icon: 'Ga' },
  military:    { fill: '#3a4a3a', accent: '#669966', icon: 'M' },
  ruin:        { fill: '#4a3a2a', accent: '#6a5a3a', icon: '' },
  bunker:      { fill: '#3a3a3a', accent: '#666666', icon: 'B' },
};

// ── 건물 생성 ──

/**
 * 필드 영역에 8-12개의 랜덤 건물(장애물)을 생성한다.
 * 타워 근처, 벽 근처, 스폰 영역은 피한다.
 * 결과는 state.buildings 에 저장된다.
 */
export function generateBuildings() {
  const buildings = [];
  const count = 8 + Math.floor(Math.random() * 5); // 8-12

  const minY = FIELD_TOP + 40;   // 스폰 영역 아래
  const maxY = WALL_Y - 60;      // 벽 위쪽 여유

  const MIN_GAP = 25;
  const MAX_ATTEMPTS = 200;

  for (let i = 0; i < count; i++) {
    let placed = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const w = 40 + Math.floor(Math.random() * 81);  // 40-120
      const h = 40 + Math.floor(Math.random() * 41);  // 40-80
      const x = Math.floor(Math.random() * (W - w));
      const y = minY + Math.floor(Math.random() * (maxY - minY - h));

      // 타워 위치 회피 (±50px)
      let tooCloseToTower = false;
      for (const tp of TOWER_POSITIONS) {
        if (x < tp.x + 50 && x + w > tp.x - 50) {
          tooCloseToTower = true;
          break;
        }
      }
      if (tooCloseToTower) continue;

      // 기존 건물과 최소 간격 확인
      let overlaps = false;
      for (const b of buildings) {
        if (
          x < b.x + b.w + MIN_GAP &&
          x + w > b.x - MIN_GAP &&
          y < b.y + b.h + MIN_GAP &&
          y + h > b.y - MIN_GAP
        ) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      buildings.push({
        x, y, w, h,
        ruined: Math.random() < 0.3,
      });
      placed = true;
      break;
    }
    // 배치 실패 시 건너뜀 (맵 공간 부족)
    if (!placed) break;
  }

  state.buildings = buildings;
}

// ── 청크 건물 로드 ──
export function loadChunkBuildings(chunk) {
  state.buildings = chunk.buildings.map(b => ({ ...b }));
}

// ── 충돌 감지 ──

/**
 * 점 (x, y) 가 건물 내부에 있는지 확인 (margin 만큼 확장).
 */
export function isInsideBuilding(x, y, margin = 0) {
  for (const b of state.buildings) {
    if (
      x >= b.x - margin &&
      x <= b.x + b.w + margin &&
      y >= b.y - margin &&
      y <= b.y + b.h + margin
    ) {
      return true;
    }
  }
  return false;
}

/**
 * 원(x, y, size=반지름)과 건물 사각형의 충돌 검사.
 */
export function collidesWithBuilding(x, y, size) {
  for (const b of state.buildings) {
    // 원의 중심에서 사각형까지 가장 가까운 점 구하기
    const closestX = Math.max(b.x, Math.min(x, b.x + b.w));
    const closestY = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - closestX;
    const dy = y - closestY;
    if (dx * dx + dy * dy <= size * size) {
      return true;
    }
  }
  return false;
}

/**
 * 건물과 겹쳐 있으면 밀어내어 겹치지 않는 좌표를 반환.
 * 겹치지 않으면 원래 좌표 그대로 반환.
 */
export function pushOutOfBuildings(x, y, size) {
  for (let iter = 0; iter < 3; iter++) { // 여러 건물 겹침 시 반복 밀어내기
    let pushed = false;
    for (const b of state.buildings) {
      const closestX = Math.max(b.x, Math.min(x, b.x + b.w));
      const closestY = Math.max(b.y, Math.min(y, b.y + b.h));
      let dx = x - closestX;
      let dy = y - closestY;
      const distSq = dx * dx + dy * dy;
      if (distSq < size * size && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const push = size - dist + 2;
        x += (dx / dist) * push;
        y += (dy / dist) * push;
        pushed = true;
      } else if (distSq === 0) {
        // 건물 내부에 있을 때 → 가장 짧은 방향 2개를 모두 적용
        const toLeft = x - b.x;
        const toRight = (b.x + b.w) - x;
        const toTop = y - b.y;
        const toBottom = (b.y + b.h) - y;
        const minH = Math.min(toLeft, toRight);
        const minV = Math.min(toTop, toBottom);
        // 더 짧은 축 우선, 모서리면 양방향 모두 밀어냄
        if (minH <= minV) {
          x = (toLeft < toRight) ? b.x - size - 1 : b.x + b.w + size + 1;
          if (minV < size) y = (toTop < toBottom) ? b.y - size - 1 : b.y + b.h + size + 1;
        } else {
          y = (toTop < toBottom) ? b.y - size - 1 : b.y + b.h + size + 1;
          if (minH < size) x = (toLeft < toRight) ? b.x - size - 1 : b.x + b.w + size + 1;
        }
        pushed = true;
      }
    }
    if (!pushed) break;
  }
  return { x, y };
}

// ── 건물 렌더링 ──

/**
 * 모든 건물을 캔버스에 그린다.
 * 유형별 색상/아이콘, 폐허 오버레이, 약탈 시 어둡게 처리.
 * 진입 가능 건물은 하단에 입구 표시.
 */
export function drawBuildings(ctx) {
  const p = state.buildings.length > 0 ? state.player : null;
  for (const b of state.buildings) {
    ctx.save();

    const vis = b.type ? BUILDING_VISUALS[b.type] : null;
    const fillColor = vis ? vis.fill : '#5a5a5a';
    const accentColor = vis ? vis.accent : '#8ab4d6';
    const icon = vis ? vis.icon : '';
    const lootDim = b.looted ? 0.5 : 1.0;

    if (lootDim < 1) ctx.globalAlpha = lootDim;

    // ── 건물 본체 ──
    ctx.fillStyle = fillColor;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    // ── 지붕 악센트 (상단 3px 스트립) ──
    ctx.fillStyle = accentColor;
    ctx.fillRect(b.x, b.y, b.w, 3);

    // ── 창문 ──
    const winSize = 6;
    const winGap = 14;
    ctx.fillStyle = accentColor;
    const cols = Math.floor((b.w - 8) / winGap);
    const rows = Math.floor((b.h - 12) / winGap);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillRect(b.x + 6 + c * winGap, b.y + 8 + r * winGap, winSize, winSize);
      }
    }

    // ── 유형 라벨 (건물 중앙) ──
    if (icon) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, b.x + b.w / 2, b.y + b.h / 2);
    }

    // ── 테두리 ──
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    // ── 입구 표시 (유형이 있는 건물만, 베이스 맵 제외) ──
    if (b.type && !isBaseMap()) {
      const doorW = 10;
      const doorH = 14;
      const doorX = b.x + b.w / 2 - doorW / 2;
      const doorY = b.y + b.h - doorH;

      // 문 배경 (어두운 사각형)
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(doorX, doorY, doorW, doorH);

      // 문 테두리
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(doorX, doorY, doorW, doorH);

      // 문 손잡이
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(doorX + doorW - 3, doorY + doorH / 2, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // 플레이어가 가까이 있으면 'ENTER' 힌트 표시
      if (p) {
        const dx = p.x - (b.x + b.w / 2);
        const dy = p.y - (b.y + b.h);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 60) {
          const hintAlpha = Math.max(0, 1 - dist / 60);
          ctx.fillStyle = `rgba(255,220,100,${hintAlpha * 0.9})`;
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText('ENTER', b.x + b.w / 2, b.y + b.h - doorH - 2);
        }
      }
    }

    // ── 폐허 오버레이 ──
    if (b.ruined) {
      // 부서진 모서리
      ctx.fillStyle = '#3a2a1a';
      const chipW = 6 + Math.floor(b.w * 0.15);
      const chipH = 6 + Math.floor(b.h * 0.15);
      ctx.beginPath();
      ctx.moveTo(b.x + b.w - chipW, b.y);
      ctx.lineTo(b.x + b.w, b.y);
      ctx.lineTo(b.x + b.w, b.y + chipH);
      ctx.closePath();
      ctx.fill();

      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // 균열
      ctx.globalAlpha = lootDim;
      ctx.strokeStyle = '#2a1a0a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(b.x + b.w * 0.2, b.y);
      ctx.lineTo(b.x + b.w * 0.35, b.y + b.h * 0.4);
      ctx.lineTo(b.x + b.w * 0.25, b.y + b.h * 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(b.x + b.w * 0.5, b.y + b.h * 0.3);
      ctx.lineTo(b.x + b.w * 0.8, b.y + b.h * 0.35);
      ctx.stroke();
    }

    ctx.restore();
  }
}
