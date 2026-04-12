const fs = require('fs');
let file = 'd:\\fitmorot\\n8n-workflows\\03_jemput_antar_flow.json';
let data = JSON.parse(fs.readFileSync(file, 'utf8'));

let insertNode = data.nodes.find(n => n.name === 'MySQL: Insert Booking');
if (insertNode) {
    let q = insertNode.parameters.query;
    q = q.replace(/\{\{\s*\$json\.km\s*\}\}/g, "{{ $('Code: Hitung Biaya').item.json.km }}");
    q = q.replace(/\{\{\s*\$json\.biaya\s*\}\}/g, "{{ $('Code: Hitung Biaya').item.json.biaya }}");
    insertNode.parameters.query = q;
}

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log("03 Insert Booking MySQL Patched");
