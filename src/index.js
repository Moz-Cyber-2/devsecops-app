'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const jwt = require('jsonwebtoken');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// -----------------------------------------------------------------------
// INTENTIONAL VULNERABILITIES — for DevSecOps demo purposes only
// Do NOT deploy this in production
// -----------------------------------------------------------------------

// API8:2023 — Security Misconfiguration: hardcoded credentials
const DB_CONFIG = {
  host: 'localhost',
  user: 'root',
  password: 'SuperSecret123!',       // hardcoded DB password
  database: 'appdb',
};

// API8:2023 — hardcoded AWS credentials (TruffleHog / Semgrep will catch this)
const AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
const AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

// API2:2023 — Broken Authentication: JWT_SECRET hardcoded AND weak
const JWT_SECRET = 'secret123';

const db = mysql.createConnection(DB_CONFIG);

// -----------------------------------------------------------------------
// Health check
// -----------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// -----------------------------------------------------------------------
// API8:2023 — Debug endpoint left open in production
// Exposes environment variables, config, and internal paths
// -----------------------------------------------------------------------
app.get('/api/debug', (req, res) => {
  res.json({
    env: process.env,
    config: DB_CONFIG,
    aws: { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY },
    uptime: process.uptime(),
  });
});

// -----------------------------------------------------------------------
// API2:2023 — Broken Authentication
// JWT is decoded without verifying the signature — any token is accepted
// -----------------------------------------------------------------------
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  // VULNERABILITY: jwt.decode() does NOT verify the signature
  // An attacker can forge any payload and pass auth
  const decoded = jwt.decode(token);
  if (!decoded) return res.status(401).json({ error: 'Invalid token' });

  req.user = decoded;
  next();
}

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  // No rate limiting, no lockout — API4:2023 Unrestricted Resource Consumption
  // SQL Injection: API1 + CWE-89
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  db.query(query, (err, results) => {
    if (err) {
      // Leaks internal DB error to client — API8
      return res.status(500).json({ error: err.message, query });
    }
    if (results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: results[0].id, username: results[0].username, role: results[0].role }, JWT_SECRET);
    res.json({ token });
  });
});

// -----------------------------------------------------------------------
// API1:2023 — Broken Object Level Authorization (BOLA)
// Any authenticated user can read ANY order by ID — no ownership check
// -----------------------------------------------------------------------
app.get('/api/orders/:id', authMiddleware, (req, res) => {
  const orderId = req.params.id;
  // VULNERABILITY: no check that req.user.id owns orderId
  const query = `SELECT * FROM orders WHERE id = ${orderId}`;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(results[0]);
  });
});

// -----------------------------------------------------------------------
// API3:2023 — Broken Object Property Level Authorization (Mass Assignment)
// Entire request body spread into UPDATE — attacker can set role: 'admin'
// -----------------------------------------------------------------------
app.put('/api/users/:id', authMiddleware, (req, res) => {
  const userId = req.params.id;
  // VULNERABILITY: no field allowlist — attacker can pass { role: 'admin' }
  const fields = Object.entries(req.body)
    .map(([k, v]) => `${k} = '${v}'`)
    .join(', ');
  const query = `UPDATE users SET ${fields} WHERE id = ${userId}`;
  db.query(query, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'User updated' });
  });
});

// -----------------------------------------------------------------------
// API5:2023 — Broken Function Level Authorization
// Admin-only endpoint has NO role check whatsoever
// -----------------------------------------------------------------------
app.delete('/api/admin/users/:id', authMiddleware, (req, res) => {
  // VULNERABILITY: any authenticated user can delete any other user
  const query = `DELETE FROM users WHERE id = ${req.params.id}`;
  db.query(query, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `User ${req.params.id} deleted` });
  });
});

// -----------------------------------------------------------------------
// API9:2023 — Improper Inventory Management
// Old v1 API endpoint still active, undocumented, no auth
// -----------------------------------------------------------------------
app.get('/api/v1/users', (req, res) => {
  // VULNERABILITY: legacy endpoint, no auth, returns all users
  db.query('SELECT id, username, email, role FROM users', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// -----------------------------------------------------------------------
// XSS — reflected input without sanitisation
// -----------------------------------------------------------------------
app.get('/api/search', (req, res) => {
  const { q } = req.query;
  // VULNERABILITY: unsanitised input reflected back in response
  res.send(`<html><body>Search results for: ${q}</body></html>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[devsecops-demo] Vulnerable API running on port ${PORT}`);
  console.log('[WARNING] This app is intentionally vulnerable. Demo use only.');
});
