import { useCallback, useEffect, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import * as productsApi from '../api/products'
import ConfirmDialog from '../components/ConfirmDialog'
import EmptyState from '../components/EmptyState'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import SlideOver from '../components/SlideOver'
import DataTable from '../components/Table'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'

const PAGE_SIZE = 25
const LOW_STOCK_THRESHOLD = 10

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function StockSignal({ qty }) {
  if (qty === 0) return <span className="stock-signal stock-empty">Out of Stock</span>
  if (qty <= 5) return <span className="stock-signal stock-critical">Critical</span>
  if (qty <= LOW_STOCK_THRESHOLD) return <span className="stock-signal stock-warning">Low Stock</span>
  return <span className="stock-signal stock-healthy">In Stock</span>
}

const EMPTY_FORM = { name: '', sku: '', price: '', stock_quantity: '' }

export default function ProductsPage() {
  const { formatPrice } = useApp()
  const { showToast } = useToast()
  const outletContext = useOutletContext()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortKey, setSortKey] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')

  const [newModalOpen, setNewModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState(null)
  const [formLoading, setFormLoading] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailProduct, setDetailProduct] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailEditing, setDetailEditing] = useState(false)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editError, setEditError] = useState(null)
  const [editLoading, setEditLoading] = useState(false)

  const searchRef = useRef(null)

  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await productsApi.listProducts()
      setProducts(data)
    } catch {
      setError('Failed to load products.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  // Command palette navigation: auto-open slide-over
  useEffect(() => {
    const ctx = outletContext
    if (ctx?.pendingNavigation?.entityType === 'product' && products.length > 0) {
      const p = products.find((p) => p.id === ctx.pendingNavigation.entityId)
      if (p) { openDetail(p); ctx.clearPendingNavigation?.() }
    }
  }, [outletContext, products])

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

  const filtered = products.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    const matchStock =
      stockFilter === 'all' ? true :
      stockFilter === 'out' ? p.stock_quantity === 0 :
      stockFilter === 'low' ? p.stock_quantity > 0 && p.stock_quantity <= LOW_STOCK_THRESHOLD :
      stockFilter === 'ok' ? p.stock_quantity > LOW_STOCK_THRESHOLD : true
    return matchSearch && matchStock
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

  function validateForm(f) {
    if (!f.name.trim()) return 'Name is required.'
    if (!f.sku.trim()) return 'SKU is required.'
    const price = parseFloat(f.price)
    if (isNaN(price) || price < 0) return 'Price must be a non-negative number.'
    const qty = parseInt(f.stock_quantity, 10)
    if (isNaN(qty) || qty < 0) return 'Stock quantity must be a non-negative integer.'
    return null
  }

  async function handleCreate(e) {
    e.preventDefault()
    const err = validateForm(form)
    if (err) { setFormError(err); return }
    setFormLoading(true)
    setFormError(null)
    try {
      const created = await productsApi.createProduct({
        name: form.name.trim(), sku: form.sku.trim(),
        price: parseFloat(form.price), stock_quantity: parseInt(form.stock_quantity, 10),
      })
      setProducts((prev) => [...prev, created])
      setNewModalOpen(false)
      showToast(`Product "${created.name}" created`, 'success')
    } catch (err) {
      setFormError(err.response?.data?.detail ?? 'Failed to create product.')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleEdit(e) {
    e.preventDefault()
    const err = validateForm(editForm)
    if (err) { setEditError(err); return }
    setEditLoading(true)
    setEditError(null)
    try {
      const updated = await productsApi.updateProduct(detailProduct.id, {
        name: editForm.name.trim(), sku: editForm.sku.trim(),
        price: parseFloat(editForm.price), stock_quantity: parseInt(editForm.stock_quantity, 10),
      })
      setProducts((prev) => prev.map((p) => p.id === updated.id ? updated : p))
      setDetailProduct((d) => ({ ...d, ...updated }))
      setDetailEditing(false)
      showToast(`Product "${updated.name}" updated`, 'success')
    } catch (err) {
      setEditError(err.response?.data?.detail ?? 'Failed to update product.')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDelete() {
    setDeleteLoading(true)
    try {
      // Optimistic removal
      setProducts((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      if (detailProduct?.id === deleteTarget.id) { setDetailOpen(false); setDetailProduct(null) }
      await productsApi.deleteProduct(deleteTarget.id)
      showToast(`Product "${deleteTarget.name}" deleted`, 'info')
      setDeleteTarget(null)
    } catch (err) {
      showToast(err.response?.data?.detail ?? 'Failed to delete product', 'danger')
      setDeleteTarget(null)
      fetchProducts()
    } finally {
      setDeleteLoading(false)
    }
  }

  const openDetail = async (product) => {
    setDetailProduct(product)
    setDetailOpen(true)
    setDetailEditing(false)
    setDetailLoading(true)
    try {
      const details = await productsApi.getProduct(product.id)
      setDetailProduct(details)
    } catch {} finally { setDetailLoading(false) }
  }

  const handleSort = (key) => {
    setSortKey(key)
    setSortDirection((d) => (sortKey === key && d === 'asc' ? 'desc' : 'asc'))
  }

  const lowStockCount = products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= LOW_STOCK_THRESHOLD).length
  const outOfStockCount = products.filter((p) => p.stock_quantity === 0).length

  const columns = [
    {
      key: 'name', label: 'Product', skeletonWidth: '70%', sortable: true,
      render: (r) => (
        <div>
          <span className="td-primary">{r.name}</span>
          <div className="td-mono" style={{ fontSize: 11, marginTop: 1 }}>{r.sku}</div>
        </div>
      ),
    },
    {
      key: 'stock_quantity', label: 'Stock', width: 130, skeletonWidth: '50%', sortable: true,
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StockSignal qty={r.stock_quantity} />
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)', fontSize: 12 }}>{r.stock_quantity}</span>
        </div>
      ),
    },
    {
      key: 'price', label: 'Price', align: 'right', width: 100, skeletonWidth: '40%', sortable: true,
      render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{formatPrice(r.price)}</span>,
    },
    {
      key: 'updated_at', label: 'Updated', width: 110, skeletonWidth: '55%', sortable: true,
      render: (r) => <span className="td-secondary">{formatDate(r.updated_at)}</span>,
    },
    {
      key: '_actions', label: '', width: 72, align: 'right',
      render: (r) => (
        <div className="td-actions">
          <button
            className="btn btn-ghost btn-icon btn-sm"
            title="Edit product"
            onClick={(e) => {
              e.stopPropagation()
              setDetailProduct(r)
              setDetailOpen(true)
              setDetailEditing(true)
              setEditForm({ name: r.name, sku: r.sku, price: String(r.price), stock_quantity: String(r.stock_quantity) })
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
            title="Delete product"
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
      {(outOfStockCount > 0 || lowStockCount > 0) && (
        <div className="op-alert-banner">
          <svg className="op-alert-banner-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" width="16" height="16">
            <path d="M8 2L1 14h14L8 2z" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 6v4M8 12v.5" strokeLinecap="round" />
          </svg>
          <div className="op-alert-banner-text">
            <strong>Inventory Alert:</strong>{' '}
            {outOfStockCount > 0 && `${outOfStockCount} product${outOfStockCount !== 1 ? 's' : ''} out of stock`}
            {outOfStockCount > 0 && lowStockCount > 0 && ', '}
            {lowStockCount > 0 && `${lowStockCount} running low`}
          </div>
          <span
            className="op-alert-banner-action"
            onClick={() => setStockFilter('low')}
          >
            View low stock
          </span>
        </div>
      )}

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">
            {loading ? '—' : `${sorted.length} product${sorted.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary" id="btn-new-product" onClick={openNew}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 1v10M1 6h10" />
            </svg>
            New Product
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
            placeholder="Search by name or SKU…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
          />
        </div>
        <div className="filter-bar-right">
          <select
            className="form-control form-select"
            style={{ height: 32, fontSize: 12, width: 'auto' }}
            value={stockFilter}
            onChange={(e) => { setStockFilter(e.target.value); setCurrentPage(1) }}
          >
            <option value="all">All Stock</option>
            <option value="out">Out of Stock</option>
            <option value="low">Low Stock</option>
            <option value="ok">Healthy</option>
          </select>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <DataTable
        columns={columns}
        rows={paginated}
        loading={loading}
        onRowClick={openDetail}
        activeRowId={detailProduct?.id}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        emptyState={
          <EmptyState
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            }
            title={search || stockFilter !== 'all' ? 'No matching products' : 'No products yet'}
            description={search ? 'Try a different search.' : 'Add your first product to get started.'}
            action={!search && <button className="btn btn-primary" onClick={openNew}>New Product</button>}
          />
        }
        footer={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span className="table-count">{sorted.length} total · page {page} of {totalPages}</span>
            <Pagination currentPage={page} totalPages={totalPages} onChange={setCurrentPage} />
          </div>
        }
      />

      {/* Product Detail Slide-Over */}
      <SlideOver
        isOpen={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailProduct(null); setDetailEditing(false) }}
        title={detailProduct?.name ?? 'Product Details'}
        footer={
          detailProduct && !detailEditing && (
            <div style={{ display: 'flex', width: '100%', gap: 8, justifyContent: 'space-between' }}>
              <button className="btn btn-danger" onClick={() => setDeleteTarget(detailProduct)}>Delete</button>
              <button className="btn btn-secondary" onClick={() => {
                setDetailEditing(true)
                setEditForm({ name: detailProduct.name, sku: detailProduct.sku, price: String(detailProduct.price), stock_quantity: String(detailProduct.stock_quantity) })
                setEditError(null)
              }}>Edit Product</button>
            </div>
          )
        }
      >
        {detailProduct && (
          <>
            {/* Stats Row — from backend aggregates */}
            <div className="detail-stats-row">
              <div className="detail-stat">
                <div className="detail-stat-label">Price</div>
                <div className="detail-stat-value">{formatPrice(detailProduct.price)}</div>
              </div>
              <div className="detail-stat">
                <div className="detail-stat-label">In Stock</div>
                <div className="detail-stat-value" style={{ color: detailProduct.stock_quantity === 0 ? 'var(--color-danger)' : detailProduct.stock_quantity <= LOW_STOCK_THRESHOLD ? 'var(--color-warning)' : 'var(--color-success)' }}>
                  {detailProduct.stock_quantity}
                </div>
              </div>
              {detailProduct.total_revenue !== undefined && (
                <div className="detail-stat">
                  <div className="detail-stat-label">Revenue</div>
                  <div className="detail-stat-value" style={{ fontSize: 16 }}>{formatPrice(detailProduct.total_revenue)}</div>
                </div>
              )}
              {detailProduct.order_count !== undefined && (
                <div className="detail-stat">
                  <div className="detail-stat-label">Orders</div>
                  <div className="detail-stat-value">{detailProduct.order_count}</div>
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="detail-section">
              <div className="detail-section-title">Product Info</div>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">SKU</span>
                  <span className="detail-value-mono">{detailProduct.sku}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Stock Signal</span>
                  <div style={{ marginTop: 3 }}><StockSignal qty={detailProduct.stock_quantity} /></div>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Created</span>
                  <span className="detail-value">{formatDate(detailProduct.created_at)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Updated</span>
                  <span className="detail-value">{formatDate(detailProduct.updated_at)}</span>
                </div>
                {detailProduct.last_ordered_at && (
                  <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                    <span className="detail-label">Last Ordered</span>
                    <span className="detail-value">{new Date(detailProduct.last_ordered_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Inline Edit Form */}
            {detailEditing && (
              <div className="detail-section">
                <div className="detail-section-title">Edit Product</div>
                <div className="slideover-edit-form">
                  {editError && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{editError}</div>}
                  <form onSubmit={handleEdit} id="edit-product-form">
                    <div className="grid-2col">
                      <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                        <label className="form-label">Name</label>
                        <input className="form-control" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">SKU</label>
                        <input className="form-control" value={editForm.sku} onChange={(e) => setEditForm((f) => ({ ...f, sku: e.target.value }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Price</label>
                        <input className="form-control" type="number" min="0" step="0.01" value={editForm.price} onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                        <label className="form-label">Stock Quantity</label>
                        <input className="form-control" type="number" min="0" step="1" value={editForm.stock_quantity} onChange={(e) => setEditForm((f) => ({ ...f, stock_quantity: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
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
                  Order History {detailProduct.order_count > 0 ? `(${detailProduct.order_count})` : ''}
                </div>
                {!detailProduct.order_items || detailProduct.order_items.length === 0 ? (
                  <p className="detail-label">This product hasn't been ordered yet.</p>
                ) : (
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th style={{ textAlign: 'center', width: 40 }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Price</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailProduct.order_items.slice(0, 10).map((item) => (
                        <tr key={item.id}>
                          <td className="detail-value-mono">#{item.order_id}</td>
                          <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ textAlign: 'right' }}>{formatPrice(item.unit_price)}</td>
                          <td>{formatPrice(item.subtotal)}</td>
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

      {/* New Product Modal */}
      <Modal isOpen={newModalOpen} onClose={() => setNewModalOpen(false)} title="New Product">
        <Modal.Body>
          {formError && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{formError}</div>}
          <form onSubmit={handleCreate} id="product-form">
            <div className="form-group">
              <label className="form-label form-label-required">Name</label>
              <input className="form-control" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Wireless Mouse" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label form-label-required">SKU</label>
              <input className="form-control" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="e.g. WM-001" />
            </div>
            <div className="grid-2col">
              <div className="form-group">
                <label className="form-label form-label-required">Price</label>
                <input className="form-control" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="form-label form-label-required">Stock Qty</label>
                <input className="form-control" type="number" min="0" step="1" value={form.stock_quantity} onChange={(e) => setForm((f) => ({ ...f, stock_quantity: e.target.value }))} placeholder="0" />
              </div>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-secondary" onClick={() => setNewModalOpen(false)}>Cancel</button>
          <button className="btn btn-primary" type="submit" form="product-form" disabled={formLoading}>
            {formLoading ? 'Creating…' : 'Create Product'}
          </button>
        </Modal.Footer>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete Product"
        message={<>Delete <strong>{deleteTarget?.name}</strong> (SKU: {deleteTarget?.sku})? This cannot be undone.</>}
      />
    </>
  )
}
