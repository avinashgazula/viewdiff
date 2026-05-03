import { useCallback, useMemo, useRef, useState } from 'react'
import { ModeTabs } from '../../components/mode-tabs'
import { useTheme } from '../../hooks/use-theme'
import { MoonIcon, MonitorIcon, SunIcon } from '../../components/icons'
import { downloadText } from '../../export'

// --- JSON diff types ---

type DiffType = 'same' | 'added' | 'removed' | 'changed' | 'modified'

interface DiffNode {
  type: DiffType
  key: string | number
  leftVal: unknown
  rightVal: unknown
  children: DiffNode[]
  isArray: boolean
}

function jsonDiff(left: unknown, right: unknown, key: string | number = ''): DiffNode {
  if (left === undefined && right !== undefined) {
    return { type: 'added', key, leftVal: undefined, rightVal: right, children: [], isArray: false }
  }
  if (left !== undefined && right === undefined) {
    return { type: 'removed', key, leftVal: left, rightVal: undefined, children: [], isArray: false }
  }
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') {
    const t = JSON.stringify(left) === JSON.stringify(right) ? 'same' : 'changed'
    return { type: t, key, leftVal: left, rightVal: right, children: [], isArray: false }
  }

  const lIsArr = Array.isArray(left)
  const rIsArr = Array.isArray(right)

  if (lIsArr !== rIsArr) {
    return { type: 'changed', key, leftVal: left, rightVal: right, children: [], isArray: false }
  }

  const children: DiffNode[] = []
  let hasChange = false

  if (lIsArr && rIsArr) {
    const maxLen = Math.max((left as unknown[]).length, (right as unknown[]).length)
    for (let i = 0; i < maxLen; i++) {
      const child = jsonDiff((left as unknown[])[i], (right as unknown[])[i], i)
      children.push(child)
      if (child.type !== 'same' && child.type !== 'modified') hasChange = true
      else if (child.type === 'modified') hasChange = true
    }
    return { type: hasChange ? 'modified' : 'same', key, leftVal: left, rightVal: right, children, isArray: true }
  }

  const lo = left as Record<string, unknown>
  const ro = right as Record<string, unknown>
  const allKeys = Array.from(new Set([...Object.keys(lo), ...Object.keys(ro)]))

  for (const k of allKeys) {
    const child = jsonDiff(lo[k], ro[k], k)
    children.push(child)
    if (child.type !== 'same' && child.type !== 'modified') hasChange = true
    else if (child.type === 'modified') hasChange = true
  }

  return { type: hasChange ? 'modified' : 'same', key, leftVal: left, rightVal: right, children, isArray: false }
}

// --- Rendering ---

function valColor(type: DiffType): string {
  if (type === 'added') return 'var(--green)'
  if (type === 'removed') return 'var(--red)'
  if (type === 'changed') return 'var(--amber)'
  return 'inherit'
}

function valBg(type: DiffType): string {
  if (type === 'added') return 'var(--green-bg)'
  if (type === 'removed') return 'var(--red-bg)'
  if (type === 'changed') return 'oklch(93% 0.04 80 / 0.5)'
  return 'transparent'
}

function JsonValue({ val, type }: { val: unknown; type: DiffType }) {
  if (val === undefined) return <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>—</span>
  if (val === null) return <span style={{ color: 'var(--text-dim)' }}>null</span>
  const t = typeof val
  if (t === 'boolean') return <span style={{ color: 'oklch(60% 0.18 240)', fontWeight: 600 }}>{String(val)}</span>
  if (t === 'number') return <span style={{ color: 'oklch(55% 0.15 200)' }}>{String(val)}</span>
  if (t === 'string') return <span style={{ color: type !== 'same' ? valColor(type) : 'var(--green)' }}>"{String(val)}"</span>
  if (Array.isArray(val)) return <span style={{ color: 'var(--text-dim)' }}>[…{(val as unknown[]).length}]</span>
  return <span style={{ color: 'var(--text-dim)' }}>{"{"}{Object.keys(val as object).length} keys{"}"}</span>
}

