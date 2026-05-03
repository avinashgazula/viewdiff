import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import { ModeTabs } from '../../components/mode-tabs'
import { useTheme } from '../../hooks/use-theme'
import { MoonIcon, MonitorIcon, SunIcon } from '../../components/icons'
import { downloadText } from '../../export'
import { encodeText, decodeText } from '../../share'

type Row = string[]
type ColMap = number[] // colMap[rightColIdx] = leftColIdx or -1

interface DiffRow {
  type: 'same' | 'added' | 'removed' | 'changed'
  left: Row | null
  right: Row | null
  changedCells: boolean[]
}

function lcsIndices(a: string[], b: string[]): [number, number][] {
  const n = a.length, m = b.length
  if (n === 0 || m === 0) return []

  // For large inputs cap to avoid O(n*m) blowing up
  if (n > 2000 || m > 2000) return []

  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1
      else dp[i][j] = dp[i - 1][j] > dp[i][j - 1] ? dp[i - 1][j] : dp[i][j - 1]
    }
  }

  const pairs: [number, number][] = []
  let i = n, j = m
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { pairs.unshift([i - 1, j - 1]); i--; j-- }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--
    else j--
  }
  return pairs
}

function computeTableDiff(
  leftRows: Row[],
  rightRows: Row[],
  headers: boolean,
  colMap: ColMap,
  numCols: number,
): DiffRow[] {
  const dataLeft = headers ? leftRows.slice(1) : leftRows
  const dataRight = headers ? rightRows.slice(1) : rightRows

  const keyLeft = dataLeft.map((r) => JSON.stringify(r))
  const keyRight = dataRight.map((r) => JSON.stringify(r))

  const commonPairs = lcsIndices(keyLeft, keyRight)
  const commonLeft = new Set(commonPairs.map(([l]) => l))
  const commonRight = new Set(commonPairs.map(([, r]) => r))

  const result: DiffRow[] = []

  // Header row
  if (headers && leftRows.length > 0) {
    result.push({ type: 'same', left: leftRows[0], right: leftRows[0], changedCells: [] })
  }

  let li = 0, ri = 0, pairIdx = 0

  while (li < dataLeft.length || ri < dataRight.length) {
    const nextPair = commonPairs[pairIdx]

    if (nextPair && li === nextPair[0] && ri === nextPair[1]) {
      result.push({ type: 'same', left: dataLeft[li], right: dataRight[ri], changedCells: [] })
      li++; ri++; pairIdx++
    } else {
      const leftDone = li >= dataLeft.length
      const rightDone = ri >= dataRight.length

      if (leftDone) {
        result.push({ type: 'added', left: null, right: dataRight[ri], changedCells: [] })
        ri++
      } else if (rightDone) {
        result.push({ type: 'removed', left: dataLeft[li], right: null, changedCells: [] })
        li++
      } else if (!commonLeft.has(li) && !commonRight.has(ri)) {
        // Pair as changed
        const leftRow = dataLeft[li]
        const rightRow = dataRight[ri]
        const changedCells = Array.from({ length: numCols }, (_, ci) => {
          const lVal = leftRow[ci] ?? ''
          const rVal = rightRow[colMap[ci] >= 0 ? colMap[ci] : ci] ?? ''
          return lVal !== rVal
        })
        result.push({ type: 'changed', left: leftRow, right: rightRow, changedCells })
        li++; ri++
      } else if (!commonLeft.has(li)) {
        result.push({ type: 'removed', left: dataLeft[li], right: null, changedCells: [] })
        li++
      } else {
        result.push({ type: 'added', left: null, right: dataRight[ri], changedCells: [] })
        ri++
      }
    }
  }

  return result
}

function parseCSV(text: string, delimiter: string): Row[] {
  if (!text.trim()) return []
  const result = Papa.parse<Row>(text, {
    delimiter: delimiter === 'auto' ? undefined : delimiter,
    skipEmptyLines: true,
  })
  return result.data as Row[]
}

function getColumns(leftRows: Row[], rightRows: Row[], hasHeader: boolean): { headers: string[]; colMap: ColMap; numCols: number } {
  const leftHeader = hasHeader && leftRows.length > 0 ? leftRows[0] : []
  const rightHeader = hasHeader && rightRows.length > 0 ? rightRows[0] : []

  const numCols = Math.max(
    leftRows.reduce((m, r) => Math.max(m, r.length), 0),
    rightRows.reduce((m, r) => Math.max(m, r.length), 0),
  )

  const headers: string[] = []
  const colMap: ColMap = []

  for (let i = 0; i < numCols; i++) {
    headers.push(leftHeader[i] ?? rightHeader[i] ?? `Col ${i + 1}`)
    if (hasHeader && rightHeader.length > 0) {
      const name = leftHeader[i]
      const idx = rightHeader.indexOf(name)
      colMap.push(idx >= 0 ? idx : i)
    } else {
      colMap.push(i)
    }
  }

  return { headers, colMap, numCols }
}

