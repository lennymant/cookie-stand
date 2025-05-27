// src/app.js
const express = require('express');
const path = require('path');
const routes = require('./routes');
const state = require('./logic/state');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/api', routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🍪 Cookie Stand running on http://localhost:${PORT}`);
    // Start the game automatically
    state.startScheduler();
    console.log('🎮 Game started automatically');
});
