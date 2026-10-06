import gsap from 'gsap';
import { DURATION } from './config';

export function createMasterTimeline(
  root: HTMLElement,
  reducedMotion: boolean,
  onUpdate: (time: number) => void,
  onComplete: () => void,
): gsap.core.Timeline {
  const clock = { time: 0 };
  const master = gsap.timeline({ paused: true, onUpdate: () => onUpdate(clock.time), onComplete });
  const cues = [...root.querySelectorAll<HTMLElement>('.cue')];
  const records = cues.map(element => {
    const start = Number(element.dataset.start);
    const end = Number(element.dataset.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > DURATION || end - start < 0.3) {
      throw new Error(`Invalid scene cue: ${element.className} [${start}, ${end}]`);
    }
    return { element, start, end, motion: element.dataset.motion };
  });

  // Timeline-owned initialization also restores cleanly through native revert().
  master.set(cues, { opacity: 0, immediateRender: true }, 0);
  master.to(clock, { time: DURATION, duration: DURATION, ease: 'none' }, 0);

  const tween = (target: gsap.TweenTarget, from: gsap.TweenVars, to: gsap.TweenVars, at: number, duration: number) => {
    master.fromTo(target, from, { ease: 'power2.out', immediateRender: false, ...to, duration }, at);
  };

  records.forEach(({ element, start, end, motion }) => {
    const life = end - start;

    if (motion === 'whiteout') {
      if (reducedMotion) return;
      tween(element, { opacity: 0 }, { opacity: 0.85, ease: 'sine.inOut' }, start, life / 2);
      tween(element, { opacity: 0.85 }, { opacity: 0, ease: 'sine.inOut' }, start + life / 2, life / 2);
      return;
    }

    if (motion === 'cursor') {
      tween(element, { opacity: 0 }, { opacity: 1, ease: 'none' }, start, 0.15);
      if (!reducedMotion) {
        master.set(element, { opacity: 0 }, start + life * 0.4);
        master.set(element, { opacity: 1 }, start + life * 0.7);
      }
      tween(element, { opacity: 1 }, { opacity: 0, ease: 'none' }, end - 0.15, 0.15);
      return;
    }

    const fadeIn = reducedMotion ? 0.2 : Math.min(0.5, life * 0.25);
    const fadeOut = reducedMotion ? 0.2 : Math.min(0.6, life * 0.25);

    tween(element, { opacity: 0 }, { opacity: 1, ease: 'none' }, start, fadeIn);
    tween(element, { opacity: 1 }, { opacity: 0, ease: 'none' }, end - fadeOut, fadeOut);

    if (!reducedMotion) {
      tween(element, { y: 10, filter: 'blur(4px)' }, { y: 0, filter: 'blur(0px)' }, start, fadeIn * 1.2);
    }
  });

  if (Math.abs(master.duration() - DURATION) > 0.00001) {
    throw new Error(`Master timeline must last exactly ${DURATION} seconds.`);
  }

  return master;
}
