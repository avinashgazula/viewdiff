import { memo } from 'react'
import { formatKeybinding } from '../config'

export const EmptyState = memo(function EmptyState() {
  const fk = formatKeybinding

  return (
    <div className="empty-state" role="status" aria-label="Editor is empty">
      <h2 className="empty-state-title">Paste or type to compare</h2>
      <p className="empty-state-hint">
        Original on the left, modified on the right.
        <br />
        Press <kbd>{fk('Ctrl')}+K</kbd> for all commands.
      </p>
    </div>
  )
})
