import { prettierParsers } from './config'

export function detectLanguage(text: string): string {
  const t = text.trim()
  if (!t) return 'plaintext'

  // Need enough content to make a reasonable guess
  if (t.length < 8) return 'plaintext'

  // --- Unambiguous file signatures ---

  if (/^[\[{]/.test(t)) {
    try { JSON.parse(t); return 'json' } catch { /* not valid json */ }
  }

  if (/^<\?xml/i.test(t)) return 'xml'
  if (/^<!doctype\s+html/i.test(t) || /^<html[\s>]/i.test(t)) return 'html'
  if (/^<\?php/.test(t)) return 'php'
  if (/^#!\s*\//.test(t)) return 'shell'

  // Dockerfile needs multiple signals
  if (/^FROM\s/m.test(t) && /^(RUN|CMD|COPY|ENV|WORKDIR|EXPOSE|ENTRYPOINT)\s/m.test(t)) return 'dockerfile'

  // XML-like markup with opening and closing tags
  if (/^<[a-zA-Z][\s\S]*>/.test(t) && /<\/[a-zA-Z]/.test(t)) return 'xml'

  // --- Programming languages (checked before structural formats to avoid false positives) ---

  // TypeScript: type annotations that JS doesn't have
  if (/\b(interface\s+\w+|type\s+\w+\s*=|enum\s+\w+)/.test(t)) return 'typescript'
  if (/:\s*(string|number|boolean|any|void|never|unknown)\b/.test(t) && /\b(const|let|function|class)\b/.test(t)) return 'typescript'

  // JavaScript / JSX
  if (/\b(const|let|var)\s+\w+\s*=/.test(t) || /\bfunction\s+\w+\s*\(/.test(t)) return 'javascript'
  if (/\b(import\s+.*from\s|export\s+(default\s+)?|require\s*\()/.test(t)) return 'javascript'
  if (/=>\s*[{(]/.test(t)) return 'javascript'

  // Python
  if (/\b(def\s+\w+\s*\(|class\s+\w+.*:$|from\s+\w+\s+import|print\s*\()/m.test(t)) return 'python'
  if (/^\s*(if|for|while)\s+.*:\s*$/m.test(t) && !/[{;]/.test(t)) return 'python'

  // Java
  if (/\b(public\s+class|System\.out\.|void\s+main\s*\()/.test(t)) return 'java'

  // Go
  if (/\bpackage\s+\w+/.test(t) && /\bfunc\s/.test(t)) return 'go'
  if (/\bfmt\.(Print|Sprint|Fprint)/.test(t)) return 'go'

  // Rust
  if (/\b(fn\s+\w+\s*\(|let\s+mut\s|impl\s+\w+|use\s+\w+::)/.test(t)) return 'rust'

  // C# — check before CSS to avoid `.class {` confusion
  if (/\b(namespace\s+\w+|using\s+System|Console\.Write)/.test(t)) return 'csharp'

  // C / C++
  if (/^#include\s+[<"]/.test(t)) return 'cpp'
  if (/\b(std::|cout\s*<<|cin\s*>>|nullptr)/.test(t)) return 'cpp'

  // Swift
  if (/\b(func\s+\w+.*->|guard\s+let|if\s+let|var\s+\w+\s*:\s*\w+\s*[=?])/.test(t)) return 'swift'

  // Kotlin
  if (/\b(fun\s+\w+\s*\(|val\s+\w+|var\s+\w+\s*:\s*\w+|println\s*\()/.test(t) && !/\bfunction\b/.test(t)) return 'kotlin'

  // Ruby
  if (/\b(puts\s|require\s+['"]|def\s+\w+.*\n[\s\S]*?\bend\b)/m.test(t)) return 'ruby'

  // SQL
  if (/\b(SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE)\b/i.test(t)) return 'sql'

  // Shell (beyond shebang)
  if (/\b(echo|grep|awk|sed)\s/.test(t) && /[\$|;]/.test(t)) return 'shell'

  // GraphQL
  if (/\b(query|mutation|subscription)\s+\w*\s*\{/.test(t) || /\btype\s+\w+\s*\{[\s\S]*?\w+\s*:/.test(t) && !/\b(const|let|interface)\b/.test(t)) return 'graphql'

  // --- Structural / data formats (checked last — their patterns are broad) ---

  // CSS / SCSS / Less — only when it looks like actual stylesheets
  if (/[.#@]\w[\w-]*\s*\{/.test(t) && /[a-z-]+\s*:\s*[^;]+;/m.test(t)) {
    if (/@mixin|@include|\$\w+\s*:|\&/.test(t)) return 'scss'
    if (/@\w+\s*:|\.\w+\s*\(/.test(t) && !/@media|@keyframes/.test(t)) return 'less'
    return 'css'
  }

  // Markdown — needs heading or common MD patterns
  if (/^#{1,6}\s+\S/m.test(t) && (t.split('\n').length > 2 || /\*\*\w|\[.*\]\(.*\)/.test(t))) return 'markdown'

  // YAML — only when it strongly looks like YAML (key: value on multiple lines, no code-like syntax)
  if (/^---\s*$/m.test(t) && /^\w[\w.-]*:\s/m.test(t)) return 'yaml'
  if (/^\w[\w.-]*:\s*$/m.test(t) && /^\s+-\s/m.test(t) && !/[{;()=>]/.test(t)) return 'yaml'
  if (/^\w[\w.-]*:\s+\S/m.test(t) && t.split('\n').filter((l) => /^\w[\w.-]*:\s/.test(l)).length >= 3 && !/[{;()=>]/.test(t)) return 'yaml'

  return 'plaintext'
}

interface FormatOptions {
  printWidth?: number
  tabSize?: number
}

export async function formatCode(text: string, lang: string, opts: FormatOptions = {}): Promise<string> {
  if (!text.trim()) return text

  const config = prettierParsers[lang]
  if (!config) return text

  try {
    const [{ format }, plugins] = await Promise.all([
      import('prettier/standalone'),
      config.loadPlugins(),
    ])
    return await format(text, {
      parser: config.parser,
      plugins,
      tabWidth: opts.tabSize ?? 2,
      printWidth: opts.printWidth ?? 80,
    })
  } catch {
    return text
  }
}

export function canFormat(lang: string): boolean {
  return lang in prettierParsers
}

export interface DiffStats {
  additions: number
  deletions: number
  changes: number
}

const EMPTY_STATS: DiffStats = { additions: 0, deletions: 0, changes: 0 }

interface CompareOptions {
  ignoreCase?: boolean
  ignoreWhitespace?: boolean
  ignoreBlankLines?: boolean
  lineFilter?: string
}

/**
 * Line-level diff stats using multiset intersection.
 * Not a proper LCS — just counts how many lines exist in one
 * side but not the other. Good enough for a status bar.
 */
export function computeStats(original: string, modified: string, opts: CompareOptions = {}): DiffStats {
  let filterRe: RegExp | null = null
  if (opts.lineFilter) {
    try { filterRe = new RegExp(opts.lineFilter) } catch { /* invalid regex */ }
  }

  const normalize = (line: string) => {
    let l = line
    if (opts.ignoreWhitespace) l = l.trim().replace(/\s+/g, ' ')
    if (opts.ignoreCase) l = l.toLowerCase()
    return l
  }

  const shouldKeep = (line: string) => {
    if (opts.ignoreBlankLines && !line.trim()) return false
    if (filterRe && filterRe.test(line)) return false
    return true
  }

  const origLines = original.split('\n').filter(shouldKeep).map(normalize)
  const modLines = modified.split('\n').filter(shouldKeep).map(normalize)

  const bothEmpty = origLines.length === 1 && origLines[0] === ''
    && modLines.length === 1 && modLines[0] === ''
  if (bothEmpty) return EMPTY_STATS

  const bag = new Map<string, number>()
  for (const line of origLines) bag.set(line, (bag.get(line) || 0) + 1)

  let common = 0
  for (const line of modLines) {
    const count = bag.get(line)
    if (count && count > 0) {
      common++
      bag.set(line, count - 1)
    }
  }

  const deletions = origLines.length - common
  const additions = modLines.length - common
  return { additions, deletions, changes: Math.max(additions, deletions) }
}
