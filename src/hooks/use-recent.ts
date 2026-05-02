import { useCallback, useState } from 'react'

export interface RecentDiff {
  id: string
  savedAt: number
  preview: string
  original: string
  modified: string
}

const KEY = 'diff-recent'
const MAX = 8

function load(): RecentDiff[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

function persist(items: RecentDiff[]) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)))
}

export function useRecent() {
  const [recents, setRecents] = useState<RecentDiff[]>(load)

  const add = useCallback((original: string, modified: string) => {
    if (!original.trim() && !modified.trim()) return
    const preview = (original || modified).trim().split('\n')[0].slice(0, 72)
    setRecents((prev) => {
      if (prev[0]?.original === original && prev[0]?.modified === modified) return prev
      const entry: RecentDiff = { id: Date.now().toString(36), savedAt: Date.now(), preview, original, modified }
      const next = [entry, ...prev].slice(0, MAX)
      persist(next)
      return next
    })
  }, [])

  const remove = useCallback((id: string) => {
    setRecents((prev) => {
      const next = prev.filter((r) => r.id !== id)
      persist(next)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setRecents([])
    persist([])
  }, [])

  return { recents, add, remove, clear }
}
