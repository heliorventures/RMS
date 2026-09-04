window.RMS.components = {
  navItems: [
    { section: 'Main', items: [
      { href: '/pages/dashboard.html', icon: 'bi-speedometer2', label: 'Dashboard' },
      { href: '/pages/contacts.html', icon: 'bi-people', label: 'Contacts' },
      { href: '/pages/groups.html', icon: 'bi-collection', label: 'Groups' }
    ]},
    { section: 'Celebrations', items: [
      { href: '/pages/birthdays.html', icon: 'bi-cake2', label: 'Birthdays' },
      { href: '/pages/anniversaries.html', icon: 'bi-heart', label: 'Anniversaries' },
      { href: '/pages/festivals.html', icon: 'bi-stars', label: 'Festivals' }
    ]},
    { section: 'Outreach', items: [
      { href: '/pages/invitations.html', icon: 'bi-envelope-paper', label: 'Invitations' },
      { href: '/pages/labels.html', icon: 'bi-tag', label: 'Labels' },
      { href: '/pages/campaigns.html', icon: 'bi-megaphone', label: 'Campaigns' },
      { href: '/pages/delivery.html', icon: 'bi-envelope-check', label: 'Delivery' },
      { href: '/pages/templates.html', icon: 'bi-file-earmark-text', label: 'Templates' }
    ]},
    { section: 'Analytics', items: [
      { href: '/pages/reports.html', icon: 'bi-bar-chart-line', label: 'Reports' },
      { href: '/pages/settings.html', icon: 'bi-gear', label: 'Settings' }
    ]}
  ],

  getNavItems() {
    const isAdmin = RMS.auth.isAdmin();
    return this.navItems
      .map(section => ({
        ...section,
        items: section.items.filter(item => item.href !== '/pages/settings.html' || isAdmin)
      }))
      .filter(section => section.items.length > 0);
  },

  renderSidebar(activePage) {
    const nav = this.getNavItems().map(section => `
      <div class="nav-section-title">${section.section}</div>
      ${section.items.map(item => `
        <a href="${item.href}" class="nav-link ${activePage === item.href ? 'active' : ''}"${activePage === item.href ? ' aria-current="page"' : ''}>
          <i class="bi ${item.icon}" aria-hidden="true"></i> ${item.label}
        </a>`).join('')}
    `).join('');

    return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <img src="/assets/images/logo.svg" alt="RMS">
        <span>Helior RMS</span>
      </div>
      <nav class="sidebar-nav" aria-label="Primary navigation">${nav}</nav>
      <div class="sidebar-footer">© 2026 RMS Solutions</div>
    </aside>`;
  },

  renderHeader(title, breadcrumb) {
    const user = RMS.auth.getUser() || { name: 'Admin User', role: 'admin' };
    const initials = RMS.utils.getInitials(user.name.split(' ')[0], user.name.split(' ')[1] || '');
    const settingsLink = RMS.auth.isAdmin()
      ? '<li><a class="dropdown-item" href="/pages/settings.html"><i class="bi bi-gear me-2"></i>Settings</a></li><li><hr class="dropdown-divider"></li>'
      : '';
    return `
    <header class="top-header">
      <button type="button" class="header-btn sidebar-toggle" onclick="RMS.components.toggleSidebar()" aria-label="Toggle navigation" aria-controls="sidebar" aria-expanded="false"><i class="bi bi-list" aria-hidden="true"></i></button>
      <div class="header-search">
        <i class="bi bi-search" aria-hidden="true"></i>
        <label class="visually-hidden" for="globalSearch">Search contacts and campaigns</label>
        <input type="search" placeholder="Search contacts and campaigns…" id="globalSearch" name="globalSearch" autocomplete="off">
      </div>
      <div class="header-actions">
        <button type="button" class="header-btn" onclick="RMS.components.toggleTheme()" title="Toggle theme" aria-label="Toggle theme"><i class="bi bi-moon-stars" aria-hidden="true"></i></button>
        <div class="dropdown">
          <button type="button" class="header-btn" id="notificationsMenuButton" data-bs-toggle="dropdown" aria-label="Notifications" aria-expanded="false" aria-controls="notifDropdown"><i class="bi bi-bell" aria-hidden="true"></i><span class="notif-badge" id="notifCount" aria-hidden="true">3</span></button>
          <div class="dropdown-menu dropdown-menu-end notif-dropdown p-0" id="notifDropdown" aria-labelledby="notificationsMenuButton">
            <div class="p-3 border-bottom fw-semibold">Notifications</div>
            <div id="notifList"></div>
          </div>
        </div>
        <div class="dropdown">
          <button type="button" class="user-menu" id="userMenuButton" data-bs-toggle="dropdown" aria-label="Account menu for ${user.name}" aria-expanded="false" aria-controls="userMenuDropdown">
            <div class="user-avatar">${initials}</div>
            <div class="user-info d-none d-md-block">
              <div class="name">${user.name}</div>
              <div class="role">${user.role}</div>
            </div>
            <i class="bi bi-chevron-down text-secondary" aria-hidden="true"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end" id="userMenuDropdown" aria-labelledby="userMenuButton">
            <li><a class="dropdown-item" href="/pages/profile.html"><i class="bi bi-person me-2"></i>Profile</a></li>
            ${settingsLink}
            <li><button type="button" class="dropdown-item text-danger" onclick="RMS.auth.logout()"><i class="bi bi-box-arrow-right me-2" aria-hidden="true"></i>Logout</button></li>
          </ul>
        </div>
      </div>
    </header>
    <div class="page-content fade-in">
      <div class="page-header">
        <div>
          <h1>${title}</h1>
          ${breadcrumb ? `<div class="breadcrumb">${breadcrumb}</div>` : ''}
        </div>
        <div id="pageActions"></div>
      </div>
      <div id="pageBody"></div>
    </div>`;
  },

  initLayout(activePage, title, breadcrumb) {
    if (!RMS.auth.requireAuth()) return;
    const theme = localStorage.getItem('rms_theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.body.innerHTML = `
      <a class="skip-link" href="#mainContent">Skip to main content</a>
      <div class="app-wrapper">
        ${this.renderSidebar(activePage)}
        <main class="main-content" id="mainContent" tabindex="-1">${this.renderHeader(title, breadcrumb)}</main>
      </div>`;
    this.installAccessibilityObserver();
    this.installModalFocusManagement();
    this.ensureConfirmModal();
    this.loadNotifications();
    const search = document.getElementById('globalSearch');
    if (search) {
      search.addEventListener('keydown', e => {
        if (e.key === 'Enter') window.location.href = `/pages/contacts.html?search=${encodeURIComponent(e.target.value)}`;
      });
    }
  },

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const button = document.querySelector('.sidebar-toggle');
    if (!sidebar) return;
    const expanded = sidebar.classList.toggle('show');
    button?.setAttribute('aria-expanded', String(expanded));
  },

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('rms_theme', next);
    RMS.toast.show(`${next === 'dark' ? 'Dark' : 'Light'} mode enabled`, 'info');
  },

  async loadNotifications() {
    const res = await RMS.api.get('/notifications');
    const list = document.getElementById('notifList');
    const count = document.getElementById('notifCount');
    if (!list) return;
    const items = res?.data || [];
    const unread = items.filter(n => !n.isRead).length;
    if (count) { count.textContent = unread; count.style.display = unread ? 'flex' : 'none'; }
    list.innerHTML = items.length ? items.map(n => `
      <a class="notif-item ${n.isRead ? '' : 'unread'}" href="${n.link || '#'}">
        <div class="fw-semibold small">${n.title}</div>
        <div class="text-secondary small">${n.message}</div>
      </a>`).join('') : '<div class="p-3 text-secondary small text-center">No notifications</div>';
  },

  renderSkeletonCards(count = 4) {
    return `<div class="row g-3">${Array(count).fill().map(() => `
      <div class="col-md-3"><div class="stat-card"><div class="skeleton" style="height:80px"></div></div></div>`).join('')}</div>`;
  },

  _confirmCallback: null,

  ensureConfirmModal() {
    if (document.getElementById('rmsConfirmModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal fade" id="rmsConfirmModal" tabindex="-1" aria-hidden="true" aria-labelledby="rmsConfirmTitle" aria-describedby="rmsConfirmMessage">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content rms-confirm-modal shadow-lg">
            <div class="modal-body text-center px-4 pt-4 pb-2">
              <div class="rms-confirm-icon mb-3"><i class="bi bi-trash3-fill"></i></div>
              <h5 class="fw-bold mb-2" id="rmsConfirmTitle">Confirm Delete</h5>
              <p class="text-secondary mb-0" id="rmsConfirmMessage">Are you sure you want to delete this item? This action cannot be undone.</p>
              <div class="alert py-2 small d-none mt-3 mb-0" id="rmsConfirmStatus"></div>
            </div>
            <div class="modal-footer border-0 justify-content-center gap-2 px-4 pb-4 pt-2">
              <button type="button" class="btn btn-light px-4" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-danger px-4" id="rmsConfirmBtn"><i class="bi bi-trash me-1"></i>Delete</button>
            </div>
          </div>
        </div>
      </div>`);
    document.getElementById('rmsConfirmBtn').addEventListener('click', async () => {
      const cb = window.RMS.components._confirmCallback;
      const modalEl = document.getElementById('rmsConfirmModal');
      const button = document.getElementById('rmsConfirmBtn');
      if (typeof cb !== 'function') return;
      const result = await cb(button);
      if (result?.ok !== false) {
        window.RMS.components._confirmCallback = null;
        bootstrap.Modal.getInstance(modalEl)?.hide();
      }
    });
    document.getElementById('rmsConfirmModal').addEventListener('hidden.bs.modal', () => {
      window.RMS.components._confirmCallback = null;
    });
  },

  confirm(options) {
    const opts = typeof options === 'string' ? { message: options } : (options || {});
    this.ensureConfirmModal();
    this._confirmCallback = opts.onConfirm || null;
    document.getElementById('rmsConfirmTitle').textContent = opts.title || 'Confirm Delete';
    document.getElementById('rmsConfirmMessage').textContent = opts.message || 'Are you sure you want to delete this item? This action cannot be undone.';
    const status = document.getElementById('rmsConfirmStatus');
    status.textContent = '';
    status.classList.add('d-none');
    status.removeAttribute('role');
    const btn = document.getElementById('rmsConfirmBtn');
    btn.innerHTML = opts.confirmHtml || '<i class="bi bi-trash me-1"></i>Delete';
    btn.className = opts.confirmClass || 'btn btn-danger px-4';
    new bootstrap.Modal(document.getElementById('rmsConfirmModal')).show();
  },

  confirmDelete(message, onConfirm) {
    this.confirm({
      title: 'Confirm Delete',
      message: message || 'Are you sure you want to delete this item? This action cannot be undone.',
      onConfirm
    });
  },

  enhanceAccessibility(root = document) {
    const scope = root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_NODE ? root : document;
    scope.querySelectorAll?.('i.bi').forEach(icon => icon.setAttribute('aria-hidden', 'true'));
    scope.querySelectorAll?.('button:not([type])').forEach(button => { button.type = 'button'; });

    scope.querySelectorAll?.('[data-bs-toggle="tab"], [data-bs-toggle="pill"]').forEach(control => {
      const targetSelector = control.getAttribute('data-bs-target') || control.getAttribute('href');
      if (!targetSelector?.startsWith('#')) return;
      const panel = document.querySelector(targetSelector);
      if (!panel) return;
      if (!control.id) control.id = `${panel.id}Tab`;
      control.setAttribute('role', 'tab');
      control.setAttribute('aria-controls', panel.id);
      control.setAttribute('aria-selected', String(control.classList.contains('active')));
      control.closest('li')?.setAttribute('role', 'presentation');
      control.closest('.nav')?.setAttribute('role', 'tablist');
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', control.id);
    });

    scope.querySelectorAll?.('input:not([type="hidden"]), select, textarea').forEach(field => {
      if (field.id && !field.name) field.name = field.id;
      if (field.id && !field.labels?.length && !field.getAttribute('aria-label') && !field.getAttribute('aria-labelledby')) {
        const container = field.parentElement;
        const label = container?.querySelector(':scope > label:not([for])');
        if (label) label.htmlFor = field.id;
      }
      const type = (field.getAttribute('type') || 'text').toLowerCase();
      if (field.tagName === 'INPUT' && ['text', 'email', 'password', 'search', 'tel', 'url'].includes(type) && !field.hasAttribute('autocomplete')) {
        if (type === 'email') field.autocomplete = 'email';
        else if (type === 'tel') field.autocomplete = 'tel';
        else if (type === 'url') field.autocomplete = 'url';
        else if (type === 'password') field.autocomplete = /new|confirm/i.test(field.id) ? 'new-password' : 'current-password';
        else field.autocomplete = 'off';
      }
    });

    scope.querySelectorAll?.('.modal').forEach(dialog => {
      const title = dialog.querySelector('.modal-title');
      if (title && !title.id) title.id = `${dialog.id || 'dialog'}Title`;
      if (title) dialog.setAttribute('aria-labelledby', title.id);
      dialog.querySelectorAll('.btn-close:not([aria-label])').forEach(button => button.setAttribute('aria-label', 'Close'));
    });

    scope.querySelectorAll?.('table:not(:has(caption))').forEach(table => {
      const caption = document.createElement('caption');
      caption.className = 'visually-hidden';
      const heading = table.closest('.card')?.querySelector('.card-header, h2, h3, h4, h5, h6');
      caption.textContent = `${heading?.textContent?.trim() || document.querySelector('h1')?.textContent?.trim() || 'Data'} table`;
      table.prepend(caption);
    });

    scope.querySelectorAll?.('.table-responsive').forEach(region => {
      if (!region.hasAttribute('tabindex')) region.tabIndex = 0;
      if (!region.getAttribute('aria-label') && !region.getAttribute('aria-labelledby')) {
        const caption = region.querySelector('caption')?.textContent?.trim();
        region.setAttribute('aria-label', caption ? `${caption} scroll area` : 'Scrollable table');
      }
    });
  },

  installAccessibilityObserver() {
    if (this._accessibilityObserver) this._accessibilityObserver.disconnect();
    let scheduled = false;
    this._accessibilityObserver = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        this.enhanceAccessibility(document);
      });
    });
    this._accessibilityObserver.observe(document.body, { childList: true, subtree: true });
    this.enhanceAccessibility(document);
  },

  installModalFocusManagement() {
    if (this._modalFocusInstalled) return;
    this._modalFocusInstalled = true;
    document.addEventListener('show.bs.modal', event => {
      event.target._rmsTrigger = document.activeElement;
    });
    document.addEventListener('shown.bs.modal', event => {
      if (!window.matchMedia('(pointer: fine)').matches) return;
      const target = event.target.querySelector('[data-modal-initial-focus]')
        || event.target.querySelector('input:not([type="hidden"]), select, textarea')
        || event.target.querySelector('button:not([data-bs-dismiss])');
      target?.focus();
    });
    document.addEventListener('hidden.bs.modal', event => {
      const trigger = event.target._rmsTrigger;
      if (trigger?.isConnected) trigger.focus();
      delete event.target._rmsTrigger;
    });
  }
};
