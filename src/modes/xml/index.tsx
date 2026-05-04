import { useCallback, useEffect, useMemo, useState } from 'react'
import { ModeTabs } from '../../components/mode-tabs'
import { useTheme } from '../../hooks/use-theme'
import { MoonIcon, MonitorIcon, SunIcon } from '../../components/icons'
import { downloadText } from '../../export'

type DiffType = 'same' | 'changed' | 'added' | 'removed'

interface AttrDiff {
  name: string
  leftVal: string | null
  rightVal: string | null
  type: DiffType
}

interface XmlDiffNode {
  type: DiffType
  nodeType: 'element' | 'text' | 'comment' | 'cdata'
  tagName?: string
  leftContent?: string
  rightContent?: string
  attrs?: AttrDiff[]
  children?: XmlDiffNode[]
  path: string
}

function parseXml(text: string): { doc: Document | null; error: string | null } {
  if (!text.trim()) return { doc: null, error: null }
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  const err = doc.querySelector('parsererror')
  if (err) return { doc: null, error: err.textContent?.slice(0, 200) ?? 'XML parse error' }
  return { doc, error: null }
}

function getRelevantChildren(el: Element): ChildNode[] {
  return Array.from(el.childNodes).filter((n) => {
    if (n.nodeType === Node.TEXT_NODE) return (n.textContent?.trim() ?? '') !== ''
    return (
      n.nodeType === Node.ELEMENT_NODE ||
      n.nodeType === Node.COMMENT_NODE ||
      n.nodeType === Node.CDATA_SECTION_NODE
    )
  })
}

function nodeToXmlDiff(node: Node, side: 'added' | 'removed', path: string): XmlDiffNode | null {
  const type = side
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element
    const attrType = side as DiffType
    return {
      type,
      nodeType: 'element',
      tagName: el.tagName,
      attrs: Array.from(el.attributes).map((a) => ({
        name: a.name,
        leftVal: side === 'removed' ? a.value : null,
        rightVal: side === 'added' ? a.value : null,
        type: attrType,
      })),
      children: getRelevantChildren(el)
        .map((c, i) => nodeToXmlDiff(c, side, `${path}/${i}`))
        .filter(Boolean) as XmlDiffNode[],
      path,
    }
  }
  if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
    const t = node.textContent?.trim() ?? ''
    if (!t) return null
    return {
      type,
      nodeType: node.nodeType === Node.CDATA_SECTION_NODE ? 'cdata' : 'text',
      leftContent: side === 'removed' ? t : undefined,
      rightContent: side === 'added' ? t : undefined,
      path,
    }
  }
  if (node.nodeType === Node.COMMENT_NODE) {
    return {
      type,
      nodeType: 'comment',
      leftContent: side === 'removed' ? (node.textContent ?? '') : undefined,
      rightContent: side === 'added' ? (node.textContent ?? '') : undefined,
      path,
    }
  }
  return null
}

function diffAttrs(left: Element, right: Element): AttrDiff[] {
  const lMap = new Map<string, string>()
  const rMap = new Map<string, string>()
  for (const a of Array.from(left.attributes)) lMap.set(a.name, a.value)
  for (const a of Array.from(right.attributes)) rMap.set(a.name, a.value)
  const names = new Set([...lMap.keys(), ...rMap.keys()])
  return [...names].sort().map((name) => {
    const lv = lMap.get(name) ?? null
    const rv = rMap.get(name) ?? null
    return {
      name,
      leftVal: lv,
      rightVal: rv,
      type: lv === null ? 'added' : rv === null ? 'removed' : lv === rv ? 'same' : 'changed',
    }
  })
}

