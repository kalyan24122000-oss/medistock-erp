// services/backup-service.js
// Safe SQLite Online Backup, Checksum Verification, and Atomic Recovery Engine

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { getDatabase, closeDatabase, getDatabasePath } = require('../database/db');

/**
 * Creates a safe, consistent SQLite backup using better-sqlite3's online backup API.
 * Calculates SHA-256 checksum and logs entry into backup_history.
 *
 * @param {string} [backupType='MANUAL'] - 'MANUAL', 'SCHEDULED', 'PRE_RESTORE'
 * @param {number} [userId]
 * @param {string} [customDestDir]
 */
async function createBackup(backupType = 'MANUAL', userId = null, customDestDir = null) {
  const db = getDatabase();
  const dbPath = getDatabasePath();

  const backupDir = customDestDir || path.join(path.dirname(dbPath), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `medistock_backup_${backupType.toLowerCase()}_${timestamp}.db`;
  const destPath = path.join(backupDir, fileName);

  try {
    // Checkpoint WAL first to flush committed transactions
    db.pragma('wal_checkpoint(PASSIVE)');

    // Execute online backup safely without locking reads
    await db.backup(destPath);

    // Compute SHA-256 Checksum
    const fileBuffer = fs.readFileSync(destPath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const checksum = hashSum.digest('hex');
    const fileSize = fs.statSync(destPath).size;

    // Record in backup_history table
    db.prepare(`
      INSERT INTO backup_history (
        file_name, file_path, file_size_bytes, sha256_checksum, backup_type, status, user_id
      ) VALUES (
        ?, ?, ?, ?, ?, 'SUCCESS', ?
      )
    `).run(fileName, destPath, fileSize, checksum, backupType, userId || null);

    return {
      success: true,
      fileName,
      filePath: destPath,
      fileSizeBytes: fileSize,
      checksum,
      backupType,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('Backup creation failed:', err);
    try {
      db.prepare(`
        INSERT INTO backup_history (
          file_name, file_path, file_size_bytes, sha256_checksum, backup_type, status, error_message, user_id
        ) VALUES (
          ?, ?, 0, '', ?, 'FAILED', ?, ?
        )
      `).run(fileName, destPath, backupType, err.message, userId || null);
    } catch (e) {
      // Ignore secondary error
    }
    throw new Error(`Backup failed: ${err.message}`);
  }
}

/**
 * List past backup records.
 */
function getBackupHistory() {
  const db = getDatabase();
  return db.prepare(`
    SELECT bh.*, u.full_name as created_by_name
    FROM backup_history bh
    LEFT JOIN users u ON bh.user_id = u.id
    ORDER BY bh.id DESC
    LIMIT 50
  `).all();
}

/**
 * Inspect and verify a backup file before restoring.
 * Checks SQLite magic header, integrity pragma, and summaries.
 *
 * @param {string} filePath
 */
function previewBackup(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file not found at ${filePath}`);
  }

  // Verify SQLite Magic Header: 'SQLite format 3\000'
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(16);
  fs.readSync(fd, buffer, 0, 16, 0);
  fs.closeSync(fd);

  const header = buffer.toString('utf8', 0, 15);
  if (header !== 'SQLite format 3') {
    throw new Error('Invalid backup file: Not a valid SQLite database.');
  }

  // Open temporary read-only connection to inspect database
  const tempDb = new Database(filePath, { readonly: true });
  try {
    const integrityCheck = tempDb.pragma('integrity_check');
    if (!integrityCheck || integrityCheck[0]?.integrity_check !== 'ok') {
      throw new Error('Integrity check failed on backup file.');
    }

    const company = tempDb.prepare('SELECT name, gstin FROM companies LIMIT 1').get() || {};
    const productCount = tempDb.prepare('SELECT COUNT(1) as cnt FROM products').get().cnt;
    const batchCount = tempDb.prepare('SELECT COUNT(1) as cnt FROM batches').get().cnt;
    const salesCount = tempDb.prepare('SELECT COUNT(1) as cnt FROM sales_invoices').get().cnt;
    const accountsCount = tempDb.prepare('SELECT COUNT(1) as cnt FROM accounts').get().cnt;

    // Compute checksum
    const fileData = fs.readFileSync(filePath);
    const sha256 = crypto.createHash('sha256').update(fileData).digest('hex');
    const size = fs.statSync(filePath).size;

    return {
      isValid: true,
      filePath,
      fileSize: size,
      sha256,
      companyName: company.name || 'Unknown Company',
      companyGstin: company.gstin || 'N/A',
      productCount,
      batchCount,
      salesCount,
      accountsCount,
    };
  } finally {
    tempDb.close();
  }
}

/**
 * Restores database from a verified backup.
 * Takes a safety pre-restore backup of the current database before replacing!
 *
 * @param {string} backupFilePath
 * @param {number} [userId]
 */
async function restoreDatabase(backupFilePath, userId = null) {
  // 1. Verify backup file first
  const preview = previewBackup(backupFilePath);
  if (!preview.isValid) {
    throw new Error('Cannot restore an invalid backup file.');
  }

  const currentDbPath = getDatabasePath();

  // 2. Take automated PRE_RESTORE backup of active database
  console.log('Taking safety PRE_RESTORE backup of current database...');
  await createBackup('PRE_RESTORE', userId);

  // 3. Close active database connection cleanly
  closeDatabase();

  // 4. Overwrite main DB file with backup file
  fs.copyFileSync(backupFilePath, currentDbPath);

  // Remove stale WAL and SHM files if they exist
  const walPath = `${currentDbPath}-wal`;
  const shmPath = `${currentDbPath}-shm`;
  if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
  if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

  // 5. Re-open connection and verify
  const restoredDb = getDatabase(currentDbPath);
  const check = restoredDb.pragma('integrity_check');
  if (!check || check[0]?.integrity_check !== 'ok') {
    throw new Error('Restored database failed integrity check!');
  }

  return {
    success: true,
    message: 'Database restored and verified successfully.',
    restoredPreview: preview,
  };
}

module.exports = {
  createBackup,
  getBackupHistory,
  previewBackup,
  restoreDatabase,
};
