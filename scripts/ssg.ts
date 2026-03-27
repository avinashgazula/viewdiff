/**
 * SSG (Static Site Generation) post-build script.
 *
 * Runs after `vite build` and generates a dedicated HTML file for every route
 * defined in src/seo.ts.  Each file contains:
 *   - Correct <title>, <meta description>, <meta keywords>, <link rel="canonical">
 *   - Open Graph and Twitter meta tags
 *   - JSON-LD structured data (WebApplication, FAQPage, BreadcrumbList, WebPage)
 *   - Pre-rendered landing content (h2, features, FAQ, internal links)
 *   - The same JS/CSS bundle references so the SPA hydrates on top
 *
 * The result: search-engine crawlers get full, keyword-rich HTML for every page
 * without needing to execute JavaScript.
 *
 * Usage:  npx tsx scripts/ssg.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// ---------------------------------------------------------------------------
// Import page data from seo.ts
// ---------------------------------------------------------------------------
// We use dynamic import so TypeScript path resolution works with tsx runner
const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const seoModule = await import(pathToFileURL(resolve(root, 'src/seo.ts')).href)
const { pages, canonicalUrl } = seoModule

const BASE_URL = 'https://viewdiff.app'
const DIST = resolve(root, 'dist')

// ---------------------------------------------------------------------------
// Read the built index.html as our template
// ---------------------------------------------------------------------------
const template = readFileSync(resolve(DIST, 'index.html'), 'utf-8')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function escAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/&/g, '&amp;')
}

/** Build JSON-LD structured data for a page */
function buildStructuredData(page: (typeof pages)[0]): string {
  const url = canonicalUrl(page.slug)
  const schemas: unknown[] = []

  // WebApplication
  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'viewdiff',
    alternateName: ['Diff Checker', 'Online Diff Tool', 'Text Compare Tool', 'Code Diff Tool', 'viewdiff.app'],
    url: BASE_URL,
    description: page.description,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any',
    browserRequirements: 'Requires a modern web browser with JavaScript',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@type': 'Person', name: 'Avinash Gazula' },
    featureList: page.features,
  })

  // FAQPage
  if (page.faq.length > 0) {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faq.map(({ q, a }: { q: string; a: string }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    })
  }

  // BreadcrumbList (sub-pages only)
  if (page.slug !== '/') {
    schemas.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Diff Checker', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: page.h1, item: url },
      ],
    })
  }

  // WebPage
  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    description: page.description,
    url,
    isPartOf: { '@type': 'WebSite', name: 'viewdiff', url: BASE_URL },
    about: { '@type': 'SoftwareApplication', name: 'viewdiff', applicationCategory: 'DeveloperApplication' },
  })

  return schemas.map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`).join('\n    ')
}

/** Build pre-rendered SEO content for a page */
function buildPrerenderedContent(page: (typeof pages)[0]): string {
  const isHome = page.slug === '/'
  const otherPages = pages.filter((p: (typeof pages)[0]) => p.slug !== page.slug && p.slug !== '/')

  let html = `
      <div class="seo-prerender">
        <h2>${escHtml(page.h1)}</h2>
        <p>${escHtml(page.intro)}</p>`

  // "How it works" for homepage
  if (isHome) {
    html += `
        <h3>How to compare text online</h3>
        <ol>
          <li><strong>Paste</strong> your original text on the left side</li>
          <li><strong>Paste</strong> the modified text on the right side</li>
          <li><strong>See differences</strong> highlighted instantly — additions in green, deletions in red</li>
        </ol>

        <h3>Why developers choose viewdiff</h3>
        <dl>
          <dt>100% private</dt>
          <dd>Your text never leaves your browser. No server uploads, no data collection, no cookies.</dd>
          <dt>Instant — no loading, no friction</dt>
          <dd>Paste and see diffs immediately. No waiting for server processing, no CAPTCHA, no sign-up walls.</dd>
          <dt>30+ languages with syntax highlighting</dt>
          <dd>JavaScript, Python, JSON, YAML, HTML, CSS, Go, Rust, Java, C++, and more.</dd>
          <dt>Auto-format with Prettier</dt>
          <dd>Format messy or minified code before comparing. One click to normalize both sides.</dd>
          <dt>Free forever, no ads</dt>
          <dd>No premium tiers, no feature gates, no ads. Every feature is free with no usage limits.</dd>
        </dl>`
  }

  // Features
  html += `
        <h3>Features</h3>
        <ul>${page.features.map((f: string) => `
          <li>${escHtml(f)}</li>`).join('')}
        </ul>`

  // FAQ
  if (page.faq.length > 0) {
    html += `
        <h3>Frequently asked questions</h3>
        <dl>${page.faq.map(({ q, a }: { q: string; a: string }) => `
          <dt>${escHtml(q)}</dt>
          <dd>${escHtml(a)}</dd>`).join('')}
        </dl>`
  }

  // Internal links
  html += `
        <h3>More diff tools</h3>
        <nav>${otherPages.map((p: (typeof pages)[0]) => `
          <a href="${p.slug}">${escHtml(p.h1.replace('Compare two ', '').replace(' files', '').replace(' online', '').replace(' scripts', ''))} diff</a>`).join('')}
        </nav>
      </div>`

  return html
}

// ---------------------------------------------------------------------------
// Generate HTML for each page
// ---------------------------------------------------------------------------
let generated = 0

for (const page of pages) {
  const url = canonicalUrl(page.slug)
  let html = template

  // 1. Replace <title>
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escHtml(page.title)}</title>`)

  // 2. Replace meta description
  html = html.replace(
    /<meta name="description" content="[^"]*"/,
    `<meta name="description" content="${escAttr(page.description)}"`,
  )

  // 3. Replace meta keywords
  html = html.replace(
    /<meta name="keywords" content="[^"]*"/,
    `<meta name="keywords" content="${escAttr(page.keywords)}"`,
  )

  // 4. Replace canonical URL
  html = html.replace(
    /<link rel="canonical" href="[^"]*"/,
    `<link rel="canonical" href="${escAttr(url)}"`,
  )

  // 5. Replace OG tags
  html = html.replace(
    /<meta property="og:title" content="[^"]*"/,
    `<meta property="og:title" content="${escAttr(page.title)}"`,
  )
  html = html.replace(
    /<meta property="og:description" content="[^"]*"/,
    `<meta property="og:description" content="${escAttr(page.description)}"`,
  )
  html = html.replace(
    /<meta property="og:url" content="[^"]*"/,
    `<meta property="og:url" content="${escAttr(url)}"`,
  )

  // 6. Replace Twitter tags
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*"/,
    `<meta name="twitter:title" content="${escAttr(page.title)}"`,
  )
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*"/,
    `<meta name="twitter:description" content="${escAttr(page.description)}"`,
  )

  // 7. Replace all structured data scripts with page-specific ones
  html = html.replace(
    /<!-- Structured Data:[\s\S]*?(?=<link rel="icon")/,
    `<!-- Structured Data -->\n    ${buildStructuredData(page)}\n\n    `,
  )

  // 8. Replace pre-rendered SEO content
  html = html.replace(
    /<!-- Pre-rendered SEO content[\s\S]*?<\/div>\s*(?=<\/div>\s*<noscript>)/,
    `<!-- Pre-rendered SEO content: visible to crawlers before JS loads -->${buildPrerenderedContent(page)}\n    `,
  )

  // 9. Write the file
  if (page.slug === '/') {
    // Homepage — overwrite the existing index.html
    writeFileSync(resolve(DIST, 'index.html'), html, 'utf-8')
  } else {
    // Sub-pages — create /slug/index.html
    const dir = resolve(DIST, page.slug.replace(/^\//, ''))
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(resolve(dir, 'index.html'), html, 'utf-8')
  }

  generated++
}

console.log(`\n✅ SSG: Generated ${generated} pre-rendered HTML files in dist/`)

// Show what was created
for (const page of pages) {
  const path = page.slug === '/' ? '/index.html' : `${page.slug}/index.html`
  console.log(`   ${path}`)
}
