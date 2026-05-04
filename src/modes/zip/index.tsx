import JSZip from 'jszip'
import { useCallback, useEffect, useState } from 'react'
import { ModeTabs } from '../../components/mode-tabs'
import { useTheme } from '../../hooks/use-theme'
import { MoonIcon, MonitorIcon, SunIcon } from '../../components/icons'
import { downloadText } from '../../export'
import { encodeDiff, encodeText } from '../../share'

type FileStatus = 'same' | 'different' | 'left-only' | 'right-only'

interface ZipEntry {
  path: string
  status: FileStatus
  leftSize: number | null
  rightSize: number | null
  leftData: Uint8Array | null
  rightData: Uint8Array | null
  isBinary: boolean
}

function StatusBadge({ status }: { status: FileStatus }) {
  const cfg: Record<FileStatus, { label: string; color: string }> = {
    same: { label: '=', color: 'var(--text-dim)' },
    different: { label: '≠', color: 'var(--amber)' },
    'left-only': { label: 'L', color: 'var(--red)' },
    'right-only': { label: 'R', color: 'var(--green)' },
  }
  const { label, color } = cfg[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 18, height: 18, borderRadius: 4, fontSize: 10, fontWeight: 700,
      color, border: `1px solid ${color}`, flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

type FilterStatus = 'all' | FileStatus

function looksLikeBinary(data: Uint8Array): boolean {
  const check = data.slice(0, 1024)
  for (let i = 0; i < check.length; i++) {
    const b = check[i]
    if (b === 0) return true
    if (b < 7 && b !== 9 && b !== 10 && b !== 13) return true
  }
  return false
}

function dataToText(data: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(data)
}

function getFileMode(path: string): 'json' | 'yaml' | 'xml' | 'env' | 'table' | 'text' {
  const filename = path.split('/').pop()?.toLowerCase() ?? ''
  const ext = filename.split('.').pop() ?? ''
  if (ext === 'json') return 'json'
  if (['yaml', 'yml'].includes(ext)) return 'yaml'
  if (['xml', 'xhtml', 'svg', 'xsd', 'xsl', 'rss', 'atom'].includes(ext)) return 'xml'
  if (['csv', 'tsv'].includes(ext)) return 'table'
  if (['env', 'ini', 'properties', 'cfg', 'conf'].includes(ext) || filename.startsWith('.env')) return 'env'
  return 'text'
}

async function readZip(file: File): Promise<Map<string, { data: Uint8Array; size: number }>> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const result = new Map<string, { data: Uint8Array; size: number }>()
  await Promise.all(
    Object.values(zip.files).map(async (entry) => {
      if (entry.dir) return
      const data = await entry.async('uint8array')
      result.set(entry.name, { data, size: data.length })
    })
  )
  return result
}

export function ZipMode() {
  const { mode: themeMode, toggle: toggleTheme } = useTheme()
  const [entries, setEntries] = useState<ZipEntry[]>([])
  const [leftName, setLeftName] = useState('')
  const [rightName, setRightName] = useState('')
  const [computing, setComputing] = useState(false)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [pathFilter, setPathFilter] = useState('')
  const [sortKey, setSortKey] = useState<'name' | 'status' | 'leftSize' | 'rightSize'>('status')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [error, setError] = useState('')

  const [leftZip, setLeftZip] = useState<Map<string, { data: Uint8Array; size: number }> | null>(null)
  const [rightZip, setRightZip] = useState<Map<string, { data: Uint8Array; size: number }> | null>(null)

  async function handleFile(side: 'left' | 'right', file: File) {
    setError('')
    setComputing(true)
    try {
      const map = await readZip(file)
      if (side === 'left') {
        setLeftZip(map)
        setLeftName(file.name)
      } else {
        setRightZip(map)
        setRightName(file.name)
      }
    } catch (e) {
      setError(`Failed to read ${file.name}: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setComputing(false)
    }
  }

  useEffect(() => {
    if (!leftZip && !rightZip) return

    const allPaths = new Set([
      ...(leftZip?.keys() ?? []),
      ...(rightZip?.keys() ?? []),
    ])

    const result: ZipEntry[] = []
    for (const path of allPaths) {
      const left = leftZip?.get(path) ?? null
      const right = rightZip?.get(path) ?? null

      let status: FileStatus
      if (!left) status = 'right-only'
      else if (!right) status = 'left-only'
      else if (left.size === right.size && arraysEqual(left.data, right.data)) status = 'same'
      else status = 'different'

      const isBin = (left && looksLikeBinary(left.data)) || (right && looksLikeBinary(right.data))

      result.push({
        path,
        status,
        leftSize: left?.size ?? null,
        rightSize: right?.size ?? null,
        leftData: left?.data ?? null,
        rightData: right?.data ?? null,
        isBinary: !!isBin,
      })
    }

    result.sort((a, b) => {
      const order: Record<FileStatus, number> = { different: 0, 'left-only': 1, 'right-only': 2, same: 3 }
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
      return a.path.localeCompare(b.path)
    })

    setEntries(result)
    setComputing(false)
  }, [leftZip, rightZip])

  function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }

  const openDiff = useCallback(async (entry: ZipEntry) => {
    if (!entry.leftData || !entry.rightData || entry.isBinary) return
    const l = dataToText(entry.leftData)
    const r = dataToText(entry.rightData)
    const mode = getFileMode(entry.path)
    if (mode === 'text') {
      const encoded = await encodeDiff(l, r)
      window.open(`${window.location.origin}/?d=${encodeURIComponent(encoded)}`, '_blank')
    } else {
      const [encL, encR] = await Promise.all([encodeText(l), encodeText(r)])
      window.open(`${window.location.origin}/${mode}?l=${encodeURIComponent(encL)}&r=${encodeURIComponent(encR)}`, '_blank')
    }
  }, [])

  const downloadEntry = useCallback((entry: ZipEntry, side: 'left' | 'right') => {
    const data = side === 'left' ? entry.leftData : entry.rightData
    if (!data) return
    const blob = new Blob([data])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = entry.path.split('/').pop() ?? entry.path
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const stats = {
    total: entries.length,
    different: entries.filter((e) => e.status === 'different').length,
    leftOnly: entries.filter((e) => e.status === 'left-only').length,
    rightOnly: entries.filter((e) => e.status === 'right-only').length,
    same: entries.filter((e) => e.status === 'same').length,
  }

  const statusOrder: Record<FileStatus, number> = { different: 0, 'left-only': 1, 'right-only': 2, same: 3 }

  const filtered = [...(filter === 'all' ? entries : entries.filter((e) => e.status === filter))]
    .filter((e) => !pathFilter.trim() || e.path.toLowerCase().includes(pathFilter.trim().toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.path.localeCompare(b.path)
      else if (sortKey === 'status') cmp = statusOrder[a.status] - statusOrder[b.status] || a.path.localeCompare(b.path)
      else if (sortKey === 'leftSize') cmp = (a.leftSize ?? -1) - (b.leftSize ?? -1)
      else if (sortKey === 'rightSize') cmp = (a.rightSize ?? -1) - (b.rightSize ?? -1)
      return sortDir === 'asc' ? cmp : -cmp
    })

  const hasData = !!(leftZip || rightZip)

  function handleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
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
          {hasData && (
            <>
              {(['all', 'different', 'left-only', 'right-only', 'same'] as const).map((f) => (
                <button
                  key={f}
                  className={`btn outlined ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? `All (${stats.total})`
                    : f === 'different' ? `Changed (${stats.different})`
                    : f === 'left-only' ? `Left only (${stats.leftOnly})`
                    : f === 'right-only' ? `Right only (${stats.rightOnly})`
                    : `Same (${stats.same})`}
                </button>
              ))}
              <input
                type="search"
                value={pathFilter}
                onChange={(e) => setPathFilter(e.target.value)}
                placeholder="Search paths…"
                aria-label="Search file paths"
                style={{
                  height: 26, padding: '0 8px', fontFamily: 'var(--font-mono)', fontSize: 11.5,
                  color: 'var(--text)', background: 'var(--surface-raised)',
                  border: '1px solid var(--border)', borderRadius: 6, outline: 'none', width: 150,
                }}
              />
              <button
                className="btn outlined"
                onClick={() => {
                  const rows = ['Status,Path,Left Size,Right Size']
                  for (const e of entries) {
                    rows.push(`${e.status},"${e.path.replace(/"/g, '""')}",${e.leftSize ?? ''},${e.rightSize ?? ''}`)
                  }
                  downloadText(rows.join('\n'), 'zip-diff.csv', 'text/csv')
                }}
              >
                Export CSV
              </button>
              <div className="divider" aria-hidden="true" />
            </>
          )}
          <button onClick={toggleTheme} className="btn icon">
            {themeMode === 'system' ? <MonitorIcon /> : themeMode === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </nav>

      <ModeTabs />

      {!hasData ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}>Compare two ZIP archives</div>
          <div style={{ display: 'flex', gap: 24 }}>
            {(['left', 'right'] as const).map((side) => (
              <label
                key={side}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  border: '2px dashed var(--border)', borderRadius: 12, padding: '32px 40px',
                  cursor: 'pointer', background: 'var(--surface)',
                }}
              >
                <div style={{ fontSize: 32 }}>🗜</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {side === 'left' ? 'Original' : 'Modified'} ZIP
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Drop or click to select</div>
                <input
                  type="file"
                  accept=".zip"
                  style={{ display: 'none' }}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(side, f) }}
                />
              </label>
            ))}
          </div>
          {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Side labels + replace buttons */}
          <div style={{ display: 'flex', gap: 8, padding: '6px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0, alignItems: 'center' }}>
            {(['left', 'right'] as const).map((side) => {
              const name = side === 'left' ? leftName : rightName
              const zip = side === 'left' ? leftZip : rightZip
              return (
                <label key={side} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{side === 'left' ? 'Original:' : 'Modified:'}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {name || '—'} {zip ? `(${zip.size} files)` : ''}
                  </span>
                  <span className="btn outlined" style={{ fontSize: 10.5, height: 20, padding: '0 6px', cursor: 'pointer' }}>Replace</span>
                  <input type="file" accept=".zip" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(side, f) }} />
                </label>
              )
            })}
            {computing && <span style={{ fontSize: 12, color: 'var(--accent)', marginLeft: 8 }}>Reading…</span>}
            {error && <span style={{ fontSize: 12, color: 'var(--red)', marginLeft: 8 }}>{error}</span>}
          </div>

          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '24px 1fr 80px 80px 80px 80px',
            padding: '6px 16px',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            fontSize: 10.5, fontWeight: 650,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'var(--text-dim)', flexShrink: 0,
          }}>
            <div />
            {([
              { key: 'name' as const, label: 'File', align: 'left' },
              { key: 'leftSize' as const, label: 'Left size', align: 'right' },
              { key: 'rightSize' as const, label: 'Right size', align: 'right' },
              { key: 'status' as const, label: 'Status', align: 'center' },
            ] as const).map(({ key, label, align }) => (
              <div
                key={key}
                role="button"
                tabIndex={0}
                style={{ textAlign: align as any, cursor: 'pointer', userSelect: 'none', color: sortKey === key ? 'var(--accent)' : undefined }}
                onClick={() => handleSort(key)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSort(key) }}
                aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                {label}{sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </div>
            ))}
            <div />
          </div>

          {/* File list */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {filtered.length === 0 && !computing && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No files match this filter
              </div>
            )}
            {filtered.map((entry) => {
              const parts = entry.path.split('/')
              const filename = parts.pop() ?? entry.path
              const dir = parts.join('/')
              return (
                <div
                  key={entry.path}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '24px 1fr 80px 80px 80px 80px',
                    padding: '6px 16px',
                    borderBottom: '1px solid var(--border-subtle)',
                    alignItems: 'center',
                    fontSize: 13,
                    background: entry.status === 'different' ? 'oklch(95% 0.02 80 / 0.4)'
                      : entry.status === 'left-only' ? 'var(--red-bg)'
                      : entry.status === 'right-only' ? 'var(--green-bg)'
                      : 'transparent',
                  }}
                >
                  <StatusBadge status={entry.status} />
                  <div style={{ overflow: 'hidden', fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 0 }}>
                    {dir && <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>{dir}/</span>}
                    <span style={{ color: 'var(--text-secondary)' }}>{filename}</span>
                    {entry.isBinary && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-dim)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 4px' }}>binary</span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {entry.leftSize !== null ? formatSize(entry.leftSize) : '—'}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11.5, color: 'var(--text-muted)' }}>
                    {entry.rightSize !== null ? formatSize(entry.rightSize) : '—'}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {entry.status === 'same' ? 'Identical'
                        : entry.status === 'different' ? 'Changed'
                        : entry.status === 'left-only' ? 'Left only'
                        : 'Right only'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                    {entry.status === 'different' && !entry.isBinary && entry.leftData && entry.rightData && (
                      <button
                        className="btn outlined"
                        style={{ fontSize: 11, height: 24, padding: '0 8px' }}
                        onClick={() => openDiff(entry)}
                      >
                        Diff
                      </button>
                    )}
                    {(entry.leftData || entry.rightData) && (
                      <button
                        className="btn outlined"
                        style={{ fontSize: 11, height: 24, padding: '0 8px' }}
                        title="Download file"
                        onClick={() => downloadEntry(entry, entry.leftData ? 'left' : 'right')}
                      >
                        ↓
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="status-bar">
        <div style={{ display: 'flex', gap: 16 }}>
          {stats.different > 0 && <span style={{ color: 'var(--amber)' }}>{stats.different} changed</span>}
          {stats.leftOnly > 0 && <span className="stat-red">{stats.leftOnly} left only</span>}
          {stats.rightOnly > 0 && <span className="stat-green">{stats.rightOnly} right only</span>}
          {stats.same > 0 && <span>{stats.same} identical</span>}
          {!hasData && <span>Select ZIP files to compare</span>}
        </div>
        <div style={{ fontSize: 11 }}>
          {leftName && rightName ? `${leftName} vs ${rightName}` : ''}
          {pathFilter.trim() && hasData ? ` · ${filtered.length} shown` : ''}
        </div>
      </div>
    </div>
  )
}
