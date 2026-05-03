import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { ModeTabs } from '../../components/mode-tabs'
import { useTheme } from '../../hooks/use-theme'
import { MoonIcon, MonitorIcon, SunIcon } from '../../components/icons'
import { detectLanguage } from '../../diff'
import { registerThemes } from '../../themes'
import { downloadText } from '../../export'

const LazyEditor = lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.Editor })),
)

// --- Lightweight LCS-based line diff ---

function lcsDP(a: string[], b: string[]): number[][] {
  const n = a.length, m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  return dp
}

interface Hunk { baseStart: number; baseEnd: number; sideStart: number; sideEnd: number }

function diffHunks(base: string[], side: string[]): Hunk[] {
  if (base.length > 3000 || side.length > 3000) return []
  const dp = lcsDP(base, side)
  const hunks: Hunk[] = []
  let i = base.length, j = side.length
  let hunk: Hunk | null = null

  const flush = () => { if (hunk) { hunks.unshift(hunk); hunk = null } }

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && base[i - 1] === side[j - 1]) {
      flush(); i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      if (!hunk) hunk = { baseStart: i, baseEnd: i, sideStart: j - 1, sideEnd: j - 1 }
      hunk.sideStart = j - 1
      j--
    } else {
      if (!hunk) hunk = { baseStart: i - 1, baseEnd: i - 1, sideStart: j, sideEnd: j }
      hunk.baseStart = i - 1
      i--
    }
  }
  flush()
  return hunks
}

// Detect conflict regions: where both left and right changed the same base lines
function findConflicts(leftHunks: Hunk[], rightHunks: Hunk[]): Set<number> {
  const leftChanged = new Set<number>()
  for (const h of leftHunks)
    for (let l = h.baseStart; l < h.baseEnd; l++) leftChanged.add(l)
  const conflicts = new Set<number>()
  for (const h of rightHunks)
    for (let l = h.baseStart; l < h.baseEnd; l++)
      if (leftChanged.has(l)) conflicts.add(l)
  return conflicts
}

// --- Merge computation ---

function computeMerge(
  baseLines: string[],
  leftLines: string[],
  rightLines: string[],
  leftHunks: Hunk[],
  rightHunks: Hunk[],
): { lines: string[]; hasConflict: boolean } {
  // Build index of base lines that changed
  const leftChangedBase = new Set<number>()
  const rightChangedBase = new Set<number>()
  for (const h of leftHunks) for (let l = h.baseStart; l < h.baseEnd; l++) leftChangedBase.add(l)
  for (const h of rightHunks) for (let l = h.baseStart; l < h.baseEnd; l++) rightChangedBase.add(l)

  const result: string[] = []
  let hasConflict = false
  let bi = 0

  const allEvents: { pos: number; side: 'left' | 'right'; hunk: Hunk }[] = [
    ...leftHunks.map((h) => ({ pos: h.baseStart, side: 'left' as const, hunk: h })),
    ...rightHunks.map((h) => ({ pos: h.baseStart, side: 'right' as const, hunk: h })),
  ].sort((a, b) => a.pos - b.pos || (a.side === 'left' ? -1 : 1))

  let ei = 0
  while (bi < baseLines.length || ei < allEvents.length) {
    // Advance past consumed events
    while (ei < allEvents.length && allEvents[ei].pos < bi) ei++

    if (ei < allEvents.length && allEvents[ei].pos === bi) {
      const ev = allEvents[ei]
      const { hunk, side } = ev

      // Check for conflict
      const isConflict = side === 'left'
        ? rightHunks.some((h) => h.baseStart < hunk.baseEnd && h.baseEnd > hunk.baseStart)
        : leftHunks.some((h) => h.baseStart < hunk.baseEnd && h.baseEnd > hunk.baseStart)

      if (isConflict) {
        hasConflict = true
        // Find the corresponding opposite hunk for the conflict block
        const leftH = side === 'left' ? hunk : leftHunks.find((h) => h.baseStart < hunk.baseEnd && h.baseEnd > hunk.baseStart)
        const rightH = side === 'right' ? hunk : rightHunks.find((h) => h.baseStart < hunk.baseEnd && h.baseEnd > hunk.baseStart)
        result.push('<<<<<<< Left')
        for (let k = (leftH?.sideStart ?? bi); k < (leftH?.sideEnd ?? bi); k++) result.push(leftLines[k] ?? '')
        result.push('||||||| Base')
        const bStart = Math.min(leftH?.baseStart ?? bi, rightH?.baseStart ?? bi)
        const bEnd = Math.max(leftH?.baseEnd ?? bi, rightH?.baseEnd ?? bi)
        for (let k = bStart; k < bEnd; k++) result.push(baseLines[k] ?? '')
        result.push('=======')
        for (let k = (rightH?.sideStart ?? bi); k < (rightH?.sideEnd ?? bi); k++) result.push(rightLines[k] ?? '')
        result.push('>>>>>>> Right')
        bi = Math.max(leftH?.baseEnd ?? bi, rightH?.baseEnd ?? bi)
        ei++
      } else {
        // Non-conflicting: take the changed side
        const sideLines = side === 'left' ? leftLines : rightLines
        for (let k = hunk.sideStart; k < hunk.sideEnd; k++) result.push(sideLines[k] ?? '')
        bi = hunk.baseEnd
        ei++
      }
    } else if (bi < baseLines.length) {
      result.push(baseLines[bi])
      bi++
    } else {
      break
    }
  }

  return { lines: result, hasConflict }
}

