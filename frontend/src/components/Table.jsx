import { useEffect, useState, useRef } from 'react'

// Reusable data table component with selection, sorting, and hover feedback.
// columns: [{ key, label, render?, align?, width?, sortable? }]
// rows: array of data objects (must have unique `id`)
// loading: shows skeleton rows
// emptyState: ReactNode shown when rows is empty and not loading
// selectedIds: list of currently selected row IDs (for bulk selection)
// onSelectionChange: callback when selectedIds changes
// onRowClick: callback when a row is clicked
// activeRowId: ID of the row that should be styled as active/selected
// sortKey: key of the column currently sorted
// sortDirection: 'asc' | 'desc'
// onSort: callback when a sortable column header is clicked (key)

const SKELETON_ROWS = 8

export default function DataTable({
  columns,
  rows = [],
  loading,
  emptyState,
  footer,
  selectedIds = [],
  onSelectionChange,
  onRowClick,
  activeRowId,
  sortKey,
  sortDirection,
  onSort,
}) {
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const containerRef = useRef(null)

  const allSelected = rows.length > 0 && selectedIds.length === rows.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < rows.length

  // Sync focusedIndex when activeRowId changes
  useEffect(() => {
    if (activeRowId !== undefined && activeRowId !== null && rows.length > 0) {
      const idx = rows.findIndex((r) => r.id === activeRowId)
      if (idx !== -1) {
        setFocusedIndex(idx)
      }
    } else {
      setFocusedIndex(-1)
    }
  }, [activeRowId, rows])

  const handleSelectAll = (e) => {
    if (!onSelectionChange) return
    if (e.target.checked) {
      onSelectionChange(rows.map((r) => r.id))
    } else {
      onSelectionChange([])
    }
  }

  const handleSelectRow = (e, id) => {
    e.stopPropagation() // Prevent triggering onRowClick
    if (!onSelectionChange) return
    if (e.target.checked) {
      onSelectionChange([...selectedIds, id])
    } else {
      onSelectionChange(selectedIds.filter((x) => x !== id))
    }
  }

  const handleKeyDown = (e) => {
    if (loading || rows.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((prev) => {
        const next = prev < rows.length - 1 ? prev + 1 : 0
        // Scroll row into view if needed
        const rowEl = containerRef.current?.querySelector(`tbody tr:nth-child(${next + 1})`)
        rowEl?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : rows.length - 1
        const rowEl = containerRef.current?.querySelector(`tbody tr:nth-child(${next + 1})`)
        rowEl?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (e.key === 'Enter') {
      if (focusedIndex >= 0 && focusedIndex < rows.length) {
        e.preventDefault()
        onRowClick?.(rows[focusedIndex])
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className="table-container"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ outline: 'none' }}
    >
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {onSelectionChange && (
                <th style={{ width: 40, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected
                    }}
                    onChange={handleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
              )}
              {columns.map((col) => {
                const isSorted = sortKey === col.key
                return (
                  <th
                     key={col.key}
                     style={{ width: col.width }}
                     className={`${col.align === 'right' ? 'th-right' : col.align === 'center' ? 'th-center' : ''} ${
                       col.sortable ? 'sortable' : ''
                     }`}
                     onClick={() => col.sortable && onSort && onSort(col.key)}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start',
                        width: '100%',
                      }}
                    >
                      {col.label}
                      {col.sortable && isSorted && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <tr key={i} className="skeleton-row">
                  {onSelectionChange && <td style={{ textAlign: 'center' }}><div className="skeleton-cell" style={{ width: '16px', margin: 'auto' }} /></td>}
                  {columns.map((col) => (
                    <td key={col.key}>
                      <div
                        className="skeleton-cell"
                        style={{ width: col.skeletonWidth ?? '60%' }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onSelectionChange ? 1 : 0)} style={{ padding: 0 }}>
                  {emptyState}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const isSelected = selectedIds.includes(row.id)
                const isActive = activeRowId === row.id
                const isFocused = focusedIndex === index
                return (
                  <tr
                    key={row.id}
                    className={`${isSelected ? 'selected' : ''} ${isActive ? 'selected' : ''} ${isFocused ? 'keyboard-focused' : ''}`}
                    onClick={() => {
                      setFocusedIndex(index)
                      onRowClick && onRowClick(row)
                    }}
                  >
                    {onSelectionChange && (
                      <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectRow(e, row.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={col.align === 'right' ? 'td-right' : col.align === 'center' ? 'td-center' : ''}
                      >
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {footer && <div className="table-footer">{footer}</div>}
    </div>
  )
}

