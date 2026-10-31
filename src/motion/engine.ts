/**
 * Typed port of design/sp-motion.js (Motion v11). Pure DOM functions: no React in here.
 * React wrappers live in hooks.ts / components.tsx; the optional attribute observer is in observer.ts.
 *
 * Timings are copied from the design: hover spring 400/25, panel spring 300/30, stagger step 0.05 s.
 * Every animation honours prefers-reduced-motion by collapsing to duration 0 (end state is still applied).
 */
import { animate, scroll } from 'motion';

export type EnterKind =
  | 'scr-f'
  | 'scr-b'
  | 'fade'
  | 'pop'
  | 'slide'
  | 'toast'
  | 'rise'
  | 'rise2'
  | 'tick'
  | 'word-a'
  | 'word-b'
  | 'word-c'
  | 'shake-a'
  | 'shake-b'
  | 'stamp'
  | 'prog'
  | 'scan'
  | 'scroll-prog'
  | 'draw'
  | 'svg-pop'
  | 'splash';

export type LoopKind =
  | 'pulse'
  | 'blink'
  | 'shimmer'
  | 'shimmer-text'
  | 'sweep'
  | 'orbit'
  | 'blip'
  | 'breathe'
  | 'ping'
  | 'bob'
  | 'wave'
  | 'dash'
  | 'blinkeye'
  | 'look'
  | 'marquee';

export type EnterOptions = {
  /** delay in ms (data-md) */
  delay?: number;
  /** duration in seconds (data-mdur) */
  duration?: number;
  /** stroke length for `draw` (data-len) */
  len?: number;
};

export type LoopOptions = {
  /** seconds per cycle (data-ld) */
  duration?: number;
  /** delay in ms (data-md) */
  delay?: number;
};

export const SPRING = {
  hover: { type: 'spring', stiffness: 400, damping: 25, mass: 1 },
  panel: { type: 'spring', stiffness: 300, damping: 30 },
} as const;
export const STAGGER_STEP = 0.05;

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Ctl = { stop: () => void; then?: (fn: () => void) => unknown };
type Transition = Record<string, unknown>;
type Keyframes = Record<string, unknown>;
export type Stop = () => void;

const T = (t: Transition): Transition => (prefersReducedMotion() ? { duration: 0 } : t);
// Motion's DOM keyframe typing is very strict; the design passes loose literals, so we narrow at this one boundary.
const run = (el: Element, to: Keyframes, t: Transition): Ctl =>
  animate(el as HTMLElement, to as never, T(t) as never) as unknown as Ctl;
const val = (from: number, to: number, t: Transition, fn: (v: number) => void): Ctl =>
  animate(from, to, { ...T(t), onUpdate: fn } as never) as unknown as Ctl;
const spr = (delaySec: number, extra: Transition = {}): Transition => ({
  type: 'spring',
  stiffness: 300,
  damping: 30,
  delay: delaySec,
  ...extra,
});

const stopper =
  (list: Ctl[]): Stop =>
  () =>
    list.forEach(c => {
      try {
        c.stop();
      } catch {
        /* already finished */
      }
    });

const style = (el: Element): CSSStyleDeclaration => (el as HTMLElement | SVGElement).style;

