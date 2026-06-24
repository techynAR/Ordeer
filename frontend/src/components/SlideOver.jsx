import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function SlideOver({ isOpen, onClose, title, children, footer }) {
  const [mounted, setMounted] = useState(false)
  const [animate, setAnimate] = useState(false)

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!mounted) return null

  return createPortal(
    <>
      <div 
        className="slideover-backdrop" 
        onClick={onClose} 
        style={{ 
          opacity: animate ? 1 : 0,
          transition: 'opacity 180ms ease'
        }} 
      />
      <div className={`slideover ${animate ? 'open' : ''}`}>
        <div className="slideover-header">
          <h3 className="slideover-title">{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close panel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="slideover-body">
          {children}
        </div>
        {footer && (
          <div className="slideover-footer">
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body
  )
}
