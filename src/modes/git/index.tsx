import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ModeTabs } from '../../components/mode-tabs'
import { useTheme } from '../../hooks/use-theme'
import { MoonIcon, MonitorIcon, SunIcon } from '../../components/icons'
import { parsePatch, reconstructSides, langFromPath, type FilePatch } from './patch-parser'
import { registerThemes } from '../../themes'
import { encodeText, decodeText } from '../../share'
import { downloadText } from '../../export'
import type { editor } from 'monaco-editor'
import type { Monaco } from '@monaco-editor/react'

function buildFilePatch(file: FilePatch): string {
  const oldPath = file.oldPath || '/dev/null'
  const newPath = file.newPath || '/dev/null'
  const rows: string[] = [`--- a/${oldPath}`, `+++ b/${newPath}`]
  for (const hunk of file.hunks) {
    rows.push(`@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@${hunk.header ? ' ' + hunk.header : ''}`)
    for (const l of hunk.lines) {
      rows.push((l.type === 'add' ? '+' : l.type === 'remove' ? '-' : ' ') + l.content)
    }
  }
  return rows.join('\n') + '\n'
}

const LazyDiffEditor = lazy(() =>
  import('@monaco-editor/react').then((m) => ({ default: m.DiffEditor })),
)

function FileStatusBadge({ status }: { status: FilePatch['status'] }) {
  const colors: Record<string, string> = {
    added: 'var(--green)',
    deleted: 'var(--red)',
    renamed: 'var(--amber)',
    modified: 'var(--text-muted)',
    binary: 'var(--text-dim)',
  }
  const labels: Record<string, string> = {
    added: 'A', deleted: 'D', renamed: 'R', modified: 'M', binary: 'B',
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 16, height: 16, borderRadius: 3, fontSize: 10, fontWeight: 700,
      color: colors[status], border: `1px solid ${colors[status]}`,
      flexShrink: 0,
    }}>
      {labels[status]}
    </span>
  )
}

