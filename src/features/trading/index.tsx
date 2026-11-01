import { OrderLedger } from './OrderLedger';
import { OrderTicket } from './OrderTicket';
import { PerformancePanel } from './PerformancePanel';
import './shared.css';

/** FE-08 · Trading: paper order ticket (preview checks, idempotent submit), performance, order ledger. */
export default function Screen() {
  return (
    <div className="s3-screen" data-testid="screen-trading">
      <div className="s3-grid-2">
        <OrderTicket />
        <PerformancePanel />
      </div>
      <OrderLedger />
    </div>
  );
}
