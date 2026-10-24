// renderer/js/app.js
// Central MediStock ERP Application Controller, Router, Modal Manager & Keyboard Shortcuts

const VIEW_SCRIPTS = [
  'js/views/dashboard.js',
  'js/views/billing.js',
  'js/views/wholesale.js',
  'js/views/sales.js',
  'js/views/purchase.js',
  'js/views/inventory.js',
  'js/views/expiry.js',
  'js/views/compliance.js',
  'js/views/masters.js',
  'js/views/customers.js',
  'js/views/suppliers.js',
  'js/views/accounts.js',
  'js/views/gst.js',
  'js/views/reports.js',
  'js/views/backup.js',
  'js/views/users.js',
  'js/views/settings.js',
  'js/views/about.js',
];

window.MediStock = {
  currentUser: {
    id: 1,
    username: 'admin',
    fullName: 'Rajesh Patel',
    roleName: 'Administrator',
  },
  company: null,
  activeView: 'dashboard',

  formatRupees(paise) {
    if (paise === null || paise === undefined || isNaN(paise)) return '₹ 0.00';
    const rupees = Number(paise) / 100;
    return `₹ ${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  },

  formatDate(isoDate) {
    if (!isoDate) return 'N/A';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${parts[2]}-${months[parseInt(parts[1], 10) - 1]}-${parts[0]}`;
    }
    return isoDate;
  },

  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toastElem = document.createElement('div');
    toastElem.className = `toast ${type}`;
    toastElem.innerHTML = `<span>${message}</span>`;
    container.appendChild(toastElem);

    setTimeout(() => {
      toastElem.style.opacity = '0';
      toastElem.style.transform = 'translateY(10px)';
      toastElem.style.transition = 'all 0.3s ease';
      setTimeout(() => toastElem.remove(), 300);
    }, 3500);
  },

  showModal(title, bodyHtml, footerHtml = '', size = 'md') {
    const container = document.getElementById('modal-container');
    const sizeClass = size === 'lg' ? 'modal-lg' : size === 'xl' ? 'modal-xl' : '';

    container.innerHTML = `
      <div class="modal-overlay" id="active-modal-overlay">
        <div class="modal-dialog ${sizeClass}">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="modal-close" onclick="MediStock.closeModal()">&times;</button>
          </div>
          <div class="modal-body">
            ${bodyHtml}
          </div>
          ${
            footerHtml
              ? `<div class="modal-footer">${footerHtml}</div>`
              : ''
          }
        </div>
      </div>
    `;

    // Esc closes modal
    document.getElementById('active-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'active-modal-overlay') {
        MediStock.closeModal();
      }
    });
  },

  closeModal() {
    const container = document.getElementById('modal-container');
    if (container) container.innerHTML = '';
  },

  async navigate(viewName, params = {}) {
    const container = document.getElementById('view-container');
    if (!container) return;

    // Update sidebar navigation active state
    document.querySelectorAll('.sidebar-nav .nav-item').forEach((item) => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    this.activeView = viewName;

    const view = window.MediStockViews && window.MediStockViews[viewName];
    if (view && typeof view.render === 'function') {
      try {
        await view.render(container, params);
      } catch (err) {
        console.error(`Error rendering view ${viewName}:`, err);
        container.innerHTML = `<div class="card"><p style="color: red;">Failed to render ${viewName}: ${err.message}</p></div>`;
      }
    } else {
      container.innerHTML = `<div class="card"><h3>View "${viewName}" not loaded yet.</h3></div>`;
    }
  },

  async viewInvoiceDetails(invoiceId) {
    if (window.MediStockViews.billing && typeof window.MediStockViews.billing.openPrintPreviewModal === 'function') {
      window.MediStockViews.billing.openPrintPreviewModal(invoiceId);
    }
  },

  initClock() {
    const clockElem = document.getElementById('live-clock');
    if (!clockElem) return;

    const updateClock = () => {
      const now = new Date();
      clockElem.textContent = now.toLocaleTimeString('en-IN', { hour12: true });
    };
    updateClock();
    setInterval(updateClock, 1000);
  },

  bindGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't intercept if user is typing in a modal or text input unless it's a dedicated function key
      if (e.key === 'F2') {
        e.preventDefault();
        this.navigate('billing');
        setTimeout(() => {
          const inp = document.getElementById('pos-search-input');
          if (inp) inp.focus();
        }, 100);
      } else if (e.key === 'F3') {
        if (this.activeView === 'billing' && window.MediStockViews.billing) {
          e.preventDefault();
          window.MediStockViews.billing.openCustomerModal();
        }
      } else if (e.key === 'F8') {
        if (this.activeView === 'billing' && window.MediStockViews.billing) {
          e.preventDefault();
          window.MediStockViews.billing.holdCurrentBill();
        }
      } else if (e.key === 'F9') {
        if (this.activeView === 'billing' && window.MediStockViews.billing) {
          e.preventDefault();
          window.MediStockViews.billing.resumeHeldBill();
        }
      } else if (e.key === 'F12') {
        if (this.activeView === 'billing' && window.MediStockViews.billing) {
          e.preventDefault();
          window.MediStockViews.billing.saveAndPrintInvoice();
        }
      } else if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  },

  async initCompanyHeader() {
    try {
      const company = await window.api.settings.getCompany();
      if (company) {
        this.company = company;
        const nameElem = document.getElementById('company-display-name');
        const dlElem = document.getElementById('company-dl-badge');
        if (nameElem) nameElem.textContent = company.trade_name || company.name;
        if (dlElem) dlElem.textContent = `DL: ${company.drug_license_no_1 || 'MH-WZ-123456'}`;
      }
    } catch (e) {
      console.warn('Could not load company header:', e.message);
    }
  },

  bindUiControls() {
    // Topbar quick actions
    const btnNewBill = document.getElementById('btn-quick-new-bill');
    if (btnNewBill) {
      btnNewBill.addEventListener('click', () => {
        this.navigate('billing');
        setTimeout(() => {
          const s = document.getElementById('pos-search-input');
          if (s) s.focus();
        }, 100);
      });
    }

    const btnQuickBackup = document.getElementById('btn-quick-backup');
    if (btnQuickBackup) {
      btnQuickBackup.addEventListener('click', async () => {
        this.toast('Executing instant SQLite database backup...', 'info');
        try {
          const res = await window.api.backup.createBackup('MANUAL');
          if (res.success) {
            this.toast(`Backup saved! Size: ${(res.fileSizeBytes / 1024).toFixed(1)} KB`, 'success');
          }
        } catch (err) {
          this.toast(`Backup failed: ${err.message}`, 'error');
        }
      });
    }

    // Sidebar navigation clicks
    document.querySelectorAll('.sidebar-nav .nav-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const viewName = item.getAttribute('data-view');
        if (viewName) this.navigate(viewName);
      });
    });
  },
};

// Dynamically load view scripts sequentially then initialize app
async function bootstrapApp() {
  window.MediStockViews = window.MediStockViews || {};

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => {
        console.error(`Failed to load view script ${src}`);
        resolve(); // Continue even if single script fails
      };
      document.body.appendChild(script);
    });

  for (const s of VIEW_SCRIPTS) {
    await loadScript(s);
  }

  // Initialize features
  MediStock.initClock();
  MediStock.bindGlobalShortcuts();
  MediStock.bindUiControls();
  await MediStock.initCompanyHeader();

  // Navigate to initial dashboard view
  MediStock.navigate('dashboard');
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', bootstrapApp);
