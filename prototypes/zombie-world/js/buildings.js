// ── 건물 (폐허 도시 장애물) ──
import { W, state, FIELD_TOP, WALL_Y, TOWER_POSITIONS } from './game.js?v=15';

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

// ── 건물 렌더링 ──

/**
 * 모든 건물을 캔버스에 그린다.
 * - 일반: 회색(#5a5a5a) + 창문
 * - 폐허: 갈색(#4a3a2a) + 균열 + 부서진 모서리
 */
export function drawBuildings(ctx) {
  for (const b of state.buildings) {
    ctx.save();

    if (b.ruined) {
      // ── 폐허 건물 ──
      ctx.fillStyle = '#4a3a2a';
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // 부서진 모서리 (오른쪽 상단)
      ctx.fillStyle = '#3a2a1a';
      const chipW = 6 + Math.floor(b.w * 0.15);
      const chipH = 6 + Math.floor(b.h * 0.15);
      ctx.beginPath();
      ctx.moveTo(b.x + b.w - chipW, b.y);
      ctx.lineTo(b.x + b.w, b.y);
      ctx.lineTo(b.x + b.w, b.y + chipH);
      ctx.closePath();
      ctx.fill();

      // 부서진 모서리를 배경색으로 지우기 (투명 효과)
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // 균열 그리기
      ctx.strokeStyle = '#2a1a0a';
      ctx.lineWidth = 1.5;
      // 균열 1: 대각선
      ctx.beginPath();
      ctx.moveTo(b.x + b.w * 0.2, b.y);
      ctx.lineTo(b.x + b.w * 0.35, b.y + b.h * 0.4);
      ctx.lineTo(b.x + b.w * 0.25, b.y + b.h * 0.7);
      ctx.stroke();
      // 균열 2: 수평
      ctx.beginPath();
      ctx.moveTo(b.x + b.w * 0.5, b.y + b.h * 0.3);
      ctx.lineTo(b.x + b.w * 0.8, b.y + b.h * 0.35);
      ctx.stroke();

      // 어두운 테두리
      ctx.strokeStyle = '#2a1a0a';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x, b.y, b.w, b.h);

    } else {
      // ── 일반 건물 ──
      ctx.fillStyle = '#5a5a5a';
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // 창문 그리기
      const winSize = 6;
      const winGap = 14;
      ctx.fillStyle = '#8ab4d6';
      const cols = Math.floor((b.w - 8) / winGap);
      const rows = Math.floor((b.h - 8) / winGap);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = b.x + 6 + c * winGap;
          const wy = b.y + 6 + r * winGap;
          ctx.fillRect(wx, wy, winSize, winSize);
        }
      }

      // 어두운 테두리
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }

    ctx.restore();
  }
}
