// backend/reset-password.js
// Utility script to change or reset the SuperAdmin Master Password

const path = require('path');
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { getLicenseDatabase } = require('./db');

async function main() {
  const db = getLicenseDatabase();

  const args = process.argv.slice(2);
  let username = args[0];
  let newPassword = args[1];

  if (!username || !newPassword) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

    console.log('\n======================================================');
    console.log('       PharmaDesk SuperAdmin Password Utility         ');
    console.log('======================================================\n');

    if (!username) {
      username = await question('Enter Admin Username [default: superadmin]: ');
      username = username.trim() || 'superadmin';
    }

    if (!newPassword) {
      newPassword = await question(`Enter New Password for "${username}": `);
      newPassword = newPassword.trim();
    }

    rl.close();
  }

  if (!newPassword || newPassword.length < 6) {
    console.error('\n❌ Error: Password must be at least 6 characters long.\n');
    process.exit(1);
  }

  const admin = db.prepare('SELECT id, username, full_name FROM admins WHERE username = ?').get(username);
  if (!admin) {
    console.error(`\n❌ Error: Admin user "${username}" was not found in the license database.`);
    const existing = db.prepare('SELECT username FROM admins').all();
    console.log('Existing admins:', existing.map(a => a.username).join(', '));
    process.exit(1);
  }

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(newPassword, salt);

  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, admin.id);

  console.log('\n======================================================');
  console.log(`✅ SUCCESS: Master Password for "${admin.username}" has been updated!`);
  console.log('   You can now log in to the SuperAdmin console and Admin Panel');
  console.log('   with your new credentials.');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('Failed to reset password:', err);
  process.exit(1);
});