function DiffNodeRow({ node, depth, showOnly, filterType }: {
  node: DiffNode
  depth: number
  showOnly: 'all' | 'changes'
  filterType: DiffType | null
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = node.children.length > 0
  const isLeaf = !hasChildren
  const indent = depth * 18

  const effectiveType = node.type
  const skipSame = showOnly === 'changes' && effectiveType === 'same'
  const skipFilter = filterType !== null && effectiveType !== filterType && effectiveType !== 'modified' && effectiveType !== 'same'
  if (skipSame) return null
  if (skipFilter && !hasChildren) return null

  const hasDiffChildren = hasChildren && node.children.some((c) => c.type !== 'same')

  if (isLeaf || !hasChildren) {
    const rowBg = valBg(effectiveType)
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        background: rowBg,
        borderBottom: '1px solid var(--border-subtle)',
        minHeight: 28,
        alignItems: 'stretch',
      }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', paddingLeft: indent + 8, borderRight: '1px solid var(--border-subtle)', gap: 6 }}>
          <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 11, minWidth: 20 }}>{node.key}</span>
          <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>
            {effectiveType !== 'added' ? <JsonValue val={node.leftVal} type={effectiveType} /> : <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>—</span>}
          </span>
        </div>
        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', paddingLeft: 8, gap: 6 }}>
          {effectiveType === 'added' && <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700, background: 'var(--green-bg)', borderRadius: 3, padding: '1px 4px' }}>+</span>}
          {effectiveType === 'removed' && <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, background: 'var(--red-bg)', borderRadius: 3, padding: '1px 4px' }}>−</span>}
          {effectiveType === 'changed' && <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 700, borderRadius: 3, padding: '1px 4px' }}>≠</span>}
          <span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)' }}>
            {effectiveType !== 'removed' ? <JsonValue val={node.rightVal} type={effectiveType} /> : <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>—</span>}
          </span>
        </div>
      </div>
    )
  }

  // Container node
  const prefix = node.isArray ? '[' : '{'
  const suffix = node.isArray ? ']' : '}'
  const indicator = effectiveType === 'modified' ? '·' : effectiveType === 'same' ? '=' : ''
  const indicatorColor = effectiveType === 'modified' ? 'var(--amber)' : 'var(--text-dim)'

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded((v) => !v) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 8px', paddingLeft: indent + 8,
          background: hasDiffChildren ? 'transparent' : 'transparent',
          borderBottom: '1px solid var(--border-subtle)',
          cursor: 'pointer',
          userSelect: 'none',
          minHeight: 28,
        }}
      >
        <span style={{ color: 'var(--text-dim)', fontSize: 10, width: 12, textAlign: 'center', flexShrink: 0 }}>{expanded ? '▼' : '▶'}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', minWidth: 20 }}>{node.key}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-secondary)' }}>
          {prefix}
          <span style={{ color: 'var(--text-dim)', fontSize: 10.5 }}> {node.children.length} </span>
          {suffix}
        </span>
        {indicator && <span style={{ fontSize: 10, color: indicatorColor, fontWeight: 700 }}>{indicator}</span>}
        {hasDiffChildren && (
          <span style={{ fontSize: 10, color: 'var(--amber)', marginLeft: 2 }}>
            {node.children.filter((c) => c.type !== 'same').length} change{node.children.filter((c) => c.type !== 'same').length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {expanded && node.children.map((child, i) => (
        <DiffNodeRow key={i} node={child} depth={depth + 1} showOnly={showOnly} filterType={filterType} />
      ))}
    </>
  )
}

// --- Stats computation ---

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

// --- Mode component ---

export function JsonMode() {
  const { mode: themeMode, toggle: toggleTheme } = useTheme()
  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [showOnly, setShowOnly] = useState<'all' | 'changes'>('all')
  const [filterType, setFilterType] = useState<DiffType | null>(null)
  const [leftError, setLeftError] = useState<string | null>(null)
  const [rightError, setRightError] = useState<string | null>(null)

  const leftJson = useMemo(() => {
    if (!leftText.trim()) { setLeftError(null); return null }
    try { const v = JSON.parse(leftText); setLeftError(null); return v }
    catch (e) { setLeftError(String(e)); return null }
  }, [leftText])

  const rightJson = useMemo(() => {
    if (!rightText.trim()) { setRightError(null); return null }
    try { const v = JSON.parse(rightText); setRightError(null); return v }
    catch (e) { setRightError(String(e)); return null }
  }, [rightText])

  const diffRoot = useMemo(() => {
    if (leftJson === null && rightJson === null) return null
    return jsonDiff(leftJson ?? undefined, rightJson ?? undefined, 'root')
  }, [leftJson, rightJson])

  const diffStats = useMemo(() => diffRoot ? countDiffs(diffRoot) : null, [diffRoot])

  const hasBoth = leftText.trim() && rightText.trim() && !leftError && !rightError && diffRoot

  const formatJson = useCallback((side: 'left' | 'right') => {
    const text = side === 'left' ? leftText : rightText
    try {
      const formatted = JSON.stringify(JSON.parse(text), null, 2)
      if (side === 'left') setLeftText(formatted)
      else setRightText(formatted)
    } catch { /* invalid JSON */ }
  }, [leftText, rightText])

  function loadFile(side: 'left' | 'right', file: File) {
    file.text().then((t) => {
      if (side === 'left') setLeftText(t)
      else setRightText(t)
    })
  }

  const exportReport = useCallback(() => {
    if (!diffRoot) return
    const lines: string[] = ['JSON Diff Report', '================', '']
    function walk(n: DiffNode, prefix: string) {
      const icon = n.type === 'added' ? '+ ' : n.type === 'removed' ? '- ' : n.type === 'changed' ? '≠ ' : '  '
      if (n.children.length === 0) {
        if (n.type !== 'same') {
          lines.push(`${icon}${prefix}${n.key}:`)
          if (n.type !== 'added') lines.push(`    left:  ${JSON.stringify(n.leftVal)}`)
          if (n.type !== 'removed') lines.push(`    right: ${JSON.stringify(n.rightVal)}`)
        }
      } else {
        n.children.forEach((c) => walk(c, prefix + (n.key === 'root' ? '' : String(n.key) + '.')))
      }
    }
    walk(diffRoot, '')
    downloadText(lines.join('\n'), 'json-diff-report.txt')
  }, [diffRoot])

  const inputStyle: React.CSSProperties = {
    flex: 1, height: '100%', resize: 'none', border: 'none', outline: 'none',
    padding: '12px', fontFamily: 'var(--font-mono)', fontSize: 12.5,
    background: 'var(--bg)', color: 'var(--text)', display: 'block',
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
                <button
                  className={`btn outlined ${filterType === 'added' ? 'active' : ''}`}
                  style={{ fontSize: 11, color: 'var(--green)' }}
                  onClick={() => setFilterType(filterType === 'added' ? null : 'added')}
                >+{diffStats.added} added</button>
              )}
              {diffStats.removed > 0 && (
                <button
                  className={`btn outlined ${filterType === 'removed' ? 'active' : ''}`}
                  style={{ fontSize: 11, color: 'var(--red)' }}
                  onClick={() => setFilterType(filterType === 'removed' ? null : 'removed')}
                >−{diffStats.removed} removed</button>
              )}
              {diffStats.changed > 0 && (
                <button
                  className={`btn outlined ${filterType === 'changed' ? 'active' : ''}`}
                  style={{ fontSize: 11, color: 'var(--amber)' }}
                  onClick={() => setFilterType(filterType === 'changed' ? null : 'changed')}
                >≠{diffStats.changed} changed</button>
              )}
              <div className="divider" aria-hidden="true" />
              <button
                className={`btn outlined ${showOnly === 'changes' ? 'active' : ''}`}
                onClick={() => setShowOnly(showOnly === 'all' ? 'changes' : 'all')}
              >
                {showOnly === 'changes' ? 'Show all' : 'Changes only'}
              </button>
              <button className="btn outlined" onClick={exportReport}>Export</button>
            </>
          )}
          <div className="divider" aria-hidden="true" />
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
            const text = side === 'left' ? leftText : rightText
            const setText = side === 'left' ? setLeftText : setRightText
            const error = side === 'left' ? leftError : rightError
            const parsed = side === 'left' ? leftJson : rightJson
            return (
              <div key={side} style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                borderRight: side === 'left' ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '4px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', gap: 6, flexShrink: 0 }}>
                  <span style={{ flex: 1, fontSize: 11, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)' }}>
                    {side === 'left' ? 'Original' : 'Modified'}
                  </span>
                  {text && (
                    <button
                      className="btn outlined"
                      style={{ fontSize: 10.5, height: 20, padding: '0 6px' }}
                      title={`Format ${side} JSON`}
                      onClick={() => formatJson(side)}
                    >Format</button>
                  )}
                  {text && (
                    <button
                      className="btn icon"
                      style={{ width: 18, height: 18, fontSize: 12, opacity: 0.5 }}
                      title="Clear"
                      onClick={() => setText('')}
                    >×</button>
                  )}
                  <label
                    className="btn icon"
                    style={{ width: 18, height: 18, fontSize: 10, opacity: 0.55, cursor: 'pointer' }}
                    title="Load JSON file"
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L14 7H10V13H6V7H2L8 1Z" /></svg>
                    <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) loadFile(side, f)
                      e.target.value = ''
                    }} />
                  </label>
                </div>
                <div style={{ position: 'relative', height: hasBoth ? 180 : 260, flexShrink: 0 }}>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={`Paste ${side === 'left' ? 'original' : 'modified'} JSON here…`}
                    style={{ ...inputStyle, height: '100%' }}
                    spellCheck={false}
                  />
                  {error && (
                    <div style={{ position: 'absolute', bottom: 6, left: 12, right: 12, fontSize: 11, color: 'var(--red)', background: 'var(--surface)', borderRadius: 4, padding: '3px 6px', border: '1px solid var(--red)' }}>
                      {error}
                    </div>
                  )}
                  {parsed !== null && !error && (
                    <div style={{ position: 'absolute', bottom: 6, right: 12, fontSize: 10.5, color: 'var(--green)', background: 'var(--surface)', borderRadius: 4, padding: '2px 6px', border: '1px solid var(--green)' }}>
                      ✓ valid JSON
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Diff tree */}
        {hasBoth ? (
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            {/* Header row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              background: 'var(--surface)', borderBottom: '1px solid var(--border)',
              position: 'sticky', top: 0, zIndex: 10,
            }}>
              <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', borderRight: '1px solid var(--border)' }}>
                Original
              </div>
              <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)' }}>
                Modified
              </div>
            </div>
            <DiffNodeRow node={diffRoot} depth={0} showOnly={showOnly} filterType={filterType} />
          </div>
        ) : (
          !leftError && !rightError && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Paste JSON in both panels to compare</div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Structural diff — objects, arrays, and scalar values</div>
            </div>
          )
        )}
      </div>

      <div className="status-bar">
        <div style={{ display: 'flex', gap: 16 }}>
          {diffStats && hasBoth ? (
            <>
              {diffStats.added + diffStats.removed + diffStats.changed > 0 ? (
                <>
                  {diffStats.added > 0 && <span className="stat-green">+{diffStats.added} added</span>}
                  {diffStats.removed > 0 && <span className="stat-red">−{diffStats.removed} removed</span>}
                  {diffStats.changed > 0 && <span style={{ color: 'var(--amber)' }}>{diffStats.changed} changed</span>}
                  {diffStats.same > 0 && <span>{diffStats.same} same</span>}
                </>
              ) : (
                <span className="stat-green">Identical JSON structures</span>
              )}
            </>
          ) : (
            <span>Paste JSON in both panels to compare</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {leftJson !== null && rightJson !== null ? 'JSON' : ''}
        </div>
      </div>
    </div>
  )
}
