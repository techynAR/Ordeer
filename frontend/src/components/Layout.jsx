import { useCallback, useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { ToastProvider } from '../context/ToastContext'
import CommandPalette from './CommandPalette'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppShell() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true'
  })
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false)
  // pendingNavigation: { entityId, entityType } for pages to pick up and open slide-over
  const [pendingNavigation, setPendingNavigation] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', isSidebarCollapsed)
  }, [isSidebarCollapsed])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Cmd+K or Ctrl+K → open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleCmdPaletteNavigate = useCallback((path, entityId, entityType) => {
    setPendingNavigation({ entityId, entityType })
    navigate(path)
  }, [navigate])

  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar
          collapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
        <div className={`main-area ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <Topbar onOpenSearch={() => setCmdPaletteOpen(true)} />
          <main className="content">
            <Outlet context={{ pendingNavigation, clearPendingNavigation: () => setPendingNavigation(null) }} />
          </main>
        </div>
      </div>

      <CommandPalette
        isOpen={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        onNavigate={handleCmdPaletteNavigate}
      />
    </ToastProvider>
  )
}