// --- Decoration helpers ---

const DECO_CLASSES = {
  leftAdded: 'tw-left-added',
  leftRemoved: 'tw-left-removed',
  rightAdded: 'tw-right-added',
  rightRemoved: 'tw-right-removed',
  conflict: 'tw-conflict',
  baseChanged: 'tw-base-changed',
}

function applyDecorations(
  ed: editor.IStandaloneCodeEditor,
  monaco: Monaco,
  hunks: Hunk[],
  conflicts: Set<number>,
  role: 'base' | 'left' | 'right',
  addedClass: string,
  removedClass: string,
): editor.IEditorDecorationsCollection {
  const decos: editor.IModelDeltaDecoration[] = []
  const totalLines = ed.getModel()?.getLineCount() ?? 0

  for (const h of hunks) {
    const isConflict = Array.from({ length: h.baseEnd - h.baseStart }, (_, k) => h.baseStart + k)
      .some((l) => conflicts.has(l))
    const cls = isConflict ? DECO_CLASSES.conflict : (role === 'base' ? DECO_CLASSES.baseChanged : addedClass)

    if (role === 'base') {
      // Highlight the base lines that change
      if (h.baseStart < h.baseEnd) {
        decos.push({
          range: new monaco.Range(h.baseStart + 1, 1, h.baseEnd, 1),
          options: { isWholeLine: true, className: cls },
        })
      }
    } else {
      // Highlight the side's added lines
      if (h.sideStart < h.sideEnd) {
        const sideLineCount = h.sideEnd - h.sideStart
        decos.push({
          range: new monaco.Range(h.sideStart + 1, 1, h.sideStart + sideLineCount, 1),
          options: { isWholeLine: true, className: cls },
        })
      }
      // Mark deleted lines as a gutter indicator (0-height decoration)
      if (h.baseStart < h.baseEnd && h.sideStart <= totalLines) {
        decos.push({
          range: new monaco.Range(Math.max(1, h.sideStart), 1, Math.max(1, h.sideStart), 1),
          options: { isWholeLine: false, className: removedClass, glyphMarginClassName: removedClass },
        })
      }
    }
  }

  return ed.createDecorationsCollection(decos)
}

// --- Conflict resolution helpers (operate on merge editor content) ---

