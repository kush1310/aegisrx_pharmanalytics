const http = require('http');
const jose = require('jose');

async function run() {
  try {
    const secret = new TextEncoder().encode('suratpharma_jwt_secret_2026_secure');
    const token = await new jose.SignJWT({ 
      sub: '1', 
      role: 'ADMIN', 
      username: 'admin@suratpharma.com',
      email: 'admin@suratpharma.com'
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('suratpharma')
      .setExpirationTime('12h')
      .sign(secret);
      
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/excel/doctor-business?uploadId=2',
      method: 'GET',
      headers: headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('Success:', response.success);
          console.log('Doctor groups count:', response.data?.length);
          if (response.data) {
            response.data.forEach((group, idx) => {
              console.log(`${idx + 1}. Doctor: ${group.doctorName} (ID: ${group.doctorId}), Grand Total: ${group.grandTotal}, Pharmacies Count: ${group.pharmacies?.length}`);
            });
          }
        } catch (e) {
          console.error('Failed to parse response:', data);
        }
      });
    });

    req.on('error', (e) => {
      console.error('Request failed:', e.message);
    });

    req.end();
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
