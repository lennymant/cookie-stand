// src/app.js
const express = require('express');
const path = require('path');
const routes = require('./routes');
const state = require('./logic/state');
const config = require('./config');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/api', routes);
app.use('/cookie-stand/api', routes);

const PORT = process.env.PORT || config.server.port;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🍪 Cookie Stand running on http://192.168.137.1:${PORT}`);
    state.startScheduler();
    console.log('🎮 Game started automatically');
});