function diffXmlNodes(left: Node | null, right: Node | null, path: string): XmlDiffNode[] {
  if (!left && !right) return []
  if (!left) return right ? [nodeToXmlDiff(right, 'added', path)].filter(Boolean) as XmlDiffNode[] : []
  if (!right) return left ? [nodeToXmlDiff(left, 'removed', path)].filter(Boolean) as XmlDiffNode[] : []

  if (left.nodeType === Node.TEXT_NODE || left.nodeType === Node.CDATA_SECTION_NODE) {
    const lt = left.textContent?.trim() ?? ''
    const rt = right.textContent?.trim() ?? ''
    if (!lt && !rt) return []
    const nType = left.nodeType === Node.CDATA_SECTION_NODE ? 'cdata' : 'text'
    return [{ type: lt === rt ? 'same' : 'changed', nodeType: nType, leftContent: lt || undefined, rightContent: rt || undefined, path }]
  }

  if (left.nodeType === Node.COMMENT_NODE) {
    const lt = left.textContent ?? ''
    const rt = right.textContent ?? ''
    return [{ type: lt === rt ? 'same' : 'changed', nodeType: 'comment', leftContent: lt, rightContent: rt, path }]
  }

  if (left.nodeType === Node.ELEMENT_NODE && right.nodeType === Node.ELEMENT_NODE) {
    const lEl = left as Element
    const rEl = right as Element

    if (lEl.tagName !== rEl.tagName) {
      const removed = nodeToXmlDiff(left, 'removed', path + '/L')
      const added = nodeToXmlDiff(right, 'added', path + '/R')
      return [removed, added].filter(Boolean) as XmlDiffNode[]
    }

    const attrs = diffAttrs(lEl, rEl)
    const lChildren = getRelevantChildren(lEl)
    const rChildren = getRelevantChildren(rEl)
    const children: XmlDiffNode[] = []
    const maxLen = Math.max(lChildren.length, rChildren.length)
    for (let i = 0; i < maxLen; i++) {
      const lc = lChildren[i] ?? null
      const rc = rChildren[i] ?? null
      children.push(...diffXmlNodes(lc, rc, `${path}/${lEl.tagName}[${i}]`))
    }

    const attrDiff = attrs.some((a) => a.type !== 'same')
    const childDiff = children.some((c) => c.type !== 'same')
    return [{
      type: attrDiff || childDiff ? 'changed' : 'same',
      nodeType: 'element',
      tagName: lEl.tagName,
      attrs,
      children,
      path,
    }]
  }

  // Mismatched node types: show both
  const removed = nodeToXmlDiff(left, 'removed', path + '/L')
  const added = nodeToXmlDiff(right, 'added', path + '/R')
  return [removed, added].filter(Boolean) as XmlDiffNode[]
}

function hasAnyDiff(node: XmlDiffNode): boolean {
  if (node.type !== 'same') return true
  if (node.attrs?.some((a) => a.type !== 'same')) return true
  return node.children?.some(hasAnyDiff) ?? false
}

function countDiffs(nodes: XmlDiffNode[]): { added: number; removed: number; changed: number } {
  let added = 0, removed = 0, changed = 0
  function walk(n: XmlDiffNode) {
    if (n.type === 'added') added++
    else if (n.type === 'removed') removed++
    else if (n.type === 'changed') changed++
    n.attrs?.forEach((a) => {
      if (a.type === 'added') added++
      else if (a.type === 'removed') removed++
      else if (a.type === 'changed') changed++
    })
    n.children?.forEach(walk)
  }
  nodes.forEach(walk)
  return { added, removed, changed }
}

const DIFF_BG: Record<DiffType, string> = {
  same: 'transparent',
  changed: 'var(--amber-bg)',
  added: 'var(--green-bg)',
  removed: 'var(--red-bg)',
}

const DIFF_FG: Record<DiffType, string> = {
  same: 'var(--text)',
  changed: 'var(--amber)',
  added: 'var(--green)',
  removed: 'var(--red)',
}

