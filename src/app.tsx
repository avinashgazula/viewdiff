import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

import { ColumnLabels } from './components/column-labels'
import { EmptyState } from './components/empty-state'
import { SettingsPanel } from './components/settings-panel'
import { StatusBar } from './components/status-bar'
import { Toolbar } from './components/toolbar'
import { languages } from './config'
import { canFormat, computeStats, detectLanguage, formatCode, type DiffStats } from './diff'
import { useSettings } from './hooks/use-settings'
import { useTheme } from './hooks/use-theme'
import { CommandPalette, type Command } from './palette'
import { registerThemes } from './themes'

const LazyDiffEditor = lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.DiffEditor }))
)

const EMPTY_STATS: DiffStats = { additions: 0, deletions: 0, changes: 0 }

function EditorLoading() {
  return (
    <div className="flex items-center justify-center h-full" style={{ background: 'var(--bg)' }}>
      <span className="text-[13px]" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
        Loading editor...
      </span>
    </div>
  )
}

export function App() {
  const { dark, toggle: toggleTheme } = useTheme()
  const { settings, update: updateSetting, reset: resetSettings } = useSettings()

  const [language, setLanguage] = useState('auto')
  const [detectedLang, setDetectedLang] = useState('plaintext')
  const [inline, setInline] = useState(false)
  const [wordWrap, setWordWrap] = useState(false)
  const [stats, setStats] = useState(EMPTY_STATS)
  const [formatting, setFormatting] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hasContent, setHasContent] = useState(false)

  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)

  // Stores original-cased text when ignore case is active
  const caseCacheRef = useRef<{ original: string; modified: string } | null>(null)
  const ignoreCaseActiveRef = useRef(false)

  // Refs for values accessed inside Monaco event handlers,
  // where stale closures would otherwise read outdated state.
  const langRef = useRef(language)
  const detectedRef = useRef(detectedLang)
  const settingsRef = useRef(settings)
  useEffect(() => { langRef.current = language }, [language])
  useEffect(() => { detectedRef.current = detectedLang }, [detectedLang])
  useEffect(() => { settingsRef.current = settings }, [settings])

  const effectiveLang = language === 'auto' ? detectedLang : language

  const editorOptions = useMemo((): editor.IDiffEditorConstructionOptions => ({
    originalEditable: true,
    fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
    fontLigatures: false,
    scrollBeyondLastLine: false,
    padding: { top: 14, bottom: 14 },
    automaticLayout: true,
    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6, useShadows: false },
    overviewRulerBorder: false,
    renderOverviewRuler: false,
    glyphMargin: false,
    lineNumbersMinChars: 3,
    accessibilitySupport: 'on',
    renderSideBySide: !inline,
    wordWrap: wordWrap ? 'on' : 'off',
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    renderWhitespace: settings.renderWhitespace,
    lineNumbers: settings.lineNumbers,
    minimap: { enabled: settings.minimap },
    folding: settings.folding,
    smoothScrolling: settings.smoothScrolling,
    renderLineHighlight: settings.renderLineHighlight,
    ignoreTrimWhitespace: settings.ignoreWhitespace,
  }), [inline, wordWrap, settings])

  // Options that only exist on individual editor panes, not on IDiffEditorConstructionOptions
  useEffect(() => {
    const de = editorRef.current
    if (!de) return

    const paneOptions = {
      tabSize: settings.tabSize,
      cursorStyle: settings.cursorStyle,
      cursorBlinking: settings.cursorBlinking,
      bracketPairColorization: { enabled: settings.bracketColors },
      guides: { indentation: settings.indentGuides },
      matchBrackets: settings.matchBrackets,
      quickSuggestions: settings.autocomplete,
      suggestOnTriggerCharacters: settings.autocomplete,
      wordBasedSuggestions: settings.autocomplete ? 'currentDocument' as const : 'off' as const,
    }
    de.getOriginalEditor().updateOptions(paneOptions)
    de.getModifiedEditor().updateOptions(paneOptions)
  }, [settings])

  // When ignore case is toggled, lowercase editor content (or restore originals)
  useEffect(() => {
    const de = editorRef.current
    if (!de) return

    const orig = de.getOriginalEditor()
    const mod = de.getModifiedEditor()

    if (settings.ignoreCase && !ignoreCaseActiveRef.current) {
      caseCacheRef.current = { original: orig.getValue(), modified: mod.getValue() }
      orig.setValue(caseCacheRef.current.original.toLowerCase())
      mod.setValue(caseCacheRef.current.modified.toLowerCase())
      ignoreCaseActiveRef.current = true
    } else if (!settings.ignoreCase && ignoreCaseActiveRef.current) {
      if (caseCacheRef.current) {
        orig.setValue(caseCacheRef.current.original)
        mod.setValue(caseCacheRef.current.modified)
        caseCacheRef.current = null
      }
      ignoreCaseActiveRef.current = false
    }
  }, [settings.ignoreCase])

  // --- Editor actions ---

  const format = useCallback(async () => {
    const de = editorRef.current
    if (!de) return

    const lang = langRef.current === 'auto' ? detectedRef.current : langRef.current
    if (!canFormat(lang)) return

    setFormatting(true)
    try {
      const { printWidth, tabSize } = settingsRef.current
      const orig = de.getOriginalEditor()
      const mod = de.getModifiedEditor()
      const [fo, fm] = await Promise.all([
        formatCode(orig.getValue(), lang, { printWidth, tabSize }),
        formatCode(mod.getValue(), lang, { printWidth, tabSize }),
      ])
      orig.setValue(fo)
      mod.setValue(fm)
    } finally {
      setFormatting(false)
    }
  }, [])

  const swap = useCallback(() => {
    const de = editorRef.current
    if (!de) return
    const orig = de.getOriginalEditor()
    const mod = de.getModifiedEditor()
    const a = orig.getValue()
    const b = mod.getValue()
    orig.setValue(b)
    mod.setValue(a)
  }, [])

  const clear = useCallback(() => {
    const de = editorRef.current
    if (!de) return
    de.getOriginalEditor().setValue('')
    de.getModifiedEditor().setValue('')
    setStats(EMPTY_STATS)
    setDetectedLang('plaintext')
    setHasContent(false)
  }, [])

  const focusOriginal = useCallback(() => editorRef.current?.getOriginalEditor().focus(), [])
  const focusModified = useCallback(() => editorRef.current?.getModifiedEditor().focus(), [])
  const toggleView = useCallback(() => setInline((v) => !v), [])
  const toggleWrap = useCallback(() => setWordWrap((v) => !v), [])
  const toggleSettings = useCallback(() => setSettingsOpen((v) => !v), [])

  const changeLang = useCallback((id: string) => {
    setLanguage(id)
    if (id === 'auto') return

    const de = editorRef.current
    const m = monacoRef.current
    if (!de || !m) return

    const origModel = de.getOriginalEditor().getModel()
    const modModel = de.getModifiedEditor().getModel()
    if (origModel) m.editor.setModelLanguage(origModel, id)
    if (modModel) m.editor.setModelLanguage(modModel, id)
  }, [])

  // --- Auto-detection ---

  const tryDetect = useCallback((text: string) => {
    if (langRef.current !== 'auto' || !text.trim()) return

    const lang = detectLanguage(text)
    if (lang === detectedRef.current) return

    setDetectedLang(lang)

    const de = editorRef.current
    const m = monacoRef.current
    if (!de || !m) return

    const origModel = de.getOriginalEditor().getModel()
    const modModel = de.getModifiedEditor().getModel()
    if (origModel) m.editor.setModelLanguage(origModel, lang)
    if (modModel) m.editor.setModelLanguage(modModel, lang)
  }, [])

  // --- Monaco lifecycle ---

  const onBeforeMount = useCallback((monaco: Monaco) => registerThemes(monaco), [])

  const onMount = useCallback((de: editor.IStandaloneDiffEditor, monaco: Monaco) => {
    editorRef.current = de
    monacoRef.current = monaco

    const orig = de.getOriginalEditor()
    const mod = de.getModifiedEditor()

    // Label editable elements for screen readers.
    // Monaco uses either <textarea> or .native-edit-context depending on version.
    const labelEditor = (el: HTMLElement | null, label: string) => {
      if (!el) return
      const targets = el.querySelectorAll('textarea, .native-edit-context, [role="textbox"]')
      targets.forEach((t) => t.setAttribute('aria-label', label))
    }
    labelEditor(orig.getDomNode(), 'Original text editor')
    labelEditor(mod.getDomNode(), 'Modified text editor')

    // Enable intellisense on both editor panes
    const suggestOptions = {
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnCommitCharacter: true,
      wordBasedSuggestions: 'currentDocument' as const,
      suggest: { showKeywords: true, showSnippets: true },
    }
    orig.updateOptions(suggestOptions)
    mod.updateOptions(suggestOptions)

    let debounce: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(debounce)
      debounce = setTimeout(() => {
        if (!editorRef.current) return
        const ov = editorRef.current.getOriginalEditor().getValue()
        const mv = editorRef.current.getModifiedEditor().getValue()
        setStats(computeStats(ov, mv, {
          ignoreCase: settingsRef.current.ignoreCase,
          ignoreWhitespace: settingsRef.current.ignoreWhitespace,
        }))
        setHasContent(ov.trim().length > 0 || mv.trim().length > 0)
      }, 200)
    }

    orig.onDidChangeModelContent(() => {
      tryDetect(orig.getValue())
      // Edits while ignore case is on invalidate the stored originals
      if (ignoreCaseActiveRef.current && caseCacheRef.current) {
        caseCacheRef.current.original = orig.getValue()
      }
      refresh()
    })
    mod.onDidChangeModelContent(() => {
      tryDetect(mod.getValue())
      if (ignoreCaseActiveRef.current && caseCacheRef.current) {
        caseCacheRef.current.modified = mod.getValue()
      }
      refresh()
    })
    de.onDidUpdateDiff(refresh)

    // Monaco measures character widths on init. If the web font loads after
    // that, cursor positions drift. Force a remeasure once fonts are ready.
    document.fonts.ready.then(() => {
      monaco.editor.remeasureFonts()
    })

    orig.focus()
  }, [tryDetect])

  // --- Command palette ---

  const commands: Command[] = useMemo(() => [
    { id: 'format', label: 'Format Document', shortcut: 'Ctrl+Shift+F', action: format },
    { id: 'theme', label: 'Toggle Dark / Light', shortcut: 'Ctrl+J', action: toggleTheme },
    { id: 'view', label: 'Toggle Inline / Side-by-Side', shortcut: 'Ctrl+\\', action: toggleView },
    { id: 'wrap', label: 'Toggle Word Wrap', shortcut: 'Alt+Z', action: toggleWrap },
    { id: 'swap', label: 'Swap Original and Modified', shortcut: 'Ctrl+Shift+S', action: swap },
    { id: 'clear', label: 'Clear Both Editors', shortcut: 'Ctrl+Shift+X', action: clear },
    { id: 'settings', label: 'Open Settings', shortcut: 'Ctrl+,', action: toggleSettings },
    { id: 'focus-orig', label: 'Focus Original Editor', shortcut: 'Ctrl+1', action: focusOriginal },
    { id: 'focus-mod', label: 'Focus Modified Editor', shortcut: 'Ctrl+2', action: focusModified },
    ...languages.map((l) => ({
      id: `lang-${l.id}`,
      label: `Language: ${l.label}`,
      action: () => changeLang(l.id),
    })),
  ], [format, toggleTheme, toggleView, toggleWrap, swap, clear, toggleSettings, focusOriginal, focusModified, changeLang])

  // --- Keyboard shortcuts ---

  useEffect(() => {
    const bindings: Array<{ test: (e: KeyboardEvent) => boolean; action: () => void }> = [
      { test: (e) => (e.ctrlKey || e.metaKey) && e.key === 'k', action: () => setPaletteOpen((v) => !v) },
      { test: (e) => (e.ctrlKey || e.metaKey) && e.key === ',', action: toggleSettings },
      { test: (e) => (e.ctrlKey || e.metaKey) && e.shiftKey && /^[fF]$/.test(e.key), action: format },
      { test: (e) => (e.ctrlKey || e.metaKey) && !e.shiftKey && /^[jJ]$/.test(e.key), action: toggleTheme },
      { test: (e) => (e.ctrlKey || e.metaKey) && e.key === '\\', action: toggleView },
      { test: (e) => e.altKey && /^[zZ]$/.test(e.key), action: toggleWrap },
      { test: (e) => (e.ctrlKey || e.metaKey) && e.shiftKey && /^[sS]$/.test(e.key), action: swap },
      { test: (e) => (e.ctrlKey || e.metaKey) && e.shiftKey && /^[xX]$/.test(e.key), action: clear },
      { test: (e) => (e.ctrlKey || e.metaKey) && e.key === '1', action: focusOriginal },
      { test: (e) => (e.ctrlKey || e.metaKey) && e.key === '2', action: focusModified },
    ]

    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPaletteOpen(false)
        setSettingsOpen(false)
        return
      }

      for (const binding of bindings) {
        if (binding.test(e)) {
          e.preventDefault()
          binding.action()
          return
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [format, toggleTheme, toggleView, toggleWrap, toggleSettings, swap, clear, focusOriginal, focusModified])

  // --- Render ---

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <a href="#diff-editor" className="skip-link">Skip to editor</a>

      <div className="relative">
        <Toolbar
          language={language}
          detectedLang={detectedLang}
          effectiveLang={effectiveLang}
          inline={inline}
          wordWrap={wordWrap}
          formatting={formatting}
          dark={dark}
          settingsOpen={settingsOpen}
          onChangeLang={changeLang}
          onFormat={format}
          onSwap={swap}
          onToggleView={toggleView}
          onToggleWrap={toggleWrap}
          onClear={clear}
          onOpenPalette={() => setPaletteOpen(true)}
          onToggleSettings={toggleSettings}
          onToggleTheme={toggleTheme}
        />

        {settingsOpen && (
          <SettingsPanel
            settings={settings}
            onUpdate={updateSetting}
            onReset={resetSettings}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </div>

      <ColumnLabels inline={inline} />

      <main id="diff-editor" className="flex-1 min-h-0 relative overflow-hidden" style={{ contain: 'strict' }} aria-label="Diff editor">
        {!hasContent && <EmptyState />}

        <Suspense fallback={<EditorLoading />}>
          <LazyDiffEditor
            original=""
            modified=""
            language={effectiveLang}
            theme={dark ? 'diff-dark' : 'diff-light'}
            beforeMount={onBeforeMount}
            onMount={onMount}
            loading={<EditorLoading />}
            options={editorOptions}
          />
        </Suspense>
      </main>

      <StatusBar stats={stats} />

      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
    </div>
  )
}
