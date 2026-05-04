import { useEffect, useMemo, useState } from 'react'
import { ModeTabs } from '../../components/mode-tabs'
import { useTheme } from '../../hooks/use-theme'
import { MoonIcon, MonitorIcon, SunIcon } from '../../components/icons'
import { downloadText } from '../../export'
import { encodeText, decodeText } from '../../share'

type EntryType = 'same' | 'changed' | 'added' | 'removed'

interface KVEntry {
  key: string
  section: string | null
  leftVal: string | null
  rightVal: string | null
  type: EntryType
  comment?: string
}

interface ParsedFile {
  entries: Map<string, { val: string; section: string | null; comment?: string }>
  order: string[] // full keys in order as `section:key` or `:key`
  sections: Set<string | null>
}

function fullKey(section: string | null, key: string): string {
  return section ? `${section}:${key}` : `:${key}`
}

function parseEnvLike(text: string): ParsedFile {
  const entries = new Map<string, { val: string; section: string | null; comment?: string }>()
  const order: string[] = []
  const sections = new Set<string | null>([null])

  let currentSection: string | null = null
  let pendingComment = ''

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()

    if (!line) { pendingComment = ''; continue }

    // Section header [section]
    const sectionMatch = line.match(/^\[([^\]]+)\]/)
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim()
      sections.add(currentSection)
      pendingComment = ''
      continue
    }

    // Comment line
    if (line.startsWith('#') || line.startsWith(';')) {
      pendingComment = line.slice(1).trim()
      continue
    }

    // Key = value  or  KEY=VALUE
    const eqIdx = line.indexOf('=')
    const colonIdx = line.indexOf(':')
    let sepIdx = -1
    if (eqIdx >= 0 && (colonIdx < 0 || eqIdx <= colonIdx)) sepIdx = eqIdx
    else if (colonIdx >= 0) sepIdx = colonIdx

    if (sepIdx > 0) {
      const key = line.slice(0, sepIdx).trim()
      let val = line.slice(sepIdx + 1).trim()
      // Strip inline comments
      const inlineComment = val.match(/\s+[#;](.*)$/)
      if (inlineComment) val = val.slice(0, val.length - inlineComment[0].length).trim()
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      const fk = fullKey(currentSection, key)
      if (!entries.has(fk)) order.push(fk)
      entries.set(fk, { val, section: currentSection, comment: pendingComment || undefined })
      pendingComment = ''
    }
  }

  return { entries, order, sections }
}

function computeEnvDiff(left: ParsedFile, right: ParsedFile): KVEntry[] {
  const allKeys = new Set([...left.order, ...right.order])
  const result: KVEntry[] = []

  const orderedKeys = [
    ...left.order.filter((k) => allKeys.has(k)),
    ...right.order.filter((k) => !left.order.includes(k)),
  ]

  for (const fk of orderedKeys) {
    const lEntry = left.entries.get(fk)
    const rEntry = right.entries.get(fk)

    const key = fk.includes(':') ? fk.split(':').slice(1).join(':') : fk
    const section = fk.includes(':') && fk.split(':')[0] ? fk.split(':')[0] : null

    if (!lEntry && !rEntry) continue

    const type: EntryType =
      !lEntry ? 'added' :
      !rEntry ? 'removed' :
      lEntry.val === rEntry.val ? 'same' : 'changed'

    result.push({
      key,
      section: lEntry?.section ?? rEntry?.section ?? section,
      leftVal: lEntry?.val ?? null,
      rightVal: rEntry?.val ?? null,
      type,
      comment: lEntry?.comment ?? rEntry?.comment,
    })
  }

  return result
}

const DIFF_BG: Record<EntryType, string> = {
  same: 'transparent',
  changed: 'var(--amber-bg)',
  added: 'var(--green-bg)',
  removed: 'var(--red-bg)',
}

const DIFF_FG: Record<EntryType, string> = {
  same: 'var(--text)',
  changed: 'var(--amber)',
  added: 'var(--green)',
  removed: 'var(--red)',
}

function maskValue(val: string | null): string {
  if (val === null) return ''
  if (val.length <= 4) return '•'.repeat(val.length)
  return val.slice(0, 2) + '•'.repeat(Math.min(val.length - 4, 12)) + val.slice(-2)
}