function resolveConflictAtCursor(ed: editor.IStandaloneCodeEditor, choice: 'left' | 'right' | 'both') {
  const model = ed.getModel()
  if (!model) return

  const lines = model.getLinesContent()
  const cursorLine0 = (ed.getPosition()?.lineNumber ?? 1) - 1

  // Scan backwards from cursor to find <<<<<<<
  let startLine0 = -1
  for (let i = Math.min(cursorLine0, lines.length - 1); i >= 0; i--) {
    if (lines[i].startsWith('<<<<<<<')) { startLine0 = i; break }
    if (lines[i].startsWith('>>>>>>>')) break
  }
  if (startLine0 === -1) return

  let sepLine0 = -1, baseSep0 = -1, endLine0 = -1
  for (let i = startLine0 + 1; i < lines.length; i++) {
    if (lines[i].startsWith('|||||||')) baseSep0 = i
    else if (lines[i].startsWith('=======') && sepLine0 === -1) sepLine0 = i
    else if (lines[i].startsWith('>>>>>>>')) { endLine0 = i; break }
  }
  if (sepLine0 === -1 || endLine0 === -1) return

  const leftContent = lines.slice(startLine0 + 1, baseSep0 !== -1 ? baseSep0 : sepLine0)
  const rightContent = lines.slice(sepLine0 + 1, endLine0)

  const replacement = choice === 'left' ? leftContent : choice === 'right' ? rightContent : [...leftContent, ...rightContent]

  model.pushEditOperations([], [{
    range: {
      startLineNumber: startLine0 + 1, startColumn: 1,
      endLineNumber: endLine0 + 1, endColumn: model.getLineMaxColumn(endLine0 + 1),
    },
    text: replacement.join('\n'),
  }], () => null)

  ed.focus()
}

function resolveAllConflicts(ed: editor.IStandaloneCodeEditor, choice: 'left' | 'right') {
  let safety = 200
  while (safety-- > 0) {
    const lines = ed.getModel()?.getLinesContent() ?? []
    const idx = lines.findIndex((l) => l.startsWith('<<<<<<<'))
    if (idx === -1) break
    ed.setPosition({ lineNumber: idx + 1, column: 1 })
    resolveConflictAtCursor(ed, choice)
  }
}

function navigateConflict(ed: editor.IStandaloneCodeEditor, direction: 'next' | 'prev') {
  const model = ed.getModel()
  if (!model) return
  const lines = model.getLinesContent()
  const cursorLine = ed.getPosition()?.lineNumber ?? 1

  const conflictStarts: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('<<<<<<<')) conflictStarts.push(i + 1)
  }
  if (conflictStarts.length === 0) return

  const target = direction === 'next'
    ? (conflictStarts.find((l) => l > cursorLine) ?? conflictStarts[0])
    : ([...conflictStarts].reverse().find((l) => l < cursorLine) ?? conflictStarts[conflictStarts.length - 1])

  ed.setPosition({ lineNumber: target, column: 1 })
  ed.revealLineInCenter(target)
  ed.focus()
}

// --- Three-Way Component ---

interface PanelProps {
  label: string
  value: string
  onChange: (v: string) => void
  theme: string
  language: string
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>
  monacoRef: React.MutableRefObject<Monaco | null>
  onMount?: () => void
  options: editor.IStandaloneEditorConstructionOptions
}

const EDITOR_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
  fontLigatures: false,
  scrollBeyondLastLine: false,
  padding: { top: 12, bottom: 12 },
  automaticLayout: true,
  scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6, useShadows: false },
  overviewRulerBorder: false,
  glyphMargin: true,
  lineNumbersMinChars: 3,
  minimap: { enabled: false },
}

