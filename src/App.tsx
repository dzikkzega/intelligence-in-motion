import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import '@fontsource-variable/manrope';
import '@fontsource/bodoni-moda/latin-400.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import './styles.css';
import { Scenes } from './scenes/Scenes';
import { TimelineControls } from './components/TimelineControls';
import { createMasterTimeline } from './timeline/masterTimeline';
import { CHAPTERS, DURATION, chapterAt, clampTime, formatTime } from './timeline/config';
import { create2DFallback } from './webgl/fallback';
import { createCinemaAudio, type CinemaAudio } from './audio/soundtrack';
import type { EnvironmentInstance } from './webgl/Environment';

declare global {
  interface Window {
    __cinema?: {
      seek: (time: number) => void;
      play: () => void;
      pause: () => void;
      time: () => number;
      duration: () => number;
      reduced: boolean;
    };
  }
}

const Stage = memo(Scenes);
const motionQuery = '(prefers-reduced-motion: reduce)';
const initialReduced = typeof window !== 'undefined' ? window.matchMedia(motionQuery).matches : false;

export function App() {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<EnvironmentInstance | null>(null);
  const audioRef = useRef<CinemaAudio | null>(null);
  const timelineRef = useRef<ReturnType<typeof createMasterTimeline> | null>(null);
  const idleTimer = useRef<number | undefined>(undefined);
  const pointer = useRef({ x: 0, y: 0 });
  const lastDisplay = useRef(-Infinity);
  const dragPlaying = useRef(false);
  const playRequest = useRef(0);
  const runtime = useRef({ time: 0, entered: false, playing: false, preparing: false, ready: false, reduced: initialReduced, muted: false });
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [entered, setEntered] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [audioPreparing, setAudioPreparing] = useState(false);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [time, setTime] = useState(0);
  const [reduced, setReduced] = useState(initialReduced);
  const [simplified, setSimplified] = useState(false);
  const [visible, setVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');

  const wake = useCallback(() => {
    setVisible(true);
    window.clearTimeout(idleTimer.current);
    if (runtime.current.playing) idleTimer.current = window.setTimeout(() => setVisible(false), 3000);
  }, []);

  const syncTime = useCallback((value: number, force = false) => {
    const next = clampTime(value);
    const chapterChanged = chapterAt(runtime.current.time).id !== chapterAt(next).id;
    runtime.current.time = next;
    engineRef.current?.render(next, pointer.current, !runtime.current.entered);
    audioRef.current?.sync(next);
    const now = performance.now();
    if (force || chapterChanged || next === DURATION || now - lastDisplay.current >= 100) {
      lastDisplay.current = now;
      setTime(next);
    }
  }, []);

  const pause = useCallback(() => {
    playRequest.current++;
    runtime.current.preparing = false;
    setAudioPreparing(false);
    runtime.current.playing = false;
    timelineRef.current?.pause();
    audioRef.current?.pause();
    setPlaying(false);
    setTime(runtime.current.time);
    wake();
  }, [wake]);

  const seek = useCallback((value: number) => {
    const next = clampTime(value);
    audioRef.current?.seek(next);
    timelineRef.current?.time(next, false);
    syncTime(next, true);
    if (next === DURATION) pause();
    wake();
  }, [pause, syncTime, wake]);

  const play = useCallback(() => {
    if (!runtime.current.ready || !timelineRef.current || document.hidden || runtime.current.preparing) return;
    if (runtime.current.time >= DURATION) seek(0);
    const request = ++playRequest.current;
    const audio = audioRef.current;
    const begin = () => {
      if (request !== playRequest.current || audio !== audioRef.current || !timelineRef.current || document.hidden) return;
      runtime.current.preparing = false;
      setAudioPreparing(false);
      runtime.current.entered = true;
      runtime.current.playing = true;
      setEntered(true);
      setPlaying(true);
      syncTime(runtime.current.time, true);
      audio?.play(runtime.current.time);
      timelineRef.current.play();
      wake();
    };
    if (runtime.current.muted || !audio) { begin(); return; }
    runtime.current.preparing = true;
    setAudioPreparing(true);
    // prepare unlocks audio inside this gesture; the master clock remains stopped.
    void audio.prepare().then(begin);
  }, [seek, syncTime, wake]);

  const restart = useCallback(() => { seek(0); play(); }, [seek, play]);
  const toggle = useCallback(() => { if (runtime.current.playing || runtime.current.preparing) pause(); else play(); }, [pause, play]);
  const toggleMute = useCallback(() => {
    const next = !runtime.current.muted;
    runtime.current.muted = next;
    setMuted(next);
    audioRef.current?.setMuted(next);
    if (runtime.current.preparing && next) { pause(); play(); }
    else if (runtime.current.playing && !next) { pause(); play(); }
    wake();
  }, [pause, play, wake]);

  // A single clock drives both the DOM and renderer. Rebuilding preserves playback state.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const savedTime = runtime.current.time;
    const resume = runtime.current.playing;
    const timeline = createMasterTimeline(root, reduced, syncTime, () => {
      runtime.current.playing = false;
      setPlaying(false);
      syncTime(DURATION, true);
      wake();
    });
    timelineRef.current = timeline;
    timeline.time(savedTime, false);
    syncTime(savedTime, true);
    if (resume && savedTime < DURATION) timeline.play();
    return () => {
      timeline.eventCallback('onUpdate', null);
      timeline.eventCallback('onComplete', null);
      timeline.revert();
      timelineRef.current = null;
    };
  }, [reduced, syncTime, wake]);

  // Fonts and the renderer report real milestones; no synthetic loading timer.
  useEffect(() => {
    let disposed = false;
    let usingFallback = false;
    let fontsLoaded = false;
    let moduleLoaded = false;
    let rendererProgress = 0;
    let instance: EnvironmentInstance | null = null;
    const updateProgress = () => {
      if (!disposed) setProgress(Math.round((fontsLoaded ? 20 : 0) + (moduleLoaded ? 10 : 0) + rendererProgress * 70));
    };
    const activateFallback = () => {
      if (disposed || usingFallback) return;
      usingFallback = true;
      const previous = instance;
      instance = null;
      engineRef.current = null;
      setSimplified(true);
      previous?.dispose();
      try {
        if (fallbackRef.current) instance = create2DFallback(fallbackRef.current, runtime.current.reduced);
      } catch {
        // Typography and every playback control remain usable without either canvas API.
        instance = null;
      }
      engineRef.current = instance;
      instance?.render(runtime.current.time, pointer.current, !runtime.current.entered);
    };
    const fontsReady = document.fonts.ready.then(() => {
      fontsLoaded = true;
      updateProgress();
    });
    const rendererReady = (async () => {
      try {
        const { createEnvironment } = await import('./webgl/Environment');
        if (disposed) return;
        moduleLoaded = true;
        updateProgress();
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('Missing renderer canvas');
        const environment = await createEnvironment(canvas, {
          reducedMotion: runtime.current.reduced,
          onProgress: value => {
            if (!Number.isFinite(value)) return;
            rendererProgress = Math.max(rendererProgress, Math.min(1, Math.max(0, value > 1 ? value / 100 : value)));
            updateProgress();
          },
          onContextLost: activateFallback,
        });
        if (disposed || usingFallback) {
          environment.dispose();
          return;
        }
        instance = environment;
        engineRef.current = environment;
        environment.setReducedMotion(runtime.current.reduced);
        environment.render(runtime.current.time, pointer.current, !runtime.current.entered);
      } catch {
        activateFallback();
      }
      moduleLoaded = true;
      rendererProgress = 1;
      updateProgress();
    })();
    void Promise.all([fontsReady, rendererReady]).then(() => {
      if (disposed) return;
      runtime.current.ready = true;
      setProgress(100);
      setReady(true);
    });
    const resize = () => {
      engineRef.current?.resize();
      engineRef.current?.render(runtime.current.time, pointer.current, !runtime.current.entered);
    };
    window.addEventListener('resize', resize);
    return () => {
      disposed = true;
      window.removeEventListener('resize', resize);
      instance?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const preference = window.matchMedia(motionQuery);
    const changed = () => {
      runtime.current.reduced = preference.matches;
      engineRef.current?.setReducedMotion(preference.matches);
      setReduced(preference.matches);
    };
    preference.addEventListener('change', changed);
    return () => preference.removeEventListener('change', changed);
  }, []);

  useEffect(() => {
    const state = runtime.current;
    const audio = createCinemaAudio(() => setAudioUnavailable(true));
    audioRef.current = audio;
    audio.setMuted(state.muted);
    return () => {
      state.preparing = false;
      audio.dispose();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      if (event.key.toLowerCase() === 'm') { event.preventDefault(); toggleMute(); return; }
      if (target?.closest('button, a')) return;
      if (!runtime.current.entered) {
        if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); play(); }
        return;
      }
      if (event.code === 'Space') { event.preventDefault(); toggle(); }
      else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        event.preventDefault();
        seek(runtime.current.time + (event.code === 'ArrowLeft' ? -5 : 5));
      } else if (event.key.toLowerCase() === 'r') { event.preventDefault(); restart(); }
    };
    const visibility = () => { if (document.hidden) { dragPlaying.current = false; pause(); } };
    const fullChange = () => setFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener('keydown', keydown);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('fullscreenchange', fullChange);
    return () => {
      window.removeEventListener('keydown', keydown);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('fullscreenchange', fullChange);
      window.clearTimeout(idleTimer.current);
    };
  }, [pause, play, restart, seek, toggle, toggleMute]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__cinema = { seek, play, pause, time: () => runtime.current.time, duration: () => DURATION, reduced };
    return () => { delete window.__cinema; };
  }, [pause, play, reduced, seek]);

  const movePointer = (event: ReactPointerEvent<HTMLElement>) => {
    wake();
    if (!runtime.current.entered && !runtime.current.reduced && event.pointerType === 'mouse') {
      pointer.current = { x: event.clientX / window.innerWidth * 2 - 1, y: event.clientY / window.innerHeight * 2 - 1 };
      engineRef.current?.render(0, pointer.current, true);
    }
  };
  const scrubStart = () => { dragPlaying.current = runtime.current.playing; pause(); };
  const scrubEnd = () => {
    const resume = dragPlaying.current;
    dragPlaying.current = false;
    if (resume && runtime.current.time < DURATION) play();
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
      setFullscreenError('');
    } catch { setFullscreenError('Fullscreen is unavailable in this browser.'); }
  };
  const chapter = chapterAt(time);
  const chapterNumber = String(CHAPTERS.indexOf(chapter) + 1).padStart(2, '0');
  const finished = entered && time >= DURATION;

  return (
    <main ref={rootRef} className={`experience${entered ? ' has-entered' : ''}${reduced ? ' reduced-motion' : ''}`} data-entered={entered} data-reduced={reduced} data-playing={playing} onPointerMove={movePointer} onPointerDown={wake} onFocusCapture={wake}>
      <div className="canvas-layer" aria-hidden="true">
        <canvas ref={canvasRef} className="webgl-canvas" style={{ visibility: simplified ? 'hidden' : 'visible' }} />
        <canvas ref={fallbackRef} className="fallback-canvas" style={{ visibility: simplified ? 'visible' : 'hidden' }} />
      </div>
      <div className="film-grain" aria-hidden="true" />
      <header className="edge-header">
        <div className="project-mark"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 3h12v12H3zM3 9h12M9 3v12" stroke="currentColor" /></svg><span>IN MOTION</span></div>
        <div className="edition"><span>AN INDEPENDENT AI STUDY</span><span>{formatTime(DURATION)}</span></div>
      </header>
      <div className="scenes-container" style={{ visibility: entered ? 'visible' : 'hidden' }} aria-hidden="true"><Stage /></div>
      {!entered && <>
        <section className="lobby" aria-labelledby="lobby-title">
          <h1 className="lobby-title" id="lobby-title">INTELLIGENCE<span>IN MOTION.</span></h1>
          <p className="lobby-description">Four different intelligences.<br />One new era of computing.</p>
          <div className="entry-zone">
            {ready && !audioPreparing ? <button className="enter-button" type="button" onClick={play}>ENTER EXPERIENCE<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" /></svg></button> : <div className="loading-state" role="status"><span>{audioPreparing ? 'COMPOSING SOUNDTRACK' : 'INITIALIZING INTELLIGENCE'}</span><progress className="loading-progress" max={100} value={audioPreparing ? undefined : progress} aria-label={audioPreparing ? 'Composing soundtrack' : 'Loading experience'} />{!audioPreparing && <span className="loading-percent">{progress}%</span>}</div>}
            <p className="entry-note">{DURATION} SECONDS · REAL-TIME</p>
            <button type="button" className="sound-preference" onClick={toggleMute} aria-pressed={!muted} aria-label={audioPreparing ? 'Enter without sound' : 'Soundtrack'}>{audioPreparing ? 'ENTER WITHOUT SOUND' : <>SOUND {muted ? 'OFF' : 'ON'} · {muted ? 'SILENT EXPERIENCE' : 'HEADPHONES RECOMMENDED'}</>}</button>
          </div>
        </section>
        <footer className="lobby-footer"><div className="lobby-brands"><span>OpenAI</span><span>Anthropic</span><span>Google</span><span>xAI</span></div><span>NO FILM. JUST CODE.</span></footer>
      </>}
      {entered && <>
        <div className="chapter-readout" aria-hidden="true"><span>{chapterNumber} / 06</span><span>{chapter.name}</span></div>
        {!playing && !finished && <div className="playback-state" role="status">{audioPreparing ? 'COMPOSING SOUNDTRACK' : 'PAUSED'}</div>}
        <p className="sr-only" aria-live="polite" aria-atomic="true">{chapter.name}. {chapter.description}</p>
        {finished && <div className="end-screen"><p>THE NEXT MOVE IS YOURS.</p><button type="button" className="replay-button" onClick={restart}>REPLAY<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10a8 8 0 1 1 0 5M4 4v6h6" stroke="currentColor" strokeWidth="1.5" /></svg></button></div>}
        <TimelineControls currentTime={time} isPlaying={playing} isFinished={finished} visible={visible || !playing} onPlayPause={toggle} onSeek={seek} onRestart={restart} onScrubStart={scrubStart} onScrubEnd={scrubEnd} onWake={wake} onFullscreen={toggleFullscreen} fullscreen={fullscreen} fullscreenAvailable={Boolean(document.fullscreenEnabled)} muted={muted} onToggleMute={toggleMute} audioUnavailable={audioUnavailable} />
      </>}
      {audioUnavailable && <p className="audio-notice" role="status">Audio unavailable. Reload to retry; visuals continue.</p>}
      {simplified && <div className="rendering-notice" role="status">Simplified rendering</div>}
      {fullscreenError && <p className="fullscreen-error" role="status">{fullscreenError}</p>}
    </main>
  );
}

export default App;
