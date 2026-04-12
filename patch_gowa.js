const fs = require('fs');
const files = ['02_booking_flow.json', '03_jemput_antar_flow.json', '05_cek_booking_flow.json'];
files.forEach(f => {
  const p = './n8n-workflows/' + f;
  if (!fs.existsSync(p)) return;
  let data = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = false;
  data.nodes.forEach(n => {
    if (n.type === '@aldinokemal2104/n8n-nodes-gowa.gowa' || n.name.startsWith('GoWA:')) {
      n.parameters.deviceIdOverride = "={{ $('Webhook (From Main Router)').item.json.body.device_id }}";
      changed = true;
    }
  });
  if(changed) {
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    console.log('PATCHED', f);
  }
});
