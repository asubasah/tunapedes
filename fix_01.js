const fs = require('fs');

let data = JSON.parse(fs.readFileSync('d:\\fitmorot\\n8n-workflows\\01_main_router.json', 'utf8'));

data.nodes.forEach(node => {
    if (node.name === 'Cek Sesi Aktif') {
        node.alwaysOutputData = true;
    }
});

fs.writeFileSync('d:\\fitmorot\\n8n-workflows\\01_main_router.json', JSON.stringify(data, null, 2));
console.log('Fixed alwaysOutputData for Cek Sesi Aktif');
