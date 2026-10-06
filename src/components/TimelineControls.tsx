import { useRef } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { CHAPTERS, DURATION, chapterAt, clampTime, formatTime } from '../timeline/config';

interface TimelineControlsProps {
  currentTime: number;
  isPlaying: boolean;
  isFinished: boolean;
  visible: boolean;
  fullscreen: boolean;
  fullscreenAvailable: boolean;
  muted: boolean;
  audioUnavailable: boolean;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onRestart: () => void;
  onScrubStart: () => void;
  onScrubEnd: () => void;
  onWake: () => void;
  onFullscreen: () => void;
  onToggleMute: () => void;
}

export function TimelineControls({ currentTime, isPlaying, isFinished, visible, fullscreen, fullscreenAvailable, muted, audioUnavailable, onPlayPause, onSeek, onRestart, onScrubStart, onScrubEnd, onWake, onFullscreen, onToggleMute }: TimelineControlsProps) {
  const dragging = useRef(false);
  const chapter = chapterAt(currentTime);
  const startDrag = (event: PointerEvent<HTMLInputElement>) => {
    if (dragging.current) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    onScrubStart();
  };
  const endDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    onScrubEnd();
  };
  const keyStep = (event: KeyboardEvent<HTMLInputElement>) => {
    const direction = ['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : ['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : 0;
    if (direction) {
      event.preventDefault();
      onSeek(clampTime(currentTime + direction * 5));
    }
    onWake();
  };

  return (
    <div className={`player${visible ? ' is-visible' : ' is-idle'}`} data-visible={visible} role="region" aria-label="Cinema playback controls" onFocusCapture={onWake} onPointerDown={onWake}>
      <div className="player-top">
        <button type="button" className="control-button play-button" onClick={isFinished ? onRestart : onPlayPause} aria-label={isFinished ? 'Replay' : isPlaying ? 'Pause' : 'Play'} title={isFinished ? 'Replay (R)' : isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            {isFinished ? <path d="M4 10a8 8 0 1 1 0 5M4 4v6h6" fill="none" stroke="currentColor" strokeWidth="1.5" /> : isPlaying ? <path d="M6 4h4v16H6zm8 0h4v16h-4z" fill="currentColor" /> : <path d="m7 4 13 8-13 8z" fill="currentColor" />}
          </svg>
        </button>
        <div className="player-chapter" aria-hidden="true"><span className="chapter-index">{String(CHAPTERS.indexOf(chapter) + 1).padStart(2, '0')}</span><span className="chapter-name">{chapter.name}</span></div>
        <div className="player-time" aria-hidden="true"><span>{formatTime(currentTime)}</span><span className="time-divider">/</span><span>{formatTime(DURATION)}</span></div>
        <button type="button" className="control-button audio-button" onClick={onToggleMute} disabled={audioUnavailable} aria-pressed={!muted && !audioUnavailable} aria-label={audioUnavailable ? 'Audio unavailable' : 'Soundtrack'} title={audioUnavailable ? 'Audio unavailable' : muted ? 'Unmute (M)' : 'Mute (M)'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            {muted ? (
              <>
                <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </>
            ) : (
              <>
                <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </>
            )}
          </svg>
        </button>
        {fullscreenAvailable && <button type="button" className="control-button fullscreen-button" onClick={onFullscreen} aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={fullscreen ? 'M8 3v5H3m13-5v5h5M8 21v-5H3m13 5v-5h5' : 'M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6'} /></svg>
        </button>}
      </div>
      <input className="timeline-track" type="range" min={0} max={DURATION} step={0.05} value={clampTime(currentTime)} onChange={event => onSeek(Number(event.target.value))} onPointerDown={startDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag} onBlur={endDrag} onKeyDown={keyStep} aria-label="Seek time" aria-valuetext={`${formatTime(currentTime)} of ${formatTime(DURATION)}, ${chapter.name}`} style={{ '--progress': `${currentTime / DURATION * 100}%` } as CSSProperties} />
      <div className="timeline-chapters" aria-label="Chapters">
        {CHAPTERS.map(item => <button key={item.id} type="button" className={item.id === chapter.id ? 'is-active' : undefined} aria-current={item.id === chapter.id ? 'step' : undefined} aria-label={`Seek to ${item.name}, ${formatTime(item.start)}`} style={{ flex: item.end - item.start }} onClick={() => onSeek(item.start)}><span>{item.name}</span></button>)}
      </div>
      <p className="keyboard-hint"><kbd>SPACE</kbd> play / pause<span>·</span><kbd>← →</kbd> skip 5s<span>·</span><kbd>M</kbd> mute<span>·</span><kbd>R</kbd> replay</p>
    </div>
  );
}
