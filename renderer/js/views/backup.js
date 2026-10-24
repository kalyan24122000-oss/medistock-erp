// renderer/js/views/backup.js
// Safe SQLite Online Backup, SHA-256 Verification & Atomic Restoration

window.MediStockViews = window.MediStockViews || {};

window.MediStockViews.backup = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">💾 Database Backup & Disaster Recovery</div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary btn-sm" id="btn-create-backup-now">Create Backup Now</button>
            <button class="btn btn-danger btn-sm" id="btn-restore-backup-file">Restore from Backup File</button>
          </div>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: var(--radius); margin-bottom: 16px;">
          <h4 style="color: #15803d; font-size: 13px; font-weight: 700;">Safe Online Backup Guarantee:</h4>
          <p style="font-size: 12px; color: #14532d; margin-top: 4px;">
            Uses SQLite's transactional online backup API with WAL checkpointing. Backups can be taken while users continue billing without database locks. Every backup produces a cryptographic SHA-256 integrity hash.
          </p>
        </div>

        <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">Backup History & Integrity Log:</h4>
        <div class="table-container">
          <table class="erp-table">
            <thead>
              <tr>
                <th>Backup Timestamp</th>
                <th>File Name</th>
                <th>Type</th>
                <th class="text-right">File Size</th>
                <th>SHA-256 Integrity Checksum</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="backup-history-tbody">
              <tr><td colspan="6" class="text-center">Loading backup logs...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.bindEvents();
    this.loadHistory();
  },

  bindEvents() {
    document.getElementById('btn-create-backup-now').addEventListener('click', async () => {
      try {
        MediStock.toast('Starting online SQLite backup...', 'info');
        const res = await window.api.backup.createBackup('MANUAL');
        if (res.success) {
          MediStock.toast(`Backup successful! Size: ${(res.fileSizeBytes / 1024).toFixed(1)} KB`, 'success');
          this.loadHistory();
        }
      } catch (err) {
        MediStock.toast(`Backup failed: ${err.message}`, 'error');
      }
    });

    document.getElementById('btn-restore-backup-file').addEventListener('click', async () => {
      try {
        const filePath = await window.api.backup.selectBackupFile();
        if (!filePath) return;

        MediStock.toast('Verifying backup file integrity...', 'info');
        const preview = await window.api.backup.previewBackup(filePath);

        const bodyHtml = `
          <div>
            <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 10px; border-radius: var(--radius); margin-bottom: 12px;">
              <strong style="color: #b91c1c;">CAUTION: Database Restoration</strong>
              <p style="font-size: 12px; color: #991b1b; margin-top: 2px;">
                Restoring will replace the current active database with this backup. A safety PRE_RESTORE backup will be created automatically before replacement.
              </p>
            </div>

            <table class="erp-table">
              <tbody>
                <tr><td><strong>Company:</strong></td><td>${preview.companyName} (${preview.companyGstin})</td></tr>
                <tr><td><strong>File Path:</strong></td><td style="font-size: 11px;">${preview.filePath}</td></tr>
                <tr><td><strong>File Size:</strong></td><td>${(preview.fileSize / 1024).toFixed(1)} KB</td></tr>
                <tr><td><strong>SHA-256:</strong></td><td class="font-mono" style="font-size: 10px;">${preview.sha256}</td></tr>
                <tr><td><strong>Total Medicines:</strong></td><td><strong>${preview.productCount}</strong></td></tr>
                <tr><td><strong>Total Batches:</strong></td><td><strong>${preview.batchCount}</strong></td></tr>
                <tr><td><strong>Total Sales Invoices:</strong></td><td><strong>${preview.salesCount}</strong></td></tr>
                <tr><td><strong>Chart of Accounts:</strong></td><td><strong>${preview.accountsCount}</strong></td></tr>
                <tr><td><strong>Integrity Status:</strong></td><td><span class="badge success">PRAGMA integrity_check === OK</span></td></tr>
              </tbody>
            </table>
          </div>
        `;

        const footerHtml = `
          <button class="btn btn-danger" id="btn-confirm-restore-now">Yes, Confirm Restoration</button>
          <button class="btn btn-secondary" onclick="MediStock.closeModal()">Cancel</button>
        `;

        MediStock.showModal('Confirm Database Restoration', bodyHtml, footerHtml, 'lg');

        document.getElementById('btn-confirm-restore-now').addEventListener('click', async () => {
          MediStock.closeModal();
          MediStock.toast('Restoring database from verified backup...', 'info');
          try {
            const rest = await window.api.backup.restoreDatabase(filePath);
            if (rest.success) {
              MediStock.toast('Database restored and verified! Reloading system data...', 'success');
              setTimeout(() => {
                MediStock.navigate('dashboard');
              }, 1000);
            }
          } catch (e) {
            MediStock.toast(`Restore Error: ${e.message}`, 'error');
          }
        });
      } catch (err) {
        MediStock.toast(`Backup verification failed: ${err.message}`, 'error');
      }
    });
  },

  async loadHistory() {
    const tbody = document.getElementById('backup-history-tbody');
    const logs = await window.api.backup.getHistory();

    if (!logs || logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 24px; color: var(--text-muted);">No backup history recorded yet. Click "Create Backup Now" to make your first backup!</td></tr>`;
      return;
    }

    tbody.innerHTML = logs
      .map(
        (l) => `
      <tr>
        <td>${l.created_at}</td>
        <td><strong>${l.file_name}</strong></td>
        <td><span class="badge ${l.backup_type === 'PRE_RESTORE' ? 'warning' : 'info'}">${l.backup_type}</span></td>
        <td class="text-right font-mono">${(l.file_size_bytes / 1024).toFixed(1)} KB</td>
        <td class="font-mono" style="font-size: 10.5px;">${l.sha256_checksum.slice(0, 16)}...${l.sha256_checksum.slice(-8)}</td>
        <td><span class="badge ${l.status === 'SUCCESS' ? 'success' : 'danger'}">${l.status}</span></td>
      </tr>
    `
      )
      .join('');
  },
};
