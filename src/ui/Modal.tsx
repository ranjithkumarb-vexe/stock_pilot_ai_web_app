import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Enter } from '@/motion';
import { useFocusTrap } from './useFocusTrap';
import './ui.css';

type Common = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** visually hide the title (still the accessible name) */
  hideTitle?: boolean;
  children: ReactNode;
  testId?: string;
  /** role="alertdialog" for blocking messages (session expired); the backdrop then does not close it */
  alert?: boolean;
};

/** Centered dialog: fade backdrop + pop panel, focus trap, Esc and backdrop-click close (design z-index 70). */
export function Modal({
  open,
  onClose,
  title,
  hideTitle,
  children,
  width = 560,
  testId,
  alert,
}: Common & { width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open, alert ? undefined : onClose);
  if (!open) return null;
  return createPortal(
    <Enter
      kind="fade"
      className="sp-overlay"
      style={{ zIndex: alert ? 100 : 70 }}
      onMouseDown={e => {
        if (!alert && e.target === e.currentTarget) onClose();
      }}
    >
      <Enter kind="pop" className="sp-dialog" style={{ width }} data-testid={testId}>
        <div
          ref={ref}
          role={alert ? 'alertdialog' : 'dialog'}
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          style={{ display: 'grid', gap: 14, outline: 'none' }}
        >
          <h2 id={titleId} className={hideTitle ? 'sr-only' : undefined}>
            {title}
          </h2>
          {children}
        </div>
      </Enter>
    </Enter>,
    document.body,
  );
}

/** Right-hand drawer (citation drawer pattern): slide-in panel, z-index 60, 440px. */
export function Drawer({ open, onClose, title, children, testId }: Common) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open, onClose);
  if (!open) return null;
  return createPortal(
    <Enter
      kind="fade"
      className="sp-overlay sp-overlay--drawer"
      style={{ zIndex: 60 }}
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Enter kind="slide" as="aside" className="sp-drawer" data-testid={testId}>
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          style={{ display: 'grid', gap: 16, outline: 'none' }}
        >
          <h2 id={titleId} style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 24, margin: 0 }}>
            {title}
          </h2>
          {children}
        </div>
      </Enter>
    </Enter>,
    document.body,
  );
}
