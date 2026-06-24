import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as customersApi from '../api/customers'
import * as ordersApi from '../api/orders'
import * as productsApi from '../api/products'
import { useApp } from '../context/AppContext'
import { useToast } from '../context/ToastContext'

// Debounce hook
function useDebounce(value, delay) {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return dv
}

const LOW_STOCK = 10

function StockSignal({ qty }) {
  if (qty === 0) return <span className="stock-signal stock-empty">Out of Stock</span>
  if (qty <= 5) return <span className="stock-signal stock-critical">Critical ({qty})</span>
  if (qty <= LOW_STOCK) return <span className="stock-signal stock-warning">Low ({qty})</span>
  return <span className="stock-signal stock-healthy">{qty} in stock</span>
}

const STEPS = [
  { label: 'Customer' },
  { label: 'Products' },
  { label: 'Review' },
]

export default function OrderWizard({ isOpen, onClose, onOrderCreated }) {
  const [step, setStep] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [animate, setAnimate] = useState(false)

  // Step 1
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustomerForm, setNewCustomerForm] = useState({ full_name: '', email: '', phone: '' })
  const [creatingCustomer, setCreatingCustomer] = useState(false)
  const [customerError, setCustomerError] = useState(null)

  // Step 2
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState([])
  const [lineItems, setLineItems] = useState([]) // { product, qty }
  const [productSearchLoading, setProductSearchLoading] = useState(false)

  // Step 3 & 4
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [createdOrder, setCreatedOrder] = useState(null)

  const customerInputRef = useRef(null)
  const productInputRef = useRef(null)
  const debouncedCustomerQ = useDebounce(customerQuery, 220)
  const debouncedProductQ = useDebounce(productQuery, 220)
  const { formatPrice } = useApp()
  const { showToast } = useToast()

  // Mount/animate
  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      setTimeout(() => setAnimate(true), 10)
    } else {
      setAnimate(false)
      setTimeout(() => setMounted(false), 200)
    }
  }, [isOpen])

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep(0)
      setCustomerQuery('')
      setCustomerResults([])
      setSelectedCustomer(null)
      setShowNewCustomer(false)
      setNewCustomerForm({ full_name: '', email: '', phone: '' })
      setCustomerError(null)
      setProductQuery('')
      setProductResults([])
      setLineItems([])
      setSubmitError(null)
      setCreatedOrder(null)
      setTimeout(() => customerInputRef.current?.focus(), 120)
    }
  }, [isOpen])

  // Focus on step change
  useEffect(() => {
    if (step === 1) setTimeout(() => productInputRef.current?.focus(), 100)
  }, [step])

  // Customer search
  useEffect(() => {
    if (!debouncedCustomerQ.trim()) { setCustomerResults([]); return }
    customersApi.searchCustomers(debouncedCustomerQ, 8).catch(() => []).then(setCustomerResults)
  }, [debouncedCustomerQ])

  // Product search
  useEffect(() => {
    if (!debouncedProductQ.trim()) { setProductResults([]); return }
    setProductSearchLoading(true)
    productsApi.searchProducts(debouncedProductQ, 8).catch(() => []).then((r) => {
      setProductResults(r)
      setProductSearchLoading(false)
    })
  }, [debouncedProductQ])

  // Esc key
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const totalAmount = lineItems.reduce((sum, li) => sum + li.product.price * li.qty, 0)

  const addProduct = useCallback((product) => {
    setLineItems((prev) => {
      const existing = prev.find((li) => li.product.id === product.id)
      if (existing) return prev.map((li) => li.product.id === product.id ? { ...li, qty: li.qty + 1 } : li)
      return [...prev, { product, qty: 1 }]
    })
    setProductQuery('')
    setProductResults([])
  }, [])

  const updateQty = useCallback((productId, qty) => {
    const q = Math.max(1, parseInt(qty) || 1)
    setLineItems((prev) => prev.map((li) => li.product.id === productId ? { ...li, qty: q } : li))
  }, [])

  const removeItem = useCallback((productId) => {
    setLineItems((prev) => prev.filter((li) => li.product.id !== productId))
  }, [])

  const handleCreateCustomer = useCallback(async () => {
    if (!newCustomerForm.full_name.trim()) { setCustomerError('Full name is required'); return }
    if (!newCustomerForm.email.trim()) { setCustomerError('Email is required'); return }
    if (!newCustomerForm.phone.trim()) { setCustomerError('Phone is required'); return }
    setCreatingCustomer(true)
    setCustomerError(null)
    try {
      const c = await customersApi.createCustomer(newCustomerForm)
      setSelectedCustomer(c)
      setShowNewCustomer(false)
      setCustomerQuery('')
    } catch (err) {
      setCustomerError(err.response?.data?.detail ?? 'Failed to create customer')
    } finally {
      setCreatingCustomer(false)
    }
  }, [newCustomerForm])

  const handleSubmit = useCallback(async () => {
    if (!selectedCustomer || lineItems.length === 0) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const order = await ordersApi.createOrder({
        customer_id: selectedCustomer.id,
        items: lineItems.map((li) => ({ product_id: li.product.id, quantity: li.qty })),
      })
      setCreatedOrder(order)
      setStep(3)
      onOrderCreated?.()
      showToast(`Order #${order.id} created successfully`, 'success')
    } catch (err) {
      setSubmitError(err.response?.data?.detail ?? 'Failed to create order')
    } finally {
      setSubmitting(false)
    }
  }, [selectedCustomer, lineItems, onOrderCreated, showToast])

  if (!mounted) return null

  return createPortal(
    <div
      className="wizard-overlay"
      onClick={onClose}
      style={{ opacity: animate ? 1 : 0, transition: 'opacity 180ms ease' }}
    >
      <div className="wizard-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        {step < 3 && (
          <div className="wizard-header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="wizard-title">New Order</div>
                <div className="wizard-subtitle">
                  {step === 0 && 'Who is this order for?'}
                  {step === 1 && 'What are they ordering?'}
                  {step === 2 && 'Review and confirm the order'}
                </div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close wizard">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="16" height="16">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Progress */}
            <div className="wizard-progress" style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 0 }}>
              {STEPS.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <div className={`wizard-step-dot ${i < step ? 'done' : i === step ? 'active' : 'upcoming'}`}>
                      {i < step ? (
                        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="10" height="10">
                          <polyline points="1.5 6 4.5 9 10.5 3" />
                        </svg>
                      ) : i + 1}
                    </div>
                    <span className={`wizard-step-label ${i < step ? 'done' : i === step ? 'active' : 'upcoming'}`}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`wizard-step-connector ${i < step ? 'done' : ''}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="wizard-body" key={step}>
          {/* -------- STEP 0: Customer -------- */}
          {step === 0 && (
            <div>
              {selectedCustomer ? (
                <>
                  <div className="wizard-selection-card">
                    <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13 }}>
                      {selectedCustomer.full_name[0].toUpperCase()}
                    </div>
                    <div className="wizard-selection-info">
                      <div className="wizard-selection-name">{selectedCustomer.full_name}</div>
                      <div className="wizard-selection-meta">{selectedCustomer.email} · {selectedCustomer.phone}</div>
                    </div>
                    <button className="wizard-selection-clear btn btn-ghost btn-icon btn-sm" onClick={() => setSelectedCustomer(null)} aria-label="Clear selection">
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="12" height="12">
                        <path d="M3 3l10 10M13 3L3 13" />
                      </svg>
                    </button>
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
                    Customer selected. Click Continue to add products.
                  </p>
                </>
              ) : (
                <>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Search customer</label>
                    <div className="search-wrap" style={{ maxWidth: '100%', marginTop: 'var(--space-1)' }}>
                      <svg className="search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
                        <circle cx="6.5" cy="6.5" r="4.5" />
                        <path d="M11 11l3 3" strokeLinecap="round" />
                      </svg>
                      <input
                        ref={customerInputRef}
                        type="text"
                        className="search-input"
                        placeholder="Name, email, or phone…"
                        value={customerQuery}
                        onChange={(e) => setCustomerQuery(e.target.value)}
                        autoComplete="off"
                      />
                    </div>
                  </div>

                  {customerResults.length > 0 && (
                    <div className="wizard-search-results" style={{ marginTop: 'var(--space-3)' }}>
                      {customerResults.map((c) => (
                        <div key={c.id} className="wizard-result-item" onClick={() => { setSelectedCustomer(c); setCustomerQuery('') }}>
                          <div>
                            <div className="wizard-result-name">{c.full_name}</div>
                            <div className="wizard-result-meta">{c.email} · {c.phone}</div>
                          </div>
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14" style={{ color: 'var(--color-text-tertiary)' }}>
                            <polyline points="6 3 11 8 6 13" />
                          </svg>
                        </div>
                      ))}
                    </div>
                  )}

                  {customerQuery.length > 1 && customerResults.length === 0 && (
                    <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                      No customers found for "{customerQuery}".
                    </div>
                  )}

                  {/* Create new customer toggle */}
                  <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-4)' }}>
                    <button
                      className="add-item-btn"
                      onClick={() => setShowNewCustomer(!showNewCustomer)}
                    >
                      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="12" height="12">
                        <path d="M6 1v10M1 6h10" />
                      </svg>
                      {showNewCustomer ? 'Cancel new customer' : 'Create new customer'}
                    </button>

                    {showNewCustomer && (
                      <div className="slideover-edit-form" style={{ marginTop: 'var(--space-3)' }}>
                        {customerError && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{customerError}</div>}
                        <div className="grid-2col">
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label form-label-required">Full Name</label>
                            <input className="form-control" value={newCustomerForm.full_name} onChange={(e) => setNewCustomerForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="Jane Smith" />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label form-label-required">Email</label>
                            <input className="form-control" type="email" value={newCustomerForm.email} onChange={(e) => setNewCustomerForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
                          </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0, marginTop: 'var(--space-3)' }}>
                          <label className="form-label form-label-required">Phone</label>
                          <input className="form-control" type="tel" value={newCustomerForm.phone} onChange={(e) => setNewCustomerForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+1 555 000 0000" />
                        </div>
                        <div style={{ marginTop: 'var(--space-3)', display: 'flex', justifyContent: 'flex-end' }}>
                          <button className="btn btn-primary btn-sm" onClick={handleCreateCustomer} disabled={creatingCustomer}>
                            {creatingCustomer ? 'Creating…' : 'Create & Select'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* -------- STEP 1: Products -------- */}
          {step === 1 && (
            <div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Add products</label>
                <div className="search-wrap" style={{ maxWidth: '100%', marginTop: 'var(--space-1)' }}>
                  <svg className="search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <circle cx="6.5" cy="6.5" r="4.5" />
                    <path d="M11 11l3 3" strokeLinecap="round" />
                  </svg>
                  <input
                    ref={productInputRef}
                    type="text"
                    className="search-input"
                    placeholder="Product name or SKU…"
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    autoComplete="off"
                  />
                  {productSearchLoading && <span style={{ position: 'absolute', right: 10, fontSize: 11, color: 'var(--color-text-tertiary)' }}>…</span>}
                </div>
              </div>

              {productResults.length > 0 && (
                <div className="wizard-search-results" style={{ marginTop: 'var(--space-2)' }}>
                  {productResults.map((p) => {
                    const alreadyAdded = lineItems.some((li) => li.product.id === p.id)
                    return (
                      <div
                        key={p.id}
                        className={`wizard-result-item ${alreadyAdded ? 'selected' : ''}`}
                        onClick={() => !alreadyAdded && addProduct(p)}
                        style={{ cursor: alreadyAdded ? 'default' : 'pointer' }}
                      >
                        <div style={{ flex: 1 }}>
                          <div className="wizard-result-name">{p.name}</div>
                          <div className="wizard-result-meta" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{p.sku}</span>
                            <StockSignal qty={p.stock_quantity} />
                          </div>
                        </div>
                        <div className="wizard-result-right">
                          <div className="wizard-result-price">{formatPrice(p.price)}</div>
                          {alreadyAdded && <div style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 500 }}>Added</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Line Items */}
              {lineItems.length > 0 && (
                <div style={{ marginTop: 'var(--space-5)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Line Items ({lineItems.length})</span>
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', textTransform: 'none', letterSpacing: 0 }}>{formatPrice(totalAmount)}</span>
                  </div>
                  {lineItems.map((li) => {
                    const subtotal = li.product.price * li.qty
                    const insufficient = li.qty > li.product.stock_quantity
                    return (
                      <div key={li.product.id} className="wizard-line-item">
                        <div>
                          <div className="wizard-line-item-name">{li.product.name}</div>
                          <div className="wizard-line-item-meta">
                            <span className="td-mono" style={{ fontSize: 11 }}>{li.product.sku}</span>
                            {insufficient && <span className="stock-signal stock-critical">Exceeds stock ({li.product.stock_quantity} available)</span>}
                          </div>
                        </div>
                        <div>
                          <div className="qty-stepper">
                            <button
                              className="qty-stepper-btn"
                              onClick={() => updateQty(li.product.id, li.qty - 1)}
                              disabled={li.qty <= 1}
                            >−</button>
                            <input
                              type="number"
                              className="qty-stepper-input"
                              value={li.qty}
                              min={1}
                              onChange={(e) => updateQty(li.product.id, e.target.value)}
                            />
                            <button
                              className="qty-stepper-btn"
                              onClick={() => updateQty(li.product.id, li.qty + 1)}
                            >+</button>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'right', marginTop: 2 }}>{formatPrice(subtotal)}</div>
                        </div>
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => removeItem(li.product.id)}
                          style={{ color: 'var(--color-danger)' }}
                          aria-label="Remove item"
                        >
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="12" height="12">
                            <path d="M3 8h10" />
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {lineItems.length === 0 && !productQuery && (
                <div style={{ marginTop: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                  Search for products above to add them to this order
                </div>
              )}
            </div>
          )}

          {/* -------- STEP 2: Review -------- */}
          {step === 2 && (
            <div>
              {submitError && <div className="alert alert-danger" style={{ marginBottom: 'var(--space-4)' }}>{submitError}</div>}

              {/* Customer */}
              <div className="wizard-review-section">
                <div className="wizard-review-title">Customer</div>
                <div className="wizard-selection-card" style={{ marginTop: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13 }}>
                    {selectedCustomer?.full_name[0]?.toUpperCase()}
                  </div>
                  <div className="wizard-selection-info">
                    <div className="wizard-selection-name">{selectedCustomer?.full_name}</div>
                    <div className="wizard-selection-meta">{selectedCustomer?.email} · {selectedCustomer?.phone}</div>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="wizard-review-section">
                <div className="wizard-review-title">Order Items</div>
                <table className="items-table" style={{ marginTop: 0 }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th style={{ textAlign: 'center', width: 60 }}>Qty</th>
                      <th style={{ textAlign: 'right', width: 80 }}>Unit Price</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((li) => (
                      <tr key={li.product.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>{li.product.name}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-secondary)' }}>{li.product.sku}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>{li.qty}</td>
                        <td style={{ textAlign: 'right' }}>{formatPrice(li.product.price)}</td>
                        <td>{formatPrice(li.product.price * li.qty)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="wizard-total-row">
                  <span className="wizard-total-label">Order Total</span>
                  <span className="wizard-total-value">{formatPrice(totalAmount)}</span>
                </div>
              </div>

              {/* Inventory impact */}
              <div className="wizard-review-section">
                <div className="wizard-review-title">Inventory Impact</div>
                <div className="inventory-impact">
                  {lineItems.map((li) => {
                    const after = li.product.stock_quantity - li.qty
                    const cls = after <= 0 ? 'stock-critical' : after <= 5 ? 'stock-warning' : ''
                    return (
                      <div key={li.product.id} className={`inventory-impact-item ${cls}`}>
                        <span className="inventory-impact-name">{li.product.name}</span>
                        <span className="inventory-impact-change">
                          {li.product.stock_quantity} → {after} units
                          {after < 0 && ' ⚠ Insufficient stock'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* -------- STEP 3: Success -------- */}
          {step === 3 && createdOrder && (
            <div className="wizard-success">
              <div className="wizard-success-icon">
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="56" height="56">
                  <circle cx="24" cy="24" r="22" stroke="var(--color-success)" strokeWidth="2" />
                  <polyline points="14 24 21 31 34 18" stroke="var(--color-success)" />
                </svg>
              </div>
              <div>
                <div className="wizard-success-title">Order Created</div>
                <div className="wizard-success-subtitle">Order #{createdOrder.id} has been placed successfully</div>
              </div>
              <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', minWidth: 240, textAlign: 'left' }}>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>Customer</div>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>{selectedCustomer?.full_name}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>Total</div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-accent)' }}>{formatPrice(createdOrder.total_amount)}</div>
              </div>
              <div className="wizard-success-actions">
                <button className="btn btn-secondary" onClick={() => { onClose(); onOrderCreated?.(createdOrder.id) }}>
                  View Order
                </button>
                <button className="btn btn-primary" onClick={() => {
                  setStep(0)
                  setSelectedCustomer(null)
                  setLineItems([])
                  setCreatedOrder(null)
                  setSubmitError(null)
                  setCustomerQuery('')
                  setProductQuery('')
                }}>
                  Create Another
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step < 3 && (
          <div className="wizard-footer">
            <div>
              {step > 0 && (
                <button className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>
                  ← Back
                </button>
              )}
              {step === 0 && (
                <button className="btn btn-ghost" onClick={onClose}>
                  Cancel
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {step === 1 && lineItems.length > 0 && (
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {formatPrice(totalAmount)}
                </span>
              )}

              {step === 0 && (
                <button
                  className="btn btn-primary"
                  disabled={!selectedCustomer}
                  onClick={() => setStep(1)}
                >
                  Continue →
                </button>
              )}
              {step === 1 && (
                <button
                  className="btn btn-primary"
                  disabled={lineItems.length === 0 || lineItems.some((li) => li.qty > li.product.stock_quantity)}
                  onClick={() => setStep(2)}
                >
                  Review Order →
                </button>
              )}
              {step === 2 && (
                <button
                  className="btn btn-primary"
                  disabled={submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Creating Order…' : 'Confirm & Create Order'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
