import type { SVGProps } from 'react';

/** Path data copied from the design nav + header (20x20 viewBox, stroke icons). */
export const ICON_PATHS = {
  dashboard: 'M3 3h6v6H3zM11 3h6v4h-6zM11 9h6v8h-6zM3 11h6v6H3z',
  watchlist: 'M10 4C5 4 2 10 2 10s3 6 8 6 8-6 8-6-3-6-8-6zm0 3.500a2.500 2.500 0 100 5 2.500 2.500 0 000-5z',
  brief: 'M5 2h7l4 4v12H5zM12 2v4h4M8 10h5M8 13h5',
  portfolio: 'M3 16h14M5 16V9m5 7V4m5 12v-5',
  proposals: 'M4 10l4 4 8-8',
  trading: 'M3 14l4-5 3 3 6-7M13 5h3v3',
  live: 'M3 16V8m4 8V4m4 12V9m4 7V6M2 17h16',
  alerts: 'M10 3a5 5 0 00-5 5v3l-1.500 3h13L15 11V8a5 5 0 00-5-5zm-2 12a2 2 0 004 0',
  ask: 'M3 4h14v10H9l-4 3v-3H3z',
  profile: 'M10 10a3.500 3.500 0 100-7 3.500 3.500 0 000 7zm-7 7c0-3.500 3-5 7-5s7 1.500 7 5',
  audit: 'M10 2l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V5z',
  moon: 'M16 12A7 7 0 018 4a7 7 0 108 8z',
  sparkle: 'M10 2l1.8 5.2L17 9l-5.200 1.800L10 16l-1.800-5.200L3 9l5.200-1.800z',
  close: 'M5 5l10 10M15 5L5 15',
  menu: 'M3 6h14M3 10h14M3 14h14',
  check: 'M4 10l4 4 8-8',
} as const;

export type IconName = keyof typeof ICON_PATHS;

type IconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & { name: IconName; size?: number };

/** Stroke icon on a 20x20 grid; decorative unless an aria-label is passed. */
export function Icon({ name, size = 18, strokeWidth = 1.6, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={rest['aria-label'] ? undefined : true}
      {...rest}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

export function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M17 9.2c0-.6-.1-1.1-.2-1.6H9v3h4.5a4 4 0 01-1.7 2.6v2h2.8c1.6-1.500 2.400-3.700 2.400-6z"
        fill="#4285F4"
      />
      <path
        d="M9 17.500c2.300 0 4.300-.8 5.700-2.100l-2.800-2.100c-.8.5-1.800.9-2.900.9-2.200 0-4.100-1.500-4.800-3.500H1.300v2.200A8.500 8.500 0 009 17.500z"
        fill="#34A853"
      />
      <path d="M4.200 10.700a5.100 5.100 0 010-3.300V5.200H1.300a8.500 8.500 0 000 7.600z" fill="#FBBC05" />
      <path
        d="M9 3.800c1.300 0 2.400.4 3.300 1.300l2.500-2.500A8.500 8.500 0 001.300 5.200l2.900 2.200C4.900 5.300 6.800 3.800 9 3.800z"
        fill="#EA4335"
      />
    </svg>
  );
}