function XmlNodeRow({
  node,
  depth,
  showOnlyDiff,
  expandOverride,
}: {
  node: XmlDiffNode
  depth: number
  showOnlyDiff: boolean
  expandOverride?: boolean
}) {
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    if (expandOverride !== undefined) setExpanded(expandOverride)
  }, [expandOverride])

  if (showOnlyDiff && node.type === 'same' && !(node.attrs?.some((a) => a.type !== 'same')) && !node.children?.some(hasAnyDiff)) {
    return null
  }

  const indentPx = depth * 18
  const hasChildren = (node.children?.length ?? 0) > 0
  const bg = node.type === 'same' ? 'transparent' : DIFF_BG[node.type]

  if (node.nodeType === 'text' || node.nodeType === 'cdata') {
    const color = node.type === 'same' ? 'var(--text-secondary)' : DIFF_FG[node.type]
    const cdataWrap = node.nodeType === 'cdata'
    return (
      <div style={{ paddingLeft: indentPx + 8, background: bg, fontFamily: 'var(--font-mono)', fontSize: 12, padding: `2px 8px 2px ${indentPx + 8}px`, color, lineHeight: 1.6 }}>
        {cdataWrap && <span style={{ color: 'var(--text-dim)' }}>{'<![CDATA['}</span>}
        {node.type === 'changed' ? (
          <>
            <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{node.leftContent}</span>
            <span style={{ margin: '0 6px', opacity: 0.4 }}>→</span>
            <span>{node.rightContent}</span>
          </>
        ) : (
          node.leftContent ?? node.rightContent
        )}
        {cdataWrap && <span style={{ color: 'var(--text-dim)' }}>{']]>'}</span>}
      </div>
    )
  }

  if (node.nodeType === 'comment') {
    const color = node.type === 'same' ? 'var(--text-dim)' : DIFF_FG[node.type]
    return (
      <div style={{ paddingLeft: indentPx + 8, background: bg, fontFamily: 'var(--font-mono)', fontSize: 12, padding: `2px 8px 2px ${indentPx + 8}px`, color: 'var(--text-dim)', lineHeight: 1.6, fontStyle: 'italic' }}>
        {'<!-- '}
        {node.type === 'changed' ? (
          <>
            <span style={{ textDecoration: 'line-through', opacity: 0.7, color }}>{node.leftContent}</span>
            <span style={{ margin: '0 6px', opacity: 0.4 }}>→</span>
            <span style={{ color }}>{node.rightContent}</span>
          </>
        ) : (
          <span style={{ color }}>{node.leftContent ?? node.rightContent}</span>
        )}
        {' -->'}
      </div>
    )
  }

  const tagColor = node.type === 'same' ? 'var(--accent)' : DIFF_FG[node.type]

  const changedAttrs = node.attrs?.filter((a) => a.type !== 'same') ?? []
  const allAttrsSame = changedAttrs.length === 0
  const elemBg = (node.type !== 'same' || !allAttrsSame) ? bg : 'transparent'

  return (
    <div>
      {/* Opening tag */}
      <div
        style={{
          background: elemBg,
          display: 'flex',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          padding: `2px 8px 2px ${indentPx + 8}px`,
          lineHeight: 1.6,
          cursor: hasChildren ? 'pointer' : 'default',
          userSelect: 'none',
        }}
        onClick={() => hasChildren && setExpanded((v) => !v)}
        role={hasChildren ? 'button' : undefined}
        aria-expanded={hasChildren ? expanded : undefined}
      >
        <span style={{ width: 12, flexShrink: 0, color: 'var(--text-dim)', fontSize: 10, marginTop: 2 }}>
          {hasChildren ? (expanded ? '▾' : '▸') : ''}
        </span>
        <span style={{ color: 'var(--text-dim)' }}>{'<'}</span>
        <span style={{ color: tagColor, fontWeight: 550 }}>{node.tagName}</span>

        {node.attrs && node.attrs.map((a) => {
          const ac = a.type === 'same' ? 'var(--text-dim)' : DIFF_FG[a.type]
          const bg2 = a.type === 'same' ? 'transparent' : DIFF_BG[a.type]
          return (
            <span key={a.name} style={{ marginLeft: 4, background: bg2, borderRadius: 2, padding: '0 2px' }}>
              <span style={{ color: ac }}>{a.name}</span>
              {a.type === 'changed' ? (
                <>
                  <span style={{ color: 'var(--text-dim)' }}>="</span>
                  <span style={{ textDecoration: 'line-through', opacity: 0.6, color: ac }}>{a.leftVal}</span>
                  <span style={{ margin: '0 4px', opacity: 0.4 }}>→</span>
                  <span style={{ color: ac }}>{a.rightVal}</span>
                  <span style={{ color: 'var(--text-dim)' }}>"</span>
                </>
              ) : (
                <>
                  <span style={{ color: 'var(--text-dim)' }}>="</span>
                  <span style={{ color: ac }}>{a.leftVal ?? a.rightVal}</span>
                  <span style={{ color: 'var(--text-dim)' }}>"</span>
                </>
              )}
            </span>
          )
        })}

        <span style={{ color: 'var(--text-dim)' }}>{hasChildren ? '>' : ' />'}</span>
        {hasChildren && !expanded && (
          <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>
            …<span style={{ opacity: 0.5 }}>{'</'}{node.tagName}{'>'}</span>
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <>
          {node.children!.map((child, i) => (
            <XmlNodeRow
              key={i}
              node={child}
              depth={depth + 1}
              showOnlyDiff={showOnlyDiff}
              expandOverride={expandOverride}
            />
          ))}
          {/* Closing tag */}
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 12,
            padding: `2px 8px 2px ${indentPx + 8}px`, lineHeight: 1.6,
            background: elemBg, color: 'var(--text-dim)',
          }}>
            <span style={{ display: 'inline-block', width: 12 }} />
            {'</'}
            <span style={{ color: tagColor, fontWeight: 550 }}>{node.tagName}</span>
            {'>'}
          </div>
        </>
      )}
    </div>
  )
}

