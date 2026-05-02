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

const routeTree = rootRoute.addChildren([
  tableRoute,
  imageRoute,
  gitRoute,
  hexRoute,
  folderRoute,
  ...pageRoutes,
  catchAllRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
