const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const envExamplePath = path.join(__dirname, '../.env.prod.example');
const envPath = path.join(__dirname, '../.env');

function sign(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret)
    .update(encodedHeader + '.' + encodedPayload)
    .digest('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Generate random secret
const jwtSecret = crypto.randomBytes(32).toString('hex');
const postgresPassword = crypto.randomBytes(16).toString('hex');
const realtimeKey = crypto.randomBytes(32).toString('hex');

// Generate tokens
const anonPayload = { role: 'anon', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 3153600000 };
const servicePayload = { role: 'service_role', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 3153600000 };

const anonKey = sign(anonPayload, jwtSecret);
const serviceRoleKey = sign(servicePayload, jwtSecret);

console.log('Generated Secrets:');
console.log('JWT Secret:', jwtSecret);
console.log('Postgres Password:', postgresPassword);

// Read example
let content = fs.readFileSync(envExamplePath, 'utf8');

// Replace values
content = content.replace(/^DOMAIN=.*/m, 'DOMAIN=localhost');
content = content.replace(/^POSTGRES_PASSWORD=.*/m, `POSTGRES_PASSWORD=${postgresPassword}`);
content = content.replace(/^JWT_SECRET=.*/m, `JWT_SECRET=${jwtSecret}`);
content = content.replace(/^ANON_KEY=.*/m, `ANON_KEY=${anonKey}`);
content = content.replace(/^SERVICE_ROLE_KEY=.*/m, `SERVICE_ROLE_KEY=${serviceRoleKey}`);
content = content.replace(/^REALTIME_DB_ENC_KEY=.*/m, `REALTIME_DB_ENC_KEY=${realtimeKey}`);

// Write .env
fs.writeFileSync(envPath, content);
console.log('.env file created successfully at', envPath);
