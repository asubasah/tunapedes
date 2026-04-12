const fs = require('fs');

let data = JSON.parse(fs.readFileSync('d:\\fitmorot\\n8n-workflows\\01_main_router.json', 'utf8'));

// Inject prompt
let chain = data.nodes.find(n => n.name === 'Basic LLM Chain');
if(chain) {
    let msg = chain.parameters.messages.messageValues[0].message;
    if(!msg.includes('cek_booking')) {
        chain.parameters.messages.messageValues[0].message = msg.replace('{"intent": "booking" | "jemput_antar" | "lainnya"}', '{"intent": "booking" | "jemput_antar" | "cek_booking" | "lainnya"}');
    }
}

// Add Switch routing rule safely
let switchNode = data.nodes.find(n => n.name === 'Switch Intent');
if(switchNode) {
    let rulesArray = [];
    if(switchNode.parameters.routingRules && Array.isArray(switchNode.parameters.routingRules.rules)) {
        rulesArray = switchNode.parameters.routingRules.rules;
    } else if (switchNode.parameters.rules && Array.isArray(switchNode.parameters.rules.rules)) {
        rulesArray = switchNode.parameters.rules.rules;
    } else if (switchNode.parameters.rules && Array.isArray(switchNode.parameters.rules.values)) { // version 3.2+
        rulesArray = switchNode.parameters.rules.values; 
    }
    
    let hasCekBooking = false;
    for(let r of rulesArray) if((r.outputName || r.outputKey) === 'cek_booking') hasCekBooking = true;
    
    if(!hasCekBooking && Array.isArray(switchNode.parameters.rules?.values)) {
        switchNode.parameters.rules.values.push({
            "conditions": {
                "options": { "caseSensitive": true, "leftValue": "", "typeValidation": "strict", "version": 2 },
                "conditions": [
                    { "id": "cek", "leftValue": "={{ $json.intent }}", "rightValue": "cek_booking", "operator": { "type": "string", "operation": "contains" } }
                ],
                "combinator": "and"
            },
            "renameOutput": true,
            "outputKey": "cek_booking" // Used outputKey in modern n8n
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

fs.writeFileSync('d:\\fitmorot\\n8n-workflows\\01_main_router.json', JSON.stringify(data, null, 2));
console.log("01 Main Router Patched Successfully");
