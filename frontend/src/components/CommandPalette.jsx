import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { searchCustomers } from '../api/customers'
import { searchOrders } from '../api/orders'
import { searchProducts } from '../api/products'
import { useApp } from '../context/AppContext'

// Debounce helper
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

export default function CommandPalette({ isOpen, onClose, onNavigate }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ orders: [], products: [], customers: [] })
  const [loading, setLoading] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { formatPrice } = useApp()

  const debouncedQuery = useDebounce(query, 220)

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults({ orders: [], products: [], customers: [] })
      setFocusedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [isOpen])

  // Search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim() || debouncedQuery.length < 1) {
      setResults({ orders: [], products: [], customers: [] })
      setLoading(false)
      return
    }

    setLoading(true)
    Promise.all([
      searchOrders(debouncedQuery, 5).catch(() => []),
      searchProducts(debouncedQuery, 5).catch(() => []),
      searchCustomers(debouncedQuery, 5).catch(() => []),
    ]).then(([orders, products, customers]) => {
      setResults({ orders, products, customers })
      setFocusedIndex(0)
      setLoading(false)
    })
  }, [debouncedQuery])

  // Flatten results for keyboard navigation
  const flatResults = [
    ...results.orders.map((r) => ({ type: 'order', data: r })),
    ...results.products.map((r) => ({ type: 'product', data: r })),
    ...results.customers.map((r) => ({ type: 'customer', data: r })),
  ]

  const handleSelect = useCallback(
    (item) => {
      onClose()
      if (item.type === 'order') {
        onNavigate?.('/orders', item.data.id, 'order')
        navigate('/orders')
      } else if (item.type === 'product') {
        onNavigate?.('/products', item.data.id, 'product')
        navigate('/products')
      } else if (item.type === 'customer') {
        onNavigate?.('/customers', item.data.id, 'customer')
        navigate('/customers')
      }
    },
    [onClose, onNavigate, navigate]
  )

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIndex((i) => Math.min(i + 1, flatResults.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && flatResults[focusedIndex]) {
        e.preventDefault()
        handleSelect(flatResults[focusedIndex])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose, flatResults, focusedIndex, handleSelect])

  if (!isOpen) return null

  const hasResults = flatResults.length > 0
  const showEmpty = !loading && debouncedQuery.length > 0 && !hasResults

  return createPortal(
    <div className="cmd-palette-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
        {/* Input */}
        <div className="cmd-palette-input-wrap">
          <svg className="cmd-palette-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" width="16" height="16">
            <circle cx="6.5" cy="6.5" r="4.5" />
            <path d="M11 11l3 3" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            className="cmd-palette-input"
            placeholder="Search orders, products, customers…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setFocusedIndex(0) }}
            autoComplete="off"
            spellCheck={false}
          />
          {loading && (
            <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>Searching…</span>
          )}
          <span className="cmd-palette-clear">Esc</span>
        </div>

        {/* Results */}
        <div className="cmd-palette-results">
          {showEmpty && (
            <div className="cmd-palette-empty">No results for "{debouncedQuery}"</div>
          )}

          {!debouncedQuery && (
            <div className="cmd-palette-empty" style={{ fontSize: 12 }}>
              Type to search across all orders, products, and customers
            </div>
          )}

          {results.orders.length > 0 && (
            <>
              <div className="cmd-palette-section">
                <span className="cmd-palette-section-label">Orders</span>
              </div>
              {results.orders.map((order, i) => {
                const idx = i
                return (
                  <div
                    key={`order-${order.id}`}
                    className={`cmd-palette-item ${focusedIndex === idx ? 'focused' : ''}`}
                    onClick={() => handleSelect({ type: 'order', data: order })}
                    onMouseEnter={() => setFocusedIndex(idx)}
                  >
                    <div className="cmd-palette-item-icon order-icon">
                      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" width="12" height="12">
                        <rect x="1" y="1" width="10" height="10" rx="1" />
                        <path d="M3 4h6M3 7h4" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="cmd-palette-item-info">
                      <div className="cmd-palette-item-title">Order #{order.id} — {order.customer_name}</div>
                      <div className="cmd-palette-item-meta">{order.status} · {new Date(order.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className="cmd-palette-item-right">{formatPrice(order.total_amount)}</div>
                  </div>
                )
              })}
            </>
          )}

          {results.products.length > 0 && (
            <>
              <div className="cmd-palette-section">
                <span className="cmd-palette-section-label">Products</span>
              </div>
              {results.products.map((product, i) => {
                const idx = results.orders.length + i
                return (
                  <div
                    key={`product-${product.id}`}
                    className={`cmd-palette-item ${focusedIndex === idx ? 'focused' : ''}`}
                    onClick={() => handleSelect({ type: 'product', data: product })}
                    onMouseEnter={() => setFocusedIndex(idx)}
                  >
                    <div className="cmd-palette-item-icon product-icon">
                      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" width="12" height="12">
                        <path d="M6 1L1 4v4l5 3 5-3V4L6 1z" />
                      </svg>
                    </div>
                    <div className="cmd-palette-item-info">
                      <div className="cmd-palette-item-title">{product.name}</div>
                      <div className="cmd-palette-item-meta">SKU: {product.sku} · Stock: {product.stock_quantity}</div>
                    </div>
                    <div className="cmd-palette-item-right">{formatPrice(product.price)}</div>
                  </div>
                )
              })}
            </>
          )}

          {results.customers.length > 0 && (
            <>
              <div className="cmd-palette-section">
                <span className="cmd-palette-section-label">Customers</span>
              </div>
              {results.customers.map((customer, i) => {
                const idx = results.orders.length + results.products.length + i
                return (
                  <div
                    key={`customer-${customer.id}`}
                    className={`cmd-palette-item ${focusedIndex === idx ? 'focused' : ''}`}
                    onClick={() => handleSelect({ type: 'customer', data: customer })}
                    onMouseEnter={() => setFocusedIndex(idx)}
                  >
                    <div className="cmd-palette-item-icon customer-icon">
                      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" width="12" height="12">
                        <circle cx="6" cy="4" r="2" />
                        <path d="M2 10c0-2.2 1.8-4 4-4s4 1.8 4 4" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="cmd-palette-item-info">
                      <div className="cmd-palette-item-title">{customer.full_name}</div>
                      <div className="cmd-palette-item-meta">{customer.email}</div>
                    </div>
                    <div className="cmd-palette-item-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{customer.phone}</div>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Footer hints */}
        <div className="cmd-palette-footer">
          <div className="cmd-palette-hint">
            <span className="kbd">↑↓</span>
            <span>navigate</span>
          </div>
          <div className="cmd-palette-hint">
            <span className="kbd">↵</span>
            <span>open</span>
          </div>
          <div className="cmd-palette-hint">
            <span className="kbd">Esc</span>
            <span>close</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
