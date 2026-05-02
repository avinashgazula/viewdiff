import { useCallback, useState } from 'react'

export interface Settings {
  fontSize: number
  tabSize: number
  printWidth: number
  renderWhitespace: 'none' | 'boundary' | 'all' | 'selection' | 'trailing'
  lineNumbers: 'on' | 'off' | 'relative'
  minimap: boolean
  folding: boolean
  bracketColors: boolean
  indentGuides: boolean
  autocomplete: boolean
  lineHeight: number
  cursorStyle: 'line' | 'block' | 'underline'
  cursorBlinking: 'blink' | 'smooth' | 'phase' | 'expand' | 'solid'
  smoothScrolling: boolean
  renderLineHighlight: 'none' | 'gutter' | 'line' | 'all'
  matchBrackets: 'always' | 'near' | 'never'
  ignoreCase: boolean
  ignoreWhitespace: boolean
  ignoreBlankLines: boolean
  diffAlgorithm: 'smart' | 'legacy'
  lineFilter: string
  showMoves: boolean
}

const DEFAULTS: Settings = {
  fontSize: 13,
  tabSize: 2,
  printWidth: 80,
  renderWhitespace: 'none',
  lineNumbers: 'on',
  minimap: false,
  folding: true,
  bracketColors: true,
  indentGuides: true,
  autocomplete: true,
  lineHeight: 21,
  cursorStyle: 'line',
  cursorBlinking: 'blink',
  smoothScrolling: false,
  renderLineHighlight: 'line',
  matchBrackets: 'always',
  ignoreCase: false,
  ignoreWhitespace: false,
  ignoreBlankLines: false,
  diffAlgorithm: 'smart',
  lineFilter: '',
  showMoves: true,
}

const STORAGE_KEY = 'diff-settings'

function load(): Settings {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

function save(settings: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function useSettings() {
  const [settings, setSettings] = useState(load)

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value }
      save(next)
      return next
    })
  }, [])

  const reset = useCallback(() => {
    setSettings(DEFAULTS)
    save(DEFAULTS)
  }, [])

  return { settings, update, reset }
}
