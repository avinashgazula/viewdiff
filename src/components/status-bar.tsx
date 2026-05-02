import { memo } from 'react'
import { formatKeybinding } from '../config'
import type { DiffStats } from '../diff'

interface EOLInfo {
  orig: string | null
  mod: string | null
}

interface Props {
  stats: DiffStats
  eolInfo?: EOLInfo
}

function DiffBar({ additions, deletions }: { additions: number; deletions: number }) {
  const total = additions + deletions
  if (total === 0) return null
  const addPct = Math.round((additions / total) * 100)
  const delPct = 100 - addPct
  return (
    <div className="diff-bar" aria-hidden="true" title={`+${additions} / -${deletions}`}>
      <div className="diff-bar-add" style={{ width: `${addPct}%` }} />
      <div className="diff-bar-del" style={{ width: `${delPct}%` }} />
    </div>
  )
}

function EOLBadge({ orig, mod }: EOLInfo) {
  if (!orig && !mod) return null
  // Only show when noteworthy: non-LF endings or mismatch between sides
  const showOrig = orig && orig !== 'LF'
  const showMod = mod && mod !== 'LF'
  const mismatch = orig && mod && orig !== mod

  if (!showOrig && !showMod && !mismatch) return null

  return (
    <span
      style={{ fontSize: 10.5, color: mismatch ? 'var(--amber)' : 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}
      title={`Line endings — Original: ${orig ?? '?'}  Modified: ${mod ?? '?'}${mismatch ? '  (mismatch)' : ''}`}
    >
      {orig === mod ? orig : `${orig ?? '?'} / ${mod ?? '?'}`}
    </span>
  )
}

export const StatusBar = memo(function StatusBar({ stats, eolInfo }: Props) {
  const fk = formatKeybinding

  return (
    <div className="status-bar" role="status" aria-live="polite" aria-atomic="true">
      <div className="flex items-center gap-3">
        {stats.changes > 0 ? (
          <>
            <span>{stats.changes} change{stats.changes !== 1 ? 's' : ''}</span>
            <span className="stat-green" aria-label={`${stats.additions} additions`}>+{stats.additions}</span>
            <span className="stat-red" aria-label={`${stats.deletions} deletions`}>&minus;{stats.deletions}</span>
            <DiffBar additions={stats.additions} deletions={stats.deletions} />
          </>
        ) : (
          <span style={{ color: 'var(--text-dim)' }}>No differences</span>
        )}
        {eolInfo && <EOLBadge orig={eolInfo.orig} mod={eolInfo.mod} />}
      </div>
      <div className="flex items-center gap-1.5" style={{ color: 'var(--text-dim)' }}>
        <kbd>{fk('Ctrl')}+K</kbd>
        <span className="text-[11px]">commands</span>
      </div>
    </div>
  )
})
