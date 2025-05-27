// src/app.js
const express = require('express');
const path = require('path');
const routes = require('./routes');
const state = require('./logic/state');
const config = require('./config');

const app = express();
app.use(express.json());

// Serve static files from the base path
app.use(config.server.basePath, express.static(path.join(__dirname, '../public')));

// Mount API routes under the base path
app.use(`${config.server.basePath}/api`, routes);

const PORT = process.env.PORT || config.server.port;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🍪 Cookie Stand running on http://localhost:${PORT}${config.server.basePath}`);
    state.startScheduler();
    console.log('🎮 Game started automatically');
});
