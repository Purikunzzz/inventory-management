import apiClient from "../lib/apiClient";

export const authService = {
  googleLogin(credential) {
    return apiClient.post("/auth/google", { credential });
  },

  emailLogin(email, password) {
    return apiClient.post("/auth/login", { email, password });
  },

  // Admin two-factor sign-in. mfaToken comes from a login response with mfa_required.
  mfaSetup(mfaToken) {
    return apiClient.post("/auth/mfa/setup", { mfa_token: mfaToken });
  },

  mfaEnable(mfaToken, code) {
    return apiClient.post("/auth/mfa/enable", { mfa_token: mfaToken, code });
  },

  mfaVerify(mfaToken, code) {
    return apiClient.post("/auth/mfa/verify", { mfa_token: mfaToken, code });
  },
};
