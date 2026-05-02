/**
 * Generate a unified diff (.patch) from two text bodies.
 * Uses a simple LCS-based diff — identical to tools like `diff -u`.
 */

interface Hunk {
  origStart: number
  origLines: string[]
  modStart: number
  modLines: string[]
  context: number
}

function lcs(a: string[], b: string[]): boolean[][] {
  const n = a.length, m = b.length
  // For very large files, skip line-level detail
  if (n > 5000 || m > 5000) return []
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])

  const match = Array.from({ length: n }, () => new Array(m).fill(false))
  let i = n, j = m
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { match[i - 1][j - 1] = true; i--; j-- }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--
    else j--
  }
  return match
}

export function generatePatch(
  original: string,
  modified: string,
  origFilename = 'original',
  modFilename = 'modified',
  context = 3,
): string {
  const origLines = original.split('\n')
  const modLines = modified.split('\n')

  if (origLines.length > 5000 || modLines.length > 5000) {
    return `--- ${origFilename}\n+++ ${modFilename}\n@@ -1,${origLines.length} +1,${modLines.length} @@\n(File too large to generate inline patch)\n`
  }

  const matchMatrix = lcs(origLines, modLines)

  // Build edit script
  type Op = { type: '=' | '+' | '-'; orig: number; mod: number }
  const ops: Op[] = []
  let oi = 0, mi = 0

  while (oi < origLines.length || mi < modLines.length) {
    if (oi < origLines.length && mi < modLines.length && matchMatrix[oi]?.[mi]) {
      ops.push({ type: '=', orig: oi, mod: mi })
      oi++; mi++
    } else if (mi < modLines.length && (oi >= origLines.length || !matchMatrix[oi])) {
      // Check if orig has a match further ahead first
      let foundOrig = false
      for (let look = oi; look < Math.min(oi + 1, origLines.length); look++) {
        if (matchMatrix[look]?.[mi]) { foundOrig = true; break }
      }
      if (foundOrig && oi < origLines.length) {
        ops.push({ type: '-', orig: oi, mod: -1 }); oi++
      } else {
        ops.push({ type: '+', orig: -1, mod: mi }); mi++
      }
    } else if (oi < origLines.length) {
      ops.push({ type: '-', orig: oi, mod: -1 }); oi++
    } else {
      ops.push({ type: '+', orig: -1, mod: mi }); mi++
    }
  }

  // Group into hunks with context
  const hunks: { origStart: number; modStart: number; lines: string[] }[] = []
  let i = 0

  while (i < ops.length) {
    if (ops[i].type === '=') { i++; continue }

    // Find hunk boundaries
    const hunkStart = Math.max(0, i - context)
    let hunkEnd = i
    while (hunkEnd < ops.length && (ops[hunkEnd].type !== '=' || hunkEnd - i < context * 2)) hunkEnd++
    hunkEnd = Math.min(ops.length, hunkEnd + context)

    const hunkOps = ops.slice(hunkStart, hunkEnd)
    const firstOrig = hunkOps.find((o) => o.orig >= 0)?.orig ?? 0
    const firstMod = hunkOps.find((o) => o.mod >= 0)?.mod ?? 0

    let origCount = 0, modCount = 0
    const lines: string[] = []

    for (const op of hunkOps) {
      if (op.type === '=') {
        lines.push(` ${origLines[op.orig]}`)
        origCount++; modCount++
      } else if (op.type === '-') {
        lines.push(`-${origLines[op.orig]}`)
        origCount++
      } else {
        lines.push(`+${modLines[op.mod]}`)
        modCount++
      }
    }

    const origStart = firstOrig + 1
    const modStart = firstMod + 1
    hunks.push({ origStart, modStart, lines })

    i = hunkEnd
  }

  if (hunks.length === 0) return ''

  const now = new Date().toISOString()
  let out = `--- ${origFilename}\t${now}\n+++ ${modFilename}\t${now}\n`
  for (const h of hunks) {
    const origLen = h.lines.filter((l) => l[0] !== '+').length
    const modLen = h.lines.filter((l) => l[0] !== '-').length
    out += `@@ -${h.origStart},${origLen} +${h.modStart},${modLen} @@\n`
    out += h.lines.join('\n') + '\n'
  }
  return out
}

export function downloadText(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
