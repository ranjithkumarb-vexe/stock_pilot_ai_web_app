import { useContext, useEffect, useRef, type RefObject } from 'react';
import { DwellTimer } from './dwell';
import { TrackerContext } from './context';
import type { TelemetryEvent } from '@/api/types';

/**
 * Emits one `section_dwell` event ({entity:{section}, props:{dwell_ms}}) when the section unmounts or `section`
 * changes, if the user stayed >= `minMs` (default 1000). Counting pauses while the tab is hidden and, when a `ref`
 * is attached to an element, while that element is less than half in view.
 *
 *   const ref = useDwell('risk', { entity: { ticker: 'JNJ' } });  return <section ref={ref}>…</section>;
 */
export function useDwell<T extends Element = HTMLElement>(
  section: string,
  opts: { minMs?: number; entity?: Omit<TelemetryEvent['entity'], 'section'>; enabled?: boolean } = {},
): RefObject<T | null> {
  const tracker = useContext(TrackerContext);
  const ref = useRef<T | null>(null);
  const { minMs = 1000, enabled = true } = opts;
  const entityKey = JSON.stringify(opts.entity ?? {});

  useEffect(() => {
    if (!enabled || !tracker) return;
    const timer = new DwellTimer();
    let visible = document.visibilityState !== 'hidden';
    let inView = true;
    const sync = () => (visible && inView ? timer.resume() : timer.pause());

    const el = ref.current;
    let io: IntersectionObserver | undefined;
    if (el && typeof IntersectionObserver !== 'undefined') {
      inView = false;
      io = new IntersectionObserver(
        entries => {
          inView = entries.some(e => e.isIntersecting && e.intersectionRatio >= 0.5);
          sync();
        },
        { threshold: [0, 0.5, 1] },
      );
      io.observe(el);
    }
    const onVis = () => {
      visible = document.visibilityState !== 'hidden';
      sync();
    };
    document.addEventListener('visibilitychange', onVis);
    sync();

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      io?.disconnect();
      const ms = timer.finish();
      if (ms >= minMs) {
        tracker.track({
          type: 'section_dwell',
          entity: { ...(JSON.parse(entityKey) as object), section },
          props: { dwell_ms: ms },
        });
      }
    };
  }, [tracker, section, minMs, enabled, entityKey]);

  return ref;
}
