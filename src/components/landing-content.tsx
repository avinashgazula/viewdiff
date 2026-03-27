import { memo } from 'react'
import { Link } from '@tanstack/react-router'
import type { PageSeo } from '../seo'
import { pages } from '../seo'

interface Props {
  page: PageSeo
  isHome?: boolean
}

export const LandingContent = memo(function LandingContent({ page, isHome }: Props) {
  const otherPages = pages.filter((p) => p.slug !== page.slug && p.slug !== '/')

  return (
    <section className="landing-content" aria-label="About this tool">
      {/* Intro */}
      <div className="landing-hero">
        <h2 className="landing-h1">{page.h1}</h2>
        <p className="landing-subtitle">{page.subtitle}</p>
        <p className="landing-intro">{page.intro}</p>
      </div>

      {/* How it works — only on homepage */}
      {isHome && (
        <div className="landing-section">
          <h3 className="landing-h3">How to compare text online</h3>
          <ol className="landing-steps">
            <li><strong>Paste</strong> your original text on the left side</li>
            <li><strong>Paste</strong> the modified text on the right side</li>
            <li><strong>See differences</strong> highlighted instantly — additions in green, deletions in red</li>
          </ol>
          <p className="landing-intro">
            That's it — no buttons to click, no accounts to create. viewdiff auto-detects the language and highlights differences in real-time as you type or paste.
          </p>
        </div>
      )}

      {/* Why viewdiff — only on homepage */}
      {isHome && (
        <div className="landing-section">
          <h3 className="landing-h3">Why developers choose viewdiff</h3>
          <dl className="landing-faq">
            <div className="landing-faq-item">
              <dt>100% private</dt>
              <dd>Your text never leaves your browser. No server uploads, no data collection, no cookies. Compare sensitive code and configs with confidence.</dd>
            </div>
            <div className="landing-faq-item">
              <dt>Instant — no loading, no friction</dt>
              <dd>Paste and see diffs immediately. No waiting for server processing, no CAPTCHA, no "create an account" walls. The tool loads in under a second.</dd>
            </div>
            <div className="landing-faq-item">
              <dt>30+ languages with syntax highlighting</dt>
              <dd>JavaScript, Python, JSON, YAML, HTML, CSS, Go, Rust, Java, C++, and more — all with proper syntax coloring and auto-detection.</dd>
            </div>
            <div className="landing-faq-item">
              <dt>Auto-format with Prettier</dt>
              <dd>Format messy or minified code before comparing. One click to normalize both sides, so you only see meaningful changes.</dd>
            </div>
            <div className="landing-faq-item">
              <dt>Free forever, no ads</dt>
              <dd>No premium tiers, no feature gates, no ads. Every feature is free with no usage limits.</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Features */}
      <div className="landing-section">
        <h3 className="landing-h3">Features</h3>
        <ul className="landing-features">
          {page.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>

      {/* FAQ */}
      {page.faq.length > 0 && (
        <div className="landing-section">
          <h3 className="landing-h3">Frequently asked questions</h3>
          <dl className="landing-faq">
            {page.faq.map(({ q, a }) => (
              <div key={q} className="landing-faq-item">
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Internal links to other diff tools */}
      <div className="landing-section">
        <h3 className="landing-h3">More diff tools</h3>
        <nav className="landing-links" aria-label="Other diff tools">
          {otherPages.map((p) => (
            <Link key={p.slug} to={p.slug} className="landing-link">
              {p.h1.replace('Compare two ', '').replace(' files', '').replace(' online', '').replace(' scripts', '')} diff
            </Link>
          ))}
        </nav>
      </div>
    </section>
  )
})
