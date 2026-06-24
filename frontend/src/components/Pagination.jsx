export default function Pagination({ currentPage, totalPages, onChange }) {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)

  // Show at most 7 page numbers; collapse with ellipsis otherwise
  const getVisiblePages = () => {
    if (totalPages <= 7) return pages
    if (currentPage <= 4) return [...pages.slice(0, 5), '…', totalPages]
    if (currentPage >= totalPages - 3)
      return [1, '…', ...pages.slice(totalPages - 5)]
    return [1, '…', currentPage - 1, currentPage, currentPage + 1, '…', totalPages]
  }

  return (
    <div className="pagination">
      <button
        className="pagination-btn"
        onClick={() => onChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <path d="M7.5 2L4 6l3.5 4" />
        </svg>
      </button>

      {getVisiblePages().map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} style={{ padding: '0 4px', color: 'var(--color-text-tertiary)', fontSize: '11px' }}>
            …
          </span>
        ) : (
          <button
            key={p}
            className={`pagination-btn${p === currentPage ? ' active' : ''}`}
            onClick={() => onChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === currentPage ? 'page' : undefined}
          >
            {p}
          </button>
        )
      )}

      <button
        className="pagination-btn"
        onClick={() => onChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
          <path d="M4.5 2L8 6l-3.5 4" />
        </svg>
      </button>
    </div>
  )
}
