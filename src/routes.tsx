import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router'
import { DiffPage } from './diff-page'
import { pages } from './seo'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
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

const routeTree = rootRoute.addChildren([...pageRoutes, catchAllRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
