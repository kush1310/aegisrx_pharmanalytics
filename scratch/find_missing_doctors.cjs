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

    // 1. Fetch doctors list from /api/doctors
    const fetchJson = (path) => {
      return new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: 3001,
          path,
          method: 'GET',
          headers
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        });
        req.on('error', reject);
        req.end();
      });
    };

    const docListRes = await fetchJson('/api/doctors');
    const bizRes = await fetchJson('/api/excel/doctor-business?uploadId=2');

    const dbDocIds = new Set(docListRes.data.map(d => String(d.id)));
    console.log(`Master doctor list count: ${dbDocIds.size}`);

    console.log('Checking active doctors in uploadId = 2:');
    let missingSum = 0;
    let missingCount = 0;
    bizRes.data.forEach((group) => {
      if (group.doctorId !== null) {
        const idStr = String(group.doctorId);
        if (!dbDocIds.has(idStr)) {
          console.log(`Missing Doctor in master list: ${group.doctorName} (ID: ${group.doctorId}), Grand Total: ${group.grandTotal}`);
          missingSum += group.grandTotal;
          missingCount++;
        }
      }
    });

    console.log(`\nTotal Missing Doctors: ${missingCount}`);
    console.log(`Total Missing Grand Total: ${missingSum}`);

  } catch (err) {
    console.error('Error:', err);
  }
}

run();
