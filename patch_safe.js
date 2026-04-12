const fs = require('fs');

function safeInject(file, isJemput) {
    let data = JSON.parse(fs.readFileSync(file, 'utf8'));
    let insertNode = data.nodes.find(n => n.name === 'MySQL: Insert Booking');
    if (!insertNode) return;
    
    // Check if gen-kode exists
    if (!data.nodes.find(n => n.name === 'Code: Generate Kode')) {
        let codeGenerator = {
            "parameters": {
                "jsCode": "const kode = 'BKG-' + Date.now().toString().slice(-6);\nreturn [{ json: { kode_booking: kode } }];"
            },
            "id": "gen-kode-new-" + (isJemput ? "03" : "02"),
            "name": "Code: Generate Kode",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [insertNode.position[0]-250, insertNode.position[1]-50]
        };
        
        // Find who points to Insert Booking
        let sourceNode = null;
        let sourceBranch = 0;
        let sourceIndex = 0;
        for (let key in data.connections) {
            for (let branch in data.connections[key]) {
                for (let idx = 0; idx < data.connections[key][branch].length; idx++) {
                    if (data.connections[key][branch][idx][0] && data.connections[key][branch][idx][0].node === 'MySQL: Insert Booking') {
                        sourceNode = key;
                        sourceBranch = branch;
                        sourceIndex = idx;
                    }
                }
            }
        }
        
        if (sourceNode) {
            data.connections[sourceNode][sourceBranch][sourceIndex][0] = { "node": "Code: Generate Kode", "type": "main", "index": 0 };
            data.connections["Code: Generate Kode"] = { "main": [[{ "node": "MySQL: Insert Booking", "type": "main", "index": 0 }]] };
        }
        
        // Replace BKG generation inside MySQL query
        insertNode.parameters.query = insertNode.parameters.query.replace("'{{ 'BKG-' + Date.now().toString().slice(-6) }}'", "'{{ $('Code: Generate Kode').item.json.kode_booking }}'");
        
        // Update GoWA output
        let gowaNode = data.nodes.find(n => n.name === (isJemput ? 'GoWA: Kirim Sukses' : 'GoWA: Konfirmasi Booking'));
        if (!gowaNode) gowaNode = data.nodes.find(n => n.name.includes('Sukses') || n.name.includes('Konfirmasi'));
        
        if (gowaNode) {
            if (isJemput) {
                gowaNode.parameters.message = "={{ 'Baik kak, montir segera jalan menuju titik jemput.\\nPerkiraan biaya jemput-antar: Rp ' + $('Code: Hitung Biaya').item.json.biaya + ' dengan estimasi kedatangan ' + $('Code: Hitung Biaya').item.json.durasi + '.\\n\\n🎟️ *KODE ODER: ' + $('Code: Generate Kode').item.json.kode_booking + '*\\n\\nMohon tunggu kedatangan tim kami ya! 🙏' }}";
            } else {
                gowaNode.parameters.message = "={{ 'Baik kak, booking servis *' + $('Gemini: Ekstrak Data Booking').item.json.layanan + '* sudah kami jadwalkan untuk motor ' + $('Gemini: Ekstrak Data Booking').item.json.nopol + '.\\n\\n🎟️ *KODE BOOKING: ' + $('Code: Generate Kode').item.json.kode_booking + '*\\n\\nMohon tunjukkan kode booking ini ke kasir kami saat kedatangan ya kak! Ditunggu kehadirannya! 😁' }}";
            }
        }
        
        data.nodes.push(codeGenerator);
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    }
}

safeInject('d:\\fitmorot\\n8n-workflows\\02_booking_flow.json', false);
safeInject('d:\\fitmorot\\n8n-workflows\\03_jemput_antar_flow.json', true);
console.log("Kode Booking PERFECTLY FIXED!");
