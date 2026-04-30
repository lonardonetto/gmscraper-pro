const axios = require('axios');
const { machineIdSync } = require('node-machine-id');

// Test scraper app license validation with live server
const LICENSE_SERVER_URL = 'https://testing.crmpk.com';

async function testScraperLicenseValidation() {
  try {
    console.log('Testing scraper app license validation with live server...');
    console.log('Server URL:', LICENSE_SERVER_URL);
    
    // Get machine ID (same as scraper app)
    let machineId;
    try {
      machineId = machineIdSync({ original: true });
    } catch {
      machineId = 'test-scraper-machine';
    }
    
    console.log('Machine ID:', machineId);
    
    // Test with a known good license
    const testLicense = '5YE2-URLC-SF8Y-BFQE'; // License we created earlier
    
    console.log('Testing license:', testLicense);
    
    const response = await axios.post(`${LICENSE_SERVER_URL}/api/license/validate`, {
      licenseKey: testLicense,
      machineId: machineId
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('SUCCESS:', response.data);
    
    // Test license deactivation
    console.log('\nTesting license deactivation...');
    const deactivateResponse = await axios.post(`${LICENSE_SERVER_URL}/api/license/deactivate`, {
      licenseKey: testLicense,
      machineId: machineId
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('DEACTIVATE SUCCESS:', deactivateResponse.data);
    
    return { success: true, data: response.data };
  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    }
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    return { success: false, error: error.message };
  }
}

testScraperLicenseValidation().then(result => {
  console.log('\nScraper license validation test result:', result);
}).catch(err => {
  console.error('Test failed:', err);
});
