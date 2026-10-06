import { CHAPTERS, chapterAt, clampTime } from '../timeline/config';
import type { EnvironmentInstance } from './Environment';

export type FallbackRenderer = EnvironmentInstance;

/** Canvas fallback remains deterministic and synchronized with the master clock. */
export function create2DFallback(canvas: HTMLCanvasElement, reducedMotion = false): FallbackRenderer {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D unsupported');
  const ctx: CanvasRenderingContext2D = context;
  let width = 1;
  let height = 1;
  let disposed = false;
  let reduced = reducedMotion;
  const colors = ['#b4c0d4', '#60daab', '#e1ad7f', '#82a4fa', '#e4e6ed', '#b6acd9'];

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, bounds.width || window.innerWidth);
    height = Math.max(1, bounds.height || window.innerHeight);
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function render(time: number, pointer = { x: 0, y: 0 }, lobby = false) {
    if (disposed) return;
    const chapter = chapterAt(clampTime(time));
    const index = CHAPTERS.indexOf(chapter);
    const phase = reduced || lobby ? 0 : clampTime(time) * 0.055;
    const color = lobby ? '#93b9d4' : colors[index];
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#07090c';
    ctx.fillRect(0, 0, width, height);
    const x = width * (lobby ? 0.58 : 0.62) + (reduced ? 0 : pointer.x * 8);
    const y = height * (lobby ? 0.56 : 0.5);
    const radius = Math.min(width * 0.36, height * 0.42);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.6);
    glow.addColorStop(0, `${color}14`);
    glow.addColorStop(1, `${color}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.45 + phase * 0.3);
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 12; i++) {
      const tilt = (i / 12) * Math.PI + phase;
      ctx.globalAlpha = 0.14 + Math.sin(i * 1.7) ** 2 * 0.38;
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius * (0.15 + Math.abs(Math.sin(tilt)) * 0.52), tilt * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 30; i++) {
      const angle = i * 2.399963 + phase;
      const distance = radius * (0.6 + ((i * 7) % 19) / 26);
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance * 0.62, i % 7 === 0 ? 1.7 : 0.7, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.restore();
  }

  resize();
  return {
    render,
    resize,
    setReducedMotion(value) { reduced = value; },
    dispose() { disposed = true; ctx.clearRect(0, 0, width, height); },
  };
}
