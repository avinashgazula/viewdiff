/**
 * SSG (Static Site Generation) post-build script.
 *
 * Runs after `vite build` and generates a dedicated HTML file for every route
 * defined in src/seo.ts.  Each file contains:
 *   - Correct <title>, <meta description>, <link rel="canonical">
 *   - Open Graph and Twitter meta tags
 *   - JSON-LD structured data (WebApplication, FAQPage, BreadcrumbList, WebPage)
 *   - Pre-rendered landing content (h1, features, FAQ, internal links)
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
const { pages, canonicalUrl, navLabel } = seoModule

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

/**
 * Head tags that depend on deployment secrets rather than page content.
 *
 * Both are opt-in via environment variables so the values never live in the
 * repo. Set them in the Cloudflare deploy environment (or a local .env) and
 * rebuild — no code change required:
 *
 *   GSC_VERIFICATION   Google Search Console verification token. Without this
 *                      there is no way to see impressions, clicks, average
 *                      position, or to submit the sitemap for indexing.
 *   CF_ANALYTICS_TOKEN Cloudflare Web Analytics beacon token. Cookieless and
 *                      client-side only, so it does not undercut the privacy
 *                      claim the site is built on.
 */
function buildDeploymentTags(): string {
  const tags: string[] = []

  const gsc = process.env.GSC_VERIFICATION
  if (gsc) {
    tags.push(`<meta name="google-site-verification" content="${escAttr(gsc)}" />`)
  }

  const cfToken = process.env.CF_ANALYTICS_TOKEN
  if (cfToken) {
    tags.push(
      `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token: cfToken })}'></script>`,
    )
  }

  return tags.length ? `\n    ${tags.join('\n    ')}\n` : ''
}

const deploymentTags = buildDeploymentTags()

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
        <h1>${escHtml(page.h1)}</h1>
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
          <a href="${p.slug}/">${escHtml(navLabel(p.slug))}</a>`).join('')}
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

  // 3. Replace canonical URL
  html = html.replace(
    /<link rel="canonical" href="[^"]*"/,
    `<link rel="canonical" href="${escAttr(url)}"`,
  )

  // 4. Replace OG tags
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
  html = html.replace(
    /<meta property="og:image:alt" content="[^"]*"/,
    `<meta property="og:image:alt" content="${escAttr(page.h1)}"`,
  )

  // 5. Replace Twitter tags
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*"/,
    `<meta name="twitter:title" content="${escAttr(page.title)}"`,
  )
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*"/,
    `<meta name="twitter:description" content="${escAttr(page.description)}"`,
  )

  // 6. Replace all structured data scripts with page-specific ones
  html = html.replace(
    /<!-- Structured Data:[\s\S]*?(?=<link rel="icon")/,
    `<!-- Structured Data -->\n    ${buildStructuredData(page)}\n\n    `,
  )

  // 7. Replace pre-rendered SEO content
  html = html.replace(
    /<!-- Pre-rendered SEO content[\s\S]*?<\/div>\s*(?=<\/div>\s*<noscript>)/,
    `<!-- Pre-rendered SEO content: visible to crawlers before JS loads -->${buildPrerenderedContent(page)}\n    `,
  )

  // 8. Inject deployment-specific head tags (search console, analytics)
  if (deploymentTags) {
    html = html.replace('</head>', `${deploymentTags}  </head>`)
  }

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

if (!process.env.GSC_VERIFICATION) {
  console.warn(
    '⚠️  GSC_VERIFICATION is not set — Search Console is unverified, so search\n' +
    '   impressions and clicks are not being measured and the sitemap cannot\n' +
    '   be submitted. See README "Measuring traffic".',
  )
}

// Show what was created
for (const page of pages) {
  const path = page.slug === '/' ? '/index.html' : `${page.slug}/index.html`
  console.log(`   ${path}`)
}

// ---------------------------------------------------------------------------
// Sitemap — derived from the same page list that produced the HTML above.
// Hand-maintaining public/sitemap.xml meant it drifted out of sync with
// src/seo.ts and carried a frozen <lastmod> that never reflected reality.
// ---------------------------------------------------------------------------
const lastmod = new Date().toISOString().slice(0, 10)

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map((page: (typeof pages)[0]) => {
    const isHome = page.slug === '/'
    return `  <url>
    <loc>${canonicalUrl(page.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${isHome ? 'weekly' : 'monthly'}</changefreq>
    <priority>${isHome ? '1.0' : '0.8'}</priority>
  </url>`
  })
  .join('\n')}
</urlset>
`

writeFileSync(resolve(DIST, 'sitemap.xml'), sitemap, 'utf-8')
console.log(`\n✅ Sitemap: ${pages.length} URLs (lastmod ${lastmod})`)
