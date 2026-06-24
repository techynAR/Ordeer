import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardStats } from '../api/dashboard'
import OrderWizard from '../components/OrderWizard'
import { useApp } from '../context/AppContext'

const LOW_STOCK_THRESHOLD = 10

function StockSignal({ qty }) {
  if (qty === 0) return <span className="stock-signal stock-empty">Out</span>
  if (qty <= 5) return <span className="stock-signal stock-critical">Critical</span>
  if (qty <= LOW_STOCK_THRESHOLD) return <span className="stock-signal stock-warning">Low</span>
  return <span className="stock-signal stock-healthy">OK</span>
}

function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{status}</span>
}

function Skeleton({ lines = 4, width = '70%' }) {
  return (
    <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton-cell" style={{ width, height: 14 }} />
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { formatPrice } = useApp()
  const navigate = useNavigate()

  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getDashboardStats()
      .then((data) => { if (!cancelled) { setStats(data); setLoading(false) } })
      .catch(() => { if (!cancelled) { setError('Failed to load dashboard stats.'); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const outOfStock = stats?.low_stock_items?.filter((i) => i.stock_quantity === 0) ?? []
  const lowStock = stats?.low_stock_items?.filter((i) => i.stock_quantity > 0) ?? []

  const timeOfDay = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <>
      {/* Alert Banner for critical inventory */}
      {!loading && (outOfStock.length > 0 || lowStock.length > 0) && (
        <div className="op-alert-banner">
          <svg className="op-alert-banner-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" width="16" height="16">
            <path d="M8 2L1 14h14L8 2z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 6v4M8 12v.5" strokeLinecap="round" />
          </svg>
          <div className="op-alert-banner-text">
            <strong>Action Required:</strong>{' '}
            {outOfStock.length > 0 && <>{outOfStock.length} product{outOfStock.length > 1 ? 's' : ''} out of stock.</>}
            {lowStock.length > 0 && <> {lowStock.length} running low.</>}
          </div>
          <span className="op-alert-banner-action" onClick={() => navigate('/products')}>
            Manage Inventory
          </span>
        </div>
      )}

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{timeOfDay}</h1>
          <p className="page-subtitle">
            {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary" onClick={() => setWizardOpen(true)}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 1v10M1 6h10" />
            </svg>
            New Order
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="dashboard-grid">
        {/* Left column: Recent Orders + Low Stock */}
        <div className="col-span-8" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

          {/* Recent Orders */}
          <div className="widget">
            <div className="widget-header">
              <span>Recent Orders</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/orders')}>
                View all →
              </button>
            </div>
            <div className="widget-body" style={{ padding: 0 }}>
              {loading ? (
                <Skeleton lines={5} width="80%" />
              ) : !stats?.recent_orders?.length ? (
                <div style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                  No orders yet.
                </div>
              ) : (
                <ul className="dash-list">
                  {stats.recent_orders.map((order) => (
                    <li key={order.id} className="dash-item" onClick={() => navigate('/orders')}>
                      <div>
                        <div className="dash-item-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)' }}>#{order.id}</span>
                          {order.customer_name}
                        </div>
                        <div className="dash-item-meta">
                          <StatusBadge status={order.status} />
                          <span style={{ marginLeft: 6 }}>{new Date(order.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="dash-item-value">{formatPrice(order.total_amount)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Inventory Watchlist */}
          <div className="widget">
            <div className="widget-header">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Inventory Watchlist
                {!loading && stats?.low_stock_count > 0 && (
                  <span className="badge badge-warning">{stats.low_stock_count} need attention</span>
                )}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/products')}>
                All products →
              </button>
            </div>
            <div className="widget-body" style={{ padding: 0 }}>
              {loading ? (
                <Skeleton lines={4} width="70%" />
              ) : !stats?.low_stock_items?.length ? (
                <div style={{ padding: 'var(--space-5)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--color-success)' }}>✓</span> All products have sufficient stock.
                </div>
              ) : (
                <ul className="dash-list">
                  {stats.low_stock_items.map((item) => (
                    <li key={item.id} className="dash-item" onClick={() => navigate('/products')}>
                      <div>
                        <div className="dash-item-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {item.name}
                          <StockSignal qty={item.stock_quantity} />
                        </div>
                        <div className="dash-item-meta">
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{item.sku}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: item.stock_quantity === 0 ? 'var(--color-danger)' : item.stock_quantity <= 5 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                        {item.stock_quantity}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Quick Actions + Revenue Summary + Recent Customers */}
        <div className="col-span-4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

          {/* Quick Actions */}
          <div className="widget">
            <div className="widget-header">Quick Actions</div>
            <div className="widget-body">
              <div className="quick-action-grid">
                <button
                  className="btn btn-primary"
                  style={{ justifyContent: 'flex-start', gap: 'var(--space-3)', height: 40, paddingLeft: 'var(--space-4)' }}
                  onClick={() => setWizardOpen(true)}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" width="14" height="14">
                    <rect x="2" y="2" width="12" height="12" rx="1" />
                    <path d="M8 5v6M5 8h6" strokeLinecap="round" />
                  </svg>
                  New Order
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', gap: 'var(--space-3)', height: 40, paddingLeft: 'var(--space-4)' }}
                  onClick={() => navigate('/products?new=true')}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" width="14" height="14">
                    <path d="M8 2L2 5v6l6 3 6-3V5L8 2z" />
                    <path d="M8 2v14M2 5l6 3 6-3" strokeLinecap="round" />
                  </svg>
                  Add Product
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ justifyContent: 'flex-start', gap: 'var(--space-3)', height: 40, paddingLeft: 'var(--space-4)' }}
                  onClick={() => navigate('/customers?new=true')}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" width="14" height="14">
                    <circle cx="8" cy="5" r="2.5" />
                    <path d="M3 14c0-2.76 2.24-5 5-5s5 2.24 5 5" strokeLinecap="round" />
                  </svg>
                  New Customer
                </button>
              </div>
            </div>
          </div>

          {/* Revenue Summary */}
          <div className="widget">
            <div className="widget-header">Revenue Summary</div>
            <div className="widget-body" style={{ padding: 0 }}>
              {loading ? <Skeleton lines={3} width="60%" /> : (
                <div className="revenue-grid">
                  <div className="revenue-stat">
                    <div className="revenue-stat-label">Total Revenue</div>
                    <div className="revenue-stat-value" style={{ color: 'var(--color-accent)' }}>
                      {formatPrice(stats?.total_revenue ?? 0)}
                    </div>
                  </div>
                  <div className="revenue-stat-sub">
                    <div className="revenue-sub-item">
                      <div className="revenue-sub-label">Orders</div>
                      <div className="revenue-sub-value">{stats?.total_orders ?? 0}</div>
                    </div>
                    <div className="revenue-sub-item">
                      <div className="revenue-sub-label">Avg Order</div>
                      <div className="revenue-sub-value">
                        {stats && stats.total_orders > 0
                          ? formatPrice(stats.total_revenue / stats.total_orders)
                          : '—'}
                      </div>
                    </div>
                    <div className="revenue-sub-item">
                      <div className="revenue-sub-label">Products</div>
                      <div className="revenue-sub-value">{stats?.total_products ?? 0}</div>
                    </div>
                    <div className="revenue-sub-item">
                      <div className="revenue-sub-label">Customers</div>
                      <div className="revenue-sub-value">{stats?.total_customers ?? 0}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Customers */}
          <div className="widget">
            <div className="widget-header">
              <span>New Customers</span>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/customers')}>
                All →
              </button>
            </div>
            <div className="widget-body" style={{ padding: 0 }}>
              {loading ? (
                <Skeleton lines={3} width="75%" />
              ) : !stats?.recent_customers?.length ? (
                <div style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                  No customers yet.
                </div>
              ) : (
                <ul className="dash-list">
                  {stats.recent_customers.map((c) => (
                    <li key={c.id} className="dash-item" onClick={() => navigate('/customers')}>
                      <div>
                        <div className="dash-item-title">{c.full_name}</div>
                        <div className="dash-item-meta">{c.email}</div>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
                        {new Date(c.created_at).toLocaleDateString()}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <OrderWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onOrderCreated={() => {
          setWizardOpen(false)
          // Reload stats after new order
          getDashboardStats().then(setStats).catch(() => {})
        }}
      />
    </>
  )
}
