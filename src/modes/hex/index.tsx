import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ModeTabs } from '../../components/mode-tabs'
import { useTheme } from '../../hooks/use-theme'
import { MoonIcon, MonitorIcon, SunIcon } from '../../components/icons'
import { downloadText } from '../../export'

const BYTES_PER_ROW = 16
const ROW_HEIGHT = 22
const MAX_DIFF_BYTES = 10 * 1024 * 1024 // 10 MB for diff

interface HexDiff {
  leftBytes: Uint8Array
  rightBytes: Uint8Array
  diffMask: Uint8Array // 1 = different, 0 = same
  totalLeft: number
  totalRight: number
}

function computeHexDiff(left: Uint8Array, right: Uint8Array): HexDiff {
  const maxLen = Math.max(left.length, right.length)
  const diffMask = new Uint8Array(maxLen)
  for (let i = 0; i < maxLen; i++) {
    diffMask[i] = left[i] !== right[i] ? 1 : 0
  }
  return { leftBytes: left, rightBytes: right, diffMask, totalLeft: left.length, totalRight: right.length }
}

function toHex2(n: number | undefined): string {
  if (n === undefined) return '  '
  return n.toString(16).toUpperCase().padStart(2, '0')
}

function toAscii(n: number | undefined): string {
  if (n === undefined) return ' '
  return n >= 32 && n < 127 ? String.fromCharCode(n) : '·'
}

function formatOffset(n: number): string {
  return n.toString(16).toUpperCase().padStart(8, '0')
}

interface HexRowProps {
  offset: number
  bytes: Uint8Array
  diffBytes: Uint8Array
  diffMask: Uint8Array
  side: 'left' | 'right'
}

function HexRow({ offset, bytes, diffBytes, diffMask, side }: HexRowProps) {
  const cells: React.ReactNode[] = []
  const ascii: React.ReactNode[] = []

  for (let i = 0; i < BYTES_PER_ROW; i++) {
    const byteIdx = offset + i
    const val = bytes[byteIdx]
    const isDiff = byteIdx < diffMask.length && diffMask[byteIdx] === 1
    const isPresent = byteIdx < bytes.length

    const color = isDiff
      ? (side === 'left' ? 'var(--red)' : 'var(--green)')
      : 'inherit'
    const bg = isDiff
      ? (side === 'left' ? 'var(--red-bg)' : 'var(--green-bg)')
      : 'transparent'

    cells.push(
      <span key={i} style={{
        color, background: bg, borderRadius: 2, padding: '0 1px',
        fontFamily: 'var(--font-mono)', fontSize: 12,
        opacity: isPresent ? 1 : 0.2,
      }}>
        {toHex2(val)}
      </span>,
    )
    if (i === 7) cells.push(<span key="mid" style={{ width: 8, display: 'inline-block' }} />)

    ascii.push(
      <span key={i} style={{
        color, fontFamily: 'var(--font-mono)', fontSize: 12,
        opacity: isPresent ? 1 : 0.2,
      }}>
        {toAscii(val)}
      </span>,
    )
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      height: ROW_HEIGHT,
      padding: '0 8px',
      gap: 16,
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', width: 72, flexShrink: 0 }}>
        {formatOffset(offset)}
      </span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
        {cells}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', borderLeft: '1px solid var(--border)', paddingLeft: 12, letterSpacing: '0.05em' }}>
        {ascii}
      </div>
    </div>
  )
}

