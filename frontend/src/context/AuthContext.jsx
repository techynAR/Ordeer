import { createContext, useCallback, useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const AuthContext = createContext(null)

const DEMO_USER = {
  username: 'admin',
  role: 'Administrator',
  demo: true,
}

function readAuth() {
  try {
    const flag = localStorage.getItem('ordeer-auth')
    const user = JSON.parse(localStorage.getItem('ordeer-user') || 'null')
    return flag === 'authenticated' && user ? { isAuthenticated: true, user } : { isAuthenticated: false, user: null }
  } catch {
    return { isAuthenticated: false, user: null }
  }
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(readAuth)

  const _persist = useCallback((user) => {
    localStorage.setItem('ordeer-auth', 'authenticated')
    localStorage.setItem('ordeer-user', JSON.stringify(user))
    setAuthState({ isAuthenticated: true, user })
  }, [])

  const login = useCallback((username, password) => {
    // Demo-only: accept admin/admin
    if (username === 'admin' && password === 'admin') {
      _persist({ username: 'admin', role: 'Administrator', demo: false })
      return { success: true }
    }
    return { success: false, error: 'Invalid credentials. Use admin / admin.' }
  }, [_persist])

  const demoLogin = useCallback(() => {
    _persist(DEMO_USER)
  }, [_persist])

  const logout = useCallback(() => {
    localStorage.removeItem('ordeer-auth')
    localStorage.removeItem('ordeer-user')
    setAuthState({ isAuthenticated: false, user: null })
  }, [])

  return (
    <AuthContext.Provider value={{ ...authState, login, demoLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
