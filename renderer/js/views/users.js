// renderer/js/views/users.js
// User Management, Role-Based Access Control, and Security Sessions

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.users = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔐 Users, Roles & Security Permissions</div>
          <button class="btn btn-primary btn-sm" id="btn-add-user">+ Add New User</button>
        </div>

        <div class="table-container" style="margin-bottom: 20px;">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Role Designation</th>
                <th>Assigned Branch</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Last Login</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="users-tbody">
              <tr><td colspan="8" class="text-center">Loading user directory...</td></tr>
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
    document.getElementById('btn-add-user').addEventListener('click', () => this.openAddUserModal());
  },

  async loadUsers() {
    const tbody = document.getElementById('users-tbody');
    const users = await window.api.auth.listUsers();

    tbody.innerHTML = users
      .map(
        (u) => `
      <tr>
        <td><strong>${u.username}</strong></td>
        <td>${u.full_name}</td>
        <td><span class="badge ${u.role_name === 'Administrator' ? 'danger' : 'info'}">${u.role_name}</span></td>
        <td>${u.branch_name || 'Central Head Office'}</td>
        <td>${u.email || 'N/A'}</td>
        <td>${u.phone || 'N/A'}</td>
        <td style="font-size: 11px;">${u.last_login_at || 'Never'}</td>
        <td><span class="badge ${u.is_active ? 'success' : 'neutral'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
      </tr>
    `
      )
      .join('');
  },

  async openAddUserModal() {
    const roles = await window.api.auth.listRoles();

    const bodyHtml = `
      <form id="new-user-form">
        <div class="form-grid" style="grid-template-columns: 1fr 1fr;">
          <div class="form-group">
            <label class="form-label">Username *:</label>
            <input type="text" id="u-username" class="form-control" placeholder="e.g. rahul_pharma" required>
          </div>
          <div class="form-group">
            <label class="form-label">Temporary Password *:</label>
            <input type="password" id="u-pass" class="form-control" placeholder="Min 6 characters" required>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Full Name *:</label>
          <input type="text" id="u-fullname" class="form-control" placeholder="e.g. Rahul Sharma" required>
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
            <input type="text" id="u-phone" class="form-control" placeholder="10 digits">
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button class="btn btn-primary" id="btn-save-user">Create User Account</button>
      <button class="btn btn-secondary" onclick="MediStock.closeModal()">Cancel</button>
    `;

    MediStock.showModal('Add System User & Assign Role', bodyHtml, footerHtml, 'md');

    document.getElementById('btn-save-user').addEventListener('click', async () => {
      const username = document.getElementById('u-username').value.trim();
      const password = document.getElementById('u-pass').value;
      const fullName = document.getElementById('u-fullname').value.trim();
      const roleId = Number(document.getElementById('u-role').value);
      const phone = document.getElementById('u-phone').value.trim();

      if (!username || !password || !fullName || !roleId) {
        MediStock.toast('Please fill all required fields', 'warning');
        return;
      }

      try {
        await window.api.auth.createUser({
          username,
          password,
          fullName,
          roleId,
          phone,
        });

        MediStock.closeModal();
        MediStock.toast(`User "${username}" created successfully!`, 'success');
        this.loadUsers();
      } catch (err) {
        MediStock.toast(`User creation error: ${err.message}`, 'error');
      }
    });
  },
};