const ROW_HEIGHT = 34
const HEADER_HEIGHT = 38

function VirtualTableBody({ rows, numCols, colMap, showOnlyDiff, containerHeight }: {
  rows: DiffRow[]
  numCols: number
  colMap: ColMap
  showOnlyDiff: boolean
  containerHeight: number
}) {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const displayRows = showOnlyDiff ? rows.filter((r, i) => r.type !== 'same' || i === 0) : rows

  const buffer = 8
  const viewHeight = containerHeight - HEADER_HEIGHT
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - buffer)
  const endIdx = Math.min(displayRows.length, Math.ceil((scrollTop + viewHeight) / ROW_HEIGHT) + buffer)
  const visibleRows = displayRows.slice(startIdx, endIdx)
  const offsetY = startIdx * ROW_HEIGHT

  const colWidthPct = 100 / numCols

  return (
    <div
      ref={containerRef}
      style={{ height: viewHeight, overflowY: 'auto', overflowX: 'auto', position: 'relative' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: displayRows.length * ROW_HEIGHT, position: 'relative', minWidth: numCols * 120 }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleRows.map((row, idx) => {
            const absIdx = startIdx + idx
            const rowStyle: React.CSSProperties = {
              display: 'grid',
              gridTemplateColumns: `repeat(${numCols}, minmax(80px, 1fr)) repeat(${numCols}, minmax(80px, 1fr))`,
              height: ROW_HEIGHT,
              borderBottom: '1px solid var(--border-subtle)',
            }

            const bgColor = row.type === 'added' ? 'var(--green-bg)'
              : row.type === 'removed' ? 'var(--red-bg)'
              : row.type === 'changed' ? 'var(--amber-bg)'
              : 'transparent'

            return (
              <div key={absIdx} style={{ ...rowStyle, background: bgColor }}>
                {Array.from({ length: numCols }, (_, ci) => {
                  const val = row.left?.[ci] ?? ''
                  const cellBg = row.type === 'changed' && row.changedCells[ci]
                    ? 'oklch(88% 0.08 80 / 0.6)' : 'transparent'
                  return (
                    <div key={ci} className="table-diff-cell" style={{ background: cellBg }}>
                      {val}
                    </div>
                  )
                })}
                {Array.from({ length: numCols }, (_, ci) => {
                  const mappedIdx = colMap[ci] >= 0 ? colMap[ci] : ci
                  const val = row.right?.[mappedIdx] ?? ''
                  const cellBg = row.type === 'changed' && row.changedCells[ci]
                    ? 'oklch(88% 0.08 80 / 0.6)' : 'transparent'
                  return (
                    <div key={ci} className="table-diff-cell" style={{ background: cellBg }}>
                      {val}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function TableMode() {
  const { mode: themeMode, toggle: toggleTheme } = useTheme()

  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [delimiter, setDelimiter] = useState<string>('auto')
  const [hasHeader, setHasHeader] = useState(true)
  const [showOnlyDiff, setShowOnlyDiff] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [rowFilter, setRowFilter] = useState('')

  // Load from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const l = params.get('l'), r = params.get('r'), d = params.get('d'), h = params.get('h')
    ;(async () => {
      if (l) { const t = await decodeText(l); if (t) setLeftText(t) }
      if (r) { const t = await decodeText(r); if (t) setRightText(t) }
      if (d) setDelimiter(d)
      if (h !== null) setHasHeader(h === '1')
    })()
  }, [])
  const [diffRows, setDiffRows] = useState<DiffRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [numCols, setNumCols] = useState(0)
  const [colMap, setColMap] = useState<ColMap>([])
  const [stats, setStats] = useState({ added: 0, removed: 0, changed: 0, same: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(400)

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      setContainerHeight(entries[0].contentRect.height)
    })
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const leftRows = parseCSV(leftText, delimiter)
    const rightRows = parseCSV(rightText, delimiter)

    if (leftRows.length === 0 && rightRows.length === 0) {
      setDiffRows([]); setHeaders([]); setNumCols(0); setColMap([])
      setStats({ added: 0, removed: 0, changed: 0, same: 0 })
      return
    }

    const { headers: h, colMap: cm, numCols: nc } = getColumns(leftRows, rightRows, hasHeader)
    const rows = computeTableDiff(leftRows, rightRows, hasHeader, cm, nc)

    setHeaders(h)
    setColMap(cm)
    setNumCols(nc)
    setDiffRows(rows)
    setSortCol(null)

    const counts = rows.reduce((acc, r, i) => {
      if (hasHeader && i === 0) return acc
      acc[r.type] = (acc[r.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    setStats({ added: counts.added || 0, removed: counts.removed || 0, changed: counts.changed || 0, same: counts.same || 0 })
  }, [leftText, rightText, delimiter, hasHeader])

  const handleSortClick = useCallback((ci: number) => {
    setSortCol((prev) => {
      if (prev === ci) {
        setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
        return ci
      }
      setSortDir('asc')
      return ci
    })
  }, [])

  const sortedRows = useMemo(() => {
    if (sortCol === null || diffRows.length === 0) return diffRows
    const hasHeaderRow = hasHeader && diffRows[0]?.type === 'same' && diffRows[0]?.left !== null
    const headerRows = hasHeaderRow ? [diffRows[0]] : []
    const dataRows = hasHeaderRow ? diffRows.slice(1) : diffRows
    const sorted = [...dataRows].sort((a, b) => {
      const aVal = (a.left ?? a.right)?.[sortCol] ?? ''
      const bVal = (b.left ?? b.right)?.[sortCol] ?? ''
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
    return [...headerRows, ...sorted]
  }, [diffRows, sortCol, sortDir, hasHeader])

  const filteredRows = useMemo(() => {
    const q = rowFilter.trim().toLowerCase()
    if (!q || sortedRows.length === 0) return sortedRows
    const hasHeaderRow = hasHeader && sortedRows[0]?.type === 'same' && sortedRows[0]?.left !== null
    const header = hasHeaderRow ? [sortedRows[0]] : []
    const data = hasHeaderRow ? sortedRows.slice(1) : sortedRows
    const matched = data.filter((row) => {
      const cells = [...(row.left ?? []), ...(row.right ?? [])]
      return cells.some((c) => String(c ?? '').toLowerCase().includes(q))
    })
    return [...header, ...matched]
  }, [sortedRows, rowFilter, hasHeader])

  const shareTable = useCallback(async () => {
    if (!leftText.trim() && !rightText.trim()) return
    const [encL, encR] = await Promise.all([encodeText(leftText), encodeText(rightText)])
    const params = new URLSearchParams({ l: encL, r: encR, d: delimiter, h: hasHeader ? '1' : '0' })
    await navigator.clipboard.writeText(`${window.location.origin}/table?${params.toString()}`)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }, [leftText, rightText, delimiter, hasHeader])

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

  const hasDiff = numCols > 0

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
          <label className="settings-label" style={{ marginRight: 2 }}>Delimiter</label>
          <select className="lang-select" value={delimiter} onChange={(e) => setDelimiter(e.target.value)}>
            <option value="auto">Auto</option>
            <option value=",">Comma (,)</option>
            <option value="\t">Tab</option>
            <option value=";">Semicolon (;)</option>
            <option value="|">Pipe (|)</option>
          </select>

          <div className="divider" aria-hidden="true" />

          <button
            className={`btn outlined ${hasHeader ? 'active' : ''}`}
            onClick={() => setHasHeader((v) => !v)}
            title="Toggle header row"
          >
            Header row
          </button>

          <button
            className={`btn outlined ${showOnlyDiff ? 'active' : ''}`}
            onClick={() => setShowOnlyDiff((v) => !v)}
            title="Show only different rows"
          >
            Diff only
          </button>

          <input
            type="search"
            value={rowFilter}
            onChange={(e) => setRowFilter(e.target.value)}
            placeholder="Filter rows…"
            aria-label="Filter table rows"
            style={{
              height: 26, padding: '0 8px', fontFamily: 'var(--font-mono)', fontSize: 11.5,
              color: 'var(--text)', background: 'var(--surface-raised)',
              border: '1px solid var(--border)', borderRadius: 6, outline: 'none', width: 130,
            }}
          />

          <div className="divider" aria-hidden="true" />

          {diffRows.length > 0 && (
            <button
              className="btn outlined"
              title="Export diff as CSV"
              onClick={() => {
                const lines: string[] = []
                const quote = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`
                if (headers.length > 0) lines.push(['_diff_', ...headers].map(quote).join(','))
                for (const row of diffRows) {
                  if (row.type === 'same') continue
                  if (row.type === 'removed' || row.type === 'changed') {
                    lines.push(['-', ...(row.left ?? [])].map(quote).join(','))
                  }
                  if (row.type === 'added' || row.type === 'changed') {
                    lines.push(['+', ...(row.right ?? [])].map(quote).join(','))
                  }
                }
                downloadText(lines.join('\n'), 'table-diff.csv', 'text/csv')
              }}
            >
              Export CSV
            </button>
          )}

          <button
            className="btn outlined"
            title="Copy shareable link to clipboard"
            disabled={!leftText.trim() && !rightText.trim()}
            onClick={shareTable}
          >
            {shareCopied ? 'Copied!' : 'Share'}
          </button>

          <button onClick={toggleTheme} className="btn icon" aria-label="Toggle theme">
            {themeMode === 'system' ? <MonitorIcon /> : themeMode === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </nav>

      <ModeTabs />

      {/* Input panels */}
      <div style={{ display: 'flex', height: 180, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        {(['left', 'right'] as const).map((side) => (
          <div
            key={side}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: side === 'left' ? '1px solid var(--border)' : 'none', position: 'relative' }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(side, e)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface)', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)' }}>
                {side === 'left' ? 'Original' : 'Modified'}
              </span>
              <label className="btn outlined" style={{ fontSize: 11.5, cursor: 'pointer' }}>
                Open file
                <input type="file" accept=".csv,.tsv,.txt" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(side, f) }} />
              </label>
            </div>
            <textarea
              value={side === 'left' ? leftText : rightText}
              onChange={(e) => side === 'left' ? setLeftText(e.target.value) : setRightText(e.target.value)}
              placeholder="Paste CSV / TSV here or drop a file..."
              style={{
                flex: 1, resize: 'none', border: 'none', outline: 'none', padding: '8px 12px',
                fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg)', color: 'var(--text)',
              }}
            />
          </div>
        ))}
      </div>

      {/* Table diff */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {!hasDiff ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}>Paste CSV in both panels to compare</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Supports CSV, TSV, and delimited text</div>
          </div>
        ) : (
          <>
            {/* Sticky column headers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${numCols}, minmax(80px, 1fr)) repeat(${numCols}, minmax(80px, 1fr))`,
              height: HEADER_HEIGHT,
              flexShrink: 0,
              background: 'var(--surface)',
              borderBottom: '1px solid var(--border)',
              overflowX: 'auto',
            }}>
              {['Original', 'Modified'].map((_side, si) => (
                headers.map((h, ci) => {
                  const isSorted = sortCol === ci
                  const arrow = isSorted ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
                  return (
                    <div
                      key={`${si}-${ci}`}
                      className="table-diff-header"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSortClick(ci)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSortClick(ci) } }}
                      style={{ cursor: 'pointer', userSelect: 'none', color: isSorted ? 'var(--accent)' : undefined }}
                      title={`Sort by ${h}`}
                      aria-sort={isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    >
                      {si === 0 ? h : (colMap[ci] >= 0 ? headers[colMap[ci]] : h)}
                      {isSorted && <span aria-hidden="true">{arrow}</span>}
                    </div>
                  )
                })
              ))}
            </div>

            <VirtualTableBody
              rows={filteredRows}
              numCols={numCols}
              colMap={colMap}
              showOnlyDiff={showOnlyDiff}
              containerHeight={containerHeight}
            />
          </>
        )}
      </div>

      {/* Status bar */}
      <div className="status-bar">
        <div style={{ display: 'flex', gap: 16 }}>
          {stats.added > 0 && <span className="stat-green">+{stats.added} added</span>}
          {stats.removed > 0 && <span className="stat-red">-{stats.removed} removed</span>}
          {stats.changed > 0 && <span style={{ color: 'var(--amber)' }}>{stats.changed} changed</span>}
          {stats.same > 0 && <span>{stats.same} same</span>}
          {!hasDiff && <span>No data</span>}
        </div>
        <div style={{ fontSize: 11 }}>
          {hasDiff ? `${numCols} col${numCols !== 1 ? 's' : ''}` : ''}
          {rowFilter.trim() && hasDiff ? ` · ${Math.max(0, filteredRows.length - (hasHeader ? 1 : 0))} rows` : ''}
        </div>
      </div>
    </div>
  )
}
