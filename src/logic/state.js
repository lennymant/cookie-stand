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
let currentMonth = 1; // Start at month 1
let votedUsers = new Set(); // Track users who have voted in the current round
let roundInProgress = false; // Track if a round is in progress
let votingAnalysisTimer = null;

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
    
    // Set initial values
    strategy = config.company.initialStrategy;
    companyProfile = config.company.initialProfile;
    currentScenario = "Welcome to Cookie Stand! Let's start our first month.";
    currentMonth = 1;
    
    // Get initial options
    const result = await ai.processRound({
      currentStrategy: strategy,
      currentScenario: currentScenario,
      currentProfile: companyProfile
    });

    if (!result || !result.options || !Array.isArray(result.options)) {
      throw new Error('Invalid options in initialization result');
    }

    // Initialize options
    options = result.options.map((opt, i) => ({
      id: `${Date.now()}_${i}`,
      text: opt.text || "Option " + (i + 1),
      alignment: opt.alignment || 0,
      explanation: opt.explanation || '',
      votes: []
    }));

    // Set round as in progress
    roundInProgress = true;
    
    logWithTimestamp('Game initialized:', {
      strategy,
      currentMonth,
      optionsCount: options.length,
      roundInProgress
    });

    isInitialized = true;
  } catch (error) {
    logWithTimestamp(`Failed to initialize: ${error.message}`);
    logWithTimestamp('Stack trace:', error.stack);
    
    // Set default values even if initialization fails
    strategy = config.company.initialStrategy;
    companyProfile = config.company.initialProfile;
    currentScenario = "Welcome to Cookie Stand! Let's start our first month.";
    currentMonth = 1;
    options = [
      {
        id: `${Date.now()}_0`,
        text: "Option 1",
        alignment: 0,
        explanation: '',
        votes: []
      }
    ];
    roundInProgress = true;
    isInitialized = true;
    
    logWithTimestamp('Using default values after initialization failure');
  }
}

