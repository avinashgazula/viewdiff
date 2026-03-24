import type { Monaco } from '@monaco-editor/react'

const lightColors = {
  'editor.background': '#f7f7f9',
  'editorLineNumber.foreground': '#c4c4cc',
  'editorLineNumber.activeForeground': '#9090a0',
  'editor.lineHighlightBackground': '#ededf2',
  'diffEditor.insertedTextBackground': '#16a34a1a',
  'diffEditor.removedTextBackground': '#dc26261a',
  'diffEditor.insertedLineBackground': '#16a34a0a',
  'diffEditor.removedLineBackground': '#dc26260a',
  'diffEditor.diagonalFill': '#f0f0f4',
  'editorGutter.addedBackground': '#16a34a44',
  'editorGutter.deletedBackground': '#dc262644',
}

const darkColors = {
  'editor.background': '#131316',
  'editorLineNumber.foreground': '#38383f',
  'editorLineNumber.activeForeground': '#58585f',
  'editor.lineHighlightBackground': '#1a1a1f',
  'diffEditor.insertedTextBackground': '#4ade8016',
  'diffEditor.removedTextBackground': '#f8717116',
  'diffEditor.insertedLineBackground': '#4ade8008',
  'diffEditor.removedLineBackground': '#f8717108',
  'diffEditor.diagonalFill': '#1a1a1f',
  'editorGutter.addedBackground': '#4ade8038',
  'editorGutter.deletedBackground': '#f8717138',
}

export function registerThemes(monaco: Monaco) {
  monaco.editor.defineTheme('diff-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: lightColors,
  })

  monaco.editor.defineTheme('diff-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: darkColors,
  })
}
