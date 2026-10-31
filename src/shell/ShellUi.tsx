import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type ShellUi = {
  paletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  navOpen: boolean;
  setNavOpen: (v: boolean) => void;
};

const Ctx = createContext<ShellUi | null>(null);

export function ShellUiProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPalette] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const openPalette = useCallback(() => setPalette(true), []);
  const closePalette = useCallback(() => setPalette(false), []);
  const togglePalette = useCallback(() => setPalette(p => !p), []);
  const value = useMemo(
    () => ({ paletteOpen, openPalette, closePalette, togglePalette, navOpen, setNavOpen }),
    [paletteOpen, openPalette, closePalette, togglePalette, navOpen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShellUi(): ShellUi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useShellUi must be used inside <ShellUiProvider>');
  return v;
}
