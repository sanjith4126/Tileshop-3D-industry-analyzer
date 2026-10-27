import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type Theme = 'dark' | 'light'

const KEY = 'tiletwin.theme'
const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null)

function initial(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

/** Dark "Kiln" is the control-room default; the choice is remembered per browser when storage is available. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initial)
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next // update CSS variables before the re-render reads them
    try { localStorage.setItem(KEY, next) } catch { /* storage unavailable: theme lasts for this session */ }
    setTheme(next)
  }
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext) ?? { theme: 'dark' as Theme, toggle: () => {} }
}

const TOKENS = ['canvas', 'surface', 'raised', 'line', 'line-strong', 'fg', 'muted', 'subtle', 'accent', 'series-1',
  'ok-fill', 'warn-fill', 'crit-fill', 'off-fill', 'unk-fill', 'scene-bg', 'scene-floor', 'scene-grid', 'scene-grid-major', 'scene-wall'] as const
export type ThemeColors = Record<(typeof TOKENS)[number], string>

// Used when CSS variables cannot be read (unit tests in jsdom).
const FALLBACK: ThemeColors = {
  canvas: '#0d0f12', surface: '#14171b', raised: '#1b1f24', line: '#252a31', 'line-strong': '#343a43', fg: '#eceef1', muted: '#a4abb6',
  subtle: '#848c99', accent: '#7398ff', 'series-1': '#3987e5', 'ok-fill': '#34c77f', 'warn-fill': '#f2b544', 'crit-fill': '#ff5c5c',
  'off-fill': '#6b717b', 'unk-fill': '#a681ff', 'scene-bg': '#0f1216', 'scene-floor': '#161a1f', 'scene-grid': '#232932',
  'scene-grid-major': '#323a45', 'scene-wall': '#2a313b',
}

/** Resolved token colours for canvas-based drawing (three.js, Recharts) that cannot use CSS variables. */
export function useThemeColors(): ThemeColors {
  const { theme } = useTheme()
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement)
    return Object.fromEntries(TOKENS.map((t) => [t, css.getPropertyValue(`--${t}`).trim() || FALLBACK[t]])) as ThemeColors
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])
}
