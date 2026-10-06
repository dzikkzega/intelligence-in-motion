import type { ReactNode } from 'react';

interface CueProps {
  start: number;
  end: number;
  motion?: 'caption' | 'cursor' | 'whiteout';
  className?: string;
  children?: ReactNode;
}

function Cue({ start, end, motion = 'caption', className = '', children }: CueProps) {
  return (
    <div className={`cue ${className}`.trim()} data-start={start} data-end={end} data-motion={motion}>
      {children}
    </div>
  );
}

export function Scenes() {
  return (
    <div className="scene-stage" aria-hidden="true">
      {/* 1. ORIGIN (0 - 12s) */}
      <section className="scene scene-awakening">
        <Cue start={3} end={6} className="film-line">
          <p>Everything begins<br />with an idea.</p>
        </Cue>
        <Cue start={8} end={10.5} className="scene-caption origin-caption">
          <p>We taught machines language.</p>
        </Cue>
      </section>

      {/* 2. CODEX (12 - 35s) */}
      <section className="scene scene-codex">
        <Cue start={14} end={18.5} className="scene-caption brand-codex">
          <h2>Codex</h2>
          <p className="scene-signature">OpenAI</p>
          <p>From intention, a world takes shape.</p>
        </Cue>
      </section>

      {/* 3. CLAUDE (35 - 58s) */}
      <section className="scene scene-claude">
        <Cue start={39} end={43.5} className="scene-caption brand-claude">
          <h2>Claude</h2>
          <p className="scene-signature">Anthropic</p>
          <p>Context becomes connection.</p>
        </Cue>
      </section>

      {/* 4. GEMINI (58 - 81s) */}
      <section className="scene scene-gemini">
        <Cue start={60} end={64.5} className="scene-caption brand-gemini">
          <h2>Gemini</h2>
          <p className="scene-signature">Google</p>
          <p>Many signals. One understanding.</p>
        </Cue>
      </section>

      {/* 5. GROK (81 - 103s) */}
      <section className="scene scene-grok">
        <Cue start={83} end={87.5} className="scene-caption brand-grok">
          <h2>Grok</h2>
          <p className="scene-signature">xAI</p>
          <p>Information, moving in real time.</p>
        </Cue>
      </section>

      {/* 6. CONVERGENCE (103 - 118s) */}
      <section className="scene scene-convergence">
        <Cue start={109} end={114} className="film-line film-closing">
          <p>Four intelligences.<br />One new era.</p>
        </Cue>
        <Cue start={114.5} end={116.5} motion="whiteout" className="film-whiteout" />
        <Cue start={117} end={118} motion="cursor" className="cursor-end" />
      </section>
    </div>
  );
}
