import { DISCLAIMER_TEXT, IEX_FOOTNOTE } from './disclaimer';

/** Appendix A disclaimer, verbatim, plus the IEX price footnote (SPEC §6.4.7, §11.4). */
export function Footer() {
  return (
    <footer className="shell__footer" data-testid="disclaimer-footer">
      <span data-testid="disclaimer-text">{DISCLAIMER_TEXT}</span>
      <span>{IEX_FOOTNOTE}</span>
    </footer>
  );
}
