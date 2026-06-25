import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function LoginPage() {
  const { login, demoLogin } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)

  const handleLogin = (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = login(username, password)
    if (result.success) {
      showToast('Logged in successfully', 'success')
      navigate('/dashboard', { replace: true })
    } else {
      setError(result.error)
      setLoading(false)
    }
  }

  const handleDemoLogin = () => {
    setDemoLoading(true)
    setError('')
    // Brief delay for visual feedback
    setTimeout(() => {
      demoLogin()
      showToast('Logged in as Demo Administrator', 'success')
      navigate('/dashboard', { replace: true })
    }, 320)
  }

  return (
    <div className="login-page">
      {/* Left panel */}
      <div className="login-left">
        <div className="login-brand">
          <img src="/ordeer-logo.png" alt="Ordeer" className="login-logo" />
          <div className="login-brand-text">
            <p className="login-brand-sub">Inventory &amp; Operations Platform</p>
          </div>
        </div>
        <p className="login-description">
          Manage products, customers, inventory, and orders from a unified operational dashboard.
        </p>
        <div className="login-features">
          <div className="login-feature">
            <span className="login-feature-dot" />
            Real-time inventory tracking
          </div>
          <div className="login-feature">
            <span className="login-feature-dot" />
            Order lifecycle management
          </div>
          <div className="login-feature">
            <span className="login-feature-dot" />
            Customer &amp; product records
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="login-right">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2 className="auth-card-title">Sign in</h2>
            <p className="auth-card-sub">Access your operations dashboard</p>
          </div>

          {/* Demo Login — primary CTA */}
          <button
            className="demo-login-btn"
            onClick={handleDemoLogin}
            disabled={demoLoading}
            id="demo-login-btn"
          >
            <div className="demo-login-btn-inner">
              {demoLoading ? (
                <span className="demo-login-spinner" />
              ) : (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" width="15" height="15">
                  <path d="M8 1v6l3 3" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="8" cy="8" r="7" />
                </svg>
              )}
              <span className="demo-login-btn-label">
                {demoLoading ? 'Authenticating…' : 'Demo Login'}
              </span>
            </div>
            <span className="demo-login-btn-sub">Instant access for reviewers</span>
          </button>

          <div className="auth-divider">
            <span>or sign in with credentials</span>
          </div>

          <form onSubmit={handleLogin} className="auth-form" noValidate>
            <div className="auth-field">
              <label className="auth-label" htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                className={`auth-input ${error ? 'auth-input-error' : ''}`}
                placeholder="Enter username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError('') }}
                autoComplete="username"
                autoFocus
              />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className={`auth-input ${error ? 'auth-input-error' : ''}`}
                placeholder="Enter password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="auth-error" role="alert">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="13" height="13">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v4M8 11v.5" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading || !username || !password}
              id="login-btn"
            >
              {loading ? 'Signing in…' : 'Login'}
            </button>
          </form>

          <div className="auth-hint">
            <span>Demo credentials: </span>
            <code>admin</code> / <code>admin</code>
          </div>

          {/* techynAR Branding */}
          <div className="login-techynar-brand">
            <a
              href="https://techynar.com"
              target="_blank"
              rel="noopener noreferrer"
              className="login-techynar-logo-link"
            >
              <img
                src="/techynAR-tools-logo.png"
                alt="techynAR"
                className="login-techynar-logo"
              />
            </a>
            <div className="login-techynar-text">
              <span>Developed by </span>
              <a
                href="https://techynar.com"
                target="_blank"
                rel="noopener noreferrer"
                className="login-techynar-link"
              >
                Aryan Sharma · techynAR
              </a>
            </div>
            <a
              href="https://tools.techynar.com"
              target="_blank"
              rel="noopener noreferrer"
              className="login-techynar-tools-link"
            >
              More techynAR tools ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
