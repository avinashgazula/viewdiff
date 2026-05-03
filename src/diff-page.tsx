import { useEffect, useRef, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { App } from './app'
import { SeoHead } from './components/seo-head'
import { LandingContent } from './components/landing-content'
import { getPageBySlug } from './seo'
import { decodeDiff } from './share'
import { languages } from './config'

interface Props {
  slug: string
}

export function DiffPage({ slug }: Props) {
  const page = getPageBySlug(slug)
  const [sharedData, setSharedData] = useState<{ original: string; modified: string } | null>(null)
  const [langOverride, setLangOverride] = useState<string | null>(null)
  const decoded = useRef(false)

  // Decode shared diff and lang param from URL search params
  useEffect(() => {
    if (decoded.current) return
    decoded.current = true

    const params = new URLSearchParams(window.location.search)
    const d = params.get('d')
    const langParam = params.get('lang')

    if (d) {
      decodeDiff(d).then((result) => {
        if (result) setSharedData(result)
      })
    }

    if (langParam && (langParam === 'auto' || languages.some((l) => l.id === langParam))) {
      setLangOverride(langParam)
    }
  }, [])

  const effectiveLanguage = langOverride ?? page.language

  return (
    <>
      <SeoHead page={page} />
      <App
        defaultLanguage={effectiveLanguage}
        initialOriginal={sharedData?.original}
        initialModified={sharedData?.modified}
        slug={slug}
      />
      <LandingContent page={page} isHome={slug === '/'} />
    </>
  )
}
