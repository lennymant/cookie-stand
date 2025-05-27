// src/config.js

module.exports = {
  // Server settings
  server: {
    port: 5000,
    basePath: '/cookie-stand'
  },

  // Timing intervals (in milliseconds)
  intervals: {
    // Core game timing
    strategyDuration: 60000,    // How long each strategy/round lasts (90 seconds)
    roundTransitionDelay: 2000, // Delay between rounds (2 seconds)
    schedulerWarmup: 3000,      // Initial delay before starting first round (3 seconds)
    roundDuration: 90000,       // 90 seconds
    votingAnalysisInterval: 40000, // 20 seconds for voting analysis updates

    // UI update intervals
    stateRefresh: 5000,         // How often to refresh the game state (5 seconds)
    countdownUpdate: 1000,      // How often to update the countdown display (1 second)
    
    // Voting and round management
    voteTimeout: 50000,         // How long users have to vote (50 seconds)
    roundEndDelay: 2000         // Delay after round ends before starting next (2 seconds)
  },

  // Initial company state
  company: {
    initialProfile: JSON.stringify({
      updatedProfile: "A small, family-owned cookie stand that prides itself on traditional recipes and personal service"
    }),
    initialStrategy: JSON.stringify({
      ProductServiceStrategy: {
        summary: "Bake delicious cookies that everybody loves",
        bullets: [
          "Focus on traditional recipes"
        ]
      },
      OperationsFinanceStrategy: {
        summary: "Efficient operations with sustainable practices",
        bullets: [
            "Keep overhead costs low"
        ]
      },
      MarketingStrategy: {
        summary: "Build a loyal customer base through word-of-mouth",
        bullets: [
          "Create a welcoming atmosphere"
        ]
      }
    })
  },

  // UI settings
  ui: {
    maxTickerEntries: 20,       // Maximum number of entries to keep in the ticker log
    maxHistoryEntries: 50       // Maximum number of rounds to keep in history
  },

  // Game settings
  game: {
    enableRandomVotes: false    // Whether to randomly select a vote if no votes are cast
  }
}; 