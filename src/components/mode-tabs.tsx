import { Link, useLocation } from '@tanstack/react-router'

const MODES = [
  { path: '/', label: 'Text' },
  { path: '/table', label: 'Table' },
  { path: '/json', label: 'JSON' },
  { path: '/image', label: 'Image' },
  { path: '/git', label: 'Git' },
  { path: '/hex', label: 'Hex' },
  { path: '/folder', label: 'Folder' },
  { path: '/three-way', label: '3-Way' },
] as const

const MODE_PATHS = new Set(['/table', '/json', '/image', '/git', '/hex', '/folder', '/three-way'])

export function ModeTabs() {
  const location = useLocation()
  const pathname = location.pathname

  function isActive(path: string) {
    if (path === '/') return !MODE_PATHS.has(pathname)
    return pathname === path
  }

  return (
    <div className="mode-tabs" role="tablist" aria-label="Compare mode">
      {MODES.map(({ path, label }) => (
        <Link
          key={path}
          to={path}
          className={`mode-tab ${isActive(path) ? 'active' : ''}`}
          role="tab"
          aria-selected={isActive(path)}
        >
          {label}
        </Link>
      ))}
    </div>
  )
}
