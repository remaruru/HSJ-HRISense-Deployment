import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

type Theme = "light" | "dark";

interface ThemeContextType {
  /** The signed-in account's theme (the app shell, Settings, the top-bar toggle). */
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  /** The visitor's theme on public pages (landing, login, careers). */
  isGuestDark: boolean;
  toggleGuestTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Two independent light/dark choices:
 *
 * - **Account** — each signed-in account keeps its own (`hrisense_theme:<userId>`),
 *   so HR's dark mode does not follow the next person who signs in on the same PC.
 * - **Guest** — the public pages (landing, login, careers) have their own switch
 *   on the landing page (`hrisense_theme:guest`, light by default). Signing out
 *   therefore lands on whatever the public pages were set to, never on a dark
 *   page with no way back.
 *
 * Which one is on screen is decided by the page itself via `useThemeScope`.
 * `hrisense_theme` mirrors the current session's account choice for the
 * pre-paint script in index.html (no white flash on reload); cleared on sign-out.
 */
const userKey = (userId: string) => `hrisense_theme:${userId}`;
const GUEST_KEY = "hrisense_theme:guest";
const ACTIVE_KEY = "hrisense_theme";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* blocked storage — the choice just lasts for this visit */
  }
}

function accountTheme(userId: string | null): Theme {
  if (!userId) return "light";
  const stored = read(userKey(userId));
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Storage is the source of truth (one localStorage read per render is cheap);
  // `rerender` just makes a change visible straight away.
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const theme = accountTheme(userId);
  const isGuestDark = read(GUEST_KEY) === "dark";

  useEffect(() => {
    write(ACTIVE_KEY, userId ? theme : null);
  }, [userId, theme]);

  const setTheme = useCallback(
    (next: Theme) => {
      if (!userId) return;
      write(userKey(userId), next);
      rerender();
    },
    [userId]
  );

  const toggleTheme = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [setTheme, theme]);

  const toggleGuestTheme = useCallback(() => {
    write(GUEST_KEY, isGuestDark ? "light" : "dark");
    rerender();
  }, [isGuestDark]);

  const value = useMemo(
    () => ({ theme, isDark: theme === "dark", setTheme, toggleTheme, isGuestDark, toggleGuestTheme }),
    [theme, setTheme, toggleTheme, isGuestDark, toggleGuestTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

/**
 * Puts the right theme on <html> while this page is on screen and takes it off
 * when the page leaves. The app shell uses the account's theme; public pages
 * use the visitor's. Pages that call neither are always light.
 */
export function useThemeScope(scope: "account" | "guest") {
  const { isDark, isGuestDark } = useTheme();
  const dark = scope === "account" ? isDark : isGuestDark;
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  useEffect(() => () => document.documentElement.classList.remove("dark"), []);
}
