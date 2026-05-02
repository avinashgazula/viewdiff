import { memo, useRef } from 'react'
import { UploadIcon } from './icons'

interface Props {
  inline: boolean
  onLoadOriginal?: (text: string, filename: string) => void
  onLoadModified?: (text: string, filename: string) => void
}

function FileLoadButton({ onLoad, label }: { onLoad: (text: string, filename: string) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        type="file"
        ref={ref}
        style={{ display: 'none' }}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) file.text().then((t) => onLoad(t, file.name))
          e.target.value = ''
        }}
      />
      <button
        className="btn icon"
        style={{ width: 20, height: 20, opacity: 0.55 }}
        aria-label={`Load file into ${label}`}
        title={`Load file into ${label}`}
        onClick={() => ref.current?.click()}
      >
        <UploadIcon />
      </button>
    </>
  )
}

export const ColumnLabels = memo(function ColumnLabels({ inline, onLoadOriginal, onLoadModified }: Props) {
  return (
    <div className="column-labels" role="presentation">
      <div style={!inline ? { borderRight: '1px solid var(--border)' } : undefined}>
        <span aria-hidden="true">Original</span>
        {onLoadOriginal && <FileLoadButton onLoad={onLoadOriginal} label="Original" />}
      </div>
      {!inline && (
        <div>
          <span aria-hidden="true">Modified</span>
          {onLoadModified && <FileLoadButton onLoad={onLoadModified} label="Modified" />}
        </div>
      )}
    </div>
  )
})
