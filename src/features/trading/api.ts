import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { describeError } from '@/api/errors';
import { newIdempotencyKey, useCreateOrder, usePreviewOrder } from '@/api/hooks/orders';
import type { FeedState, MarketStatus, Order, OrderCheck, OrderRequest, OrderResponse } from '@/api/types';
import { useToast } from '@/ui';
import { useTrack } from '@/telemetry';
import { num, usd2 } from './format';

/* ------------------------------------------------------------------------------------------------------------------
 * Shapes the contract leaves open. CONTRACT.md types `fill` / extra order fields as free-form; we read the likely keys
 * defensively and render "—" when the API does not send them. UNVERIFIED until the orders module publishes OpenAPI.
 * ---------------------------------------------------------------------------------------------------------------- */
const first = (o: Record<string, unknown> | null | undefined, keys: string[]): number | null => {
  if (!o) return null;
  for (const k of keys) {
    const v = num(o[k]);
    if (v != null) return v;
  }
  return null;
};

export type Estimate = { fillPrice: number | null; value: number | null; cashAfter: number | null };

/** Estimated fill / order value / cash after, as computed by the backend preview (never recomputed here). */
export function readEstimate(res: OrderResponse | null | undefined): Estimate {
  const fill = res?.fill ?? null;
  const order = (res?.order ?? null) as Record<string, unknown> | null;
  return {
    fillPrice:
      first(fill, ['price', 'fill_price', 'est_price', 'avg_price']) ??
      first(order, ['fill_price', 'est_fill_price', 'avg_fill_price']),
    value:
      first(fill, ['value', 'notional', 'order_value']) ?? first(order, ['value', 'notional', 'order_value']),
    cashAfter:
      first(fill, ['cash_after', 'cash_after_order']) ?? first(order, ['cash_after', 'cash_after_order']),
  };
}

export const orderFillPrice = (o: Order): number | null =>
  first(o, ['fill_price', 'avg_fill_price', 'filled_price', 'price']) ?? num(o.limit_price);
export const orderValue = (o: Order): number | null => {
  const direct = first(o, ['value', 'notional', 'fill_value']);
  if (direct != null) return direct;
  const px = orderFillPrice(o);
  return px != null ? Math.round(px * o.qty * 100) / 100 : null;
};

export const SEVERITY: Record<OrderCheck['severity'], { mark: string; tone: 'ok' | 'warn' | 'bad' }> = {
  pass: { mark: 'Pass', tone: 'ok' },
  note: { mark: 'Note', tone: 'warn' },
  blocked: { mark: 'Blocked', tone: 'bad' },
};

/* ---------------- preview (debounced, latest-wins) ---------------- */
export function useOrderPreview(req: OrderRequest | null, delayMs = 250) {
  const preview = usePreviewOrder();
  const mutate = preview.mutate;
  const reset = preview.reset;
  const [settled, setSettled] = useState('');
  const sig = req ? JSON.stringify(req) : '';
  useEffect(() => {
    if (!sig) {
      reset();
      return;
    }
    const t = setTimeout(() => {
      const done = () => setSettled(sig);
      // per-call callbacks only fire for the latest mutate(): older in-flight previews are ignored
      mutate(JSON.parse(sig) as OrderRequest, { onSuccess: done, onError: done });
    }, delayMs);
    return () => clearTimeout(t);
  }, [sig, delayMs, mutate, reset]);
  const fresh = !!sig && settled === sig;
  return {
    checks: fresh ? (preview.data?.checks ?? null) : null,
    blocked: fresh ? (preview.data?.blocked ?? false) : false,
    estimate: readEstimate(fresh ? preview.data : null),
    loading: !!sig && !fresh,
    error: fresh ? preview.error : null,
    retry: () => {
      if (sig)
        mutate(JSON.parse(sig) as OrderRequest, {
          onSuccess: () => setSettled(sig),
          onError: () => setSettled(sig),
        });
    },
  };
}

/* ---------------- submit: one idempotency key per ticket, double-click protection ---------------- */
const THROTTLE_MS = 800;

export type SubmitOutcome =
  | { kind: 'filled' | 'queued' | 'working'; res: OrderResponse; replayed: boolean }
  | { kind: 'blocked'; res: OrderResponse; replayed: boolean }
  | { kind: 'rejected'; res: OrderResponse; replayed: boolean }
  | { kind: 'error'; error: unknown };

/**
 * Submits a paper order exactly once per intent:
 *  - ONE Idempotency-Key per ticket. It is reused for retries/double clicks of the SAME body, regenerated when the
 *    body changes or after a successful submit.
 *  - a synchronous in-flight guard + an 800 ms throttle (design) make a double click send a single POST.
 */
export function useOrderSubmit() {
  const create = useCreateOrder();
  const toast = useToast();
  const track = useTrack();
  const keyRef = useRef<{ sig: string; key: string } | null>(null);
  const inflight = useRef(false);
  const lastDone = useRef(0);
  const mutateAsync = create.mutateAsync;

  const submit = useCallback(
    async (req: OrderRequest, ctx: { source?: string } = {}): Promise<SubmitOutcome | null> => {
      if (inflight.current || Date.now() - lastDone.current < THROTTLE_MS) return null;
      inflight.current = true;
      try {
        const sig = JSON.stringify(req);
        if (!keyRef.current || keyRef.current.sig !== sig) keyRef.current = { sig, key: newIdempotencyKey() };
        const r = await mutateAsync({ body: req, idempotencyKey: keyRef.current.key });
        const res = r.data;
        keyRef.current = null;
        lastDone.current = Date.now();
        const status = res.order?.status;
        const px = readEstimate(res).fillPrice ?? num(res.order?.limit_price);
        const line = `${req.side === 'buy' ? 'BUY' : 'SELL'} ${req.qty} ${req.symbol}${px != null ? ` @ ${usd2(px)}` : ''}`;
        const entity = { ticker: req.symbol };
        if (res.blocked || !res.order || status === 'rejected') {
          toast.say('Blocked by your rules. Nothing was placed.');
          return { kind: res.blocked || !res.order ? 'blocked' : 'rejected', res, replayed: r.replayed };
        }
        track({ type: 'order_placed', entity, props: { action: req.side, source: ctx.source ?? 'manual' } });
        if (status === 'filled') {
          track({ type: 'order_filled', entity, props: { action: req.side } });
          toast.stamp({ word: 'FILLED', line, tone: 'gain' });
          return { kind: 'filled', res, replayed: r.replayed };
        }
        toast.stamp({ word: status === 'working' ? 'WORKING' : 'QUEUED', line, tone: 'warn' });
        return { kind: status === 'working' ? 'working' : 'queued', res, replayed: r.replayed };
      } catch (error) {
        const d = describeError(error);
        toast.say(d.message);
        return { kind: 'error', error };
      } finally {
        inflight.current = false;
      }
    },
    [mutateAsync, toast, track],
  );

  return useMemo(
    () => ({ submit, pending: create.isPending, error: create.error, reset: create.reset }),
    [submit, create.isPending, create.error, create.reset],
  );
}

/**
 * The live backend names the feed field `feed_state` (CONTRACT.md / FE types guessed `feed`). Read both so screens work
 * against either; see HANDOFF CR-S3-1.
 */
export const feedOf = (m: MarketStatus | undefined): FeedState | undefined =>
  (m as (MarketStatus & { feed_state?: FeedState }) | undefined)?.feed_state ?? m?.feed;
