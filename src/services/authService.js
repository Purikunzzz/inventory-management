import apiClient from "../lib/apiClient";

export const authService = {
  googleLogin(credential) {
    return apiClient.post("/auth/google", { credential });
  },

  emailLogin(email, password) {
    return apiClient.post("/auth/login", { email, password });
  },
};
