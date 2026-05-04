import { useCallback, useEffect, useMemo, useState } from 'react'
import { ModeTabs } from '../../components/mode-tabs'
import { useTheme } from '../../hooks/use-theme'
import { MoonIcon, MonitorIcon, SunIcon } from '../../components/icons'
import { encodeText, decodeText } from '../../share'

// ── Notebook types ──────────────────────────────────────────────────────────

interface CellOutput {
  output_type: string
  text?: string | string[]
  data?: Record<string, string | string[]>
  traceback?: string[]
}

interface NbCell {
  cell_type: 'code' | 'markdown' | 'raw'
  source: string | string[]
  execution_count?: number | null
  outputs?: CellOutput[]
}

interface Notebook {
  nbformat?: number
  cells: NbCell[]
  metadata?: {
    kernelspec?: { language?: string; name?: string; display_name?: string }
    language_info?: { name?: string }
  }
}

// ── Parsing ─────────────────────────────────────────────────────────────────

function cellSource(cell: NbCell): string {
  return Array.isArray(cell.source) ? cell.source.join('') : cell.source ?? ''
}

function parseNotebook(text: string): { nb: Notebook; error: string | null } {
  try {
    const obj = JSON.parse(text)
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.cells)) {
      return { nb: { cells: [] }, error: 'Not a valid .ipynb file (missing "cells" array)' }
    }
    return { nb: obj as Notebook, error: null }
  } catch (e) {
    return { nb: { cells: [] }, error: `JSON parse error: ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ── LCS cell diff ────────────────────────────────────────────────────────────

type CellDiffType = 'same' | 'changed' | 'added' | 'removed'

interface CellDiff {
  type: CellDiffType
  left: NbCell | null
  right: NbCell | null
  idx: number
}

function cellKey(cell: NbCell): string {
  return `${cell.cell_type}::${cellSource(cell)}`
}

function lcsIndices(a: string[], b: string[]): [number, number][] {
  const n = a.length, m = b.length
  if (n === 0 || m === 0) return []
  if (n > 500 || m > 500) return []
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  const pairs: [number, number][] = []
  let i = n, j = m
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { pairs.unshift([i - 1, j - 1]); i--; j-- }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--
    else j--
  }
  return pairs
}

function diffCells(left: NbCell[], right: NbCell[]): CellDiff[] {
  const leftKeys = left.map(cellKey)
  const rightKeys = right.map(cellKey)
  const pairs = lcsIndices(leftKeys, rightKeys)
  const leftMatch = new Set(pairs.map(([l]) => l))
  const rightMatch = new Set(pairs.map(([, r]) => r))

  const result: CellDiff[] = []
  let li = 0, ri = 0, pairIdx = 0

  while (li < left.length || ri < right.length) {
    const nextPair = pairs[pairIdx]
    if (nextPair && li === nextPair[0] && ri === nextPair[1]) {
      result.push({ type: 'same', left: left[li], right: right[ri], idx: result.length })
      li++; ri++; pairIdx++
    } else {
      const ld = li >= left.length
      const rd = ri >= right.length
      if (ld) { result.push({ type: 'added', left: null, right: right[ri], idx: result.length }); ri++ }
      else if (rd) { result.push({ type: 'removed', left: left[li], right: null, idx: result.length }); li++ }
      else if (!leftMatch.has(li) && !rightMatch.has(ri)) {
        result.push({ type: 'changed', left: left[li], right: right[ri], idx: result.length })
        li++; ri++
      } else if (!leftMatch.has(li)) {
        result.push({ type: 'removed', left: left[li], right: null, idx: result.length }); li++
      } else {
        result.push({ type: 'added', left: null, right: right[ri], idx: result.length }); ri++
      }
    }
  }
  return result
}

// ── Line-level source diff ───────────────────────────────────────────────────

interface LineDiff { type: '=' | '+' | '-'; text: string }

function diffLines(leftSrc: string, rightSrc: string): LineDiff[] {
  const a = leftSrc.split('\n')
  const b = rightSrc.split('\n')
  const n = a.length, m = b.length
  if (n > 1000 || m > 1000) {
    return [
      ...a.map((t) => ({ type: '-' as const, text: t })),
      ...b.map((t) => ({ type: '+' as const, text: t })),
    ]
  }
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  const pairs: [number, number][] = []
  let i = n, j = m
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { pairs.unshift([i - 1, j - 1]); i--; j-- }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--
    else j--
  }

  const result: LineDiff[] = []
  let pi = 0, pj = 0
  for (const [li, ri] of pairs) {
    while (pi < li) result.push({ type: '-', text: a[pi++] })
    while (pj < ri) result.push({ type: '+', text: b[pj++] })
    result.push({ type: '=', text: a[pi++] })
    pj++
  }
  while (pi < a.length) result.push({ type: '-', text: a[pi++] })
  while (pj < b.length) result.push({ type: '+', text: b[pj++] })
  return result
}

// ── Cell components ──────────────────────────────────────────────────────────

const BG: Record<CellDiffType, string> = {
  same: 'transparent',
  changed: 'oklch(95% 0.02 80 / 0.3)',
  added: 'var(--green-bg)',
  removed: 'var(--red-bg)',
}

const BADGE: Record<'code' | 'markdown' | 'raw', { label: string; color: string }> = {
  code: { label: 'Code', color: 'var(--accent)' },
  markdown: { label: 'MD', color: 'var(--amber)' },
  raw: { label: 'Raw', color: 'var(--text-dim)' },
}

function CellBadge({ type }: { type: 'code' | 'markdown' | 'raw' }) {
  const { label, color } = BADGE[type]
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
      color, border: `1px solid ${color}`, borderRadius: 3, padding: '1px 5px', flexShrink: 0,
    }}>{label}</span>
  )
}

function SourceDiff({ lines }: { lines: LineDiff[] }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, overflowX: 'auto' }}>
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            padding: '1px 8px',
            background: line.type === '+' ? 'oklch(88% 0.07 140 / 0.4)'
              : line.type === '-' ? 'oklch(88% 0.07 30 / 0.4)'
              : 'transparent',
            color: line.type === '+' ? 'var(--green)'
              : line.type === '-' ? 'var(--red)'
              : 'var(--text-secondary)',
            whiteSpace: 'pre',
          }}
        >
          <span style={{ userSelect: 'none', marginRight: 8, opacity: 0.5, fontSize: 10 }}>
            {line.type === '+' ? '+' : line.type === '-' ? '-' : ' '}
          </span>
          {line.text}
        </div>
      ))}
    </div>
  )
}

function OutputPreview({ outputs }: { outputs: CellOutput[] }) {
  if (!outputs || outputs.length === 0) return null
  return (
    <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px dashed var(--border)' }}>
      {outputs.slice(0, 3).map((out, i) => {
        let text = ''
        if (out.output_type === 'stream' || out.output_type === 'display_data' || out.output_type === 'execute_result') {
          const src = out.text ?? out.data?.['text/plain']
          text = Array.isArray(src) ? src.join('') : (src ?? '')
        } else if (out.output_type === 'error') {
          text = out.traceback ? out.traceback.slice(0, 3).join('\n') : ''
        }
        if (!text.trim()) return null
        const lines = text.split('\n').slice(0, 6)
        const truncated = text.split('\n').length > 6
        return (
          <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: out.output_type === 'error' ? 'var(--red)' : 'var(--text-muted)', padding: '2px 0' }}>
            {lines.join('\n')}{truncated ? '\n…' : ''}
          </div>
        )
      })}
    </div>
  )
}

function CellRow({ diff, showSame, lang }: { diff: CellDiff; showSame: boolean; lang: string }) {
  const [collapsed, setCollapsed] = useState(diff.type === 'same')

  if (diff.type === 'same' && !showSame) return null

  const cell = diff.right ?? diff.left!
  const cellType = cell.cell_type
  const leftSrc = diff.left ? cellSource(diff.left) : ''
  const rightSrc = diff.right ? cellSource(diff.right) : ''

  const lineDiffs = useMemo(
    () => diff.type === 'changed' ? diffLines(leftSrc, rightSrc) : null,
    [diff.type, leftSrc, rightSrc]
  )

  const statusColor = diff.type === 'added' ? 'var(--green)'
    : diff.type === 'removed' ? 'var(--red)'
    : diff.type === 'changed' ? 'var(--amber)'
    : 'var(--text-dim)'

  return (
    <div style={{
      background: BG[diff.type],
      border: '1px solid var(--border-subtle)',
      borderLeft: `3px solid ${statusColor}`,
      borderRadius: 6,
      marginBottom: 8,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setCollapsed((v) => !v) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 10px', cursor: 'pointer', outline: 'none',
          background: 'var(--surface)',
          borderBottom: collapsed ? 'none' : '1px solid var(--border-subtle)',
        }}
      >
        <span style={{ fontSize: 9, color: 'var(--text-dim)', width: 10 }}>{collapsed ? '▶' : '▼'}</span>
        <CellBadge type={cellType} />
        {cellType === 'code' && cell.execution_count != null && (
          <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
            [{cell.execution_count}]
          </span>
        )}
        <span style={{ fontSize: 11, color: statusColor, marginLeft: 'auto', flexShrink: 0 }}>
          {diff.type === 'same' ? 'Unchanged'
            : diff.type === 'added' ? 'Added'
            : diff.type === 'removed' ? 'Removed'
            : 'Changed'}
        </span>
        {diff.type === 'same' && (
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {rightSrc.split('\n')[0].slice(0, 60)}
          </span>
        )}
      </div>

      {!collapsed && (
        <div style={{ padding: '8px 10px' }}>
          {diff.type === 'changed' && lineDiffs ? (
            <SourceDiff lines={lineDiffs} />
          ) : diff.type === 'added' ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
              {rightSrc || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>(empty cell)</span>}
            </div>
          ) : diff.type === 'removed' ? (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', opacity: 0.7 }}>
              {leftSrc || <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>(empty cell)</span>}
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
              {rightSrc}
            </div>
          )}
          {cell.outputs && cell.outputs.length > 0 && diff.type !== 'removed' && (
            <OutputPreview outputs={diff.type === 'removed' ? diff.left!.outputs ?? [] : cell.outputs} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Main mode component ───────────────────────────────────────────────────────

export function NotebookMode() {
  const { mode: themeMode, toggle: toggleTheme } = useTheme()
  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [showSame, setShowSame] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const l = params.get('l'), r = params.get('r')
    ;(async () => {
      if (l) { const t = await decodeText(l); if (t) setLeftText(t) }
      if (r) { const t = await decodeText(r); if (t) setRightText(t) }
    })()
  }, [])

  const { nb: leftNb, error: leftError } = useMemo(() => parseNotebook(leftText || '{"cells":[]}'), [leftText])
  const { nb: rightNb, error: rightError } = useMemo(() => parseNotebook(rightText || '{"cells":[]}'), [rightText])

  const diffs = useMemo(() => {
    if (!leftText.trim() && !rightText.trim()) return []
    return diffCells(leftNb.cells, rightNb.cells)
  }, [leftNb, rightNb, leftText, rightText])

  const lang = rightNb.metadata?.kernelspec?.language
    ?? leftNb.metadata?.kernelspec?.language
    ?? rightNb.metadata?.language_info?.name
    ?? leftNb.metadata?.language_info?.name
    ?? 'python'

  const stats = useMemo(() => ({
    added: diffs.filter((d) => d.type === 'added').length,
    removed: diffs.filter((d) => d.type === 'removed').length,
    changed: diffs.filter((d) => d.type === 'changed').length,
    same: diffs.filter((d) => d.type === 'same').length,
  }), [diffs])

  const share = useCallback(async () => {
    if (!leftText.trim() && !rightText.trim()) return
    const [encL, encR] = await Promise.all([encodeText(leftText), encodeText(rightText)])
    const url = `${window.location.origin}/notebook?l=${encodeURIComponent(encL)}&r=${encodeURIComponent(encR)}`
    await navigator.clipboard.writeText(url)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }, [leftText, rightText])

  function handleFile(side: 'left' | 'right', file: File) {
    file.text().then((text) => {
      if (side === 'left') setLeftText(text)
      else setRightText(text)
    })
  }

  const hasData = leftText.trim().length > 0 || rightText.trim().length > 0

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <nav className="toolbar" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="toolbar-brand">
          <a href="/" className="toolbar-title-link" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1 className="toolbar-title">diff</h1>
          </a>
          <span className="toolbar-subtitle">compare anything</span>
        </div>
        <div className="toolbar-controls">
          {(['left', 'right'] as const).map((side) => (
            <label key={side} className="btn outlined" style={{ cursor: 'pointer', fontSize: 12 }}>
              Open {side === 'left' ? 'original' : 'modified'}
              <input
                type="file"
                accept=".ipynb"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(side, f) }}
              />
            </label>
          ))}
          {hasData && (
            <>
              <button
                className={`btn outlined ${showSame ? 'active' : ''}`}
                onClick={() => setShowSame((v) => !v)}
                title="Show unchanged cells"
              >
                Show unchanged
              </button>
              <button className="btn outlined" onClick={share}>
                {shareCopied ? 'Copied!' : 'Share'}
              </button>
            </>
          )}
          <div className="divider" aria-hidden="true" />
          <button onClick={toggleTheme} className="btn icon">
            {themeMode === 'system' ? <MonitorIcon /> : themeMode === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </nav>

      <ModeTabs />

      {/* Input panels — always visible when no data yet, sticky-collapsible when there is data */}
      {(!hasData) && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {(['left', 'right'] as const).map((side) => {
            const err = side === 'left' ? leftError : rightError
            return (
              <div
                key={side}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: side === 'left' ? '1px solid var(--border)' : 'none', height: 220 }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(side, f) }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface)', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.06em', color: err ? 'var(--red)' : 'var(--text-dim)' }}>
                    {side === 'left' ? 'Original' : 'Modified'}{err ? ' — parse error' : ''}
                  </span>
                  <label className="btn outlined" style={{ fontSize: 11.5, cursor: 'pointer' }}>
                    Open .ipynb
                    <input type="file" accept=".ipynb" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(side, f) }} />
                  </label>
                </div>
                <textarea
                  value={side === 'left' ? leftText : rightText}
                  onChange={(e) => side === 'left' ? setLeftText(e.target.value) : setRightText(e.target.value)}
                  placeholder={'Paste .ipynb JSON here or drop a file…\n\n{"nbformat": 4, "cells": [...]}'}
                  spellCheck={false}
                  style={{
                    flex: 1, resize: 'none', border: 'none', outline: 'none', padding: '8px 12px',
                    fontFamily: 'var(--font-mono)', fontSize: 11.5,
                    background: err ? 'var(--red-bg)' : 'var(--bg)', color: 'var(--text)',
                  }}
                />
              </div>
            )
          })}
        </div>
      )}

      {hasData ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px' }}>
          {(leftError || rightError) && (
            <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12 }}>
              {leftError && <div>Original: {leftError}</div>}
              {rightError && <div>Modified: {rightError}</div>}
            </div>
          )}
          {lang && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
              Kernel: {lang}{rightNb.metadata?.kernelspec?.display_name ? ` (${rightNb.metadata.kernelspec.display_name})` : ''}
              {' · '}
              <button
                className="btn outlined"
                style={{ fontSize: 10.5, height: 18, padding: '0 6px', marginLeft: 4 }}
                onClick={() => { setLeftText(''); setRightText('') }}
              >
                Load new notebooks
              </button>
            </div>
          )}
          {diffs.length === 0 && !leftError && !rightError && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>
              No cells found — check the notebook format
            </div>
          )}
          {diffs.map((diff, i) => (
            <CellRow key={i} diff={diff} showSame={showSame} lang={lang} />
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
          Paste .ipynb JSON above or open files to compare
        </div>
      )}

      <div className="status-bar">
        <div style={{ display: 'flex', gap: 16 }}>
          {stats.changed > 0 && <span style={{ color: 'var(--amber)' }}>{stats.changed} changed</span>}
          {stats.added > 0 && <span className="stat-green">+{stats.added} added</span>}
          {stats.removed > 0 && <span className="stat-red">-{stats.removed} removed</span>}
          {stats.same > 0 && <span>{stats.same} unchanged</span>}
          {!hasData && <span>Open .ipynb files to compare</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {hasData ? `${diffs.length} cell${diffs.length !== 1 ? 's' : ''} total` : ''}
        </div>
      </div>
    </div>
  )
}
