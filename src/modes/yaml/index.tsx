import { useCallback, useEffect, useMemo, useState } from 'react'
import { load as yamlLoad } from 'js-yaml'
import { ModeTabs } from '../../components/mode-tabs'
import { useTheme } from '../../hooks/use-theme'
import { MoonIcon, MonitorIcon, SunIcon } from '../../components/icons'
import { downloadText } from '../../export'
import { encodeText, decodeText } from '../../share'

// Re-use the same diff types and algorithm as JSON mode but with YAML parsing
type DiffType = 'same' | 'changed' | 'added' | 'removed' | 'modified'

interface DiffNode {
  type: DiffType
  key: string | number
  leftVal: unknown
  rightVal: unknown
  children: DiffNode[]
  isArray: boolean
}

function yamlDiff(left: unknown, right: unknown, key: string | number = 'root'): DiffNode {
  if (left === undefined && right === undefined) {
    return { type: 'same', key, leftVal: undefined, rightVal: undefined, children: [], isArray: false }
  }
  if (left === undefined) {
    return { type: 'added', key, leftVal: undefined, rightVal: right, children: [], isArray: false }
  }
  if (right === undefined) {
    return { type: 'removed', key, leftVal: left, rightVal: undefined, children: [], isArray: false }
  }
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    const same = JSON.stringify(left) === JSON.stringify(right)
    return { type: same ? 'same' : 'changed', key, leftVal: left, rightVal: right, children: [], isArray: false }
  }

  const leftIsArray = Array.isArray(left)
  const rightIsArray = Array.isArray(right)

  if (leftIsArray && rightIsArray) {
    const la = left as unknown[]
    const ra = right as unknown[]
    const len = Math.max(la.length, ra.length)
    const children = Array.from({ length: len }, (_, i) => yamlDiff(la[i], ra[i], i))
    const anyDiff = children.some((c) => c.type !== 'same')
    return { type: anyDiff ? 'modified' : 'same', key, leftVal: left, rightVal: right, children, isArray: true }
  }

  if (!leftIsArray && !rightIsArray) {
    const lo = left as Record<string, unknown>
    const ro = right as Record<string, unknown>
    const allKeys = new Set([...Object.keys(lo), ...Object.keys(ro)])
    const children = [...allKeys].map((k) => yamlDiff(lo[k], ro[k], k))
    const anyDiff = children.some((c) => c.type !== 'same')
    return { type: anyDiff ? 'modified' : 'same', key, leftVal: left, rightVal: right, children, isArray: false }
  }

  // Type mismatch: one is array, other isn't
  return { type: 'changed', key, leftVal: left, rightVal: right, children: [], isArray: false }
}

function nodeMatchesSearch(node: DiffNode, q: string): boolean {
  if (!q) return true
  if (String(node.key).toLowerCase().includes(q)) return true
  if (node.children.length === 0) {
    const lv = String(node.leftVal ?? '').toLowerCase()
    const rv = String(node.rightVal ?? '').toLowerCase()
    return lv.includes(q) || rv.includes(q)
  }
  return node.children.some((c) => nodeMatchesSearch(c, q))
}

function countDiffs(node: DiffNode): { added: number; removed: number; changed: number; same: number } {
  const acc = { added: 0, removed: 0, changed: 0, same: 0 }
  function walk(n: DiffNode) {
    if (n.type === 'added') acc.added++
    else if (n.type === 'removed') acc.removed++
    else if (n.type === 'changed') acc.changed++
    else if (n.type === 'same' && n.children.length === 0) acc.same++
    n.children.forEach(walk)
  }
  walk(node)
  return acc
}

const valBg: Record<DiffType, string> = {
  same: 'transparent',
  changed: 'var(--amber-bg)',
  added: 'var(--green-bg)',
  removed: 'var(--red-bg)',
  modified: 'transparent',
}

function YamlValue({ val }: { val: unknown }) {
  if (val === null) return <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>null</span>
  if (val === undefined) return <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>—</span>
  if (typeof val === 'boolean') return <span style={{ color: 'var(--accent)' }}>{String(val)}</span>
  if (typeof val === 'number') return <span style={{ color: '#d19a66' }}>{String(val)}</span>
  if (typeof val === 'string') {
    return (
      <span style={{ color: 'var(--text-secondary)' }}>
        {val.length > 100 ? val.slice(0, 100) + '…' : val}
      </span>
    )
  }
  return <span style={{ color: 'var(--text-dim)' }}>{JSON.stringify(val).slice(0, 60)}</span>
}

