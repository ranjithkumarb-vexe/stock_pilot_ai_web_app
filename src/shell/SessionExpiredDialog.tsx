import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import { Button } from '@/ui/Button';
import { Modal } from '@/ui/Modal';

/** Blocking message shown after a 401 / idle timeout (design `sessExp`). Ledger, rules and drafts are saved server-side. */
export function SessionExpiredDialog() {
  const { status, endedBy, signOut } = useAuth();
  const navigate = useNavigate();
  const open = status === 'signed_out' && endedBy === 'expired';
  return (
    <Modal open={open} alert onClose={() => {}} title="Session expired" width={440} testId="session-expired">
      <span style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>
        For your security you were signed out after 30 minutes of inactivity. Your paper ledger, rules and
        drafts are saved. Sign in again to continue.
      </span>
      <Button
        variant="primary"
        size="lg"
        data-autofocus
        data-testid="session-expired-signin"
        onClick={() => {
          void signOut(); // clears the "expired" marker
          navigate('/signin', { replace: true });
        }}
      >
        Sign in again
      </Button>
    </Modal>
  );
}
