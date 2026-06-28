const http = require('http');

async function request(path, method, body, cookie = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 4321,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...(cookie ? { 'Cookie': cookie } : {})
        }
      },
      (res) => {
        let rawData = '';
        res.on('data', chunk => { rawData += chunk; });
        res.on('end', () => {
          const setCookie = res.headers['set-cookie'];
          let sessionCookie = cookie;
          if (setCookie) {
            sessionCookie = setCookie.map(c => c.split(';')[0]).join('; ');
          }
          try {
            resolve({ 
              status: res.statusCode, 
              data: JSON.parse(rawData), 
              cookie: sessionCookie 
            });
          } catch (e) {
            resolve({ status: res.statusCode, data: rawData, cookie: sessionCookie });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTest() {
  try {
    console.log("1. Login Nazhir...");
    const loginNazhir = await request('/api/trpc/auth.login', 'POST', { email: 'nazhir@demo.id', password: 'demo1234' });
    if (loginNazhir.status !== 200) throw new Error(`Login Nazhir Gagal: ${JSON.stringify(loginNazhir.data)}`);
    const nazhirCookie = loginNazhir.cookie;

    console.log("2. Ambil Profil Nazhir...");
    const profile = await request('/api/trpc/nazhir.getProfile', 'GET', null, nazhirCookie);
    if (!profile.data.result.data.profile) throw new Error("Profil Nazhir kosong");

    console.log("3. Tambah Aset (DRAFT)...");
    const createAset = await request('/api/trpc/aset.createAset', 'POST', {
      tipeAset: 'TANAH',
      namaAset: 'Tanah Wakaf Coba E2E',
      nilaiEstimasi: 100000000
    }, nazhirCookie);
    const asetId = createAset.data.result.data.id;
    if (!asetId) throw new Error(`Tambah aset gagal: ${JSON.stringify(createAset.data)}`);

    console.log("4. Submit Aset (DRAFT -> SUBMITTED)...");
    const submitAset = await request('/api/trpc/aset.submitAset', 'POST', { id: asetId }, nazhirCookie);
    if (!submitAset.data.result.data.success) throw new Error(`Submit aset gagal: ${JSON.stringify(submitAset.data)}`);

    console.log("5. Login Admin...");
    const loginAdmin = await request('/api/trpc/auth.login', 'POST', { email: 'admin@ani.id', password: 'demo1234' });
    if (loginAdmin.status !== 200) throw new Error(`Login Admin Gagal: ${JSON.stringify(loginAdmin.data)}`);
    const adminCookie = loginAdmin.cookie;

    console.log("6. Admin Baca Aset...");
    const listAset = await request('/api/trpc/aset.getAsetList', 'GET', null, adminCookie);
    const asetFound = listAset.data.result.data.find(a => a.id === asetId);
    if (!asetFound || asetFound.status_approval !== 'SUBMITTED') throw new Error("Aset tidak ditemukan / status salah");

    console.log("7. Admin Approve Aset...");
    const approve = await request('/api/trpc/aset.approveAset', 'POST', {
      id: asetId,
      status: 'APPROVED'
    }, adminCookie);
    if (!approve.data.result.data.success) throw new Error(`Approve aset gagal: ${JSON.stringify(approve.data)}`);

    console.log("SEMUA TEST SUKSES 100%");
    process.exit(0);
  } catch (err) {
    console.error("TEST GAGAL:", err.message);
    process.exit(1);
  }
}

runTest();
