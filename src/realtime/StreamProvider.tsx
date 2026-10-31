import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '@/api/keys';
import { fetchStreamToken } from '@/api/hooks/quotes';
import { V1 } from '@/api/client';
import type { StreamEvent } from '@/api/types';
import { useAuth } from '@/auth/useAuth';
import { getApiBaseUrl } from '@/lib/env';
import { clearLiveQuotes, pushQuote } from './quoteStore';
import { StreamClient, type StreamState } from './sseClient';

type StreamCtx = {
  state: StreamState;
  /** ms epoch of the last event (incl. heartbeat); null before the first */
  lastEventAt: number | null;
  /** retry immediately ("Reconnect now") */
  reconnect: () => void;
  /** subscribe to raw events (alert toasts, proposal badges…). Returns unsubscribe. */
  subscribe: (fn: (e: StreamEvent) => void) => () => void;
};

const Ctx = createContext<StreamCtx | null>(null);

/**
 * Owns the single SSE connection while signed in. quote → live quote store; alert/proposal → invalidate caches
 * so badges, feed and lists refresh; heartbeat → liveness only.
 */
export function StreamProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const qc = useQueryClient();
  const [state, setState] = useState<StreamState>('offline');
  const [lastEventAt, setLast] = useState<number | null>(null);
  const clientRef = useRef<StreamClient | null>(null);
  const subs = useRef(new Set<(e: StreamEvent) => void>());

  useEffect(() => {
    if (status !== 'signed_in') return;
    const client = new StreamClient({
      fetchToken: async signal => (await fetchStreamToken(signal)).token,
      buildUrl: (token, lastId) => {
        const u = new URL(`${getApiBaseUrl()}${V1}/stream`, window.location.origin);
        u.searchParams.set('token', token);
        if (lastId) u.searchParams.set('last_event_id', lastId);
        return u.toString();
      },
      onState: setState,
      onEvent: e => {
        setLast(Date.now());
        if (e.type === 'quote') pushQuote(e.data);
        else if (e.type === 'alert') {
          void qc.invalidateQueries({ queryKey: qk.alerts.all });
          void qc.invalidateQueries({ queryKey: qk.feed });
        } else if (e.type === 'proposal') {
          void qc.invalidateQueries({ queryKey: qk.proposals.all });
          void qc.invalidateQueries({ queryKey: qk.feed });
        }
        subs.current.forEach(fn => fn(e));
      },
    });
    clientRef.current = client;
    client.start();
    const onOff = () => client.handleOffline();
    const onOn = () => client.handleOnline();
    window.addEventListener('offline', onOff);
    window.addEventListener('online', onOn);
    return () => {
      window.removeEventListener('offline', onOff);
      window.removeEventListener('online', onOn);
      client.stop();
      clientRef.current = null;
      clearLiveQuotes();
    };
  }, [status, qc]);

  const value = useMemo<StreamCtx>(
    () => ({
      state: status === 'signed_in' ? state : 'offline',
      lastEventAt,
      reconnect: () => clientRef.current?.handleOnline(),
      subscribe: fn => {
        subs.current.add(fn);
        return () => subs.current.delete(fn);
      },
    }),
    [state, lastEventAt, status],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStream(): StreamCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStream must be used inside <StreamProvider>');
  return v;
}
