const fs = require('fs');

let data = JSON.parse(fs.readFileSync('d:\\fitmorot\\n8n-workflows\\01_main_router.json', 'utf8'));

let chain = data.nodes.find(n => n.name === 'Basic LLM Chain');
if(chain) {
    chain.parameters.messages.messageValues[0].message = `=Anda adalah asisten AI dari Fit Motor. Tentukan intent dari pesan user.  Balas HANYA dengan format JSON murni TANPA awalan markdown '\`\`\`json'. 
{ "intent": "booking" | "jemput_antar" | "cek_booking" | "lainnya" }
- 'booking' (untuk pesan servis biasa bengkel)
- 'jemput_antar' (jika sebut antar jemput/mogok)
- 'cek_booking' (jika teks bertanya tentang status, resi, nomor order, pesanan, atau menyebutkan format kode tiket seperti BKG-)
- 'lainnya' (PERTANYAAN UMUM: jika HANYA tanya letak lokasi, jam buka tutup, harga, keluhan. Atau jika tidak masuk dalam 3 kategori di atas)

Pesan User: {{ $('Extract: nomor_wa & pesan').item.json.pesan }}`;
}

fs.writeFileSync('d:\\fitmorot\\n8n-workflows\\01_main_router.json', JSON.stringify(data, null, 2));
console.log("Prompt di 01 sudah ditimpa total");
