import { useEffect, useRef, useState } from 'react'

export function GoToLine({
  onClose,
  onGo,
  maxLine,
}: {
  onClose: () => void
  onGo: (line: number) => void
  maxLine: number
}) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
    }
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  function commit() {
    const n = parseInt(value, 10)
    if (!Number.isNaN(n) && n >= 1) onGo(n)
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 80,
        background: 'rgba(0,0,0,0.25)',
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-label="Go to line"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          minWidth: 280,
        }}
      >
        <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          Go to line
        </span>
        <input
          ref={inputRef}
          type="number"
          min={1}
          max={maxLine}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`1 – ${maxLine}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
          }}
          style={{
            flex: 1,
            height: 28,
            padding: '0 8px',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: 'var(--text)',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 5,
            outline: 'none',
          }}
        />
        <button className="btn outlined" style={{ fontSize: 12, height: 28, padding: '0 10px' }} onClick={commit}>
          Go
        </button>
      </div>
    </div>
  )
}
