const fs = require('fs');

let data = JSON.parse(fs.readFileSync('d:\\fitmorot\\n8n-workflows\\01_main_router.json', 'utf8'));

let chain = data.nodes.find(n => n.name === 'Basic LLM Chain');
if(chain) {
    chain.parameters.messages.messageValues[0].message = `=Anda adalah mesin Router n8n. Klasifikasikan pesan user ke dalam SALAH SATU dari 4 kategori baku ini. 
DILARANG KERAS membuat kategori baru (seperti "jam_operasional", "lokasi", dll). Anda HANYA BOLEH membalas dengan format JSON murni ini:

{"intent": "PILIHAN_ANDA"}

Pilihan yang tersedia HANYA:
1. "booking" -> Jika user ingin memesan servis reguler bengkel.
2. "jemput_antar" -> Jika user minta montir datang, mogok, atau jemput kendaraan.
3. "cek_booking" -> Jika user bertanya tentang status, resi, nomor antrian, atau menyebutkan format "BKG-xxxx".
4. "lainnya" -> Jika user bertanya pertanyaan umum (jam operasional, letak lokasi bengkel, harga, dll) ATAU jika tidak cocok dengan 3 kategori di atas. WAJIB gunakan kata "lainnya", JANGAN DIUBAH!

Pesan User: {{ $('Extract: nomor_wa & pesan').item.json.pesan }}`;
}

fs.writeFileSync('d:\\fitmorot\\n8n-workflows\\01_main_router.json', JSON.stringify(data, null, 2));
console.log("LLM Prompt dikunci dengan keras!");