function buildReport(nodes: XmlDiffNode[], indent = 0): string {
  const lines: string[] = []
  const pad = '  '.repeat(indent)
  for (const n of nodes) {
    if (n.nodeType === 'text' || n.nodeType === 'cdata') {
      const prefix = n.type === 'added' ? '+ ' : n.type === 'removed' ? '- ' : n.type === 'changed' ? '~ ' : '  '
      if (n.type === 'changed') lines.push(`${prefix}${pad}(text) "${n.leftContent}" → "${n.rightContent}"`)
      else lines.push(`${prefix}${pad}(text) "${n.leftContent ?? n.rightContent}"`)
    } else if (n.nodeType === 'comment') {
      const prefix = n.type === 'added' ? '+ ' : n.type === 'removed' ? '- ' : n.type === 'changed' ? '~ ' : '  '
      lines.push(`${prefix}${pad}<!--${n.leftContent ?? n.rightContent}-->`)
    } else {
      const prefix = n.type === 'added' ? '+ ' : n.type === 'removed' ? '- ' : n.type === 'changed' ? '~ ' : '  '
      const attrsStr = (n.attrs ?? []).map((a) => {
        if (a.type === 'same') return ` ${a.name}="${a.leftVal}"`
        if (a.type === 'added') return ` +${a.name}="${a.rightVal}"`
        if (a.type === 'removed') return ` -${a.name}="${a.leftVal}"`
        return ` ~${a.name}="${a.leftVal}"→"${a.rightVal}"`
      }).join('')
      lines.push(`${prefix}${pad}<${n.tagName}${attrsStr}>`)
      if (n.children?.length) lines.push(...buildReport(n.children, indent + 1))
    }
  }
  return lines.join('\n')
}

