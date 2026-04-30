const axios = require('axios');
const { machineIdSync } = require('node-machine-id');

// Test scraper app license activation with various scenarios
const LICENSE_SERVER_URL = 'https://testing.crmpk.com';

async function testScraperActivation() {
  try {
    console.log('Testing scraper app license activation...');
    console.log('Server URL:', LICENSE_SERVER_URL);
    
    // Get machine ID (same as scraper app)
    let machineId;
    try {
      machineId = machineIdSync({ original: true });
    } catch {
      machineId = 'test-scraper-machine';
    }
    
    console.log('Machine ID:', machineId);
    
    // Test 1: Try with the license key you mentioned
    console.log('\n=== Test 1: License key 2Q5U-CMG4-S8W7-AV4J ===');
    try {
      const response1 = await axios.post(`${LICENSE_SERVER_URL}/api/license/validate`, {
        licenseKey: '2Q5U-CMG4-S8W7-AV4J',
        machineId: machineId
      }, { timeout: 10000 });
      
      console.log('SUCCESS:', response1.data);
    } catch (error1) {
      console.log('ERROR:', error1.response?.data || error1.message);
    }
    
    // Test 2: Try with a known good license
    console.log('\n=== Test 2: Known good license 5YE2-URLC-SF8Y-BFQE ===');
    try {
      const response2 = await axios.post(`${LICENSE_SERVER_URL}/api/license/validate`, {
        licenseKey: '5YE2-URLC-SF8Y-BFQE',
        machineId: machineId
      }, { timeout: 10000 });
      
      console.log('SUCCESS:', response2.data);
    } catch (error2) {
      console.log('ERROR:', error2.response?.data || error2.message);
    }
    
    // Test 3: Try with an invalid license
    console.log('\n=== Test 3: Invalid license TEST-1234-ABCD-5678 ===');
    try {
      const response3 = await axios.post(`${LICENSE_SERVER_URL}/api/license/validate`, {
        licenseKey: 'TEST-1234-ABCD-5678',
        machineId: machineId
      }, { timeout: 10000 });
      
      console.log('SUCCESS:', response3.data);
    } catch (error3) {
      console.log('ERROR:', error3.response?.data || error3.message);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testScraperActivation();
