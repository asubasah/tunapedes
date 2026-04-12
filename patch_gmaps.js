const fs = require('fs');
let file = 'd:\\fitmorot\\n8n-workflows\\03_jemput_antar_flow.json';
let data = JSON.parse(fs.readFileSync(file, 'utf8'));

let httpNode = data.nodes.find(n => n.name === 'Google Maps: Hitung Jarak');
if (httpNode) {
    httpNode.parameters.queryParameters.parameters.forEach(p => {
        if (p.name === 'key') {
            p.value = "KODE_API_GMAPS_TARUH_DISINI_NANTI";
        }
    });
    
    // Make sure it doesn't crash the workflow if API key is invalid
    httpNode.alwaysOutputData = true;
    httpNode.continueOnFail = true;
}

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log("03 Jemput Antar GMAPS API Patched");
