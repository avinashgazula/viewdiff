import { memo, useCallback } from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'

interface Props {
  language: string
  theme: string
  options: editor.IStandaloneEditorConstructionOptions
  onOriginalMount: (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => void
  onModifiedMount: (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => void
  beforeMount: (monaco: Monaco) => void
}

export const MobileEditor = memo(function MobileEditor({
  language, theme, options, onOriginalMount, onModifiedMount, beforeMount,
}: Props) {
  const loading = (
    <div className="flex items-center justify-center h-full" style={{ background: 'var(--bg)' }}>
      <span className="text-[13px]" style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
        Loading...
      </span>
    </div>
  )

  // Only call beforeMount once (on the first editor)
  const noop = useCallback(() => {}, [])

  return (
    <div className="mobile-editor-stack">
      <div className="mobile-editor-pane">
        <div className="mobile-editor-label">Original</div>
        <div className="mobile-editor-content">
          <Editor
            defaultValue=""
            language={language}
            theme={theme}
            beforeMount={beforeMount}
            onMount={onOriginalMount}
            loading={loading}
            options={options}
          />
        </div>
      </div>
      <div className="mobile-editor-divider" />
      <div className="mobile-editor-pane">
        <div className="mobile-editor-label">Modified</div>
        <div className="mobile-editor-content">
          <Editor
            defaultValue=""
            language={language}
            theme={theme}
            beforeMount={noop}
            onMount={onModifiedMount}
            loading={loading}
            options={options}
          />
        </div>
      </div>
    </div>
  )
})
