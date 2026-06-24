import api from './axios'

export const listOrders = (skip = 0, limit = 200) =>
  api.get('/orders', { params: { skip, limit } }).then((r) => r.data)

export const createOrder = (data) =>
  api.post('/orders', data).then((r) => r.data)

export const getOrder = (id) =>
  api.get(`/orders/${id}`).then((r) => r.data)

export const deleteOrder = (id) => api.delete(`/orders/${id}`)

export const updateOrderStatus = (id, status) =>
  api.patch(`/orders/${id}/status`, { status }).then((r) => r.data)

export const searchOrders = (q, limit = 20) =>
  api.get('/orders/search', { params: { q, limit } }).then((r) => r.data)
