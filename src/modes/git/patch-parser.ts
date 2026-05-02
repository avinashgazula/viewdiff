export interface HunkLine {
  type: 'context' | 'add' | 'remove'
  content: string
}

export interface Hunk {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  header: string
  lines: HunkLine[]
}

export interface FilePatch {
  oldPath: string
  newPath: string
  status: 'added' | 'deleted' | 'modified' | 'renamed' | 'binary'
  hunks: Hunk[]
  isBinary: boolean
  additions: number
  deletions: number
}

export interface ParsedPatch {
  files: FilePatch[]
  commitHash?: string
  commitMessage?: string
  stats: { filesChanged: number; additions: number; deletions: number }
}

export function parsePatch(text: string): ParsedPatch {
  const lines = text.split('\n')
  const files: FilePatch[] = []
  let commitHash: string | undefined
  let commitMessage: string | undefined

  let i = 0

  // Parse optional git commit header
  if (lines[0]?.startsWith('commit ')) {
    commitHash = lines[0].slice(7).trim()
    i = 1
    while (i < lines.length && !lines[i].startsWith('diff --git')) {
      const line = lines[i].trim()
      if (line && !line.startsWith('Author:') && !line.startsWith('Date:') && !line.startsWith('Merge:')) {
        if (!commitMessage) commitMessage = line
      }
      i++
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('diff --git ') || line.startsWith('diff -u ') || line.startsWith('diff -r ')) {
      const file = parseFileDiff(lines, i)
      if (file) {
        files.push(file.patch)
        i = file.nextIndex
      } else {
        i++
      }
    } else {
      i++
    }
  }

  const totalAdditions = files.reduce((s, f) => s + f.additions, 0)
  const totalDeletions = files.reduce((s, f) => s + f.deletions, 0)

  return {
    files,
    commitHash,
    commitMessage,
    stats: { filesChanged: files.length, additions: totalAdditions, deletions: totalDeletions },
  }
}

function parseFileDiff(lines: string[], start: number): { patch: FilePatch; nextIndex: number } | null {
  let i = start
  const diffLine = lines[i]

  // Extract paths from diff --git a/foo b/foo
  let oldPath = ''
  let newPath = ''
  const gitMatch = diffLine.match(/^diff --git a\/(.+) b\/(.+)$/)
  if (gitMatch) {
    oldPath = gitMatch[1]
    newPath = gitMatch[2]
  }
  i++

  let status: FilePatch['status'] = 'modified'
  let isBinary = false

  // Parse extended headers
  while (i < lines.length && !lines[i].startsWith('---') && !lines[i].startsWith('diff ')) {
    const l = lines[i]
    if (l.startsWith('new file mode')) status = 'added'
    else if (l.startsWith('deleted file mode')) status = 'deleted'
    else if (l.startsWith('rename from ')) {
      status = 'renamed'
      oldPath = l.slice(12).trim()
    } else if (l.startsWith('rename to ')) {
      newPath = l.slice(10).trim()
    } else if (l.startsWith('Binary files')) {
      isBinary = true
    }
    i++
  }

  if (isBinary) {
    return {
      patch: { oldPath, newPath, status: 'binary', hunks: [], isBinary: true, additions: 0, deletions: 0 },
      nextIndex: i,
    }
  }

  // Parse --- and +++ lines
  if (i < lines.length && lines[i].startsWith('---')) {
    const rawOld = lines[i].slice(4).trim()
    if (rawOld !== '/dev/null') {
      oldPath = rawOld.replace(/^a\//, '')
    }
    i++
  }
  if (i < lines.length && lines[i].startsWith('+++')) {
    const rawNew = lines[i].slice(4).trim()
    if (rawNew !== '/dev/null') {
      newPath = rawNew.replace(/^b\//, '')
    }
    i++
  }

  // If still no paths found from unified diff (diff -u style)
  if (!oldPath && !newPath) {
    const uniMatch = diffLine.match(/^diff -u (.+) (.+)$/)
    if (uniMatch) {
      oldPath = uniMatch[1]
      newPath = uniMatch[2]
    }
  }

  const hunks: Hunk[] = []
  let additions = 0
  let deletions = 0

  // Parse hunks
  while (i < lines.length && !lines[i].startsWith('diff ')) {
    const hunkMatch = lines[i].match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/)
    if (hunkMatch) {
      const hunk: Hunk = {
        oldStart: parseInt(hunkMatch[1]),
        oldCount: hunkMatch[2] !== undefined ? parseInt(hunkMatch[2]) : 1,
        newStart: parseInt(hunkMatch[3]),
        newCount: hunkMatch[4] !== undefined ? parseInt(hunkMatch[4]) : 1,
        header: hunkMatch[5].trim(),
        lines: [],
      }
      i++

      while (i < lines.length && !lines[i].startsWith('@@') && !lines[i].startsWith('diff ')) {
        const l = lines[i]
        if (l.startsWith('+') && !l.startsWith('+++')) {
          hunk.lines.push({ type: 'add', content: l.slice(1) })
          additions++
        } else if (l.startsWith('-') && !l.startsWith('---')) {
          hunk.lines.push({ type: 'remove', content: l.slice(1) })
          deletions++
        } else if (l.startsWith(' ') || l === '') {
          hunk.lines.push({ type: 'context', content: l.slice(1) })
        }
        i++
      }

      hunks.push(hunk)
    } else {
      i++
    }
  }

  return {
    patch: { oldPath, newPath, status, hunks, isBinary: false, additions, deletions },
    nextIndex: i,
  }
}

export function reconstructSides(hunks: Hunk[]): { original: string; modified: string } {
  const originalLines: string[] = []
  const modifiedLines: string[] = []

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'context') {
        originalLines.push(line.content)
        modifiedLines.push(line.content)
      } else if (line.type === 'remove') {
        originalLines.push(line.content)
      } else {
        modifiedLines.push(line.content)
      }
    }
  }

  return { original: originalLines.join('\n'), modified: modifiedLines.join('\n') }
}

export function getFileExtension(path: string): string {
  const parts = path.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rb: 'ruby', java: 'java', go: 'go', rs: 'rust',
  cpp: 'cpp', cc: 'cpp', c: 'cpp', h: 'cpp', hpp: 'cpp',
  cs: 'csharp', php: 'php', swift: 'swift', kt: 'kotlin',
  json: 'json', yaml: 'yaml', yml: 'yaml', xml: 'xml', html: 'html',
  css: 'css', scss: 'scss', less: 'less', md: 'markdown', sql: 'sql',
  sh: 'shell', bash: 'shell', zsh: 'shell', dockerfile: 'dockerfile',
  graphql: 'graphql', gql: 'graphql',
}

export function langFromPath(path: string): string {
  const ext = getFileExtension(path)
  const base = path.split('/').pop()?.toLowerCase() ?? ''
  if (base === 'dockerfile' || base.startsWith('dockerfile.')) return 'dockerfile'
  return EXT_TO_LANG[ext] ?? 'plaintext'
}
