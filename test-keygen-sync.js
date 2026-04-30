const axios = require('axios');

const LICENSE_SERVER_URL = 'https://testing.crmpk.com';
const ADMIN_SECRET = '15619619618961689196198ad98s41ad96asd96asda';

async function testSync() {
  try {
    console.log('Testing keygen sync to live server...');
    console.log('Server URL:', LICENSE_SERVER_URL);
    console.log('Admin Secret:', ADMIN_SECRET);
    
    const response = await axios.post(`${LICENSE_SERVER_URL}/api/admin/create-license`, {
      plan: 'pro',
      maxActivations: 1,
      expiresAt: null,
      notes: 'Test sync from keygen'
    }, {
      headers: {
        'X-Admin-Secret': ADMIN_SECRET,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('SUCCESS:', response.data);
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

testSync().then(result => {
  console.log('Test result:', result);
}).catch(err => {
  console.error('Test failed:', err);
});
