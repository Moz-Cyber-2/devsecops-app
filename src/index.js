'use strict';

const express    = require('express');
const bodyParser = require('body-parser');
const jwt        = require('jsonwebtoken');

const { registerAdminRoutes } = require('./admin');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// -----------------------------------------------------------------------
// INTENTIONAL VULNERABILITY — for DevSecOps demo purposes only
// -----------------------------------------------------------------------

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

registerAdminRoutes(app);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[devsecops-demo] App running on port ${PORT}`);
});
