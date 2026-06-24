import api from './axios'

export const listProducts = (skip = 0, limit = 200) =>
  api.get('/products', { params: { skip, limit } }).then((r) => r.data)

export const createProduct = (data) =>
  api.post('/products', data).then((r) => r.data)

export const getProduct = (id) =>
  api.get(`/products/${id}`).then((r) => r.data)

export const updateProduct = (id, data) =>
  api.put(`/products/${id}`, data).then((r) => r.data)

export const deleteProduct = (id) => api.delete(`/products/${id}`)

export const searchProducts = (q, limit = 20) =>
  api.get('/products/search', { params: { q, limit } }).then((r) => r.data)
