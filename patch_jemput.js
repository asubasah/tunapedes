const fs = require('fs');
const p = './n8n-workflows/03_jemput_antar_flow.json';
let data = JSON.parse(fs.readFileSync(p, 'utf8'));
let changed = [];

data.nodes.forEach(n => {
  // 1. Code node: pre-fill cabang_id dari device_id, bukan dari AI
  if (n.name === 'Gemini: Ekstrak Data Jemput') {
    n.parameters.jsCode = [
      "let text = $input.item.json.text || $input.item.json.content || '{}';",
      "text = text.replace(/```json/gi, '').replace(/```/gi, '').trim();",
      "let bongkar = {};",
      "try { bongkar = JSON.parse(text); } catch(e) {}",
      "",
      "// cabang_id SELALU dari device_id webhook, bukan dari AI",
      "const cabang_from_device = $('Webhook (From Main Router)').item.json.body.cabang_id",
      "  || ($('Webhook (From Main Router)').item.json.body.device_id || '').replace('fitmotor_', '');",
      "",
      "return [{ json: {",
      "  layanan: bongkar.layanan || '',",
      "  motor: bongkar.motor || '',",
      "  nopol: bongkar.nopol || '',",
      "  waktu: bongkar.waktu || '',",
      "  cabang_id: cabang_from_device,",
      "  alamat_jemput: bongkar.alamat_jemput || ''",
      "} }];"
    ].join('\n');
    changed.push('Gemini: Ekstrak Data Jemput');
  }

  // 2. Semua GoWA node: device_id dynamic
  if (n.type === '@aldinokemal2104/n8n-nodes-gowa.gowa') {
    n.parameters.deviceIdOverride = "={{ $('Webhook (From Main Router)').item.json.body.device_id }}";
    changed.push('GoWA deviceId: ' + n.name);
  }
});

fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
console.log('PATCHED 03_jemput_antar_flow.json');
console.log('Changes:', changed.join(', '));
