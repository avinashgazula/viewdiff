import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { DiffPage } from './diff-page'
import { pages } from './seo'

const TableMode = lazy(() => import('./modes/table').then((m) => ({ default: m.TableMode })))
const ImageMode = lazy(() => import('./modes/image').then((m) => ({ default: m.ImageMode })))
const GitMode = lazy(() => import('./modes/git').then((m) => ({ default: m.GitMode })))
const HexMode = lazy(() => import('./modes/hex').then((m) => ({ default: m.HexMode })))
const FolderMode = lazy(() => import('./modes/folder').then((m) => ({ default: m.FolderMode })))
const ThreeWayMode = lazy(() => import('./modes/three-way').then((m) => ({ default: m.ThreeWayMode })))
const JsonMode = lazy(() => import('./modes/json').then((m) => ({ default: m.JsonMode })))
const XmlMode = lazy(() => import('./modes/xml').then((m) => ({ default: m.XmlMode })))
const EnvMode = lazy(() => import('./modes/env').then((m) => ({ default: m.EnvMode })))
const YamlMode = lazy(() => import('./modes/yaml').then((m) => ({ default: m.YamlMode })))
const ZipMode = lazy(() => import('./modes/zip').then((m) => ({ default: m.ZipMode })))
const MarkdownMode = lazy(() => import('./modes/markdown').then((m) => ({ default: m.MarkdownMode })))

function ModeSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', color: 'var(--text-muted)', fontSize: 13 }}>
        Loading...
      </div>
    }>
      {children}
    </Suspense>
  )
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

// Mode routes
const tableRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/table',
  component: () => <ModeSuspense><TableMode /></ModeSuspense>,
})

const imageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/image',
  component: () => <ModeSuspense><ImageMode /></ModeSuspense>,
})

const gitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/git',
  component: () => <ModeSuspense><GitMode /></ModeSuspense>,
})

const hexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/hex',
  component: () => <ModeSuspense><HexMode /></ModeSuspense>,
})

const folderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/folder',
  component: () => <ModeSuspense><FolderMode /></ModeSuspense>,
})

const threeWayRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/three-way',
  component: () => <ModeSuspense><ThreeWayMode /></ModeSuspense>,
})

const jsonRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/json',
  component: () => <ModeSuspense><JsonMode /></ModeSuspense>,
})

const xmlRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/xml',
  component: () => <ModeSuspense><XmlMode /></ModeSuspense>,
})

// Generate a route for every SEO page
const pageRoutes = pages.map((page) =>
  createRoute({
    getParentRoute: () => rootRoute,
    path: page.slug === '/' ? '/' : page.slug,
    component: () => <DiffPage slug={page.slug} />,
  })
)

// Catch-all → fallback to home
const catchAllRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '$',
  component: () => <DiffPage slug="/" />,
})

const envRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/env',
  component: () => <ModeSuspense><EnvMode /></ModeSuspense>,
})

const yamlRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/yaml',
  component: () => <ModeSuspense><YamlMode /></ModeSuspense>,
})

const zipRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/zip',
  component: () => <ModeSuspense><ZipMode /></ModeSuspense>,
})

const markdownRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/markdown',
  component: () => <ModeSuspense><MarkdownMode /></ModeSuspense>,
})

const routeTree = rootRoute.addChildren([
  tableRoute,
  imageRoute,
  gitRoute,
  hexRoute,
  folderRoute,
  threeWayRoute,
  jsonRoute,
  xmlRoute,
  envRoute,
  yamlRoute,
  zipRoute,
  markdownRoute,
  ...pageRoutes,
  catchAllRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
