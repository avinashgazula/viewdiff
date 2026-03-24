export interface Language {
  id: string
  label: string
}

export const languages: Language[] = [
  { id: 'plaintext', label: 'Plain Text' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'json', label: 'JSON' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'scss', label: 'SCSS' },
  { id: 'less', label: 'Less' },
  { id: 'xml', label: 'XML' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'csharp', label: 'C#' },
  { id: 'cpp', label: 'C++' },
  { id: 'c', label: 'C' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'php', label: 'PHP' },
  { id: 'swift', label: 'Swift' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'scala', label: 'Scala' },
  { id: 'sql', label: 'SQL' },
  { id: 'shell', label: 'Shell' },
  { id: 'yaml', label: 'YAML' },
  { id: 'graphql', label: 'GraphQL' },
  { id: 'dockerfile', label: 'Dockerfile' },
  { id: 'lua', label: 'Lua' },
  { id: 'r', label: 'R' },
  { id: 'perl', label: 'Perl' },
  { id: 'dart', label: 'Dart' },
]

export interface PrettierParserConfig {
  parser: string
  loadPlugins: () => Promise<import('prettier').Plugin[]>
}

// Plugins are loaded on demand — no upfront cost.
export const prettierParsers: Record<string, PrettierParserConfig> = {
  javascript: {
    parser: 'babel',
    loadPlugins: () => Promise.all([
      import('prettier/plugins/babel'),
      import('prettier/plugins/estree'),
    ]).then(([b, e]) => [b.default, e.default]),
  },
  typescript: {
    parser: 'typescript',
    loadPlugins: () => Promise.all([
      import('prettier/plugins/typescript'),
      import('prettier/plugins/estree'),
    ]).then(([t, e]) => [t.default, e.default]),
  },
  json: {
    parser: 'json',
    loadPlugins: () => Promise.all([
      import('prettier/plugins/babel'),
      import('prettier/plugins/estree'),
    ]).then(([b, e]) => [b.default, e.default]),
  },
  html: {
    parser: 'html',
    loadPlugins: () => import('prettier/plugins/html').then((m) => [m.default]),
  },
  css: {
    parser: 'css',
    loadPlugins: () => import('prettier/plugins/postcss').then((m) => [m.default]),
  },
  scss: {
    parser: 'scss',
    loadPlugins: () => import('prettier/plugins/postcss').then((m) => [m.default]),
  },
  less: {
    parser: 'less',
    loadPlugins: () => import('prettier/plugins/postcss').then((m) => [m.default]),
  },
  markdown: {
    parser: 'markdown',
    loadPlugins: () => import('prettier/plugins/markdown').then((m) => [m.default]),
  },
  xml: {
    parser: 'xml',
    loadPlugins: () => import('@prettier/plugin-xml').then((m) => [m.default as unknown as import('prettier').Plugin]),
  },
}

export const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent)

export function formatKeybinding(shortcut: string): string {
  return shortcut
    .replace('Ctrl', isMac ? '⌘' : 'Ctrl')
    .replace('Shift', isMac ? '⇧' : 'Shift')
    .replace('Alt', isMac ? '⌥' : 'Alt')
}
