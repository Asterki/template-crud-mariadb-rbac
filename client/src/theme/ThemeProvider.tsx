import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { App as AntdApp, ConfigProvider } from "antd";
import { useTranslation } from "react-i18next";

import { brand } from "../config/brand";
import { getAntdLocale } from "./antd-locale";
import { buildTheme, type ThemeMode } from "./tokens";

const STORAGE_KEY = "theme-mode";

type ThemeModeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "light";

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyDocumentTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
  root.style.setProperty("--brand-primary", brand.brandColor);
  root.style.setProperty(
    "--color-bg",
    mode === "dark" ? "#0f1115" : "#f5f7fa",
  );
  root.style.setProperty(
    "--color-text",
    mode === "dark" ? "rgba(255, 255, 255, 0.88)" : "rgba(0, 0, 0, 0.88)",
  );
}

type ThemeProviderProps = {
  children: ReactNode;
};

/**
 * The application's only Ant Design provider. Owns the colour mode, the AntD
 * theme tokens and the AntD locale derived from the active i18n language.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);
  const { i18n } = useTranslation();

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode);
    applyDocumentTheme(mode);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  const themeConfig = useMemo(() => buildTheme(mode, brand), [mode]);
  const locale = useMemo(
    () => getAntdLocale(i18n.resolvedLanguage ?? i18n.language),
    [i18n.language, i18n.resolvedLanguage],
  );

  const value = useMemo<ThemeModeContextValue>(
    () => ({ mode, isDark: mode === "dark", setMode, toggleMode }),
    [mode, setMode, toggleMode],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ConfigProvider theme={themeConfig} locale={locale}>
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeContextValue {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error("useThemeMode must be used inside ThemeProvider");
  }
  return context;
}
