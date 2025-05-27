// src/logic/state.js
const ai = require('./ai');
const config = require('../config');
const fs = require('fs').promises;
const path = require('path');

// Helper function for timestamped logs
function logWithTimestamp(message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${message}`);
}

// Initialize state variables
let strategy = config.company.initialStrategy;
let companyProfile = config.company.initialProfile;
let currentScenario = null;
let options = []; // { id, text, alignment, explanation, votes: [] }
let roundHistory = [];
let users = []; // { id, name }
let tickerLog = []; // [{ type, user, option, timestamp }]
let votingAnalysis = null; // Store the latest voting analysis
let isInitialized = false;
let currentMonth = 0; // Change round counter to month counter

const USERS_FILE = path.join(__dirname, '../../data/users.json');

// Load users from file if available
async function loadUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, 'utf8');
    users = JSON.parse(data);
    logWithTimestamp(`Loaded ${users.length} users from file`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error loading users from file:', error);
    }
    // If file doesn't exist or other error, start with empty users array
    users = [];
  }
}

// Save users to file whenever they change
async function saveUsers() {
  try {
    // Ensure the data directory exists
    await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    logWithTimestamp(`Saved ${users.length} users to file`);
  } catch (error) {
    console.error('Error saving users to file:', error);
  }
}

// Load users when the module initializes
loadUsers().catch(error => {
  console.error('Failed to load users:', error);
});

// Strategy timing
const STRATEGY_DURATION = config.intervals.strategyDuration;
let strategyStartTime = Date.now();

// Scheduler control variables
let schedulerRunning = false;
let schedulerTimeout = null;
let roundInProgress = false;
let lastRoundTime = Date.now();

// Log initial state
logWithTimestamp('Initial state:');
logWithTimestamp(`Strategy: ${strategy}`);
logWithTimestamp(`Company Profile: ${companyProfile}`);

function getStrategyTimeRemaining() {
  if (!schedulerRunning) {
    return 0;
  }
  const elapsed = Date.now() - strategyStartTime;
  const remaining = Math.max(0, STRATEGY_DURATION - elapsed);
  return Math.ceil(remaining / 1000); // Convert to seconds
}

// Initialize with a new scenario
async function initialize() {
  try {
    logWithTimestamp('Starting game state initialization...');
    logWithTimestamp('Initial company profile:', companyProfile);
    
    // First try to get initial values from config
    if (!companyProfile) {
      companyProfile = config.company.initialProfile;
      logWithTimestamp('Using initial profile from config:', companyProfile);
    }
    
    if (!strategy) {
      strategy = config.company.initialStrategy;
      logWithTimestamp('Using initial strategy from config:', strategy);
    }

    // Generate initial scenario
    const initialScenario = await ai.generateScenario();
    logWithTimestamp('Generated initial scenario:', initialScenario);
    currentScenario = initialScenario;

    const result = await ai.processRound({
      currentStrategy: strategy,
      currentScenario: initialScenario,
      currentProfile: companyProfile
    });
    
    logWithTimestamp('Received initialization result:', result);
    
    if (!result) {
      throw new Error('No result received from processRound');
    }

    if (!result.options || !Array.isArray(result.options)) {
      throw new Error('Invalid options in initialization result');
    }

    if (!result.newProfile) {
      logWithTimestamp('Warning: No new profile in result, using existing profile');
    } else {
      companyProfile = result.newProfile;
    }

    if (!result.newStrategy) {
      logWithTimestamp('Warning: No new strategy in result, using existing strategy');
    } else {
      strategy = result.newStrategy;
    }

    // Keep the generated scenario if no new one is provided
    if (!result.newScenario) {
      logWithTimestamp('Warning: No new scenario in result, using generated scenario');
    } else {
      currentScenario = result.newScenario;
    }

    options = result.options.map((opt, i) => ({
      id: `${Date.now()}_${i}`,
      text: opt.text || "Option " + (i + 1),
      alignment: opt.alignment || 0,
      explanation: opt.explanation || '',
      votes: []
    }));

    logWithTimestamp(`Initialized with ${options.length} options`);
    logWithTimestamp('Updated company profile:', companyProfile);
    logWithTimestamp('Updated strategy:', strategy);
    logWithTimestamp('Current scenario:', currentScenario);
    isInitialized = true;
  } catch (error) {
    logWithTimestamp(`Failed to initialize: ${error.message}`);
    logWithTimestamp('Stack trace:', error.stack);
    
    // Set some default values even if initialization fails
    if (!companyProfile) companyProfile = config.company.initialProfile;
    if (!strategy) strategy = config.company.initialStrategy;
    if (!currentScenario) currentScenario = "Waiting for first scenario...";
    if (!options.length) {
      options = [
        {
          id: `${Date.now()}_0`,
          text: "Option 1",
          alignment: 0,
          explanation: '',
          votes: []
        }
      ];
    }
    
    isInitialized = true; // Mark as initialized even with defaults
    logWithTimestamp('Using default values after initialization failure');
    logWithTimestamp('Current state:', getState());
  }
}

// Call initialize when the module loads
initialize().catch(error => {
  logWithTimestamp('Fatal error during initialization:', error);
  // Set default values
  companyProfile = config.company.initialProfile;
  strategy = config.company.initialStrategy;
  currentScenario = "Waiting for first scenario...";
  options = [
    {
      id: `${Date.now()}_0`,
      text: "Option 1",
      alignment: 0,
      explanation: '',
      votes: []
    }
  ];
  isInitialized = true;
  logWithTimestamp('Using default values after initialization failure');
  logWithTimestamp('Current state:', getState());
});

function resetRound(scenario, newOptions) {
  currentScenario = scenario;
  options = newOptions.map((opt, i) => ({
    id: `${Date.now()}_${i}`,
    ...opt,
    votes: []
  }));
}

function vote(userId, optionId) {
  // Remove any existing votes from this user
  options.forEach(opt => {
    const index = opt.votes.indexOf(userId);
    if (index !== -1) opt.votes.splice(index, 1);
  });

  const selected = options.find(o => o.id === optionId);
  const user = users.find(u => u.id === userId);

  if (selected && !selected.votes.includes(userId)) {
    // Store both userId and displayName with the vote
    const displayName = user?.name || "Anonymous";
    selected.votes.push({
      userId: userId,
      displayName: displayName
    });

    // Log vote to console
    logWithTimestamp(`Vote received from ${displayName} for option: "${selected.text}"`);

    // Ticker log entry
    tickerLog.push({
      type: 'vote',
      user: displayName,
      option: selected.text,
      timestamp: new Date().toISOString()
    });

    if (tickerLog.length > config.ui.maxTickerEntries) tickerLog.shift();
  }
}

function logWildcard(userId, text) {
  const user = users.find(u => u.id === userId);
  const displayName = user?.name || "Anonymous";
  
  tickerLog.push({
    type: 'wildcard',
    user: displayName,
    option: text,
    timestamp: new Date().toISOString()
  });

  if (tickerLog.length > config.ui.maxTickerEntries) tickerLog.shift();
  
  // Add the log message with display name
  logWithTimestamp(`Wildcard submitted by ${displayName}: "${text}"`);
}

function getVotes() {
  return options.map(opt => ({
    id: opt.id,
    text: opt.text,
    votes: opt.votes.map(v => typeof v === 'string' ? { userId: v, displayName: 'Anonymous' } : v),
    alignment: opt.alignment
  }));
}

function getState(userId) {
  if (!isInitialized) {
    logWithTimestamp('State not initialized, returning default values');
    return {
      strategy: strategy || "Initializing...",
      companyProfile: companyProfile || "Initializing...",
      scenario: currentScenario || "Initializing...",
      currentScenario: currentScenario || "Initializing...",
      options: [],
      users: [],
      roundHistory: [],
      strategyTimeRemaining: 60,
      userName: null,
      votingAnalysis: null,
      currentMonth: 0
    };
  }
  
  const user = userId ? users.find(u => u.id === userId) : null;
  const state = {
    strategy: strategy || "Initializing...",
    companyProfile: companyProfile || "Initializing...",
    scenario: currentScenario || "Initializing...",
    currentScenario: currentScenario || "Initializing...",
    options,
    users,
    roundHistory,
    strategyTimeRemaining: getStrategyTimeRemaining(),
    userName: user ? user.name : null,
    votingAnalysis,
    currentMonth
  };
  
  // Only log if there's a significant state change
  if (state.strategyTimeRemaining === 0 || state.strategyTimeRemaining === 60) {
    logWithTimestamp(`Strategy time remaining: ${state.strategyTimeRemaining}s`);
  }
  
  return state;
}

async function updateStrategy(newStrategy, commentary, selectedOption) {
  // Get recent votes and wildcards
  const recentVotes = tickerLog
    .filter(entry => entry.type === 'vote')
    .map(entry => ({ user: entry.user, option: entry.option }));
  
  const recentWildcards = tickerLog
    .filter(entry => entry.type === 'wildcard')
    .map(entry => ({ user: entry.user, option: entry.option }));

  try {
    const timestamp = new Date().toLocaleTimeString();
    console.log('\n' + '='.repeat(80));
    console.log(`[${timestamp}] PROCESSING NEW ROUND`);
    console.log('='.repeat(80));
    
    // Only randomly select a vote if enabled in config
    if (config.game.enableRandomVotes && recentVotes.length === 0 && recentWildcards.length === 0 && options.length > 0) {
      const randomIndex = Math.floor(Math.random() * options.length);
      const randomOption = options[randomIndex];
      recentVotes.push({
        user: 'system',
        option: randomOption.text
      });
      logWithTimestamp(`No votes or wildcards - randomly selected: "${randomOption.text}"`);
    }
    
    // Log the inputs
    if (recentVotes.length > 0) {
      console.log('\nRecent Votes:');
      console.log('-'.repeat(40));
      recentVotes.forEach(v => console.log(`- ${v.user}: "${v.option}"`));
    }
    
    if (recentWildcards.length > 0) {
      console.log('\nRecent Wildcards:');
      console.log('-'.repeat(40));
      recentWildcards.forEach(w => console.log(`- ${w.user}: "${w.option}"`));
    }

    console.log('\nCurrent Company Profile:');
    console.log('-'.repeat(40));
    console.log(companyProfile);
    console.log('-'.repeat(40) + '\n');

    // Get voting analysis
    console.log('Generating voting analysis with:', {
      votes: recentVotes,
      wildcards: recentWildcards
    });
    votingAnalysis = await ai.analyzeVotingPatterns(recentVotes, recentWildcards);
    console.log('Generated voting analysis:', votingAnalysis);
    console.log('-'.repeat(40));

    const result = await ai.processRound({
      currentStrategy: strategy,
      currentScenario,
      currentProfile: companyProfile,
      votes: recentVotes,
      wildcards: recentWildcards,
      timeExpired: getStrategyTimeRemaining() === 0
    });

    // Validate the result
    if (!result) {
      throw new Error('No result received from processRound');
    }

    if (!result.newStrategy) {
      console.warn('No new strategy in result, using current strategy');
      result.newStrategy = strategy;
    }

    if (!result.newProfile) {
      console.warn('No new profile in result, using current profile');
      result.newProfile = companyProfile;
    }

    if (!result.newScenario) {
      console.warn('No new scenario in result, using current scenario');
      result.newScenario = currentScenario;
    }

    if (!result.options || !Array.isArray(result.options)) {
      console.warn('Invalid options in result, using current options');
      result.options = options;
    }

    // Update state with new values
    strategy = result.newStrategy;
    companyProfile = result.newProfile;
    currentScenario = result.newScenario;
    options = result.options.map((opt, i) => ({
      id: `${Date.now()}_${i}`,
      ...opt,
      votes: []
    }));

    console.log('New Company Profile:');
    console.log('-'.repeat(40));
    console.log(companyProfile);
    console.log('-'.repeat(40));
    console.log('='.repeat(80) + '\n');

    // Record in history
    roundHistory.push({
      timestamp: new Date().toISOString(),
      scenario: currentScenario,
      selected: selectedOption,
      commentary,
      strategy: newStrategy,
      companyProfile,
      votes: recentVotes,
      wildcards: recentWildcards,
      votingAnalysis
    });

    // Trim history if it gets too long
    if (roundHistory.length > config.ui.maxHistoryEntries) {
      roundHistory = roundHistory.slice(-config.ui.maxHistoryEntries);
    }

    // Reset the timer AFTER all updates are complete
    strategyStartTime = Date.now();
    logWithTimestamp('Timer reset after strategy update');
  } catch (error) {
    logWithTimestamp(`Failed to process round update: ${error.message}`);
    logWithTimestamp('Stack trace:', error.stack);
    
    // Keep the current state if update fails
    logWithTimestamp('Keeping current state after update failure');
    logWithTimestamp('Current state:', getState());
  }
}

function getTickerLog() {
  return tickerLog.slice(-10).reverse(); // newest first
}

async function registerUser(id, name) {
  try {
    console.log('Registering/updating user:', { id, name });
    
    // Ensure name is never user_ prefixed
    if (!name || name.startsWith('user_')) {
      name = "Anonymous";
    }

    const existingUser = users.find(u => u.id === id);
    if (existingUser) {
      existingUser.name = name;
      logWithTimestamp(`Updated user name: ${name} (${id})`);
      
      // Update name in existing votes
      options.forEach(opt => {
        opt.votes = opt.votes.map(vote => {
          if (typeof vote === 'string' && vote === id) {
            return { userId: id, displayName: name };
          }
          if (typeof vote === 'object' && vote.userId === id) {
            return { ...vote, displayName: name };
          }
          return vote;
        });
      });

      // Update name in ticker log
      tickerLog = tickerLog.map(entry => {
        if (entry.user === existingUser.name) {
          return { ...entry, user: name };
        }
        return entry;
      });
    } else {
      users.push({ id, name });
      logWithTimestamp(`New user registered: ${name} (${id})`);
    }
    
    // Save users after any change
    await saveUsers();
    
    return true;
  } catch (error) {
    console.error('Error in registerUser:', error);
    throw error;
  }
}

// Modify the beginScheduler function to use the timeout variable
function beginScheduler() {
  if (!schedulerRunning) return;
  
  console.log("🕒 Scheduler ready. Starting first round in 3 seconds...");
  strategyStartTime = Date.now(); // Reset timer when starting
  schedulerTimeout = setTimeout(startRound, 3000); // warm-up
}

// Modify startRound to use the timeout variable
async function startRound() {
  if (!schedulerRunning) return;
  
  if (roundInProgress) {
    console.log("⏳ Round already in progress, skipping...");
    return;
  }

  currentMonth++; // Increment month counter
  console.log(`\n🌀 Starting Month ${currentMonth}...`);
  roundInProgress = true;
  lastRoundTime = Date.now();
  strategyStartTime = Date.now(); // Reset timer for this round

  try {
    const currentState = getState();
    const strategy = currentState.strategy;

    // Step 1: Generate scenario
    const scenario = await ai.generateScenario();
    console.log(`📢 Month ${currentMonth} Scenario:`, scenario);
    currentScenario = scenario; // Update the current scenario immediately

    // Step 2: Generate options
    const rawOptions = await ai.generateOptions(scenario);

    // Step 3: Score alignment
    const scoredOptions = await Promise.all(
      rawOptions.map(async (opt) => {
        const result = await ai.scoreAlignment(strategy, opt.text);
        return {
          text: opt.text,
          alignment: result.alignment,
          explanation: result.explanation
        };
      })
    );

    // Step 4: Store for voting
    resetRound(scenario, scoredOptions);

    // Step 5: Wait for strategy duration, then resolve
    schedulerTimeout = setTimeout(resolveRound, config.intervals.strategyDuration);
  } catch (error) {
    console.error("❌ Error in round:", error);
    roundInProgress = false;
    // Try again after a short delay
    schedulerTimeout = setTimeout(startRound, 5000);
  }
}

// Modify resolveRound to use the timeout variable
async function resolveRound() {
  try {
    const votes = getVotes();
    const winning = votes.sort((a, b) => b.votes - a.votes)[0];

    if (!winning) {
      console.log("⚠️ No votes this round. Strategy unchanged.");
      roundInProgress = false;
      // Start next round after a short delay
      if (schedulerRunning) {
        schedulerTimeout = setTimeout(startRound, 1000);
      }
      return;
    }

    console.log("✅ Winning Option:", winning.text);

    // Step 6: Update strategy
    const { newStrategy, commentary } = await ai.updateStrategy(
      getState().strategy,
      winning.text
    );

    updateStrategy(newStrategy, commentary, winning);

    console.log("🎯 New Strategy:", newStrategy);
    console.log("💬 Commentary:", commentary);
  } catch (error) {
    console.error("❌ Error resolving round:", error);
  } finally {
    roundInProgress = false;
    // Start the next round after a short delay
    if (schedulerRunning) {
      schedulerTimeout = setTimeout(startRound, 1000);
    }
  }
}

function startScheduler() {
  if (schedulerRunning) return;
  schedulerRunning = true;
  strategyStartTime = Date.now(); // Reset timer when starting
  beginScheduler();
}

function stopScheduler() {
  schedulerRunning = false;
  if (schedulerTimeout) {
    clearTimeout(schedulerTimeout);
    schedulerTimeout = null;
  }
  roundInProgress = false;
  strategyStartTime = Date.now(); // Reset timer when stopping
}

function isSchedulerRunning() {
  return schedulerRunning;
}

module.exports = {
  resetRound,
  vote,
  logWildcard,
  getVotes,
  getState,
  updateStrategy,
  registerUser,
  getTickerLog,
  logWithTimestamp,
  startScheduler,
  stopScheduler,
  isSchedulerRunning
};
