// ── 탑다운 2D 필드 렌더링 ──
import { W, H, state, FIELD_TOP, FIELD_BOTTOM, TOWER_Y, WALL_Y, WEAPON_PROFILES } from './game.js?v=11';

/**
 * 필드 배경 그리기 (탑다운 2D)
 */
export function drawField(ctx) {
  // 하늘 그라데이션 (HUD 위 영역은 HUD가 덮으므로 FIELD_TOP부터)
  // 낮: 밝은 파랑, 밤: 어두운 남색 (nightDarkness로 보간)
  const nd = state.nightDarkness;
  const dayR = 100, dayG = 180, dayB = 240;
  const nightR = 10, nightG = 10, nightB = 40;
  const skyR = Math.round(dayR + (nightR - dayR) * nd);
  const skyG = Math.round(dayG + (nightG - dayG) * nd);
  const skyB = Math.round(dayB + (nightB - dayB) * nd);

  const skyGrad = ctx.createLinearGradient(0, 0, 0, FIELD_TOP + 40);
  skyGrad.addColorStop(0, `rgb(${skyR},${skyG},${skyB})`);
  skyGrad.addColorStop(1, `rgb(${Math.round(skyR * 0.7)},${Math.round(skyG * 0.8)},${Math.round(skyB * 0.9)})`);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, FIELD_TOP + 40);

  // 지면 (FIELD_TOP ~ FIELD_BOTTOM): 어두운 녹색 잔디
  const groundR = Math.round(30 + (10 - 30) * nd);
  const groundG = Math.round(60 + (20 - 60) * nd);
  const groundB = Math.round(30 + (15 - 30) * nd);
  ctx.fillStyle = `rgb(${groundR},${groundG},${groundB})`;
  ctx.fillRect(0, FIELD_TOP, W, FIELD_BOTTOM - FIELD_TOP);

  // 미묘한 격자선
  ctx.strokeStyle = `rgba(0,0,0,${0.06 + nd * 0.04})`;
  ctx.lineWidth = 1;
  const gridSize = 40;
  for (let x = 0; x <= W; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, FIELD_TOP);
    ctx.lineTo(x, FIELD_BOTTOM);
    ctx.stroke();
  }
  for (let y = FIELD_TOP; y <= FIELD_BOTTOM; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // 스폰 영역 표시 (y=48 ~ y=150): 미묘한 빨간 틴트
  ctx.fillStyle = `rgba(180,30,30,${0.04 + nd * 0.02})`;
  ctx.fillRect(0, FIELD_TOP, W, 102);

  // 경로 표시: 스폰에서 벽 구간으로의 미묘한 어두운 선
  ctx.strokeStyle = `rgba(0,0,0,${0.03 + nd * 0.02})`;
  ctx.lineWidth = 2;
  const segXs = [80, 205, 335, 460]; // approximate wall segment centers
  for (const sx of segXs) {
    ctx.beginPath();
    ctx.moveTo(sx, FIELD_TOP + 20);
    ctx.lineTo(sx, WALL_Y - 10);
    ctx.stroke();
  }

  // 성벽 아래 ~ FIELD_BOTTOM: 약간 밝은 내부 영역
  ctx.fillStyle = `rgba(50,40,30,${0.15 + nd * 0.1})`;
  ctx.fillRect(0, WALL_Y + 20, W, FIELD_BOTTOM - WALL_Y - 20);
}

/**
 * 발사선 그리기 (타워에서 조준 방향으로 점선)
 */
export function drawFiringLine(ctx) {
  if (state.currentWeapon === 'pouch') return;

  const tx = state.tower.x, ty = TOWER_Y;
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
