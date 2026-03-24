import { useCallback, useEffect, useState } from 'react'

export function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false
    const saved = localStorage.getItem('diff-theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev
      localStorage.setItem('diff-theme', next ? 'dark' : 'light')
      return next
    })
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return { dark, toggle }
}
