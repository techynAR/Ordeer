import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import * as customersApi from '../api/customers'
import * as ordersApi from '../api/orders'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import SlideOver from '../components/SlideOver'
import DataTable from '../components/Table'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'

const PAGE_SIZE = 25

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const EMPTY_FORM = { full_name: '', email: '', phone: '' }

export default function CustomersPage() {
  const { formatPrice } = useApp()
  const { showToast } = useToast()
  const outletContext = useOutletContext()
  const navigate = useNavigate()

  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null)
  const [orderDetailsLoading, setOrderDetailsLoading] = useState(false)

  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortKey, setSortKey] = useState('full_name')
  const [sortDirection, setSortDirection] = useState('asc')

  const [newModalOpen, setNewModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState(null)
  const [formLoading, setFormLoading] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailCustomer, setDetailCustomer] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailEditing, setDetailEditing] = useState(false)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editError, setEditError] = useState(null)
  const [editLoading, setEditLoading] = useState(false)

  const searchRef = useRef(null)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await customersApi.listCustomers()
      setCustomers(data)
    } catch {
      setError('Failed to load customers.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  // Auto-open from command palette navigation
  useEffect(() => {
    const ctx = outletContext
    if (ctx?.pendingNavigation?.entityType === 'customer' && customers.length > 0) {
      const c = customers.find((c) => c.id === ctx.pendingNavigation.entityId)
      if (c) { openDetail(c); ctx.clearPendingNavigation?.() }
    }
  }, [outletContext, customers])

  // N shortcut
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
      if (e.key.toLowerCase() === 'n') { e.preventDefault(); openNew() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    setSelectedIds([])
  }, [currentPage, search])

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase()
    return !q || c.full_name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q)
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

  function openNew() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setNewModalOpen(true)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.full_name.trim()) { setFormError('Full name is required.'); return }
    if (!form.email.trim()) { setFormError('Email is required.'); return }
    if (!form.phone.trim()) { setFormError('Phone is required.'); return }
    setFormLoading(true)
    setFormError(null)
    try {
      const created = await customersApi.createCustomer(form)
      setCustomers((prev) => [...prev, created])
      setNewModalOpen(false)
      showToast(`Customer "${created.full_name}" added`, 'success')
    } catch (err) {
      setFormError(err.response?.data?.detail ?? 'Failed to create customer.')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleEdit(e) {
    e.preventDefault()
    if (!editForm.full_name.trim()) { setEditError('Full name is required.'); return }
    if (!editForm.email.trim()) { setEditError('Email is required.'); return }
    if (!editForm.phone.trim()) { setEditError('Phone is required.'); return }
    setEditLoading(true)
    setEditError(null)
    try {
      const updated = await customersApi.updateCustomer(detailCustomer.id, {
        full_name: editForm.full_name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
      })
      setCustomers((prev) => prev.map((c) => c.id === updated.id ? { ...c, ...updated } : c))
      setDetailCustomer((d) => ({ ...d, ...updated }))
      setDetailEditing(false)
      showToast(`Customer "${updated.full_name}" updated`, 'success')
    } catch (err) {
      setEditError(err.response?.data?.detail ?? 'Failed to update customer.')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDelete() {
    setDeleteLoading(true)
    try {
      if (deleteTarget?.isBulk) {
        const ids = deleteTarget.ids
        const results = await Promise.allSettled(
          ids.map(id => customersApi.deleteCustomer(id))
        )
        let successCount = 0
        let failureCount = 0
        let firstError = null

        results.forEach((res) => {
          if (res.status === 'fulfilled') {
            successCount++
          } else {
            failureCount++
            if (!firstError) {
              firstError = res.reason?.response?.data?.detail ?? 'Failed to delete some items.'
            }
          }
        })

        if (successCount > 0) {
          showToast(`Successfully deleted ${successCount} customer${successCount !== 1 ? 's' : ''}`, 'success')
        }
        if (failureCount > 0) {
          showToast(`Failed to delete ${failureCount} customer${failureCount !== 1 ? 's' : ''}: ${firstError}`, 'danger')
        }
        setSelectedIds([])
        fetchCustomers()
      } else {
        setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id))
        if (detailCustomer?.id === deleteTarget.id) { setDetailOpen(false); setDetailCustomer(null) }
        await customersApi.deleteCustomer(deleteTarget.id)
        showToast(`Customer "${deleteTarget.full_name}" removed`, 'info')
      }
      setDeleteTarget(null)
    } catch (err) {
      showToast(err.response?.data?.detail ?? 'Failed to delete customer', 'danger')
      setDeleteTarget(null)
      fetchCustomers()
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleOrderClick = async (orderId) => {
    setDetailOpen(false)
    setOrderDetailsLoading(true)
    try {
      const details = await ordersApi.getOrder(orderId)
      setSelectedOrderDetails(details)
    } catch {
      showToast('Failed to load order details.', 'danger')
      setDetailOpen(true)
    } finally {
      setOrderDetailsLoading(false)
    }
  }

  const handleModalBack = () => {
    setSelectedOrderDetails(null)
    setOrderDetailsLoading(false)
    setDetailOpen(true)
  }

  const openDetail = async (customer) => {
    setDetailCustomer(customer)
    setDetailOpen(true)
    setDetailEditing(false)
    setDetailLoading(true)
    try {
      const details = await customersApi.getCustomer(customer.id)
      setDetailCustomer(details)
    } catch { } finally { setDetailLoading(false) }
  }

  const handleSort = (key) => {
    setSortKey(key)
    setSortDirection((d) => (sortKey === key && d === 'asc' ? 'desc' : 'asc'))
  }

  const columns = [
    {
      key: 'full_name', label: 'Name', skeletonWidth: '70%', sortable: true,
      render: (r) => (
        <div>
          <span className="td-primary">{r.full_name}</span>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>{r.email}</div>
        </div>
      ),
    },
    {
      key: 'phone', label: 'Phone', width: 150, skeletonWidth: '50%',
      render: (r) => <span className="td-secondary" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.phone}</span>,
    },
    {
      key: 'created_at', label: 'Since', width: 110, skeletonWidth: '40%', sortable: true,
      render: (r) => <span className="td-secondary">{formatDate(r.created_at)}</span>,
    },
    {
      key: '_actions', label: '', width: 72, align: 'right',
      render: (r) => (
        <div className="td-actions">
          <button
            className="btn btn-ghost btn-icon btn-sm"
            title="Edit customer"
            onClick={(e) => {
              e.stopPropagation()
              setDetailCustomer(r)
              setDetailOpen(true)
              setDetailEditing(true)
              setEditForm({ full_name: r.full_name, email: r.email, phone: r.phone })
              setEditError(null)
            }}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" width="13" height="13">
              <path d="M11 2l3 3L5 14H2v-3L11 2z" />
            </svg>
          </button>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            style={{ color: 'var(--color-danger)' }}
            title="Delete customer"
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
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">{loading ? '—' : `${sorted.length} customer${sorted.length !== 1 ? 's' : ''}`}</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary" id="btn-new-customer" onClick={openNew}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 1v10M1 6h10" />
            </svg>
            New Customer
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
            placeholder="Search by name, email, or phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
          />
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <DataTable
        columns={columns}
        rows={paginated}
        loading={loading}
        onRowClick={openDetail}
        activeRowId={detailCustomer?.id}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        emptyState={
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
            title={search ? 'No customers found' : 'No customers yet'}
            description={search ? 'Try a different search.' : 'Add your first customer to get started.'}
            action={!search && <button className="btn btn-primary" onClick={openNew}>New Customer</button>}
          />
        }
        footer={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span className="table-count">{sorted.length} total · page {page} of {totalPages}</span>
            <Pagination currentPage={page} totalPages={totalPages} onChange={setCurrentPage} />
          </div>
        }
      />

      {/* Customer Detail Slide-Over */}
      <SlideOver
        isOpen={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailCustomer(null); setDetailEditing(false) }}
        title={detailCustomer?.full_name ?? 'Customer Details'}
        footer={
          detailCustomer && !detailEditing && (
            <div style={{ display: 'flex', width: '100%', gap: 8, justifyContent: 'space-between' }}>
              <button className="btn btn-danger" onClick={() => { setDeleteTarget(detailCustomer); setDetailOpen(false); }}>Delete</button>
              <button className="btn btn-secondary" onClick={() => {
                setDetailEditing(true)
                setEditForm({ full_name: detailCustomer.full_name, email: detailCustomer.email, phone: detailCustomer.phone })
                setEditError(null)
              }}>Edit Customer</button>
            </div>
          )
        }
      >
        {detailCustomer && (
          <>
            {/* Stats */}
            <div className="detail-stats-row">
              <div className="detail-stat">
                <div className="detail-stat-label">Orders</div>
                <div className="detail-stat-value">{detailCustomer.order_count ?? detailCustomer.orders?.length ?? '—'}</div>
              </div>
              <div className="detail-stat">
                <div className="detail-stat-label">Revenue</div>
                <div className="detail-stat-value" style={{ fontSize: 16 }}>
                  {detailCustomer.total_revenue !== undefined ? formatPrice(detailCustomer.total_revenue) : '—'}
                </div>
              </div>
              <div className="detail-stat">
                <div className="detail-stat-label">Since</div>
                <div className="detail-stat-value" style={{ fontSize: 13 }}>{formatDate(detailCustomer.created_at)}</div>
              </div>
            </div>

            {/* Contact */}
            <div className="detail-section">
              <div className="detail-section-title">Contact</div>
              <div className="detail-grid">
                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="detail-label">Email</span>
                  <a href={`mailto:${detailCustomer.email}`} className="detail-value" style={{ color: 'var(--color-accent)', textDecoration: 'none' }}>
                    {detailCustomer.email}
                  </a>
                </div>
                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="detail-label">Phone</span>
                  <span className="detail-value" style={{ fontFamily: 'var(--font-mono)' }}>{detailCustomer.phone}</span>
                </div>
              </div>
            </div>

            {/* Inline Edit */}
            {detailEditing && (
              <div className="detail-section">
                <div className="detail-section-title">Edit Customer</div>
                <div className="slideover-edit-form">
                  {editError && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{editError}</div>}
                  <form onSubmit={handleEdit}>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label">Full Name</label>
                      <input className="form-control" value={editForm.full_name} onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))} autoFocus />
                    </div>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label">Email</label>
                      <input className="form-control" type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                      <label className="form-label">Phone</label>
                      <input className="form-control" type="tel" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setDetailEditing(false); setEditError(null) }}>Cancel</button>
                      <button type="submit" className="btn btn-primary btn-sm" disabled={editLoading}>{editLoading ? 'Saving…' : 'Save Changes'}</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Order History */}
            {!detailLoading && (
              <div className="detail-section">
                <div className="detail-section-title">
                  Order History {detailCustomer.orders?.length > 0 ? `(${detailCustomer.orders.length})` : ''}
                </div>
                {!detailCustomer.orders || detailCustomer.orders.length === 0 ? (
                  <p className="detail-label">No orders placed yet.</p>
                ) : (
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailCustomer.orders.slice(0, 10).map((order) => (
                        <tr
                          key={order.id}
                          onClick={() => handleOrderClick(order.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="detail-value-mono">#{order.id}</td>
                          <td><span className={`status-badge status-${order.status}`}>{order.status}</span></td>
                          <td className="td-secondary">{formatDate(order.created_at)}</td>
                          <td style={{ fontWeight: 600 }}>{formatPrice(order.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        )}
      </SlideOver>

      {/* New Customer Modal */}
      <Modal isOpen={newModalOpen} onClose={() => setNewModalOpen(false)} title="New Customer">
        <Modal.Body>
          {formError && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{formError}</div>}
          <form onSubmit={handleCreate} id="customer-form">
            <div className="form-group">
              <label className="form-label form-label-required">Full Name</label>
              <input className="form-control" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="Jane Smith" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label form-label-required">Email</label>
              <input className="form-control" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label form-label-required">Phone</label>
              <input className="form-control" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+1 555 000 0000" />
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={() => setNewModalOpen(false)}>Cancel</button>
          <button className="btn btn-primary" type="submit" form="customer-form" disabled={formLoading}>
            {formLoading ? 'Creating…' : 'Create Customer'}
          </button>
        </Modal.Footer>
      </Modal>

      {selectedIds.length > 0 && (
        <div className="bulk-actions-floating-bar">
          <span className="bulk-actions-count">
            {selectedIds.length} customer{selectedIds.length !== 1 ? 's' : ''} selected
          </span>
          <div className="bulk-actions-btns">
            <button
              className="btn btn-sm bulk-btn-cancel"
              onClick={() => setSelectedIds([])}
            >
              Cancel
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => setDeleteTarget({ isBulk: true, ids: selectedIds })}
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title={deleteTarget?.isBulk ? 'Delete Customers' : 'Delete Customer'}
        message={
          deleteTarget?.isBulk ? (
            <>
              Delete <strong>{deleteTarget.ids.length}</strong> selected customers? This will fail for any customers with existing orders.
            </>
          ) : (
            <>
              Delete <strong>{deleteTarget?.full_name}</strong>? This will fail if they have existing orders.
            </>
          )
        }
      />

      {/* Order Details Modal (when clicked from history) */}
      <Modal
        isOpen={!!selectedOrderDetails}
        onClose={handleModalBack}
        title={selectedOrderDetails ? `Order #${selectedOrderDetails.id} Details` : ''}
      >
        <Modal.Body>
          {selectedOrderDetails && (
            <>
              <div className="detail-stats-row" style={{ marginBottom: 'var(--space-4)' }}>
                <div className="detail-stat">
                  <div className="detail-stat-label">Status</div>
                  <div style={{ marginTop: 4 }}><span className={`status-badge status-${selectedOrderDetails.status}`}>{selectedOrderDetails.status}</span></div>
                </div>
                <div className="detail-stat">
                  <div className="detail-stat-label">Total</div>
                  <div className="detail-stat-value" style={{ color: 'var(--color-accent)' }}>{formatPrice(selectedOrderDetails.total_amount)}</div>
                </div>
                <div className="detail-stat">
                  <div className="detail-stat-label">Items</div>
                  <div className="detail-stat-value">{selectedOrderDetails.items?.length ?? '—'}</div>
                </div>
              </div>

              <div className="detail-section">
                <div className="detail-section-title">Customer</div>
                {selectedOrderDetails.customer ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span className="detail-value">{selectedOrderDetails.customer.full_name}</span>
                    <span className="detail-label">{selectedOrderDetails.customer.email}</span>
                    <span className="detail-label">{selectedOrderDetails.customer.phone}</span>
                  </div>
                ) : (
                  <span className="detail-label">Customer #{selectedOrderDetails.customer_id}</span>
                )}
              </div>

              <div className="detail-section">
                <div className="detail-section-title">Timeline</div>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Placed</span>
                    <span className="detail-value">{new Date(selectedOrderDetails.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

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
                    {(selectedOrderDetails.items ?? []).map((item) => (
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
                      <td style={{ textAlign: 'right', color: 'var(--color-accent)' }}>{formatPrice(selectedOrderDetails.total_amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={handleModalBack}>Back</button>
          {selectedOrderDetails && (
            <button
              className="btn btn-primary"
              onClick={() => {
                const orderId = selectedOrderDetails.id
                setSelectedOrderDetails(null)
                setDetailOpen(false)
                if (outletContext?.setPendingNavigation) {
                  outletContext.setPendingNavigation({ entityId: orderId, entityType: 'order' })
                }
                navigate('/orders')
              }}
            >
              Go to Order
            </button>
          )}
        </Modal.Footer>
      </Modal>
    </>
  )
}
