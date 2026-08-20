'use strict';

// -----------------------------------------------------------------------
// INTENTIONAL VULNERABILITY — for DevSecOps demo purposes only
// Do NOT deploy this in production
// -----------------------------------------------------------------------

// Hardcoded secret — TruffleHog custom detector will flag this
const API_KEY = 'secret-found-placeholder';

// Route registration
function registerAdminRoutes(app) {

  // RCE via eval() — Semgrep will flag this (CWE-95, OWASP A03:2021)
  app.post('/api/v1/admin/eval', (req, res) => {
    const { expression } = req.body;
    try {
      // eslint-disable-next-line no-eval
      const result = eval(expression);
      res.json({ result });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  // Debug endpoint — leaks the hardcoded key
  app.get('/api/v1/admin/debug', (req, res) => {
    res.json({ apiKey: API_KEY, uptime: process.uptime() });
  });
}

module.exports = { registerAdminRoutes };
