import { memo } from 'react'
import { formatKeybinding, languages } from '../config'
import { canFormat } from '../diff'
import { MoonIcon, SearchIcon, SettingsIcon, SunIcon, SwapIcon, WrapIcon } from './icons'

interface Props {
  language: string
  detectedLang: string
  effectiveLang: string
  inline: boolean
  wordWrap: boolean
  formatting: boolean
  dark: boolean
  onChangeLang: (id: string) => void
  onFormat: () => void
  onSwap: () => void
  onToggleView: () => void
  onToggleWrap: () => void
  onClear: () => void
  onOpenPalette: () => void
  onToggleSettings: () => void
  onToggleTheme: () => void
  settingsOpen: boolean
}

export const Toolbar = memo(function Toolbar({
  language, detectedLang, effectiveLang, inline, wordWrap, formatting, dark,
  onChangeLang, onFormat, onSwap, onToggleView, onToggleWrap, onClear, onOpenPalette, onToggleSettings, onToggleTheme, settingsOpen,
}: Props) {
  const fk = formatKeybinding
  const langLabel = languages.find((l) => l.id === detectedLang)?.label ?? detectedLang

  return (
    <nav
      aria-label="Diff tools"
      className="flex items-center justify-between px-3 h-[46px] shrink-0"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3">
        <h1 className="text-[14px] tracking-[-0.03em] m-0" style={{ fontWeight: 700 }}>diff</h1>
        <span className="text-[12.5px]" style={{ color: 'var(--text-dim)', fontWeight: 450 }}>
          compare anything
        </span>
      </div>

      <div className="flex items-center gap-1" role="toolbar" aria-label="Editor controls">
        <label htmlFor="lang-select" className="sr-only">Language</label>
        <select
          id="lang-select"
          value={language}
          onChange={(e) => onChangeLang(e.target.value)}
          className="lang-select"
          aria-label="Select language"
        >
          <option value="auto">
            Auto{language === 'auto' && detectedLang !== 'plaintext' ? ` · ${langLabel}` : ''}
          </option>
          {languages.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>

        <button
          onClick={onFormat}
          disabled={formatting || !canFormat(effectiveLang)}
          className="btn outlined"
          aria-label={formatting ? 'Formatting in progress' : 'Format code'}
          title={`Format (${fk('Ctrl')}+${fk('Shift')}+F)`}
        >
          {formatting ? 'Formatting...' : 'Format'}
        </button>

        <div className="divider" aria-hidden="true" />

        <button onClick={onSwap} className="btn icon" aria-label="Swap original and modified" title={`Swap (${fk('Ctrl')}+${fk('Shift')}+S)`}>
          <SwapIcon />
        </button>
        <button
          onClick={onToggleView}
          className={`btn ${inline ? 'active' : ''}`}
          aria-pressed={inline}
          title={`Toggle view (${fk('Ctrl')}+\\)`}
        >
          {inline ? 'Inline' : 'Side by side'}
        </button>
        <button
          onClick={onToggleWrap}
          className={`btn icon ${wordWrap ? 'active' : ''}`}
          aria-label={wordWrap ? 'Disable word wrap' : 'Enable word wrap'}
          aria-pressed={wordWrap}
          title={`Word wrap (${fk('Alt')}+Z)`}
        >
          <WrapIcon />
        </button>
        <button onClick={onClear} className="btn" aria-label="Clear both editors" title={`Clear (${fk('Ctrl')}+${fk('Shift')}+X)`}>
          Clear
        </button>

        <div className="divider" aria-hidden="true" />

        <button onClick={onOpenPalette} className="btn icon" aria-label="Open command palette" title={`Commands (${fk('Ctrl')}+K)`}>
          <SearchIcon />
        </button>
        <button
          onClick={onToggleSettings}
          className={`btn icon ${settingsOpen ? 'active' : ''}`}
          aria-label="Editor settings"
          aria-pressed={settingsOpen}
          title={`Settings (${fk('Ctrl')}+,)`}
        >
          <SettingsIcon />
        </button>
        <button
          onClick={onToggleTheme}
          className="btn icon"
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          title={`Theme (${fk('Ctrl')}+J)`}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </nav>
  )
})
