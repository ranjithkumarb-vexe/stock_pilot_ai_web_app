import { useAuth } from '@/auth/useAuth';
import { BrandPanel } from './BrandPanel';
import { ChooseStep } from './ChooseStep';
import { MfaStep } from './MfaStep';

/**
 * Sign-in (FE-04): brand panel + either the account chooser (Google in Supabase mode, demo accounts in dev) or the
 * TOTP step when the identity provider reports `mfa_required`.
 */
export default function Screen() {
  const { status, verifyMfa, signOut } = useAuth();
  return (
    <div className="signin" data-testid="screen-signin">
      <style>{`
        .signin{min-height:100vh;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)}
        .signin__brand{position:relative;overflow:hidden;padding:48px 56px;display:flex;flex-direction:column;justify-content:space-between;gap:28px;color:oklch(0.965 0.008 100);background:radial-gradient(800px 500px at 80% 0%,oklch(0.9 0.19 122 / .1),transparent 60%),oklch(0.14 0.012 250)}
        .signin__hero{font:750 52px/1 var(--serif);font-stretch:118%;letter-spacing:-.03em;margin:0}
        .signin__form{display:flex;align-items:center;justify-content:center;padding:48px}
        @media (max-width: 899px){.signin{grid-template-columns:1fr}.signin__brand{padding:28px 20px;gap:20px}.signin__hero{font-size:34px}.signin__chart{display:none}.signin__form{padding:28px 20px}}
      `}</style>
      <BrandPanel />
      <main id="main" tabIndex={-1} className="signin__form">
        <div style={{ width: '100%', maxWidth: 380, display: 'grid', gap: 20 }}>
          {status === 'mfa_required' ? (
            <MfaStep onVerify={verifyMfa} onBack={() => void signOut()} />
          ) : (
            <ChooseStep />
          )}
        </div>
      </main>
    </div>
  );
}
