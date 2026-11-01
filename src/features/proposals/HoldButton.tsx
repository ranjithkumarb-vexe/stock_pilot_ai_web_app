import { useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  label: string;
  holdingLabel?: string;
  ariaLabel: string;
  disabled?: boolean;
  onConfirm: () => void;
  ms?: number;
  testId?: string;
};

const prefersReduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Design "press and hold" approve button (900 ms). Pointer: hold until the fill completes; releasing early cancels.
 * Keyboard and assistive tech: a normal activation (Enter / Space / click with detail 0) approves immediately.
 */
export function HoldButton({
  label,
  holdingLabel = 'Keep holding',
  ariaLabel,
  disabled,
  onConfirm,
  ms = 900,
  testId,
}: Props) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const confirm = useRef(onConfirm);
  useEffect(() => {
    confirm.current = onConfirm;
  });
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const end = () => {
    window.clearTimeout(timer.current);
    setHolding(false);
  };
  const start = (e: React.PointerEvent) => {
    if (disabled || e.button > 0) return;
    setHolding(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setHolding(false);
      confirm.current();
    }, ms);
  };
  const fill: ReactNode = (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'oklch(0.2 0.04 125 / .22)',
        transformOrigin: 'left',
        transform: `scaleX(${holding ? 1 : 0})`,
        transition: prefersReduced()
          ? 'none'
          : holding
            ? `transform ${ms}ms linear`
            : 'transform .2s ease-out',
      }}
    />
  );
  return (
    <button
      type="button"
      data-testid={testId}
      data-holding={holding}
      disabled={disabled}
      aria-label={`${ariaLabel}. Press and hold, or press Enter.`}
      onPointerDown={start}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={end}
      onContextMenu={e => e.preventDefault()}
      onClick={e => {
        // detail 0 = keyboard / assistive-tech activation; mouse and touch go through the hold
        if (e.detail === 0 && !disabled) confirm.current();
      }}
      className="pp-hold"
    >
      {fill}
      <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 10l4 4 8-8" />
        </svg>
        {holding ? holdingLabel : label}
      </span>
    </button>
  );
}
