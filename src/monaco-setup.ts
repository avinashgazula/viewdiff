/**
 * Self-host Monaco Editor — import only the editor core + languages we need.
 *
 * Instead of `import * as monaco from 'monaco-editor'` (which pulls in
 * every language, accessibility provider, and feature), we import from
 * the ESM entry point and cherry-pick only what's needed.
 */

// Core editor API (tree-shakeable entry point)
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import { loader } from '@monaco-editor/react'

// ── Workers ──────────────────────────────────────────────
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

// ── Language contributions (only the ones we support) ────
// Languages with IntelliSense (full language services via workers)
import { jsonDefaults } from 'monaco-editor/esm/vs/language/json/monaco.contribution'
import { cssDefaults, scssDefaults, lessDefaults } from 'monaco-editor/esm/vs/language/css/monaco.contribution'
import { htmlDefaults } from 'monaco-editor/esm/vs/language/html/monaco.contribution'
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution'

// Basic languages (syntax highlighting only — loaded on demand by Monaco)
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution'
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution'
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution'
import 'monaco-editor/esm/vs/basic-languages/java/java.contribution'
import 'monaco-editor/esm/vs/basic-languages/csharp/csharp.contribution'
import 'monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution'
import 'monaco-editor/esm/vs/basic-languages/go/go.contribution'
import 'monaco-editor/esm/vs/basic-languages/rust/rust.contribution'
import 'monaco-editor/esm/vs/basic-languages/ruby/ruby.contribution'
import 'monaco-editor/esm/vs/basic-languages/php/php.contribution'
import 'monaco-editor/esm/vs/basic-languages/swift/swift.contribution'
import 'monaco-editor/esm/vs/basic-languages/kotlin/kotlin.contribution'
import 'monaco-editor/esm/vs/basic-languages/scala/scala.contribution'
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution'
import 'monaco-editor/esm/vs/basic-languages/shell/shell.contribution'
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution'
import 'monaco-editor/esm/vs/basic-languages/graphql/graphql.contribution'
import 'monaco-editor/esm/vs/basic-languages/dockerfile/dockerfile.contribution'
import 'monaco-editor/esm/vs/basic-languages/lua/lua.contribution'
import 'monaco-editor/esm/vs/basic-languages/r/r.contribution'
import 'monaco-editor/esm/vs/basic-languages/perl/perl.contribution'
import 'monaco-editor/esm/vs/basic-languages/dart/dart.contribution'
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution'
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution'
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution'
import 'monaco-editor/esm/vs/basic-languages/less/less.contribution'
import 'monaco-editor/esm/vs/basic-languages/scss/scss.contribution'
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution'

// ── Editor features we use ───────────────────────────────
// Diff editor
import 'monaco-editor/esm/vs/editor/browser/widget/diffEditor/diffEditor.contribution'

// Core features
import 'monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching'
import 'monaco-editor/esm/vs/editor/contrib/folding/browser/folding'
import 'monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController'
import 'monaco-editor/esm/vs/editor/contrib/wordHighlighter/browser/wordHighlighter'
import 'monaco-editor/esm/vs/editor/contrib/find/browser/findController'
import 'monaco-editor/esm/vs/editor/contrib/colorPicker/browser/colorDetector'
import 'monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution'
import 'monaco-editor/esm/vs/editor/contrib/inlineCompletions/browser/inlineCompletions.contribution'
import 'monaco-editor/esm/vs/editor/contrib/clipboard/browser/clipboard'
import 'monaco-editor/esm/vs/editor/contrib/contextmenu/browser/contextmenu'
import 'monaco-editor/esm/vs/editor/contrib/comment/browser/comment'
import 'monaco-editor/esm/vs/editor/contrib/indentation/browser/indentation'
import 'monaco-editor/esm/vs/editor/contrib/wordOperations/browser/wordOperations'
import 'monaco-editor/esm/vs/editor/contrib/linesOperations/browser/linesOperations'
import 'monaco-editor/esm/vs/editor/contrib/multicursor/browser/multicursor'
import 'monaco-editor/esm/vs/editor/contrib/smartSelect/browser/smartSelect'
import 'monaco-editor/esm/vs/editor/contrib/linkedEditing/browser/linkedEditing'
import 'monaco-editor/esm/vs/editor/contrib/format/browser/formatActions'

// Configure Monaco to use local workers instead of CDN
self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  },
}

// Tell @monaco-editor/react to use the local monaco instance
loader.config({ monaco })

// ── Language defaults configuration ──────────────────────
jsonDefaults.setDiagnosticsOptions({
  validate: true,
  allowComments: true,
  trailingCommas: 'ignore',
  schemaValidation: 'warning',
})

const cssLintOptions = {
  validate: true,
  lint: {
    compatibleVendorPrefixes: 'warning' as const,
    duplicateProperties: 'warning' as const,
    emptyRules: 'warning' as const,
    importStatement: 'warning' as const,
    unknownProperties: 'warning' as const,
    unknownVendorSpecificProperties: 'warning' as const,
  },
}
cssDefaults.setOptions(cssLintOptions)
scssDefaults.setOptions(cssLintOptions)
lessDefaults.setOptions(cssLintOptions)

htmlDefaults.setOptions({
  format: {
    tabSize: 2,
    insertSpaces: true,
    wrapLineLength: 80,
    indentInnerHtml: true,
  },
  suggest: { html5: true },
})