/** One-shot enter animation (data-m). Returns a stop function. */
export function enter(el: Element, kind: EnterKind, opts: EnterOptions = {}): Stop {
  const d = (opts.delay ?? 0) / 1000;
  const dur = opts.duration ?? 0;
  const P = spr(d);
  const s = style(el);
  const hide = () => {
    s.opacity = '0';
  };
  const list: Ctl[] = [];
  const add = (c: Ctl) => {
    list.push(c);
    return c;
  };
  switch (kind) {
    case 'scr-f':
      hide();
      add(run(el, { x: [32, 0], opacity: [0, 1] }, P));
      break;
    case 'scr-b':
      hide();
      add(run(el, { x: [-32, 0], opacity: [0, 1] }, P));
      break;
    case 'fade':
      hide();
      add(run(el, { opacity: [0, 1] }, P));
      break;
    case 'pop':
      hide();
      add(run(el, { scale: [0.94, 1], y: [10, 0], opacity: [0, 1] }, P));
      break;
    case 'slide':
      hide();
      s.transform = 'translateX(100%)';
      add(run(el, { x: ['100%', '0%'], opacity: [1, 1] }, P));
      break;
    case 'toast':
      hide();
      add(
        run(el, { y: [14, 0], scale: [0.94, 1], opacity: [0, 1] }, spr(d, { stiffness: 400, damping: 28 })),
      );
      break;
    case 'rise':
    case 'rise2':
      hide();
      add(run(el, { y: [10, 0], opacity: [0, 1] }, P));
      break;
    case 'tick':
      hide();
      add(run(el, { x: [-8, 0], opacity: [0, 1] }, P));
      break;
    case 'word-a':
    case 'word-b':
    case 'word-c':
      hide();
      s.filter = 'blur(5px)';
      add(
        run(
          el,
          { y: [6, 0], opacity: [0, 1], filter: ['blur(5px)', 'blur(0px)'] },
          spr(d, { stiffness: 260, damping: 28 }),
        ),
      );
      break;
    case 'shake-a':
    case 'shake-b':
      s.opacity = '1';
      add(run(el, { x: [-10, 0] }, { type: 'spring', stiffness: 700, damping: 6 }));
      break;
    case 'stamp':
      hide();
      add(
        run(
          el,
          { x: ['-50%', '-50%'], y: ['-50%', '-50%'], scale: [1.4, 1], rotate: [-10, -3], opacity: [0, 1] },
          spr(d, { stiffness: 320, damping: 16 }),
        ),
      );
      break;
    case 'prog':
      s.transform = 'scaleX(0)';
      s.opacity = '1';
      add(run(el, { scaleX: [0, 1] }, { type: 'spring', duration: dur || 0.9, bounce: 0, delay: d }));
      break;
    case 'scan': {
      s.opacity = '1';
      const c = add(
        run(el, { y: ['-110%', '260%'] }, { type: 'spring', duration: 0.9, bounce: 0, delay: d }),
      );
      c.then?.(() => {
        s.display = 'none';
      });
      break;
    }
    case 'scroll-prog':
      s.opacity = '1';
      if (!prefersReducedMotion()) {
        const c = animate(el as HTMLElement, { scaleX: [0, 1] } as never, { ease: 'linear' } as never);
        const off = scroll(c as never) as unknown as () => void;
        list.push({ stop: off });
        add(c as unknown as Ctl);
      }
      break;
    case 'draw': {
      const len = opts.len ?? 40;
      s.strokeDashoffset = String(len);
      s.opacity = '1';
      add(
        val(len, 0, { type: 'spring', duration: dur || 0.9, bounce: 0, delay: d }, v => {
          s.strokeDashoffset = String(v);
        }),
      );
      break;
    }
    case 'svg-pop':
      hide();
      s.transformBox = 'fill-box';
      s.transformOrigin = 'center';
      add(
        val(0, 1, spr(d, { stiffness: 380, damping: 18 }), v => {
          s.transform = `scale(${0.5 + 0.5 * v})`;
          s.opacity = String(Math.min(1, v * 2));
        }),
      );
      break;
    case 'splash': {
      s.opacity = '1';
      const id = window.setTimeout(
        () => {
          const c = add(run(el, { opacity: [1, 0] }, SPRING.panel));
          c.then?.(() => {
            s.display = 'none';
          });
        },
        prefersReducedMotion() ? 0 : 1500,
      );
      list.push({ stop: () => window.clearTimeout(id) });
      break;
    }
  }
  el.setAttribute('data-mdone', '1');
  return stopper(list);
}

/** Staggered child entrance (data-stagger): each child rises in 0.05 s steps (capped at 16). */
export function staggerChild(child: Element, index: number): Stop {
  style(child).opacity = '0';
  const c = run(child, { y: [14, 0], opacity: [0, 1] }, spr(Math.min(index, 16) * STAGGER_STEP));
  return stopper([c]);
}

/** data-sp: spring any style props to new values (first call is instant). */
export function springTo(el: Element, props: Keyframes, transition?: Transition, first = false): Stop {
  const c = run(
    el,
    props,
    first ? { duration: 0 } : (transition ?? { type: 'spring', stiffness: 400, damping: 30 }),
  );
  return stopper([c]);
}