// Call initialize when the module loads
initialize().catch(error => {
  logWithTimestamp('Fatal error during initialization:', error);
  // Set default values
  companyProfile = config.company.initialProfile;
  strategy = config.company.initialStrategy;
  currentScenario = "Welcome to Cookie Stand! Let's start our first month.";
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
  // If user has already voted in this round, ignore the vote
  if (votedUsers.has(userId)) {
    logWithTimestamp(`User ${userId} already voted in this round`);
    return;
  }

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

    // Add user to voted users set
    votedUsers.add(userId);

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
  const user = userId ? users.find(u => u.id === userId) : null;
  
  // Parse strategy if it's a string
  let parsedStrategy = strategy;
  if (typeof strategy === 'string') {
    try {
      // First try to parse as is
      parsedStrategy = JSON.parse(strategy);
    } catch (e) {
      console.error('Error parsing strategy:', e);
      try {
        // If that fails, try to sanitize the string first
        const sanitizedStrategy = strategy
          .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
          .replace(/^\uFEFF/, '') // Remove BOM
          .replace(/\u00A0/g, ' ') // Replace non-breaking spaces
          .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
          .trim();
        
        parsedStrategy = JSON.parse(sanitizedStrategy);
      } catch (e2) {
        console.error('Error parsing sanitized strategy:', e2);
        // If all parsing attempts fail, use the original string
        parsedStrategy = strategy;
      }
    }
  }

  // Find the option the user voted for
  let votedOptionId = null;
  if (userId && votedUsers.has(userId)) {
    const votedOption = options.find(opt => 
      opt.votes.some(v => typeof v === 'object' ? v.userId === userId : v === userId)
    );
    if (votedOption) {
      votedOptionId = votedOption.id;
    }
  }
  
  return {
    strategy: parsedStrategy,
    companyProfile: companyProfile,
    users,
    roundHistory,
    strategyTimeRemaining: getStrategyTimeRemaining(),
    userName: user ? user.name : null,
    votingAnalysis,
    hasVoted: votedUsers.has(userId),
    roundInProgress,
    currentMonth,
    currentScenario,
    options,
    votedOptionId // Add the voted option ID to the state
  };
}

async function updateVotingAnalysis() {
  try {
    // Get recent votes and wildcards
    const recentVotes = tickerLog
      .filter(entry => entry.type === 'vote')
      .map(entry => ({ user: entry.user, option: entry.option }));
    
    const recentWildcards = tickerLog
      .filter(entry => entry.type === 'wildcard')
      .map(entry => ({ user: entry.user, option: entry.option }));

    // Only update analysis if we have new data
    if (recentVotes.length > 0 || recentWildcards.length > 0) {
      // Generate new analysis
      const analysis = await ai.analyzeVotingPatterns(recentVotes, recentWildcards);
      votingAnalysis = analysis;
      logWithTimestamp('Voting analysis updated');
    } else if (!votingAnalysis) {
      // If we have no analysis yet, create an empty one
      votingAnalysis = {
        userPatterns: [],
        generalPatterns: ["No voting patterns available yet"]
      };
    }
    // If we have no new data but existing analysis, keep the existing analysis
  } catch (error) {
    logWithTimestamp(`Error updating voting analysis: ${error.message}`);
    // Keep existing analysis on error
  }
}

async function updateStrategy(newStrategy, commentary, selectedOption) {
  console.log(`\n🌀 Processing Month ${currentMonth}...`);
  console.log("Current Strategy:", strategy);
  console.log("New Strategy:", newStrategy);

  // Update strategy immediately
  strategy = newStrategy;
  console.log("Strategy updated to:", strategy);

  // Clear voted users set for new round
  votedUsers.clear();

  try {
    const timestamp = new Date().toLocaleTimeString();
    console.log('\n' + '='.repeat(80));
    console.log(`[${timestamp}] PROCESSING NEW ROUND`);
    console.log('='.repeat(80));
    
    // Get recent votes and wildcards for history
    const recentVotes = tickerLog
      .filter(entry => entry.type === 'vote')
      .map(entry => ({ user: entry.user, option: entry.option }));
    
    const recentWildcards = tickerLog
      .filter(entry => entry.type === 'wildcard')
      .map(entry => ({ user: entry.user, option: entry.option }));

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

    const result = await ai.processRound({
      currentStrategy: strategy,
      currentScenario,
      currentProfile: companyProfile,
      votes: recentVotes,
      wildcards: recentWildcards,
      timeExpired: getStrategyTimeRemaining() === 0
    });

    // Validate and update state
    if (!result) {
      throw new Error('No result received from processRound');
    }

    // Update state with new values
    strategy = result.newStrategy || strategy;
    companyProfile = result.newProfile || companyProfile;
    currentScenario = result.newScenario || currentScenario;
    options = [];

    // Record in history
    roundHistory.push({
      timestamp: new Date().toISOString(),
      month: currentMonth,
      scenario: currentScenario,
      winningOption: selectedOption ? selectedOption.text : 'No votes',
      commentary,
      strategy: strategy,
      companyProfile,
      votes: recentVotes,
      wildcards: recentWildcards,
      votingAnalysis: votingAnalysis // Use current voting analysis
    });

    // Trim history if needed
    if (roundHistory.length > config.ui.maxHistoryEntries) {
      roundHistory = roundHistory.slice(-config.ui.maxHistoryEntries);
    }

    // Reset the timer
    strategyStartTime = Date.now();
    logWithTimestamp('Timer reset after strategy update');
    
  } catch (error) {
    logWithTimestamp(`Failed to process round update: ${error.message}`);
    logWithTimestamp('Stack trace:', error.stack);
    logWithTimestamp('Keeping current state after update failure');
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
  schedulerTimeout = setTimeout(() => {
    const scheduler = require('./scheduler');
    scheduler.beginScheduler();
  }, 3000); // warm-up
}

// Modify startRound to use processRound for scenario generation
async function startRound(newScenario, newOptions) {
  if (roundInProgress) {
    console.log("⏳ Round already in progress, skipping...");
    return;
  }

  console.log(`\n🌀 Starting Month ${currentMonth}...`);
  roundInProgress = true;
  votedUsers.clear();

  try {
    // Update scenario and options
    if (newScenario) {
      currentScenario = newScenario;
    }
    
    if (newOptions && Array.isArray(newOptions)) {
      options = newOptions.map((opt, i) => ({
        id: `${Date.now()}_${i}`,
        text: opt.text || "Option " + (i + 1),
        alignment: opt.alignment || 0,
        explanation: opt.explanation || '',
        votes: []
      }));
    }

    logWithTimestamp('Round started with:', {
      scenario: currentScenario,
      optionsCount: options.length
    });
  } catch (error) {
    console.error('Error starting round:', error);
    roundInProgress = false;
    throw error;
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
  strategyStartTime = Date.now();
  
  // Start voting analysis timer using config interval
  if (votingAnalysisTimer) {
    clearInterval(votingAnalysisTimer);
  }
  votingAnalysisTimer = setInterval(updateVotingAnalysis, config.intervals.votingAnalysisInterval);
  
  // Initialize the game if not already initialized
  if (!isInitialized) {
    initialize().then(() => {
      logWithTimestamp('Game initialized, starting scheduler...');
      beginScheduler();
    }).catch(error => {
      logWithTimestamp('Failed to initialize game:', error);
    });
  } else {
    beginScheduler();
  }
}

function stopScheduler() {
  schedulerRunning = false;
  if (schedulerTimeout) {
    clearTimeout(schedulerTimeout);
    schedulerTimeout = null;
  }
  if (votingAnalysisTimer) {
    clearInterval(votingAnalysisTimer);
    votingAnalysisTimer = null;
  }
  roundInProgress = false;
  strategyStartTime = Date.now(); // Reset timer when stopping
}

function isSchedulerRunning() {
  return schedulerRunning;
}

function endRound() {
  // Only increment month if we haven't already ended this round
  if (!roundInProgress) {
    logWithTimestamp('Round already ended, skipping month increment');
    return;
  }

  logWithTimestamp('Ending round. Previous state:', {
    roundInProgress,
    optionsCount: options.length,
    votedUsersCount: votedUsers.size,
    currentMonth
  });
  
  // Set round as not in progress first
  roundInProgress = false;
  
  // Clear all round-specific data
  options = []; // Clear options when round ends
  votedUsers.clear(); // Clear voted users for next round
  
  // Preserve voting analysis by not clearing it
  // votingAnalysis will be updated by the votingAnalysisTimer
  
  // Increment month counter here, after the round is fully processed
  currentMonth++;
  logWithTimestamp(`Month incremented to ${currentMonth}`);
  
  logWithTimestamp('Round ended. New state:', {
    roundInProgress,
    optionsCount: options.length,
    votedUsersCount: votedUsers.size,
    currentMonth
  });
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
  isSchedulerRunning,
  startRound,
  endRound,
  updateVotingAnalysis
};
