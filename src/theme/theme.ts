export type Theme = 'light' | 'dark';

/** localStorage key used by the design prototype; kept so saved choices carry over. */
export const THEME_KEY = 'sp-theme2';
export const DEFAULT_THEME: Theme = 'dark';

export const readStoredTheme = (): Theme => {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

export const writeStoredTheme = (theme: Theme): void => {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable (private mode, blocked): the choice just is not persisted */
  }
};

export const applyTheme = (theme: Theme): void => {
  document.body.setAttribute('data-theme', theme);
};