/** Continuous status loops (data-loop). Returns a stop function that also resets inline styles. */
export function loop(el: Element, kind: LoopKind, opts: LoopOptions = {}): Stop {
  if (prefersReducedMotion()) return () => {};
  const s = style(el);
  if (typeof SVGElement !== 'undefined' && el instanceof SVGElement && kind !== 'sweep') {
    s.transformBox = 'fill-box';
    s.transformOrigin = 'center';
  }
  const dl = (opts.delay ?? 0) / 1000;
  const B = { repeat: Infinity, delay: dl };
  const ld = opts.duration ?? 1.6;
  const a: Ctl[] = [];
  const rep = { repeat: Infinity, ease: 'easeInOut' };
  const mir = { ...rep, repeatType: 'mirror' };
  switch (kind) {
    case 'pulse':
      a.push(run(el, { opacity: [0.5, 1] }, { duration: ld / 2, ...mir }));
      break;
    case 'blink':
      a.push(
        run(
          el,
          { opacity: [1, 1, 0, 0] },
          {
            duration: opts.duration != null ? ld : 1,
            times: [0, 0.49, 0.5, 1],
            repeat: Infinity,
            ease: 'linear',
          },
        ),
      );
      break;
    case 'shimmer':
      a.push(
        run(
          el,
          { backgroundPosition: ['200% 0', '-200% 0'] },
          { duration: ld, repeat: Infinity, ease: 'linear' },
        ),
      );
      break;
    case 'shimmer-text':
      s.backgroundImage =
        'linear-gradient(100deg,var(--ink-3,var(--mut,#888)) 35%,var(--accent,var(--a,#c6f24b)) 50%,var(--ink-3,var(--mut,#888)) 65%)';
      s.backgroundSize = '250% 100%';
      s.webkitBackgroundClip = 'text';
      s.backgroundClip = 'text';
      s.webkitTextFillColor = 'transparent';
      s.color = 'transparent';
      a.push(
        run(
          el,
          { backgroundPosition: ['150% 0', '-50% 0'] },
          { duration: 2.2, repeat: Infinity, ease: 'linear' },
        ),
      );
      break;
    case 'sweep':
    case 'orbit':
      a.push(
        val(0, 360, { duration: opts.duration ?? 7, repeat: Infinity, ease: 'linear' }, v => {
          s.transform = `rotate(${v}deg)`;
        }),
      );
      break;
    case 'blip':
      a.push(
        val(1, 1.4, { duration: 0.8, ...mir }, v => {
          s.transform = `scale(${v})`;
        }),
      );
      break;
    case 'breathe':
      a.push(
        val(0, 1, { duration: ld / 2, ...mir }, v => {
          s.transform = `scale(${0.85 + 0.3 * v})`;
          s.opacity = String(0.4 + 0.6 * v);
        }),
      );
      break;
    case 'ping':
      a.push(
        val(0, 1, { duration: ld, ease: 'easeOut', ...B }, v => {
          s.transform = `scale(${1 + 1.1 * v})`;
          s.opacity = String(0.7 * (1 - v));
        }),
      );
      break;
    case 'bob':
      a.push(
        val(0, 1, { duration: ld / 2, ease: 'easeInOut', repeatType: 'mirror', ...B }, v => {
          s.transform = `translateY(${-5 * v}px)`;
        }),
      );
      break;
    case 'wave':
      a.push(
        val(0, 1, { duration: ld / 2, ease: 'easeInOut', repeatType: 'mirror', ...B }, v => {
          s.transform = `scaleY(${0.3 + 0.7 * v})`;
        }),
      );
      break;
    case 'dash':
      a.push(
        val(0, -8, { duration: 0.7, repeat: Infinity, ease: 'linear' }, v => {
          s.strokeDashoffset = String(v);
        }),
      );
      break;
    case 'blinkeye':
      a.push(
        val(0, 1, { duration: ld, ease: 'linear', ...B }, v => {
          s.transform = `scaleY(${v > 0.9 && v < 0.97 ? 0.1 : 1})`;
        }),
      );
      break;
    case 'look':
      a.push(
        val(0, 1, { duration: ld, ease: 'easeInOut', repeatType: 'mirror', ...B }, v => {
          s.transform = `translateX(${-3 + 6 * v}px)`;
        }),
      );
      break;
    case 'marquee':
      a.push(
        val(0, -50, { duration: ld, repeat: Infinity, ease: 'linear' }, v => {
          s.transform = `translateX(${v}%)`;
        }),
      );
      break;
  }
  const halt = stopper(a);
  return () => {
    halt();
    s.transform = '';
    s.opacity = '';
    if (kind === 'shimmer-text') {
      s.backgroundImage = '';
      s.backgroundSize = '';
      s.webkitBackgroundClip = '';
      s.backgroundClip = '';
      s.webkitTextFillColor = '';
      s.color = '';
    }
  };
}

