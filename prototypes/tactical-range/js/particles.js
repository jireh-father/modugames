// ── 파티클 이펙트 시스템 ──
import { state } from './game.js?v=7';

/**
 * 파티클 생성
 * @param {number} x - X 위치
 * @param {number} y - Y 위치
 * @param {string} type - 파티클 종류
 * @param {object} opts - 추가 옵션
 */
export function spawnParticles(x, y, type, opts = {}) {
  switch (type) {
    case 'muzzleFlash': {
      // 총구 화염
      state.particles.push({
        x, y, type: 'circle',
        r: 20, dr: -80,
        color: 'rgba(255,200,50,0.9)',
        life: 0.08,
      });
      state.particles.push({
        x, y, type: 'circle',
        r: 12, dr: -40,
        color: 'rgba(255,100,20,0.7)',
        life: 0.12,
      });
      break;
    }
    case 'woodChips': {
      // 나무 파편
      const count = opts.count || 6;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 100;
        state.particles.push({
          x, y, type: 'rect',
          w: 2 + Math.random() * 4,
          h: 1 + Math.random() * 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 30,
          gravity: 200,
          color: `hsl(30, ${40 + Math.random() * 20}%, ${30 + Math.random() * 20}%)`,
          life: 0.3 + Math.random() * 0.4,
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 10,
        });
      }
      break;
    }
    case 'hitMarker': {
      // 명중 표시 X
      state.particles.push({
        x, y, type: 'hitX',
        life: 0.4,
        scale: opts.scale || 1,
      });
      break;
    }
    case 'scoreText': {
      // 점수 텍스트 올라감
      state.particles.push({
        x, y, type: 'text',
        text: opts.text || '+10',
        vy: -60,
        color: opts.color || '#fff',
        fontSize: opts.fontSize || 18,
        life: 0.8,
      });
      break;
    }
    case 'comboText': {
      state.particles.push({
        x, y, type: 'text',
        text: opts.text || 'COMBO!',
        vy: -40,
        color: '#ffdd44',
        fontSize: 24,
        life: 1.0,
        scale: 1.5,
      });
      break;
    }
    case 'explosion': {
      const count2 = 12;
      for (let i = 0; i < count2; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 120;
        state.particles.push({
          x, y, type: 'circle',
          r: 2 + Math.random() * 4,
          dr: -5,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: `hsl(${20 + Math.random() * 30}, 100%, ${50 + Math.random() * 30}%)`,
          life: 0.3 + Math.random() * 0.3,
        });
      }
      break;
    }
    case 'bowString': {
      // 시위 진동 효과
      for (let i = 0; i < 4; i++) {
        state.particles.push({
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 30,
          type: 'circle',
          r: 1 + Math.random(),
          dr: -3,
          color: 'rgba(200,180,150,0.5)',
          life: 0.2,
        });
      }
      break;
    }
  }
}

/**
 * 파티클 업데이트
 */
export function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    if (p.vx) p.x += p.vx * dt;
    if (p.vy) p.y += p.vy * dt;
    if (p.gravity) p.vy += p.gravity * dt;
    if (p.dr) p.r = Math.max(0, p.r + p.dr * dt);
    if (p.rotSpeed) p.rotation += p.rotSpeed * dt;
  }
}

/**
 * 파티클 렌더링
 */
export function drawParticles(ctx) {
  for (const p of state.particles) {
    const alpha = Math.min(1, p.life * 3);
    ctx.globalAlpha = alpha;

    if (p.type === 'circle') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0, p.r), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'rect') {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.rotation) ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    } else if (p.type === 'text') {
      ctx.fillStyle = p.color;
      ctx.font = `bold ${p.fontSize || 16}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
    } else if (p.type === 'hitX') {
      const s = 10 * (p.scale || 1);
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x - s, p.y - s);
      ctx.lineTo(p.x + s, p.y + s);
      ctx.moveTo(p.x + s, p.y - s);
      ctx.lineTo(p.x - s, p.y + s);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
