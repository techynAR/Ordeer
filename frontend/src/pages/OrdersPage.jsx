import { useCallback, useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import * as ordersApi from '../api/orders'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import OrderWizard from '../components/OrderWizard'
import Pagination from '../components/Pagination'
import SlideOver from '../components/SlideOver'
import DataTable from '../components/Table'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'

const PAGE_SIZE = 25

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

const STATUS_OPTIONS = ['pending', 'processing', 'completed', 'cancelled']

function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{status}</span>
}

function StatusSelect({ currentStatus, orderId, onUpdate }) {
  const [updating, setUpdating] = useState(false)
  const { showToast } = useToast()

  const handleChange = async (e) => {
    const newStatus = e.target.value
    setUpdating(true)
    try {
      await onUpdate(orderId, newStatus)
      showToast(`Order status updated to ${newStatus}`, 'success')
    } catch (err) {
      showToast(err.response?.data?.detail ?? 'Failed to update status', 'danger')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <select
      className="form-control form-select"
      value={currentStatus}
      onChange={handleChange}
      disabled={updating}
      style={{ height: 30, fontSize: 12, width: '100%' }}
      onClick={(e) => e.stopPropagation()}
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  )
}

export default function OrdersPage() {
  const { formatPrice } = useApp()
  const { showToast } = useToast()
  const outletContext = useOutletContext()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDirection, setSortDirection] = useState('desc')

  const [wizardOpen, setWizardOpen] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailOrder, setDetailOrder] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailStatusEditing, setDetailStatusEditing] = useState(false)

  const searchRef = useRef(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await ordersApi.listOrders()
      setOrders(data)
    } catch {
      setError('Failed to load orders.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Open slide-over from command palette navigation
  useEffect(() => {
    const ctx = outletContext
    if (ctx?.pendingNavigation?.entityType === 'order' && orders.length > 0) {
      const order = orders.find((o) => o.id === ctx.pendingNavigation.entityId)
      if (order) {
        openDetail(order)
        ctx.clearPendingNavigation?.()
      }
    }
  }, [outletContext, orders])

  // Global keyboard shortcut: N = new order
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)
      if (!inInput && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        setWizardOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      String(o.id).includes(q)
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    return matchSearch && matchStatus
  })

  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey) return 0
    let aVal = a[sortKey], bVal = b[sortKey]
    if (typeof aVal === 'string') return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const page = Math.min(currentPage, totalPages)
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSort = (key) => {
    setSortKey(key)
    setSortDirection((d) => (sortKey === key && d === 'asc' ? 'desc' : 'asc'))
  }

  const openDetail = async (order) => {
    setDetailOrder(order)
    setDetailOpen(true)
    setDetailStatusEditing(false)
    setDetailLoading(true)
    try {
      const details = await ordersApi.getOrder(order.id)
      setDetailOrder(details)
    } catch {}
    finally { setDetailLoading(false) }
  }

  const handleStatusUpdate = useCallback(async (orderId, newStatus) => {
    // Optimistic update
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: newStatus } : o))
    if (detailOrder?.id === orderId) setDetailOrder((d) => d ? { ...d, status: newStatus } : d)
    const updated = await ordersApi.updateOrderStatus(orderId, newStatus)
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, ...updated } : o))
    if (detailOrder?.id === orderId) setDetailOrder(updated)
  }, [detailOrder])

  const handleDelete = async () => {
    setDeleteLoading(true)
    try {
      // Optimistic removal
      setOrders((prev) => prev.filter((o) => o.id !== deleteTarget.id))
      if (detailOrder?.id === deleteTarget.id) { setDetailOpen(false); setDetailOrder(null) }
      await ordersApi.deleteOrder(deleteTarget.id)
      showToast(`Order #${deleteTarget.id} deleted`, 'info')
      setDeleteTarget(null)
    } catch (err) {
      showToast(err.response?.data?.detail ?? 'Failed to delete order', 'danger')
      setDeleteTarget(null)
      fetchAll()
    } finally {
      setDeleteLoading(false)
    }
  }

  const columns = [
    {
      key: 'id', label: 'Order', width: 90, skeletonWidth: '40%', sortable: true,
      render: (r) => <span className="td-mono">#{r.id}</span>
    },
    {
      key: 'status', label: 'Status', width: 120, skeletonWidth: '50%',
      render: (r) => <StatusBadge status={r.status} />
    },
    {
      key: 'customer_id', label: 'Customer', skeletonWidth: '60%',
      render: (r) => (
        <span className="td-primary">
          {r.customer?.full_name ?? `Customer #${r.customer_id}`}
        </span>
      ),
    },
    {
      key: 'total_amount', label: 'Total', align: 'right', width: 110, skeletonWidth: '40%', sortable: true,
      render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatPrice(r.total_amount)}</span>,
    },
    {
      key: 'items', label: 'Items', align: 'center', width: 64, skeletonWidth: '30%',
      render: (r) => <span className="td-secondary">{r.items?.length ?? '—'}</span>,
    },
    {
      key: 'created_at', label: 'Date', width: 120, skeletonWidth: '55%', sortable: true,
      render: (r) => <span className="td-secondary">{formatDate(r.created_at)}</span>,
    },
    {
      key: '_actions', label: '', width: 60, align: 'right',
      render: (r) => (
        <div className="td-actions">
          <button
            className="btn btn-ghost btn-icon btn-sm"
            style={{ color: 'var(--color-danger)' }}
            title="Delete order"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget(r) }}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" width="13" height="13">
              <path d="M3 4h10M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6 7v5M10 7v5" />
              <path d="M4 4l.8 9h6.4L12 4" />
            </svg>
          </button>
        </div>
      ),
    },
  ]

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">
            {loading ? '—' : `${sorted.length} order${sorted.length !== 1 ? 's' : ''}${statusFilter !== 'all' ? ` · ${statusFilter}` : ''}`}
          </p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary" id="btn-new-order" onClick={() => setWizardOpen(true)}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 1v10M1 6h10" />
            </svg>
            New Order
          </button>
          <span className="kbd" style={{ marginLeft: 4 }}>N</span>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-wrap">
          <svg className="search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
            <circle cx="6.5" cy="6.5" r="4.5" />
            <path d="M10.5 10.5l3.5 3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={searchRef}
            type="search"
            className="search-input"
            placeholder="Search by order ID…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
          />
        </div>
        <div className="filter-bar-right">
          <select
            className="form-control form-select"
            style={{ height: 32, fontSize: 12, width: 'auto' }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1) }}
          >
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <DataTable
        columns={columns}
        rows={paginated}
        loading={loading}
        onRowClick={openDetail}
        activeRowId={detailOrder?.id}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        emptyState={
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <path d="M9 9h6M9 13h6M9 17h4" />
              </svg>
            }
            title={search || statusFilter !== 'all' ? 'No matching orders' : 'No orders yet'}
            description={search ? 'Try a different search term.' : 'Create your first order using the New Order button.'}
            action={!search && <button className="btn btn-primary" onClick={() => setWizardOpen(true)}>Create Order</button>}
          />
        }
        footer={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span className="table-count">{sorted.length} total · page {page} of {totalPages}</span>
            <Pagination currentPage={page} totalPages={totalPages} onChange={setCurrentPage} />
          </div>
        }
      />

      {/* Order Detail Slide-Over */}
      <SlideOver
        isOpen={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailOrder(null) }}
        title={detailOrder ? `Order #${detailOrder.id}` : 'Order Details'}
        footer={
          detailOrder && (
            <div style={{ display: 'flex', width: '100%', gap: 8, justifyContent: 'space-between' }}>
              <button className="btn btn-danger" onClick={() => setDeleteTarget(detailOrder)}>
                Delete Order
              </button>
            </div>
          )
        }
      >
        {detailLoading && !detailOrder?.customer ? (
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexDirection: 'column' }}>
            {[80, 60, 100, 70].map((w, i) => (
              <div key={i} className="skeleton-cell" style={{ width: `${w}%`, height: 13 }} />
            ))}
          </div>
        ) : detailOrder && (
          <>
            {/* Status + quick change */}
            <div className="detail-stats-row">
              <div className="detail-stat">
                <div className="detail-stat-label">Status</div>
                {detailStatusEditing ? (
                  <StatusSelect
                    currentStatus={detailOrder.status}
                    orderId={detailOrder.id}
                    onUpdate={async (id, st) => { await handleStatusUpdate(id, st); setDetailStatusEditing(false) }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <StatusBadge status={detailOrder.status} />
                    <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setDetailStatusEditing(true)}>Edit</button>
                  </div>
                )}
              </div>
              <div className="detail-stat">
                <div className="detail-stat-label">Total</div>
                <div className="detail-stat-value" style={{ color: 'var(--color-accent)' }}>{formatPrice(detailOrder.total_amount)}</div>
              </div>
              <div className="detail-stat">
                <div className="detail-stat-label">Items</div>
                <div className="detail-stat-value">{detailOrder.items?.length ?? '—'}</div>
              </div>
            </div>

            {/* Customer */}
            <div className="detail-section">
              <div className="detail-section-title">Customer</div>
              {detailOrder.customer ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span className="detail-value">{detailOrder.customer.full_name}</span>
                  <span className="detail-label">{detailOrder.customer.email}</span>
                  <span className="detail-label">{detailOrder.customer.phone}</span>
                </div>
              ) : (
                <span className="detail-label">Customer #{detailOrder.customer_id}</span>
              )}
            </div>

            {/* Timeline */}
            <div className="detail-section">
              <div className="detail-section-title">Timeline</div>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Placed</span>
                  <span className="detail-value">{new Date(detailOrder.created_at).toLocaleString()}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Updated</span>
                  <span className="detail-value">{detailOrder.updated_at ? new Date(detailOrder.updated_at).toLocaleString() : '—'}</span>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="detail-section">
              <div className="detail-section-title">Line Items</div>
              <table className="items-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style={{ textAlign: 'center', width: 40 }}>Qty</th>
                    <th style={{ textAlign: 'right', width: 80 }}>Price</th>
                    <th style={{ textAlign: 'right', width: 80 }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(detailOrder.items ?? []).map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{item.product?.name ?? `Product #${item.product_id}`}</div>
                        {item.product?.sku && <div className="detail-value-mono">{item.product.sku}</div>}
                      </td>
                      <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right' }}>{formatPrice(item.unit_price)}</td>
                      <td style={{ textAlign: 'right' }}>{formatPrice(item.subtotal)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td colSpan={3}>Order Total</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-accent)' }}>{formatPrice(detailOrder.total_amount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </SlideOver>

      {/* Order Wizard */}
      <OrderWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onOrderCreated={(orderId) => {
          fetchAll()
          if (orderId) {
            // Auto-open the new order's slide-over
            setTimeout(() => {
              ordersApi.getOrder(orderId).then((o) => {
                setDetailOrder(o)
                setDetailOpen(true)
              }).catch(() => {})
            }, 200)
          }
        }}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete Order"
        message={
          <>
            Delete order <strong>#{deleteTarget?.id}</strong> ({formatPrice(deleteTarget?.total_amount ?? 0)})?
            This cannot be undone.
          </>
        }
      />
    </>
  )
}