export function XmlMode() {
  const { mode: themeMode, toggle: toggleTheme } = useTheme()
  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [showOnlyDiff, setShowOnlyDiff] = useState(false)
  const [expandOverride, setExpandOverride] = useState<boolean | undefined>(undefined)
  const [expandKey, setExpandKey] = useState(0)

  function handleFile(side: 'left' | 'right', file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      if (side === 'left') setLeftText(text)
      else setRightText(text)
    }
    reader.readAsText(file)
  }

  function handleDrop(side: 'left' | 'right', e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(side, file)
  }

  const { diffNodes, leftError, rightError } = useMemo(() => {
    const lResult = parseXml(leftText)
    const rResult = parseXml(rightText)

    if (lResult.error) return { diffNodes: [], leftError: lResult.error, rightError: null }
    if (rResult.error) return { diffNodes: [], leftError: null, rightError: rResult.error }

    const leftRoot = lResult.doc?.documentElement ?? null
    const rightRoot = rResult.doc?.documentElement ?? null

    if (!leftRoot && !rightRoot) return { diffNodes: [], leftError: null, rightError: null }

    const nodes = diffXmlNodes(leftRoot, rightRoot, 'root')
    return { diffNodes: nodes, leftError: null, rightError: null }
  }, [leftText, rightText])

  const diffStats = useMemo(() => countDiffs(diffNodes), [diffNodes])

  const hasDiff = diffNodes.length > 0
  const hasChanges = diffStats.added > 0 || diffStats.removed > 0 || diffStats.changed > 0

  const handleExpandAll = useCallback(() => {
    setExpandOverride(true)
    setExpandKey((k) => k + 1)
  }, [])

  const handleCollapseAll = useCallback(() => {
    setExpandOverride(false)
    setExpandKey((k) => k + 1)
  }, [])

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
          {hasDiff && (
            <>
              <button
                className={`btn outlined ${showOnlyDiff ? 'active' : ''}`}
                onClick={() => setShowOnlyDiff((v) => !v)}
                title="Show only changed nodes"
              >
                Changes only
              </button>
              <button className="btn outlined" onClick={handleExpandAll} title="Expand all nodes">
                Expand all
              </button>
              <button className="btn outlined" onClick={handleCollapseAll} title="Collapse all nodes">
                Collapse all
              </button>
              <div className="divider" aria-hidden="true" />
              <button
                className="btn outlined"
                title="Export XML diff report as text"
                onClick={() => downloadText(buildReport(diffNodes), 'xml-diff.txt', 'text/plain')}
              >
                Export
              </button>
            </>
          )}
          <button onClick={toggleTheme} className="btn icon" aria-label="Toggle theme">
            {themeMode === 'system' ? <MonitorIcon /> : themeMode === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </nav>

      <ModeTabs />

      {/* Input panels */}
      <div style={{ display: 'flex', height: 160, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        {(['left', 'right'] as const).map((side) => {
          const err = side === 'left' ? leftError : rightError
          return (
            <div
              key={side}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: side === 'left' ? '1px solid var(--border)' : 'none', position: 'relative' }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(side, e)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface)', flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.06em', color: err ? 'var(--red)' : 'var(--text-dim)' }}>
                  {side === 'left' ? 'Original' : 'Modified'}{err ? ' — parse error' : ''}
                </span>
                <label className="btn outlined" style={{ fontSize: 11.5, cursor: 'pointer' }}>
                  Open file
                  <input type="file" accept=".xml,.xhtml,.svg,.xsd,.xsl,.rss,.atom" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(side, f) }} />
                </label>
              </div>
              <textarea
                value={side === 'left' ? leftText : rightText}
                onChange={(e) => side === 'left' ? setLeftText(e.target.value) : setRightText(e.target.value)}
                placeholder="Paste XML here or drop a file…"
                spellCheck={false}
                style={{
                  flex: 1, resize: 'none', border: 'none', outline: 'none', padding: '8px 12px',
                  fontFamily: 'var(--font-mono)', fontSize: 12, background: err ? 'var(--red-bg)' : 'var(--bg)', color: 'var(--text)',
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Diff tree */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {!hasDiff && !leftError && !rightError ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, padding: 40 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}>Paste XML in both panels to compare</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Supports XML, SVG, XHTML, XSD, RSS, and any well-formed XML</div>
          </div>
        ) : (leftError || rightError) ? (
          <div style={{ padding: 20, color: 'var(--red)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {leftError ? `Original XML error: ${leftError}` : `Modified XML error: ${rightError}`}
          </div>
        ) : (
          <div key={expandKey} style={{ paddingBottom: 40 }}>
            {diffNodes.map((node, i) => (
              <XmlNodeRow
                key={i}
                node={node}
                depth={0}
                showOnlyDiff={showOnlyDiff}
                expandOverride={expandOverride}
              />
            ))}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="status-bar">
        <div style={{ display: 'flex', gap: 16 }}>
          {diffStats.added > 0 && <span className="stat-green">+{diffStats.added} added</span>}
          {diffStats.removed > 0 && <span className="stat-red">−{diffStats.removed} removed</span>}
          {diffStats.changed > 0 && <span style={{ color: 'var(--amber)' }}>{diffStats.changed} changed</span>}
          {hasDiff && !hasChanges && <span style={{ color: 'var(--text-dim)' }}>No differences found</span>}
          {!hasDiff && !leftError && !rightError && <span>No data</span>}
          {(leftError || rightError) && <span style={{ color: 'var(--red)' }}>Parse error</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          XML structured diff
        </div>
      </div>
    </div>
  )
}
