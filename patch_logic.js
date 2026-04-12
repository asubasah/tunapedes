const fs = require('fs');

function patchPelangganDanLokasi() {
    // ---- 1. PATCH 01 (LOKASI) ----
    let data01 = JSON.parse(fs.readFileSync('d:\\fitmorot\\n8n-workflows\\01_main_router.json', 'utf8'));
    data01.nodes.forEach(n => {
        if (n.name === 'Extract: nomor_wa & pesan') {
            n.parameters.assignments.assignments.forEach(a => {
                if (a.name === 'pesan') {
                    a.value = "={{ $json.body.payload.type === 'location' ? '[LOKASI DIKIRIM (Google Maps Coordinate): ' + ($json.body.payload.lat || ($json.body.payload.location && $json.body.payload.location.degreesLatitude)) + ',' + ($json.body.payload.lng || ($json.body.payload.location && $json.body.payload.location.degreesLongitude)) + ']' : ($json.body.payload.body || '') }}";
                }
            });
        }
    });
    fs.writeFileSync('d:\\fitmorot\\n8n-workflows\\01_main_router.json', JSON.stringify(data01, null, 2));

    // ---- 2. PATCH 02 (AUTO SAVE PELANGGAN) ----
    let data02 = JSON.parse(fs.readFileSync('d:\\fitmorot\\n8n-workflows\\02_booking_flow.json', 'utf8'));
    let insertPelanggan02 = {
      "parameters": {
        "operation": "executeQuery",
        "query": "INSERT INTO pelanggan (nomor_wa, nama, nopol, motor)\nVALUES ('{{ $('Webhook (From Main Router)').item.json.body.nomor_wa }}', '{{ $('Webhook (From Main Router)').item.json.body.nama_pelanggan || 'Pelanggan' }}', '{{ $('Gemini: Ekstrak Data Booking').item.json.nopol }}', '{{ $('Gemini: Ekstrak Data Booking').item.json.motor }}')\nON DUPLICATE KEY UPDATE nopol = VALUES(nopol), motor = VALUES(motor);",
        "options": {}
      },
      "id": "mysql-simpan-pelanggan-02",
      "name": "MySQL: Update Database Pelanggan",
      "type": "n8n-nodes-base.mySql",
      "typeVersion": 2.4,
      "position": [950, 400],
      "credentials": { "mySql": { "id": "On2uunDgsIP8TtL0", "name": "FitMotor MySQL" } } 
    };
    
    // Connect Insert Pelanggan after Insert Booking, before GoWA
    let insertBooking02 = data02.nodes.find(n => n.name === 'MySQL: Insert Booking');
    if (!insertPelanggan02.position) insertPelanggan02.position = [insertBooking02.position[0] + 200, insertBooking02.position[1]];
    
    data02.connections["MySQL: Insert Booking"] = { "main": [[{ "node": "MySQL: Update Database Pelanggan", "type": "main", "index": 0 }]] };
    data02.connections["MySQL: Update Database Pelanggan"] = { "main": [[{ "node": "GoWA: Kirim Sukses", "type": "main", "index": 0 }]] };
    data02.nodes.push(insertPelanggan02);
    
    // Push Kode Booking injection code from earlier if missing
    let gowaNode02 = data02.nodes.find(n => n.name === 'GoWA: Kirim Sukses');
    data02.nodes.forEach(n => {
        if (n.name === 'Ollama: Ekstrak Data') {
           n.parameters.messages.messageValues[0].message = n.parameters.messages.messageValues[0].message.replace("Data Sesi Sebelumnya:", "Data Ekstra Tambahan:\n{{ $('Webhook (From Main Router)').item.json.body.pesan.includes('[LOKASI DIKIRIM') ? 'Pelanggan baru saja membagikan koordinat alamat langsung di chat. Jadikan ini sebagai alamat_jemput secara penuh.' : '' }}\n\nData Sesi Sebelumnya:");
        }
    });

    fs.writeFileSync('d:\\fitmorot\\n8n-workflows\\02_booking_flow.json', JSON.stringify(data02, null, 2));


    // ---- 3. PATCH 03 (AUTO SAVE PELANGGAN) ----
    let data03 = JSON.parse(fs.readFileSync('d:\\fitmorot\\n8n-workflows\\03_jemput_antar_flow.json', 'utf8'));
    let insertPelanggan03 = {
      "parameters": {
        "operation": "executeQuery",
        "query": "INSERT INTO pelanggan (nomor_wa, nama, nopol, motor, pernah_jemput, alamat_jemput_terakhir)\nVALUES ('{{ $('Webhook (From Main Router)').item.json.body.nomor_wa }}', '{{ $('Webhook (From Main Router)').item.json.body.nama_pelanggan || 'Pelanggan' }}', '{{ $('Gemini: Ekstrak Data Jemput').item.json.nopol }}', '{{ $('Gemini: Ekstrak Data Jemput').item.json.motor }}', 1, '{{ $('Gemini: Ekstrak Data Jemput').item.json.alamat_jemput }}')\nON DUPLICATE KEY UPDATE nopol = VALUES(nopol), motor = VALUES(motor), pernah_jemput = 1, alamat_jemput_terakhir = VALUES(alamat_jemput_terakhir);",
        "options": {}
      },
      "id": "mysql-simpan-pelanggan-03",
      "name": "MySQL: Update Database Pelanggan",
      "type": "n8n-nodes-base.mySql",
      "typeVersion": 2.4,
      "position": [1800, 600],
      "credentials": { "mySql": { "id": "On2uunDgsIP8TtL0", "name": "FitMotor MySQL" } } 
    };
    
    let insertBooking03 = data03.nodes.find(n => n.name === 'MySQL: Insert Booking');
    data03.connections["MySQL: Insert Booking"] = { "main": [[{ "node": "MySQL: Update Database Pelanggan", "type": "main", "index": 0 }]] };
    data03.connections["MySQL: Update Database Pelanggan"] = { "main": [[{ "node": "GoWA: Kirim Sukses", "type": "main", "index": 0 }]] };
    data03.nodes.push(insertPelanggan03);

    data03.nodes.forEach(n => {
        if (n.name === 'Ollama: Ekstrak Data') {
           n.parameters.messages.messageValues[0].message = n.parameters.messages.messageValues[0].message.replace("Data Terdaftar:", "PENTING: Jika teks memuat '[LOKASI DIKIRIM (Google Maps Coordinate): ...]', isikan nilai lat,lng tersebut MENTAH-MENTAH ke field 'alamat_jemput'. Jangan diubah.\n\nData Terdaftar:");
        }
    });

    fs.writeFileSync('d:\\fitmorot\\n8n-workflows\\03_jemput_antar_flow.json', JSON.stringify(data03, null, 2));

}

patchPelangganDanLokasi();
console.log("Auto-Save Pelanggan & Location Interceptor Diterapkan!");
