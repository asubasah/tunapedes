const fs = require('fs');

const p = './n8n-workflows/01_main_router.json';
if(fs.existsSync(p)) {
  let data = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = false;

  data.nodes.forEach(n => {
    if (n.name === 'Cek Sesi Aktif' && n.type === 'n8n-nodes-base.mySql') {
      n.parameters.query = `SELECT step_aktif, context_json 
FROM sesi_chat 
WHERE nomor_wa = '{{ $('Extract: nomor_wa & pesan').item.json.nomor_wa }}' 
AND status = 'aktif' 
AND last_activity > DATE_SUB(NOW(), INTERVAL 1 HOUR)
AND LOWER('{{ $('Extract: nomor_wa & pesan').item.json.pesan }}') NOT REGEXP 'tanya|nanya|jam|buka|batal|cancel|kembali|halo|hallo|allo|hai|hi'
LIMIT 1;`;
      changed = true;
    }
  });

  if(changed) {
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
    console.log('PATCHED SQL in 01_main_router.json');
  }
}
