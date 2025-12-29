'use client';

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "ndi-hr-theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

type ThemeProviderProps = {
  children: ReactNode;
};

const applyThemeToRoot = (theme: ResolvedTheme) => {
  if (typeof document === "undefined") return;
  const rootElement = document.documentElement;
  rootElement.classList.toggle("dark", theme === "dark");
  rootElement.setAttribute("data-theme", theme);
};

const getStoredPreference = (): ThemePreference => {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY) as
    | ThemePreference
    | null;
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
};

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(
    getSystemTheme()
  );
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedPreference = getStoredPreference();
    const nextResolved =
      storedPreference === "system" ? getSystemTheme() : storedPreference;

    applyThemeToRoot(nextResolved);
    startTransition(() => {
      setPreferenceState(storedPreference);
      setResolvedTheme(nextResolved);
      setHasHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !hasHydrated) return;

    const nextResolved =
      preference === "system" ? getSystemTheme() : preference;

    applyThemeToRoot(nextResolved);
    startTransition(() => setResolvedTheme(nextResolved));

    window.localStorage.setItem(STORAGE_KEY, preference);
  }, [preference, hasHydrated]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !hasHydrated ||
      preference !== "system"
    )
      return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      const nextResolved: ResolvedTheme = event.matches ? "dark" : "light";
      applyThemeToRoot(nextResolved);
      startTransition(() => setResolvedTheme(nextResolved));
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [preference, hasHydrated]);

  const setPreference = useCallback((next: ThemePreference) => {
    startTransition(() => setPreferenceState(next));
  }, []);

  const toggleTheme = useCallback(() => {
    startTransition(() =>
      setPreferenceState((current) => {
        if (current === "system") {
          return resolvedTheme === "dark" ? "light" : "dark";
        }
        return current === "dark" ? "light" : "dark";
      })
    );
  }, [resolvedTheme]);

  const value = useMemo(
    () => ({
      preference,
      resolvedTheme,
      setPreference,
      toggleTheme,
    }),
    [preference, resolvedTheme, setPreference, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
