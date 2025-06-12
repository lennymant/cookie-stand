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
    strategyDuration: 45000,    // Duration of each round (120 seconds)
    roundTransitionDelay: 5000,  // Delay between rounds (5 seconds)
    schedulerWarmup: 3000,       // Initial delay before starting first round (3 seconds)
    votingAnalysisInterval: 40000, // How often to update voting analysis (40 seconds)

    // UI update intervals
    stateRefresh: 2000,         // How often to refresh the game state (2 seconds)
    countdownUpdate: 1000,      // How often to update the countdown display (1 second)
    
    // Round management
    roundEndDelay: 5000         // Delay after round ends before starting next (5 seconds)
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