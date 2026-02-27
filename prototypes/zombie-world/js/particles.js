// ── 파티클 이펙트 시스템 ──
import { state } from './game.js?v=8';

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
    case 'zombieDeath': {
      // 좀비 사망 스플래터 (좀비 색상 사용)
      const zColor = opts.color || '#446644';
      const count3 = 10;
      for (let i = 0; i < count3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 80;
        state.particles.push({
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 10,
          type: 'circle',
          r: 2 + Math.random() * 5,
          dr: -4,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: zColor,
          life: 0.4 + Math.random() * 0.4,
        });
      }
      break;
    }
    case 'wallHit': {
      // 벽 피격 - 회색 돌 파편 (작은)
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 60;
        state.particles.push({
          x, y, type: 'rect',
          w: 2 + Math.random() * 3,
          h: 2 + Math.random() * 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 20,
          gravity: 150,
          color: `hsl(0, 0%, ${40 + Math.random() * 25}%)`,
          life: 0.3 + Math.random() * 0.2,
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 8,
        });
      }
      break;
    }
    case 'wallBreak': {
      // 벽 파괴 - 큰 회색 돌 덩어리
      for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 50 + Math.random() * 120;
        state.particles.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y + (Math.random() - 0.5) * 10,
          type: 'rect',
          w: 3 + Math.random() * 8,
          h: 3 + Math.random() * 6,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 40,
          gravity: 250,
          color: `hsl(30, ${5 + Math.random() * 10}%, ${35 + Math.random() * 25}%)`,
          life: 0.5 + Math.random() * 0.5,
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 12,
        });
      }
      break;
    }
    case 'healPulse': {
      // 치유 효과 - 녹색 십자가 상승
      for (let i = 0; i < 5; i++) {
        state.particles.push({
          x: x + (Math.random() - 0.5) * 20,
          y: y + (Math.random() - 0.5) * 10,
          type: 'cross',
          size: 4 + Math.random() * 4,
          vx: (Math.random() - 0.5) * 15,
          vy: -30 - Math.random() * 40,
          color: '#44ff66',
          life: 0.6 + Math.random() * 0.4,
        });
      }
      break;
    }
    case 'freezeEffect': {
      // 빙결 효과 - 파란 얼음 결정
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 20 + Math.random() * 50;
        state.particles.push({
          x: x + (Math.random() - 0.5) * 15,
          y: y + (Math.random() - 0.5) * 15,
          type: 'diamond',
          size: 2 + Math.random() * 4,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 15,
          color: `hsl(${190 + Math.random() * 20}, 80%, ${60 + Math.random() * 25}%)`,
          life: 0.4 + Math.random() * 0.3,
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 6,
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
    } else if (p.type === 'cross') {
      // 십자가 (치유 효과용)
      const s = p.size || 4;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - s, p.y - s / 3, s * 2, s * 0.66);
      ctx.fillRect(p.x - s / 3, p.y - s, s * 0.66, s * 2);
    } else if (p.type === 'diamond') {
      // 다이아몬드 (빙결 효과용)
      const s = p.size || 3;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.rotation) ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.6, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}
