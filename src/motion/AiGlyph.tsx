import { useEffect, useId, useRef } from 'react';
import { animateBlob, blobPath } from './engine';

/** `data-ai`: the morphing-blob "Pilot is thinking" glyph. Static blob under prefers-reduced-motion. */
export function AiGlyph({ size = 20, label = 'Pilot is thinking' }: { size?: number; label?: string }) {
  const gid = `spg${useId().replace(/:/g, '')}`;
  const glow = useRef<SVGCircleElement>(null);
  const core = useRef<SVGPathElement>(null);
  const ring = useRef<SVGPathElement>(null);
  useEffect(() => {
    if (!glow.current || !core.current || !ring.current) return;
    return animateBlob(core.current, ring.current, glow.current);
  }, []);
  return (
    <span
      role="img"
      aria-label={label}
      style={{ display: 'inline-block', flex: 'none', width: size, height: size, lineHeight: 0 }}
    >
      <svg
        viewBox="-50 -50 100 100"
        width={size}
        height={size}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <radialGradient id={gid}>
            <stop offset="0" stopColor="var(--accent)" stopOpacity={0.55} />
            <stop offset="1" stopColor="var(--accent)" stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle
          ref={glow}
          r="50"
          fill={`url(#${gid})`}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
        <path ref={core} style={{ fill: 'var(--accent)' }} d={blobPath(0, 22, 0)} />
        <path
          ref={ring}
          style={{ fill: 'none', stroke: 'var(--accent)', strokeWidth: 2.4, opacity: 0.65 }}
          d={blobPath(0, 33, 2)}
        />
      </svg>
    </span>
  );
}
