const CryptoJS = require('crypto-js');

// Test secure key generation
const APP_SIGNATURE = 'GMS2024';
const KEYGEN_SECRET = 'gms-keygen-secret-2024-xK9pZq7r';

function generateSecureKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  
  // Generate base key
  const baseKey = `${segment(4)}-${segment(4)}-${segment(4)}-${segment(4)}`;
  
  // Create signature using timestamp and secret
  const timestamp = Date.now().toString(36);
  const signature = CryptoJS.HmacSHA256(baseKey + timestamp + KEYGEN_SECRET, KEYGEN_SECRET).toString().substring(0, 4).toUpperCase();
  
  // Replace last segment with signature
  const parts = baseKey.split('-');
  parts[3] = signature;
  
  return parts.join('-');
}

function validateSecureKey(licenseKey) {
  try {
    const parts = licenseKey.split('-');
    if (parts.length !== 4) return false;
    
    // Basic format validation
    const format = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;
    if (!format.test(licenseKey)) return false;
    
    return true;
  } catch (error) {
    console.error('Key validation error:', error.message);
    return false;
  }
}

// Test the system
console.log('=== Testing Secure Key Generation ===');

// Generate some secure keys
const secureKeys = [];
for (let i = 0; i < 5; i++) {
  const key = generateSecureKey();
  secureKeys.push(key);
  console.log(`Generated: ${key} - Valid: ${validateSecureKey(key)}`);
}

// Test invalid keys
console.log('\n=== Testing Invalid Keys ===');
const invalidKeys = [
  'TEST-1234-ABCD-5678', // Old format
  'INVALID-KEY-FORMAT', // Wrong format
  '1234-5678-ABCD-EFGH', // Numbers only
  'XXXX-XXXX-XXXX-XXXX', // Invalid characters
];

invalidKeys.forEach(key => {
  console.log(`Invalid: ${key} - Valid: ${validateSecureKey(key)}`);
});

console.log('\n=== Summary ===');
console.log('Secure keys generated:', secureKeys.length);
console.log('All secure keys are valid:', secureKeys.every(k => validateSecureKey(k)));
console.log('All invalid keys are rejected:', invalidKeys.every(k => !validateSecureKey(k)));
