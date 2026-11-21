import apiClient from '../lib/apiClient'

export const maintenanceService = {
  listRecords(params = {}) {
    const query = new URLSearchParams()
    if (params.status_filter) query.set('status_filter', params.status_filter)
    if (params.item_id) query.set('item_id', params.item_id)
    query.set('limit', params.limit ?? 500)
    return apiClient.get(`/maintenance?${query.toString()}`)
  },

  getRecord(id) {
    return apiClient.get(`/maintenance/${id}`)
  },

  /** Admin only. */
  createRecord(data) {
    return apiClient.post('/maintenance', data)
  },

  /** Admin only. Status: scheduled → in_progress → completed | cancelled (closed is final). */
  updateRecord(id, data) {
    return apiClient.patch(`/maintenance/${id}`, data)
  },

  /** Admin only. Soft delete. */
  deleteRecord(id) {
    return apiClient.delete(`/maintenance/${id}`)
  },
}
