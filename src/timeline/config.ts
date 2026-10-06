export const DURATION = 118;
export const CHAPTERS = [
  { id: 'awakening', name: 'Origin', brand: 'THE PROLOGUE', start: 0, end: 12, description: 'Everything begins with an idea.' },
  { id: 'codex', name: 'Codex', brand: 'OPENAI', start: 12, end: 35, description: 'From intent to code to physical systems.' },
  { id: 'claude', name: 'Claude', brand: 'ANTHROPIC', start: 35, end: 58, description: 'Context, reasoning, neural geometry.' },
  { id: 'gemini', name: 'Gemini', brand: 'GOOGLE', start: 58, end: 81, description: 'Spectral multimodal synthesis.' },
  { id: 'grok', name: 'Grok', brand: 'xAI', start: 81, end: 103, description: 'Real-time velocity and kinetic power.' },
  { id: 'convergence', name: 'Convergence', brand: 'THE EPILOGUE', start: 103, end: 118, description: 'Four intelligences. One new era.' },
] as const;

export function clampTime(time: number) {
  return Number.isFinite(time) ? Math.max(0, Math.min(DURATION, time)) : 0;
}
export function chapterAt(time: number) {
  return CHAPTERS.find(chapter => clampTime(time) < chapter.end) ?? CHAPTERS[5];
}
export function formatTime(time: number) {
  const seconds = Math.floor(clampTime(time));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}