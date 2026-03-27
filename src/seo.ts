export interface PageSeo {
  slug: string
  language: string
  title: string
  description: string
  keywords: string
  h1: string
  subtitle: string
  intro: string
  exampleOriginal: string
  exampleModified: string
  features: string[]
  faq: Array<{ q: string; a: string }>
}

const BASE_URL = 'https://viewdiff.app'

export function canonicalUrl(slug: string): string {
  return slug === '/' ? BASE_URL : `${BASE_URL}${slug}`
}

export const pages: PageSeo[] = [
  {
    slug: '/',
    language: 'auto',
    title: 'Diff Checker Online — Compare Text, Code & Files Free | viewdiff',
    description:
      'Free online diff checker to compare text, code, JSON, XML, YAML and more. Side-by-side or inline diff view with syntax highlighting for 30+ languages. No sign-up, no ads — paste and compare instantly. The fastest alternative to Diffchecker.',
    keywords:
      'diff checker, diffchecker, text compare, compare text online, online diff, diff tool, text diff, compare two texts, find difference between two texts, code diff, compare code online, side by side comparison, compare strings online, text comparison tool, diff online, compare files online, json diff, xml diff, yaml diff, css diff, html diff, javascript diff, python diff, compare two strings, string diff, text difference finder, online text compare, free diff tool, code comparison tool, compare two files online',
    h1: 'Online diff checker — compare text, code & data',
    subtitle: 'The fastest way to find differences between two texts. Paste, compare, done — no sign-up, no uploads, no ads.',
    intro: 'viewdiff is a free online diff checker that compares any two texts and highlights every difference instantly. It supports 30+ programming languages with syntax highlighting, auto-formats code with Prettier, and runs 100% client-side — your data never leaves your browser. Use it to compare text, code, JSON, XML, YAML, HTML, CSS, SQL, and more. Side-by-side or inline view, ignore whitespace, share diffs via URL.',
    exampleOriginal: `{
  "name": "diff-tool",
  "version": "1.0.0",
  "private": true
}`,
    exampleModified: `{
  "name": "diff-tool",
  "version": "2.0.0",
  "private": false,
  "license": "MIT"
}`,
    features: [
      'Compare text, code, and data side-by-side or inline',
      'Syntax highlighting for 30+ languages',
      'Auto-format code with Prettier before comparing',
      'Automatic language detection',
      'Ignore whitespace and case differences',
      'Share diffs via URL — no account needed',
      'Dark and light themes',
      'Keyboard shortcuts and command palette',
      '100% client-side — your data never leaves your browser',
      'No ads, no sign-up, no usage limits',
    ],
    faq: [
      { q: 'What is a diff checker?', a: 'A diff checker is a tool that compares two pieces of text and highlights the differences between them. It shows additions, deletions, and changes line by line — similar to "diff" on the command line, but with a visual interface.' },
      { q: 'Is this diff checker free?', a: 'Yes, completely free with no ads, no sign-up, and no usage limits. viewdiff is free to use for any purpose.' },
      { q: 'How do I compare two texts online?', a: 'Paste the original text on the left and the modified text on the right. Differences are highlighted instantly — no buttons to click.' },
      { q: 'Is my data sent to a server?', a: 'No. viewdiff runs 100% client-side in your browser. Your text is never uploaded, stored, or shared with any server. It is completely private.' },
      { q: 'What languages are supported?', a: 'Over 30 languages including JavaScript, TypeScript, Python, Java, C++, C#, Go, Rust, Ruby, PHP, Swift, Kotlin, JSON, XML, YAML, HTML, CSS, SCSS, SQL, Shell, GraphQL, Markdown, Dockerfile, and more.' },
      { q: 'Can I compare JSON files?', a: 'Yes — viewdiff has a dedicated JSON diff tool that auto-formats your JSON with Prettier and highlights every difference with syntax-aware coloring.' },
      { q: 'Can I compare code from different programming languages?', a: 'Yes. Paste any code and viewdiff auto-detects the language, applies syntax highlighting, and shows differences. You can also manually select a language.' },
      { q: 'Can I share a diff with someone?', a: 'Yes — click the Share button to generate a URL that encodes both texts. Anyone with the link sees the exact same diff. No account required.' },
      { q: 'What is the difference between side-by-side and inline view?', a: 'Side-by-side view shows the original and modified text in two columns. Inline view shows changes in a single column with additions and deletions interleaved — similar to a unified diff.' },
      { q: 'Can I ignore whitespace differences?', a: 'Yes — open Settings and toggle "Ignore whitespace" to hide formatting-only changes and focus on meaningful differences.' },
      { q: 'How is this different from Diffchecker?', a: 'viewdiff is completely free with no ads, runs entirely in your browser (your data stays private), supports 30+ languages with syntax highlighting, and auto-formats code with Prettier. No account needed.' },
      { q: 'Can I use this as a code comparison tool?', a: 'Yes. viewdiff is built for developers — it includes syntax highlighting, auto-formatting, keyboard shortcuts, and a command palette. It works great for reviewing code changes, comparing pull requests, and debugging.' },
    ],
  },
  {
    slug: '/diff-text',
    language: 'plaintext',
    title: 'Compare Text Online Free — Find Differences Between Two Texts',
    description:
      'Compare two texts online and instantly see every difference highlighted. Free text diff tool with side-by-side view, ignore whitespace, and shareable links. Faster than Diffchecker — no sign-up, no ads.',
    keywords:
      'compare text online, text diff, diff text online, find difference between two texts, compare two strings, compare two texts online, text comparison tool, string diff, text difference finder, compare strings online, find differences in text, online text compare, compare text files, side by side text compare, text compare tool free, diff text, compare two paragraphs, spot the difference text',
    h1: 'Compare two texts online',
    subtitle: 'Paste any two pieces of text and instantly see every addition, deletion, and change — no sign-up, no ads.',
    intro: 'Need to quickly spot the differences between two blocks of text? This free online text diff tool highlights every change line-by-line. Perfect for comparing drafts, config changes, copy edits, or any two strings. No file uploads, no sign-up — just paste and compare. Works entirely in your browser so your text stays private.',
    exampleOriginal: `The quick brown fox jumps over the lazy dog.
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
    exampleModified: `The quick brown fox leaps over the lazy dog.
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna.
Ut enim ad minim veniam.`,
    features: [
      'Instant line-by-line text comparison',
      'Side-by-side and inline views',
      'Ignore whitespace differences',
      'Ignore case differences',
      'Word wrap for long lines',
      'Share comparison via URL',
    ],
    faq: [
      { q: 'How do I compare two texts?', a: 'Paste the original text on the left and the modified text on the right. Differences are highlighted instantly — no buttons to click.' },
      { q: 'Can I ignore whitespace?', a: 'Yes — open Settings and toggle "Ignore whitespace" to focus on meaningful changes only.' },
      { q: 'Can I compare large texts?', a: 'Yes. The editor handles large documents efficiently with virtualized rendering.' },
      { q: 'Is this the same as diff on the command line?', a: 'Similar concept, but with a visual, color-coded UI instead of +/- markers. You can switch between side-by-side and inline views.' },
      { q: 'How do I find the difference between two strings?', a: 'Paste both strings into the editor — one on each side. Every character-level change is highlighted in green (additions) or red (deletions).' },
      { q: 'Can I compare two paragraphs?', a: 'Yes. Paste any text — paragraphs, sentences, documents, or code — and see differences instantly.' },
      { q: 'Is my text private?', a: 'Yes. viewdiff runs 100% in your browser. Your text is never uploaded to any server.' },
      { q: 'Can I share the comparison?', a: 'Yes — click Share to get a URL that anyone can open to see the same diff.' },
    ],
  },
  {
    slug: '/json-diff',
    language: 'json',
    title: 'JSON Diff — Compare JSON Files Online Free | viewdiff',
    description:
      'Compare two JSON files online and see differences highlighted. Free JSON diff tool with auto-formatting, syntax highlighting, and side-by-side view. Format minified JSON, compare API responses, and share diffs. No sign-up.',
    keywords:
      'json diff, compare json, json compare, compare two json files online, json difference, json diff tool, json comparison, diff json online, json diff checker, compare json objects, json file compare, json diff online free, compare two json objects, json compare tool, find difference between two json files, json schema diff, compare json api response',
    h1: 'Compare two JSON files',
    subtitle: 'Paste JSON on each side — differences are highlighted instantly with syntax coloring and auto-formatting.',
    intro: 'Quickly find differences between two JSON documents. This free JSON diff tool auto-formats your JSON with Prettier, highlights every change with syntax-aware coloring, and lets you toggle between side-by-side and inline views. Great for comparing API responses, config files, package.json changes, or any JSON data. Paste minified JSON and format it with one click.',
    exampleOriginal: `{
  "users": [
    { "id": 1, "name": "Alice", "role": "admin" },
    { "id": 2, "name": "Bob", "role": "editor" }
  ],
  "settings": {
    "theme": "light",
    "notifications": true
  }
}`,
    exampleModified: `{
  "users": [
    { "id": 1, "name": "Alice", "role": "admin" },
    { "id": 2, "name": "Bob", "role": "viewer" },
    { "id": 3, "name": "Charlie", "role": "editor" }
  ],
  "settings": {
    "theme": "dark",
    "notifications": true,
    "language": "en"
  }
}`,
    features: [
      'Auto-format JSON with Prettier',
      'Syntax-highlighted diff view',
      'Side-by-side and inline comparison',
      'Validates JSON structure',
      'Ignore whitespace for formatting-only changes',
      'Share JSON diff via URL',
    ],
    faq: [
      { q: 'Does this tool format my JSON?', a: 'Yes — click Format (or Ctrl+Shift+F) to auto-format both sides with Prettier before comparing.' },
      { q: 'Can I compare minified JSON?', a: 'Absolutely. Paste minified JSON and hit Format to pretty-print it, then compare easily.' },
      { q: 'Does it validate JSON?', a: 'The syntax highlighter will flag invalid JSON with error markers in the editor gutter.' },
      { q: 'Can I compare JSON API responses?', a: 'Yes — paste any two JSON payloads and instantly see what changed between them.' },
      { q: 'How do I find the difference between two JSON files?', a: 'Paste the first JSON on the left and the second on the right. Every key, value, and structural change is highlighted instantly.' },
      { q: 'Can I compare JSON objects?', a: 'Yes. Paste any two JSON objects or arrays. Click Format to normalize both, then compare.' },
      { q: 'Is the JSON diff tool free?', a: 'Yes, completely free with no ads, no sign-up, and no limits. Your JSON data stays in your browser.' },
    ],
  },
  {
    slug: '/xml-diff',
    language: 'xml',
    title: 'XML Diff — Compare XML Files Online Free',
    description:
      'Compare two XML files online with syntax highlighting and auto-formatting. Free XML diff tool with side-by-side view. No sign-up required.',
    keywords:
      'xml diff, compare xml, xml compare, compare two xml files online, xml difference, xml diff tool, xml comparison',
    h1: 'Compare two XML files',
    subtitle: 'Paste XML documents on each side and see every difference highlighted with syntax coloring.',
    intro: 'Find differences between two XML documents instantly. This free XML diff tool provides syntax highlighting, auto-formatting with Prettier, and color-coded diffs. Perfect for comparing configuration files, SOAP responses, SVG files, or any XML data.',
    exampleOriginal: `<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <book id="1">
    <title>The Great Gatsby</title>
    <author>F. Scott Fitzgerald</author>
    <price>10.99</price>
  </book>
  <book id="2">
    <title>1984</title>
    <author>George Orwell</author>
    <price>8.99</price>
  </book>
</catalog>`,
    exampleModified: `<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <book id="1">
    <title>The Great Gatsby</title>
    <author>F. Scott Fitzgerald</author>
    <price>12.99</price>
  </book>
  <book id="2">
    <title>1984</title>
    <author>George Orwell</author>
    <price>9.99</price>
    <inStock>true</inStock>
  </book>
</catalog>`,
    features: [
      'XML syntax highlighting',
      'Auto-format XML with Prettier',
      'Side-by-side and inline views',
      'Handles large XML documents',
      'Tag-aware coloring',
      'Share XML diff via URL',
    ],
    faq: [
      { q: 'Does it format XML?', a: 'Yes — click Format to auto-indent and pretty-print your XML with Prettier before comparing.' },
      { q: 'Can I compare SOAP or SVG files?', a: 'Yes. Any valid XML including SOAP responses, SVG markup, RSS feeds, and config files.' },
      { q: 'Does it handle XML namespaces?', a: 'Yes — the syntax highlighter and diff engine handle namespaced XML correctly.' },
    ],
  },
  {
    slug: '/yaml-diff',
    language: 'yaml',
    title: 'YAML Diff — Compare YAML Files Online Free',
    description:
      'Compare two YAML files online with syntax highlighting. Free YAML diff tool with side-by-side view, perfect for Kubernetes configs and CI/CD pipelines. No sign-up.',
    keywords:
      'yaml diff, compare yaml, yaml compare, compare two yaml files online, yaml difference, yaml diff tool, kubernetes yaml diff',
    h1: 'Compare two YAML files',
    subtitle: 'Paste YAML on each side and instantly see differences highlighted.',
    intro: 'Spot differences between YAML files in seconds. Ideal for comparing Kubernetes manifests, Docker Compose files, CI/CD pipeline configs, Ansible playbooks, or any YAML data. Syntax highlighting makes it easy to read nested structures.',
    exampleOriginal: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  labels:
    app: web
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    spec:
      containers:
        - name: web
          image: nginx:1.21
          ports:
            - containerPort: 80`,
    exampleModified: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
  labels:
    app: web
    version: v2
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    spec:
      containers:
        - name: web
          image: nginx:1.25
          ports:
            - containerPort: 80
          resources:
            limits:
              memory: "128Mi"`,
    features: [
      'YAML syntax highlighting',
      'Indentation-aware comparison',
      'Side-by-side and inline views',
      'Ignore whitespace option',
      'Perfect for Kubernetes YAML',
      'Share YAML diff via URL',
    ],
    faq: [
      { q: 'Can I compare Kubernetes manifests?', a: 'Yes — this is perfect for comparing K8s deployments, services, ConfigMaps, and other YAML resources.' },
      { q: 'Does it handle nested YAML?', a: 'Yes. The diff engine compares line-by-line and the syntax highlighter colors nested structures correctly.' },
      { q: 'What about YAML anchors and aliases?', a: 'The tool compares the raw text, so anchors and aliases are compared as written.' },
    ],
  },
  {
    slug: '/javascript-diff',
    language: 'javascript',
    title: 'JavaScript Diff — Compare JS Code Online Free',
    description:
      'Compare two JavaScript files online with syntax highlighting and auto-formatting. Free JS diff tool with Prettier integration. No sign-up required.',
    keywords:
      'javascript diff, compare javascript, js diff, compare js files, javascript code comparison, diff javascript online, compare two javascript files',
    h1: 'Compare two JavaScript files',
    subtitle: 'Paste JS code on each side — get instant, syntax-highlighted diffs with auto-formatting.',
    intro: 'Compare JavaScript code with full syntax highlighting and Prettier auto-formatting. Perfect for reviewing code changes, comparing function implementations, or spotting bugs between versions. Supports ES6+, JSX, and modern JavaScript features.',
    exampleOriginal: `function fetchUsers() {
  return fetch('/api/users')
    .then(res => res.json())
    .then(data => {
      console.log(data);
      return data;
    });
}`,
    exampleModified: `async function fetchUsers() {
  try {
    const res = await fetch('/api/users');
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Failed to fetch users:', err);
    return [];
  }
}`,
    features: [
      'JavaScript & JSX syntax highlighting',
      'Auto-format with Prettier (Babel parser)',
      'ES6+ and modern JS support',
      'Side-by-side and inline views',
      'Ignore whitespace for style changes',
      'Share JS diff via URL',
    ],
    faq: [
      { q: 'Does it support JSX?', a: 'Yes — the JavaScript mode handles JSX syntax out of the box.' },
      { q: 'Can I format before comparing?', a: 'Yes — press Ctrl+Shift+F to auto-format both files with Prettier, eliminating formatting noise.' },
      { q: 'Does it support ES modules?', a: 'Yes. Import/export syntax, arrow functions, async/await, and all modern JS features are highlighted.' },
    ],
  },
  {
    slug: '/typescript-diff',
    language: 'typescript',
    title: 'TypeScript Diff — Compare TS Code Online Free',
    description:
      'Compare two TypeScript files online with syntax highlighting and auto-formatting. Free TS diff tool with Prettier integration. No sign-up required.',
    keywords:
      'typescript diff, compare typescript, ts diff, compare ts files, typescript code comparison, diff typescript online',
    h1: 'Compare two TypeScript files',
    subtitle: 'Paste TypeScript code on each side for instant, syntax-highlighted comparison.',
    intro: 'Compare TypeScript code with full type-annotation highlighting and Prettier auto-formatting. Supports interfaces, generics, enums, and all TypeScript features. Ideal for reviewing type changes, refactors, and version upgrades.',
    exampleOriginal: `interface User {
  id: number;
  name: string;
  email: string;
}

function getUser(id: number): Promise<User> {
  return fetch(\`/api/users/\${id}\`)
    .then(res => res.json());
}`,
    exampleModified: `interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

async function getUser(id: number): Promise<User | null> {
  const res = await fetch(\`/api/users/\${id}\`);
  if (!res.ok) return null;
  return res.json();
}`,
    features: [
      'TypeScript-aware syntax highlighting',
      'Auto-format with Prettier (TypeScript parser)',
      'Interface, generic, and enum support',
      'Side-by-side and inline views',
      'Ignore whitespace option',
      'Share TS diff via URL',
    ],
    faq: [
      { q: 'Does it understand TypeScript types?', a: 'Yes — interfaces, type aliases, generics, enums, and decorators are all syntax-highlighted.' },
      { q: 'Can I compare .tsx files?', a: 'Yes. TypeScript with JSX is fully supported.' },
      { q: 'Does it format TypeScript?', a: 'Yes — Prettier formats TypeScript including type annotations, preserving correct syntax.' },
    ],
  },
  {
    slug: '/python-diff',
    language: 'python',
    title: 'Python Diff — Compare Python Code Online Free',
    description:
      'Compare two Python files online with syntax highlighting. Free Python diff tool with side-by-side view. Perfect for reviewing code changes. No sign-up.',
    keywords:
      'python diff, compare python, python compare, compare two python files online, python code diff, diff python online',
    h1: 'Compare two Python files',
    subtitle: 'Paste Python code on each side and instantly see differences with syntax highlighting.',
    intro: 'Compare Python code with full syntax highlighting. Perfect for reviewing pull requests, comparing function implementations, spotting indentation issues, or tracking changes across versions. Supports Python 3 syntax including f-strings, type hints, and async/await.',
    exampleOriginal: `def calculate_total(items):
    total = 0
    for item in items:
        total += item['price'] * item['quantity']
    return total

def format_currency(amount):
    return f"\${amount:.2f}"`,
    exampleModified: `from typing import TypedDict

class Item(TypedDict):
    price: float
    quantity: int

def calculate_total(items: list[Item]) -> float:
    return sum(item['price'] * item['quantity'] for item in items)

def format_currency(amount: float) -> str:
    return f"\${amount:,.2f}"`,
    features: [
      'Python syntax highlighting',
      'Indentation-aware comparison',
      'Side-by-side and inline views',
      'Supports Python 3 syntax',
      'Ignore whitespace option',
      'Share Python diff via URL',
    ],
    faq: [
      { q: 'Does it handle Python indentation?', a: 'Yes — the diff engine compares indentation precisely, and you can toggle "Ignore whitespace" if needed.' },
      { q: 'Does it support type hints?', a: 'Yes. Python type annotations, f-strings, dataclasses, and all modern Python syntax are highlighted.' },
      { q: 'Can I compare Jupyter notebook code?', a: 'You can paste code cells from notebooks to compare them here.' },
    ],
  },
  {
    slug: '/css-diff',
    language: 'css',
    title: 'CSS Diff — Compare CSS Files Online Free',
    description:
      'Compare two CSS files online with syntax highlighting and auto-formatting. Free CSS diff tool with Prettier integration. No sign-up required.',
    keywords:
      'css diff, compare css, css compare, compare two css files online, css difference, css diff tool, stylesheet diff',
    h1: 'Compare two CSS files',
    subtitle: 'Paste CSS on each side to instantly see property changes, additions, and deletions.',
    intro: 'Compare CSS stylesheets with syntax highlighting and Prettier auto-formatting. Ideal for reviewing style changes, comparing design system updates, or spotting unintended overrides. Also supports SCSS and Less via the language selector.',
    exampleOriginal: `.header {
  display: flex;
  align-items: center;
  padding: 16px 24px;
  background: #ffffff;
  border-bottom: 1px solid #e0e0e0;
}

.header h1 {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}`,
    exampleModified: `.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #fafafa;
  border-bottom: 1px solid #eaeaea;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.header h1 {
  font-size: 16px;
  font-weight: 700;
  color: #111;
  letter-spacing: -0.02em;
}`,
    features: [
      'CSS syntax highlighting',
      'Auto-format with Prettier (PostCSS)',
      'Property-level change detection',
      'Side-by-side and inline views',
      'SCSS and Less support via selector',
      'Share CSS diff via URL',
    ],
    faq: [
      { q: 'Does it support SCSS and Less?', a: 'Yes — select SCSS or Less from the language dropdown and both formatting and highlighting adjust.' },
      { q: 'Can I format CSS before comparing?', a: 'Yes — Prettier formats CSS, SCSS, and Less to consistent style before you compare.' },
      { q: 'Does it handle CSS variables?', a: 'Yes. Custom properties (--var), calc(), and modern CSS features are all syntax-highlighted.' },
    ],
  },
  {
    slug: '/html-diff',
    language: 'html',
    title: 'HTML Diff — Compare HTML Files Online Free',
    description:
      'Compare two HTML files online with syntax highlighting and auto-formatting. Free HTML diff tool with Prettier integration. No sign-up required.',
    keywords:
      'html diff, compare html, html compare, compare two html files online, html difference, html diff tool, markup diff',
    h1: 'Compare two HTML files',
    subtitle: 'Paste HTML on each side and see tag-level differences highlighted instantly.',
    intro: 'Compare HTML markup with full syntax highlighting and Prettier auto-formatting. Perfect for reviewing template changes, comparing email HTML, or spotting differences in web page structure. Handles embedded CSS and JavaScript.',
    exampleOriginal: `<!DOCTYPE html>
<html lang="en">
<head>
  <title>My Page</title>
</head>
<body>
  <header>
    <h1>Welcome</h1>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
    </nav>
  </header>
</body>
</html>`,
    exampleModified: `<!DOCTYPE html>
<html lang="en">
<head>
  <title>My App</title>
  <meta name="description" content="A modern web app">
</head>
<body>
  <header>
    <h1>Welcome</h1>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/blog">Blog</a>
    </nav>
  </header>
</body>
</html>`,
    features: [
      'HTML tag and attribute highlighting',
      'Auto-format with Prettier',
      'Handles embedded CSS and JS',
      'Side-by-side and inline views',
      'Ignore whitespace for formatting changes',
      'Share HTML diff via URL',
    ],
    faq: [
      { q: 'Does it handle embedded CSS and JavaScript?', a: 'Yes — inline styles, script tags, and embedded CSS blocks are all syntax-highlighted.' },
      { q: 'Can I compare email HTML?', a: 'Yes. Paste any HTML including email templates and see differences highlighted.' },
      { q: 'Does it format HTML?', a: 'Yes — Prettier auto-formats your HTML including proper indentation of nested tags.' },
    ],
  },
  {
    slug: '/sql-diff',
    language: 'sql',
    title: 'SQL Diff — Compare SQL Queries Online Free',
    description:
      'Compare two SQL queries or schema files online with syntax highlighting. Free SQL diff tool with side-by-side view. No sign-up required.',
    keywords:
      'sql diff, compare sql, sql compare, compare two sql queries online, sql difference, sql diff tool, database diff',
    h1: 'Compare two SQL files',
    subtitle: 'Paste SQL queries on each side and see every difference highlighted.',
    intro: 'Compare SQL queries, schema definitions, and migration files with syntax highlighting. Perfect for reviewing database changes, comparing stored procedures, or spotting differences between migration versions.',
    exampleOriginal: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

SELECT u.name, u.email
FROM users u
WHERE u.created_at > '2024-01-01'
ORDER BY u.name;`,
    exampleModified: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

SELECT u.name, u.email, u.role
FROM users u
WHERE u.created_at > '2024-01-01'
  AND u.role != 'inactive'
ORDER BY u.name ASC;`,
    features: [
      'SQL syntax highlighting',
      'Side-by-side and inline views',
      'Schema diff support',
      'Handles DDL and DML statements',
      'Ignore whitespace option',
      'Share SQL diff via URL',
    ],
    faq: [
      { q: 'Can I compare database migrations?', a: 'Yes — paste two migration files to see exactly what changed between versions.' },
      { q: 'Does it support all SQL dialects?', a: 'The syntax highlighter covers standard SQL. Keywords from PostgreSQL, MySQL, and SQLite are highlighted.' },
      { q: 'Can I compare stored procedures?', a: 'Yes. Any SQL text including functions, triggers, and views can be compared.' },
    ],
  },
  {
    slug: '/scss-diff',
    language: 'scss',
    title: 'SCSS Diff — Compare SCSS Files Online Free',
    description:
      'Compare two SCSS files online with syntax highlighting and auto-formatting. Free SCSS diff tool with Prettier integration. No sign-up required.',
    keywords:
      'scss diff, compare scss, scss compare, compare two scss files online, sass diff, scss difference, scss diff tool',
    h1: 'Compare two SCSS files',
    subtitle: 'Paste SCSS on each side and see variable, mixin, and style differences instantly.',
    intro: 'Compare SCSS stylesheets with syntax highlighting and Prettier auto-formatting. Ideal for reviewing Sass changes, comparing mixin updates, or spotting variable differences. Supports nesting, variables, mixins, extends, and all SCSS features.',
    exampleOriginal: `$primary: #3498db;
$spacing: 16px;

.card {
  padding: $spacing;
  border-radius: 8px;
  background: white;

  &__title {
    font-size: 18px;
    color: $primary;
  }

  &__body {
    margin-top: $spacing / 2;
  }
}`,
    exampleModified: `$primary: #2563eb;
$spacing: 20px;
$shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

.card {
  padding: $spacing;
  border-radius: 12px;
  background: white;
  box-shadow: $shadow;

  &__title {
    font-size: 20px;
    font-weight: 600;
    color: $primary;
  }

  &__body {
    margin-top: $spacing / 2;
    line-height: 1.6;
  }
}`,
    features: [
      'SCSS syntax highlighting',
      'Auto-format with Prettier',
      'Variable and mixin support',
      'Nesting-aware coloring',
      'Side-by-side and inline views',
      'Share SCSS diff via URL',
    ],
    faq: [
      { q: 'Does it format SCSS?', a: 'Yes — Prettier formats SCSS including nested rules, variables, and mixins.' },
      { q: 'Can I compare Sass (.sass) files?', a: 'This tool handles SCSS syntax. For indented Sass, paste the code and compare as plain text.' },
      { q: 'Does it highlight variables and mixins?', a: 'Yes. SCSS variables ($var), mixins (@mixin), and nesting are all syntax-highlighted.' },
    ],
  },
  {
    slug: '/less-diff',
    language: 'less',
    title: 'Less Diff — Compare Less CSS Files Online Free',
    description:
      'Compare two Less CSS files online with syntax highlighting and auto-formatting. Free Less diff tool with Prettier integration. No sign-up required.',
    keywords:
      'less diff, compare less, less css diff, compare two less files online, less difference, less diff tool',
    h1: 'Compare two Less files',
    subtitle: 'Paste Less CSS on each side and see differences highlighted with syntax coloring.',
    intro: 'Compare Less CSS stylesheets with syntax highlighting and Prettier auto-formatting. Perfect for reviewing preprocessor changes, comparing variable updates, or spotting mixin differences.',
    exampleOriginal: `@primary: #3498db;
@spacing: 16px;

.card {
  padding: @spacing;
  border-radius: 8px;
  background: white;

  .title {
    font-size: 18px;
    color: @primary;
  }
}`,
    exampleModified: `@primary: #2563eb;
@spacing: 20px;

.card {
  padding: @spacing;
  border-radius: 12px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  .title {
    font-size: 20px;
    font-weight: 600;
    color: @primary;
  }
}`,
    features: [
      'Less CSS syntax highlighting',
      'Auto-format with Prettier',
      'Variable and mixin support',
      'Side-by-side and inline views',
      'Ignore whitespace option',
      'Share Less diff via URL',
    ],
    faq: [
      { q: 'Does it format Less?', a: 'Yes — Prettier formats Less CSS including variables and nested rules.' },
      { q: 'Does it highlight Less variables?', a: 'Yes. Less variables (@var) and mixins are syntax-highlighted.' },
    ],
  },
  {
    slug: '/markdown-diff',
    language: 'markdown',
    title: 'Markdown Diff — Compare Markdown Files Online Free',
    description:
      'Compare two Markdown files online with syntax highlighting and auto-formatting. Free Markdown diff tool with Prettier integration. No sign-up required.',
    keywords:
      'markdown diff, compare markdown, md diff, compare two markdown files online, markdown difference, markdown diff tool, compare md files',
    h1: 'Compare two Markdown files',
    subtitle: 'Paste Markdown on each side and see content differences highlighted instantly.',
    intro: 'Compare Markdown documents with syntax highlighting and Prettier auto-formatting. Perfect for reviewing README changes, comparing documentation updates, or tracking content edits across versions. Supports headings, lists, links, code blocks, and all Markdown features.',
    exampleOriginal: `# Getting Started

## Installation

Install the package using npm:

\`\`\`bash
npm install my-package
\`\`\`

## Usage

Import the module and call the main function:

- Step 1: Import
- Step 2: Configure
- Step 3: Run`,
    exampleModified: `# Getting Started

## Installation

Install the package using npm or yarn:

\`\`\`bash
npm install my-package
# or
yarn add my-package
\`\`\`

## Usage

Import the module and call the main function:

- Step 1: Import
- Step 2: Configure
- Step 3: Run
- Step 4: Test

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.`,
    features: [
      'Markdown syntax highlighting',
      'Auto-format with Prettier',
      'Heading and list coloring',
      'Side-by-side and inline views',
      'Ignore whitespace option',
      'Share Markdown diff via URL',
    ],
    faq: [
      { q: 'Does it format Markdown?', a: 'Yes — Prettier formats Markdown including consistent heading styles, list spacing, and line wrapping.' },
      { q: 'Can I compare README files?', a: 'Yes. Paste any two Markdown documents to see exactly what changed.' },
      { q: 'Does it highlight code blocks?', a: 'Yes. Fenced code blocks and inline code are syntax-highlighted within the Markdown.' },
    ],
  },
  {
    slug: '/java-diff',
    language: 'java',
    title: 'Java Diff — Compare Java Code Online Free',
    description:
      'Compare two Java files online with syntax highlighting. Free Java diff tool with side-by-side view. Perfect for reviewing code changes. No sign-up required.',
    keywords:
      'java diff, compare java, java compare, compare two java files online, java code diff, diff java online, java code comparison',
    h1: 'Compare two Java files',
    subtitle: 'Paste Java code on each side and instantly see differences with syntax highlighting.',
    intro: 'Compare Java source code with full syntax highlighting. Perfect for reviewing pull requests, comparing class implementations, or spotting changes between versions. Supports annotations, generics, lambdas, and all modern Java features.',
    exampleOriginal: `public class UserService {
    private final UserRepository repository;

    public UserService(UserRepository repository) {
        this.repository = repository;
    }

    public User findById(Long id) {
        return repository.findById(id)
            .orElseThrow(() -> new NotFoundException("User not found"));
    }

    public List<User> findAll() {
        return repository.findAll();
    }
}`,
    exampleModified: `public class UserService {
    private final UserRepository repository;
    private final CacheService cache;

    public UserService(UserRepository repository, CacheService cache) {
        this.repository = repository;
        this.cache = cache;
    }

    public User findById(Long id) {
        return cache.get("user:" + id, () ->
            repository.findById(id)
                .orElseThrow(() -> new NotFoundException("User not found"))
        );
    }

    public List<User> findAll() {
        return repository.findAll();
    }

    public void deleteById(Long id) {
        repository.deleteById(id);
        cache.evict("user:" + id);
    }
}`,
    features: [
      'Java syntax highlighting',
      'Annotation and generics support',
      'Side-by-side and inline views',
      'Lambda expression coloring',
      'Ignore whitespace option',
      'Share Java diff via URL',
    ],
    faq: [
      { q: 'Does it support modern Java?', a: 'Yes. Records, sealed classes, pattern matching, lambdas, and all Java 17+ features are highlighted.' },
      { q: 'Can I format Java code?', a: 'Auto-formatting is not available for Java, but you can compare code with any formatting.' },
      { q: 'Does it highlight annotations?', a: 'Yes. @Override, @Autowired, and all annotations are syntax-highlighted.' },
    ],
  },
  {
    slug: '/csharp-diff',
    language: 'csharp',
    title: 'C# Diff — Compare C# Code Online Free',
    description:
      'Compare two C# files online with syntax highlighting. Free C# diff tool with side-by-side view. Perfect for reviewing .NET code changes. No sign-up required.',
    keywords:
      'c# diff, compare c#, csharp diff, compare two c# files online, c# code diff, diff csharp online, .net diff',
    h1: 'Compare two C# files',
    subtitle: 'Paste C# code on each side and instantly see differences with syntax highlighting.',
    intro: 'Compare C# source code with full syntax highlighting. Perfect for reviewing .NET pull requests, comparing class implementations, or tracking changes across versions. Supports LINQ, async/await, nullable reference types, and all modern C# features.',
    exampleOriginal: `public class OrderService
{
    private readonly IOrderRepository _repository;

    public OrderService(IOrderRepository repository)
    {
        _repository = repository;
    }

    public async Task<Order> GetOrderAsync(int id)
    {
        var order = await _repository.GetByIdAsync(id);
        if (order == null)
            throw new NotFoundException();
        return order;
    }
}`,
    exampleModified: `public class OrderService
{
    private readonly IOrderRepository _repository;
    private readonly ILogger<OrderService> _logger;

    public OrderService(IOrderRepository repository, ILogger<OrderService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task<Order?> GetOrderAsync(int id)
    {
        var order = await _repository.GetByIdAsync(id);
        if (order is null)
        {
            _logger.LogWarning("Order {Id} not found", id);
            return null;
        }
        return order;
    }
}`,
    features: [
      'C# syntax highlighting',
      'LINQ and async/await support',
      'Side-by-side and inline views',
      'Nullable reference type coloring',
      'Ignore whitespace option',
      'Share C# diff via URL',
    ],
    faq: [
      { q: 'Does it support modern C#?', a: 'Yes. Nullable references, records, pattern matching, top-level statements, and C# 12 features are highlighted.' },
      { q: 'Can I format C# code?', a: 'Auto-formatting is not available for C#, but you can use the ignore whitespace option to focus on meaningful changes.' },
      { q: 'Does it support .NET-specific syntax?', a: 'Yes. LINQ queries, attributes, async/await, and all .NET patterns are syntax-highlighted.' },
    ],
  },
  {
    slug: '/cpp-diff',
    language: 'cpp',
    title: 'C++ Diff — Compare C++ Code Online Free',
    description:
      'Compare two C++ files online with syntax highlighting. Free C++ diff tool with side-by-side view. Perfect for reviewing code changes. No sign-up required.',
    keywords:
      'c++ diff, compare c++, cpp diff, compare two c++ files online, c++ code diff, diff cpp online, c plus plus diff',
    h1: 'Compare two C++ files',
    subtitle: 'Paste C++ code on each side and instantly see differences with syntax highlighting.',
    intro: 'Compare C++ source code with full syntax highlighting. Perfect for reviewing code changes, comparing implementations, or spotting differences in header files. Supports templates, smart pointers, ranges, and all modern C++ features.',
    exampleOriginal: `#include <iostream>
#include <vector>
#include <string>

class Logger {
public:
    void log(const std::string& message) {
        std::cout << message << std::endl;
    }

    void log(const std::string& level, const std::string& message) {
        std::cout << "[" << level << "] " << message << std::endl;
    }
};`,
    exampleModified: `#include <iostream>
#include <vector>
#include <string>
#include <format>
#include <chrono>

class Logger {
public:
    void log(const std::string& message) {
        auto now = std::chrono::system_clock::now();
        std::cout << std::format("[{}] {}", now, message) << std::endl;
    }

    void log(const std::string& level, const std::string& message) {
        auto now = std::chrono::system_clock::now();
        std::cout << std::format("[{}] [{}] {}", now, level, message) << std::endl;
    }

    void error(const std::string& message) {
        log("ERROR", message);
    }
};`,
    features: [
      'C++ syntax highlighting',
      'Template and STL support',
      'Side-by-side and inline views',
      'Header and source file comparison',
      'Ignore whitespace option',
      'Share C++ diff via URL',
    ],
    faq: [
      { q: 'Does it support modern C++?', a: 'Yes. C++20 concepts, ranges, std::format, coroutines, and all modern features are syntax-highlighted.' },
      { q: 'Can I format C++ code?', a: 'Auto-formatting is not available for C++, but you can compare code with any indentation style.' },
      { q: 'Can I compare header files?', a: 'Yes. Any .h, .hpp, or .cpp content can be compared.' },
    ],
  },
  {
    slug: '/c-diff',
    language: 'c',
    title: 'C Diff — Compare C Code Online Free',
    description:
      'Compare two C files online with syntax highlighting. Free C diff tool with side-by-side view. Perfect for reviewing code changes. No sign-up required.',
    keywords:
      'c diff, compare c code, c language diff, compare two c files online, c code diff, diff c online',
    h1: 'Compare two C files',
    subtitle: 'Paste C code on each side and instantly see differences with syntax highlighting.',
    intro: 'Compare C source code with full syntax highlighting. Perfect for reviewing kernel patches, comparing function implementations, or tracking changes in embedded systems code. Supports preprocessor directives, structs, pointers, and all C features.',
    exampleOriginal: `#include <stdio.h>
#include <stdlib.h>

typedef struct {
    int x;
    int y;
} Point;

Point* create_point(int x, int y) {
    Point* p = malloc(sizeof(Point));
    p->x = x;
    p->y = y;
    return p;
}

void print_point(const Point* p) {
    printf("(%d, %d)\\n", p->x, p->y);
}`,
    exampleModified: `#include <stdio.h>
#include <stdlib.h>
#include <math.h>

typedef struct {
    double x;
    double y;
} Point;

Point* create_point(double x, double y) {
    Point* p = malloc(sizeof(Point));
    if (!p) return NULL;
    p->x = x;
    p->y = y;
    return p;
}

double distance(const Point* a, const Point* b) {
    double dx = a->x - b->x;
    double dy = a->y - b->y;
    return sqrt(dx * dx + dy * dy);
}

void print_point(const Point* p) {
    printf("(%.2f, %.2f)\\n", p->x, p->y);
}`,
    features: [
      'C syntax highlighting',
      'Preprocessor directive support',
      'Side-by-side and inline views',
      'Struct and pointer coloring',
      'Ignore whitespace option',
      'Share C diff via URL',
    ],
    faq: [
      { q: 'Can I compare header files?', a: 'Yes. Both .c source files and .h header files can be compared.' },
      { q: 'Can I format C code?', a: 'Auto-formatting is not available for C, but the diff highlights all changes clearly.' },
      { q: 'Does it highlight preprocessor directives?', a: 'Yes. #include, #define, #ifdef, and all preprocessor directives are syntax-highlighted.' },
    ],
  },
  {
    slug: '/go-diff',
    language: 'go',
    title: 'Go Diff — Compare Go Code Online Free',
    description:
      'Compare two Go files online with syntax highlighting. Free Go/Golang diff tool with side-by-side view. Perfect for reviewing code changes. No sign-up required.',
    keywords:
      'go diff, compare go, golang diff, compare two go files online, go code diff, diff golang online, go code comparison',
    h1: 'Compare two Go files',
    subtitle: 'Paste Go code on each side and instantly see differences with syntax highlighting.',
    intro: 'Compare Go source code with full syntax highlighting. Perfect for reviewing pull requests, comparing package implementations, or tracking changes. Supports goroutines, channels, interfaces, generics, and all Go features.',
    exampleOriginal: `package main

import (
	"fmt"
	"net/http"
)

func handler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Hello, World!")
}

func main() {
	http.HandleFunc("/", handler)
	fmt.Println("Server starting on :8080")
	http.ListenAndServe(":8080", nil)
}`,
    exampleModified: `package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
)

func handler(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if name == "" {
		name = "World"
	}
	fmt.Fprintf(w, "Hello, %s!", name)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	http.HandleFunc("/", handler)
	log.Printf("Server starting on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}`,
    features: [
      'Go syntax highlighting',
      'Goroutine and channel support',
      'Side-by-side and inline views',
      'Interface and struct coloring',
      'Ignore whitespace option',
      'Share Go diff via URL',
    ],
    faq: [
      { q: 'Does it support Go generics?', a: 'Yes. Type parameters, constraints, and all Go 1.18+ generics syntax are highlighted.' },
      { q: 'Can I format Go code?', a: 'Auto-formatting is not available in-browser for Go, but you can run gofmt locally first.' },
      { q: 'Does it handle Go modules?', a: 'You can compare go.mod, go.sum, and any Go source files.' },
    ],
  },
  {
    slug: '/rust-diff',
    language: 'rust',
    title: 'Rust Diff — Compare Rust Code Online Free',
    description:
      'Compare two Rust files online with syntax highlighting. Free Rust diff tool with side-by-side view. Perfect for reviewing code changes. No sign-up required.',
    keywords:
      'rust diff, compare rust, rust compare, compare two rust files online, rust code diff, diff rust online, rust code comparison',
    h1: 'Compare two Rust files',
    subtitle: 'Paste Rust code on each side and instantly see differences with syntax highlighting.',
    intro: 'Compare Rust source code with full syntax highlighting. Perfect for reviewing ownership changes, comparing trait implementations, or tracking crate updates. Supports lifetimes, generics, macros, async/await, and all Rust features.',
    exampleOriginal: `use std::collections::HashMap;

struct Config {
    values: HashMap<String, String>,
}

impl Config {
    fn new() -> Self {
        Config {
            values: HashMap::new(),
        }
    }

    fn get(&self, key: &str) -> Option<&String> {
        self.values.get(key)
    }

    fn set(&mut self, key: String, value: String) {
        self.values.insert(key, value);
    }
}`,
    exampleModified: `use std::collections::HashMap;
use std::path::Path;
use std::fs;

#[derive(Debug, Clone)]
struct Config {
    values: HashMap<String, String>,
}

impl Config {
    fn new() -> Self {
        Config {
            values: HashMap::new(),
        }
    }

    fn from_file(path: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(path)?;
        let values: HashMap<String, String> = serde_json::from_str(&content)?;
        Ok(Config { values })
    }

    fn get(&self, key: &str) -> Option<&String> {
        self.values.get(key)
    }

    fn set(&mut self, key: String, value: String) {
        self.values.insert(key, value);
    }
}`,
    features: [
      'Rust syntax highlighting',
      'Lifetime and ownership coloring',
      'Side-by-side and inline views',
      'Macro and trait support',
      'Ignore whitespace option',
      'Share Rust diff via URL',
    ],
    faq: [
      { q: 'Does it highlight lifetimes?', a: 'Yes. Lifetime annotations, borrow checker syntax, and ownership patterns are all highlighted.' },
      { q: 'Can I format Rust code?', a: 'Auto-formatting is not available in-browser for Rust, but you can run rustfmt locally first.' },
      { q: 'Does it support Rust macros?', a: 'Yes. Macro invocations (macro_rules!, derive macros) are syntax-highlighted.' },
    ],
  },
  {
    slug: '/ruby-diff',
    language: 'ruby',
    title: 'Ruby Diff — Compare Ruby Code Online Free',
    description:
      'Compare two Ruby files online with syntax highlighting. Free Ruby diff tool with side-by-side view. Perfect for reviewing code changes. No sign-up required.',
    keywords:
      'ruby diff, compare ruby, ruby compare, compare two ruby files online, ruby code diff, diff ruby online, rails diff',
    h1: 'Compare two Ruby files',
    subtitle: 'Paste Ruby code on each side and instantly see differences with syntax highlighting.',
    intro: 'Compare Ruby source code with full syntax highlighting. Perfect for reviewing Rails pull requests, comparing gem implementations, or spotting changes. Supports blocks, modules, mixins, and all Ruby features.',
    exampleOriginal: `class User
  attr_accessor :name, :email

  def initialize(name, email)
    @name = name
    @email = email
  end

  def greeting
    "Hello, #{@name}!"
  end

  def to_s
    "#{@name} <#{@email}>"
  end
end`,
    exampleModified: `class User
  attr_accessor :name, :email, :role

  def initialize(name, email, role: :member)
    @name = name
    @email = email
    @role = role
  end

  def greeting
    "Hello, #{@name}!"
  end

  def admin?
    @role == :admin
  end

  def to_s
    "#{@name} <#{@email}> (#{@role})"
  end
end`,
    features: [
      'Ruby syntax highlighting',
      'Block and module support',
      'Side-by-side and inline views',
      'Symbol and string interpolation coloring',
      'Ignore whitespace option',
      'Share Ruby diff via URL',
    ],
    faq: [
      { q: 'Can I compare Rails files?', a: 'Yes. Controllers, models, views, and any Ruby file can be compared.' },
      { q: 'Can I format Ruby code?', a: 'Auto-formatting is not available for Ruby, but you can use the ignore whitespace option.' },
      { q: 'Does it highlight symbols and blocks?', a: 'Yes. Ruby symbols, blocks, procs, and string interpolation are all highlighted.' },
    ],
  },
  {
    slug: '/php-diff',
    language: 'php',
    title: 'PHP Diff — Compare PHP Code Online Free',
    description:
      'Compare two PHP files online with syntax highlighting. Free PHP diff tool with side-by-side view. Perfect for reviewing code changes. No sign-up required.',
    keywords:
      'php diff, compare php, php compare, compare two php files online, php code diff, diff php online, php code comparison',
    h1: 'Compare two PHP files',
    subtitle: 'Paste PHP code on each side and instantly see differences with syntax highlighting.',
    intro: 'Compare PHP source code with full syntax highlighting. Perfect for reviewing WordPress changes, comparing Laravel controllers, or tracking framework updates. Supports namespaces, traits, typed properties, and all modern PHP features.',
    exampleOriginal: `<?php

class UserController
{
    private $repository;

    public function __construct(UserRepository $repository)
    {
        $this->repository = $repository;
    }

    public function index()
    {
        $users = $this->repository->findAll();
        return view('users.index', ['users' => $users]);
    }

    public function show($id)
    {
        $user = $this->repository->findById($id);
        return view('users.show', ['user' => $user]);
    }
}`,
    exampleModified: `<?php

class UserController
{
    public function __construct(
        private readonly UserRepository $repository,
        private readonly CacheService $cache,
    ) {}

    public function index(): View
    {
        $users = $this->cache->remember('users.all', 3600, fn() =>
            $this->repository->findAll()
        );
        return view('users.index', ['users' => $users]);
    }

    public function show(int $id): View
    {
        $user = $this->repository->findById($id)
            ?? abort(404);
        return view('users.show', ['user' => $user]);
    }
}`,
    features: [
      'PHP syntax highlighting',
      'Namespace and trait support',
      'Side-by-side and inline views',
      'Typed property coloring',
      'Ignore whitespace option',
      'Share PHP diff via URL',
    ],
    faq: [
      { q: 'Does it support modern PHP?', a: 'Yes. Typed properties, enums, fibers, named arguments, and PHP 8.3 features are highlighted.' },
      { q: 'Can I format PHP code?', a: 'Auto-formatting is not available for PHP, but you can compare code with any formatting style.' },
      { q: 'Can I compare Laravel or WordPress files?', a: 'Yes. Any PHP file from any framework can be compared.' },
    ],
  },
  {
    slug: '/swift-diff',
    language: 'swift',
    title: 'Swift Diff — Compare Swift Code Online Free',
    description:
      'Compare two Swift files online with syntax highlighting. Free Swift diff tool with side-by-side view. Perfect for reviewing iOS/macOS code changes. No sign-up.',
    keywords:
      'swift diff, compare swift, swift compare, compare two swift files online, swift code diff, diff swift online, ios diff',
    h1: 'Compare two Swift files',
    subtitle: 'Paste Swift code on each side and instantly see differences with syntax highlighting.',
    intro: 'Compare Swift source code with full syntax highlighting. Perfect for reviewing iOS and macOS code changes, comparing SwiftUI views, or tracking framework updates. Supports optionals, protocols, generics, and all Swift features.',
    exampleOriginal: `struct ContentView: View {
    @State private var count = 0

    var body: some View {
        VStack {
            Text("Count: \\(count)")
                .font(.title)

            Button("Increment") {
                count += 1
            }
        }
        .padding()
    }
}`,
    exampleModified: `struct ContentView: View {
    @State private var count = 0
    @State private var showAlert = false

    var body: some View {
        VStack(spacing: 16) {
            Text("Count: \\(count)")
                .font(.title)
                .foregroundStyle(count > 10 ? .red : .primary)

            HStack {
                Button("Decrement") { count -= 1 }
                    .disabled(count <= 0)
                Button("Increment") { count += 1 }
            }

            Button("Reset") {
                showAlert = true
            }
        }
        .padding()
        .alert("Reset count?", isPresented: $showAlert) {
            Button("Reset", role: .destructive) { count = 0 }
            Button("Cancel", role: .cancel) {}
        }
    }
}`,
    features: [
      'Swift syntax highlighting',
      'SwiftUI and protocol support',
      'Side-by-side and inline views',
      'Optional and generic coloring',
      'Ignore whitespace option',
      'Share Swift diff via URL',
    ],
    faq: [
      { q: 'Does it support SwiftUI?', a: 'Yes. SwiftUI view builders, property wrappers (@State, @Binding), and modifiers are all highlighted.' },
      { q: 'Can I format Swift code?', a: 'Auto-formatting is not available for Swift, but you can compare code with any formatting.' },
      { q: 'Does it handle Swift concurrency?', a: 'Yes. async/await, actors, and structured concurrency syntax are syntax-highlighted.' },
    ],
  },
  {
    slug: '/kotlin-diff',
    language: 'kotlin',
    title: 'Kotlin Diff — Compare Kotlin Code Online Free',
    description:
      'Compare two Kotlin files online with syntax highlighting. Free Kotlin diff tool with side-by-side view. Perfect for reviewing Android code changes. No sign-up.',
    keywords:
      'kotlin diff, compare kotlin, kotlin compare, compare two kotlin files online, kotlin code diff, diff kotlin online, android diff',
    h1: 'Compare two Kotlin files',
    subtitle: 'Paste Kotlin code on each side and instantly see differences with syntax highlighting.',
    intro: 'Compare Kotlin source code with full syntax highlighting. Perfect for reviewing Android code changes, comparing Compose UI, or tracking Kotlin Multiplatform updates. Supports coroutines, data classes, sealed classes, and all Kotlin features.',
    exampleOriginal: `data class User(
    val name: String,
    val email: String,
)

class UserRepository {
    private val users = mutableListOf<User>()

    fun add(user: User) {
        users.add(user)
    }

    fun findByEmail(email: String): User? {
        return users.find { it.email == email }
    }
}`,
    exampleModified: `data class User(
    val name: String,
    val email: String,
    val role: Role = Role.MEMBER,
)

enum class Role { ADMIN, EDITOR, MEMBER }

class UserRepository {
    private val users = mutableListOf<User>()

    fun add(user: User) {
        require(user.email.contains("@")) { "Invalid email" }
        users.add(user)
    }

    fun findByEmail(email: String): User? {
        return users.find { it.email == email }
    }

    fun findAdmins(): List<User> {
        return users.filter { it.role == Role.ADMIN }
    }
}`,
    features: [
      'Kotlin syntax highlighting',
      'Coroutine and data class support',
      'Side-by-side and inline views',
      'Sealed class and enum coloring',
      'Ignore whitespace option',
      'Share Kotlin diff via URL',
    ],
    faq: [
      { q: 'Does it support Jetpack Compose?', a: 'Yes. @Composable functions and Compose UI patterns are syntax-highlighted.' },
      { q: 'Can I format Kotlin code?', a: 'Auto-formatting is not available for Kotlin, but you can use the ignore whitespace option.' },
      { q: 'Does it handle coroutines?', a: 'Yes. suspend functions, Flow, and all coroutine patterns are highlighted.' },
    ],
  },
  {
    slug: '/scala-diff',
    language: 'scala',
    title: 'Scala Diff — Compare Scala Code Online Free',
    description:
      'Compare two Scala files online with syntax highlighting. Free Scala diff tool with side-by-side view. No sign-up required.',
    keywords:
      'scala diff, compare scala, scala compare, compare two scala files online, scala code diff, diff scala online',
    h1: 'Compare two Scala files',
    subtitle: 'Paste Scala code on each side and instantly see differences with syntax highlighting.',
    intro: 'Compare Scala source code with full syntax highlighting. Perfect for reviewing Spark jobs, comparing Akka actors, or tracking library changes. Supports case classes, pattern matching, implicits, and all Scala features.',
    exampleOriginal: `case class User(name: String, age: Int)

object UserService {
  def greet(user: User): String = {
    s"Hello, \${user.name}! You are \${user.age} years old."
  }

  def isAdult(user: User): Boolean = {
    user.age >= 18
  }
}`,
    exampleModified: `case class User(name: String, age: Int, role: String = "member")

object UserService {
  def greet(user: User): String = {
    val title = if (user.role == "admin") "Admin" else "User"
    s"Hello, \$title \${user.name}! You are \${user.age} years old."
  }

  def isAdult(user: User): Boolean = user.age >= 18

  def filterByRole(users: List[User], role: String): List[User] = {
    users.filter(_.role == role)
  }
}`,
    features: [
      'Scala syntax highlighting',
      'Case class and pattern matching support',
      'Side-by-side and inline views',
      'Implicit and trait coloring',
      'Ignore whitespace option',
      'Share Scala diff via URL',
    ],
    faq: [
      { q: 'Does it support Scala 3?', a: 'Yes. Given/using clauses, enums, union types, and Scala 3 syntax are highlighted.' },
      { q: 'Can I format Scala code?', a: 'Auto-formatting is not available for Scala, but you can compare code with any style.' },
      { q: 'Can I compare Spark code?', a: 'Yes. Any Scala code including Spark transformations can be compared.' },
    ],
  },
  {
    slug: '/shell-diff',
    language: 'shell',
    title: 'Shell Script Diff — Compare Bash Scripts Online Free',
    description:
      'Compare two shell scripts online with syntax highlighting. Free Bash/Shell diff tool with side-by-side view. No sign-up required.',
    keywords:
      'shell diff, bash diff, compare shell scripts, compare bash, shell script diff, diff bash online, script comparison',
    h1: 'Compare two shell scripts',
    subtitle: 'Paste shell scripts on each side and instantly see differences with syntax highlighting.',
    intro: 'Compare Bash and shell scripts with full syntax highlighting. Perfect for reviewing deployment scripts, comparing CI/CD pipelines, or tracking dotfile changes. Supports variables, functions, pipes, and all shell features.',
    exampleOriginal: `#!/bin/bash

echo "Deploying application..."

cd /app
git pull origin main
npm install
npm run build

echo "Restarting service..."
systemctl restart myapp

echo "Done!"`,
    exampleModified: `#!/bin/bash
set -euo pipefail

echo "Deploying application..."

cd /app
git pull origin main
npm ci --production
npm run build

echo "Running health check..."
curl -sf http://localhost:3000/health || {
  echo "Health check failed!"
  exit 1
}

echo "Restarting service..."
systemctl restart myapp

echo "Deployment complete!"`,
    features: [
      'Shell/Bash syntax highlighting',
      'Variable and pipe coloring',
      'Side-by-side and inline views',
      'Shebang line support',
      'Ignore whitespace option',
      'Share script diff via URL',
    ],
    faq: [
      { q: 'Does it support Bash and sh?', a: 'Yes. Bash, sh, zsh, and POSIX shell syntax are all highlighted.' },
      { q: 'Can I format shell scripts?', a: 'Auto-formatting is not available for shell scripts, but the diff highlights all changes clearly.' },
      { q: 'Can I compare CI/CD configs?', a: 'Yes. Shell scripts used in GitHub Actions, Jenkins, or any CI/CD system can be compared.' },
    ],
  },
  {
    slug: '/graphql-diff',
    language: 'graphql',
    title: 'GraphQL Diff — Compare GraphQL Schemas Online Free',
    description:
      'Compare two GraphQL schemas or queries online with syntax highlighting. Free GraphQL diff tool with side-by-side view. No sign-up required.',
    keywords:
      'graphql diff, compare graphql, graphql schema diff, compare two graphql files online, graphql difference, graphql diff tool',
    h1: 'Compare two GraphQL files',
    subtitle: 'Paste GraphQL schemas or queries on each side and see differences highlighted.',
    intro: 'Compare GraphQL schemas, queries, and mutations with syntax highlighting. Perfect for reviewing API changes, comparing schema versions, or tracking query modifications.',
    exampleOriginal: `type User {
  id: ID!
  name: String!
  email: String!
}

type Query {
  user(id: ID!): User
  users: [User!]!
}

type Mutation {
  createUser(name: String!, email: String!): User!
}`,
    exampleModified: `type User {
  id: ID!
  name: String!
  email: String!
  role: Role!
  createdAt: DateTime!
}

enum Role {
  ADMIN
  EDITOR
  VIEWER
}

type Query {
  user(id: ID!): User
  users(role: Role): [User!]!
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  deleteUser(id: ID!): Boolean!
}

input CreateUserInput {
  name: String!
  email: String!
  role: Role = VIEWER
}`,
    features: [
      'GraphQL syntax highlighting',
      'Schema and query support',
      'Side-by-side and inline views',
      'Type and field coloring',
      'Ignore whitespace option',
      'Share GraphQL diff via URL',
    ],
    faq: [
      { q: 'Can I compare GraphQL schemas?', a: 'Yes. Type definitions, queries, mutations, subscriptions, and input types are all supported.' },
      { q: 'Can I format GraphQL?', a: 'Auto-formatting is not available for GraphQL, but you can compare schemas with any style.' },
      { q: 'Does it support directives?', a: 'Yes. @deprecated, @auth, and custom directives are syntax-highlighted.' },
    ],
  },
  {
    slug: '/dockerfile-diff',
    language: 'dockerfile',
    title: 'Dockerfile Diff — Compare Dockerfiles Online Free',
    description:
      'Compare two Dockerfiles online with syntax highlighting. Free Dockerfile diff tool with side-by-side view. No sign-up required.',
    keywords:
      'dockerfile diff, compare dockerfile, docker diff, compare two dockerfiles online, dockerfile comparison, diff dockerfile online',
    h1: 'Compare two Dockerfiles',
    subtitle: 'Paste Dockerfiles on each side and see instruction-level differences highlighted.',
    intro: 'Compare Dockerfiles with syntax highlighting for all instructions. Perfect for reviewing container image changes, comparing multi-stage builds, or auditing security changes. Supports FROM, RUN, COPY, ENV, and all Dockerfile directives.',
    exampleOriginal: `FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]`,
    exampleModified: `FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --production

COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

USER node
EXPOSE 3000
HEALTHCHECK CMD wget -q --spider http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]`,
    features: [
      'Dockerfile syntax highlighting',
      'Instruction-level coloring',
      'Side-by-side and inline views',
      'Multi-stage build support',
      'Ignore whitespace option',
      'Share Dockerfile diff via URL',
    ],
    faq: [
      { q: 'Does it support multi-stage builds?', a: 'Yes. FROM ... AS aliases and COPY --from directives are highlighted.' },
      { q: 'Can I format Dockerfiles?', a: 'Auto-formatting is not available for Dockerfiles, but the diff clearly shows all changes.' },
      { q: 'Can I compare Docker Compose files?', a: 'Docker Compose files are YAML — use the YAML diff tool for those.' },
    ],
  },
  {
    slug: '/lua-diff',
    language: 'lua',
    title: 'Lua Diff — Compare Lua Code Online Free',
    description:
      'Compare two Lua files online with syntax highlighting. Free Lua diff tool with side-by-side view. No sign-up required.',
    keywords:
      'lua diff, compare lua, lua compare, compare two lua files online, lua code diff, diff lua online',
    h1: 'Compare two Lua files',
    subtitle: 'Paste Lua code on each side and instantly see differences with syntax highlighting.',
    intro: 'Compare Lua source code with full syntax highlighting. Perfect for reviewing game scripts, comparing Neovim configs, or tracking changes in embedded Lua. Supports tables, metatables, coroutines, and all Lua features.',
    exampleOriginal: `local function greet(name)
    print("Hello, " .. name .. "!")
end

local users = {
    { name = "Alice", score = 100 },
    { name = "Bob", score = 85 },
}

for _, user in ipairs(users) do
    greet(user.name)
    print("Score: " .. user.score)
end`,
    exampleModified: `local function greet(name, title)
    title = title or "User"
    print(string.format("Hello, %s %s!", title, name))
end

local users = {
    { name = "Alice", score = 100, role = "admin" },
    { name = "Bob", score = 85, role = "member" },
    { name = "Charlie", score = 92, role = "member" },
}

table.sort(users, function(a, b)
    return a.score > b.score
end)

for _, user in ipairs(users) do
    greet(user.name, user.role)
    print("Score: " .. user.score)
end`,
    features: [
      'Lua syntax highlighting',
      'Table and metatable support',
      'Side-by-side and inline views',
      'Coroutine coloring',
      'Ignore whitespace option',
      'Share Lua diff via URL',
    ],
    faq: [
      { q: 'Can I compare Neovim configs?', a: 'Yes. Lua-based Neovim configuration files can be compared here.' },
      { q: 'Can I format Lua code?', a: 'Auto-formatting is not available for Lua, but the diff highlights all changes clearly.' },
      { q: 'Does it support LuaJIT?', a: 'The syntax highlighter covers standard Lua syntax which is compatible with LuaJIT.' },
    ],
  },
  {
    slug: '/r-diff',
    language: 'r',
    title: 'R Diff — Compare R Code Online Free',
    description:
      'Compare two R files online with syntax highlighting. Free R diff tool with side-by-side view. Perfect for data science code reviews. No sign-up required.',
    keywords:
      'r diff, compare r code, r language diff, compare two r files online, r code diff, diff r online, rstats diff',
    h1: 'Compare two R files',
    subtitle: 'Paste R code on each side and instantly see differences with syntax highlighting.',
    intro: 'Compare R source code with full syntax highlighting. Perfect for reviewing statistical analysis changes, comparing tidyverse pipelines, or tracking data processing scripts. Supports data frames, ggplot2, pipes, and all R features.',
    exampleOriginal: `library(dplyr)
library(ggplot2)

data <- read.csv("sales.csv")

summary <- data %>%
  group_by(region) %>%
  summarize(
    total = sum(revenue),
    avg = mean(revenue)
  )

ggplot(summary, aes(x = region, y = total)) +
  geom_bar(stat = "identity") +
  theme_minimal()`,
    exampleModified: `library(dplyr)
library(ggplot2)
library(scales)

data <- read.csv("sales.csv") %>%
  mutate(date = as.Date(date))

summary <- data %>%
  filter(date >= "2024-01-01") %>%
  group_by(region) %>%
  summarize(
    total = sum(revenue),
    avg = mean(revenue),
    count = n()
  ) %>%
  arrange(desc(total))

ggplot(summary, aes(x = reorder(region, -total), y = total)) +
  geom_bar(stat = "identity", fill = "#3498db") +
  scale_y_continuous(labels = dollar) +
  labs(title = "Revenue by Region", x = "Region", y = "Total Revenue") +
  theme_minimal()`,
    features: [
      'R syntax highlighting',
      'Pipe operator and tidyverse support',
      'Side-by-side and inline views',
      'Data frame and ggplot2 coloring',
      'Ignore whitespace option',
      'Share R diff via URL',
    ],
    faq: [
      { q: 'Does it support tidyverse?', a: 'Yes. Pipe operators (%>%, |>), dplyr verbs, and ggplot2 syntax are all highlighted.' },
      { q: 'Can I format R code?', a: 'Auto-formatting is not available for R, but you can compare code with any indentation style.' },
      { q: 'Can I compare R Markdown?', a: 'For .Rmd files, use the Markdown diff tool. For pure R code, use this tool.' },
    ],
  },
  {
    slug: '/perl-diff',
    language: 'perl',
    title: 'Perl Diff — Compare Perl Code Online Free',
    description:
      'Compare two Perl files online with syntax highlighting. Free Perl diff tool with side-by-side view. No sign-up required.',
    keywords:
      'perl diff, compare perl, perl compare, compare two perl files online, perl code diff, diff perl online',
    h1: 'Compare two Perl files',
    subtitle: 'Paste Perl code on each side and instantly see differences with syntax highlighting.',
    intro: 'Compare Perl source code with full syntax highlighting. Perfect for reviewing script changes, comparing modules, or tracking regex modifications. Supports regular expressions, hashes, references, and all Perl features.',
    exampleOriginal: `use strict;
use warnings;

sub process_file {
    my ($filename) = @_;
    open(my $fh, '<', $filename) or die "Cannot open: $!";
    my @lines = <$fh>;
    close($fh);
    return @lines;
}

my @data = process_file("input.txt");
print "Lines: " . scalar(@data) . "\\n";`,
    exampleModified: `use strict;
use warnings;
use File::Slurp;

sub process_file {
    my ($filename, %opts) = @_;
    my @lines = read_file($filename, chomp => 1);

    if ($opts{filter}) {
        @lines = grep { /$opts{filter}/ } @lines;
    }

    return @lines;
}

my @data = process_file("input.txt", filter => qr/^\\w+/);
printf "Matched lines: %d\\n", scalar(@data);`,
    features: [
      'Perl syntax highlighting',
      'Regular expression support',
      'Side-by-side and inline views',
      'Hash and reference coloring',
      'Ignore whitespace option',
      'Share Perl diff via URL',
    ],
    faq: [
      { q: 'Does it highlight regexes?', a: 'Yes. Perl regular expressions, match operators, and substitutions are syntax-highlighted.' },
      { q: 'Can I format Perl code?', a: 'Auto-formatting is not available for Perl, but the diff highlights all changes clearly.' },
      { q: 'Does it support Perl modules?', a: 'Yes. use/require statements, package declarations, and OO Perl are highlighted.' },
    ],
  },
  {
    slug: '/dart-diff',
    language: 'dart',
    title: 'Dart Diff — Compare Dart Code Online Free',
    description:
      'Compare two Dart files online with syntax highlighting. Free Dart diff tool with side-by-side view. Perfect for reviewing Flutter code changes. No sign-up.',
    keywords:
      'dart diff, compare dart, dart compare, compare two dart files online, dart code diff, diff dart online, flutter diff',
    h1: 'Compare two Dart files',
    subtitle: 'Paste Dart code on each side and instantly see differences with syntax highlighting.',
    intro: 'Compare Dart source code with full syntax highlighting. Perfect for reviewing Flutter widget changes, comparing state management code, or tracking package updates. Supports null safety, async/await, mixins, and all Dart features.',
    exampleOriginal: `class Counter extends StatefulWidget {
  @override
  _CounterState createState() => _CounterState();
}

class _CounterState extends State<Counter> {
  int _count = 0;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('Count: \$_count'),
        ElevatedButton(
          onPressed: () => setState(() => _count++),
          child: Text('Increment'),
        ),
      ],
    );
  }
}`,
    exampleModified: `class Counter extends StatefulWidget {
  final int initialValue;
  const Counter({super.key, this.initialValue = 0});

  @override
  State<Counter> createState() => _CounterState();
}

class _CounterState extends State<Counter> {
  late int _count;

  @override
  void initState() {
    super.initState();
    _count = widget.initialValue;
  }

  void _increment() => setState(() => _count++);
  void _decrement() => setState(() { if (_count > 0) _count--; });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('Count: \$_count', style: Theme.of(context).textTheme.headlineMedium),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            IconButton(onPressed: _decrement, icon: const Icon(Icons.remove)),
            IconButton(onPressed: _increment, icon: const Icon(Icons.add)),
          ],
        ),
      ],
    );
  }
}`,
    features: [
      'Dart syntax highlighting',
      'Flutter widget support',
      'Side-by-side and inline views',
      'Null safety coloring',
      'Ignore whitespace option',
      'Share Dart diff via URL',
    ],
    faq: [
      { q: 'Does it support Flutter?', a: 'Yes. Flutter widgets, BuildContext, StatefulWidget, and all Flutter patterns are highlighted.' },
      { q: 'Can I format Dart code?', a: 'Auto-formatting is not available for Dart, but you can run dart format locally first.' },
      { q: 'Does it handle null safety?', a: 'Yes. Nullable types (?), late, and required keywords are syntax-highlighted.' },
    ],
  },
]

export function getPageBySlug(slug: string): PageSeo {
  return pages.find((p) => p.slug === slug) ?? pages[0]
}
