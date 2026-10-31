declare module 'jest-axe' {
  export type AxeResults = {
    violations: Array<{ id: string; impact?: string | null; help: string; nodes: unknown[] }>;
  };
  export function axe(html: Element | string, options?: Record<string, unknown>): Promise<AxeResults>;
  export const toHaveNoViolations: Record<string, (received: any) => { pass: boolean; message(): string }>; // eslint-disable-line @typescript-eslint/no-explicit-any
  export function configureAxe(options?: Record<string, unknown>): typeof axe;
}
