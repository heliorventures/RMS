window.RMS.api = {
  baseUrl: '',

  async _fetch(endpoint, options = {}) {
    const isAuthRoute = endpoint.startsWith('/auth/login');

    try {
      const res = await fetch(`${this.baseUrl}/api${endpoint}`, {
        ...options,
        headers: {
          ...window.RMS.auth.headers(),
          ...(options.headers || {})
        }
      });

      let data;
      try {
        data = await res.json();
      } catch {
        return { success: false, message: 'Server returned an invalid response.' };
      }

      if (res.status === 401 && !isAuthRoute) {
        window.RMS.auth.logout();
        return null;
      }

      if (!res.ok) {
        return { success: false, message: data.message || 'Request failed' };
      }

      return data;
    } catch (err) {
      console.warn('API request failed:', err.message);
      return { success: false, message: 'Server is unavailable. Please try again later.' };
    }
  },

  get: (ep) => window.RMS.api._fetch(ep),
  post: (ep, body) => window.RMS.api._fetch(ep, { method: 'POST', body: JSON.stringify(body) }),
  put: (ep, body) => window.RMS.api._fetch(ep, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (ep) => window.RMS.api._fetch(ep, { method: 'DELETE' })
};
