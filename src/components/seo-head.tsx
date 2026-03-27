import { useEffect } from 'react'
import type { PageSeo } from '../seo'
import { canonicalUrl } from '../seo'

const BASE_URL = 'https://viewdiff.app'

interface Props {
  page: PageSeo
}

export function SeoHead({ page }: Props) {
  useEffect(() => {
    document.title = page.title

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    const url = canonicalUrl(page.slug)

    setMeta('name', 'description', page.description)
    setMeta('name', 'keywords', page.keywords)

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', url)

    // Open Graph
    setMeta('property', 'og:title', page.title)
    setMeta('property', 'og:description', page.description)
    setMeta('property', 'og:url', url)
    setMeta('property', 'og:type', 'website')
    setMeta('property', 'og:site_name', 'viewdiff')

    // Twitter
    setMeta('name', 'twitter:title', page.title)
    setMeta('name', 'twitter:description', page.description)

    // --- Structured Data: multiple schemas ---
    const schemas: Record<string, unknown>[] = []

    // 1. WebApplication schema
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'viewdiff',
      alternateName: ['Diff Checker', 'Online Diff Tool', 'Text Compare Tool', 'Code Diff Tool'],
      url: BASE_URL,
      description: page.description,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires a modern web browser with JavaScript',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: page.features,
      author: {
        '@type': 'Person',
        name: 'Avinash Gazula',
      },
    })

    // 2. FAQPage schema (for rich snippets in Google)
    if (page.faq.length > 0) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: page.faq.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: a,
          },
        })),
      })
    }

    // 3. BreadcrumbList for sub-pages
    if (page.slug !== '/') {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Diff Checker',
            item: BASE_URL,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: page.h1,
            item: url,
          },
        ],
      })
    }

    // 4. WebPage schema with speakable
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.title,
      description: page.description,
      url,
      isPartOf: {
        '@type': 'WebSite',
        name: 'viewdiff',
        url: BASE_URL,
      },
      about: {
        '@type': 'SoftwareApplication',
        name: 'viewdiff',
        applicationCategory: 'DeveloperApplication',
      },
    })

    // Write all schemas
    const ldId = 'ld-json-page'
    let ld = document.getElementById(ldId) as HTMLScriptElement | null
    if (!ld) {
      ld = document.createElement('script')
      ld.id = ldId
      ld.type = 'application/ld+json'
      document.head.appendChild(ld)
    }
    ld.textContent = JSON.stringify(schemas)
  }, [page])

  return null
}
