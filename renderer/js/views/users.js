// renderer/js/views/users.js
// Complete User Management, Role Editing, Account Updates & Security Sessions

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.users = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div class="card-title">🔐 Pharmacy Users, Roles & Staff Directory</div>
            <p style="font-size: 11.5px; color: var(--text-muted); margin: 2px 0 0;">
              Manage staff accounts, change operator names, edit usernames, assign roles, and reset passwords.
            </p>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-add-user">➕ Add New User</button>
        </div>

        <div class="table-container" style="margin-bottom: 20px;">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Role / Designation</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Last Login</th>
                <th>Status</th>
                <th style="width: 200px; text-align: center;">Actions</th>
              </tr>
            </thead>
            <tbody id="users-tbody">
              <tr><td colspan="8" class="text-center">Loading staff accounts...</td></tr>
            </tbody>
          </table>
        </div>

        <div class="card-header">
          <div class="card-title">System Role Permissions Matrix</div>
        </div>
        <div class="table-container">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Permissions & Access Level</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><strong>Store Manager / Owner</strong></td><td>Full unrestricted access across billing, purchases, double-entry accounts, settings, backups, and user management.</td></tr>
              <tr><td><strong>Pharmacist</strong></td><td>Dispensing, Schedule H/H1 registers verification, physical stock inspection, and customer counseling.</td></tr>
              <tr><td><strong>Billing Operator / Cashier</strong></td><td>High-speed retail POS billing, receipts, customer lookups. Restricted from price overrides or backdating.</td></tr>
              <tr><td><strong>Purchase Manager</strong></td><td>Purchase orders, supplier bills entry, goods receipt, rate comparison.</td></tr>
              <tr><td><strong>Accountant</strong></td><td>Double-entry journal vouchers, trial balance, GST filing reports, profit and loss.</td></tr>
              <tr><td><strong>Auditor</strong></td><td>Read-only inspection of stock ledger, accounting vouchers, and compliance audit trail.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindEvents();
    this.loadUsers();
  },

  bindEvents() {
    const btnAdd = document.getElementById('btn-add-user');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.openAddUserModal());
    }
  },

  async loadUsers() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;

    try {
      const users = await window.api.auth.listUsers();
      if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: var(--text-muted);">No users found. Click "+ Add New User" to create one.</td></tr>`;
        return;
      }

      tbody.innerHTML = users
        .map(
          (u) => `
        <tr>
          <td><strong style="color: var(--primary);">${u.username}</strong></td>
          <td>${u.full_name}</td>
          <td><span class="badge ${u.role_name === 'Administrator' ? 'danger' : 'info'}">${u.role_name}</span></td>
          <td>${u.phone || '—'}</td>
          <td>${u.email || '—'}</td>
          <td style="font-size: 11px;">${u.last_login_at ? new Date(u.last_login_at).toLocaleString('en-IN') : 'Never'}</td>
          <td><span class="badge ${u.is_active ? 'success' : 'neutral'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 4px; justify-content: center;">
              <button class="btn btn-outline btn-sm" style="padding: 2px 8px; font-size: 11px;" onclick="window.MediStockViews.users.openEditUserModal(${u.id})" title="Edit user details">
                ✏️ Edit
              </button>
              <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 11px;" onclick="window.MediStockViews.users.openResetPasswordModal(${u.id}, '${u.username}')" title="Reset password">
                🔑 Password
              </button>
              ${u.id !== 1 ? `
                <button class="btn btn-outline btn-sm" style="padding: 2px 6px; font-size: 11px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" onclick="window.MediStockViews.users.deleteUser(${u.id}, '${u.username}')" title="Delete or deactivate user">
                  🗑️
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `
        )
        .join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="color: red;">Failed to load users: ${err.message}</td></tr>`;
    }
  },

  async openAddUserModal() {
    let roles = [];
    try {
      roles = await window.api.auth.listRoles();
    } catch (e) {
      console.warn('Could not load roles:', e);
    }

    const bodyHtml = `
      <form id="new-user-form">
        <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">Username *:</label>
            <input type="text" id="u-username" class="form-control" placeholder="e.g. rahul_pharma" required autofocus>
          </div>
          <div class="form-group">
            <label class="form-label">Password *:</label>
            <input type="password" id="u-pass" class="form-control" placeholder="Min 4 characters" required>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Full Name *:</label>
          <input type="text" id="u-fullname" class="form-control" placeholder="e.g. Dr. Rahul Sharma" required>
        </div>

        <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">System Role *:</label>
            <select id="u-role" class="form-control">
              ${roles.map((r) => `<option value="${r.id}">${r.name} — ${r.description}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Phone Number:</label>
            <input type="text" id="u-phone" class="form-control" placeholder="10 digits mobile">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Email Address (Optional):</label>
          <input type="email" id="u-email" class="form-control" placeholder="staff@pharmacy.com">
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-primary" id="btn-save-new-user">Create User Account</button>
      <button class="btn btn-secondary" onclick="MediStock.closeModal()">Cancel</button>
    `;

    MediStock.showModal('➕ Add New Staff Account', bodyHtml, footerHtml, 'md');

    document.getElementById('btn-save-new-user').addEventListener('click', async () => {
      const username = document.getElementById('u-username').value.trim();
      const password = document.getElementById('u-pass').value;
      const fullName = document.getElementById('u-fullname').value.trim();
      const roleId = Number(document.getElementById('u-role').value);
      const phone = document.getElementById('u-phone').value.trim();
      const email = document.getElementById('u-email').value.trim();

      if (!username || !password || !fullName || !roleId) {
        MediStock.toast('Please fill all required fields (*)', 'warning');
        return;
      }

      try {
        await window.api.auth.createUser({
          username,
          password,
          fullName,
          roleId,
          phone,
          email,
        });

        MediStock.closeModal();
        MediStock.toast(`User "${username}" created successfully!`, 'success');
        this.loadUsers();
      } catch (err) {
        MediStock.toast(`User creation error: ${err.message}`, 'error');
      }
    });
  },

  async openEditUserModal(userId) {
    try {
      const user = await window.api.auth.getUserById(userId);
      if (!user) {
        return MediStock.toast('User not found', 'error');
      }

      const roles = await window.api.auth.listRoles();

      const bodyHtml = `
        <form id="edit-user-form">
          <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
            <div class="form-group">
              <label class="form-label">Username *:</label>
              <input type="text" id="edit-u-username" class="form-control" value="${user.username || ''}" required autofocus>
            </div>
            <div class="form-group">
              <label class="form-label">Full Name *:</label>
              <input type="text" id="edit-u-fullname" class="form-control" value="${user.full_name || ''}" required>
            </div>
          </div>

          <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
            <div class="form-group">
              <label class="form-label">System Role *:</label>
              <select id="edit-u-role" class="form-control">
                ${roles.map((r) => `<option value="${r.id}" ${r.id === user.role_id ? 'selected' : ''}>${r.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Account Status:</label>
              <select id="edit-u-status" class="form-control">
                <option value="1" ${user.is_active ? 'selected' : ''}>Active</option>
                <option value="0" ${!user.is_active ? 'selected' : ''}>Inactive / Disabled</option>
              </select>
            </div>
          </div>

          <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
            <div class="form-group">
              <label class="form-label">Phone Number:</label>
              <input type="text" id="edit-u-phone" class="form-control" value="${user.phone || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Email Address:</label>
              <input type="email" id="edit-u-email" class="form-control" value="${user.email || ''}">
            </div>
          </div>
        </form>
      `;

      const footerHtml = `
        <button class="btn btn-primary" id="btn-save-edit-user">💾 Save Changes</button>
        <button class="btn btn-secondary" onclick="MediStock.closeModal()">Cancel</button>
      `;

      MediStock.showModal(`✏️ Edit User: ${user.username}`, bodyHtml, footerHtml, 'md');

      document.getElementById('btn-save-edit-user').addEventListener('click', async () => {
        const username = document.getElementById('edit-u-username').value.trim();
        const fullName = document.getElementById('edit-u-fullname').value.trim();
        const roleId = Number(document.getElementById('edit-u-role').value);
        const isActive = Number(document.getElementById('edit-u-status').value);
        const phone = document.getElementById('edit-u-phone').value.trim();
        const email = document.getElementById('edit-u-email').value.trim();

        if (!username || !fullName || !roleId) {
          MediStock.toast('Username, Full Name, and Role are required', 'warning');
          return;
        }

        try {
          const res = await window.api.auth.updateProfile(userId, {
            username,
            fullName,
            roleId,
            isActive,
            phone,
            email,
          });

          if (res && res.success) {
            MediStock.toast('User updated successfully!', 'success');
            MediStock.closeModal();

            // If the updated user is currently logged in, update header badge
            if (MediStock.currentUser && MediStock.currentUser.id === userId) {
              MediStock.currentUser.username = username;
              MediStock.currentUser.fullName = fullName;
              const roleObj = roles.find((r) => r.id === roleId);
              if (roleObj) MediStock.currentUser.roleName = roleObj.name;
              MediStock.applySessionUser(MediStock.currentUser);
            }

            this.loadUsers();
          } else {
            MediStock.toast(res.message || 'Failed to update user', 'error');
          }
        } catch (err) {
          MediStock.toast(`Update error: ${err.message}`, 'error');
        }
      });
    } catch (err) {
      MediStock.toast(`Could not load user data: ${err.message}`, 'error');
    }
  },

  openResetPasswordModal(userId, username) {
    const bodyHtml = `
      <form id="reset-pwd-form">
        <div style="font-size: 12.5px; color: var(--text-muted); margin-bottom: 14px;">
          Set a fresh new password for operator: <strong style="color: var(--primary);">${username}</strong>
        </div>

        <div class="form-group">
          <label class="form-label">New Password *:</label>
          <input type="password" id="reset-new-pass" class="form-control" placeholder="Minimum 4 characters" required autofocus>
        </div>

        <div class="form-group">
          <label class="form-label">Confirm Password *:</label>
          <input type="password" id="reset-confirm-pass" class="form-control" placeholder="Re-type new password" required>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-primary" id="btn-save-reset-pass">🔑 Update Password</button>
      <button class="btn btn-secondary" onclick="MediStock.closeModal()">Cancel</button>
    `;

    MediStock.showModal(`🔑 Reset Password: ${username}`, bodyHtml, footerHtml, 'sm');

    document.getElementById('btn-save-reset-pass').addEventListener('click', async () => {
      const newPass = document.getElementById('reset-new-pass').value;
      const confirmPass = document.getElementById('reset-confirm-pass').value;

      if (!newPass || newPass.length < 4) {
        MediStock.toast('Password must be at least 4 characters long', 'warning');
        return;
      }

      if (newPass !== confirmPass) {
        MediStock.toast('Passwords do not match!', 'error');
        return;
      }

      try {
        const res = await window.api.auth.adminResetPassword(userId, newPass);
        if (res && res.success) {
          MediStock.toast(`Password for "${username}" updated successfully!`, 'success');
          MediStock.closeModal();
        } else {
          MediStock.toast(res.message || 'Failed to reset password', 'error');
        }
      } catch (err) {
        MediStock.toast(`Error resetting password: ${err.message}`, 'error');
      }
    });
  },

  async deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to remove user "${username}"?`)) {
      return;
    }

    try {
      const res = await window.api.auth.deleteUser(userId);
      if (res && res.success) {
        MediStock.toast(res.message || `User "${username}" removed!`, 'success');
        this.loadUsers();
      } else {
        MediStock.toast(res.message || 'Could not delete user', 'error');
      }
    } catch (err) {
      MediStock.toast(`Error deleting user: ${err.message}`, 'error');
    }
  },
};
