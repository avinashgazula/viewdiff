// Type declarations for Monaco Editor ESM deep imports
// These modules exist at runtime but don't ship .d.ts files

declare module 'monaco-editor/esm/vs/editor/editor.api' {
  export * from 'monaco-editor'
}

declare module 'monaco-editor/esm/vs/language/json/monaco.contribution' {
  interface JSONDefaults {
    setDiagnosticsOptions(options: Record<string, unknown>): void
  }
  export const jsonDefaults: JSONDefaults
}

declare module 'monaco-editor/esm/vs/language/css/monaco.contribution' {
  interface CSSDefaults {
    setOptions(options: Record<string, unknown>): void
  }
  export const cssDefaults: CSSDefaults
  export const scssDefaults: CSSDefaults
  export const lessDefaults: CSSDefaults
}

declare module 'monaco-editor/esm/vs/language/html/monaco.contribution' {
  interface HTMLDefaults {
    setOptions(options: Record<string, unknown>): void
  }
  export const htmlDefaults: HTMLDefaults
}

// Side-effect-only imports (no exports needed)
declare module 'monaco-editor/esm/vs/language/typescript/monaco.contribution' {}
declare module 'monaco-editor/esm/vs/basic-languages/*/contribution' {}
