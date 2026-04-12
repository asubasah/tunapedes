const fs = require('fs');

function injectBookingCode(file, isJemput = false) {
    let data = JSON.parse(fs.readFileSync(file, 'utf8'));
    
    let genKodeName = "Code: Generate Kode";
    
    // Check if it already exists
    if (!data.nodes.find(n => n.name === genKodeName)) {
        let codeGenerator = {
          "parameters": {
            "jsCode": "const kode = 'BKG-' + Date.now().toString().slice(-6);\nreturn [{ json: { kode_booking: kode } }];"
          },
          "id": "gen-kode-new",
          "name": genKodeName,
          "type": "n8n-nodes-base.code",
          "typeVersion": 2,
          "position": isJemput ? [1500, 750] : [750, 400]
        };
        
        let prevNode = isJemput ? "Luar Jangkauan?" : "MySQL: Tandai Selesai";
        
        if (!isJemput) {
            data.connections[prevNode]["main"][0] = [{ "node": genKodeName, "type": "main", "index": 0 }];
            data.connections[genKodeName] = { "main": [[{ "node": "MySQL: Insert Booking", "type": "main", "index": 0 }]] };
            
            let insertNode = data.nodes.find(n => n.name === 'MySQL: Insert Booking');
            insertNode.parameters.query = insertNode.parameters.query.replace("'{{ 'BKG-' + Date.now().toString().slice(-6) }}'", "'{{ $('Code: Generate Kode').item.json.kode_booking }}'");
            
            let gowaNode = data.nodes.find(n => n.name === 'GoWA: Kirim Sukses');
            gowaNode.parameters.message = "={{ 'Baik kak, booking servis *' + $('Gemini: Ekstrak Data Booking').item.json.layanan + '* sudah kami jadwalkan untuk motor ' + $('Gemini: Ekstrak Data Booking').item.json.nopol + '.\\n\\n🎟️ *KODE BOOKING: ' + $('Code: Generate Kode').item.json.kode_booking + '*\\n\\nMohon tunjukkan kode booking ini ke kasir kami saat kedatangan ya kak! Ditunggu kehadirannya! 😁' }}";
            
            codeGenerator.position = [insertNode.position[0]-250, insertNode.position[1]-100];
        } else {
            data.connections[prevNode]["main"][1] = [{ "node": genKodeName, "type": "main", "index": 0 }];
            data.connections[genKodeName] = { "main": [[{ "node": "MySQL: Insert Booking", "type": "main", "index": 0 }]] };
            
            let insertNode = data.nodes.find(n => n.name === 'MySQL: Insert Booking');
            insertNode.parameters.query = insertNode.parameters.query.replace("'{{ 'BKG-' + Date.now().toString().slice(-6) }}'", "'{{ $('Code: Generate Kode').item.json.kode_booking }}'");
            
            let gowaNode = data.nodes.find(n => n.name === 'GoWA: Kirim Sukses');
            gowaNode.parameters.message = "={{ 'Baik kak, montir segera jalan menuju titik jemput.\\nPerkiraan biaya jemput-antar: Rp ' + $('Code: Hitung Biaya').item.json.biaya + ' dengan estimasi kedatangan ' + $('Code: Hitung Biaya').item.json.durasi + '.\\n\\n🎟️ *KODE BOOKING: ' + $('Code: Generate Kode').item.json.kode_booking + '*\\n\\nMohon tunggu kedatangan tim kami ya! 🙏' }}";
            
            codeGenerator.position = [insertNode.position[0]-250, insertNode.position[1]-100];
        }
        
        data.nodes.push(codeGenerator);
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
    }
}

injectBookingCode('d:\\fitmorot\\n8n-workflows\\02_booking_flow.json', false);
injectBookingCode('d:\\fitmorot\\n8n-workflows\\03_jemput_antar_flow.json', true);
console.log("Kode Booking FIXED!");
