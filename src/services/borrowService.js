import apiClient from '../lib/apiClient'

export const borrowService = {
  borrow(data) {
    return apiClient.post('/borrow', data)
  },

  returnItem(data) {
    return apiClient.post('/return', data)
  },

  listTransactions(params = {}) {
    const query = new URLSearchParams()
    if (params.skip !== undefined) query.set('skip', params.skip)
    if (params.limit !== undefined) query.set('limit', params.limit)
    if (params.user_id) query.set('user_id', params.user_id)
    if (params.item_id) query.set('item_id', params.item_id)
    if (params.status_filter) query.set('status_filter', params.status_filter)
    const qs = query.toString()
    return apiClient.get(`/transactions${qs ? `?${qs}` : ''}`)
  },
}
