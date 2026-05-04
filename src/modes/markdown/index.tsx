import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import { ModeTabs } from '../../components/mode-tabs'
import { useTheme } from '../../hooks/use-theme'
import { MoonIcon, MonitorIcon, SunIcon } from '../../components/icons'
import { registerThemes } from '../../themes'
import { encodeDiff, encodeText, decodeText } from '../../share'
import { downloadText } from '../../export'
import type { editor } from 'monaco-editor'
import type { Monaco } from '@monaco-editor/react'

const LazyDiffEditor = lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.DiffEditor }))
)

marked.setOptions({ breaks: true, gfm: true })

function renderMarkdown(text: string): string {
  try {
    return marked(text) as string
  } catch {
    return `<pre>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`
  }
}

function MarkdownPreviewPane({ html, label, dark }: { html: string; label: string; dark: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return

    const theme = dark
      ? `body { background: #1e1e1e; color: #d4d4d4; font-family: system-ui, sans-serif; padding: 20px 28px; line-height: 1.65; font-size: 14px; }
         h1,h2,h3,h4,h5,h6 { color: #e8e8e8; margin: 1.2em 0 0.5em; }
         a { color: #569cd6; }
         code { background: #2d2d2d; padding: 2px 5px; border-radius: 3px; font-size: 0.875em; }
         pre { background: #2d2d2d; padding: 12px 16px; border-radius: 6px; overflow-x: auto; }
         pre code { background: none; padding: 0; }
         blockquote { border-left: 3px solid #555; margin: 0; padding-left: 16px; color: #999; }
         table { border-collapse: collapse; width: 100%; }
         th, td { border: 1px solid #444; padding: 6px 12px; }
         th { background: #2d2d2d; }
         img { max-width: 100%; }`
      : `body { background: #fff; color: #24292e; font-family: system-ui, sans-serif; padding: 20px 28px; line-height: 1.65; font-size: 14px; }
         h1,h2,h3,h4,h5,h6 { color: #1a1a1a; margin: 1.2em 0 0.5em; }
         a { color: #0969da; }
         code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; font-size: 0.875em; }
         pre { background: #f6f8fa; padding: 12px 16px; border-radius: 6px; overflow-x: auto; }
         pre code { background: none; padding: 0; }
         blockquote { border-left: 3px solid #d0d7de; margin: 0; padding-left: 16px; color: #6e7781; }
         table { border-collapse: collapse; width: 100%; }
         th, td { border: 1px solid #d0d7de; padding: 6px 12px; }
         th { background: #f6f8fa; }
         img { max-width: 100%; }`

    doc.open()
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${theme}</style></head><body>${html}</body></html>`)
    doc.close()
  }, [html, dark])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid var(--border)' }}>
      <div style={{
        padding: '4px 14px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', fontSize: 11,
        fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.06em',
        color: 'var(--text-dim)', flexShrink: 0,
      }}>
        {label}
      </div>
      <iframe
        ref={iframeRef}
        title={label}
        sandbox="allow-same-origin"
        style={{ flex: 1, border: 'none', background: dark ? '#1e1e1e' : '#fff' }}
      />
    </div>
  )
}

export function MarkdownMode() {
  const { dark, mode: themeMode, toggle: toggleTheme } = useTheme()
  const [leftText, setLeftText] = useState('')
  const [rightText, setRightText] = useState('')
  const [viewMode, setViewMode] = useState<'source' | 'preview'>('source')
  const [shareCopied, setShareCopied] = useState(false)
  const editorTheme = dark ? 'diff-dark' : 'diff-light'
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null)
  const [editorReady, setEditorReady] = useState(false)

  // Load from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const l = params.get('l'), r = params.get('r')
    ;(async () => {
      if (l) { const t = await decodeText(l); if (t) setLeftText(t) }
      if (r) { const t = await decodeText(r); if (t) setRightText(t) }
    })()
  }, [])

  const onBeforeMount = useCallback((monaco: Monaco) => registerThemes(monaco), [])

  const onMount = useCallback((de: editor.IStandaloneDiffEditor, _monaco: Monaco) => {
    diffEditorRef.current = de
    const orig = de.getOriginalEditor()
    const mod = de.getModifiedEditor()
    orig.onDidChangeModelContent(() => setLeftText(orig.getValue()))
    mod.onDidChangeModelContent(() => setRightText(mod.getValue()))
    requestAnimationFrame(() => requestAnimationFrame(() => setEditorReady(true)))
  }, [])

  const diffOptions = useMemo((): editor.IDiffEditorConstructionOptions => ({
    originalEditable: true,
    fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
    fontSize: 13,
    fontLigatures: false,
    scrollBeyondLastLine: false,
    padding: { top: 12, bottom: 12 },
    automaticLayout: true,
    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6, useShadows: false },
    overviewRulerBorder: false,
    renderOverviewRuler: false,
    glyphMargin: false,
    lineNumbersMinChars: 3,
    renderSideBySide: true,
    wordWrap: 'on',
  }), [])

  const share = useCallback(async () => {
    if (!leftText.trim() && !rightText.trim()) return
    const [encL, encR] = await Promise.all([encodeText(leftText), encodeText(rightText)])
    const url = `${window.location.origin}/markdown?l=${encodeURIComponent(encL)}&r=${encodeURIComponent(encR)}`
    await navigator.clipboard.writeText(url)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }, [leftText, rightText])

  const exportHtml = useCallback(() => {
    if (!leftText.trim() && !rightText.trim()) return
    const leftHtml = renderMarkdown(leftText)
    const rightHtml = renderMarkdown(rightText)
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Markdown Diff</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; background: #f9f9f9; }
  .panes { display: grid; grid-template-columns: 1fr 1fr; height: 100vh; }
  .pane { overflow: auto; padding: 20px 28px; background: white; }
  .pane:first-child { border-right: 2px solid #e0e0e0; }
  h1,h2,h3 { margin: 1em 0 0.4em; }
  code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; }
  pre { background: #f6f8fa; padding: 12px; border-radius: 6px; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #d0d7de; margin: 0; padding-left: 16px; color: #6e7781; }
  table { border-collapse: collapse; } th, td { border: 1px solid #d0d7de; padding: 6px 12px; }
  .label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e0e0e0; }
</style>
</head>
<body>
<div class="panes">
  <div class="pane"><div class="label">Original</div>${leftHtml}</div>
  <div class="pane"><div class="label">Modified</div>${rightHtml}</div>
</div>
</body>
</html>`
    downloadText(html, 'markdown-preview.html', 'text/html')
  }, [leftText, rightText])

  const leftHtml = useMemo(() => renderMarkdown(leftText), [leftText])
  const rightHtml = useMemo(() => renderMarkdown(rightText), [rightText])
  const hasContent = leftText.trim().length > 0 || rightText.trim().length > 0

  function handleFile(side: 'left' | 'right', file: File) {
    file.text().then((text) => {
      if (side === 'left') {
        setLeftText(text)
        diffEditorRef.current?.getOriginalEditor().setValue(text)
      } else {
        setRightText(text)
        diffEditorRef.current?.getModifiedEditor().setValue(text)
      }
    })
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <nav className="toolbar" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div className="toolbar-brand">
          <a href="/" className="toolbar-title-link" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1 className="toolbar-title">diff</h1>
          </a>
          <span className="toolbar-subtitle">compare anything</span>
        </div>
        <div className="toolbar-controls">
          <button
            className={`btn outlined ${viewMode === 'source' ? 'active' : ''}`}
            onClick={() => setViewMode('source')}
            title="Source diff view"
          >
            Source
          </button>
          <button
            className={`btn outlined ${viewMode === 'preview' ? 'active' : ''}`}
            onClick={() => setViewMode('preview')}
            title="Rendered preview"
          >
            Preview
          </button>
          <div className="divider" aria-hidden="true" />
          {(['left', 'right'] as const).map((side) => (
            <label key={side} className="btn outlined" style={{ cursor: 'pointer', fontSize: 12 }}>
              Open {side === 'left' ? 'original' : 'modified'}
              <input
                type="file"
                accept=".md,.txt,.markdown"
                style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(side, f) }}
              />
            </label>
          ))}
          {hasContent && (
            <>
              <button className="btn outlined" onClick={exportHtml} title="Export rendered HTML diff">
                Export HTML
              </button>
              <button className="btn outlined" onClick={share} title="Copy shareable link">
                {shareCopied ? 'Copied!' : 'Share'}
              </button>
            </>
          )}
          <div className="divider" aria-hidden="true" />
          <button onClick={toggleTheme} className="btn icon">
            {themeMode === 'system' ? <MonitorIcon /> : themeMode === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </nav>

      <ModeTabs />

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {viewMode === 'source' ? (
          <div style={{ flex: 1, opacity: editorReady ? 1 : 0, transition: 'opacity 0.1s' }}>
            <Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
                Loading editor...
              </div>
            }>
              <LazyDiffEditor
                original={leftText}
                modified={rightText}
                language="markdown"
                theme={editorTheme}
                beforeMount={onBeforeMount}
                onMount={onMount}
                options={diffOptions}
              />
            </Suspense>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {!hasContent ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}>No content to preview</div>
                <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Switch to Source view and paste markdown</div>
              </div>
            ) : (
              <>
                <MarkdownPreviewPane html={leftHtml} label="Original" dark={dark} />
                <MarkdownPreviewPane html={rightHtml} label="Modified" dark={dark} />
              </>
            )}
          </div>
        )}
      </div>

      <div className="status-bar">
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {viewMode === 'source' ? 'Source diff' : 'Rendered preview'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {leftText.trim() ? `${leftText.split('\n').length} lines left` : ''}{leftText.trim() && rightText.trim() ? ' · ' : ''}{rightText.trim() ? `${rightText.split('\n').length} lines right` : ''}
        </div>
      </div>
    </div>
  )
}
