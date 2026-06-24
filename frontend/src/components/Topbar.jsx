import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'

export default function Topbar({ onOpenSearch }) {
  const notificationRef = useRef(null)
  const userRef = useRef(null)

  const { currency, setCurrency, notifications, availableCurrencies } = useApp()

  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifOpen && notificationRef.current && !notificationRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
      if (userOpen && userRef.current && !userRef.current.contains(e.target)) {
        setUserOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [notifOpen, userOpen])

  return (
    <header className="topbar">
      {/* Cmd+K Search Trigger */}
      <button className="search-trigger" onClick={onOpenSearch} aria-label="Open search">
        <svg className="search-trigger-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="6.5" cy="6.5" r="4.5" />
          <path d="M11 11l3 3" strokeLinecap="round" />
        </svg>
        <span className="search-trigger-text">Search everything…</span>
        <span className="search-trigger-kbd">
          <span>⌘</span>
          <span>K</span>
        </span>
      </button>

      <div className="topbar-actions">
        {/* Notifications Bell */}
        <div style={{ position: 'relative' }} ref={notificationRef}>
          <button
            className="btn btn-ghost btn-icon"
            aria-label="Notifications"
            onClick={() => { setNotifOpen(!notifOpen); setUserOpen(false) }}
            style={{ position: 'relative' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifications.length > 0 && (
              <span style={{
                position: 'absolute', top: 5, right: 5, width: 7, height: 7,
                backgroundColor: 'var(--color-danger)', borderRadius: '50%',
                border: '1.5px solid var(--color-surface)'
              }} />
            )}
          </button>

          {notifOpen && (
            <div className="popover">
              <div className="popover-header">
                Alerts & Notifications
                {notifications.length > 0 && (
                  <span className="badge badge-danger" style={{ marginLeft: 8 }}>{notifications.length}</span>
                )}
              </div>
              <div className="popover-body">
                {notifications.length === 0 ? (
                  <div className="popover-empty">All systems functional. No warnings.</div>
                ) : (
                  notifications.map((notif) => (
                    <div className="popover-item" key={notif.id}>
                      <span className="popover-item-title" style={{ color: 'var(--color-warning)' }}>
                        {notif.title}
                      </span>
                      <span className="popover-item-desc">{notif.message}</span>
                      <span className="popover-item-time">{notif.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User profile & Currency */}
        <div style={{ position: 'relative' }} ref={userRef}>
          <button
            className="btn btn-ghost btn-icon"
            aria-label="User menu"
            onClick={() => { setUserOpen(!userOpen); setNotifOpen(false) }}
          >
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              backgroundColor: 'var(--color-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: 'white', letterSpacing: '-0.02em'
            }}>
              A
            </div>
          </button>

          {userOpen && (
            <div className="popover user-popover">
              <div className="user-info">
                <div className="user-name">Ordeer Admin</div>
                <div className="user-email">admin@ordeer.com</div>
              </div>
              <div className="user-settings-section">
                <div className="user-settings-title">Currency</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {availableCurrencies.map((curr) => (
                    <button
                      key={curr}
                      className={`btn ${currency === curr ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ height: 24, fontSize: 11, padding: '0 8px' }}
                      onClick={() => setCurrency(curr)}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