export function GitMode() {
  const { dark, mode: themeMode, toggle: toggleTheme } = useTheme()
  const [patchText, setPatchText] = useState('')
  const [parsed, setParsed] = useState<ReturnType<typeof parsePatch> | null>(null)
  const [selectedFile, setSelectedFile] = useState(0)
  const [inputVisible, setInputVisible] = useState(true)
  const [shareCopied, setShareCopied] = useState(false)
  const [fileFilter, setFileFilter] = useState('')

  // Load from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const g = params.get('g')
    if (g) {
      decodeText(g).then((text) => {
        if (text) setPatchText(text)
      })
    }
  }, [])

  const sharePatch = useCallback(async () => {
    if (!patchText.trim()) return
    const encoded = await encodeText(patchText)
    const url = `${window.location.origin}/git?g=${encodeURIComponent(encoded)}`
    await navigator.clipboard.writeText(url)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }, [patchText])

  useEffect(() => {
    if (!patchText.trim()) { setParsed(null); return }
    const result = parsePatch(patchText)
    if (result.files.length > 0) {
      setParsed(result)
      setSelectedFile(0)
      setInputVisible(false)
    }
  }, [patchText])

  const currentFile = parsed?.files[selectedFile]

  const { original, modified } = useMemo(() => {
    if (!currentFile) return { original: '', modified: '' }
    return reconstructSides(currentFile.hunks)
  }, [currentFile])

  const lang = currentFile ? langFromPath(currentFile.newPath || currentFile.oldPath) : 'plaintext'
  const editorTheme = dark ? 'diff-dark' : 'diff-light'

  const onBeforeMount = useCallback((monaco: Monaco) => registerThemes(monaco), [])

  const diffOptions = useMemo((): editor.IDiffEditorConstructionOptions => ({
    originalEditable: false,
    fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
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
    readOnly: true,
  }), [])

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
          {parsed && (
            <>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {parsed.stats.filesChanged} file{parsed.stats.filesChanged !== 1 ? 's' : ''}
              </span>
              <span className="stat-green" style={{ fontSize: 12 }}>+{parsed.stats.additions}</span>
              <span className="stat-red" style={{ fontSize: 12 }}>-{parsed.stats.deletions}</span>
              <div className="divider" aria-hidden="true" />
              <button className="btn outlined" onClick={() => setInputVisible((v) => !v)}>
                {inputVisible ? 'Hide input' : 'Edit patch'}
              </button>
              <button
                className="btn outlined"
                onClick={sharePatch}
                title="Copy shareable link"
              >
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

      {inputVisible && (
        <div style={{ flexShrink: 0, borderBottom: '1px solid var(--border)', position: 'relative' }}>
          <textarea
            value={patchText}
            onChange={(e) => setPatchText(e.target.value)}
            placeholder={"Paste git diff, git show, or unified diff output here...\n\nExample: run `git diff HEAD` or `git show <commit>` in your terminal"}
            style={{
              width: '100%',
              height: parsed ? 120 : 260,
              resize: 'none',
              border: 'none',
              outline: 'none',
              padding: '12px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12.5,
              background: 'var(--bg)',
              color: 'var(--text)',
              display: 'block',
            }}
          />
          {!parsed && (
            <div style={{ position: 'absolute', bottom: 12, right: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Paste a unified diff and it will parse automatically
              </span>
            </div>
          )}
        </div>
      )}

      {parsed && parsed.files.length > 0 ? (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* File list sidebar — keyboard navigable */}
          <div
            style={{
              width: 260, flexShrink: 0, borderRight: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', background: 'var(--surface)',
            }}
          >
            <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <input
                type="search"
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value)}
                placeholder="Filter files…"
                aria-label="Filter changed files"
                style={{
                  width: '100%', height: 26, padding: '0 8px', boxSizing: 'border-box',
                  fontFamily: 'var(--font-mono)', fontSize: 11.5,
                  color: 'var(--text)', background: 'var(--surface-raised)',
                  border: '1px solid var(--border)', borderRadius: 6, outline: 'none',
                }}
              />
            </div>
          <div
            role="listbox"
            aria-label="Changed files"
            tabIndex={0}
            style={{ flex: 1, overflowY: 'auto', outline: 'none' }}
            onKeyDown={(e) => {
              if (!parsed) return
              const visible = parsed.files.filter((f) => !fileFilter || (f.newPath || f.oldPath).toLowerCase().includes(fileFilter.toLowerCase()))
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedFile((i) => Math.min(i + 1, visible.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedFile((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Home') {
                e.preventDefault(); setSelectedFile(0)
              } else if (e.key === 'End') {
                e.preventDefault(); setSelectedFile(visible.length - 1)
              }
            }}
          >
            {parsed.commitMessage && (
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                {parsed.commitMessage}
                {parsed.commitHash && (
                  <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4, fontFamily: 'var(--font-mono)', fontStyle: 'normal' }}>
                    {parsed.commitHash.slice(0, 8)}
                  </div>
                )}
              </div>
            )}
            {parsed.files.filter((f) => !fileFilter || (f.newPath || f.oldPath).toLowerCase().includes(fileFilter.toLowerCase())).map((file, idx) => {
              const displayPath = file.newPath || file.oldPath
              const parts = displayPath.split('/')
              const filename = parts.pop() ?? displayPath
              const dir = parts.join('/')
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedFile(idx)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: selectedFile === idx ? 'var(--accent-subtle)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--border-subtle)',
                    color: selectedFile === idx ? 'var(--accent)' : 'var(--text-secondary)',
                    transition: 'background 0.1s',
                  }}
                >
                  <FileStatusBadge status={file.status} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 550, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {filename}
                    </div>
                    {dir && (
                      <div style={{ fontSize: 10.5, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {dir}
                      </div>
                    )}
                  </div>
                  {(file.additions > 0 || file.deletions > 0) && (
                    <div style={{ display: 'flex', gap: 4, fontSize: 10.5, flexShrink: 0 }}>
                      {file.additions > 0 && <span style={{ color: 'var(--green)' }}>+{file.additions}</span>}
                      {file.deletions > 0 && <span style={{ color: 'var(--red)' }}>-{file.deletions}</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
          </div>

          {/* Diff viewer */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {currentFile && (
              <>
                <div style={{ padding: '4px 10px 4px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentFile.oldPath !== currentFile.newPath && currentFile.oldPath
                      ? `${currentFile.oldPath} → ${currentFile.newPath}`
                      : currentFile.newPath || currentFile.oldPath}
                  </span>
                  {currentFile.hunks.length > 0 && (
                    <>
                      <button
                        className="btn outlined"
                        style={{ fontSize: 11, height: 22, padding: '0 8px', flexShrink: 0 }}
                        title="Copy this file's diff to clipboard"
                        onClick={() => navigator.clipboard.writeText(buildFilePatch(currentFile))}
                      >
                        Copy diff
                      </button>
                      <button
                        className="btn outlined"
                        style={{ fontSize: 11, height: 22, padding: '0 8px', flexShrink: 0 }}
                        title="Download this file's diff as a .patch file"
                        onClick={() => {
                          const name = (currentFile.newPath || currentFile.oldPath).split('/').pop() ?? 'file'
                          downloadText(buildFilePatch(currentFile), `${name}.patch`)
                        }}
                      >
                        Download
                      </button>
                    </>
                  )}
                </div>
                {currentFile.isBinary ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    Binary file — cannot display diff
                  </div>
                ) : currentFile.hunks.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    {currentFile.status === 'added' ? 'New file' : currentFile.status === 'deleted' ? 'Deleted file' : 'No changes'}
                  </div>
                ) : (
                  <div style={{ flex: 1 }}>
                    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>Loading editor...</div>}>
                      <LazyDiffEditor
                        original={original}
                        modified={modified}
                        language={lang}
                        theme={editorTheme}
                        beforeMount={onBeforeMount}
                        options={diffOptions}
                      />
                    </Suspense>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : !patchText.trim() ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)' }}>Paste a unified diff to visualize it</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            Supports git diff, git show, diff -u, and GitHub patch format
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No parseable diff found — check the format
        </div>
      )}
    </div>
  )
}
