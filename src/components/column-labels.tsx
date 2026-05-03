import { memo, useRef, useState } from 'react'
import { UploadIcon } from './icons'

interface Props {
  inline: boolean
  onLoadOriginal?: (text: string, filename: string) => void
  onLoadModified?: (text: string, filename: string) => void
  onCopyOriginal?: () => void
  onCopyModified?: () => void
  onPasteOriginal?: () => void
  onPasteModified?: () => void
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

function CopyButton({ onCopy, label }: { onCopy: () => void; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="btn icon"
      style={{ width: 20, height: 20, opacity: 0.55, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
      aria-label={`Copy ${label} to clipboard`}
      title={`Copy ${label} to clipboard`}
      onClick={() => {
        onCopy()
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? '✓' : '⎘'}
    </button>
  )
}

function PasteButton({ onPaste, label }: { onPaste: () => void; label: string }) {
  return (
    <button
      className="btn icon"
      style={{ width: 20, height: 20, opacity: 0.55, fontSize: 11 }}
      aria-label={`Paste clipboard into ${label}`}
      title={`Paste clipboard into ${label}`}
      onClick={onPaste}
    >
      ⎙
    </button>
  )
}

export const ColumnLabels = memo(function ColumnLabels({ inline, onLoadOriginal, onLoadModified, onCopyOriginal, onCopyModified, onPasteOriginal, onPasteModified }: Props) {
  return (
    <div className="column-labels" role="presentation">
      <div style={!inline ? { borderRight: '1px solid var(--border)' } : undefined}>
        <span aria-hidden="true">Original</span>
        {onCopyOriginal && <CopyButton onCopy={onCopyOriginal} label="Original" />}
        {onPasteOriginal && <PasteButton onPaste={onPasteOriginal} label="Original" />}
        {onLoadOriginal && <FileLoadButton onLoad={onLoadOriginal} label="Original" />}
      </div>
      {!inline && (
        <div>
          <span aria-hidden="true">Modified</span>
          {onCopyModified && <CopyButton onCopy={onCopyModified} label="Modified" />}
          {onPasteModified && <PasteButton onPaste={onPasteModified} label="Modified" />}
          {onLoadModified && <FileLoadButton onLoad={onLoadModified} label="Modified" />}
        </div>
      )}
    </div>
  )
})
