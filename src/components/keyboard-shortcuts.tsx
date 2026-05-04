import { useEffect, useRef } from 'react'

interface ShortcutEntry {
  keys: string
  label: string
}

interface ShortcutGroup {
  title: string
  items: ShortcutEntry[]
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'General',
    items: [
      { keys: 'Ctrl+K', label: 'Open command palette' },
      { keys: 'Ctrl+,', label: 'Open settings' },
      { keys: 'Ctrl+?', label: 'Keyboard shortcuts' },
      { keys: 'Ctrl+G', label: 'Go to line' },
      { keys: 'Ctrl+J', label: 'Cycle theme' },
      { keys: 'Alt+1–0', label: 'Navigate modes (Text/Table/JSON/XML/ENV/Image/Git/Hex/Folder/3-Way)' },
    ],
  },
  {
    title: 'Diff navigation',
    items: [
      { keys: 'F7', label: 'Next difference' },
      { keys: 'Shift+F7', label: 'Previous difference' },
      { keys: 'Ctrl+Alt+←', label: 'Accept hunk from original' },
      { keys: 'Ctrl+Alt+→', label: 'Accept hunk from modified' },
    ],
  },
  {
    title: 'Editor',
    items: [
      { keys: 'Ctrl+Shift+F', label: 'Format document' },
      { keys: 'Ctrl+Shift+S', label: 'Swap original ↔ modified' },
      { keys: 'Ctrl+Shift+X', label: 'Clear both editors' },
      { keys: 'Ctrl+1', label: 'Focus original editor' },
      { keys: 'Ctrl+2', label: 'Focus modified editor' },
      { keys: 'Alt+Z', label: 'Toggle word wrap' },
      { keys: 'Ctrl+\\', label: 'Toggle inline / side-by-side' },
    ],
  },
  {
    title: 'Export',
    items: [
      { keys: 'Ctrl+E', label: 'Export as .patch file' },
      { keys: 'Ctrl+Shift+E', label: 'Export as HTML diff' },
      { keys: 'Ctrl+P', label: 'Print diff' },
    ],
  },
  {
    title: 'Three-way merge',
    items: [
      { keys: 'Ctrl+Alt+↓', label: 'Next conflict' },
      { keys: 'Ctrl+Alt+↑', label: 'Previous conflict' },
      { keys: 'Ctrl+Shift+L', label: 'Accept left at cursor' },
      { keys: 'Ctrl+Shift+R', label: 'Accept right at cursor' },
    ],
  },
  {
    title: 'Image mode',
    items: [
      { keys: 'Scroll wheel', label: 'Zoom in / out' },
      { keys: '+  /  −', label: 'Zoom in / out (keyboard)' },
      { keys: '0', label: 'Fit to view (50%)' },
      { keys: '1', label: 'Reset to 100%' },
      { keys: '2', label: 'Zoom to 200%' },
    ],
  },
  {
    title: 'Hex mode',
    items: [
      { keys: 'F7 / Shift+F7', label: 'Next / previous diff region' },
      { keys: 'Enter (offset box)', label: 'Jump to hex offset' },
      { keys: 'Enter (find box)', label: 'Find bytes / text' },
    ],
  },
]

export function KeyboardShortcuts({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        ref={ref}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          width: 580,
          maxWidth: '92vw',
          maxHeight: '82vh',
          overflow: 'auto',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          background: 'var(--surface)',
          zIndex: 1,
        }}>
          <span style={{ fontSize: 14, fontWeight: 650, color: 'var(--text)' }}>Keyboard Shortcuts</span>
          <button
            className="btn icon"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            style={{ fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 28px' }}>
          {GROUPS.map((group) => (
            <div key={group.title}>
              <div style={{
                fontSize: 10.5, fontWeight: 650,
                textTransform: 'uppercase', letterSpacing: '0.07em',
                color: 'var(--text-dim)', marginBottom: 10,
              }}>
                {group.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {group.items.map((item) => (
                  <div key={item.keys} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{item.label}</span>
                    <kbd style={{
                      fontSize: 10.5,
                      fontFamily: 'var(--font-mono)',
                      padding: '2px 6px',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      color: 'var(--text-secondary)',
                    }}>
                      {item.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
