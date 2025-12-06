const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const secret = process.env.JWT_SECRET;
const anonKey = process.env.ANON_KEY;
const serviceKey = process.env.SERVICE_ROLE_KEY;

console.log('Checking JWT configuration...');
console.log(`JWT_SECRET: ${secret ? 'Present' : 'Missing'}`);
console.log(`ANON_KEY: ${anonKey ? 'Present' : 'Missing'}`);
console.log(`SERVICE_ROLE_KEY: ${serviceKey ? 'Present' : 'Missing'}`);

if (!secret) {
  console.error('Error: JWT_SECRET is missing from .env');
  process.exit(1);
}

try {
  if (anonKey) {
    const decodedAnon = jwt.verify(anonKey, secret);
    console.log('✅ ANON_KEY is valid and signed with JWT_SECRET');
    console.log('   Role:', decodedAnon.role);
  } else {
    console.warn('⚠️ ANON_KEY is missing');
  }
} catch (err) {
  console.error('❌ ANON_KEY verification failed:', err.message);
}

try {
  if (serviceKey) {
    const decodedService = jwt.verify(serviceKey, secret);
    console.log('✅ SERVICE_ROLE_KEY is valid and signed with JWT_SECRET');
    console.log('   Role:', decodedService.role);
  } else {
    console.warn('⚠️ SERVICE_ROLE_KEY is missing');
  }
} catch (err) {
  console.error('❌ SERVICE_ROLE_KEY verification failed:', err.message);
}
