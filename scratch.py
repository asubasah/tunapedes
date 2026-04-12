import json

# ================================
# BUILD 01_MAIN_ROUTER
# ================================
def build_01():
    with open(r'd:\fitmorot\n8n-workflows\01_main_router.json', 'r') as f:
        data = json.load(f)
        
    for node in data['nodes']:
        if node['name'] == 'Set: Pelanggan Context':
            # Add motor field
            exists = False
            for assign in node['parameters']['assignments']['assignments']:
                if assign['name'] == 'motor':
                    exists = True
            if not exists:
                node['parameters']['assignments']['assignments'].append({
                  "id": "motor", "name": "motor", "value": "={{ $json.motor || '' }}", "type": "string"
                })
        elif node['name'] in ['Route: Booking Flow', 'Route: Jemput Antar Flow']:
            node['parameters']['jsonBody'] = "={{ { \"nomor_wa\": $('Extract: nomor_wa & pesan').item.json.nomor_wa, \"pesan\": $('Extract: nomor_wa & pesan').item.json.pesan, \"nama_pelanggan\": $('Set: Pelanggan Context').item.json.nama_pelanggan, \"motor\": $('Set: Pelanggan Context').item.json.motor, \"nopol\": $('Set: Pelanggan Context').item.json.nopol } }}"
            
    with open(r'd:\fitmorot\n8n-workflows\01_main_router.json', 'w') as f:
        json.dump(data, f, indent=2)

# ================================
# BUILD 02_BOOKING_FLOW
# ================================
def build_02():
    with open(r'd:\fitmorot\n8n-workflows\02_booking_flow.json', 'r') as f:
        data = json.load(f)
        
    for node in data['nodes']:
        if node['name'] == 'Ollama: Ekstrak Data':
            node['parameters']['options']['system'] = "Anda adalah AI bengkel Fit Motor. Ekstrak data servis dari kalimat pelanggan.\nGabungkan dengan 'Data Sesi Sebelumnya' jika ada.\n\nFORMAT WAKTU WAJIB: YYYY-MM-DD HH:mm:00 (Jika disebut besok, tambah 1 hari dari Waktu Saat Ini. Jika tanpa jam, default 09:00:00).\n\nBalas HANYA JSON murni.\nContoh output:\n{\n  \"layanan\": \"\",\n  \"motor\": \"\",\n  \"waktu\": \"\",\n  \"cabang_id\": \"\",\n  \"nopol\": \"\"\n}"
            # user msg
            node['parameters']['messages']['values'][0]['content'] = "={{ $('Webhook (From Main Router)').item.json.body.pesan }}\n\n[INFO SISTEM TANGGAL SAAT INI: {{ $now.setZone('Asia/Jakarta').toFormat('yyyy-MM-dd HH:mm:ss') }}]\nData Kendaraan Terdaftar (Gunakan jika tidak disebut lain): Motor {{ $('Webhook (From Main Router)').item.json.body.motor }}, Nopol {{ $('Webhook (From Main Router)').item.json.body.nopol }}\nData Sesi Sebelumnya:\n{{ $json.context_json ? $json.context_json : '{}' }}"
        
        elif node['name'] == 'MySQL: Insert Booking':
            node['parameters']['query'] = "INSERT INTO booking (id, nopol, nama_pelanggan, nomor_wa, cabang_id, waktu_booking, layanan, status)\nVALUES ('{{ 'BKG-' + Date.now().toString().slice(-6) }}', '{{ $('Gemini: Ekstrak Data Booking').item.json.nopol }}', '{{ $('Webhook (From Main Router)').item.json.body.nama_pelanggan || 'Pelanggan' }}', '{{ $('Webhook (From Main Router)').item.json.body.nomor_wa }}', '{{ $('Gemini: Ekstrak Data Booking').item.json.cabang_id || 'adiwerna' }}', '{{ $('Gemini: Ekstrak Data Booking').item.json.waktu }}', '{{ $('Gemini: Ekstrak Data Booking').item.json.layanan }}', 'pending');"
            
    with open(r'd:\fitmorot\n8n-workflows\02_booking_flow.json', 'w') as f:
        json.dump(data, f, indent=2)

def execute():
    build_01()
    build_02()
    
if __name__ == '__main__':
    execute()
