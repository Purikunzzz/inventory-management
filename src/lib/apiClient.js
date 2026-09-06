const API_BASE = import.meta.env.VITE_API_URL || "/api";

function getToken() {
  try {
    return localStorage.getItem("lab_token");
  } catch {
    return null;
  }
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 204) {
    return null;
  }

  const data = await res.json();

  if (!res.ok) {
    // Auto-logout on 401 — token expired or invalid.
    if (res.status === 401) {
      try {
        localStorage.removeItem("lab_token");
        localStorage.removeItem("lab_currentUser");
      } catch {
        // localStorage may be unavailable.
      }
      // Redirect to login unless already there.
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    const message = data?.detail || `Request failed with status ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    throw error;
  }

  return data;
}

export const apiClient = {
  get(endpoint) {
    return request(endpoint, { method: "GET" });
  },
  post(endpoint, body) {
    return request(endpoint, { method: "POST", body: JSON.stringify(body) });
  },
  put(endpoint, body) {
    return request(endpoint, { method: "PUT", body: JSON.stringify(body) });
  },
  patch(endpoint, body) {
    return request(endpoint, { method: "PATCH", body: JSON.stringify(body) });
  },
  delete(endpoint) {
    return request(endpoint, { method: "DELETE" });
  },
};

export default apiClient;
