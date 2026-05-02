type MatchMatrix = boolean[][]

type Op = { type: '=' | '+' | '-'; orig: number; mod: number }

function lcs(a: string[], b: string[]): MatchMatrix {
  const n = a.length, m = b.length
  if (n > 5000 || m > 5000) return []
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])

  const match: MatchMatrix = Array.from({ length: n }, () => new Array(m).fill(false))
  let i = n, j = m
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { match[i - 1][j - 1] = true; i--; j-- }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--
    else j--
  }
  return match
}

function buildOps(origLines: string[], modLines: string[], matchMatrix: MatchMatrix): Op[] {
  // Extract LCS pairs in order (strictly increasing on both dims by LCS construction)
  const lcsPairs: [number, number][] = []
  for (let i = 0; i < origLines.length; i++)
    for (let j = 0; j < modLines.length; j++)
      if (matchMatrix[i]?.[j]) lcsPairs.push([i, j])

  const ops: Op[] = []
  let prevOi = 0, prevMi = 0

  for (const [lcOi, lcMi] of lcsPairs) {
    for (let i = prevOi; i < lcOi; i++) ops.push({ type: '-', orig: i, mod: -1 })
    for (let j = prevMi; j < lcMi; j++) ops.push({ type: '+', orig: -1, mod: j })
    ops.push({ type: '=', orig: lcOi, mod: lcMi })
    prevOi = lcOi + 1
    prevMi = lcMi + 1
  }
  for (let i = prevOi; i < origLines.length; i++) ops.push({ type: '-', orig: i, mod: -1 })
  for (let j = prevMi; j < modLines.length; j++) ops.push({ type: '+', orig: -1, mod: j })

  return ops
}

function buildHunks(ops: Op[], origLines: string[], modLines: string[], context: number) {
  // Mark every op-position that falls within `context` of a change
  const inHunk = new Uint8Array(ops.length)
  for (let i = 0; i < ops.length; i++) {
    if (ops[i].type !== '=') {
      const lo = Math.max(0, i - context)
      const hi = Math.min(ops.length - 1, i + context)
      for (let k = lo; k <= hi; k++) inHunk[k] = 1
    }
  }

  const result: { origStart: number; modStart: number; origCount: number; modCount: number; lines: string[] }[] = []
  let i = 0

  while (i < ops.length) {
    if (!inHunk[i]) { i++; continue }

    let j = i
    while (j < ops.length && inHunk[j]) j++

    const hunkOps = ops.slice(i, j)
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

    result.push({ origStart: firstOrig + 1, modStart: firstMod + 1, origCount, modCount, lines })
    i = j
  }

  return result
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
  const ops = buildOps(origLines, modLines, matchMatrix)
  const hunks = buildHunks(ops, origLines, modLines, context)

  if (hunks.length === 0) return ''

  const now = new Date().toISOString()
  let out = `--- ${origFilename}\t${now}\n+++ ${modFilename}\t${now}\n`
  for (const h of hunks) {
    out += `@@ -${h.origStart},${h.origCount} +${h.modStart},${h.modCount} @@\n`
    out += h.lines.join('\n') + '\n'
  }
  return out
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function generateHtmlDiff(
  original: string,
  modified: string,
  origFilename = 'original',
  modFilename = 'modified',
): string {
  const origLines = original.split('\n')
  const modLines = modified.split('\n')

  if (origLines.length > 5000 || modLines.length > 5000) {
    return `<!DOCTYPE html><html><body><p>File too large for HTML diff export.</p></body></html>`
  }

  const matchMatrix = lcs(origLines, modLines)
  const ops = buildOps(origLines, modLines, matchMatrix)

  let rows = ''
  for (const op of ops) {
    if (op.type === '=') {
      const n = op.orig + 1
      rows += `<tr><td class="ln">${n}</td><td class="ln">${op.mod + 1}</td><td class="ctx"><code> ${escapeHtml(origLines[op.orig])}</code></td></tr>\n`
    } else if (op.type === '-') {
      rows += `<tr><td class="ln del-ln">${op.orig + 1}</td><td class="ln"></td><td class="del"><code>-${escapeHtml(origLines[op.orig])}</code></td></tr>\n`
    } else {
      rows += `<tr><td class="ln"></td><td class="ln add-ln">${op.mod + 1}</td><td class="add"><code>+${escapeHtml(modLines[op.mod])}</code></td></tr>\n`
    }
  }

  const now = new Date().toLocaleString()
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Diff: ${escapeHtml(origFilename)} → ${escapeHtml(modFilename)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#f8f9fa;color:#1a1a1a;padding:24px}
h1{font-size:17px;font-weight:600;margin-bottom:4px}
.meta{font-size:12px;color:#888;margin-bottom:16px}
table{border-collapse:collapse;width:100%;font-size:13px}
td{vertical-align:top}
.ln{width:44px;min-width:44px;text-align:right;padding:1px 6px;color:#aaa;user-select:none;background:#f0f0f0;border-right:1px solid #e0e0e0;font-size:11px;font-family:monospace}
code{display:block;padding:1px 8px;white-space:pre;font-family:'JetBrains Mono',Consolas,monospace}
.del{background:#fff0f0}.del code{color:#c0392b}
.add{background:#f0fff4}.add code{color:#27ae60}
.del-ln{background:#ffd7db}.add-ln{background:#c8f5d1}
@media(prefers-color-scheme:dark){
body{background:#1e1e1e;color:#d4d4d4}
.ln{background:#252526;color:#555;border-right-color:#333}
.del{background:#3d1717}.del code{color:#f48771}
.add{background:#1a3a1a}.add code{color:#89d185}
.del-ln{background:#5a2020}.add-ln{background:#1e4a1e}
}
</style>
</head>
<body>
<h1>Diff: <span>${escapeHtml(origFilename)}</span> → <span>${escapeHtml(modFilename)}</span></h1>
<p class="meta">Generated ${now}</p>
<table><tbody>
${rows}
</tbody></table>
</body>
</html>`
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
