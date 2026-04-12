const fs = require('fs');

let data = JSON.parse(fs.readFileSync('d:\\fitmorot\\n8n-workflows\\01_main_router.json', 'utf8'));

let arahkan = data.nodes.find(n => n.name === 'Arahkan Sesi');
if (arahkan) {
    let rules = arahkan.parameters.rules.values;
    
    // Check if BKG rule already exists to avoid dupes
    let hasBkgRule = rules.some(r => r.outputKey === 'cek_booking_bypass');
    
    if (!hasBkgRule) {
        // Shift fallback pointer
        arahkan.parameters.options.fallbackOutput = 3;
        
        let newRule = {
          "conditions": {
            "options": {
              "caseSensitive": false,
              "leftValue": "",
              "typeValidation": "strict",
              "version": 1
            },
            "conditions": [
              {
                "leftValue": "={{ $('Extract: nomor_wa & pesan').item.json.pesan.toUpperCase() }}",
                "rightValue": "BKG-",
                "operator": {
                  "type": "string",
                  "operation": "contains"
                },
                "id": "bkg-global-intercept"
              }
            ],
            "combinator": "and"
          },
          "renameOutput": true,
          "outputKey": "cek_booking_bypass"
        };
        
        // Unshift pushes it to index 0, but shifting rules in n8n requires shifting physical connections!
        // It's SAFER to PUSH it as the LAST rule before fallback. So index 2!
        rules.push(newRule); 
        
        // Update connections for Arahkan Sesi
        let conns = data.connections['Arahkan Sesi']['main'];
        
        // Current: [ [Booking], [Jemput], [LLM] ]
        // New index 2 is the new rule. New index 3 is Fallback.
        let llmChain = conns[2]; // Save the LLM node connection
        
        // Create new output for index 2
        conns[2] = [ { "node": "Route: Cek Booking Flow", "type": "main", "index": 0 } ];
        
        // Push the LLM chain to index 3 (Fallback)
        conns[3] = llmChain;
    }
}

fs.writeFileSync('d:\\fitmorot\\n8n-workflows\\01_main_router.json', JSON.stringify(data, null, 2));
console.log("Global BKG Interceptor Active!");
