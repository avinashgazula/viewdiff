import { memo } from 'react'
import { formatKeybinding } from '../config'
import type { DiffStats } from '../diff'

interface Props {
  stats: DiffStats
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