/** Morphing "thinking" blob path (data-ai). */
export function blobPath(t: number, R: number, ph: number): string {
  const N = 8;
  const p: Array<[number, number]> = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 6.2832;
    const r =
      R *
      (1 +
        0.17 * Math.sin(a * 2 + t + ph) +
        0.11 * Math.sin(a * 3 - t * 2 + ph) +
        0.07 * Math.sin(a * 5 + t));
    p.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  const at = (i: number): [number, number] => p[((i % N) + N) % N] as [number, number];
  const f = (n: number) => n.toFixed(2);
  let d = `M${f(at(0)[0])} ${f(at(0)[1])}`;
  for (let i = 0; i < N; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

/** Drives the blob core/ring + glow of an AI glyph. `core`, `ring` are <path>, `glow` a <circle>. */
export function animateBlob(core: SVGPathElement, ring: SVGPathElement, glow: SVGElement): Stop {
  if (prefersReducedMotion()) return () => {};
  const a = [
    val(0, 6.2832, { duration: 5, repeat: Infinity, ease: 'linear' }, t => {
      core.setAttribute('d', blobPath(t, 22, 0));
      ring.setAttribute('d', blobPath(-t, 33, 2));
    }),
    val(0, 1, { duration: 1.1, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }, v => {
      glow.style.transform = `scale(${0.75 + 0.3 * v})`;
      glow.style.opacity = String(0.45 + 0.55 * v);
    }),
  ];
  return stopper(a);
}

/* ---------------- hover + tap (delegated; buttons get it automatically; data-nm opts out) ---------------- */

const num = (el: Element, k: string, d: number): number => {
  const v = parseFloat(el.getAttribute(k) ?? '');
  return Number.isNaN(v) ? d : v;
};

type Pressable = HTMLElement & { __h?: 0 | 1; __p?: 0 | 1 };

/** Installs delegated pointer listeners for hover (scale 1.02 default) and tap (0.97). Returns an uninstall fn. */
export function installHoverTap(doc: Document = document): () => void {
  let press: Pressable | null = null;
  const rest = { scale: 1, x: 0, y: 0 };
  const hv = (el: Element) => ({
    scale: num(el, 'data-hs', 1.02),
    x: num(el, 'data-hx', 0),
    y: num(el, 'data-hy', 0),
  });
  const tgt = (e: Event): Pressable | null => {
    const t = e.target as Element | null;
    const el = t && t.closest ? (t.closest('button,[data-hover],[data-tap]') as Pressable | null) : null;
    return el && !(el as HTMLButtonElement).disabled && !el.hasAttribute('data-nm') ? el : null;
  };
  const tappable = (el: Element) => el.tagName === 'BUTTON' || el.hasAttribute('data-tap');

  const over = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const el = tgt(e);
    if (!el || (e.relatedTarget && el.contains(e.relatedTarget as Node))) return;
    el.__h = 1;
    if (!el.__p) run(el, hv(el), SPRING.hover);
  };
  const out = (e: PointerEvent) => {
    const el = tgt(e);
    if (!el || (e.relatedTarget && el.contains(e.relatedTarget as Node))) return;
    el.__h = 0;
    if (!el.__p) run(el, rest, SPRING.hover);
  };
  const down = (e: PointerEvent) => {
    const el = tgt(e);
    if (!el || !tappable(el) || e.button > 0) return;
    el.__p = 1;
    press = el;
    run(el, { scale: 0.97 }, SPRING.hover);
  };
  const release = () => {
    const el = press;
    if (!el) return;
    press = null;
    el.__p = 0;
    run(el, el.__h ? hv(el) : rest, SPRING.hover);
  };
  doc.addEventListener('pointerover', over);
  doc.addEventListener('pointerout', out);
  doc.addEventListener('pointerdown', down, true);
  doc.addEventListener('pointerup', release, true);
  doc.addEventListener('pointercancel', release, true);
  return () => {
    doc.removeEventListener('pointerover', over);
    doc.removeEventListener('pointerout', out);
    doc.removeEventListener('pointerdown', down, true);
    doc.removeEventListener('pointerup', release, true);
    doc.removeEventListener('pointercancel', release, true);
  };
}
