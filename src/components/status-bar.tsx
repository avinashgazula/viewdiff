import { memo } from 'react'
import { formatKeybinding } from '../config'
import type { DiffStats } from '../diff'

interface Props {
  stats: DiffStats
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

export const StatusBar = memo(function StatusBar({ stats }: Props) {
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
      </div>
      <div className="flex items-center gap-1.5" style={{ color: 'var(--text-dim)' }}>
        <kbd>{fk('Ctrl')}+K</kbd>
        <span className="text-[11px]">commands</span>
      </div>
    </div>
  )
})
