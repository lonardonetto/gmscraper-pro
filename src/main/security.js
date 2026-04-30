const CryptoJS = require('crypto-js');
const { exec } = require('child_process');

// Anti-tampering and runtime encryption
class SecurityManager {
  constructor() {
    this.encryptionKey = 'gms-runtime-sec-2024-xK9pZq7r';
    this.integrityHash = null;
    this.licenseServerUrl = process.env.LICENSE_SERVER_URL || 'https://testing.crmpk.com';
    this.initTime = Date.now();
  }

  // Runtime encryption for sensitive data
  encrypt(text) {
    try {
      return CryptoJS.AES.encrypt(text, this.encryptionKey).toString();
    } catch (error) {
      return null;
    }
  }

  decrypt(ciphertext) {
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, this.encryptionKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      return null;
    }
  }

  // Anti-debugging protection
  antiDebug() {
    // Disable developer tools
    if (typeof window !== 'undefined') {
      setInterval(() => {
        const devtools = /./;
        devtools.toString = () => {
          throw new Error('DevTools detected');
        };
      }, 1000);
    }

    // Check for debugging environment
    const checkDebugger = () => {
      const start = Date.now();
      debugger;
      if (Date.now() - start > 100) {
        this.tamperDetected('Debugger detected');
      }
    };

    setInterval(checkDebugger, 5000);
  }

  // Integrity check
  async verifyIntegrity() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Calculate hash of main files
      const mainPath = path.join(__dirname, 'main.js');
      const licenseManagerPath = path.join(__dirname, 'license-manager.js');
      
      if (fs.existsSync(mainPath) && fs.existsSync(licenseManagerPath)) {
        const mainContent = fs.readFileSync(mainPath, 'utf8');
        const licenseContent = fs.readFileSync(licenseManagerPath, 'utf8');
        
        // Simple integrity check
        const combinedHash = CryptoJS.SHA256(mainContent + licenseContent).toString();
        
        if (this.integrityHash && this.integrityHash !== combinedHash) {
          this.tamperDetected('File integrity compromised');
        }
        
        this.integrityHash = combinedHash;
        return true;
      }
    } catch (error) {
      console.error('Integrity check failed:', error.message);
    }
    return false;
  }

  // Check for common cracking tools
  antiCracking() {
    const suspiciousProcesses = [
      'x64dbg', 'ollydbg', 'ida', 'windbg', 'cheatengine',
      'processhacker', 'procmon', 'wireshark', 'fiddler'
    ];

    const checkSuspiciousProcesses = () => {
      if (process.platform === 'win32') {
        suspiciousProcesses.forEach(process => {
          exec(`tasklist /FI "IMAGENAME eq ${process}.exe" 2>NUL`, (error, stdout) => {
            if (stdout.includes(process)) {
              this.tamperDetected(`Suspicious process detected: ${process}`);
            }
          });
        });
      }
    };

    setInterval(checkSuspiciousProcesses, 10000);
  }

  // Tamper detection response
  tamperDetected(reason) {
    console.error('SECURITY BREACH DETECTED:', reason);
    
    // Encrypt sensitive data before exit
    const sensitiveData = {
      reason,
      timestamp: Date.now(),
      machineId: this.getMachineId()
    };
    
    const encryptedReport = this.encrypt(JSON.stringify(sensitiveData));
    
    // Send to server if possible
    this.reportTampering(encryptedReport);
    
    // Exit application
    if (typeof process !== 'undefined') {
      process.exit(1);
    }
  }

  // Report tampering attempts
  async reportTampering(encryptedReport) {
    try {
      const axios = require('axios');
      await axios.post(`${this.licenseServerUrl}/api/security/report`, {
        report: encryptedReport,
        app: 'gmscraper-pro'
      }, { timeout: 5000 });
    } catch (error) {
      // Silent fail for security reporting
    }
  }

  // Get machine ID for tracking
  getMachineId() {
    try {
      const { machineIdSync } = require('node-machine-id');
      return machineIdSync({ original: true });
    } catch {
      return 'unknown';
    }
  }

  // Runtime license validation
  async validateRuntimeLicense() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Check if license file exists and is valid
      const licensePath = path.join(__dirname, '..', '..', 'license.dat');
      if (fs.existsSync(licensePath)) {
        const licenseData = fs.readFileSync(licensePath, 'utf8');
        const decrypted = this.decrypt(licenseData);
        
        if (decrypted) {
          const license = JSON.parse(decrypted);
          const now = Date.now();
          
          // Check if license is still valid
          if (license.expiresAt && license.expiresAt < now) {
            this.tamperDetected('License expired');
            return false;
          }
          
          // Check machine binding
          if (license.machineId !== this.getMachineId()) {
            this.tamperDetected('License machine mismatch');
            return false;
          }
          
          return true;
        }
      }
    } catch (error) {
      console.error('Runtime license validation failed:', error.message);
    }
    
    return false;
  }

  // Initialize all security measures
  init() {
    // Start anti-debugging
    this.antiDebug();
    
    // Start anti-cracking
    this.antiCracking();
    
    // Verify integrity
    this.verifyIntegrity();
    
    // Validate runtime license
    this.validateRuntimeLicense();
    
    // Periodic integrity checks
    setInterval(() => {
      this.verifyIntegrity();
      this.validateRuntimeLicense();
    }, 30000); // Every 30 seconds
  }
}

// Initialize security
const security = new SecurityManager();

// Export for use in other modules
module.exports = {
  SecurityManager,
  security,
  encrypt: (text) => security.encrypt(text),
  decrypt: (ciphertext) => security.decrypt(ciphertext)
};
