import api from './axios'

export const listCustomers = (skip = 0, limit = 200) =>
  api.get('/customers', { params: { skip, limit } }).then((r) => r.data)

export const createCustomer = (data) =>
  api.post('/customers', data).then((r) => r.data)

export const getCustomer = (id) =>
  api.get(`/customers/${id}`).then((r) => r.data)

export const updateCustomer = (id, data) =>
  api.patch(`/customers/${id}`, data).then((r) => r.data)

export const deleteCustomer = (id) => api.delete(`/customers/${id}`)

export const searchCustomers = (q, limit = 20) =>
  api.get('/customers/search', { params: { q, limit } }).then((r) => r.data)
