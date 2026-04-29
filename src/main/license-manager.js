const Store = require('electron-store');
const CryptoJS = require('crypto-js');
const axios = require('axios');
const { machineIdSync } = require('node-machine-id');
const log = require('electron-log');

const LICENSE_SECRET = 'gms-license-secret-2024-xK9p';
const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || 'http://localhost:3001';

const store = new Store({
  encryptionKey: 'gms-lic-enc-key-2024',
  name: 'license-data'
});

function getMachineId() {
  try {
    return machineIdSync({ original: true });
  } catch {
    return 'unknown-machine';
  }
}

function encryptData(data) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), LICENSE_SECRET).toString();
}

function decryptData(ciphertext) {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, LICENSE_SECRET);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch {
    return null;
  }
}

async function validateLicense(licenseKey) {
  const machineId = getMachineId();

  try {
    const response = await axios.post(`${LICENSE_SERVER_URL}/api/license/validate`, {
      licenseKey,
      machineId
    }, { timeout: 10000 });

    const { valid, message, expiresAt, plan } = response.data;

    if (valid) {
      const licenseData = {
        key: licenseKey,
        machineId,
        expiresAt,
        plan,
        activatedAt: Date.now(),
        lastValidated: Date.now()
      };
      store.set('license', encryptData(licenseData));
      log.info('License validated and stored successfully');
    }

    return { valid, message, expiresAt, plan };
  } catch (err) {
    log.error('License server error:', err.message);

    const cached = getCachedLicense();
    if (cached && isLicenseLocallyValid(cached)) {
      log.info('Using cached license (offline mode)');
      return {
        valid: true,
        message: 'Offline validation (cached)',
        expiresAt: cached.expiresAt,
        plan: cached.plan,
        offline: true
      };
    }

    return { valid: false, message: 'Unable to validate license. Check internet connection.' };
  }
}

async function checkStoredLicense() {
  const cached = getCachedLicense();
  if (!cached) return false;

  if (!isLicenseLocallyValid(cached)) {
    log.warn('Stored license expired');
    return false;
  }

  const hoursSinceValidation = (Date.now() - cached.lastValidated) / (1000 * 60 * 60);

  if (hoursSinceValidation < 24) {
    log.info('License valid (last checked < 24h ago)');
    return true;
  }

  try {
    const result = await validateLicense(cached.key);
    return result.valid;
  } catch {
    return isLicenseLocallyValid(cached);
  }
}

function getCachedLicense() {
  const encrypted = store.get('license');
  if (!encrypted) return null;
  return decryptData(encrypted);
}

function isLicenseLocallyValid(licenseData) {
  if (!licenseData || !licenseData.key) return false;
  if (!licenseData.expiresAt) return true;
  return new Date(licenseData.expiresAt) > new Date();
}

function getLicenseInfo() {
  const cached = getCachedLicense();
  if (!cached) return { valid: false };
  return {
    valid: isLicenseLocallyValid(cached),
    key: cached.key ? `${cached.key.substring(0, 8)}${'*'.repeat(Math.max(0, cached.key.length - 8))}` : '',
    plan: cached.plan,
    expiresAt: cached.expiresAt,
    activatedAt: cached.activatedAt,
    machineId: cached.machineId
  };
}

async function deactivateLicense() {
  const cached = getCachedLicense();
  if (!cached) return { success: false, message: 'No license found' };

  try {
    await axios.post(`${LICENSE_SERVER_URL}/api/license/deactivate`, {
      licenseKey: cached.key,
      machineId: getMachineId()
    }, { timeout: 10000 });
  } catch (err) {
    log.warn('Could not deactivate on server:', err.message);
  }

  store.delete('license');
  return { success: true, message: 'License deactivated' };
}

module.exports = {
  validateLicense,
  checkStoredLicense,
  getLicenseInfo,
  deactivateLicense
};
