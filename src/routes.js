// src/routes.js

const express = require('express');
const router = express.Router();
const state = require('./logic/state');
const ai = require('./logic/ai'); // ✅ Add this if missing
const config = require('./config');

// Game state tracking
let gameRunning = false;

// Register a new user (simple, no auth)
router.post('/register', async (req, res) => {
  const { userId, name } = req.body;
  if (!userId || !name) {
    return res.status(400).json({ error: 'userId and name are required' });
  }
  try {
    await state.registerUser(userId, name);
    res.json({ success: true });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Get current game state
router.get('/current', (req, res) => {
  const userId = req.query.userId;
  const currentState = state.getState(userId);
  res.json({
    ...currentState,
    gameRunning: state.isSchedulerRunning() // Sync with scheduler state
  });
});

// Cast a vote
router.post('/vote', (req, res) => {
  const { userId, optionId } = req.body;
  if (!userId || !optionId) {
    return res.status(400).json({ error: 'userId and optionId are required' });
  }

  state.vote(userId, optionId);
  res.json({ success: true });
});

// Get full round history (for dashboard)
router.get('/history', (req, res) => {
  const { strategy, companyProfile, roundHistory } = state.getState();
  res.json({ 
    strategy, 
    companyProfile, 
    history: roundHistory || [] 
  });
});

// Submit wildcard
router.post('/wildcard', async (req, res) => {
  const { userId, text } = req.body;
  if (!userId || !text) {
    return res.status(400).json({ error: 'userId and text are required' });
  }
  
  // Just log the wildcard - strategy update will happen with votes
  state.logWildcard(userId, text);
  // The log message is now handled in logWildcard function

  res.json({
    success: true,
    message: "Wildcard submitted successfully"
  });
});

// Get ticker log
router.get('/ticker', (req, res) => {
  const tickerLog = state.getTickerLog();
  res.json(tickerLog || []);
});

// Add ticker entry
router.post('/ticker', (req, res) => {
  const { type, month, timestamp } = req.body;
  if (type === 'month') {
    // Check if we already have a marker for this month
    const existingMonthMarker = state.getTickerLog().find(entry => 
      entry.type === 'month' && entry.month === month
    );
    
    if (!existingMonthMarker) {
      state.addTickerEntry({
        type: 'month',
        month,
        timestamp
      });
      res.json({ success: true });
    } else {
      res.json({ success: false, message: 'Month marker already exists' });
    }
  } else {
    res.status(400).json({ error: 'Invalid ticker entry type' });
  }
});

// Serve config to frontend
router.get('/config', (req, res) => {
  // Only send the intervals to the frontend
  res.json({
    intervals: config.intervals || {}
  });
});

// Force next round (for testing)
router.post('/force-next-round', (req, res) => {
  state.logWithTimestamp('Forcing next round...');
  state.updateStrategy(state.getState().strategy, "Round forced by admin", null);
  res.json({ success: true });
});

// Toggle game state
router.post('/toggle-game', (req, res) => {
  const { running } = req.body;
  
  if (running) {
    state.startScheduler();
    gameRunning = true;
    console.log('Game started');
  } else {
    state.stopScheduler();
    gameRunning = false;
    console.log('Game stopped');
  }
  
  res.json({ running: gameRunning });
});

// Get game state
router.get('/game-state', (req, res) => {
  res.json({ running: state.isSchedulerRunning() }); // Sync with scheduler state
});

// Update user name
router.post('/update-name', async (req, res) => {
  try {
    const { userId, name } = req.body;
    console.log('Updating name:', { userId, name });
    
    if (!userId) {
      console.error('Missing userId in request');
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    
    if (!name || name.trim() === '') {
      console.error('Missing or empty name in request');
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    
    // Update user name in state
    await state.registerUser(userId, name.trim());
    console.log('Name updated successfully');
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating name:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Restart game
router.post('/restart', (req, res) => {
  state.logWithTimestamp('Restarting game...');
  state.stopScheduler();
  state.initialize().then(() => {
    state.startScheduler();
    res.json({ success: true });
  }).catch(error => {
    res.status(500).json({ error: error.message });
  });
});

module.exports = router;
