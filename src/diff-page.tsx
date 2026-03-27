import { useEffect, useRef, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { App } from './app'
import { SeoHead } from './components/seo-head'
import { LandingContent } from './components/landing-content'
import { getPageBySlug } from './seo'
import { decodeDiff } from './share'

interface Props {
  slug: string
}

export function DiffPage({ slug }: Props) {
  const page = getPageBySlug(slug)
  const [sharedData, setSharedData] = useState<{ original: string; modified: string } | null>(null)
  const decoded = useRef(false)

  // Decode shared diff from URL search params
  useEffect(() => {
    if (decoded.current) return
    decoded.current = true

    const params = new URLSearchParams(window.location.search)
    const d = params.get('d')
    if (d) {
      decodeDiff(d).then((result) => {
        if (result) setSharedData(result)
      })
    }
  }, [])

  return (
    <>
      <SeoHead page={page} />
      <App
        defaultLanguage={page.language}
        initialOriginal={sharedData?.original}
        initialModified={sharedData?.modified}
        slug={slug}
      />
      <LandingContent page={page} isHome={slug === '/'} />
    </>
  )
}
