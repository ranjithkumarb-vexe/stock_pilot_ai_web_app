import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Enter } from '@/motion';
import { IconButton } from '@/ui/Button';
import { Icon } from '@/ui/icons';
import { useFocusTrap } from '@/ui/useFocusTrap';
import { Sidebar } from './Sidebar';
import { useShellUi } from './ShellUi';

/** < 900px: the sidebar slides in as a modal drawer (focus trapped, Esc / backdrop / navigation closes it). */
export function MobileNav() {
  const { navOpen, setNavOpen } = useShellUi();
  const { pathname } = useLocation();
  const panel = useRef<HTMLDivElement>(null);
  const close = () => setNavOpen(false);
  useFocusTrap(panel, navOpen, close);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname, setNavOpen]);

  if (!navOpen) return null;
  return createPortal(
    <Enter
      kind="fade"
      className="mobile-nav"
      data-testid="mobile-nav"
      onMouseDown={e => e.target === e.currentTarget && close()}
    >
      <Enter kind="slide" as="div" className="mobile-nav__panel">
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          tabIndex={-1}
          style={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: '100%', outline: 'none' }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton aria-label="Close navigation" data-testid="nav-close" onClick={close}>
              <Icon name="close" size={16} />
            </IconButton>
          </div>
          <Sidebar onNavigate={close} />
        </div>
      </Enter>
    </Enter>,
    document.body,
  );
}
