const fs = require('fs');
const p = './n8n-workflows/02_booking_flow.json';
let data = JSON.parse(fs.readFileSync(p, 'utf8'));

// Peta rename: nama lama → nama baru
const renames = {
  'MySQL: Cek Duplikat Booking': 'MySQL: Cek Nopol Aktif',
  'Duplikat?': 'IF: Nopol Terdaftar di Cabang Lain?'
};

// Fix connections: ganti semua referensi nama lama ke nama baru
const newConnections = {};
for (const [srcKey, connData] of Object.entries(data.connections)) {
  // Ganti key (source node name)
  const newSrcKey = renames[srcKey] || srcKey;
  
  // Ganti target node names di dalam nilai
  const newConnData = JSON.parse(JSON.stringify(connData)); // deep clone
  for (const type of Object.keys(newConnData)) {
    for (const group of newConnData[type]) {
      for (const conn of group) {
        if (renames[conn.node]) {
          conn.node = renames[conn.node];
        }
      }
    }
  }
  newConnections[newSrcKey] = newConnData;
}
data.connections = newConnections;

fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');

// Verify
console.log('Connections after fix:');
Object.keys(data.connections).forEach(k => {
  const targets = [];
  for (const type of Object.keys(data.connections[k])) {
    for (const group of data.connections[k][type]) {
      for (const c of group) targets.push(c.node);
    }
  }
  console.log(' ', k, '->', targets.join(', '));
});
console.log('\nDONE: connections fixed!');
