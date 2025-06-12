// src/logic/scheduler.js

const state = require('./state');
const ai = require('./ai');
const config = require('../config');

let lastRoundTime = Date.now();
let schedulerRunning = false;
let roundInProgress = false;

async function startRound() {
  if (!schedulerRunning) {
    console.log("⏳ Scheduler stopped, skipping round...");
    return;
  }

  if (roundInProgress) {
    console.log("⏳ Round already in progress, skipping...");
    return;
  }

  console.log("\n🌀 Starting new round...");
  lastRoundTime = Date.now();
  roundInProgress = true;

  try {
    // Get current state
    const currentState = state.getState();
    
    // Start the round with current scenario and options
    // The scenario will be updated during state.updateStrategy after votes
    await state.startRound(currentState.scenario, currentState.options);
    
    // Wait for strategy duration, then resolve
    setTimeout(async () => {
      await resolveRound();
    }, config.intervals.strategyDuration);
  } catch (error) {
    console.error("❌ Error in round:", error);
    roundInProgress = false;
    // Try again after a longer delay
    setTimeout(startRound, config.intervals.roundEndDelay);
  }
}

async function resolveRound() {
  try {
    const votes = state.getVotes();
    const winning = votes.sort((a, b) => b.votes - a.votes)[0];

    if (!winning) {
      console.log("⚠️ No votes this round. Strategy unchanged.");
      // End the round in the state module
      await state.endRound();
      roundInProgress = false;
      // Start next round after a longer delay
      if (schedulerRunning) {
        setTimeout(startRound, config.intervals.roundEndDelay);
      }
      return;
    }

    console.log("✅ Winning Option:", winning.text);

    // Get current state
    const currentState = state.getState();
    console.log("Current Strategy:", currentState.strategy);

    // Update strategy
    const { newStrategy, commentary } = await ai.updateStrategy(
      currentState.strategy,
      winning.text
    );

    console.log("🎯 New Strategy:", newStrategy);
    console.log("💬 Commentary:", commentary);

    // Update state with new strategy
    await state.updateStrategy(newStrategy, commentary, winning);

    // Verify the update
    const updatedState = state.getState();
    console.log("Updated Strategy:", updatedState.strategy);
  } catch (error) {
    console.error("❌ Error resolving round:", error);
  } finally {
    // End the round in the state module
    await state.endRound();
    roundInProgress = false;
    // Start the next round after a longer delay
    if (schedulerRunning) {
      setTimeout(startRound, config.intervals.roundEndDelay);
    }
  }
}

function beginScheduler() {
  if (schedulerRunning) {
    console.log("🔄 Scheduler already running");
    return;
  }
  
  schedulerRunning = true;
  roundInProgress = false;
  console.log("🕒 Scheduler ready. Starting first round in 3 seconds...");
  setTimeout(startRound, 3000); // warm-up
}

function stopScheduler() {
  schedulerRunning = false;
  roundInProgress = false;
  state.endRound(); // End any active round
  console.log("🛑 Scheduler stopped");
}

module.exports = {
  beginScheduler,
  stopScheduler
};
