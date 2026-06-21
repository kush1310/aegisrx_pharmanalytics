const http = require('http');
const jose = require('jose');

console.log('Starting pandas analytics endpoint verification test...');

async function run() {
  try {
    // Generate valid JWT token using Jose
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
      
    console.log('JWT Token successfully generated.');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 1. Fetch the uploads list to find a valid uploadId
    const optionsHistory = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/excel/history',
      method: 'GET',
      headers: headers
    };

    const reqHistory = http.request(optionsHistory, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (!response.success || !response.data) {
            console.error('Failed to fetch history:', response);
            process.exit(1);
          }
          
          const salesUploads = response.data;
          console.log(`Found ${salesUploads.length} uploads in history.`);
          
          let uploadId = '';
          if (salesUploads.length > 0) {
            uploadId = salesUploads[0].id;
            console.log(`Using first uploadId: ${uploadId} (${salesUploads[0].fileName})`);
          } else {
            console.warn('No uploads found in database. Querying pandas-analytics with empty uploadId.');
          }
          
          // 2. Fetch the pandas-analytics data
          const optionsAnalytics = {
            hostname: 'localhost',
            port: 3001,
            path: `/api/excel/pandas-analytics?uploadId=${uploadId}`,
            method: 'GET',
            headers: headers
          };
          
          console.log(`Fetching pandas-analytics for uploadId: ${uploadId}`);
          
          const reqAnalytics = http.request(optionsAnalytics, (analyticsRes) => {
            let analyticsData = '';
            analyticsRes.on('data', chunk => analyticsData += chunk);
            analyticsRes.on('end', () => {
              try {
                const result = JSON.parse(analyticsData);
                if (!result.success) {
                  console.error('API responded with success = false:', result.error);
                  process.exit(1);
                }
                
                console.log('\n--- VERIFICATION PASSED SUCCESSFULLY ---');
                console.log(`Success: ${result.success}`);
                console.log(`Top 10 Pharmacies length: ${result.data.topPharmacies?.length || 0}`);
                if (result.data.topPharmacies?.length > 0) {
                  console.log('First Pharmacy sample:', result.data.topPharmacies[0]);
                }
                
                console.log(`Top 10 Doctors length: ${result.data.topDoctors?.length || 0}`);
                if (result.data.topDoctors?.length > 0) {
                  console.log('First Doctor sample:', result.data.topDoctors[0]);
                }
                
                console.log(`Top 10 Products length: ${result.data.topProducts?.length || 0}`);
                if (result.data.topProducts?.length > 0) {
                  console.log('First Product sample:', result.data.topProducts[0]);
                }
                
                console.log(`Doctor Ratios length: ${result.data.doctorRatio?.length || 0}`);
                if (result.data.doctorRatio?.length > 0) {
                  console.log('First Doctor Ratio sample:', result.data.doctorRatio[0]);
                }
                
                console.log('-----------------------------------------\n');
                process.exit(0);
              } catch (e) {
                console.error('Failed to parse analytics JSON:', analyticsData);
                process.exit(1);
              }
            });
          });
          
          reqAnalytics.on('error', (e) => {
            console.error('Failed to reach pandas-analytics endpoint:', e.message);
            process.exit(1);
          });
          
          reqAnalytics.end();
          
        } catch (e) {
          console.error('Failed to parse history JSON:', data);
          process.exit(1);
        }
      });
    });

    reqHistory.on('error', (e) => {
      console.error('Failed to reach history endpoint:', e.message);
      process.exit(1);
    });

    reqHistory.end();

  } catch (err) {
    console.error('Failed to run test:', err);
    process.exit(1);
  }
}

run();
