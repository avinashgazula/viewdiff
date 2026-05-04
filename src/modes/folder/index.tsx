import { useCallback, useEffect, useRef, useState } from 'react'
import { ModeTabs } from '../../components/mode-tabs'
import { useTheme } from '../../hooks/use-theme'
import { MoonIcon, MonitorIcon, SunIcon } from '../../components/icons'
import { downloadText } from '../../export'
import { encodeDiff, encodeText } from '../../share'

type FileStatus = 'same' | 'different' | 'left-only' | 'right-only'

interface FileEntry {
  path: string
  name: string
  size: number
  hash: string
}

interface DiffEntry {
  path: string
  status: FileStatus
  leftSize: number | null
  rightSize: number | null
  leftModified: number | null
  rightModified: number | null
  leftFile: File | null
  rightFile: File | null
  leftHash: string | null
  rightHash: string | null
}

function formatRelativeTime(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function sizeDelta(left: number | null, right: number | null): string | null {
  if (left === null || right === null) return null
  const d = right - left
  if (d === 0) return null
  const sign = d > 0 ? '+' : ''
  const abs = Math.abs(d)
  if (abs < 1024) return `${sign}${d} B`
  if (abs < 1024 * 1024) return `${sign}${(d / 1024).toFixed(1)} KB`
  return `${sign}${(d / 1024 / 1024).toFixed(1)} MB`
}

async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

function getRelativePath(file: File): string {
  const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  if (path) {
    const parts = path.split('/')
    return parts.slice(1).join('/') // strip the root folder name
  }
  return file.name
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

export function FolderMode() {
  const { mode: themeMode, toggle: toggleTheme } = useTheme()
  const [leftFiles, setLeftFiles] = useState<Map<string, File>>(new Map())
  const [rightFiles, setRightFiles] = useState<Map<string, File>>(new Map())
  const [diffEntries, setDiffEntries] = useState<DiffEntry[]>([])
  const [computing, setComputing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [extFilter, setExtFilter] = useState('')
  const [pathSearch, setPathSearch] = useState('')
  const [leftName, setLeftName] = useState('')
  const [rightName, setRightName] = useState('')
  const [sortKey, setSortKey] = useState<'name' | 'status' | 'leftSize' | 'rightSize' | 'delta'>('status')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedEntry, setSelectedEntry] = useState<DiffEntry | null>(null)
  const [groupByDir, setGroupByDir] = useState(false)
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set())

  function loadFiles(side: 'left' | 'right', files: FileList) {
    const map = new Map<string, File>()
    for (const file of Array.from(files)) {
      map.set(getRelativePath(file), file)
    }
    if (side === 'left') {
      setLeftFiles(map)
      const firstFile = files[0] as File & { webkitRelativePath?: string }
      setLeftName(firstFile?.webkitRelativePath?.split('/')[0] || 'Left')
    } else {
      setRightFiles(map)
      const firstFile = files[0] as File & { webkitRelativePath?: string }
      setRightName(firstFile?.webkitRelativePath?.split('/')[0] || 'Right')
    }
  }

  useEffect(() => {
    if (leftFiles.size === 0 && rightFiles.size === 0) return
    let cancelled = false

    async function compute() {
      setComputing(true)
      setProgress(0)

      const allPaths = new Set([...leftFiles.keys(), ...rightFiles.keys()])
      const entries: DiffEntry[] = []
      let done = 0

      for (const path of allPaths) {
        if (cancelled) return
        const lFile = leftFiles.get(path) ?? null
        const rFile = rightFiles.get(path) ?? null

        let status: FileStatus
        let lHash: string | null = null
        let rHash: string | null = null
        if (!lFile) status = 'right-only'
        else if (!rFile) status = 'left-only'
        else {
          if (lFile.size === rFile.size) {
            ;[lHash, rHash] = await Promise.all([hashFile(lFile), hashFile(rFile)])
            status = lHash === rHash ? 'same' : 'different'
          } else {
            status = 'different'
          }
        }

        entries.push({
          path,
          status,
          leftSize: lFile?.size ?? null,
          rightSize: rFile?.size ?? null,
          leftModified: lFile?.lastModified ?? null,
          rightModified: rFile?.lastModified ?? null,
          leftFile: lFile,
          rightFile: rFile,
          leftHash: lHash,
          rightHash: rHash,
        })

        done++
        setProgress(Math.round((done / allPaths.size) * 100))
      }

      entries.sort((a, b) => {
        const order: Record<FileStatus, number> = { different: 0, 'left-only': 1, 'right-only': 2, same: 3 }
        if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
        return a.path.localeCompare(b.path)
      })

      if (!cancelled) {
        setDiffEntries(entries)
        setComputing(false)
      }
    }

    compute()
    return () => { cancelled = true }
  }, [leftFiles, rightFiles])

  function getFileMode(path: string): 'json' | 'yaml' | 'xml' | 'markdown' | 'env' | 'table' | 'text' {
    const filename = path.split('/').pop()?.toLowerCase() ?? ''
    const ext = filename.split('.').pop() ?? ''
    if (ext === 'json') return 'json'
    if (['yaml', 'yml'].includes(ext)) return 'yaml'
    if (['xml', 'xhtml', 'svg', 'xsd', 'xsl', 'rss', 'atom'].includes(ext)) return 'xml'
    if (['md', 'markdown', 'mdx'].includes(ext)) return 'markdown'
    if (['csv', 'tsv'].includes(ext)) return 'table'
    if (['env', 'ini', 'properties', 'cfg', 'conf'].includes(ext) || filename.startsWith('.env')) return 'env'
    return 'text'
  }

  function openDiff(entry: DiffEntry) {
    if (!entry.leftFile || !entry.rightFile) return
    const readFile = (f: File) => new Promise<string>((res) => {
      const r = new FileReader()
      r.onload = (e) => res(e.target?.result as string)
      r.readAsText(f)
    })
    const mode = getFileMode(entry.path)
    Promise.all([readFile(entry.leftFile), readFile(entry.rightFile)]).then(async ([l, r]) => {
      if (mode === 'text') {
        const encoded = await encodeDiff(l, r)
        window.open(`${window.location.origin}/?d=${encodeURIComponent(encoded)}`, '_blank')
      } else {
        const [encL, encR] = await Promise.all([encodeText(l), encodeText(r)])
        window.open(`${window.location.origin}/${mode}?l=${encodeURIComponent(encL)}&r=${encodeURIComponent(encR)}`, '_blank')
      }
    })
  }

  const stats = {
    total: diffEntries.length,
    different: diffEntries.filter((e) => e.status === 'different').length,
    leftOnly: diffEntries.filter((e) => e.status === 'left-only').length,
    rightOnly: diffEntries.filter((e) => e.status === 'right-only').length,
    same: diffEntries.filter((e) => e.status === 'same').length,
  }

  const handleSortClick = useCallback((key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }, [sortKey])

  const byStatus = filter === 'all' ? diffEntries : diffEntries.filter((e) => e.status === filter)
  const filtered = (() => {
    const byExt = extFilter.trim()
      ? (() => {
          const exts = extFilter.split(',').map((x) => x.trim().replace(/^\*/, '').toLowerCase()).filter(Boolean)
          return byStatus.filter((e) => exts.some((ext) => e.path.toLowerCase().endsWith(ext)))
        })()
      : byStatus
    const byPath = pathSearch.trim()
      ? byExt.filter((e) => e.path.toLowerCase().includes(pathSearch.trim().toLowerCase()))
      : byExt
    const statusOrder: Record<FileStatus, number> = { different: 0, 'left-only': 1, 'right-only': 2, same: 3 }
    return [...byPath].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.path.localeCompare(b.path)
      else if (sortKey === 'status') cmp = statusOrder[a.status] - statusOrder[b.status] || a.path.localeCompare(b.path)
      else if (sortKey === 'leftSize') cmp = (a.leftSize ?? -1) - (b.leftSize ?? -1)
      else if (sortKey === 'rightSize') cmp = (a.rightSize ?? -1) - (b.rightSize ?? -1)
      else if (sortKey === 'delta') {
        const da = (a.leftSize !== null && a.rightSize !== null) ? a.rightSize - a.leftSize : 0
        const db = (b.leftSize !== null && b.rightSize !== null) ? b.rightSize - b.leftSize : 0
        cmp = da - db
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  })()

  const hasData = leftFiles.size > 0 || rightFiles.size > 0

  const dirGroups: Array<{ dir: string; entries: DiffEntry[] }> = groupByDir
    ? (() => {
        const map = new Map<string, DiffEntry[]>()
        for (const entry of filtered) {
          const idx = entry.path.lastIndexOf('/')
          const dir = idx >= 0 ? entry.path.slice(0, idx) : ''
          if (!map.has(dir)) map.set(dir, [])
          map.get(dir)!.push(entry)
        }
        return [...map.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([dir, entries]) => ({ dir, entries }))
      })()
    : []

  function toggleDir(dir: string) {
    setCollapsedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(dir)) next.delete(dir)
      else next.add(dir)
      return next
    })
  }

  function FileDetailPanel({ entry, onClose }: { entry: DiffEntry; onClose: () => void }) {
    const hashMatch = entry.leftHash !== null && entry.rightHash !== null
    const hashEqual = hashMatch && entry.leftHash === entry.rightHash
    const ext = entry.path.includes('.') ? entry.path.split('.').pop()?.toLowerCase() ?? '' : ''
    const baseName = entry.path.split('/').pop() ?? entry.path
    const dirName = entry.path.includes('/') ? entry.path.split('/').slice(0, -1).join('/') : ''

    return (
      <div style={{
        width: 272, flexShrink: 0, borderLeft: '1px solid var(--border)',
        background: 'var(--surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          padding: '8px 12px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-dim)' }}>Details</span>
          <button
            className="btn icon"
            style={{ width: 20, height: 20, fontSize: 14, opacity: 0.6 }}
            onClick={onClose}
            aria-label="Close detail panel"
          >×</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
          <div style={{ marginBottom: 12 }}>
            {dirName && <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginBottom: 2, fontFamily: 'var(--font-mono)' }}>{dirName}/</div>}
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{baseName}</div>
            {ext && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>.{ext} file</div>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <StatusBadge status={entry.status} />
            <span style={{ fontSize: 12, marginLeft: 6, color: 'var(--text-muted)' }}>
              {entry.status === 'same' ? 'Identical' : entry.status === 'different' ? 'Changed' : entry.status === 'left-only' ? 'Left only' : 'Right only'}
            </span>
          </div>

          {(entry.leftFile || entry.rightFile) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              {(['left', 'right'] as const).map((side) => {
                const file = side === 'left' ? entry.leftFile : entry.rightFile
                const size = side === 'left' ? entry.leftSize : entry.rightSize
                const mod = side === 'left' ? entry.leftModified : entry.rightModified
                const hash = side === 'left' ? entry.leftHash : entry.rightHash
                if (size === null && mod === null) return null
                return (
                  <div key={side} style={{ background: 'var(--surface-raised)', borderRadius: 6, padding: '8px 10px', fontSize: 11.5 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{side}</div>
                    {size !== null && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Size</span><span style={{ fontFamily: 'var(--font-mono)' }}>{formatSize(size)}</span></div>}
                    {mod !== null && <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}><span style={{ color: 'var(--text-muted)' }}>Modified</span><span title={new Date(mod).toLocaleString()}>{formatRelativeTime(mod)}</span></div>}
                    {hash && (
                      <div style={{ marginTop: 5, paddingTop: 5, borderTop: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>SHA-256</span>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', marginTop: 2, wordBreak: 'break-all' }}>{hash.slice(0, 16)}…</div>
                      </div>
                    )}
                    {file && (
                      <button
                        className="btn outlined"
                        style={{ marginTop: 6, fontSize: 10.5, height: 22, padding: '0 7px', width: '100%' }}
                        onClick={() => {
                          const a = document.createElement('a')
                          a.href = URL.createObjectURL(file)
                          a.download = file.name
                          a.click()
                          URL.revokeObjectURL(a.href)
                        }}
                      >↓ Download</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {hashMatch && (
            <div style={{
              padding: '6px 10px', borderRadius: 6, fontSize: 11.5, marginBottom: 12,
              background: hashEqual ? 'var(--green-bg)' : 'var(--red-bg)',
              color: hashEqual ? 'var(--green)' : 'var(--red)',
              border: `1px solid ${hashEqual ? 'var(--green)' : 'var(--red)'}`,
            }}>
              {hashEqual ? '✓ Hashes match' : '✗ Hashes differ'}
            </div>
          )}

          {entry.status === 'different' && entry.leftFile && entry.rightFile && (
            <button
              className="btn"
              style={{ width: '100%', fontSize: 12, height: 30 }}
              onClick={() => openDiff(entry)}
              title={`Open in ${getFileMode(entry.path).toUpperCase()} diff mode`}
            >
              Open in {getFileMode(entry.path).toUpperCase()} diff →
            </button>
          )}
        </div>
      </div>
    )
  }

  function DropZone({ side }: { side: 'left' | 'right' }) {
    const [drag, setDrag] = useState(false)
    const count = side === 'left' ? leftFiles.size : rightFiles.size
    const name = side === 'left' ? leftName : rightName
    return (
      <div
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          border: `2px dashed ${drag ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 12, margin: 12, background: drag ? 'var(--accent-subtle)' : 'var(--surface)',
          cursor: 'pointer', gap: 8, minHeight: 160, transition: 'all 0.15s',
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault(); setDrag(false)
          if (e.dataTransfer.files.length > 0) loadFiles(side, e.dataTransfer.files)
        }}
      >
        {count > 0 ? (
          <>
            <div style={{ fontSize: 32, color: 'var(--accent)' }}>📁</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{name || (side === 'left' ? 'Left' : 'Right')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{count} files</div>
            <label className="btn outlined" style={{ cursor: 'pointer', fontSize: 12, marginTop: 4 }}>
              Replace
              <input type="file" multiple {...({ webkitdirectory: '' } as any)} style={{ display: 'none' }} onChange={(e) => { if (e.target.files) loadFiles(side, e.target.files) }} />
            </label>
          </>
        ) : (
          <>
            <div style={{ fontSize: 28, color: 'var(--text-dim)' }}>+</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
              {side === 'left' ? 'Original folder' : 'Modified folder'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Drop a folder or select multiple files</div>
            <label className="btn outlined" style={{ cursor: 'pointer', fontSize: 12, marginTop: 4 }}>
              Select folder
              <input type="file" multiple {...({ webkitdirectory: '' } as any)} style={{ display: 'none' }} onChange={(e) => { if (e.target.files) loadFiles(side, e.target.files) }} />
            </label>
          </>
        )}
      </div>
    )
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
                type="text"
                value={extFilter}
                onChange={(e) => setExtFilter(e.target.value)}
                placeholder="*.ts,*.tsx"
                title="Filter by extension (comma-separated, e.g. *.ts,*.tsx)"
                style={{
                  height: 26, padding: '0 8px', fontFamily: 'var(--font-mono)', fontSize: 11.5,
                  color: 'var(--text)', background: 'var(--surface-raised)',
                  border: '1px solid var(--border)', borderRadius: 6, outline: 'none', width: 110,
                }}
              />
              <input
                type="search"
                value={pathSearch}
                onChange={(e) => setPathSearch(e.target.value)}
                placeholder="Search paths…"
                aria-label="Search file paths"
                style={{
                  height: 26, padding: '0 8px', fontFamily: 'var(--font-mono)', fontSize: 11.5,
                  color: 'var(--text)', background: 'var(--surface-raised)',
                  border: '1px solid var(--border)', borderRadius: 6, outline: 'none', width: 140,
                }}
              />
              <button
                className={`btn outlined ${groupByDir ? 'active' : ''}`}
                title="Group files by directory"
                onClick={() => setGroupByDir((v) => !v)}
              >
                Group by dir
              </button>
              {groupByDir && dirGroups.length > 0 && (
                <>
                  <button
                    className="btn outlined"
                    title="Collapse all directories"
                    onClick={() => setCollapsedDirs(new Set(dirGroups.map((g) => g.dir)))}
                  >
                    Collapse all
                  </button>
                  <button
                    className="btn outlined"
                    title="Expand all directories"
                    onClick={() => setCollapsedDirs(new Set())}
                  >
                    Expand all
                  </button>
                </>
              )}
              <button
                className="btn outlined"
                title="Export comparison report as CSV"
                onClick={() => {
                  const rows = ['Status,Path']
                  for (const e of diffEntries) rows.push(`${e.status},"${e.path.replace(/"/g, '""')}"`)
                  downloadText(rows.join('\n'), 'folder-diff.csv', 'text/csv')
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
        <div style={{ flex: 1, display: 'flex' }}>
          <DropZone side="left" />
          <DropZone side="right" />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {(leftFiles.size === 0 || rightFiles.size === 0) && (
            <div style={{ display: 'flex', padding: 8, gap: 8, borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)' }}>
              {leftFiles.size === 0 && <DropZone side="left" />}
              {rightFiles.size === 0 && <DropZone side="right" />}
            </div>
          )}

          {computing && (
            <div style={{ padding: '8px 16px', background: 'var(--accent-subtle)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--accent)', flexShrink: 0 }}>
              Hashing files... {progress}%
            </div>
          )}

          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '24px 1fr 80px 80px 72px 80px 80px',
            padding: '6px 16px',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            fontSize: 10.5,
            fontWeight: 650,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-dim)',
            flexShrink: 0,
          }}>
            <div />
            {([
              { key: 'name' as const, label: 'File', align: 'left' },
              { key: 'leftSize' as const, label: 'Left size', align: 'right' },
              { key: 'rightSize' as const, label: 'Right size', align: 'right' },
              { key: 'delta' as const, label: 'Delta', align: 'right' },
              { key: 'status' as const, label: 'Status', align: 'center' },
            ] as const).map(({ key, label, align }) => (
              <div
                key={key}
                role="button"
                tabIndex={0}
                style={{ textAlign: align as any, cursor: 'pointer', userSelect: 'none', color: sortKey === key ? 'var(--accent)' : undefined }}
                onClick={() => handleSortClick(key)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSortClick(key) }}
                aria-sort={sortKey === key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                {label}{sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </div>
            ))}
            <div />
          </div>

          {/* File list + detail panel */}
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {filtered.length === 0 && !computing && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No files match this filter
                </div>
              )}
              {groupByDir ? (
                dirGroups.map(({ dir, entries: dirEntries }) => {
                  const isCollapsed = collapsedDirs.has(dir)
                  const nChanged = dirEntries.filter((e) => e.status !== 'same').length
                  return (
                    <div key={dir || '__root__'}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleDir(dir)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleDir(dir) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 16px',
                          background: 'var(--surface)',
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer', outline: 'none',
                          position: 'sticky', top: 0, zIndex: 1,
                          userSelect: 'none',
                        }}
                      >
                        <span style={{ fontSize: 9, color: 'var(--text-dim)', width: 10, flexShrink: 0 }}>{isCollapsed ? '▶' : '▼'}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {dir === '' ? '/' : dir + '/'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          {dirEntries.length} {dirEntries.length === 1 ? 'file' : 'files'}
                        </span>
                        {nChanged > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--amber)' }}>· {nChanged} changed</span>
                        )}
                      </div>
                      {!isCollapsed && dirEntries.map((entry) => {
                        const delta = sizeDelta(entry.leftSize, entry.rightSize)
                        const isSelected = selectedEntry?.path === entry.path
                        const basename = entry.path.split('/').pop() ?? entry.path
                        return (
                          <div
                            key={entry.path}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedEntry(isSelected ? null : entry)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedEntry(isSelected ? null : entry) }}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '24px 1fr 80px 80px 72px 80px 80px',
                              padding: '5px 16px 5px 36px',
                              borderBottom: '1px solid var(--border-subtle)',
                              alignItems: 'center',
                              fontSize: 13,
                              cursor: 'pointer',
                              outline: 'none',
                              background: isSelected ? 'var(--accent-subtle)'
                                : entry.status === 'different' ? 'oklch(95% 0.02 80 / 0.4)'
                                : entry.status === 'left-only' ? 'var(--red-bg)'
                                : entry.status === 'right-only' ? 'var(--green-bg)'
                                : 'transparent',
                              borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                            }}
                          >
                            <StatusBadge status={entry.status} />
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                              {basename}
                            </div>
                            <div style={{ textAlign: 'right', fontSize: 11.5, color: 'var(--text-muted)' }}
                              title={entry.leftModified != null ? `Modified ${formatRelativeTime(entry.leftModified)}` : undefined}
                            >
                              {entry.leftSize !== null ? formatSize(entry.leftSize) : '—'}
                            </div>
                            <div style={{ textAlign: 'right', fontSize: 11.5, color: 'var(--text-muted)' }}
                              title={entry.rightModified != null ? `Modified ${formatRelativeTime(entry.rightModified)}` : undefined}
                            >
                              {entry.rightSize !== null ? formatSize(entry.rightSize) : '—'}
                            </div>
                            <div style={{ textAlign: 'right', fontSize: 11, color: delta ? (delta.startsWith('+') ? 'var(--green)' : 'var(--red)') : 'var(--text-dim)' }}>
                              {delta ?? (entry.leftSize !== null && entry.rightSize !== null ? '=' : '—')}
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                                {entry.status === 'same' ? 'Identical'
                                  : entry.status === 'different' ? 'Changed'
                                  : entry.status === 'left-only' ? 'Left only'
                                  : 'Right only'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              {entry.status === 'different' && entry.leftFile && entry.rightFile && (
                                <button
                                  className="btn outlined"
                                  style={{ fontSize: 11, height: 24, padding: '0 8px' }}
                                  onClick={(e) => { e.stopPropagation(); openDiff(entry) }}
                                >Diff</button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              ) : (
                filtered.map((entry) => {
                  const delta = sizeDelta(entry.leftSize, entry.rightSize)
                  const isSelected = selectedEntry?.path === entry.path
                  return (
                    <div
                      key={entry.path}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedEntry(isSelected ? null : entry)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedEntry(isSelected ? null : entry) }}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '24px 1fr 80px 80px 72px 80px 80px',
                        padding: '6px 16px',
                        borderBottom: '1px solid var(--border-subtle)',
                        alignItems: 'center',
                        fontSize: 13,
                        cursor: 'pointer',
                        outline: 'none',
                        background: isSelected ? 'var(--accent-subtle)'
                          : entry.status === 'different' ? 'oklch(95% 0.02 80 / 0.4)'
                          : entry.status === 'left-only' ? 'var(--red-bg)'
                          : entry.status === 'right-only' ? 'var(--green-bg)'
                          : 'transparent',
                        borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                      }}
                    >
                      <StatusBadge status={entry.status} />
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {entry.path}
                      </div>
                      <div
                        style={{ textAlign: 'right', fontSize: 11.5, color: 'var(--text-muted)' }}
                        title={entry.leftModified != null ? `Modified ${formatRelativeTime(entry.leftModified)}` : undefined}
                      >
                        {entry.leftSize !== null ? formatSize(entry.leftSize) : '—'}
                      </div>
                      <div
                        style={{ textAlign: 'right', fontSize: 11.5, color: 'var(--text-muted)' }}
                        title={entry.rightModified != null ? `Modified ${formatRelativeTime(entry.rightModified)}` : undefined}
                      >
                        {entry.rightSize !== null ? formatSize(entry.rightSize) : '—'}
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 11, color: delta ? (delta.startsWith('+') ? 'var(--green)' : 'var(--red)') : 'var(--text-dim)' }}>
                        {delta ?? (entry.leftSize !== null && entry.rightSize !== null ? '=' : '—')}
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          {entry.status === 'same' ? 'Identical'
                            : entry.status === 'different' ? 'Changed'
                            : entry.status === 'left-only' ? 'Left only'
                            : 'Right only'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        {entry.status === 'different' && entry.leftFile && entry.rightFile && (
                          <button
                            className="btn outlined"
                            style={{ fontSize: 11, height: 24, padding: '0 8px' }}
                            onClick={(e) => { e.stopPropagation(); openDiff(entry) }}
                          >
                            Diff
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            {selectedEntry && (
              <FileDetailPanel entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
            )}
          </div>
        </div>
      )}

      <div className="status-bar">
        <div style={{ display: 'flex', gap: 16 }}>
          {stats.different > 0 && <span style={{ color: 'var(--amber)' }}>{stats.different} changed</span>}
          {stats.leftOnly > 0 && <span className="stat-red">{stats.leftOnly} left only</span>}
          {stats.rightOnly > 0 && <span className="stat-green">{stats.rightOnly} right only</span>}
          {stats.same > 0 && <span>{stats.same} identical</span>}
          {!hasData && <span>Select folders to compare</span>}
        </div>
        <div style={{ fontSize: 11 }}>
          {leftName && rightName ? `${leftName} vs ${rightName}` : ''}
        </div>
      </div>
    </div>
  )
}
