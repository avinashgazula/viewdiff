import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

import { ColumnLabels } from './components/column-labels'
import { EmptyState } from './components/empty-state'
import { MobileEditor } from './components/mobile-editor'
import { ModeTabs } from './components/mode-tabs'
import { SettingsPanel } from './components/settings-panel'
import { StatusBar } from './components/status-bar'
import { Toolbar } from './components/toolbar'
import { languages } from './config'
import { canFormat, computeStats, detectLanguage, formatCode, type DiffStats } from './diff'
import { useSettings } from './hooks/use-settings'
import { useTheme } from './hooks/use-theme'
import { CommandPalette, type Command } from './palette'
import { registerThemes } from './themes'
import { encodeDiff, buildShareUrl } from './share'

const LazyDiffEditor = lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.DiffEditor }))
)

const EMPTY_STATS: DiffStats = { additions: 0, deletions: 0, changes: 0 }

interface AppProps {
  defaultLanguage?: string
  initialOriginal?: string
  initialModified?: string
  slug?: string
}

function useIsMobile() {
  const [mobile, setMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth <= 768
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return mobile
}

function EditorLoading() {
  return (
    <div className="flex items-center justify-center h-full" style={{ background: 'var(--bg)', contain: 'layout style' }}>
      <span className="text-[13px]" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
        Loading editor...
      </span>
    </div>
  )
}

export function App({ defaultLanguage = 'auto', initialOriginal, initialModified, slug = '/' }: AppProps) {
  const { dark, mode: themeMode, toggle: toggleTheme } = useTheme()
  const { settings, update: updateSetting, reset: resetSettings } = useSettings()
  const isMobile = useIsMobile()

  const [language, setLanguage] = useState(defaultLanguage)
  const [detectedLang, setDetectedLang] = useState(defaultLanguage === 'auto' ? 'plaintext' : defaultLanguage)
  const [inline, setInline] = useState(isMobile)
  const [wordWrap, setWordWrap] = useState(true)
  const [stats, setStats] = useState(EMPTY_STATS)
  const [formatting, setFormatting] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [editorReady, setEditorReady] = useState(false)

  // Abstracted editor refs — work for both DiffEditor and two separate editors
  const origEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const modEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)

  const caseCacheRef = useRef<{ original: string; modified: string } | null>(null)
  const ignoreCaseActiveRef = useRef(false)

  const langRef = useRef(language)
  const detectedRef = useRef(detectedLang)
  const settingsRef = useRef(settings)
  useEffect(() => { langRef.current = language }, [language])
  useEffect(() => { detectedRef.current = detectedLang }, [detectedLang])
  useEffect(() => { settingsRef.current = settings }, [settings])

  const effectiveLang = language === 'auto' ? detectedLang : language

  // --- Editor options ---

  const diffEditorOptions = useMemo((): editor.IDiffEditorConstructionOptions => ({
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
    splitViewDefaultRatio: 0.5,
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
    diffAlgorithm: settings.diffAlgorithm === 'smart' ? 'advanced' : 'legacy',
  }), [inline, wordWrap, settings])

  const singleEditorOptions = useMemo((): editor.IStandaloneEditorConstructionOptions => ({
    fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
    fontLigatures: false,
    scrollBeyondLastLine: false,
    padding: { top: 10, bottom: 10 },
    automaticLayout: true,
    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6, useShadows: false },
    overviewRulerBorder: false,
    glyphMargin: false,
    lineNumbersMinChars: 3,
    accessibilitySupport: 'on',
    wordWrap: 'on',
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    renderWhitespace: settings.renderWhitespace,
    lineNumbers: settings.lineNumbers,
    minimap: { enabled: false },
    folding: settings.folding,
    smoothScrolling: settings.smoothScrolling,
    renderLineHighlight: settings.renderLineHighlight,
    tabSize: settings.tabSize,
    cursorStyle: settings.cursorStyle,
    cursorBlinking: settings.cursorBlinking,
    bracketPairColorization: { enabled: settings.bracketColors },
    guides: { indentation: settings.indentGuides },
    matchBrackets: settings.matchBrackets,
  }), [settings])

  // Push pane-only options to already-mounted editors
  useEffect(() => {
    const orig = origEditorRef.current
    const mod = modEditorRef.current
    if (!orig || !mod) return

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
    orig.updateOptions(paneOptions)
    mod.updateOptions(paneOptions)
  }, [settings])

  // Ignore case toggle
  useEffect(() => {
    const orig = origEditorRef.current
    const mod = modEditorRef.current
    if (!orig || !mod) return

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
    const orig = origEditorRef.current
    const mod = modEditorRef.current
    if (!orig || !mod) return

    const lang = langRef.current === 'auto' ? detectedRef.current : langRef.current
    if (!canFormat(lang)) return

    setFormatting(true)
    try {
      const { printWidth, tabSize } = settingsRef.current
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
    const orig = origEditorRef.current
    const mod = modEditorRef.current
    if (!orig || !mod) return
    const a = orig.getValue()
    const b = mod.getValue()
    orig.setValue(b)
    mod.setValue(a)
  }, [])

  const clear = useCallback(() => {
    origEditorRef.current?.setValue('')
    modEditorRef.current?.setValue('')
    setStats(EMPTY_STATS)
    setDetectedLang('plaintext')
    setHasContent(false)
  }, [])

  const share = useCallback(async () => {
    const orig = origEditorRef.current
    const mod = modEditorRef.current
    if (!orig || !mod) return
    const ov = orig.getValue()
    const mv = mod.getValue()
    if (!ov.trim() && !mv.trim()) return

    const encoded = await encodeDiff(ov, mv)
    const url = buildShareUrl(slug, encoded)

    await navigator.clipboard.writeText(url)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }, [slug])

  const focusOriginal = useCallback(() => origEditorRef.current?.focus(), [])
  const focusModified = useCallback(() => modEditorRef.current?.focus(), [])
  const toggleView = useCallback(() => setInline((v) => !v), [])
  const toggleWrap = useCallback(() => setWordWrap((v) => !v), [])
  const toggleSettings = useCallback(() => setSettingsOpen((v) => !v), [])

  const changeLang = useCallback((id: string) => {
    setLanguage(id)
    if (id === 'auto') return

    const m = monacoRef.current
    if (!m) return

    const origModel = origEditorRef.current?.getModel()
    const modModel = modEditorRef.current?.getModel()
    if (origModel) m.editor.setModelLanguage(origModel, id)
    if (modModel) m.editor.setModelLanguage(modModel, id)
  }, [])

  // --- Auto-detection ---

  const tryDetect = useCallback((text: string) => {
    if (langRef.current !== 'auto' || !text.trim()) return

    const lang = detectLanguage(text)
    if (lang === detectedRef.current) return

    setDetectedLang(lang)

    const m = monacoRef.current
    if (!m) return

    const origModel = origEditorRef.current?.getModel()
    const modModel = modEditorRef.current?.getModel()
    if (origModel) m.editor.setModelLanguage(origModel, lang)
    if (modModel) m.editor.setModelLanguage(modModel, lang)
  }, [])

  // --- Shared setup for both editor modes ---

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const refresh = useCallback(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const orig = origEditorRef.current
      const mod = modEditorRef.current
      if (!orig || !mod) return
      const ov = orig.getValue()
      const mv = mod.getValue()
      setStats(computeStats(ov, mv, {
        ignoreCase: settingsRef.current.ignoreCase,
        ignoreWhitespace: settingsRef.current.ignoreWhitespace,
        ignoreBlankLines: settingsRef.current.ignoreBlankLines,
        lineFilter: settingsRef.current.lineFilter,
      }))
      setHasContent(ov.trim().length > 0 || mv.trim().length > 0)
    }, 200)
  }, [])

  const wireEditor = useCallback((ed: editor.IStandaloneCodeEditor, which: 'original' | 'modified') => {
    const label = `${which === 'original' ? 'Original' : 'Modified'} text editor`

    // Label for screen readers — apply immediately and observe for dynamic changes
    const applyLabels = (root: HTMLElement) => {
      const targets = root.querySelectorAll('textarea, .native-edit-context, [role="textbox"]')
      targets.forEach((t) => {
        if (t.getAttribute('aria-label') !== label) {
          t.setAttribute('aria-label', label)
        }
      })
    }

    const el = ed.getDomNode()
    if (el) {
      applyLabels(el)
      // Monaco may recreate input elements — watch for DOM changes
      const observer = new MutationObserver(() => applyLabels(el))
      observer.observe(el, { childList: true, subtree: true })
      ed.onDidDispose(() => observer.disconnect())
    }

    ed.onDidChangeModelContent(() => {
      tryDetect(ed.getValue())
      if (ignoreCaseActiveRef.current && caseCacheRef.current) {
        caseCacheRef.current[which] = ed.getValue()
      }
      refresh()
    })
  }, [tryDetect, refresh])

  const remeasureFonts = useCallback((monaco: Monaco) => {
    document.fonts.ready.then(() => monaco.editor.remeasureFonts())
  }, [])

  // --- DiffEditor mount (desktop) ---

  const onBeforeMount = useCallback((monaco: Monaco) => registerThemes(monaco), [])

  const onDiffMount = useCallback((de: editor.IStandaloneDiffEditor, monaco: Monaco) => {
    monacoRef.current = monaco
    const orig = de.getOriginalEditor()
    const mod = de.getModifiedEditor()
    origEditorRef.current = orig
    modEditorRef.current = mod

    const suggestOptions = {
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnCommitCharacter: true,
      wordBasedSuggestions: 'currentDocument' as const,
      suggest: { showKeywords: true, showSnippets: true },
    }
    orig.updateOptions(suggestOptions)
    mod.updateOptions(suggestOptions)

    wireEditor(orig, 'original')
    wireEditor(mod, 'modified')
    de.onDidUpdateDiff(refresh)

    // Load initial content (from shared URL)
    if (initialOriginal != null) orig.setValue(initialOriginal)
    if (initialModified != null) mod.setValue(initialModified)

    remeasureFonts(monaco)
    orig.focus()

    // Reveal editor after Monaco finishes layout to prevent CLS
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setEditorReady(true))
    })
  }, [wireEditor, refresh, remeasureFonts, initialOriginal, initialModified])

  // --- Mobile editor mounts ---

  const onOriginalMount = useCallback((ed: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    monacoRef.current = monaco
    origEditorRef.current = ed
    wireEditor(ed, 'original')
    remeasureFonts(monaco)
    ed.focus()

    requestAnimationFrame(() => {
      requestAnimationFrame(() => setEditorReady(true))
    })
  }, [wireEditor, remeasureFonts])

  const onModifiedMount = useCallback((ed: editor.IStandaloneCodeEditor, _monaco: Monaco) => {
    modEditorRef.current = ed
    wireEditor(ed, 'modified')
  }, [wireEditor])

  // --- Command palette ---

  const commands: Command[] = useMemo(() => [
    { id: 'format', label: 'Format Document', shortcut: 'Ctrl+Shift+F', action: format },
    { id: 'share', label: 'Share Diff via URL', action: share },
    { id: 'theme', label: 'Cycle Theme (System → Light → Dark)', shortcut: 'Ctrl+J', action: toggleTheme },
    ...(!isMobile ? [
      { id: 'view', label: 'Toggle Inline / Side-by-Side', shortcut: 'Ctrl+\\', action: toggleView },
      { id: 'wrap', label: 'Toggle Word Wrap', shortcut: 'Alt+Z', action: toggleWrap },
    ] : []),
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
  ], [format, share, toggleTheme, toggleView, toggleWrap, swap, clear, toggleSettings, focusOriginal, focusModified, changeLang, isMobile])

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

  const editorTheme = dark ? 'diff-dark' : 'diff-light'

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
          themeMode={themeMode}
          settingsOpen={settingsOpen}
          shareCopied={shareCopied}
          hasContent={hasContent}
          onChangeLang={changeLang}
          onFormat={format}
          onSwap={swap}
          onShare={share}
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
            wordWrap={wordWrap}
            onToggleWrap={toggleWrap}
          />
        )}
      </div>

      <ModeTabs />

      {!isMobile && <ColumnLabels inline={inline} />}

      <main id="diff-editor" className="flex-1 min-h-0 relative overflow-hidden" style={{ contain: 'strict', minHeight: '200px' }} aria-label="Diff editor">
        {!hasContent && <EmptyState />}

        <div className="editor-wrapper" style={{ height: '100%', opacity: editorReady ? 1 : 0, transition: 'opacity 0.1s' }}>
        {isMobile ? (
          <MobileEditor
            language={effectiveLang}
            theme={editorTheme}
            options={singleEditorOptions}
            onOriginalMount={onOriginalMount}
            onModifiedMount={onModifiedMount}
            beforeMount={onBeforeMount}
          />
        ) : (
          <Suspense fallback={<EditorLoading />}>
            <LazyDiffEditor
              original=""
              modified=""
              language={effectiveLang}
              theme={editorTheme}
              beforeMount={onBeforeMount}
              onMount={onDiffMount}
              loading={<EditorLoading />}
              options={diffEditorOptions}
            />
          </Suspense>
        )}
        </div>
      </main>

      <StatusBar stats={stats} />

      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
    </div>
  )
}
