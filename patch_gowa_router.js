const fs = require('fs');

const p = './n8n-workflows/01_main_router.json';
if(fs.existsSync(p)) {
  let data = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = false;

  data.nodes.forEach(n => {
    // 1. Update HTTP Request Payloads to forward device_id
    if (n.type === 'n8n-nodes-base.httpRequest' && n.name.startsWith('Route:')) {
      if (n.parameters.jsonBody && !n.parameters.jsonBody.includes('device_id')) {
        n.parameters.jsonBody = n.parameters.jsonBody.replace(
          '} }}',
          ', "device_id": $(\'Extract: nomor_wa & pesan\').item.json.device_id } }}'
        );
        changed = true;
      }
    }

    // 2. Update GoWA nodes in main router
    if (n.type === '@aldinokemal2104/n8n-nodes-gowa.gowa' || n.name.startsWith('GoWA:')) {
      n.parameters.deviceIdOverride = "={{ $('Extract: nomor_wa & pesan').item.json.device_id }}";
      changed = true;
    }
  });

  if(changed) {
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    console.log('PATCHED 01_main_router.json');
  }
}
