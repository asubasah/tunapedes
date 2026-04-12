const fs = require('fs');

let data = JSON.parse(fs.readFileSync('d:\\fitmorot\\n8n-workflows\\02_booking_flow.json', 'utf8'));

if (data.connections["MySQL: Update Database Pelanggan"]) {
    let outputSockets = data.connections["MySQL: Update Database Pelanggan"]["main"][0];
    
    // Find the actual name of the success node
    let confirmNode = data.nodes.find(n => n.name.includes("Konfirmasi Booking") || n.name.includes("Kirim Sukses"));
    
    if (confirmNode && outputSockets) {
        outputSockets[0].node = confirmNode.name;
    } else if (confirmNode && !outputSockets) {
        data.connections["MySQL: Update Database Pelanggan"]["main"] = [[ { "node": confirmNode.name, "type": "main", "index": 0 } ]];
    }
}

fs.writeFileSync('d:\\fitmorot\\n8n-workflows\\02_booking_flow.json', JSON.stringify(data, null, 2));
console.log("Connection wire fixed in 02!");
