import { useState, type ReactNode } from 'react';
import { createQueryClient, QueryProvider } from '@/api/queryClient';
import { AuthProvider } from '@/auth/AuthProvider';
import { MotionRoot } from '@/motion';
import { StreamProvider } from '@/realtime';
import { TelemetryProvider } from '@/telemetry';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ToastProvider } from '@/ui';

/**
 * Provider stack, outermost first. The router renders inside it so guards and screens can use every hook:
 * theme → query cache → auth → toasts → motion (hover/tap + data-m layer) → telemetry → SSE stream.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient);
  return (
    <ThemeProvider>
      <QueryProvider client={client}>
        <AuthProvider>
          <ToastProvider>
            <MotionRoot>
              <TelemetryProvider>
                <StreamProvider>{children}</StreamProvider>
              </TelemetryProvider>
            </MotionRoot>
          </ToastProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
