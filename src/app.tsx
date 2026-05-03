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
import { generatePatch, generateHtmlDiff, downloadText } from './export'
import { useRecent } from './hooks/use-recent'
import { KeyboardShortcuts } from './components/keyboard-shortcuts'
import { GoToLine } from './components/goto-line'

const LazyDiffEditor = lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.DiffEditor }))
)

const EMPTY_STATS: DiffStats = { additions: 0, deletions: 0, changes: 0 }

function detectEOL(text: string): string | null {
  if (!text) return null
  const hasCRLF = text.includes('\r\n')
  // After stripping \r\n, check for bare \r or bare \n
  const stripped = text.replace(/\r\n/g, '')
  const hasBareNL = stripped.includes('\n')
  const hasBareR = stripped.includes('\r')
  if (hasCRLF && (hasBareNL || hasBareR)) return 'Mixed'
  if (hasCRLF) return 'CRLF'
  if (hasBareR) return 'CR'
  if (hasBareNL) return 'LF'
  return null
}

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
  const { recents, add: addRecent } = useRecent()
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
  const [eolInfo, setEolInfo] = useState<{ orig: string | null; mod: string | null }>({ orig: null, mod: null })
  const [wordCount, setWordCount] = useState<{ orig: number; mod: number }>({ orig: 0, mod: 0 })
  const [charCount, setCharCount] = useState<{ orig: number; mod: number }>({ orig: 0, mod: 0 })
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number } | null>(null)
  const [selectionInfo, setSelectionInfo] = useState<{ chars: number; lines: number } | null>(null)
  const [diffNav, setDiffNav] = useState<{ index: number; total: number } | null>(null)
  const [gotoLineOpen, setGotoLineOpen] = useState(false)
  const [focusedEditor, setFocusedEditor] = useState<'original' | 'modified'>('modified')
  const [isDragging, setIsDragging] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Abstracted editor refs — work for both DiffEditor and two separate editors
  const origEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const modEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)

  const caseCacheRef = useRef<{ original: string; modified: string } | null>(null)
  const ignoreCaseActiveRef = useRef(false)
  const eolCacheRef = useRef<{ original: string; modified: string } | null>(null)
  const ignoreEolActiveRef = useRef(false)

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
    experimental: { showMoves: settings.showMoves },
    stickyScroll: { enabled: settings.stickyScroll },
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

  // Ignore line endings toggle — normalize \r\n → \n in both models
  useEffect(() => {
    const orig = origEditorRef.current
    const mod = modEditorRef.current
    if (!orig || !mod) return
    const normalize = (s: string) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    if (settings.ignoreLineEndings && !ignoreEolActiveRef.current) {
      eolCacheRef.current = { original: orig.getValue(), modified: mod.getValue() }
      orig.setValue(normalize(eolCacheRef.current.original))
      mod.setValue(normalize(eolCacheRef.current.modified))
      ignoreEolActiveRef.current = true
    } else if (!settings.ignoreLineEndings && ignoreEolActiveRef.current) {
      if (eolCacheRef.current) {
        orig.setValue(eolCacheRef.current.original)
        mod.setValue(eolCacheRef.current.modified)
        eolCacheRef.current = null
      }
      ignoreEolActiveRef.current = false
    }
  }, [settings.ignoreLineEndings])

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

  const exportPatch = useCallback(() => {
    const orig = origEditorRef.current
    const mod = modEditorRef.current
    if (!orig || !mod) return
    const ov = orig.getValue()
    const mv = mod.getValue()
    if (!ov.trim() && !mv.trim()) return
    const patch = generatePatch(ov, mv, 'original', 'modified')
    if (patch) downloadText(patch, 'changes.patch')
  }, [])

  const exportHtml = useCallback(() => {
    const orig = origEditorRef.current
    const mod = modEditorRef.current
    if (!orig || !mod) return
    const ov = orig.getValue()
    const mv = mod.getValue()
    if (!ov.trim() && !mv.trim()) return
    const html = generateHtmlDiff(ov, mv, 'original', 'modified')
    downloadText(html, 'diff.html', 'text/html')
  }, [])

  const acceptHunkFromOriginal = useCallback(() => {
    const de = diffEditorRef.current
    if (!de) return
    const changes = de.getLineChanges()
    if (!changes?.length) return

    const orig = de.getOriginalEditor()
    const mod = de.getModifiedEditor()
    const origModel = orig.getModel()
    const modModel = mod.getModel()
    if (!origModel || !modModel) return

    const cursorLine = mod.getPosition()?.lineNumber ?? 1

    const change = changes.find((c) => {
      const ms = c.modifiedStartLineNumber
      const me = c.modifiedEndLineNumber || ms
      return cursorLine >= ms - 1 && cursorLine <= me + 1
    }) ?? changes[0]

    if (!change) return

    const { originalStartLineNumber: os, originalEndLineNumber: oe,
            modifiedStartLineNumber: ms, modifiedEndLineNumber: me } = change

    const origText = oe > 0
      ? origModel.getValueInRange({ startLineNumber: os, startColumn: 1, endLineNumber: oe, endColumn: origModel.getLineMaxColumn(oe) })
      : null

    const modEnd = me > 0 ? me : ms
    const modEndCol = modModel.getLineMaxColumn(modEnd)

    modModel.pushEditOperations([], [{
      range: { startLineNumber: ms, startColumn: 1, endLineNumber: modEnd, endColumn: modEndCol },
      text: origText ?? '',
    }], () => null)
  }, [])

  const acceptHunkFromModified = useCallback(() => {
    const de = diffEditorRef.current
    if (!de) return
    const changes = de.getLineChanges()
    if (!changes?.length) return

    const orig = de.getOriginalEditor()
    const mod = de.getModifiedEditor()
    const origModel = orig.getModel()
    const modModel = mod.getModel()
    if (!origModel || !modModel) return

    const cursorLine = mod.getPosition()?.lineNumber ?? 1

    const change = changes.find((c) => {
      const ms = c.modifiedStartLineNumber
      const me = c.modifiedEndLineNumber || ms
      return cursorLine >= ms - 1 && cursorLine <= me + 1
    }) ?? changes[0]

    if (!change) return

    const { originalStartLineNumber: os, originalEndLineNumber: oe,
            modifiedStartLineNumber: ms, modifiedEndLineNumber: me } = change

    const modText = me > 0
      ? modModel.getValueInRange({ startLineNumber: ms, startColumn: 1, endLineNumber: me, endColumn: modModel.getLineMaxColumn(me) })
      : null

    const origEnd = oe > 0 ? oe : os
    const origEndCol = origModel.getLineMaxColumn(origEnd)

    origModel.pushEditOperations([], [{
      range: { startLineNumber: os, startColumn: 1, endLineNumber: origEnd, endColumn: origEndCol },
      text: modText ?? '',
    }], () => null)
  }, [])

  const copyDiff = useCallback(async () => {
    const orig = origEditorRef.current
    const mod = modEditorRef.current
    if (!orig || !mod) return
    const ov = orig.getValue(), mv = mod.getValue()
    if (!ov.trim() && !mv.trim()) return
    const patch = generatePatch(ov, mv, 'original', 'modified')
    if (patch) await navigator.clipboard.writeText(patch)
  }, [])

  const printDiff = useCallback(() => {
    const orig = origEditorRef.current
    const mod = modEditorRef.current
    if (!orig || !mod) return
    const ov = orig.getValue(), mv = mod.getValue()
    if (!ov.trim() && !mv.trim()) return
    const html = generateHtmlDiff(ov, mv, 'original', 'modified')
    const w = window.open('', '_blank')
    if (!w) return
    w.document.open()
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 250)
  }, [])

  // Auto-save to recent diffs after content stabilizes (5 s debounce)
  const recentSaveRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const addRecentRef = useRef(addRecent)
  useEffect(() => { addRecentRef.current = addRecent }, [addRecent])

  const scheduleRecentSave = useCallback(() => {
    clearTimeout(recentSaveRef.current)
    recentSaveRef.current = setTimeout(() => {
      const ov = origEditorRef.current?.getValue() ?? ''
      const mv = modEditorRef.current?.getValue() ?? ''
      addRecentRef.current(ov, mv)
    }, 5000)
  }, [])

  const nextDiff = useCallback(() => {
    origEditorRef.current?.trigger('keyboard', 'editor.action.diffReview.next', null)
  }, [])

  const prevDiff = useCallback(() => {
    origEditorRef.current?.trigger('keyboard', 'editor.action.diffReview.prev', null)
  }, [])

  const focusOriginal = useCallback(() => origEditorRef.current?.focus(), [])
  const focusModified = useCallback(() => modEditorRef.current?.focus(), [])
  const toggleView = useCallback(() => setInline((v) => !v), [])
  const toggleWrap = useCallback(() => setWordWrap((v) => !v), [])

  const loadOriginal = useCallback((text: string) => {
    origEditorRef.current?.setValue(text)
    origEditorRef.current?.focus()
  }, [])

  const loadModified = useCallback((text: string) => {
    modEditorRef.current?.setValue(text)
    modEditorRef.current?.focus()
  }, [])

  const copyOriginal = useCallback(async () => {
    const text = origEditorRef.current?.getValue() ?? ''
    if (text) await navigator.clipboard.writeText(text)
  }, [])

  const copyModified = useCallback(async () => {
    const text = modEditorRef.current?.getValue() ?? ''
    if (text) await navigator.clipboard.writeText(text)
  }, [])

  const normalizeEOL = useCallback(() => {
    const orig = origEditorRef.current
    const mod = modEditorRef.current
    if (!orig || !mod) return
    const normalize = (s: string) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    orig.setValue(normalize(orig.getValue()))
    mod.setValue(normalize(mod.getValue()))
  }, [])

  // File drag-and-drop onto the editor area
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.relatedTarget === null || !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const text = await file.text()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const side = !inline && e.clientX > rect.left + rect.width / 2 ? 'modified' : 'original'
    if (side === 'original') origEditorRef.current?.setValue(text)
    else modEditorRef.current?.setValue(text)
  }, [inline])
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
        ignoreLineEndings: settingsRef.current.ignoreLineEndings,
        lineFilter: settingsRef.current.lineFilter,
      }))
      setHasContent(ov.trim().length > 0 || mv.trim().length > 0)
      setEolInfo({ orig: detectEOL(ov), mod: detectEOL(mv) })
      const wc = (s: string) => s.trim() ? s.trim().split(/\s+/).length : 0
      setWordCount({ orig: wc(ov), mod: wc(mv) })
      setCharCount({ orig: ov.length, mod: mv.length })
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
      if (ignoreEolActiveRef.current && eolCacheRef.current) {
        eolCacheRef.current[which] = ed.getValue()
      }
      refresh()
      scheduleRecentSave()
    })

    ed.onDidFocusEditorWidget(() => {
      setFocusedEditor(which)
    })

    ed.onDidChangeCursorPosition((e) => {
      setCursorPos({ line: e.position.lineNumber, col: e.position.column })
      if (which === 'modified') {
        const de = diffEditorRef.current
        if (!de) return
        const changes = de.getLineChanges() ?? []
        if (changes.length === 0) { setDiffNav(null); return }
        const ln = e.position.lineNumber
        let idx = changes.findIndex((c) => {
          const end = c.modifiedEndLineNumber > 0 ? c.modifiedEndLineNumber : c.modifiedStartLineNumber
          return ln <= end
        })
        if (idx === -1) idx = changes.length - 1
        setDiffNav({ index: idx, total: changes.length })
      }
    })

    ed.onDidChangeCursorSelection((e) => {
      const sel = e.selection
      if (sel.isEmpty()) {
        setSelectionInfo(null)
        return
      }
      const model = ed.getModel()
      if (!model) return
      const text = model.getValueInRange(sel)
      const lines = sel.endLineNumber - sel.startLineNumber + 1
      setSelectionInfo({ chars: text.length, lines })
    })
  }, [tryDetect, refresh, scheduleRecentSave])

  const remeasureFonts = useCallback((monaco: Monaco) => {
    document.fonts.ready.then(() => monaco.editor.remeasureFonts())
  }, [])

  // --- DiffEditor mount (desktop) ---

  const onBeforeMount = useCallback((monaco: Monaco) => registerThemes(monaco), [])

  const onDiffMount = useCallback((de: editor.IStandaloneDiffEditor, monaco: Monaco) => {
    monacoRef.current = monaco
    diffEditorRef.current = de
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
    let firstDiffScrolled = false
    de.onDidUpdateDiff(() => {
      const changes = de.getLineChanges() ?? []
      setDiffNav(changes.length > 0 ? { index: 0, total: changes.length } : null)
      refresh()
      if (!firstDiffScrolled && changes.length > 0) {
        firstDiffScrolled = true
        const firstLine = changes[0].modifiedStartLineNumber
        mod.revealLineInCenterIfOutsideViewport(firstLine)
      }
    })

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

  const MODE_PATHS = ['/','table','image','git','hex','folder','three-way']

  const navigateMode = useCallback((idx: number) => {
    const p = MODE_PATHS[idx]
    if (p !== undefined) window.location.href = p === '/' ? '/' : `/${p}`
  }, [])

  const commands: Command[] = useMemo(() => [
    { id: 'format', label: 'Format Document', shortcut: 'Ctrl+Shift+F', action: format },
    { id: 'share', label: 'Share Diff via URL', action: share },
    { id: 'export', label: 'Export as .patch File', shortcut: 'Ctrl+E', action: exportPatch },
    { id: 'export-html', label: 'Export as HTML Diff', shortcut: 'Ctrl+Shift+E', action: exportHtml },
    { id: 'accept-orig', label: 'Accept from Original (current hunk)', shortcut: 'Ctrl+Alt+←', action: acceptHunkFromOriginal },
    { id: 'accept-mod', label: 'Accept from Modified (current hunk)', shortcut: 'Ctrl+Alt+→', action: acceptHunkFromModified },
    { id: 'next-diff', label: 'Next Difference', shortcut: 'F7', action: nextDiff },
    { id: 'prev-diff', label: 'Previous Difference', shortcut: 'Shift+F7', action: prevDiff },
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
    { id: 'copy-diff', label: 'Copy Diff as Patch Text', action: copyDiff },
    { id: 'print', label: 'Print Diff', shortcut: 'Ctrl+P', action: printDiff },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', shortcut: 'Ctrl+?', action: () => setShortcutsOpen(true) },
    { id: 'goto-line', label: 'Go to Line…', shortcut: 'Ctrl+G', action: () => setGotoLineOpen(true) },
    ...languages.map((l) => ({
      id: `lang-${l.id}`,
      label: `Language: ${l.label}`,
      action: () => changeLang(l.id),
    })),
    ...(recents.length > 0 ? [
      { id: 'recent-sep', label: '— Recent diffs —', action: () => {} },
      ...recents.map((r) => ({
        id: `recent-${r.id}`,
        label: `Recent: ${r.preview || '(empty)'}`,
        action: () => {
          origEditorRef.current?.setValue(r.original)
          modEditorRef.current?.setValue(r.modified)
        },
      })),
    ] : []),
  ], [format, share, copyDiff, printDiff, exportHtml, acceptHunkFromOriginal, acceptHunkFromModified, toggleTheme, toggleView, toggleWrap, swap, clear, toggleSettings, focusOriginal, focusModified, changeLang, isMobile, recents, setShortcutsOpen])

  // --- Keyboard shortcuts ---

  useEffect(() => {
    const bindings: Array<{ test: (e: KeyboardEvent) => boolean; action: () => void }> = [
      { test: (e) => (e.ctrlKey || e.metaKey) && e.key === 'k', action: () => setPaletteOpen((v) => !v) },
      { test: (e) => (e.ctrlKey || e.metaKey) && e.key === '?', action: () => setShortcutsOpen((v) => !v) },
      { test: (e) => (e.ctrlKey || e.metaKey) && /^[gG]$/.test(e.key), action: () => setGotoLineOpen(true) },
      { test: (e) => (e.ctrlKey || e.metaKey) && e.key === ',', action: toggleSettings },
      { test: (e) => (e.ctrlKey || e.metaKey) && e.shiftKey && /^[fF]$/.test(e.key), action: format },
      { test: (e) => (e.ctrlKey || e.metaKey) && !e.shiftKey && /^[jJ]$/.test(e.key), action: toggleTheme },
      { test: (e) => (e.ctrlKey || e.metaKey) && e.key === '\\', action: toggleView },
      { test: (e) => e.altKey && /^[zZ]$/.test(e.key), action: toggleWrap },
      { test: (e) => (e.ctrlKey || e.metaKey) && e.shiftKey && /^[sS]$/.test(e.key), action: swap },
      { test: (e) => (e.ctrlKey || e.metaKey) && e.shiftKey && /^[xX]$/.test(e.key), action: clear },
      { test: (e) => (e.ctrlKey || e.metaKey) && e.key === '1', action: focusOriginal },
      { test: (e) => (e.ctrlKey || e.metaKey) && e.key === '2', action: focusModified },
      { test: (e) => (e.ctrlKey || e.metaKey) && !e.shiftKey && /^[eE]$/.test(e.key), action: exportPatch },
      { test: (e) => (e.ctrlKey || e.metaKey) && e.shiftKey && /^[eE]$/.test(e.key), action: exportHtml },
      { test: (e) => (e.ctrlKey || e.metaKey) && /^[pP]$/.test(e.key), action: printDiff },
      { test: (e) => (e.ctrlKey || e.metaKey) && e.altKey && e.key === 'ArrowLeft', action: acceptHunkFromOriginal },
      { test: (e) => (e.ctrlKey || e.metaKey) && e.altKey && e.key === 'ArrowRight', action: acceptHunkFromModified },
      { test: (e) => e.key === 'F7' && !e.shiftKey, action: nextDiff },
      { test: (e) => e.key === 'F7' && e.shiftKey, action: prevDiff },
      // Alt+1–7 navigate modes
      ...([0,1,2,3,4,5,6] as const).map((i) => ({
        test: (e: KeyboardEvent) => e.altKey && e.key === String(i + 1),
        action: () => navigateMode(i),
      })),
    ]

    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPaletteOpen(false)
        setSettingsOpen(false)
        setShortcutsOpen(false)
        setGotoLineOpen(false)
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
  }, [format, toggleTheme, toggleView, toggleWrap, toggleSettings, swap, clear, focusOriginal, focusModified, exportPatch, exportHtml, printDiff, acceptHunkFromOriginal, acceptHunkFromModified, nextDiff, prevDiff, navigateMode])

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
          onExport={exportPatch}
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

      {!isMobile && (
        <ColumnLabels
          inline={inline}
          onLoadOriginal={loadOriginal}
          onLoadModified={loadModified}
          onCopyOriginal={copyOriginal}
          onCopyModified={copyModified}
        />
      )}

      <main
        id="diff-editor"
        className="flex-1 min-h-0 relative overflow-hidden"
        style={{ contain: 'strict', minHeight: '200px' }}
        aria-label="Diff editor"
        onDragOverCapture={handleDragOver}
        onDragLeaveCapture={handleDragLeave}
        onDropCapture={handleDrop}
      >
        {!hasContent && !isDragging && <EmptyState />}

        {isDragging && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', pointerEvents: 'none' }}>
            {!inline && (
              <div style={{ flex: 1, border: '2px dashed var(--accent)', borderRadius: 4, margin: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-subtle)', fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>
                Drop → Original
              </div>
            )}
            <div style={{ flex: 1, border: '2px dashed var(--accent)', borderRadius: 4, margin: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-subtle)', fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>
              {inline ? 'Drop file here' : 'Drop → Modified'}
            </div>
          </div>
        )}

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

      <StatusBar
        stats={stats} eolInfo={eolInfo} wordCount={wordCount} charCount={charCount}
        cursorPos={cursorPos} selectionInfo={selectionInfo} diffNav={diffNav}
        language={languages.find((l) => l.id === effectiveLang)?.label}
        onNormalizeEOL={normalizeEOL}
      />

      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
      {shortcutsOpen && <KeyboardShortcuts onClose={() => setShortcutsOpen(false)} />}
      {gotoLineOpen && (
        <GoToLine
          maxLine={Math.max(
            origEditorRef.current?.getModel()?.getLineCount() ?? 1,
            modEditorRef.current?.getModel()?.getLineCount() ?? 1,
          )}
          onClose={() => setGotoLineOpen(false)}
          onGo={(line) => {
            const ed = focusedEditor === 'original' ? origEditorRef.current : modEditorRef.current
            if (ed) { ed.setPosition({ lineNumber: line, column: 1 }); ed.revealLineInCenter(line); ed.focus() }
          }}
        />
      )}
    </div>
  )
}