function VirtualHexDump({ diff, side, containerHeight, jumpToOffset, onContainerReady, onSyncScroll }: {
  diff: HexDiff
  side: 'left' | 'right'
  containerHeight: number
  jumpToOffset?: number
  onContainerReady?: (el: HTMLDivElement) => void
  onSyncScroll?: (top: number) => void
}) {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const bytes = side === 'left' ? diff.leftBytes : diff.rightBytes

  useEffect(() => {
    if (containerRef.current && onContainerReady) onContainerReady(containerRef.current)
  }, [onContainerReady])

  useEffect(() => {
    if (jumpToOffset === undefined || jumpToOffset === null) return
    const row = Math.floor(jumpToOffset / BYTES_PER_ROW)
    if (containerRef.current) containerRef.current.scrollTop = row * ROW_HEIGHT
  }, [jumpToOffset])

  const totalRows = Math.ceil(Math.max(diff.totalLeft, diff.totalRight) / BYTES_PER_ROW)

  const buffer = 5
  const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - buffer)
  const endRow = Math.min(totalRows, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + buffer)
  const offsetY = startRow * ROW_HEIGHT

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}
      onScroll={(e) => {
        const top = e.currentTarget.scrollTop
        setScrollTop(top)
        onSyncScroll?.(top)
      }}
    >
      <div style={{ height: totalRows * ROW_HEIGHT, position: 'relative', minWidth: 520 }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {Array.from({ length: endRow - startRow }, (_, i) => {
            const row = startRow + i
            return (
              <HexRow
                key={row}
                offset={row * BYTES_PER_ROW}
                bytes={bytes}
                diffBytes={side === 'left' ? diff.rightBytes : diff.leftBytes}
                diffMask={diff.diffMask}
                side={side}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function detectMime(bytes: Uint8Array): string {
  const sig = Array.from(bytes.slice(0, 8)).map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
  if (sig.startsWith('89 50 4E 47')) return 'PNG image'
  if (sig.startsWith('FF D8 FF')) return 'JPEG image'
  if (sig.startsWith('47 49 46')) return 'GIF image'
  if (sig.startsWith('50 4B 03 04')) return 'ZIP archive'
  if (sig.startsWith('25 50 44 46')) return 'PDF document'
  if (sig.startsWith('7F 45 4C 46')) return 'ELF binary'
  if (sig.startsWith('4D 5A')) return 'Windows executable'
  if (sig.startsWith('CA FE BA BE')) return 'Java class file'
  if (sig.startsWith('1F 8B')) return 'GZIP archive'
  return 'Binary file'
}

function buildDiffReport(leftFile: File | null, rightFile: File | null, diff: HexDiff, regions: Array<{ start: number; end: number }>): string {
  const lines: string[] = [
    `Hex Diff Report`,
    `================`,
    `Left:  ${leftFile?.name ?? '(unknown)'} — ${diff.totalLeft.toLocaleString()} bytes`,
    `Right: ${rightFile?.name ?? '(unknown)'} — ${diff.totalRight.toLocaleString()} bytes`,
    ``,
    `${regions.length} diff region${regions.length !== 1 ? 's' : ''}`,
    ``,
  ]
  for (let i = 0; i < regions.length; i++) {
    const { start, end } = regions[i]
    lines.push(`Region ${i + 1}: offset 0x${start.toString(16).toUpperCase().padStart(8, '0')} – 0x${end.toString(16).toUpperCase().padStart(8, '0')} (${end - start + 1} bytes)`)
    const leftBytes = Array.from(diff.leftBytes.slice(start, Math.min(end + 1, start + 32))).map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
    const rightBytes = Array.from(diff.rightBytes.slice(start, Math.min(end + 1, start + 32))).map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
    lines.push(`  Left:  ${leftBytes}${end - start >= 32 ? ' ...' : ''}`)
    lines.push(`  Right: ${rightBytes}${end - start >= 32 ? ' ...' : ''}`)
    lines.push(``)
  }
  return lines.join('\n')
}

function getDiffRegions(diffMask: Uint8Array): Array<{ start: number; end: number }> {
  const regions: Array<{ start: number; end: number }> = []
  let i = 0
  while (i < diffMask.length) {
    if (diffMask[i] === 1) {
      const start = i
      while (i < diffMask.length && diffMask[i] === 1) i++
      regions.push({ start, end: i - 1 })
    } else {
      i++
    }
  }
  return regions
}

function findBytes(haystack: Uint8Array, needle: Uint8Array): number {
  if (needle.length === 0 || needle.length > haystack.length) return -1
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}

function parseHexPattern(raw: string): Uint8Array | null {
  const cleaned = raw.replace(/\s+/g, '').replace(/^0x/i, '')
  if (!/^[0-9a-f]*$/i.test(cleaned) || cleaned.length % 2 !== 0 || cleaned.length === 0) return null
  const bytes = new Uint8Array(cleaned.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleaned.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

export function HexMode() {
  const { mode: themeMode, toggle: toggleTheme } = useTheme()
  const [leftBytes, setLeftBytes] = useState<Uint8Array | null>(null)
  const [rightBytes, setRightBytes] = useState<Uint8Array | null>(null)
  const [leftFile, setLeftFile] = useState<File | null>(null)
  const [rightFile, setRightFile] = useState<File | null>(null)
  const [diff, setDiff] = useState<HexDiff | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [jumpOffset, setJumpOffset] = useState<number | undefined>(undefined)
  const [diffRegionIdx, setDiffRegionIdx] = useState(0)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const [paneHeight, setPaneHeight] = useState(400)
  // Synchronized scroll
  const syncContainersRef = useRef<{ left: HTMLDivElement | null; right: HTMLDivElement | null }>({ left: null, right: null })
  const syncActiveRef = useRef(false)
  const handleSyncScroll = useCallback((side: 'left' | 'right', top: number) => {
    if (syncActiveRef.current) return
    syncActiveRef.current = true
    const other = side === 'left' ? syncContainersRef.current.right : syncContainersRef.current.left
    if (other) other.scrollTop = top
    syncActiveRef.current = false
  }, [])

  useEffect(() => {
    const obs = new ResizeObserver((entries) => setPaneHeight(entries[0].contentRect.height))
    if (leftRef.current) obs.observe(leftRef.current)
    return () => obs.disconnect()
  }, [diff])

  async function loadFile(file: File): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(new Uint8Array(e.target!.result as ArrayBuffer))
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  async function handleFile(side: 'left' | 'right', file: File) {
    if (file.size > MAX_DIFF_BYTES * 2) {
      setError(`File too large (max ${MAX_DIFF_BYTES / 1024 / 1024 * 2} MB)`)
      return
    }
    setLoading(true); setError(null)
    try {
      const bytes = await loadFile(file)
      if (side === 'left') { setLeftBytes(bytes); setLeftFile(file) }
      else { setRightBytes(bytes); setRightFile(file) }
    } catch {
      setError('Failed to read file')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!leftBytes || !rightBytes) { setDiff(null); return }
    const left = leftBytes.slice(0, MAX_DIFF_BYTES)
    const right = rightBytes.slice(0, MAX_DIFF_BYTES)
    setDiff(computeHexDiff(left, right))
  }, [leftBytes, rightBytes])

  const stats = useMemo(() => {
    if (!diff) return null
    let changed = 0
    for (let i = 0; i < diff.diffMask.length; i++) changed += diff.diffMask[i]
    return {
      changed,
      total: diff.diffMask.length,
      percentDiff: (changed / diff.diffMask.length) * 100,
    }
  }, [diff])

  const diffRegions = useMemo(() => (diff ? getDiffRegions(diff.diffMask) : []), [diff])

  const jumpToDiffRegion = useCallback((idx: number) => {
    const clamped = (idx + diffRegions.length) % diffRegions.length
    setDiffRegionIdx(clamped)
    setJumpOffset(diffRegions[clamped]?.start)
  }, [diffRegions])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (diffRegions.length === 0) return
      if (e.key === 'F7' && !e.shiftKey) { e.preventDefault(); jumpToDiffRegion(diffRegionIdx + 1) }
      if (e.key === 'F7' && e.shiftKey) { e.preventDefault(); jumpToDiffRegion(diffRegionIdx - 1) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [diffRegions, diffRegionIdx, jumpToDiffRegion])

  function FileDropZone({ side }: { side: 'left' | 'right' }) {
    const [drag, setDrag] = useState(false)
    const file = side === 'left' ? leftFile : rightFile
    const bytes = side === 'left' ? leftBytes : rightBytes
    return (
      <div
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          border: `2px dashed ${drag ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, margin: 12,
          background: drag ? 'var(--accent-subtle)' : 'var(--surface)', cursor: 'pointer', gap: 8,
          minHeight: 160, transition: 'all 0.15s',
        }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handleFile(side, f) }}
      >
        {file && bytes ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{file.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {(file.size / 1024).toFixed(1)} KB · {detectMime(bytes)}
            </div>
            <label className="btn outlined" style={{ cursor: 'pointer', fontSize: 12, marginTop: 4 }}>
              Replace
              <input type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(side, f) }} />
            </label>
          </>
        ) : (
          <>
            <div style={{ fontSize: 28, color: 'var(--text-dim)' }}>+</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
              {side === 'left' ? 'Original file' : 'Modified file'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Drop any binary file or click to browse</div>
            <label className="btn outlined" style={{ cursor: 'pointer', fontSize: 12, marginTop: 4 }}>
              Browse
              <input type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(side, f) }} />
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
          {loading && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading...</span>}
          {error && <span style={{ fontSize: 12, color: 'var(--red)' }}>{error}</span>}
          {diff && (
            <>
              <input
                type="text"
                placeholder="Jump to offset (hex)"
                title="Type a hex offset (e.g. 0x1F4) and press Enter to scroll"
                style={{
                  height: 26, padding: '0 8px', fontFamily: 'var(--font-mono)', fontSize: 11.5,
                  color: 'var(--text)', background: 'var(--surface-raised)',
                  border: '1px solid var(--border)', borderRadius: 6, outline: 'none', width: 148,
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  const raw = e.currentTarget.value.trim().replace(/^0x/i, '')
                  const offset = parseInt(raw, 16)
                  if (!isNaN(offset)) setJumpOffset(offset)
                }}
              />
              <input
                type="text"
                placeholder="Find bytes (hex)"
                title="Type a hex byte pattern (e.g. FF D8 FF) and press Enter to find first match"
                style={{
                  height: 26, padding: '0 8px', fontFamily: 'var(--font-mono)', fontSize: 11.5,
                  color: 'var(--text)', background: 'var(--surface-raised)',
                  border: '1px solid var(--border)', borderRadius: 6, outline: 'none', width: 140,
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  const pattern = parseHexPattern(e.currentTarget.value)
                  if (!pattern) { setError('Invalid hex pattern'); return }
                  setError(null)
                  const bytes = diff.leftBytes.length >= diff.rightBytes.length ? diff.leftBytes : diff.rightBytes
                  const offset = findBytes(bytes, pattern)
                  if (offset >= 0) setJumpOffset(offset)
                  else setError('Pattern not found')
                }}
              />
              {diffRegions.length > 0 && (
                <>
                  <button
                    className="btn outlined"
                    style={{ fontSize: 11, height: 26, padding: '0 8px' }}
                    title="Previous diff region (Shift+F7)"
                    onClick={() => jumpToDiffRegion(diffRegionIdx - 1)}
                  >
                    ↑ Prev
                  </button>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 40, textAlign: 'center' }}>
                    {diffRegionIdx + 1}/{diffRegions.length}
                  </span>
                  <button
                    className="btn outlined"
                    style={{ fontSize: 11, height: 26, padding: '0 8px' }}
                    title="Next diff region (F7)"
                    onClick={() => jumpToDiffRegion(diffRegionIdx + 1)}
                  >
                    ↓ Next
                  </button>
                  <button
                    className="btn outlined"
                    style={{ fontSize: 11, height: 26, padding: '0 8px' }}
                    title="Export diff report as text"
                    onClick={() => downloadText(buildDiffReport(leftFile, rightFile, diff, diffRegions), 'hex-diff-report.txt')}
                  >
                    Export
                  </button>
                </>
              )}
            </>
          )}
          <div className="divider" aria-hidden="true" />
          <button onClick={toggleTheme} className="btn icon">
            {themeMode === 'system' ? <MonitorIcon /> : themeMode === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </nav>

      <ModeTabs />

      {!diff ? (
        <div style={{ flex: 1, display: 'flex' }}>
          <FileDropZone side="left" />
          <FileDropZone side="right" />
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div ref={leftRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)', minHeight: 0 }}>
            <div style={{ padding: '4px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-secondary)', flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
              <span>{leftFile?.name}</span>
              <span style={{ color: 'var(--text-dim)' }}>{leftBytes && detectMime(leftBytes)} · {leftFile && (leftFile.size / 1024).toFixed(1)} KB</span>
            </div>
            <VirtualHexDump
              diff={diff} side="left" containerHeight={paneHeight} jumpToOffset={jumpOffset}
              onContainerReady={(el) => { syncContainersRef.current.left = el }}
              onSyncScroll={(top) => handleSyncScroll('left', top)}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '4px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-secondary)', flexShrink: 0, display: 'flex', justifyContent: 'space-between' }}>
              <span>{rightFile?.name}</span>
              <span style={{ color: 'var(--text-dim)' }}>{rightBytes && detectMime(rightBytes)} · {rightFile && (rightFile.size / 1024).toFixed(1)} KB</span>
            </div>
            <VirtualHexDump
              diff={diff} side="right" containerHeight={paneHeight} jumpToOffset={jumpOffset}
              onContainerReady={(el) => { syncContainersRef.current.right = el }}
              onSyncScroll={(top) => handleSyncScroll('right', top)}
            />
          </div>
        </div>
      )}

      <div className="status-bar">
        <div style={{ display: 'flex', gap: 16 }}>
          {stats && (
            <>
              <span className={stats.changed > 0 ? 'stat-red' : 'stat-green'}>
                {stats.changed.toLocaleString()} bytes differ ({stats.percentDiff.toFixed(2)}%)
              </span>
              <span>{stats.total.toLocaleString()} bytes compared</span>
            </>
          )}
          {!diff && <span>Drop two files to compare their bytes</span>}
        </div>
        <div style={{ fontSize: 11, display: 'flex', gap: 12 }}>
          {leftFile && <span>L: {leftFile.size.toLocaleString()} B</span>}
          {rightFile && <span>R: {rightFile.size.toLocaleString()} B</span>}
        </div>
      </div>
    </div>
  )
}
