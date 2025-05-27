// src/logic/scheduler.js

const state = require('./state');
const ai = require('./ai');
const config = require('../config');

let roundInProgress = false;
let lastRoundTime = Date.now();

async function startRound() {
  if (roundInProgress) {
    console.log("⏳ Round already in progress, skipping...");
    return;
  }

  const timeSinceLastRound = Date.now() - lastRoundTime;
  if (timeSinceLastRound < config.intervals.strategyDuration) {
    console.log(`⏳ Too soon for next round (${Math.ceil((config.intervals.strategyDuration - timeSinceLastRound) / 1000)}s remaining)`);
    return;
  }

  console.log("\n🌀 Starting new round...");
  roundInProgress = true;
  lastRoundTime = Date.now();

  try {
    const currentState = state.getState();
    const strategy = currentState.strategy;

    // Step 1: Generate scenario
    const scenario = await ai.generateScenario();
    console.log("📢 Scenario:", scenario);

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
    state.resetRound(scenario, scoredOptions);

    // Step 5: Wait for strategy duration, then resolve
    setTimeout(resolveRound, config.intervals.strategyDuration);
  } catch (error) {
    console.error("❌ Error in round:", error);
    roundInProgress = false;
    // Try again after a short delay
    setTimeout(startRound, 5000);
  }
}

async function resolveRound() {
  try {
    const votes = state.getVotes();
    const winning = votes.sort((a, b) => b.votes - a.votes)[0];

    if (!winning) {
      console.log("⚠️ No votes this round. Strategy unchanged.");
      roundInProgress = false;
      return;
    }

    console.log("✅ Winning Option:", winning.text);

    // Step 6: Update strategy
    const { newStrategy, commentary } = await ai.updateStrategy(
      state.getState().strategy,
      winning.text
    );

    state.updateStrategy(newStrategy, commentary, winning);

    console.log("🎯 New Strategy:", newStrategy);
    console.log("💬 Commentary:", commentary);
  } catch (error) {
    console.error("❌ Error resolving round:", error);
  } finally {
    roundInProgress = false;
    // Start the next round after a short delay
    setTimeout(startRound, 1000);
  }
}

function beginScheduler() {
  console.log("🕒 Scheduler ready. Starting first round in 3 seconds...");
  setTimeout(startRound, 3000); // warm-up
}

module.exports = {
  beginScheduler
};
