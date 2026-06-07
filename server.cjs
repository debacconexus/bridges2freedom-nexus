const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let pool = null;
try {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });
} catch(e) { console.log('DB error:', e.message); }

async function initDB() {
  if (!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS participants (id SERIAL PRIMARY KEY, first_name VARCHAR(100), last_name VARCHAR(100), phone VARCHAR(30), program VARCHAR(100), status VARCHAR(50) DEFAULT 'Active', case_worker VARCHAR(100), notes TEXT, created_at TIMESTAMP DEFAULT NOW())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS contacts (id SERIAL PRIMARY KEY, participant_id INTEGER, contact_date TIMESTAMP DEFAULT NOW(), contact_type VARCHAR(50), case_worker VARCHAR(100), notes TEXT, governed_note TEXT)`);
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/stats', async (req, res) => {
  try {
    if (!pool) return res.json({ success: true, total: 0, active: 0, contacts: 0 });
    const t = await pool.query('SELECT COUNT(*) as count FROM participants');
    const a = await pool.query("SELECT COUNT(*) as count FROM participants WHERE status='Active'");
    const c = await pool.query('SELECT COUNT(*) as count FROM contacts');
    res.json({ success: true, total: t.rows[0].count, active: a.rows[0].count, contacts: c.rows[0].count });
  } catch(e) { res.json({ success: true, total: 0, active: 0, contacts: 0 }); }
});

app.get('/api/participants', async (req, res) => {
  try {
    if (!pool) return res.json({ success: true, participants: [] });
    const r = await pool.query('SELECT * FROM participants ORDER BY last_name ASC');
    res.json({ success: true, participants: r.rows });
  } catch(e) { res.json({ success: true, participants: [] }); }
});

app.post('/api/participants', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'DB not available' });
    const { first_name, last_name, phone, program, status, case_worker, notes } = req.body;
    const r = await pool.query(
      'INSERT INTO participants (first_name, last_name, phone, program, status, case_worker, notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [first_name, last_name, phone, program, status||'Active', case_worker, notes]
    );
    res.json({ success: true, participant: r.rows[0] });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.post('/api/contacts', async (req, res) => {
  try {
    if (!pool) return res.json({ success: false, error: 'DB not available' });
    const { participant_id, contact_type, case_worker, notes } = req.body;
    const governed = (notes || '') + ' [IGM-GOVERNED]';
    const r = await pool.query(
      'INSERT INTO contacts (participant_id, contact_type, case_worker, notes, governed_note) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [participant_id, contact_type, case_worker, notes, governed]
    );
    res.json({ success: true, contact: r.rows[0] });
  } catch(e) { res.json({ success: false, error: e.message }); }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('Bridges2Freedom Nexus running on port ' + PORT);
    console.log('IGM Governed | USPTO 19/571,156 | DeBacco Nexus LLC');
  });
}).catch(err => {
  console.error('Init error:', err.message);
  app.listen(PORT, '0.0.0.0', () => console.log('Running on port ' + PORT));
});
