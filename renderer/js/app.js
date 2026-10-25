// renderer/js/app.js
// Central MediStock ERP Application Controller, Router, Modal Manager & Keyboard Shortcuts

window.MediStock = {
  currentUser: {
    id: 1,
    username: 'pharmacist',
    fullName: 'Rajesh Patel',
    roleName: 'Store Manager',
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

  numberToWords(num) {
    if (!num || isNaN(num) || num <= 0) return 'Zero Rupees Only';
    const a = [
      '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ',
      'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n) => {
      let str = '';
      if (n > 19) {
        str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
      } else {
        str += a[n];
      }
      return str;
    };

    const n = Math.floor(num);
    const crore = Math.floor(n / 10000000);
    const lakh = Math.floor((n % 10000000) / 100000);
    const thousand = Math.floor((n % 100000) / 1000);
    const hundred = Math.floor((n % 1000) / 100);
    const rest = Math.floor(n % 100);

    let res = '';
    if (crore > 0) res += inWords(crore) + 'Crore ';
    if (lakh > 0) res += inWords(lakh) + 'Lakh ';
    if (thousand > 0) res += inWords(thousand) + 'Thousand ';
    if (hundred > 0) res += inWords(hundred) + 'Hundred ';
    if (rest > 0) res += inWords(rest);

    return `Rupees ${res.trim()} Only`;
  },

  setTheme(themeName) {
    const validThemes = ['classic', 'navy', 'red', 'emerald', 'dark'];
    const selected = validThemes.includes(themeName) ? themeName : 'classic';
    document.documentElement.setAttribute('data-theme', selected);
    localStorage.setItem('medistock_theme', selected);

    const picker = document.getElementById('global-theme-picker');
    if (picker && picker.value !== selected) {
      picker.value = selected;
    }
  },

  initTheme() {
    const savedTheme = localStorage.getItem('medistock_theme') || 'classic';
    this.setTheme(savedTheme);

    const picker = document.getElementById('global-theme-picker');
    if (picker) {
      picker.value = savedTheme;
      picker.addEventListener('change', (e) => {
        this.setTheme(e.target.value);
        this.toast(`Theme switched to ${e.target.options[e.target.selectedIndex].text}`, 'info');
      });
    }
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

    // Sub-views of Settings & Preferences cleanly route to the 15th tab (settings)
    if (viewName === 'backup' || viewName === 'users' || viewName === 'about') {
      const targetSubTab = viewName === 'about' ? 'shortcuts' : viewName;
      return this.navigate('settings', targetSubTab);
    }

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
      // F1 or Ctrl+N or Alt+N: Start Fresh New Bill
      if (e.key === 'F1' || ((e.ctrlKey || e.altKey) && (e.key === 'n' || e.key === 'N'))) {
        e.preventDefault();
        this.navigate('billing');
        if (window.MediStockViews.billing) {
          window.MediStockViews.billing.clearBill();
        }
        setTimeout(() => {
          const inp = document.getElementById('pos-search-input');
          if (inp) {
            inp.focus();
            inp.select();
          }
        }, 100);
        this.toast('Fresh retail bill ready (F1)', 'info');
      }
      // F2 or Insert: Search Medicine / Barcode Scanner
      else if (e.key === 'F2' || e.key === 'Insert') {
        e.preventDefault();
        if (this.activeView !== 'billing') {
          this.navigate('billing');
        }
        setTimeout(() => {
          const inp = document.getElementById('pos-search-input');
          if (inp) {
            inp.focus();
            inp.select();
          }
        }, 80);
      }
      // F3: Focus Customer Name & Mobile Header Entry
      else if (e.key === 'F3') {
        if (this.activeView === 'billing' && window.MediStockViews.billing) {
          e.preventDefault();
          const custInp = document.getElementById('pos-customer-name');
          if (custInp) {
            custInp.focus();
            custInp.select();
          } else {
            window.MediStockViews.billing.openCustomerModal();
          }
        }
      }
      // F4: Open Full Customer Directory Modal
      else if (e.key === 'F4') {
        if (this.activeView === 'billing' && window.MediStockViews.billing) {
          e.preventDefault();
          window.MediStockViews.billing.openCustomerModal();
        }
      }
      // F8: Hold Bill
      else if (e.key === 'F8') {
        if (this.activeView === 'billing' && window.MediStockViews.billing) {
          e.preventDefault();
          window.MediStockViews.billing.holdCurrentBill();
        }
      }
      // F9: Resume Bill
      else if (e.key === 'F9') {
        if (this.activeView === 'billing' && window.MediStockViews.billing) {
          e.preventDefault();
          window.MediStockViews.billing.resumeHeldBill();
        }
      }
      // F10: Payment Mode Selection
      else if (e.key === 'F10') {
        if (this.activeView === 'billing') {
          e.preventDefault();
          const paySelect = document.getElementById('pos-payment-mode');
          if (paySelect) paySelect.focus();
        }
      }
      // F12: Save & Print Invoice
      else if (e.key === 'F12') {
        if (this.activeView === 'billing' && window.MediStockViews.billing) {
          e.preventDefault();
          window.MediStockViews.billing.saveAndPrintInvoice();
        }
      }
      // Alt+L: Operator Sign Out / Shift Switch
      else if (e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        this.logout();
      }
      // Escape: Close active modal or clear search
      else if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  },

  showLicenseScreen() {
    this.activeView = 'license';
    const container = document.getElementById('view-container');
    if (window.MediStockViews && window.MediStockViews.license) {
      window.MediStockViews.license.render(container);
    }
  },

  showLoginScreen() {
    this.activeView = 'login';
    const container = document.getElementById('view-container');
    if (window.MediStockViews && window.MediStockViews.login) {
      window.MediStockViews.login.render(container);
    }
  },

  applySessionUser(user) {
    if (!user) return;
    this.currentUser = user;

    // Topbar user badge
    const topUser = document.getElementById('topbar-username');
    if (topUser) {
      topUser.textContent = `${user.fullName || user.username} (${user.roleName || 'Operator'})`;
    }

    // Sidebar user badge
    const sideName = document.getElementById('user-display-name');
    const sideRole = document.getElementById('user-display-role');
    const sideAvatar = document.getElementById('user-avatar');

    if (sideName) sideName.textContent = user.fullName || user.username;
    if (sideRole) sideRole.textContent = user.roleName || 'Operator';
    if (sideAvatar) {
      const nameForInitials = user.fullName || user.username || 'OP';
      sideAvatar.textContent = nameForInitials.slice(0, 2).toUpperCase();
    }
  },

  onLoginSuccess(user) {
    sessionStorage.setItem('medistock_session_user', JSON.stringify(user));
    this.applySessionUser(user);
    this.initCompanyHeader();
    this.navigate('dashboard');
  },

  logout() {
    sessionStorage.removeItem('medistock_session_user');
    this.showLoginScreen();
    this.toast('Signed out from counter. Please log in.', 'info');
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
    // Topbar quick actions: New Bill (F1)
    const btnNewBill = document.getElementById('btn-quick-new-bill');
    if (btnNewBill) {
      btnNewBill.addEventListener('click', () => {
        this.navigate('billing');
        if (window.MediStockViews.billing) {
          window.MediStockViews.billing.clearBill();
        }
        setTimeout(() => {
          const s = document.getElementById('pos-search-input');
          if (s) {
            s.focus();
            s.select();
          }
        }, 100);
        this.toast('Fresh retail bill ready (F1)', 'info');
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

    // Topbar Profile button
    const btnProfile = document.getElementById('btn-topbar-profile');
    if (btnProfile) {
      btnProfile.addEventListener('click', () => {
        this.openMyAccountModal();
      });
    }

    // Topbar Logout button
    const btnLogout = document.getElementById('btn-topbar-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        this.logout();
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

  openMyAccountModal() {
    const user = this.currentUser || {};
    const userId = user.id || 1;

    const bodyHtml = `
      <form id="my-account-form">
        <div style="background: linear-gradient(135deg, rgba(2, 132, 199, 0.08), rgba(245, 158, 11, 0.04)); padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid rgba(2, 132, 199, 0.2);">
          <div style="font-size: 13.5px; font-weight: 800; color: #0284c7;">
            👤 ${user.fullName || user.username}
          </div>
          <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">
            Role: <strong>${user.roleName || 'Operator'}</strong> | Branch: <strong>${user.branchName || 'Main Store'}</strong>
          </div>
        </div>

        <h4 style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px;">1. Profile & Contact Details</h4>
        <div class="form-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 12px;">
          <div class="form-group">
            <label class="form-label">Full Name *:</label>
            <input type="text" id="my-fullname" class="form-control" value="${user.fullName || ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Username *:</label>
            <input type="text" id="my-username" class="form-control" value="${user.username || ''}" required>
          </div>
        </div>

        <div class="form-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 16px;">
          <div class="form-group">
            <label class="form-label">Mobile Number:</label>
            <input type="text" id="my-phone" class="form-control" value="${user.phone || ''}" placeholder="10-digit mobile">
          </div>
          <div class="form-group">
            <label class="form-label">Email Address:</label>
            <input type="email" id="my-email" class="form-control" value="${user.email || ''}" placeholder="email@pharmacy.com">
          </div>
        </div>

        <h4 style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 8px; border-top: 1px dashed #cbd5e1; padding-top: 12px;">
          2. Change Password (Optional)
        </h4>
        <div class="form-group" style="margin-bottom: 10px;">
          <label class="form-label">Current Password:</label>
          <input type="password" id="my-cur-password" class="form-control" placeholder="Required only if changing password">
        </div>

        <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">New Password:</label>
            <input type="password" id="my-new-password" class="form-control" placeholder="Min 4 characters">
          </div>
          <div class="form-group">
            <label class="form-label">Confirm New Password:</label>
            <input type="password" id="my-confirm-password" class="form-control" placeholder="Re-type new password">
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-primary" id="btn-save-my-account">💾 Save Account Changes</button>
      <button class="btn btn-secondary" onclick="MediStock.closeModal()">Cancel</button>
    `;

    this.showModal('👤 My Account & Security Settings', bodyHtml, footerHtml, 'md');

    const btnSave = document.getElementById('btn-save-my-account');
    if (btnSave) {
      btnSave.addEventListener('click', async () => {
        const fullName = document.getElementById('my-fullname').value.trim();
        const username = document.getElementById('my-username').value.trim();
        const phone = document.getElementById('my-phone').value.trim();
        const email = document.getElementById('my-email').value.trim();
        const curPassword = document.getElementById('my-cur-password').value;
        const newPassword = document.getElementById('my-new-password').value;
        const confirmPassword = document.getElementById('my-confirm-password').value;

        if (!fullName || !username) {
          return this.toast('Full Name and Username cannot be empty', 'warning');
        }

        btnSave.disabled = true;
        btnSave.textContent = 'Saving...';

        try {
          // 1. Update Profile (Name, Username, Phone, Email)
          const profileRes = await window.api.auth.updateProfile(userId, {
            fullName,
            username,
            phone,
            email,
          });

          if (!profileRes || !profileRes.success) {
            btnSave.disabled = false;
            btnSave.textContent = '💾 Save Account Changes';
            return this.toast(profileRes.message || 'Failed to update profile', 'error');
          }

          // 2. Change Password if entered
          if (newPassword || curPassword) {
            if (!curPassword) {
              btnSave.disabled = false;
              btnSave.textContent = '💾 Save Account Changes';
              return this.toast('Please enter your Current Password to change it', 'warning');
            }
            if (newPassword !== confirmPassword) {
              btnSave.disabled = false;
              btnSave.textContent = '💾 Save Account Changes';
              return this.toast('New Passwords do not match', 'error');
            }
            if (newPassword.length < 4) {
              btnSave.disabled = false;
              btnSave.textContent = '💾 Save Account Changes';
              return this.toast('Password must be at least 4 characters long', 'warning');
            }

            const pwdRes = await window.api.auth.changePassword({
              userId,
              oldPassword: curPassword,
              newPassword,
            });

            if (!pwdRes || !pwdRes.success) {
              btnSave.disabled = false;
              btnSave.textContent = '💾 Save Account Changes';
              return this.toast(pwdRes.message || 'Password change failed', 'error');
            }
          }

          // Update active session in memory
          this.currentUser.fullName = fullName;
          this.currentUser.username = username;
          this.currentUser.phone = phone;
          this.currentUser.email = email;
          sessionStorage.setItem('medistock_session_user', JSON.stringify(this.currentUser));
          this.applySessionUser(this.currentUser);

          this.toast('Account changes saved successfully!', 'success');
          this.closeModal();

          // If on settings/users tab, refresh it
          if (this.activeView === 'settings') {
            if (window.MediStockViews.users) window.MediStockViews.users.loadUsers();
          }
        } catch (err) {
          this.toast(`Error updating account: ${err.message}`, 'error');
          btnSave.disabled = false;
          btnSave.textContent = '💾 Save Account Changes';
        }
      });
    }
  },
};

async function bootstrapApp() {
  console.log('MediStock bootstrapping UI...');
  MediStock.initTheme();
  MediStock.initClock();
  MediStock.bindGlobalShortcuts();
  MediStock.bindUiControls();
  await MediStock.initCompanyHeader();

  // 1. Hardware-bound License Check
  try {
    const lic = await window.api.license.getStatus();
    if (!lic || !lic.isLicensed) {
      console.log('License not active on this machine. Opening activation screen.');
      MediStock.showLicenseScreen();
      return;
    }
  } catch (err) {
    console.warn('License status check warning:', err.message);
  }

  // 2. Operator Session Verification
  const savedSession = sessionStorage.getItem('medistock_session_user');
  if (!savedSession) {
    console.log('No operator logged in. Opening login screen.');
    MediStock.showLoginScreen();
    return;
  }

  try {
    const user = JSON.parse(savedSession);
    MediStock.applySessionUser(user);
  } catch (e) {
    MediStock.showLoginScreen();
    return;
  }

  await MediStock.navigate('dashboard');
  console.log('MediStock UI ready!');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapApp);
} else {
  bootstrapApp();
}
