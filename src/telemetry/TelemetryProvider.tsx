import { useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { api, V1 } from '@/api/client';
import { qk } from '@/api/keys';
import type { EventsResponse, MarketStatus, TelemetryEvent } from '@/api/types';
import { useAuth } from '@/auth/useAuth';
import { getToken } from '@/auth/session';
import { getApiBaseUrl } from '@/lib/env';
import { useQueryClient } from '@tanstack/react-query';
import { Tracker, deviceClass, getSessionId, type TrackInput } from './tracker';
import { TrackerContext as Ctx } from './context';

/** Creates the app tracker, starts it while signed in, flushes on page hide and emits `session_started` once per sign-in. */
export function TelemetryProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const qc = useQueryClient();

  const tracker = useMemo(
    () =>
      new Tracker({
        sessionId: getSessionId(),
        isOnline: () => navigator.onLine !== false,
        device: () => deviceClass(window.innerWidth),
        context: () => {
          const m = qc.getQueryData<MarketStatus>(qk.market);
          return m ? { market_session: m.session } : {};
        },
        transport: {
          send: async events =>
            (await api.request<EventsResponse>(`${V1}/events`, { method: 'POST', body: { events } })).data,
          unload: events => {
            const token = getToken();
            if (!token || typeof fetch !== 'function') return false;
            void fetch(`${getApiBaseUrl()}${V1}/events`, {
              method: 'POST',
              keepalive: true,
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ events }),
              credentials: 'omit',
            }).catch(() => {});
            return true;
          },
        },
      }),
    [qc],
  );

  const started = useRef(false);
  useEffect(() => {
    if (status !== 'signed_in') {
      tracker.stop();
      tracker.clear();
      started.current = false;
      return;
    }
    tracker.start();
    if (!started.current) {
      started.current = true;
      tracker.track({ type: 'session_started' });
    }
    const hide = () => {
      if (document.visibilityState === 'hidden') tracker.flushOnUnload();
    };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', hide);
    const online = () => void tracker.flush();
    window.addEventListener('online', online);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('online', online);
      tracker.stop();
    };
  }, [status, tracker]);

  return <Ctx.Provider value={tracker}>{children}</Ctx.Provider>;
}

/** `const track = useTrack(); track({type:'ticker_viewed', entity:{ticker:'JNJ'}})` */
export function useTrack(): (e: TrackInput) => TelemetryEvent {
  const t = useContext(Ctx);
  if (!t) throw new Error('useTrack must be used inside <TelemetryProvider>');
  return useCallback((e: TrackInput) => t.track(e), [t]);
}
