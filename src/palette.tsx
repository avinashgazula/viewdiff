import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { formatKeybinding } from './config'

export interface Command {
  id: string
  label: string
  shortcut?: string
  action: () => void
}

interface Props {
  commands: Command[]
  onClose: () => void
}

export function CommandPalette({ commands, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    if (!query) return commands
    const q = query.toLowerCase()
    return commands.filter((c) => c.label.toLowerCase().includes(q))
  }, [query, commands])

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { setSelected(0) }, [query])

  // Keep selected item scrolled into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const item = list.children[selected] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const run = useCallback((cmd: Command) => {
    cmd.action()
    onClose()
  }, [onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        onClose()
        break
      case 'ArrowDown':
        e.preventDefault()
        setSelected((i) => Math.min(i + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelected((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        if (results[selected]) run(results[selected])
        break
    }
  }, [results, selected, run, onClose])

  return (
    <div className="palette-overlay" onMouseDown={onClose} role="presentation">
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Search commands..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={results[selected] ? `palette-${results[selected].id}` : undefined}
          aria-autocomplete="list"
        />
        <div className="palette-list" ref={listRef} id="palette-results" role="listbox" aria-label="Commands">
          {results.map((cmd, i) => (
            <div
              key={cmd.id}
              id={`palette-${cmd.id}`}
              className={`palette-item ${i === selected ? 'selected' : ''}`}
              role="option"
              aria-selected={i === selected}
              onMouseEnter={() => setSelected(i)}
              onClick={() => run(cmd)}
            >
              <span>{cmd.label}</span>
              {cmd.shortcut && (
                <span className="palette-item-shortcut" aria-label={`Shortcut: ${cmd.shortcut}`}>
                  {cmd.shortcut.split('+').map((key, j) => (
                    <kbd key={j}>{formatKeybinding(key)}</kbd>
                  ))}
                </span>
              )}
            </div>
          ))}
          {results.length === 0 && (
            <div className="palette-empty" role="status">No matching commands</div>
          )}
        </div>
      </div>
    </div>
  )
}
