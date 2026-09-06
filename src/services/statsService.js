import apiClient from '../lib/apiClient'

export const statsService = {
  getSummary() {
    return apiClient.get('/stats/summary')
  },

  getItemUsage(limit = 10) {
    return apiClient.get(`/stats/item-usage?limit=${limit}`)
  },

  getStockMovement(days = 30) {
    return apiClient.get(`/stats/stock-movement?days=${days}`)
  },

  getLowStock() {
    return apiClient.get('/stats/low-stock')
  },

  getLeaderboard(limit = 10) {
    return apiClient.get(`/stats/leaderboard?limit=${limit}`)
  },

  getRecommendations(limit = 12) {
    return apiClient.get(`/stats/recommendations?limit=${limit}`)
  },
}
