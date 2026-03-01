// ── 세계지도 UI ──
import { W, H, state } from './game.js?v=20';
import { world, chunkKey } from './world.js?v=20';
import { registerZone } from './input.js?v=20';

const TILE_SIZE = 20; // 미니맵에서 한 청크 크기

export function initWorldMap() {
  // 지도 닫기 (전체 화면 탭)
  registerZone(
    { x: 0, y: 0, w: W, h: H },
    {
      onStart() {
        if (state.screen !== 'worldmap') return false;
      },
      onTap() {
        if (state.screen === 'worldmap') {
          state.screen = 'playing';
        }
      },
    },
    50 // pause 메뉴보다 낮되, 일반 zone보다 높게
  );
}

export function drawWorldMap(ctx) {
  // 반투명 배경
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, W, H);

  // 제목
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('WORLD MAP', W / 2, 40);

  // 지도 중심 = 현재 위치
  const centerX = W / 2;
  const centerY = H / 2;

  // 탐험한 청크 그리기
  for (const key of world.discovered) {
    const [cx, cy] = key.split(',').map(Number);
    const sx = centerX + (cx - world.currentCx) * TILE_SIZE;
    const sy = centerY + (cy - world.currentCy) * TILE_SIZE;

    // 화면 밖이면 스킵
    if (sx < -TILE_SIZE || sx > W + TILE_SIZE || sy < -TILE_SIZE || sy > H + TILE_SIZE) continue;

    // 타일 색상
    if (cx === 0 && cy === 0) {
      ctx.fillStyle = '#4488ff'; // 본부 = 파란색
    } else {
      ctx.fillStyle = '#446644'; // 탐험한 곳 = 녹색
    }
    ctx.fillRect(sx - TILE_SIZE / 2 + 1, sy - TILE_SIZE / 2 + 1,
                 TILE_SIZE - 2, TILE_SIZE - 2);

    // 좌표 텍스트 (타일이 충분히 크면)
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${cx},${cy}`, sx, sy + 3);
  }

  // 미탐험 인접 타일 표시 (어둡게)
  for (const key of world.discovered) {
    const [cx, cy] = key.split(',').map(Number);
    const adj = [
      [cx - 1, cy], [cx + 1, cy],
      [cx, cy - 1], [cx, cy + 1],
    ];
    for (const [ax, ay] of adj) {
      const aKey = chunkKey(ax, ay);
      if (world.discovered.has(aKey)) continue;
      const sx = centerX + (ax - world.currentCx) * TILE_SIZE;
      const sy = centerY + (ay - world.currentCy) * TILE_SIZE;
      if (sx < -TILE_SIZE || sx > W + TILE_SIZE || sy < -TILE_SIZE || sy > H + TILE_SIZE) continue;
      ctx.fillStyle = 'rgba(100,100,100,0.3)';
      ctx.fillRect(sx - TILE_SIZE / 2 + 1, sy - TILE_SIZE / 2 + 1,
                   TILE_SIZE - 2, TILE_SIZE - 2);
    }
  }

  // 현재 위치 (깜빡임)
  if (Math.sin(Date.now() / 300) > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // 안내
  ctx.fillStyle = '#888888';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TAP TO CLOSE', W / 2, H - 30);
}