export function ThreeWayMode() {
  const { dark, mode: themeMode, toggle: toggleTheme } = useTheme()
  const editorTheme = dark ? 'diff-dark' : 'diff-light'

  const [leftText, setLeftText] = useState('')
  const [baseText, setBaseText] = useState('')
  const [rightText, setRightText] = useState('')
  const [language, setLanguage] = useState('plaintext')
  const [showMerge, setShowMerge] = useState(false)

  const leftRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const baseRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const rightRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const mergeRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const decoRefs = useRef<{ l?: editor.IEditorDecorationsCollection; b?: editor.IEditorDecorationsCollection; r?: editor.IEditorDecorationsCollection }>({})
  const [remainingConflicts, setRemainingConflicts] = useState(0)

  // Recompute diff decorations whenever content changes
  useEffect(() => {
    const monaco = monacoRef.current
    const leftEd = leftRef.current
    const baseEd = baseRef.current
    const rightEd = rightRef.current
    if (!monaco || !leftEd || !baseEd || !rightEd) return

    const baseLines = baseText.split('\n')
    const leftLines = leftText.split('\n')
    const rightLines = rightText.split('\n')

    const leftHunks = diffHunks(baseLines, leftLines)
    const rightHunks = diffHunks(baseLines, rightLines)
    const conflicts = findConflicts(leftHunks, rightHunks)

    decoRefs.current.l?.clear()
    decoRefs.current.b?.clear()
    decoRefs.current.r?.clear()

    decoRefs.current.l = applyDecorations(leftEd, monaco, leftHunks, conflicts, 'left', DECO_CLASSES.leftAdded, DECO_CLASSES.leftRemoved)
    decoRefs.current.b = applyDecorations(baseEd, monaco, [...leftHunks, ...rightHunks], conflicts, 'base', DECO_CLASSES.baseChanged, DECO_CLASSES.baseChanged)
    decoRefs.current.r = applyDecorations(rightEd, monaco, rightHunks, conflicts, 'right', DECO_CLASSES.rightAdded, DECO_CLASSES.rightRemoved)

    // Update merge result
    if (mergeRef.current) {
      const { lines } = computeMerge(baseLines, leftLines, rightLines, leftHunks, rightHunks)
      mergeRef.current.setValue(lines.join('\n'))
      setRemainingConflicts(lines.filter((l) => l.startsWith('<<<<<<<')).length)
    }
  }, [leftText, baseText, rightText])

  // Sync language from detected content
  useEffect(() => {
    const text = leftText || baseText || rightText
    if (text) setLanguage(detectLanguage(text))
  }, [leftText, baseText, rightText])

  const onBeforeMount = useCallback((monaco: Monaco) => {
    registerThemes(monaco)
  }, [])

  const onEditorMount = useCallback((ed: editor.IStandaloneCodeEditor, monaco: Monaco, role: 'left' | 'base' | 'right' | 'merge') => {
    monacoRef.current = monaco
    if (role === 'left') leftRef.current = ed
    else if (role === 'base') baseRef.current = ed
    else if (role === 'right') rightRef.current = ed
    else {
      mergeRef.current = ed
      ed.onDidChangeModelContent(() => {
        const count = ed.getValue().split('\n').filter((l) => l.startsWith('<<<<<<<')).length
        setRemainingConflicts(count)
      })
    }
  }, [])

  // Keyboard shortcuts for merge panel
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (!showMerge || !mergeRef.current) return
      const ctrl = e.ctrlKey || e.metaKey
      if (ctrl && e.altKey && e.key === 'ArrowDown') {
        e.preventDefault()
        navigateConflict(mergeRef.current, 'next')
      } else if (ctrl && e.altKey && e.key === 'ArrowUp') {
        e.preventDefault()
        navigateConflict(mergeRef.current, 'prev')
      } else if (ctrl && e.shiftKey && (e.key === 'L' || e.key === 'l')) {
        e.preventDefault()
        resolveConflictAtCursor(mergeRef.current, 'left')
      } else if (ctrl && e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault()
        resolveConflictAtCursor(mergeRef.current, 'right')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showMerge])

  const panels = [
    { role: 'left' as const, label: 'Left (Mine)', ref: leftRef, text: leftText, onChange: setLeftText, accent: 'var(--green)' },
    { role: 'base' as const, label: 'Base', ref: baseRef, text: baseText, onChange: setBaseText, accent: 'var(--text-dim)' },
    { role: 'right' as const, label: 'Right (Theirs)', ref: rightRef, text: rightText, onChange: setRightText, accent: 'oklch(60% 0.18 240)' },
  ]

  const isEmpty = !leftText && !baseText && !rightText

  const stats = useMemo(() => {
    if (!baseText) return null
    const baseLines = baseText.split('\n')
    const leftHunks = diffHunks(baseLines, leftText.split('\n'))
    const rightHunks = diffHunks(baseLines, rightText.split('\n'))
    const conflicts = findConflicts(leftHunks, rightHunks)
    return { leftChanges: leftHunks.length, rightChanges: rightHunks.length, conflicts: conflicts.size }
  }, [baseText, leftText, rightText])

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <nav className="toolbar" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="toolbar-brand">
          <a href="/" className="toolbar-title-link">
            <h1 className="toolbar-title">diff</h1>
          </a>
          <span className="toolbar-subtitle">compare anything</span>
        </div>
        <div className="toolbar-controls">
          {stats && (
            <>
              {stats.leftChanges > 0 && <span style={{ fontSize: 12, color: 'var(--green)' }}>{stats.leftChanges} left</span>}
              {stats.rightChanges > 0 && <span style={{ fontSize: 12, color: 'oklch(60% 0.18 240)' }}>{stats.rightChanges} right</span>}
              {stats.conflicts > 0 && <span style={{ fontSize: 12, color: 'var(--amber)' }}>{stats.conflicts} conflict{stats.conflicts !== 1 ? 's' : ''}</span>}
              <div className="divider" aria-hidden="true" />
            </>
          )}
          <button
            className={`btn outlined ${showMerge ? 'active' : ''}`}
            onClick={() => setShowMerge((v) => !v)}
            disabled={isEmpty}
          >
            Merge result
          </button>
          <div className="divider" aria-hidden="true" />
          <button onClick={toggleTheme} className="btn icon">
            {themeMode === 'system' ? <MonitorIcon /> : themeMode === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </nav>

      <ModeTabs />

      {isEmpty && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', zIndex: 10, pointerEvents: 'none' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
            Paste into all three panels to compare
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            Left (Mine) · Base · Right (Theirs)
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Three editors */}
        <div style={{ flex: showMerge ? '0 0 60%' : 1, display: 'flex', minHeight: 0 }}>
          {panels.map(({ role, label, text, onChange, accent }) => (
            <div key={role} style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: role !== 'right' ? '1px solid var(--border)' : 'none', minWidth: 0 }}>
              <div style={{ height: 26, display: 'flex', alignItems: 'center', padding: '0 8px 0 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 6 }}>
                <span style={{ flex: 1, fontSize: 11, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.06em', color: accent }}>
                  {label}
                </span>
                {text && (
                  <button
                    className="btn icon"
                    style={{ width: 18, height: 18, fontSize: 10, opacity: 0.5 }}
                    title="Clear this panel"
                    onClick={() => onChange('')}
                  >×</button>
                )}
                <label
                  className="btn icon"
                  style={{ width: 18, height: 18, fontSize: 10, opacity: 0.55, cursor: 'pointer' }}
                  title={`Load file into ${label}`}
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L14 7H10V13H6V7H2L8 1Z" /></svg>
                  <input type="file" style={{ display: 'none' }} onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) f.text().then(onChange)
                    e.target.value = ''
                  }} />
                </label>
              </div>
              <div style={{ flex: 1, minHeight: 0 }}>
                <Suspense fallback={null}>
                  <LazyEditor
                    value={text}
                    onChange={(v) => onChange(v ?? '')}
                    language={language}
                    theme={editorTheme}
                    beforeMount={onBeforeMount}
                    onMount={(ed, monaco) => onEditorMount(ed, monaco, role)}
                    options={EDITOR_OPTIONS}
                  />
                </Suspense>
              </div>
            </div>
          ))}
        </div>

        {/* Merge result panel */}
        {showMerge && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)', minHeight: 0 }}>
            <div style={{ height: 32, display: 'flex', alignItems: 'center', padding: '0 8px', gap: 4, background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', marginRight: 4 }}>
                Merge Result
              </span>
              {remainingConflicts > 0 && (
                <>
                  <span style={{ fontSize: 11, color: 'var(--amber)', marginRight: 4 }}>
                    {remainingConflicts} conflict{remainingConflicts !== 1 ? 's' : ''} remaining
                  </span>
                  <button className="btn outlined" style={{ fontSize: 11, height: 22, padding: '0 7px' }}
                    title="Jump to previous conflict"
                    onClick={() => mergeRef.current && navigateConflict(mergeRef.current, 'prev')}>
                    ↑ Prev
                  </button>
                  <button className="btn outlined" style={{ fontSize: 11, height: 22, padding: '0 7px' }}
                    title="Jump to next conflict"
                    onClick={() => mergeRef.current && navigateConflict(mergeRef.current, 'next')}>
                    ↓ Next
                  </button>
                  <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
                  <button className="btn outlined" style={{ fontSize: 11, height: 22, padding: '0 7px', color: 'var(--green)' }}
                    title="Replace conflict at cursor with left (mine) content"
                    onClick={() => mergeRef.current && resolveConflictAtCursor(mergeRef.current, 'left')}>
                    Use Left
                  </button>
                  <button className="btn outlined" style={{ fontSize: 11, height: 22, padding: '0 7px', color: 'oklch(60% 0.18 240)' }}
                    title="Replace conflict at cursor with right (theirs) content"
                    onClick={() => mergeRef.current && resolveConflictAtCursor(mergeRef.current, 'right')}>
                    Use Right
                  </button>
                  <button className="btn outlined" style={{ fontSize: 11, height: 22, padding: '0 7px' }}
                    title="Keep both left and right content for conflict at cursor"
                    onClick={() => mergeRef.current && resolveConflictAtCursor(mergeRef.current, 'both')}>
                    Use Both
                  </button>
                  <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
                  <button className="btn outlined" style={{ fontSize: 11, height: 22, padding: '0 7px', color: 'var(--green)' }}
                    title="Resolve ALL conflicts using left content"
                    onClick={() => mergeRef.current && resolveAllConflicts(mergeRef.current, 'left')}>
                    All Left
                  </button>
                  <button className="btn outlined" style={{ fontSize: 11, height: 22, padding: '0 7px', color: 'oklch(60% 0.18 240)' }}
                    title="Resolve ALL conflicts using right content"
                    onClick={() => mergeRef.current && resolveAllConflicts(mergeRef.current, 'right')}>
                    All Right
                  </button>
                </>
              )}
              <span style={{ flex: 1 }} />
              {remainingConflicts === 0 && showMerge && (
                <span style={{ fontSize: 11, color: 'var(--green)', marginRight: 8 }}>✓ All resolved</span>
              )}
              <button
                className="btn outlined"
                style={{ fontSize: 11, height: 22, padding: '0 8px' }}
                onClick={() => {
                  const text = mergeRef.current?.getValue() ?? ''
                  navigator.clipboard.writeText(text)
                }}
              >
                Copy
              </button>
              <button
                className="btn outlined"
                style={{ fontSize: 11, height: 22, padding: '0 8px' }}
                onClick={() => {
                  const text = mergeRef.current?.getValue() ?? ''
                  downloadText(text, 'merge-result.txt')
                }}
              >
                Download
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Suspense fallback={null}>
                <LazyEditor
                  defaultValue=""
                  language={language}
                  theme={editorTheme}
                  beforeMount={onBeforeMount}
                  onMount={(ed, monaco) => onEditorMount(ed, monaco, 'merge')}
                  options={{ ...EDITOR_OPTIONS, readOnly: false }}
                />
              </Suspense>
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="status-bar">
        <div style={{ display: 'flex', gap: 16 }}>
          {stats ? (
            <>
              {stats.conflicts > 0
                ? remainingConflicts > 0
                  ? <span style={{ color: 'var(--amber)' }}>{remainingConflicts} / {stats.conflicts} conflict{stats.conflicts !== 1 ? 's' : ''} remaining</span>
                  : <span style={{ color: 'var(--green)' }}>All conflicts resolved</span>
                : <span style={{ color: 'var(--green)' }}>No conflicts</span>}
              <span style={{ color: 'var(--green)' }}>{stats.leftChanges} left change{stats.leftChanges !== 1 ? 's' : ''}</span>
              <span style={{ color: 'oklch(60% 0.18 240)' }}>{stats.rightChanges} right change{stats.rightChanges !== 1 ? 's' : ''}</span>
            </>
          ) : (
            <span style={{ color: 'var(--text-dim)' }}>Three-way merge — paste Base, Left, and Right versions</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{language}</div>
      </div>
    </div>
  )
}
