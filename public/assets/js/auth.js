window.RMS.auth = {
  IDLE_TIMEOUT_MS: 15 * 60 * 1000,
  _ACTIVITY_KEY: 'rms_last_activity',
  _LOGOUT_KEY: 'rms_idle_logout',
  _idleTimer: null,
  _onIdleActivity: null,
  _lastActivityPing: 0,
  _idleEvents: ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'],

  getToken() { return localStorage.getItem('rms_token'); },
  getUser() { try { return JSON.parse(localStorage.getItem('rms_user')); } catch { return null; } },

  setSession(token, user) {
    if (!token || token === 'undefined') return false;
    localStorage.setItem('rms_token', token);
    localStorage.setItem('rms_user', JSON.stringify(user));
    localStorage.setItem(this._ACTIVITY_KEY, String(Date.now()));
    this.startIdleWatch();
    return true;
  },

  loginUrl() {
    const path = window.location.pathname;
    if (path.includes('/pages/')) return '../index.html';
    return '/index.html';
  },

  logout() {
    this.stopIdleWatch();
    localStorage.removeItem('rms_token');
    localStorage.removeItem('rms_user');
    localStorage.removeItem(this._ACTIVITY_KEY);
    window.location.href = this.loginUrl();
  },

  isAuthenticated() {
    const token = this.getToken();
    return !!(token && token !== 'undefined');
  },

  isAdmin() {
    return this.getUser()?.role === 'admin';
  },

  requireAdmin() {
    if (!this.requireAuth()) return false;
    if (!this.isAdmin()) {
      if (window.RMS?.toast) {
        RMS.toast.show('Access denied. Administrators only.', 'error');
      }
      window.location.href = window.location.pathname.includes('/pages/')
        ? '/pages/dashboard.html'
        : 'pages/dashboard.html';
      return false;
    }
    return true;
  },

  checkIdleOnLoad() {
    if (!this.isAuthenticated()) return true;
    const last = Number(localStorage.getItem(this._ACTIVITY_KEY) || Date.now());
    if (Date.now() - last >= this.IDLE_TIMEOUT_MS) {
      this.onIdleTimeout();
      return false;
    }
    return true;
  },

  startIdleWatch() {
    this.stopIdleWatch();
    if (!this.isAuthenticated()) return;

    this._onIdleActivity = () => this.resetIdleTimer();
    this._idleEvents.forEach(evt => {
      document.addEventListener(evt, this._onIdleActivity, { passive: true });
    });
    this.resetIdleTimer();
  },

  resetIdleTimer() {
    clearTimeout(this._idleTimer);
    const now = Date.now();
    if (now - this._lastActivityPing > 1000) {
      this._lastActivityPing = now;
      localStorage.setItem(this._ACTIVITY_KEY, String(now));
    }
    const last = Number(localStorage.getItem(this._ACTIVITY_KEY) || now);
    const remaining = Math.max(0, this.IDLE_TIMEOUT_MS - (now - last));
    this._idleTimer = setTimeout(() => this.onIdleTimeout(), remaining);
  },

  onIdleTimeout() {
    if (!this.isAuthenticated()) return;

    const last = Number(localStorage.getItem(this._ACTIVITY_KEY) || 0);
    if (Date.now() - last < this.IDLE_TIMEOUT_MS) {
      this.resetIdleTimer();
      return;
    }

    this.stopIdleWatch();
    localStorage.setItem(this._LOGOUT_KEY, String(Date.now()));
    localStorage.removeItem(this._LOGOUT_KEY);
    localStorage.removeItem(this._ACTIVITY_KEY);

    const message = 'Session expired due to 15 minutes of inactivity.';
    if (window.RMS?.toast) {
      RMS.toast.show(message, 'warning');
      setTimeout(() => this.logout(), 1200);
    } else {
      this.logout();
    }
  },

  stopIdleWatch() {
    clearTimeout(this._idleTimer);
    this._idleTimer = null;
    if (this._onIdleActivity) {
      this._idleEvents.forEach(evt => {
        document.removeEventListener(evt, this._onIdleActivity);
      });
      this._onIdleActivity = null;
    }
  },

  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = this.loginUrl();
      return false;
    }
    if (!this.checkIdleOnLoad()) return false;
    if (!this._idleTimer) this.startIdleWatch();
    return true;
  },

  headers() {
    const h = { 'Content-Type': 'application/json' };
    const token = this.getToken();
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }
};

window.addEventListener('storage', (e) => {
  const auth = window.RMS?.auth;
  if (!auth?.isAuthenticated()) return;

  if (e.key === auth._ACTIVITY_KEY && e.newValue) {
    auth.resetIdleTimer();
  }
  if (e.key === auth._LOGOUT_KEY && e.newValue) {
    auth.stopIdleWatch();
    auth.logout();
  }
});

if (window.RMS.auth.isAuthenticated()) {
  if (window.RMS.auth.checkIdleOnLoad()) {
    window.RMS.auth.startIdleWatch();
  }
}
