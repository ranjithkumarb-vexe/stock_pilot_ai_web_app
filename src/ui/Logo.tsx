import { Enter } from '@/motion';

type LogoMarkProps = {
  size?: number;
  /** stroke/fill for the check + waypoint; the brackets use currentColor */
  accent?: string;
  /** play the draw-in animation of the check (design: data-m="draw" data-md=200) */
  animate?: boolean;
};

/** The "Verified Heading" mark: brackets = citation, check = verification, waypoint = your heading. 32-unit grid. */
export function LogoMark({ size = 26, accent = 'var(--accent)', animate = true }: LogoMarkProps) {
  const check = (
    <path
      d="M8.500 17.500l5 5L24 10"
      stroke={accent}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ strokeDasharray: 40 }}
    />
  );
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      style={{ flex: 'none', display: 'block' }}
    >
      <path d="M4 12V4h8M28 20v8h-8" stroke="currentColor" strokeWidth="2.6" strokeLinecap="square" />
      {animate ? (
        <Enter
          as="path"
          kind="draw"
          len={40}
          delay={200}
          d="M8.500 17.500l5 5L24 10"
          stroke={accent}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ strokeDasharray: 40 }}
        />
      ) : (
        check
      )}
      <circle cx="24" cy="10" r="2.700" fill={accent} />
    </svg>
  );
}

/** Mark + wordmark, as in the sidebar (`AI` tag) and sign-in screen. */
export function Wordmark({ size = 26, tag = true }: { size?: number; tag?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <LogoMark size={size} />
      <span style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500 }}>StockPilot</span>
      {tag && (
        <span
          style={{
            font: '600 10px var(--mono)',
            letterSpacing: '.08em',
            color: 'var(--ink-3)',
            border: '1px solid var(--line-strong)',
            borderRadius: 4,
            padding: '0 4px',
          }}
        >
          AI
        </span>
      )}
    </span>
  );
}
