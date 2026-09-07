const API_BASE = import.meta.env.VITE_API_URL || "/api";

function getToken() {
  try {
    return localStorage.getItem("lab_token");
  } catch {
    return null;
  }
}

/**
 * Fetch a generated report file from the backend and trigger a browser
 * download. Returns { filename, size } so callers can log it in history.
 */
export const reportService = {
  async download(reportType, format, { startDate, endDate } = {}) {
    const params = new URLSearchParams({ format });
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);

    const token = getToken();
    const res = await fetch(`${API_BASE}/reports/${reportType}?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      if (res.status === 401) {
        try {
          localStorage.removeItem("lab_token");
          localStorage.removeItem("lab_currentUser");
        } catch {
          // localStorage may be unavailable.
        }
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
      let message = `Request failed with status ${res.status}`;
      try {
        const data = await res.json();
        message = data?.detail || message;
      } catch {
        // Non-JSON error body — keep the fallback message.
      }
      const error = new Error(message);
      error.status = res.status;
      throw error;
    }

    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^";]+)"?/);
    const filename = match?.[1] || `${reportType}-report.${format}`;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    return { filename, size: blob.size };
  },
};

export default reportService;
