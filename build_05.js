const fs = require('fs');

function build05() {
    let f05 = {
      "name": "FitMotor — 05 Status Pelacakan",
      "nodes": [
        {
          "parameters": { "httpMethod": "POST", "path": "cek_booking_flow", "options": {} },
          "id": "webhook-05",
          "name": "Webhook (From Main Router)",
          "type": "n8n-nodes-base.webhook",
          "typeVersion": 2,
          "position": [0, 200]
        },
        {
          "parameters": {
            "jsCode": "const pesan = $input.item.json.body.pesan || '';\nconst wa = $input.item.json.body.nomor_wa;\nconst m = pesan.match(/BKG-\\d+/i);\nreturn [{ json: { kode: m ? m[0].toUpperCase() : null, nomor_wa: wa } }];"
          },
          "id": "extract-bkg",
          "name": "Code: Cari Pola BKG-",
          "type": "n8n-nodes-base.code",
          "typeVersion": 2,
          "position": [200, 200]
        },
        {
           "parameters": {
              "conditions": {
                 "options": {},
                 "conditions": [ { "id": "1", "leftValue": "={{ $json.kode }}", "operator": { "type": "string", "operation": "notEmpty" } } ]
              }
           },
           "id": "if-exist",
           "name": "Ada Kode di Teks?",
           "type": "n8n-nodes-base.if",
           "typeVersion": 2,
           "position": [400, 200]
        },
        {
          "parameters": {
            "deviceIdOverride": "6283116105550:27@s.whatsapp.net",
            "phoneNumber": "={{ $json.nomor_wa }}",
            "message": "Maaf kak, sistem kami tidak menemukan kode booking pada pesan Anda. Mohon sertakan kode tiket (contoh format: BKG-123456) untuk mengecek status servis."
          },
          "id": "gowa-no-code",
          "name": "GoWA: Ga Ketemu Format",
          "type": "@aldinokemal2104/n8n-nodes-gowa.gowa",
          "typeVersion": 1,
          "position": [600, 0],
          "credentials": { "goWhatsappApi": { "id": "iwMVuTKnzKkCBH6T", "name": "FitMotor GoWA" } }
        },
        {
          "parameters": {
            "operation": "executeQuery",
            "query": "SELECT * FROM booking WHERE id = '{{ $json.kode }}' LIMIT 1;",
            "options": {}
          },
          "id": "mysql-cek-bkg",
          "name": "MySQL: Cari ID Booking",
          "type": "n8n-nodes-base.mySql",
          "typeVersion": 2.4,
          "position": [600, 200],
          "alwaysOutputData": true,
          "credentials": { "mySql": { "id": "On2uunDgsIP8TtL0", "name": "FitMotor MySQL" } }
        },
        {
           "parameters": {
              "conditions": {
                 "options": {},
                 "conditions": [ { "id": "1", "leftValue": "={{ $json.id }}", "operator": { "type": "string", "operation": "notEmpty" } } ]
              }
           },
           "id": "if-database",
           "name": "Ketemu di DB?",
           "type": "n8n-nodes-base.if",
           "typeVersion": 2,
           "position": [800, 200]
        },
        {
          "parameters": {
            "deviceIdOverride": "6283116105550:27@s.whatsapp.net",
            "phoneNumber": "={{ $('Webhook (From Main Router)').item.json.body.nomor_wa }}",
            "message": "={{ 'Mohon maaf kak, kode booking ' + $('Code: Cari Pola BKG-').item.json.kode + ' tidak terdaftar dalam database kami.' }}"
          },
          "id": "gowa-no-db",
          "name": "GoWA: Tidak Ditemukan",
          "type": "@aldinokemal2104/n8n-nodes-gowa.gowa",
          "typeVersion": 1,
          "position": [1000, 50],
          "credentials": { "goWhatsappApi": { "id": "iwMVuTKnzKkCBH6T", "name": "FitMotor GoWA" } }
        },
        {
           "parameters": {
              "conditions": {
                 "options": {},
                 "conditions": [ { "id": "1", "leftValue": "={{ $json.nomor_wa }}", "rightValue": "={{ $('Webhook (From Main Router)').item.json.body.nomor_wa }}", "operator": { "type": "string", "operation": "equals" } } ]
              }
           },
           "id": "if-pemilik",
           "name": "Pemilik Asli?",
           "type": "n8n-nodes-base.if",
           "typeVersion": 2,
           "position": [1000, 200]
        },
        {
          "parameters": {
            "deviceIdOverride": "6283116105550:27@s.whatsapp.net",
            "phoneNumber": "={{ $('Webhook (From Main Router)').item.json.body.nomor_wa }}",
            "message": "={{ 'Status Reservasi: ' + $('Code: Cari Pola BKG-').item.json.kode + ' adalah *' + $json.status.toUpperCase() + '*. \\n\\nDemi privasi data pelanggan kami, detail layanan servis bengkel tersebut hanya bisa kami infokan ke nomor WhatsApp resmi sang pemesan asli.' }}"
          },
          "id": "gowa-penguntit",
          "name": "GoWA: Info Anonim",
          "type": "@aldinokemal2104/n8n-nodes-gowa.gowa",
          "typeVersion": 1,
          "position": [1200, 0],
          "credentials": { "goWhatsappApi": { "id": "iwMVuTKnzKkCBH6T", "name": "FitMotor GoWA" } }
        },
        {
          "parameters": {
            "deviceIdOverride": "6283116105550:27@s.whatsapp.net",
            "phoneNumber": "={{ $json.nomor_wa }}",
            "message": "={{ '⚠️ *ALARM PRIVASI DATA!*\\nBarusan saja terdapat percobaan pelacakan status atas nama Booking Anda (' + $json.id + ') oleh nomor anonim (+' + $('Webhook (From Main Router)').item.json.body.nomor_wa + ').\\n\\nJangan khawatir kak, data riwayat plat dan servis motor kesayangan Anda sangat aman di database kami karena sistem menolaknya secara otomatis.' }}"
          },
          "id": "gowa-asli-alert",
          "name": "GoWA: Kirim Alarm Pemilik",
          "type": "@aldinokemal2104/n8n-nodes-gowa.gowa",
          "typeVersion": 1,
          "position": [1200, 150],
          "credentials": { "goWhatsappApi": { "id": "iwMVuTKnzKkCBH6T", "name": "FitMotor GoWA" } }
        },
        {
          "parameters": {
            "jsCode": "let st = $input.item.json.status || 'pending';\nlet msg = '';\nif (st === 'pending') {\n  msg = 'Jadwal servis booking Anda tercatat aman! Ditunggu segera kedatangan motor Anda di cabang ' + $input.item.json.cabang_id + ' ya kak.';\n} else if (st === 'proses') {\n  msg = 'Motor kesayangan Anda (' + $input.item.json.nopol + ') sedang dikerjakan sepenuh hati oleh mekanik ahli kami! Silakan ditunggu, nanti segera kami infokan ya.';\n} else if (st === 'selesai' || st === 'selesaish') {\n  msg = 'MANTAB! Motor Anda sudah Selesai (*SELESAI*) diservis! Mesin sudah sehat dan siap ngebut lagi. Silakan diambil di bengkel sekarang ya kak! 🎉';\n} else if (st === 'batal') {\n  msg = 'Layanan booking servis sudah dibatalkan di sistem server kami. Apabila Anda tidak merasa membatalkannya, harap konfirmasi ulang kepada CS kami ya kak.';\n} else {\n  msg = 'Status Servis Anda saat ini termonitor dalam status: *' + st.toUpperCase() + '*.';\n}\n\nreturn [{ json: { text: msg } }];"
          },
          "id": "code-status-logic",
          "name": "Code: Status Interpreter",
          "type": "n8n-nodes-base.code",
          "typeVersion": 2,
          "position": [1200, 350]
        },
        {
          "parameters": {
            "deviceIdOverride": "6283116105550:27@s.whatsapp.net",
            "phoneNumber": "={{ $('Webhook (From Main Router)').item.json.body.nomor_wa }}",
            "message": "={{ '✅ *PAPAN PELACAKAN SERVIS*\\nID Booking: ' + $('Code: Cari Pola BKG-').item.json.kode + '\\nLayanan: ' + $('Ketemu di DB?').item.json.layanan + '\\n\\n💬 Status Terkini: ' + $json.text }}"
          },
          "id": "gowa-pelacakan",
          "name": "GoWA: Live Tracking",
          "type": "@aldinokemal2104/n8n-nodes-gowa.gowa",
          "typeVersion": 1,
          "position": [1400, 350],
          "credentials": { "goWhatsappApi": { "id": "iwMVuTKnzKkCBH6T", "name": "FitMotor GoWA" } }
        }
      ],
      "connections": {
          "Webhook (From Main Router)": { "main": [[{ "node": "Code: Cari Pola BKG-", "type": "main", "index": 0 }]] },
          "Code: Cari Pola BKG-": { "main": [[{ "node": "Ada Kode di Teks?", "type": "main", "index": 0 }]] },
          "Ada Kode di Teks?": {
              "main": [
                  [{ "node": "MySQL: Cari ID Booking", "type": "main", "index": 0 }],
                  [{ "node": "GoWA: Ga Ketemu Format", "type": "main", "index": 0 }]
              ]
          },
          "MySQL: Cari ID Booking": { "main": [[{ "node": "Ketemu di DB?", "type": "main", "index": 0 }]] },
          "Ketemu di DB?": {
              "main": [
                  [{ "node": "Pemilik Asli?", "type": "main", "index": 0 }],
                  [{ "node": "GoWA: Tidak Ditemukan", "type": "main", "index": 0 }]
              ]
          },
          "Pemilik Asli?": {
              "main": [
                  [{ "node": "Code: Status Interpreter", "type": "main", "index": 0 }],
                  [{ "node": "GoWA: Info Anonim", "type": "main", "index": 0 }, { "node": "GoWA: Kirim Alarm Pemilik", "type": "main", "index": 0 }]
              ]
          },
          "Code: Status Interpreter": { "main": [[{ "node": "GoWA: Live Tracking", "type": "main", "index": 0 }]] }
      },
      "settings": { "executionOrder": "v1" }
    };
    
    fs.writeFileSync('d:\\fitmorot\\n8n-workflows\\05_cek_booking_flow.json', JSON.stringify(f05, null, 2));

    // PATCH 01: ADD TRACKING INTENT & ROUTE
    let data = JSON.parse(fs.readFileSync('d:\\fitmorot\\n8n-workflows\\01_main_router.json', 'utf8'));

    // Inject prompt
    let chain = data.nodes.find(n => n.name === 'Basic LLM Chain');
    if(chain) {
        let msg = chain.parameters.messages.messageValues[0].message;
        if(!msg.includes('cek_booking')) {
            chain.parameters.messages.messageValues[0].message = msg.replace('{"intent": "booking" | "jemput_antar" | "lainnya"}', '{"intent": "booking" | "jemput_antar" | "cek_booking" | "lainnya"}');
        }
    }
    
    let switchNode = data.nodes.find(n => n.name === 'Switch Intent');
    let fallbackOutputOriginalIndex = 0; // Find what index fallback used to be
    
    // In n8n, rules array drives output sockets linearly
    if(switchNode) {
        let rulesObj = switchNode.parameters.routingRules ? switchNode.parameters.routingRules : switchNode.parameters.rules;
        let rules = rulesObj.rules;
        let hasCekBooking = false;
        
        for(let r of rules) if(r.outputName === 'cek_booking') hasCekBooking = true;
        
        if(!hasCekBooking) {
            rules.push({
                "conditions": {
                    "options": { "caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 2 },
                    "conditions": [
                        { "id": "cek", "leftValue": "={{ $json.intent }}", "rightValue": "cek_booking", "operator": { "type": "string", "operation": "contains" } }
                    ],
                    "combinator": "and"
                },
                "renameOutput": true,
                "outputName": "cek_booking"
            });
        }
    }
    
    // Create new route webhook sender
    if(!data.nodes.find(n => n.name === 'Route: Cek Booking Flow')) {
        let reqNode = {
          "parameters": {
            "method": "POST",
            "url": "http://localhost:5678/webhook/cek_booking_flow",
            "sendBody": true,
            "contentType": "raw",
            "rawContentType": "application/json",
            "body": "={{ {\n  \"nomor_wa\": $('Extract: nomor_wa & pesan').item.json.nomor_wa,\n  \"pesan\": $('Extract: nomor_wa & pesan').item.json.pesan\n} }}",
            "options": {}
          },
          "id": "req-cek-booking",
          "name": "Route: Cek Booking Flow",
          "type": "n8n-nodes-base.httpRequest",
          "typeVersion": 4.1,
          "position": [0, 0] // Dynamic placement
        };
        
        let targetNode = data.nodes.find(n => n.name === 'Route: Jemput Antar Flow');
        if(targetNode) reqNode.position = [targetNode.position[0], targetNode.position[1]+200];
        data.nodes.push(reqNode);
    }
    
    // I will instruct the user to wire the Switch UI themselves (extremely safe and easiest to avoid Array mismatch corruption for Switch v3).
    
    fs.writeFileSync('d:\\fitmorot\\n8n-workflows\\01_main_router.json', JSON.stringify(data, null, 2));

}

build05();
console.log("Built 05 Check Booking System");
