import crypto from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs <password>');
  process.exit(1);
}
const salt = crypto.randomBytes(16);
const digest = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
console.log(`${salt.toString('base64')}.${digest.toString('base64')}`);
