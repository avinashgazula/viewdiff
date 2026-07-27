# viewdiff

A client-side diff checker. Compares text, code, and structured data in the
browser — nothing is uploaded.

Live at [viewdiff.app](https://viewdiff.app).

## Development

```bash
bun install
bun run dev        # vite dev server
bun run build      # vite build + static pre-render + sitemap
bun run preview    # build, then serve through wrangler
bun run deploy     # build, then deploy to Cloudflare
```

## How pages are generated

Every route is defined once, in `src/seo.ts`. Adding an entry to `pages` gives
you, with no other edits:

- a client route (`src/routes.tsx`)
- a pre-rendered `dist/<slug>/index.html` with page-specific title, description,
  canonical URL, Open Graph tags, JSON-LD, and visible landing copy
  (`scripts/ssg.ts`)
- a sitemap entry with a current `lastmod`

Give any new page a short label in `NAV_LABELS` at the bottom of `src/seo.ts` —
that string becomes the anchor text of every internal link pointing at it.

### Two rules worth keeping

**Landing content must stay visible.** It sits below the tool and the page
scrolls to reach it. It was previously rendered into a container that could
never be scrolled to, and the pre-rendered copy was pushed off-screen with
`left: -9999px`. Both made every word of it hidden text, which search engines
discount and which is against Google's spam policies. If you change the layout,
check that `.landing-content` is reachable by scrolling.

**Pages need a reason to exist.** The one-per-language pages are already close
to templated near-duplicates of each other. Publishing many more pages that
differ only by a language name risks Google's scaled-content and doorway-page
policies, which costs the whole domain rather than just the new pages. Prefer
pages built around a distinct task — see `/env-file-diff`, `/compare-lists`,
`/kubernetes-yaml-diff` — with content actually written for that task.

## Measuring traffic

Two build-time environment variables, both optional and both off by default.
Set them in the Cloudflare deploy environment and rebuild; `scripts/ssg.ts`
injects the tags into every generated page.

| Variable | What it enables |
| --- | --- |
| `GSC_VERIFICATION` | Google Search Console verification token |
| `CF_ANALYTICS_TOKEN` | Cloudflare Web Analytics beacon (cookieless) |

**Search Console is the one that matters**, and it cannot be automated — it
needs an account that owns the domain:

1. Add `viewdiff.app` as a property at
   [search.google.com/search-console](https://search.google.com/search-console).
2. Choose HTML-tag verification and copy the `content` value.
3. Set it as `GSC_VERIFICATION` in the Cloudflare project, then redeploy.
4. Submit `https://viewdiff.app/sitemap.xml` under Sitemaps.
5. Use **URL Inspection → Request indexing** on the homepage so the layout fix
   gets recrawled rather than waiting for the natural cycle.

Until step 3 is done there is no data on impressions, clicks, average position,
or which queries the site actually surfaces for — so there is no way to tell a
ranking problem from a click-through problem.

## Distribution

Ranking for head terms like "diff checker" or "json diff" means displacing
established sites with large backlink profiles. That is a slow fight and it is
not won with on-page work alone. On-page changes make the site *eligible* to
rank; links and direct usage are what move it.

The parts that cannot be done from this repository, roughly in order of
return:

- **Get the first backlinks.** A new domain with none has no way to compete.
  Dev-tool directories, "awesome" lists, and relevant answers on Stack Overflow
  or Reddit are the usual starting points.
- **Post it somewhere developers are.** Hacker News (Show HN), r/webdev,
  r/devtools, Product Hunt, Lobsters. Privacy — no upload, no account — is the
  angle that differentiates it from the incumbents.
- **Answer the long-tail queries directly.** The workflow pages exist to be
  linked from real answers to real questions.

Anything that involves posting under an identity or verifying domain ownership
needs the account holder; it is deliberately not automated here.
