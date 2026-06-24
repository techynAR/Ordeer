import { createContext, useContext, useState, useEffect } from 'react'
import { getDashboardStats } from '../api/dashboard'

const AppContext = createContext(null)

const CURRENCY_CONFIGS = {
  USD: { locale: 'en-US', currency: 'USD', symbol: '$' },
  INR: { locale: 'en-IN', currency: 'INR', symbol: '₹' },
  EUR: { locale: 'de-DE', currency: 'EUR', symbol: '€' },
  GBP: { locale: 'en-GB', currency: 'GBP', symbol: '£' },
  JPY: { locale: 'ja-JP', currency: 'JPY', symbol: '¥' },
}

export function AppProvider({ children }) {
  const [currency, setCurrencyState] = useState(() => {
    return localStorage.getItem('preferred_currency') || 'INR'
  })
  const [notifications, setNotifications] = useState([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)

  const setCurrency = (curr) => {
    if (CURRENCY_CONFIGS[curr]) {
      setCurrencyState(curr)
      localStorage.setItem('preferred_currency', curr)
    }
  }

  // Fetch real alerts for notifications
  const refreshNotifications = async () => {
    setLoadingNotifications(true)
    try {
      const stats = await getDashboardStats()
      const alerts = []
      
      // Low stock alerts
      if (stats.low_stock_items) {
        stats.low_stock_items.forEach(item => {
          alerts.push({
            id: `low-stock-${item.id}`,
            type: 'warning',
            title: 'Low Stock Alert',
            message: `${item.name} (${item.sku}) has only ${item.stock_quantity} left in stock.`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          })
        })
      }

      // We can also mock order alerts or fetch other details if needed, but low stock is fully real and actionable.
      setNotifications(alerts)
    } catch (e) {
      console.error("Failed to load notifications", e)
    } finally {
      setLoadingNotifications(false)
    }
  }

  useEffect(() => {
    refreshNotifications()
    // Refresh notifications every 60 seconds
    const interval = setInterval(refreshNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  const formatPrice = (amount) => {
    const config = CURRENCY_CONFIGS[currency] || CURRENCY_CONFIGS.USD
    // Exchange rates mapping relative to USD (basic hardcoded mock rates for local representation)
    const rates = {
      USD: 1.0,
      INR: 83.50,
      EUR: 0.92,
      GBP: 0.79,
      JPY: 158.0,
    }
    const converted = Number(amount) * (rates[currency] || 1.0)

    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.currency,
    }).format(converted)
  }

  return (
    <AppContext.Provider value={{
      currency,
      setCurrency,
      formatPrice,
      notifications,
      refreshNotifications,
      loadingNotifications,
      availableCurrencies: Object.keys(CURRENCY_CONFIGS),
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
