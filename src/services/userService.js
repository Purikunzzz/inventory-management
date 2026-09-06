import apiClient from '../lib/apiClient'

export const userService = {
  listUsers(params = {}) {
    const query = new URLSearchParams()
    if (params.skip !== undefined) query.set('skip', params.skip)
    if (params.limit !== undefined) query.set('limit', params.limit)
    const qs = query.toString()
    return apiClient.get(`/users${qs ? `?${qs}` : ''}`)
  },

  getUser(id) {
    return apiClient.get(`/users/${id}`)
  },

  /** Update own profile (full_name only — no admin required). */
  updateMe(data) {
    return apiClient.patch('/users/me', data)
  },

  createUser(data) {
    return apiClient.post('/users', data)
  },

  updateUser(id, data) {
    return apiClient.patch(`/users/${id}`, data)
  },

  deleteUser(id) {
    return apiClient.delete(`/users/${id}`)
  },
}