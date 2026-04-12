const fs = require('fs');

function injectBookingCode(file, isJemput = false) {
    let data = JSON.parse(fs.readFileSync(file, 'utf8'));
    
    // Add Set Node to generate Booking ID
    let codeGenerator = {
      "parameters": {
        "jsCode": "const kode = 'BKG-' + Date.now().toString().slice(-6);\nreturn [{ json: { kode_booking: kode } }];"
      },
      "id": "gen-kode",
      "name": "Code: Generate Kode",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": isJemput ? [1500, 750] : [750, 400]
    };
    
    // Delete old insert booking link
    let prevNode = isJemput ? "Luar Jangkauan?" : "MySQL: Selesai Sesi";
    
    if (!isJemput) {
        data.connections[prevNode]["main"][0] = [{ "node": "Code: Generate Kode", "type": "main", "index": 0 }];
        data.connections["Code: Generate Kode"] = { "main": [[{ "node": "MySQL: Insert Booking", "type": "main", "index": 0 }]] };
        
        // Update MySQL Insert
        let insertNode = data.nodes.find(n => n.name === 'MySQL: Insert Booking');
        insertNode.parameters.query = insertNode.parameters.query.replace("'{{ 'BKG-' + Date.now().toString().slice(-6) }}'", "'{{ $json.kode_booking }}'");
        
        // Update GoWA message
        let gowaNode = data.nodes.find(n => n.name === 'GoWA: Kirim Sukses');
        gowaNode.parameters.message = "={{ 'Baik kak, booking servis *' + $('Gemini: Ekstrak Data Booking').item.json.layanan + '* sudah kami jadwalkan untuk motor ' + $('Gemini: Ekstrak Data Booking').item.json.nopol + '.\\n\\n🎟️ *KODE BOOKING: ' + $('Code: Generate Kode').item.json.kode_booking + '*\\n\\nMohon tunjukkan kode booking ini ke kasir kami saat kedatangan ya kak! Ditunggu kehadirannya! 😁' }}";
        
        codeGenerator.position = [insertNode.position[0]-250, insertNode.position[1]];
    } else {
        // Jemput Antar
        data.connections[prevNode]["main"][1] = [{ "node": "Code: Generate Kode", "type": "main", "index": 0 }];
        data.connections["Code: Generate Kode"] = { "main": [[{ "node": "MySQL: Insert Booking", "type": "main", "index": 0 }]] };
        
        let insertNode = data.nodes.find(n => n.name === 'MySQL: Insert Booking');
        insertNode.parameters.query = insertNode.parameters.query.replace("'{{ 'BKG-' + Date.now().toString().slice(-6) }}'", "'{{ $('Code: Generate Kode').item.json.kode_booking }}'");
        
        let gowaNode = data.nodes.find(n => n.name === 'GoWA: Kirim Sukses');
        gowaNode.parameters.message = "={{ 'Baik kak, montir segera jalan menuju titik jemput.\\nPerkiraan biaya jemput-antar: Rp ' + $('Code: Hitung Biaya').item.json.biaya + ' dengan estimasi kedatangan ' + $('Code: Hitung Biaya').item.json.durasi + '.\\n\\n🎟️ *KODE BOOKING: ' + $('Code: Generate Kode').item.json.kode_booking + '*\\n\\nMohon tunggu kedatangan tim kami ya! 🙏' }}";
        
        codeGenerator.position = [insertNode.position[0]-250, insertNode.position[1]];
    }
    
    data.nodes.push(codeGenerator);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

injectBookingCode('d:\\fitmorot\\n8n-workflows\\02_booking_flow.json', false);
injectBookingCode('d:\\fitmorot\\n8n-workflows\\03_jemput_antar_flow.json', true);
console.log("Booking Codes Injected!");
