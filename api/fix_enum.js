const mysql = require('mysql2/promise');

async function fixDB() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'fitmotor_crm'
  });

  console.log('Altering booking status ENUM...');
  await conn.execute("ALTER TABLE booking MODIFY status ENUM('pending','proses','selesai','batal','confirmed') NOT NULL DEFAULT 'pending'");
  
  console.log('Resetting empty string statuses back to pending...');
  const [res] = await conn.execute("UPDATE booking SET status = 'pending' WHERE status = ''");
  console.log(`Fixed ${res.affectedRows} rows.`);
  
  conn.end();
}

fixDB().catch(console.error);
