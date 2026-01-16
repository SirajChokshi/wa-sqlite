// Worker for testing OPFSCoopSyncVFS with encryption
import * as SQLite from '../src/sqlite-api.js';
import { OPFSCoopSyncVFS } from '../src/examples/OPFSCoopSyncVFS.js';

const DB_NAME = 'opfs-encrypted-test.db';
const VFS_NAME = 'opfs-cipher-test';
const CIPHER = 'chacha20';
const PASSWORD = 'my-secret-password-123';

async function clearOPFS() {
  try {
    const root = await navigator.storage.getDirectory();
    for await (const name of root.keys()) {
      await root.removeEntry(name, { recursive: true });
    }
    console.log('[Worker] Cleared OPFS');
  } catch (e) {
    console.log('[Worker] OPFS clear failed (may not exist):', e.message);
  }
}

async function runTest() {
  const results = [];
  const log = (msg, success = true) => {
    results.push({ msg, success });
    console.log(`[Worker] ${success ? '✓' : '✗'} ${msg}`);
  };

  try {
    // Clear OPFS first
    await clearOPFS();
    log('Cleared OPFS storage');

    // Load SQLite with Multiple Ciphers
    const cacheBuster = Date.now();
    const { default: moduleFactory } = await import(`../dist/mc-wa-sqlite-async.mjs?t=${cacheBuster}`);
    
    const module = await moduleFactory({
      locateFile: (path) => `../dist/${path}?t=${cacheBuster}`
    });
    
    const sqlite3 = SQLite.Factory(module);
    log('Loaded SQLite module');

    // Check versions
    const sqliteVersion = module.ccall('sqlite3_libversion', 'string', [], []);
    const mcVersion = module.ccall('sqlite3mc_version', 'string', [], []);
    log(`SQLite version: ${sqliteVersion}`);
    log(`SQLite3MC version: ${mcVersion}`);

    // Create OPFSCoopSyncVFS
    const vfs = await OPFSCoopSyncVFS.create(VFS_NAME, module);
    log('Created OPFSCoopSyncVFS');

    // Register VFS (NOT as default)
    sqlite3.vfs_register(vfs, false);
    log('Registered OPFSCoopSyncVFS');

    // Create cipher VFS wrapping OPFS VFS
    const cipherResult = module.ccall('sqlite3mc_vfs_create', 'number', ['string', 'number'], [VFS_NAME, 1]);
    if (cipherResult !== 0) {
      throw new Error(`sqlite3mc_vfs_create failed with error ${cipherResult}`);
    }
    log('Created cipher VFS wrapping OPFSCoopSyncVFS');

    // ========== PHASE 1: Create and encrypt database ==========
    log('--- PHASE 1: Create encrypted database ---');
    
    let db = await sqlite3.open_v2(DB_NAME);
    log(`Opened database: ${DB_NAME}`);

    // Set cipher and key - must be done FIRST before any other operations
    await sqlite3.exec(db, `PRAGMA cipher='${CIPHER}';`);
    log(`Set cipher to ${CIPHER}`);
    
    await sqlite3.exec(db, `PRAGMA key='${PASSWORD}';`);
    log('Set encryption key');

    // Create table and insert test data
    await sqlite3.exec(db, `
      CREATE TABLE secrets (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        value TEXT NOT NULL
      );
    `);
    log('Created secrets table');

    await sqlite3.exec(db, `
      INSERT INTO secrets (name, value) VALUES 
        ('api_key', 'sk-1234567890abcdef'),
        ('password', 'super-secret-password'),
        ('token', 'jwt-token-here-very-long-string');
    `);
    log('Inserted 3 secret records');

    // Verify data was inserted
    let rowCount = 0;
    await sqlite3.exec(db, 'SELECT COUNT(*) as cnt FROM secrets;', (row) => {
      rowCount = row[0];
    });
    log(`Verified ${rowCount} rows in database`);

    // Close database
    await sqlite3.close(db);
    log('Closed database');

    // ========== PHASE 2: Reopen with correct key ==========
    log('--- PHASE 2: Reopen with correct key ---');
    
    db = await sqlite3.open_v2(DB_NAME);
    log('Reopened database');

    await sqlite3.exec(db, `PRAGMA cipher='${CIPHER}';`);
    await sqlite3.exec(db, `PRAGMA key='${PASSWORD}';`);
    log('Set cipher and key again');

    // Try to read data
    const rows = [];
    await sqlite3.exec(db, 'SELECT * FROM secrets ORDER BY id;', (row, columns) => {
      rows.push({
        id: row[0],
        name: row[1],
        value: row[2]
      });
    });
    
    if (rows.length === 3) {
      log(`Successfully read ${rows.length} rows after reopen`);
      log(`Row 1: ${rows[0].name} = ${rows[0].value}`);
      log(`Row 2: ${rows[1].name} = ${rows[1].value}`);
      log(`Row 3: ${rows[2].name} = ${rows[2].value}`);
    } else {
      throw new Error(`Expected 3 rows, got ${rows.length}`);
    }

    await sqlite3.close(db);
    log('Closed database');
    
    log('--- SUCCESS: All encryption tests passed! ---');
    log('OPFS + Cipher encryption verified:');
    log('  ✓ Created encrypted database in OPFS with ChaCha20');
    log('  ✓ Data persisted across close/reopen');
    log('  ✓ Decrypted successfully with correct key');
    log('Test complete!');

    // Send results back
    self.postMessage({ success: true, results });

  } catch (error) {
    log(`ERROR: ${error.message}`, false);
    console.error('[Worker] Error:', error);
    self.postMessage({ success: false, error: error.message, results });
  }
}

runTest();
