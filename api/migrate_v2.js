const mysql = require('mysql2/promise');
async function run() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', user: 'root', password: '', 
    database: 'fitmotor_crm', multipleStatements: true
  });
  
  // 1. Truncate all data tables
  console.log('[ FASE 1 ] Truncating tables...');
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of ['booking','sesi_chat','pelanggan','log_pesan','log_error','riwayat_servis']) {
    try { await conn.query('TRUNCATE TABLE `' + t + '`'); console.log('  TRUNCATE OK:', t); }
    catch(e) { console.log('  SKIP (not exists):', t); }
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  
  // 2. Update cabang data
  console.log('\n[ FASE 2 ] Updating cabang...');
  await conn.query("UPDATE cabang SET device_id = 'fitmotor_adiwerna',  nomor_wa = '6285609941624' WHERE id = 'adiwerna'");
  await conn.query("UPDATE cabang SET device_id = 'fitmotor_cikditiro', nomor_wa = '628113438800'  WHERE id = 'cikditiro'");
  await conn.query("UPDATE cabang SET device_id = 'fitmotor_pacul',     nomor_wa = '6283116105550' WHERE id = 'pacul'");
  await conn.query("UPDATE cabang SET device_id = 'fitmotor_pesalakan'  WHERE id = 'pesalakan'");
  await conn.query("UPDATE cabang SET device_id = 'fitmotor_trayeman'   WHERE id = 'trayeman'");
  console.log('  OK: cabang updated');
  
  // 3. Create Stored Procedure: cek_nopol_aktif
  console.log('\n[ FASE 3 ] Creating stored procedure...');
  await conn.query('DROP PROCEDURE IF EXISTS cek_nopol_aktif');
  await conn.query(`
    CREATE PROCEDURE cek_nopol_aktif(
      IN  p_nopol           VARCHAR(20),
      IN  p_cabang_id       VARCHAR(50),
      OUT o_is_blocked      TINYINT,
      OUT o_kode_existing   VARCHAR(20),
      OUT o_cabang_existing VARCHAR(50)
    )
    BEGIN
      DECLARE v_id     VARCHAR(20) DEFAULT NULL;
      DECLARE v_cabang VARCHAR(50) DEFAULT NULL;
      
      SELECT id, cabang_id 
      INTO   v_id, v_cabang
      FROM   booking
      WHERE  nopol = p_nopol
        AND  status IN ('pending', 'proses')
        AND  created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      ORDER BY created_at DESC
      LIMIT 1;
      
      IF v_id IS NOT NULL AND v_cabang != p_cabang_id THEN
        SET o_is_blocked      = 1;
        SET o_kode_existing   = v_id;
        SET o_cabang_existing = v_cabang;
      ELSE
        SET o_is_blocked      = 0;
        SET o_kode_existing   = NULL;
        SET o_cabang_existing = NULL;
      END IF;
    END
  `);
  console.log('  OK: procedure cek_nopol_aktif created');
  
  // 4. Verify
  console.log('\n[ VERIFY ] Cabang state:');
  const [rows] = await conn.query('SELECT id, nomor_wa, device_id FROM cabang');
  console.table(rows);
  
  const [procs] = await conn.query("SHOW PROCEDURE STATUS WHERE Db = 'fitmotor_crm' AND Name = 'cek_nopol_aktif'");
  console.log('Procedure exists:', procs.length > 0 ? 'YES ✓' : 'NO ✗');
  
  conn.end();
  console.log('\nMigration complete!');
}
run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
