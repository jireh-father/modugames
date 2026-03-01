// ── 탑다운 2D 필드 렌더링 ──
import { W, H, WORLD_W, state, FIELD_TOP, FIELD_BOTTOM, TOWER_Y, WALL_Y, WEAPON_PROFILES, getFireOrigin } from './game.js?v=16';

/**
 * 필드 배경 그리기 – 폐허 도시 (Ruined City)
 */

// 잔해/파편 데이터 (결정적 시드 난수로 매 프레임 동일 위치)
const _rubbleRng = (() => {
  let s = 42;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
})();
const _rubbleData = [];
for (let i = 0; i < 600; i++) {
  _rubbleData.push({
    x: _rubbleRng() * 5400,
    y: 48 + _rubbleRng() * 592,
    r: 1 + _rubbleRng() * 2.5,
    brown: _rubbleRng() < 0.5,
    alpha: 0.08 + _rubbleRng() * 0.12,
  });
}

export function drawField(ctx) {
  const nd = state.nightDarkness;

  // ── 하늘: 어둡고 회색빛 (폐허 도시) ──
  const topR = Math.round(80 + (10 - 80) * nd);
  const topG = Math.round(90 + (10 - 90) * nd);
  const topB = Math.round(100 + (30 - 100) * nd);
  const botR = Math.round(60 + (5 - 60) * nd);
  const botG = Math.round(70 + (5 - 70) * nd);
  const botB = Math.round(80 + (20 - 80) * nd);

  const skyGrad = ctx.createLinearGradient(0, 0, 0, FIELD_TOP + 40);
  skyGrad.addColorStop(0, `rgb(${topR},${topG},${topB})`);
  skyGrad.addColorStop(1, `rgb(${botR},${botG},${botB})`);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, WORLD_W, FIELD_TOP + 40);

  // ── 지면: 어두운 아스팔트 ──
  const gv = Math.round(0x2a + (0x1a - 0x2a) * nd);
  ctx.fillStyle = `rgb(${gv},${gv},${gv})`;
  ctx.fillRect(0, FIELD_TOP, WORLD_W, FIELD_BOTTOM - FIELD_TOP);

  // ── 수평 도로 (WALL_Y - 200 부근) ──
  const roadY = WALL_Y - 200;
  const roadH = 40;
  const rv = Math.round(0x22 + (0x14 - 0x22) * nd);
  ctx.fillStyle = `rgb(${rv},${rv},${rv})`;
  ctx.fillRect(0, roadY - roadH / 2, WORLD_W, roadH);

  // 수평 도로 중앙 파선 (흰색)
  ctx.save();
  ctx.setLineDash([16, 12]);
  ctx.strokeStyle = `rgba(255,255,255,${0.35 - nd * 0.15})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, roadY);
  ctx.lineTo(WORLD_W, roadY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // ── 수직 도로 (타워 위치에 맞춰 분산) ──
  const vertXs = [900, 1800, 2700, 3600, 4500];
  const vertW = 30;
  for (const rx of vertXs) {
    ctx.fillStyle = `rgb(${rv},${rv},${rv})`;
    ctx.fillRect(rx - vertW / 2, FIELD_TOP, vertW, FIELD_BOTTOM - FIELD_TOP);

    // 수직 중앙 파선
    ctx.save();
    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = `rgba(255,255,255,${0.3 - nd * 0.12})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx, FIELD_TOP);
    ctx.lineTo(rx, FIELD_BOTTOM);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── 교차로 덮기 ──
  for (const rx of vertXs) {
    ctx.fillStyle = `rgb(${rv},${rv},${rv})`;
    ctx.fillRect(rx - vertW / 2, roadY - roadH / 2, vertW, roadH);
  }

  // ── 도로 경계선 (노란색) ──
  const ya = 0.3 - nd * 0.1;
  ctx.strokeStyle = `rgba(200,180,50,${ya})`;
  ctx.lineWidth = 1;
  // 수평
  for (const oy of [roadY - roadH / 2, roadY + roadH / 2]) {
    ctx.beginPath(); ctx.moveTo(0, oy); ctx.lineTo(WORLD_W, oy); ctx.stroke();
  }
  // 수직
  for (const rx of vertXs) {
    for (const ox of [rx - vertW / 2, rx + vertW / 2]) {
      ctx.beginPath(); ctx.moveTo(ox, FIELD_TOP); ctx.lineTo(ox, FIELD_BOTTOM); ctx.stroke();
    }
  }

  // ── 잔해/파편 ──
  for (const d of _rubbleData) {
    const a = d.alpha * (1 - nd * 0.4);
    ctx.fillStyle = d.brown
      ? `rgba(100,80,55,${a})`
      : `rgba(120,115,110,${a})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 격자선 (희미하게) ──
  ctx.strokeStyle = `rgba(255,255,255,${0.02 + nd * 0.01})`;
  ctx.lineWidth = 1;
  const gridSize = 40;
  // 카메라 범위 내 격자만 그리기 (성능 최적화)
  const camL = state.camera.x - 40;
  const camR = state.camera.x + W + 40;
  for (let x = Math.floor(camL / gridSize) * gridSize; x <= camR; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, FIELD_TOP); ctx.lineTo(x, FIELD_BOTTOM); ctx.stroke();
  }
  for (let y = FIELD_TOP; y <= FIELD_BOTTOM; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(camL, y); ctx.lineTo(camR, y); ctx.stroke();
  }

  // ── 스폰 영역 (y=48 ~ y=150): 빨간 틴트 ──
  ctx.fillStyle = `rgba(180,30,30,${0.04 + nd * 0.02})`;
  ctx.fillRect(0, FIELD_TOP, WORLD_W, 102);

  // ── 성벽 아래 ~ FIELD_BOTTOM: 어두운 내부 영역 ──
  ctx.fillStyle = `rgba(20,18,15,${0.2 + nd * 0.15})`;
  ctx.fillRect(0, WALL_Y + 20, WORLD_W, FIELD_BOTTOM - WALL_Y - 20);
}

/**
 * 발사선 그리기 (타워에서 조준 방향으로 점선)
 */
export function drawFiringLine(ctx) {
  if (state.currentWeapon === 'pouch') return;

  const fo = getFireOrigin();
  const tx = fo.x, ty = fo.y;
  const dx = Math.cos(state.aimAngle);
  const dy = -Math.sin(state.aimAngle);

  const wp = WEAPON_PROFILES[state.currentWeapon];
  const lineLen = wp ? Math.min(wp.range, 600) : 600;

  ctx.save();
  ctx.setLineDash([8, 8]);
  ctx.strokeStyle = 'rgba(255,80,80,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx + dx * lineLen, ty + dy * lineLen);
  ctx.stroke();
  ctx.setLineDash([]);

  // 사정거리 끝 표시
  const endX = tx + dx * lineLen;
  const endY = ty + dy * lineLen;
  ctx.fillStyle = 'rgba(255,80,80,0.6)';
  ctx.beginPath();
  ctx.arc(endX, endY, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * 소리 소스 시각화 (파동)
 */
export function drawSoundSources(ctx) {
  for (const s of state.soundSources) {
    const alpha = s.intensity * 0.25;
    const pulse = Math.sin(Date.now() / 200) * 0.08;
    ctx.strokeStyle = `rgba(255,255,100,${alpha + pulse})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.range * s.intensity, 0, Math.PI * 2);
    ctx.stroke();
    // 내부 파동
    ctx.strokeStyle = `rgba(255,200,50,${alpha * 1.5})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.range * s.intensity * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}
