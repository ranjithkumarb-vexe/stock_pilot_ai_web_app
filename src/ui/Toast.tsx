import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Enter } from '@/motion';
import './ui.css';

export type StampTone = 'gain' | 'loss' | 'warn';
export type StampSpec = { word: string; line: string; tone?: StampTone };

type ToastCtx = {
  /** show one transient message for 3.2 s (a new one replaces the current) */
  say: (message: string) => void;
  /** full-screen "paper trade" stamp (fills, queued orders) for 2.3 s */
  stamp: (spec: StampSpec) => void;
};

const Ctx = createContext<ToastCtx | null>(null);
const TOAST_MS = 3200;
const STAMP_MS = 2300;

const toneVar = (t: StampTone) =>
  t === 'loss' ? 'var(--loss)' : t === 'warn' ? 'var(--warn)' : 'var(--gain)';

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const [seq, setSeq] = useState(0);
  const [stampSpec, setStampSpec] = useState<StampSpec | null>(null);
  const t1 = useRef<number | undefined>(undefined);
  const t2 = useRef<number | undefined>(undefined);

  const say = useCallback((m: string) => {
    window.clearTimeout(t1.current);
    setMsg(m);
    setSeq(n => n + 1);
    t1.current = window.setTimeout(() => setMsg(''), TOAST_MS);
  }, []);
  const stamp = useCallback((s: StampSpec) => {
    window.clearTimeout(t2.current);
    setStampSpec(s);
    t2.current = window.setTimeout(() => setStampSpec(null), STAMP_MS);
  }, []);
  useEffect(
    () => () => {
      window.clearTimeout(t1.current);
      window.clearTimeout(t2.current);
    },
    [],
  );

  const value = useMemo(() => ({ say, stamp }), [say, stamp]);
  const col = stampSpec ? toneVar(stampSpec.tone ?? 'gain') : '';

  return (
    <Ctx.Provider value={value}>
      {children}
      {createPortal(
        <>
          {/* live regions stay mounted so screen readers announce content changes */}
          <div role="status" aria-live="polite" data-testid="toast-region">
            {msg && (
              <Enter key={seq} kind="toast" className="sp-toast" data-testid="toast">
                {msg}
              </Enter>
            )}
          </div>
          <div role="status" aria-live="polite" data-testid="stamp-region">
            {stampSpec && (
              <Enter
                kind="stamp"
                data-testid="stamp"
                style={{ position: 'fixed', left: '50%', top: '46%', zIndex: 95, pointerEvents: 'none' }}
              >
                <div
                  style={{
                    display: 'grid',
                    justifyItems: 'center',
                    gap: 10,
                    padding: '26px 40px',
                    borderRadius: 18,
                    border: `2px solid ${col}`,
                    background: 'var(--bg)',
                    boxShadow: `var(--shadow),0 0 70px ${col}`,
                    color: 'var(--ink)',
                  }}
                >
                  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
                    <Enter
                      as="rect"
                      kind="draw"
                      len={160}
                      duration={0.6}
                      x="3"
                      y="3"
                      width="50"
                      height="50"
                      rx="14"
                      stroke={col}
                      strokeWidth="2.500"
                      style={{ strokeDasharray: 160 }}
                    />
                    <Enter
                      as="path"
                      kind="draw"
                      len={40}
                      duration={0.5}
                      delay={350}
                      d="M17 29l7 7 15-16"
                      stroke={col}
                      strokeWidth="3.500"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ strokeDasharray: 40 }}
                    />
                  </svg>
                  <div
                    style={{
                      font: '800 30px var(--serif)',
                      fontStretch: '125%',
                      letterSpacing: '.06em',
                      color: col,
                    }}
                  >
                    {stampSpec.word}
                  </div>
                  <div style={{ font: '500 14px var(--mono)' }}>{stampSpec.line}</div>
                  <div style={{ font: '500 11px var(--mono)', letterSpacing: '.1em', color: 'var(--ink-3)' }}>
                    PAPER TRADE · NO REAL ORDER
                  </div>
                </div>
              </Enter>
            )}
          </div>
        </>,
        document.body,
      )}
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast must be used inside <ToastProvider>');
  return v;
}
