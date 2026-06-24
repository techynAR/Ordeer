import { useEffect, useRef, useState } from 'react'

export default function Modal({ isOpen, onClose, title, children, size }) {
  const dialogRef = useRef(null)
  const [mounted, setMounted] = useState(false)
  const [animate, setAnimate] = useState(false)

  // Manage animation states
  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      const timer = setTimeout(() => setAnimate(true), 10)
      return () => clearTimeout(timer)
    } else {
      setAnimate(false)
      const timer = setTimeout(() => setMounted(false), 180)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Trap focus and listen for Escape
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!mounted) return null

  return (
    <div
      className="modal-backdrop"
      style={{
        opacity: animate ? 1 : 0,
        transition: 'opacity 180ms ease',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`modal${size === 'lg' ? ' modal-lg' : ''}`}
        style={{
          transform: animate ? 'translateY(0)' : 'translateY(8px)',
          opacity: animate ? 1 : 0,
          transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease',
        }}
        ref={dialogRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

Modal.Body = function ModalBody({ children }) {
  return <div className="modal-body">{children}</div>
}

Modal.Footer = function ModalFooter({ children }) {
  return <div className="modal-footer">{children}</div>
}
