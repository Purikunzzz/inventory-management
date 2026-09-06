import apiClient from '../lib/apiClient'

export const itemService = {
  listItems(params = {}) {
    const query = new URLSearchParams()
    if (params.skip !== undefined) query.set('skip', params.skip)
    if (params.limit !== undefined) query.set('limit', params.limit)
    if (params.category) query.set('category', params.category)
    if (params.location_id) query.set('location_id', params.location_id)
    if (params.q) query.set('q', params.q)
    const qs = query.toString()
    return apiClient.get(`/items${qs ? `?${qs}` : ''}`)
  },

  getItem(id) {
    return apiClient.get(`/items/${id}`)
  },

  createItem(data) {
    return apiClient.post('/items', data)
  },

  updateItem(id, data) {
    return apiClient.patch(`/items/${id}`, data)
  },

  deleteItem(id) {
    return apiClient.delete(`/items/${id}`)
  },
}
