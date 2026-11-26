import React, { useEffect, useRef } from 'react';
import type { AccentTheme, AntigravityIntensity } from '../types/chat';

interface AntigravityBackdropProps {
  isDark: boolean;
  accentTheme: AccentTheme;
  intensity: AntigravityIntensity;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  phase: number;
  colorIndex: 0 | 1 | 2;
}

const ACCENT_PALETTES: Record<
  AccentTheme,
  { dark: [string, string, string]; light: [string, string, string]; aurora1: string; aurora2: string }
> = {
  cobalt: {
    dark: ['56, 189, 248', '59, 130, 246', '168, 85, 247'],
    light: ['37, 99, 235', '14, 165, 233', '99, 102, 241'],
    aurora1: 'rgba(37, 99, 235, 0.24)',
    aurora2: 'rgba(139, 92, 246, 0.20)'
  },
  emerald: {
    dark: ['52, 211, 153', '16, 185, 129', '56, 189, 248'],
    light: ['5, 150, 105', '13, 148, 136', '37, 99, 235'],
    aurora1: 'rgba(16, 185, 129, 0.22)',
    aurora2: 'rgba(56, 189, 248, 0.18)'
  },
  amber: {
    dark: ['251, 191, 36', '245, 158, 11', '244, 63, 94'],
    light: ['217, 119, 6', '234, 88, 12', '225, 29, 72'],
    aurora1: 'rgba(245, 158, 11, 0.22)',
    aurora2: 'rgba(244, 63, 94, 0.18)'
  },
  amethyst: {
    dark: ['192, 132, 252', '139, 92, 246', '56, 189, 248'],
    light: ['124, 58, 237', '168, 85, 247', '37, 99, 235'],
    aurora1: 'rgba(139, 92, 246, 0.24)',
    aurora2: 'rgba(56, 189, 248, 0.20)'
  }
};

export const AntigravityBackdrop: React.FC<AntigravityBackdropProps> = ({
  isDark,
  accentTheme,
  intensity
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({ x: -9999, y: -9999, active: false });

  useEffect(() => {
    if (intensity === 'off') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const isMobileViewport = width < 768;
    const baseCount = intensity === 'full' ? (isMobileViewport ? 34 : 68) : isMobileViewport ? 18 : 34;
    const connectDistSq = (isMobileViewport ? 105 : 135) ** 2;
    const palette = ACCENT_PALETTES[accentTheme];
    const colors = isDark ? palette.dark : palette.light;

    const particles: Particle[] = Array.from({ length: baseCount }, (_, idx) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.28,
      vy: -(0.18 + Math.random() * 0.42), // Yukarı doğru antigravity süzülme
      radius: 1.1 + Math.random() * 2.1,
      alpha: 0.28 + Math.random() * 0.52,
      phase: Math.random() * Math.PI * 2,
      colorIndex: (idx % 3) as 0 | 1 | 2
    }));

    const onPointerMove = (ev: PointerEvent) => {
      pointerRef.current = { x: ev.clientX, y: ev.clientY, active: true };
    };
    const onTouchMove = (ev: TouchEvent) => {
      if (ev.touches.length > 0) {
        pointerRef.current = {
          x: ev.touches[0].clientX,
          y: ev.touches[0].clientY,
          active: true
        };
      }
    };
    const clearPointer = () => {
      pointerRef.current.active = false;
    };

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('pointerleave', clearPointer, { passive: true });
    window.addEventListener('touchend', clearPointer, { passive: true });

    let rafId = 0;
    let frameTick = 0;

    const drawFrame = () => {
      if (document.hidden) {
        rafId = requestAnimationFrame(drawFrame);
        return;
      }

      frameTick += 1;
      ctx.clearRect(0, 0, width, height);

      const ptr = pointerRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (!prefersReducedMotion) {
          p.phase += 0.015;
          p.x += p.vx + Math.sin(p.phase) * 0.14;
          p.y += p.vy;

          if (ptr.active) {
            const dx = p.x - ptr.x;
            const dy = p.y - ptr.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < 19600 && distSq > 4) {
              const dist = Math.sqrt(distSq);
              const force = ((140 - dist) / 140) * 0.45;
              // Antigravity yörünge itişi
              p.x += (dx / dist) * force - (dy / dist) * force * 0.35;
              p.y += (dy / dist) * force + (dx / dist) * force * 0.35;
            }
          }

          if (p.y < -16) {
            p.y = height + 16;
            p.x = Math.random() * width;
          }
          if (p.x < -16) p.x = width + 16;
          if (p.x > width + 16) p.x = -16;
        }

        const rgb = colors[p.colorIndex];
        const pulse = 0.8 + Math.sin(frameTick * 0.03 + p.phase) * 0.2;
        const opacity = (isDark ? p.alpha : p.alpha * 0.55) * pulse;

        if (intensity === 'full') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 3.1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${rgb}, ${opacity * 0.16})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb}, ${opacity})`;
        ctx.fill();
      }

      if (intensity === 'full') {
        ctx.lineWidth = 0.75;
        for (let i = 0; i < particles.length; i++) {
          const a = particles[i];
          for (let j = i + 1; j < particles.length; j++) {
            const b = particles[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < connectDistSq) {
              const alpha = (1 - distSq / connectDistSq) * (isDark ? 0.16 : 0.10);
              ctx.strokeStyle = `rgba(${colors[0]}, ${alpha.toFixed(3)})`;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }
      }

      if (!prefersReducedMotion) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('pointerleave', clearPointer);
      window.removeEventListener('touchend', clearPointer);
    };
  }, [isDark, accentTheme, intensity]);

  const palette = ACCENT_PALETTES[accentTheme];

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 overflow-hidden select-none ${
        isDark ? 'bg-slate-950' : 'bg-slate-50'
      }`}
    >
      {intensity !== 'off' && (
        <>
          {/* Antigravity Aurora Işık Alanları */}
          <div
            className="sigma-aurora-blob sigma-aurora-1"
            style={{
              background: `radial-gradient(circle, ${palette.aurora1} 0%, transparent 68%)`
            }}
          />
          <div
            className="sigma-aurora-blob sigma-aurora-2"
            style={{
              background: `radial-gradient(circle, ${palette.aurora2} 0%, transparent 70%)`
            }}
          />
          {intensity === 'full' && (
            <div className="sigma-orbital-halo" />
          )}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        </>
      )}
    </div>
  );
};
