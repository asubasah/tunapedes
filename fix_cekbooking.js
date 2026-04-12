const fs = require('fs');

// ===== FIX 1: 01_main_router.json =====
// Route: Cek Booking Flow - tambahkan device_id ke payload
{
  const p = './n8n-workflows/01_main_router.json';
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = false;
  
  data.nodes.forEach(n => {
    if (n.name === 'Route: Cek Booking Flow') {
      // Ganti payload untuk sertakan device_id dan nomor_wa
      n.parameters.contentType = 'json';
      delete n.parameters.rawContentType;
      delete n.parameters.body;
      n.parameters.sendBody = true;
      n.parameters.specifyBody = 'json';
      n.parameters.jsonBody = `={{ { "nomor_wa": $('Extract: nomor_wa & pesan').item.json.nomor_wa, "pesan": $('Extract: nomor_wa & pesan').item.json.pesan, "device_id": $('Extract: nomor_wa & pesan').item.json.device_id, "cabang_id": $('Extract: nomor_wa & pesan').item.json.cabang_id } }}`;
      changed = true;
      console.log('PATCHED: Route: Cek Booking Flow payload (added device_id)');
    }
  });
  
  if (changed) fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

// ===== FIX 2: 05_cek_booking_flow.json =====
// Semua GoWA node: pastikan deviceIdOverride mengacu ke body.device_id
{
  const p = './n8n-workflows/05_cek_booking_flow.json';
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  let count = 0;
  
  data.nodes.forEach(n => {
    if (n.type === '@aldinokemal2104/n8n-nodes-gowa.gowa') {
      n.parameters.deviceIdOverride = "={{ $('Webhook (From Main Router)').item.json.body.device_id }}";
      count++;
    }
  });
  
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  console.log(`PATCHED: 05 - ${count} GoWA node(s) device_id updated`);
}

console.log('\nAll fixes applied!');
