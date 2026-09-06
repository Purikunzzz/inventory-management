import apiClient from '../lib/apiClient'

export const locationService = {
  listLocations() {
    return apiClient.get('/locations?limit=200')
  },

  getLocation(id) {
    return apiClient.get(`/locations/${id}`)
  },

  getLocationItems(id) {
    return apiClient.get(`/locations/${id}/items`)
  },

  createLocation(data) {
    return apiClient.post('/locations', data)
  },

  updateLocation(id, data) {
    return apiClient.patch(`/locations/${id}`, data)
  },

  deleteLocation(id) {
    return apiClient.delete(`/locations/${id}`)
  },
}
