const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: '', database: 'fitmotor_crm'
  });
  
  // Fix booking dengan status kosong
  const [r] = await conn.execute(
    "UPDATE booking SET status = 'pending' WHERE status = '' OR status IS NULL"
  );
  console.log('Fixed rows:', r.affectedRows);
  
  const [rows] = await conn.execute('SELECT id, status FROM booking');
  console.log('Current booking:', rows);
  conn.end();
}
run().catch(console.error);
