import { describeError } from '@/api/errors';
import { useCancelOrder, useOrders } from '@/api/hooks/orders';
import type { Order } from '@/api/types';
import { ErrorPanel } from '@/shell/ErrorBoundary';
import { Pill, SkeletonBlock, useToast, type Tone } from '@/ui';
import { orderFillPrice, orderValue } from './api';
import { int, shortDate, shortId, usd0, usd2 } from './format';
import './shared.css';

const STATUS: Record<string, { label: string; tone: Tone }> = {
  filled: { label: 'Filled', tone: 'ok' },
  queued: { label: 'Queued', tone: 'warn' },
  working: { label: 'Working', tone: 'warn' },
  expired: { label: 'Expired', tone: 'n' },
  cancelled: { label: 'Cancelled', tone: 'n' },
  rejected: { label: 'Rejected', tone: 'bad' },
};
const cancellable = (o: Order) => o.status === 'queued' || o.status === 'working';

export function OrderLedger() {
  const orders = useOrders();
  const cancel = useCancelOrder();
  const toast = useToast();
  const items = orders.data?.items ?? [];

  const onCancel = (o: Order) =>
    cancel.mutate(o.id, {
      onSuccess: () => toast.say('Queued order cancelled'),
      onError: e => toast.say(describeError(e).message),
    });

  return (
    <section
      className="s3-card"
      style={{ padding: 0, gap: 0 }}
      data-testid="order-ledger"
      aria-labelledby="ledger-h"
    >
      <div style={{ padding: '16px 16px 8px' }}>
        <h2 id="ledger-h" className="s3-h2 s3-h2--sm">
          Order ledger
        </h2>
      </div>
      {orders.isLoading ? (
        <div style={{ padding: 16 }}>
          <SkeletonBlock label="Loading orders" widths={[100, 90, 95, 70]} />
        </div>
      ) : orders.isError ? (
        <div style={{ padding: 16 }}>
          <ErrorPanel
            error={orders.error}
            title="Could not load your orders"
            onRetry={() => void orders.refetch()}
          />
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-2)' }} data-testid="ledger-empty">
          No orders yet. Place a paper order above.
        </div>
      ) : (
        <div className="s3-table-wrap" tabIndex={0} role="region" aria-label="Paper orders (scrollable)">
          <table className="s3-table" style={{ minWidth: 820 }}>
            <caption className="sr-only">Paper orders, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Date</th>
                <th scope="col">Ticker</th>
                <th scope="col">Side</th>
                <th scope="col" className="r">
                  Qty
                </th>
                <th scope="col" className="r">
                  Fill
                </th>
                <th scope="col" className="r">
                  Value
                </th>
                <th scope="col">Source</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map(o => {
                const st = STATUS[o.status] ?? { label: String(o.status), tone: 'n' as Tone };
                return (
                  <tr key={o.id} data-testid={`order-row-${o.id}`}>
                    <td style={{ font: '400 12px var(--mono)', color: 'var(--ink-3)' }} title={o.id}>
                      {shortId(o.id)}
                    </td>
                    <td>{shortDate(o.created_at)}</td>
                    <td>
                      <b style={{ font: '600 13px var(--mono)' }}>{o.symbol}</b>
                    </td>
                    <td>
                      <Pill tone={o.side === 'buy' ? 'info' : 'n'}>{o.side === 'buy' ? 'Buy' : 'Sell'}</Pill>
                    </td>
                    <td className="r">{int(o.qty)}</td>
                    <td className="r">{usd2(orderFillPrice(o))}</td>
                    <td className="r">{usd0(orderValue(o))}</td>
                    <td style={{ color: 'var(--ink-2)' }}>
                      {o.source ?? (o.type === 'limit' ? 'Manual · limit' : 'Manual')}
                    </td>
                    <td>
                      <Pill tone={st.tone} data-testid={`order-status-${o.id}`}>
                        {st.label}
                      </Pill>
                    </td>
                    <td>
                      {cancellable(o) && (
                        <button
                          type="button"
                          className="s3-btn-sm"
                          data-testid={`cancel-${o.id}`}
                          aria-label={`Cancel order ${shortId(o.id)} for ${o.qty} ${o.symbol}`}
                          disabled={cancel.isPending && cancel.variables === o.id}
                          onClick={() => onCancel(o)}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
