const fs = require('fs');

function fixFlow(filename, defaultType) {
    let raw = fs.readFileSync(filename, 'utf8');
    let data = JSON.parse(raw);
    
    // Remove the old Ollama node if it exists
    data.nodes = data.nodes.filter(n => n.name !== 'Ollama: Ekstrak Data' && n.name !== 'Ollama Model');
    
    let modelName = "qwen2.5:3b"; // Fallback default
    
    // Create new Basic LLM Chain and Ollama Model
    let chain = {
      "parameters": {
        "promptType": "define",
        "text": "={{ $('Webhook (From Main Router)').item.json.body.pesan }}\n\n[INFO SISTEM TANGGAL SAAT INI: {{ $now.setZone('Asia/Jakarta').toFormat('yyyy-MM-dd HH:mm:ss') }}]\nData Kendaraan Terdaftar (Gunakan jika tidak disebut lain): Motor {{ $('Webhook (From Main Router)').item.json.body.motor }}, Nopol {{ $('Webhook (From Main Router)').item.json.body.nopol }}\nData Sesi Sebelumnya:\n{{ $('MySQL: Dapatkan Sesi').item.json.context_json || '{}' }}",
        "messages": {
          "messageValues": [
            {
              "message": defaultType === 'booking' ? "=Anda adalah AI bengkel Fit Motor. Ekstrak data servis dari kalimat pelanggan.\nGabungkan dengan 'Data Sesi Sebelumnya' jika ada.\n\nFORMAT WAKTU WAJIB: YYYY-MM-DD HH:mm:00 (Jika disebut besok, tambah 1 hari dari Waktu Saat Ini. Jika tanpa jam, default 09:00:00).\n\nBalas HANYA JSON murni (Tanpa awalan markdown blok).\nContoh output (jangan ubah key):\n{\n  \"layanan\": \"\",\n  \"motor\": \"\",\n  \"waktu\": \"\",\n  \"cabang_id\": \"\",\n  \"nopol\": \"\"\n}" : "=Anda adalah AI bengkel Fit Motor. Ekstrak data servis jemput dari kalimat pelanggan. Jika tidak spesifik cabang, biarkan kosong.\nBalas HANYA JSON murni (tanpa markdown).\nContoh output (jangan hapus key):\n{\n  \"layanan\": \"\",\n  \"motor\": \"\",\n  \"nopol\": \"\",\n  \"alamat_jemput\": \"\",\n  \"cabang_id\": \"\"\n}"
            }
          ]
        }
      },
      "id": "llm-chain",
      "name": "Ollama: Ekstrak Data",
      "type": "@n8n/n8n-nodes-langchain.chainLlm",
      "typeVersion": 1.4,
      "position": [-50, 300]
    };
    
    let model = {
      "parameters": {
        "model": modelName,
        "options": {}
      },
      "type": "@n8n/n8n-nodes-langchain.lmChatOllama",
      "typeVersion": 1,
      "position": [-50, 500],
      "id": "ollama-model",
      "name": "Ollama Model",
      "credentials": { "ollamaApi": { "id": "6aNAhb62GAu8R8rG", "name": "Ollama account" } }
    };
    
    data.nodes.push(chain);
    data.nodes.push(model);
    
    // Update Code node parse logic
    data.nodes.forEach(n => {
        if (n.name.includes("Gemini: Ekstrak Data")) {
            n.parameters.jsCode = "let text = $input.item.json.text || $input.item.json.content || '{}';\ntext = text.replace(/```json/gi, '').replace(/```/gi, '').trim();\nlet bongkar = {};\ntry {\n  bongkar = JSON.parse(text);\n} catch(e) {}\nreturn [{ json: {\n  layanan: bongkar.layanan || '',\n  motor: bongkar.motor || '',\n  nopol: bongkar.nopol || '',\n  waktu: bongkar.waktu || '',\n  cabang_id: bongkar.cabang_id || '',\n  alamat_jemput: bongkar.alamat_jemput || ''\n} }];";
        }
    });

    // Update connections
    if (!data.connections["MySQL: Dapatkan Sesi"]) data.connections["MySQL: Dapatkan Sesi"] = { main: [[]] };
    data.connections["MySQL: Dapatkan Sesi"]["main"][0] = [{ "node": "Ollama: Ekstrak Data", "type": "main", "index": 0 }];
    
    data.connections["Ollama: Ekstrak Data"] = {
        "main": [[{ "node": defaultType === 'booking' ? "Gemini: Ekstrak Data Booking" : "Gemini: Ekstrak Data Jemput", "type": "main", "index": 0 }]]
    };
    
    data.connections["Ollama Model"] = {
        "ai_languageModel": [[{ "node": "Ollama: Ekstrak Data", "type": "ai_languageModel", "index": 0 }]]
    };
    
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

fixFlow('d:\\fitmorot\\n8n-workflows\\02_booking_flow.json', 'booking');
fixFlow('d:\\fitmorot\\n8n-workflows\\03_jemput_antar_flow.json', 'jemput');
console.log("All fixed!");
