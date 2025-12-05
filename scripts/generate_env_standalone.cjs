const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

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
const secretKeyBase = crypto.randomBytes(64).toString('hex');

// Generate tokens
const anonPayload = { role: 'anon', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 3153600000 };
const servicePayload = { role: 'service_role', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 3153600000 };

const anonKey = sign(anonPayload, jwtSecret);
const serviceRoleKey = sign(servicePayload, jwtSecret);

const content = `# Domain Configuration
DOMAIN=whtshtg.lkdevs.com

# Postgres Configuration
POSTGRES_PASSWORD=${postgresPassword}

# JWT Configuration
# Generate a secure random string (at least 32 chars)
JWT_SECRET=${jwtSecret}

# Supabase Keys
ANON_KEY=${anonKey}
SERVICE_ROLE_KEY=${serviceRoleKey}

# Realtime Configuration
REALTIME_DB_ENC_KEY=${realtimeKey}
SECRET_KEY_BASE=${secretKeyBase}

# SMTP Configuration (Optional but recommended for Production)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=your-user
# SMTP_PASS=your-password
# SMTP_ADMIN_EMAIL=admin@your-domain.com
`;

fs.writeFileSync(envPath, content);
console.log('.env file created successfully at', envPath);
