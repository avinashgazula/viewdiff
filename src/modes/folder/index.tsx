import { useCallback, useEffect, useRef, useState } from 'react'
import { ModeTabs } from '../../components/mode-tabs'
import { useTheme } from '../../hooks/use-theme'
import { MoonIcon, MonitorIcon, SunIcon } from '../../components/icons'
import { downloadText } from '../../export'

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
  leftFile: File | null
  rightFile: File | null
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
  const [leftName, setLeftName] = useState('')
  const [rightName, setRightName] = useState('')

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
        if (!lFile) status = 'right-only'
        else if (!rFile) status = 'left-only'
        else {
          if (lFile.size === rFile.size) {
            const [lHash, rHash] = await Promise.all([hashFile(lFile), hashFile(rFile)])
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
          leftFile: lFile,
          rightFile: rFile,
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

  function openTextDiff(entry: DiffEntry) {
    if (!entry.leftFile || !entry.rightFile) return
    const readFile = (f: File) => new Promise<string>((res) => {
      const r = new FileReader()
      r.onload = (e) => res(e.target?.result as string)
      r.readAsText(f)
    })
    Promise.all([readFile(entry.leftFile), readFile(entry.rightFile)]).then(([l, r]) => {
      const encoded = btoa(encodeURIComponent(JSON.stringify({ o: l, m: r })))
      window.open(`/?inline=1#data=${encoded}`, '_blank')
    })
  }

  const stats = {
    total: diffEntries.length,
    different: diffEntries.filter((e) => e.status === 'different').length,
    leftOnly: diffEntries.filter((e) => e.status === 'left-only').length,
    rightOnly: diffEntries.filter((e) => e.status === 'right-only').length,
    same: diffEntries.filter((e) => e.status === 'same').length,
  }

  const filtered = filter === 'all' ? diffEntries : diffEntries.filter((e) => e.status === filter)

  const hasData = leftFiles.size > 0 || rightFiles.size > 0

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
            gridTemplateColumns: '24px 1fr 80px 80px 80px 80px',
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
            <div>File</div>
            <div style={{ textAlign: 'right' }}>Left size</div>
            <div style={{ textAlign: 'right' }}>Right size</div>
            <div style={{ textAlign: 'center' }}>Status</div>
            <div />
          </div>

          {/* File list */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {filtered.length === 0 && !computing && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No files match this filter
              </div>
            )}
            {filtered.map((entry) => (
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
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {entry.path}
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
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  {entry.status === 'different' && entry.leftFile && entry.rightFile && (
                    <button
                      className="btn outlined"
                      style={{ fontSize: 11, height: 24, padding: '0 8px' }}
                      onClick={() => openTextDiff(entry)}
                    >
                      Diff
                    </button>
                  )}
                </div>
              </div>
            ))}
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