function YamlDiffRow({
  node,
  depth,
  showOnly,
  searchQuery,
  expandOverride,
  path,
}: {
  node: DiffNode
  depth: number
  showOnly: 'all' | 'changes'
  searchQuery: string
  expandOverride?: boolean
  path?: string
}) {
  const [localExpanded, setLocalExpanded] = useState(true)
  const [keyCopied, setKeyCopied] = useState(false)

  useEffect(() => {
    if (expandOverride !== undefined) setLocalExpanded(expandOverride)
  }, [expandOverride])

  const hasChildren = node.children.length > 0
  const indent = depth * 18
  const q = searchQuery.toLowerCase()

  if (showOnly === 'changes' && node.type === 'same' && node.children.length === 0) return null
  if (q && !nodeMatchesSearch(node, q)) return null

  function copyPath() {
    const p = path ?? String(node.key)
    navigator.clipboard.writeText(p).then(() => {
      setKeyCopied(true)
      setTimeout(() => setKeyCopied(false), 1200)
    })
  }

  const bg = valBg[node.type]

  if (!hasChildren) {
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        background: bg, borderBottom: '1px solid var(--border-subtle)',
        minHeight: 28, alignItems: 'stretch',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', paddingLeft: indent + 8, borderRight: '1px solid var(--border-subtle)', gap: 6 }}>
          <span
            style={{ color: keyCopied ? 'var(--accent)' : 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 11, minWidth: 20, cursor: 'copy', flexShrink: 0 }}
            title={`Click to copy path: ${path ?? node.key}`}
            onClick={copyPath}
          >
            {keyCopied ? '✓' : node.key}
          </span>
          <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>
            {node.type !== 'added' ? <YamlValue val={node.leftVal} /> : <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>—</span>}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', paddingLeft: 8, gap: 6 }}>
          {node.type === 'added' && <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700, background: 'var(--green-bg)', borderRadius: 3, padding: '1px 4px' }}>+</span>}
          {node.type === 'removed' && <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, background: 'var(--red-bg)', borderRadius: 3, padding: '1px 4px' }}>−</span>}
          {node.type === 'changed' && <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 700, borderRadius: 3, padding: '1px 4px' }}>≠</span>}
          <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>
            {node.type !== 'removed' ? <YamlValue val={node.rightVal} /> : <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>—</span>}
          </span>
        </div>
      </div>
    )
  }

  const prefix = node.isArray ? '[' : '{'
  const suffix = node.isArray ? ']' : '}'
  const hasDiffChildren = node.children.some((c) => c.type !== 'same')
  const indicatorColor = node.type === 'modified' ? 'var(--amber)' : 'var(--text-dim)'

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setLocalExpanded((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setLocalExpanded((v) => !v) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 8px', paddingLeft: indent + 8,
          borderBottom: '1px solid var(--border-subtle)',
          cursor: 'pointer', userSelect: 'none', minHeight: 28,
        }}
      >
        <span style={{ color: 'var(--text-dim)', fontSize: 10, width: 12, textAlign: 'center', flexShrink: 0 }}>
          {localExpanded ? '▼' : '▶'}
        </span>
        <span
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: keyCopied ? 'var(--accent)' : 'var(--text-dim)', minWidth: 20, cursor: 'copy' }}
          title={`Click to copy path: ${path ?? node.key}`}
          onClick={(e) => { e.stopPropagation(); copyPath() }}
        >
          {keyCopied ? '✓' : node.key}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-secondary)' }}>
          {prefix}
          <span style={{ color: 'var(--text-dim)', fontSize: 10.5 }}> {node.children.length} </span>
          {suffix}
        </span>
        {node.type === 'modified' && <span style={{ fontSize: 10, color: indicatorColor, fontWeight: 700 }}>·</span>}
        {hasDiffChildren && (
          <span style={{ fontSize: 10, color: 'var(--amber)', marginLeft: 2 }}>
            {node.children.filter((c) => c.type !== 'same').length} change{node.children.filter((c) => c.type !== 'same').length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {localExpanded && node.children.map((child, i) => {
        const myPath = path ?? String(node.key)
        const childPath = node.isArray ? `${myPath}[${child.key}]` : `${myPath}.${child.key}`
        return (
          <YamlDiffRow
            key={i}
            node={child}
            depth={depth + 1}
            showOnly={showOnly}
            searchQuery={searchQuery}
            expandOverride={expandOverride}
            path={childPath}
          />
        )
      })}
    </>
  )
}

export function YamlMode() {
  const { mode: themeMode, toggle: toggleTheme } = useTheme()
  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [showOnly, setShowOnly] = useState<'all' | 'changes'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandOverride, setExpandOverride] = useState<boolean | undefined>(undefined)
  const [expandKey, setExpandKey] = useState(0)
  const [leftError, setLeftError] = useState<string | null>(null)
  const [rightError, setRightError] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const l = params.get('l'), r = params.get('r')
    ;(async () => {
      if (l) { const t = await decodeText(l); if (t) setLeftText(t) }
      if (r) { const t = await decodeText(r); if (t) setRightText(t) }
    })()
  }, [])

  const leftParsed = useMemo(() => {
    if (!leftText.trim()) { setLeftError(null); return undefined }
    try {
      const v = yamlLoad(leftText)
      setLeftError(null)
      return v
    } catch (e) {
      setLeftError(String(e).slice(0, 200))
      return undefined
    }
  }, [leftText])

  const rightParsed = useMemo(() => {
    if (!rightText.trim()) { setRightError(null); return undefined }
    try {
      const v = yamlLoad(rightText)
      setRightError(null)
      return v
    } catch (e) {
      setRightError(String(e).slice(0, 200))
      return undefined
    }
  }, [rightText])

  const diffRoot = useMemo(() => {
    if (leftParsed === undefined && rightParsed === undefined) return null
    return yamlDiff(leftParsed, rightParsed, 'root')
  }, [leftParsed, rightParsed])

  const diffStats = useMemo(() => diffRoot ? countDiffs(diffRoot) : null, [diffRoot])
  const hasBoth = leftText.trim() && rightText.trim() && !leftError && !rightError && diffRoot

  const share = useCallback(async () => {
    if (!leftText.trim() && !rightText.trim()) return
    const [encL, encR] = await Promise.all([encodeText(leftText), encodeText(rightText)])
    await navigator.clipboard.writeText(`${window.location.origin}/yaml?l=${encodeURIComponent(encL)}&r=${encodeURIComponent(encR)}`)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }, [leftText, rightText])

  function exportReport() {
    if (!diffRoot) return
    const lines: string[] = ['YAML Diff Report', '================', '']
    function walk(n: DiffNode, prefix: string) {
      const icon = n.type === 'added' ? '+ ' : n.type === 'removed' ? '- ' : n.type === 'changed' ? '≠ ' : '  '
      if (n.children.length === 0 && n.type !== 'same') {
        lines.push(`${icon}${prefix}${n.key}:`)
        if (n.type !== 'added') lines.push(`    left:  ${JSON.stringify(n.leftVal)}`)
        if (n.type !== 'removed') lines.push(`    right: ${JSON.stringify(n.rightVal)}`)
      } else {
        n.children.forEach((c) => walk(c, prefix + (n.key === 'root' ? '' : String(n.key) + '.')))
      }
    }
    walk(diffRoot, '')
    downloadText(lines.join('\n'), 'yaml-diff-report.txt')
  }

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
          {hasBoth && diffStats && (
            <>
              {diffStats.added > 0 && (
                <button className="btn outlined" style={{ fontSize: 11, color: 'var(--green)' }}>
                  +{diffStats.added}
                </button>
              )}
              {diffStats.removed > 0 && (
                <button className="btn outlined" style={{ fontSize: 11, color: 'var(--red)' }}>
                  −{diffStats.removed}
                </button>
              )}
              {diffStats.changed > 0 && (
                <button className="btn outlined" style={{ fontSize: 11, color: 'var(--amber)' }}>
                  ≠{diffStats.changed}
                </button>
              )}
              <button
                className={`btn outlined ${showOnly === 'changes' ? 'active' : ''}`}
                onClick={() => setShowOnly((v) => v === 'changes' ? 'all' : 'changes')}
              >
                {showOnly === 'changes' ? 'Show all' : 'Changes only'}
              </button>
              <button className="btn outlined" onClick={exportReport}>Export</button>
            </>
          )}
          {hasBoth && (
            <>
              <div className="divider" aria-hidden="true" />
              <button className="btn outlined" onClick={() => { setExpandKey((k) => k + 1); setExpandOverride(true) }}>
                Expand all
              </button>
              <button className="btn outlined" onClick={() => { setExpandKey((k) => k + 1); setExpandOverride(false) }}>
                Collapse all
              </button>
              <div className="divider" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search keys/values…"
                style={{
                  height: 26, padding: '0 8px', fontFamily: 'var(--font-mono)', fontSize: 11.5,
                  color: 'var(--text)', background: 'var(--surface-raised)',
                  border: '1px solid var(--border)', borderRadius: 6, outline: 'none', width: 160,
                }}
              />
            </>
          )}
          <div className="divider" aria-hidden="true" />
          <button
            className="btn outlined"
            disabled={!leftText.trim() && !rightText.trim()}
            onClick={share}
            title="Copy shareable link"
          >
            {shareCopied ? 'Copied!' : 'Share'}
          </button>
          <button onClick={toggleTheme} className="btn icon">
            {themeMode === 'system' ? <MonitorIcon /> : themeMode === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </nav>

      <ModeTabs />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Input row */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {(['left', 'right'] as const).map((side) => {
            const err = side === 'left' ? leftError : rightError
            return (
              <div
                key={side}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: side === 'left' ? '1px solid var(--border)' : 'none', height: 160, position: 'relative' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) f.text().then((t) => side === 'left' ? setLeftText(t) : setRightText(t)) }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface)', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.06em', color: err ? 'var(--red)' : 'var(--text-dim)' }}>
                    {side === 'left' ? 'Original' : 'Modified'}{err ? ' — parse error' : ''}
                  </span>
                  <label className="btn outlined" style={{ fontSize: 11.5, cursor: 'pointer' }}>
                    Open file
                    <input type="file" accept=".yaml,.yml" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) f.text().then((t) => side === 'left' ? setLeftText(t) : setRightText(t)) }} />
                  </label>
                </div>
                <textarea
                  value={side === 'left' ? leftText : rightText}
                  onChange={(e) => side === 'left' ? setLeftText(e.target.value) : setRightText(e.target.value)}
                  placeholder="Paste YAML here or drop a .yaml/.yml file…"
                  spellCheck={false}
                  style={{
                    flex: 1, resize: 'none', border: 'none', outline: 'none', padding: '8px 12px',
                    fontFamily: 'var(--font-mono)', fontSize: 12,
                    background: err ? 'var(--red-bg)' : 'var(--bg)', color: 'var(--text)',
                  }}
                />
              </div>
            )
          })}
        </div>

        {/* Diff tree */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {!diffRoot && !leftError && !rightError ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, flex: 1, padding: 40 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}>Paste YAML in both panels to compare</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Supports all YAML 1.1/1.2 — Kubernetes manifests, GitHub Actions, config files…</div>
            </div>
          ) : (leftError || rightError) ? (
            <div style={{ padding: 20, color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              {leftError ? `Original YAML error: ${leftError}` : `Modified YAML error: ${rightError}`}
            </div>
          ) : diffRoot ? (
            <div key={expandKey}>
              {/* Column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                borderBottom: '2px solid var(--border)',
                background: 'var(--surface)',
                position: 'sticky', top: 0, zIndex: 1,
              }}>
                <div style={{ padding: '6px 8px', paddingLeft: 38, fontSize: 10.5, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', borderRight: '1px solid var(--border)' }}>Original</div>
                <div style={{ padding: '6px 8px', paddingLeft: 8, fontSize: 10.5, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)' }}>Modified</div>
              </div>
              <YamlDiffRow node={diffRoot} depth={0} showOnly={showOnly} searchQuery={searchQuery} expandOverride={expandOverride} path="root" />
            </div>
          ) : null}
        </div>
      </div>

      {/* Status bar */}
      <div className="status-bar">
        <div style={{ display: 'flex', gap: 16 }}>
          {diffStats && diffStats.added > 0 && <span className="stat-green">+{diffStats.added} added</span>}
          {diffStats && diffStats.removed > 0 && <span className="stat-red">−{diffStats.removed} removed</span>}
          {diffStats && diffStats.changed > 0 && <span style={{ color: 'var(--amber)' }}>{diffStats.changed} changed</span>}
          {diffRoot && !diffStats?.added && !diffStats?.removed && !diffStats?.changed && <span style={{ color: 'var(--text-dim)' }}>No differences</span>}
          {!diffRoot && !leftError && !rightError && <span>No data</span>}
          {(leftError || rightError) && <span style={{ color: 'var(--red)' }}>Parse error</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>YAML structured diff</div>
      </div>
    </div>
  )
}
