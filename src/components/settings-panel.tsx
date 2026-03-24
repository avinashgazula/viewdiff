import { useEffect, useRef } from 'react'
import type { Settings } from '../hooks/use-settings'

interface Props {
  settings: Settings
  onUpdate: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  onReset: () => void
  onClose: () => void
}

interface SelectOption<T> {
  value: T
  label: string
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <span className="settings-label">{label}</span>
      <div className="settings-control">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      className={`settings-toggle ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
    >
      <span className="settings-toggle-thumb" />
    </button>
  )
}

function Select<T extends string | number>({ value, options, onChange }: {
  value: T
  options: SelectOption<T>[]
  onChange: (v: T) => void
}) {
  return (
    <select
      className="settings-select"
      value={value}
      onChange={(e) => {
        const raw = e.target.value
        const cast = typeof value === 'number' ? Number(raw) as T : raw as T
        onChange(cast)
      }}
    >
      {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
    </select>
  )
}

export function SettingsPanel({ settings, onUpdate, onReset, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return (
    <div className="settings-panel" ref={panelRef} role="dialog" aria-modal="false" aria-label="Editor settings">
      <div className="settings-header">
        <span className="settings-title">Settings</span>
        <button className="settings-reset" onClick={onReset}>Reset</button>
      </div>

      <div className="settings-body">
        <div className="settings-section">
          <div className="settings-section-title">Comparison</div>

          <SettingRow label="Ignore case">
            <Toggle checked={settings.ignoreCase} onChange={(v) => onUpdate('ignoreCase', v)} />
          </SettingRow>

          <SettingRow label="Ignore whitespace">
            <Toggle checked={settings.ignoreWhitespace} onChange={(v) => onUpdate('ignoreWhitespace', v)} />
          </SettingRow>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Editor</div>

          <SettingRow label="Font size">
            <Select value={settings.fontSize} onChange={(v) => onUpdate('fontSize', v)} options={[
              { value: 11, label: '11' }, { value: 12, label: '12' }, { value: 13, label: '13' },
              { value: 14, label: '14' }, { value: 15, label: '15' }, { value: 16, label: '16' },
              { value: 18, label: '18' }, { value: 20, label: '20' }, { value: 24, label: '24' },
            ]} />
          </SettingRow>

          <SettingRow label="Line height">
            <Select value={settings.lineHeight} onChange={(v) => onUpdate('lineHeight', v)} options={[
              { value: 18, label: '18' }, { value: 20, label: '20' }, { value: 21, label: '21' },
              { value: 22, label: '22' }, { value: 24, label: '24' }, { value: 28, label: '28' },
            ]} />
          </SettingRow>

          <SettingRow label="Tab size">
            <Select value={settings.tabSize} onChange={(v) => onUpdate('tabSize', v)} options={[
              { value: 2, label: '2' }, { value: 4, label: '4' }, { value: 8, label: '8' },
            ]} />
          </SettingRow>

          <SettingRow label="Cursor style">
            <Select value={settings.cursorStyle} onChange={(v) => onUpdate('cursorStyle', v)} options={[
              { value: 'line', label: 'Line' }, { value: 'block', label: 'Block' }, { value: 'underline', label: 'Underline' },
            ]} />
          </SettingRow>

          <SettingRow label="Cursor animation">
            <Select value={settings.cursorBlinking} onChange={(v) => onUpdate('cursorBlinking', v)} options={[
              { value: 'blink', label: 'Blink' }, { value: 'smooth', label: 'Smooth' },
              { value: 'phase', label: 'Phase' }, { value: 'expand', label: 'Expand' }, { value: 'solid', label: 'Solid' },
            ]} />
          </SettingRow>

          <SettingRow label="Line numbers">
            <Select value={settings.lineNumbers} onChange={(v) => onUpdate('lineNumbers', v)} options={[
              { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }, { value: 'relative', label: 'Relative' },
            ]} />
          </SettingRow>

          <SettingRow label="Whitespace">
            <Select value={settings.renderWhitespace} onChange={(v) => onUpdate('renderWhitespace', v)} options={[
              { value: 'none', label: 'None' }, { value: 'boundary', label: 'Boundary' },
              { value: 'selection', label: 'Selection' }, { value: 'trailing', label: 'Trailing' }, { value: 'all', label: 'All' },
            ]} />
          </SettingRow>

          <SettingRow label="Line highlight">
            <Select value={settings.renderLineHighlight} onChange={(v) => onUpdate('renderLineHighlight', v)} options={[
              { value: 'none', label: 'None' }, { value: 'gutter', label: 'Gutter' },
              { value: 'line', label: 'Line' }, { value: 'all', label: 'All' },
            ]} />
          </SettingRow>

          <SettingRow label="Bracket matching">
            <Select value={settings.matchBrackets} onChange={(v) => onUpdate('matchBrackets', v)} options={[
              { value: 'always', label: 'Always' }, { value: 'near', label: 'Near cursor' }, { value: 'never', label: 'Never' },
            ]} />
          </SettingRow>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Features</div>

          <SettingRow label="Minimap">
            <Toggle checked={settings.minimap} onChange={(v) => onUpdate('minimap', v)} />
          </SettingRow>

          <SettingRow label="Code folding">
            <Toggle checked={settings.folding} onChange={(v) => onUpdate('folding', v)} />
          </SettingRow>

          <SettingRow label="Bracket colors">
            <Toggle checked={settings.bracketColors} onChange={(v) => onUpdate('bracketColors', v)} />
          </SettingRow>

          <SettingRow label="Indent guides">
            <Toggle checked={settings.indentGuides} onChange={(v) => onUpdate('indentGuides', v)} />
          </SettingRow>

          <SettingRow label="Autocomplete">
            <Toggle checked={settings.autocomplete} onChange={(v) => onUpdate('autocomplete', v)} />
          </SettingRow>

          <SettingRow label="Smooth scrolling">
            <Toggle checked={settings.smoothScrolling} onChange={(v) => onUpdate('smoothScrolling', v)} />
          </SettingRow>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Formatting</div>

          <SettingRow label="Print width">
            <Select value={settings.printWidth} onChange={(v) => onUpdate('printWidth', v)} options={[
              { value: 60, label: '60' }, { value: 80, label: '80' }, { value: 100, label: '100' },
              { value: 120, label: '120' }, { value: 140, label: '140' },
            ]} />
          </SettingRow>
        </div>
      </div>
    </div>
  )
}