export function EnvMode() {
  const { mode: themeMode, toggle: toggleTheme } = useTheme()
  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [showOnlyDiff, setShowOnlyDiff] = useState(false)
  const [maskSecrets, setMaskSecrets] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [shareCopied, setShareCopied] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const l = params.get('l'), r = params.get('r')
    ;(async () => {
      if (l) { const t = await decodeText(l); if (t) setLeftText(t) }
      if (r) { const t = await decodeText(r); if (t) setRightText(t) }
    })()
  }, [])

  const { entries, stats } = useMemo(() => {
    if (!leftText.trim() && !rightText.trim()) return { entries: [], stats: { added: 0, removed: 0, changed: 0, same: 0 } }

    const left = parseEnvLike(leftText)
    const right = parseEnvLike(rightText)
    const all = computeEnvDiff(left, right)

    const s = all.reduce((acc, e) => { acc[e.type]++; return acc }, { added: 0, removed: 0, changed: 0, same: 0 })
    return { entries: all, stats: s }
  }, [leftText, rightText])

  const q = searchQuery.toLowerCase().trim()
  const filteredEntries = useMemo(() => {
    let result = entries
    if (showOnlyDiff) result = result.filter((e) => e.type !== 'same')
    if (q) result = result.filter((e) => e.key.toLowerCase().includes(q) || (e.leftVal ?? '').toLowerCase().includes(q) || (e.rightVal ?? '').toLowerCase().includes(q) || (e.section ?? '').toLowerCase().includes(q))
    return result
  }, [entries, showOnlyDiff, q])

  // Group by section
  const grouped = useMemo(() => {
    const map = new Map<string | null, KVEntry[]>()
    for (const e of filteredEntries) {
      const s = e.section
      if (!map.has(s)) map.set(s, [])
      map.get(s)!.push(e)
    }
    return map
  }, [filteredEntries])

  function handleFile(side: 'left' | 'right', file: File) {
    file.text().then((t) => side === 'left' ? setLeftText(t) : setRightText(t))
  }

  function handleDrop(side: 'left' | 'right', e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(side, file)
  }

  async function share() {
    if (!leftText.trim() && !rightText.trim()) return
    const [encL, encR] = await Promise.all([encodeText(leftText), encodeText(rightText)])
    await navigator.clipboard.writeText(`${window.location.origin}/env?l=${encodeURIComponent(encL)}&r=${encodeURIComponent(encR)}`)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  function exportReport() {
    const lines = ['Key,Section,Status,Left Value,Right Value']
    for (const e of entries) {
      const q = (s: string | null) => `"${String(s ?? '').replace(/"/g, '""')}"`
      lines.push(`${q(e.key)},${q(e.section)},${q(e.type)},${q(e.leftVal)},${q(e.rightVal)}`)
    }
    downloadText(lines.join('\n'), 'env-diff.csv', 'text/csv')
  }

  const hasDiff = entries.length > 0

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
                title="Show only changed/added/removed keys"
              >
                Changes only
              </button>
              <button
                className={`btn outlined ${maskSecrets ? 'active' : ''}`}
                onClick={() => setMaskSecrets((v) => !v)}
                title="Mask values (useful for sharing screenshots of secret-containing files)"
              >
                Mask values
              </button>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search keys/values…"
                aria-label="Search keys or values"
                style={{
                  height: 26, padding: '0 8px', fontFamily: 'var(--font-mono)', fontSize: 11.5,
                  color: 'var(--text)', background: 'var(--surface-raised)',
                  border: '1px solid var(--border)', borderRadius: 6, outline: 'none', width: 150,
                }}
              />
              <div className="divider" aria-hidden="true" />
              <button className="btn outlined" onClick={exportReport} title="Export diff as CSV">Export</button>
            </>
          )}
          <button
            className="btn outlined"
            title="Copy shareable link"
            disabled={!leftText.trim() && !rightText.trim()}
            onClick={share}
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
      <div style={{ display: 'flex', height: 160, flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
        {(['left', 'right'] as const).map((side) => (
          <div
            key={side}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: side === 'left' ? '1px solid var(--border)' : 'none' }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(side, e)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface)', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)' }}>
                {side === 'left' ? 'Original' : 'Modified'}
              </span>
              <label className="btn outlined" style={{ fontSize: 11.5, cursor: 'pointer' }}>
                Open file
                <input type="file" accept=".env,.ini,.properties,.cfg,.conf,.toml,.txt" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(side, f) }} />
              </label>
            </div>
            <textarea
              value={side === 'left' ? leftText : rightText}
              onChange={(e) => side === 'left' ? setLeftText(e.target.value) : setRightText(e.target.value)}
              placeholder={`Paste .env, .ini, or key=value content here…\n\n# Example:\nDB_HOST=localhost\nDB_PORT=5432\n\n[section]\nKEY=value`}
              spellCheck={false}
              style={{
                flex: 1, resize: 'none', border: 'none', outline: 'none', padding: '8px 12px',
                fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg)', color: 'var(--text)',
              }}
            />
          </div>
        ))}
      </div>

      {/* Diff table */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {!hasDiff ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, padding: 40 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}>Paste .env or INI content in both panels</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Supports .env, .ini, .properties, TOML (key=value sections)</div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>No entries match the current filters</div>
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr',
              padding: '6px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)',
              fontSize: 10.5, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)',
              position: 'sticky', top: 0, zIndex: 1,
            }}>
              <div />
              <div>Key</div>
              <div>Original value</div>
              <div>Modified value</div>
            </div>

            {[...grouped.entries()].map(([section, sectionEntries]) => (
              <div key={section ?? '__root__'}>
                {section && (
                  <div style={{
                    padding: '6px 16px', background: 'var(--surface-raised)',
                    borderBottom: '1px solid var(--border)',
                    fontSize: 11, fontWeight: 650, color: 'var(--accent)',
                    fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
                  }}>
                    [{section}]
                  </div>
                )}
                {sectionEntries.map((entry) => {
                  const bg = DIFF_BG[entry.type]
                  const fg = DIFF_FG[entry.type]
                  const lv = maskSecrets && entry.leftVal !== null ? maskValue(entry.leftVal) : entry.leftVal
                  const rv = maskSecrets && entry.rightVal !== null ? maskValue(entry.rightVal) : entry.rightVal
                  return (
                    <div
                      key={`${entry.section}:${entry.key}`}
                      style={{
                        display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1fr',
                        background: bg, borderBottom: '1px solid var(--border-subtle)',
                        minHeight: 32, alignItems: 'center',
                      }}
                    >
                      {/* Status indicator */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {entry.type === 'added' && <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700 }}>+</span>}
                        {entry.type === 'removed' && <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700 }}>−</span>}
                        {entry.type === 'changed' && <span style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 700 }}>≠</span>}
                        {entry.type === 'same' && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>=</span>}
                      </div>

                      {/* Key */}
                      <div
                        style={{
                          padding: '4px 12px', fontFamily: 'var(--font-mono)', fontSize: 12,
                          color: entry.type === 'same' ? 'var(--text-secondary)' : fg,
                          fontWeight: entry.type !== 'same' ? 600 : 400,
                          cursor: 'copy', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                        title={`${entry.section ? `[${entry.section}] ` : ''}${entry.key}${entry.comment ? ` — ${entry.comment}` : ''} — click to copy key`}
                        onClick={() => navigator.clipboard.writeText(entry.key)}
                      >
                        {entry.key}
                      </div>

                      {/* Left value */}
                      <div
                        style={{
                          padding: '4px 12px', fontFamily: 'var(--font-mono)', fontSize: 12,
                          color: entry.type === 'removed' || entry.type === 'changed' ? 'var(--red)' : 'var(--text-secondary)',
                          textDecoration: entry.type === 'changed' ? 'line-through' : 'none',
                          opacity: entry.type === 'changed' ? 0.7 : 1,
                          cursor: lv ? 'copy' : 'default',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                        title={lv ? `Click to copy: ${lv}` : undefined}
                        onClick={() => lv && navigator.clipboard.writeText(entry.leftVal!)}
                      >
                        {lv ?? <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>—</span>}
                      </div>

                      {/* Right value */}
                      <div
                        style={{
                          padding: '4px 12px', fontFamily: 'var(--font-mono)', fontSize: 12,
                          color: entry.type === 'added' ? 'var(--green)' : entry.type === 'changed' ? 'var(--amber)' : 'var(--text-secondary)',
                          cursor: rv ? 'copy' : 'default',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                        title={rv ? `Click to copy: ${rv}` : undefined}
                        onClick={() => rv && navigator.clipboard.writeText(entry.rightVal!)}
                      >
                        {rv ?? <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>—</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="status-bar">
        <div style={{ display: 'flex', gap: 16 }}>
          {stats.added > 0 && <span className="stat-green">+{stats.added} added</span>}
          {stats.removed > 0 && <span className="stat-red">−{stats.removed} removed</span>}
          {stats.changed > 0 && <span style={{ color: 'var(--amber)' }}>{stats.changed} changed</span>}
          {stats.same > 0 && <span>{stats.same} same</span>}
          {!hasDiff && <span>No data</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {hasDiff ? `${entries.length} keys` : ''}
          {searchQuery && hasDiff ? ` · ${filteredEntries.length} shown` : ''}
        </div>
      </div>
    </div>
  )
}
