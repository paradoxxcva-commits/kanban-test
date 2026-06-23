/**
 * Генератор API-ключей для Self-hosted Supabase
 *
 * Использование:
 *   node generate-keys.js [JWT_SECRET]
 *
 * Если JWT_SECRET не передан, берёт из .env
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function createJWT(secret, payload) {
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64url(Buffer.from(JSON.stringify(payload)));
  const signature = base64url(
    crypto.createHmac('sha256', secret).update(header + '.' + body).digest()
  );
  return `${header}.${body}.${signature}`;
}

// Read JWT_SECRET from .env or argument
let jwtSecret = process.argv[2];
if (!jwtSecret) {
  const envPath = path.join(__dirname, '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/^JWT_SECRET=(.+)$/m);
  if (!match) {
    console.error('JWT_SECRET не найден в .env. Передайте как аргумент или добавьте в .env');
    process.exit(1);
  }
  jwtSecret = match[1].trim();
}

const now = Math.floor(Date.now() / 1000);
const exp = now + 10 * 365 * 24 * 3600; // 10 лет

const anonKey = createJWT(jwtSecret, {
  role: 'anon',
  iss: 'supabase',
  iat: now,
  exp: exp,
});

const serviceRoleKey = createJWT(jwtSecret, {
  role: 'service_role',
  iss: 'supabase',
  iat: now,
  exp: exp,
});

// Update .env
const envPath = path.join(__dirname, '.env');
let env = fs.readFileSync(envPath, 'utf-8');
env = env.replace(/^ANON_KEY=.*$/m, `ANON_KEY=${anonKey}`);
env = env.replace(/^SERVICE_ROLE_KEY=.*$/m, `SERVICE_ROLE_KEY=${serviceRoleKey}`);
fs.writeFileSync(envPath, env);

console.log('API-ключи сгенерированы и записаны в .env:\n');
console.log(`ANON_KEY=${anonKey}`);
console.log(`SERVICE_ROLE_KEY=${serviceRoleKey}`);
console.log('\nКлючи обновлены в файле .env');
