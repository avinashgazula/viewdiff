import { memo } from 'react'

interface Props {
  inline: boolean
}

export const ColumnLabels = memo(function ColumnLabels({ inline }: Props) {
  return (
    <div className="column-labels" role="presentation" aria-hidden="true">
      <div style={!inline ? { borderRight: '1px solid var(--border)' } : undefined}>Original</div>
      {!inline && <div>Modified</div>}
    </div>
  )
})
