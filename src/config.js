// src/config.js

module.exports = {
  // Server settings
  server: {
    port: 5000
  },

  // Timing intervals (in milliseconds)
  intervals: {
    strategyDuration: 60000,    // How long each strategy lasts (60 seconds)
    stateRefresh: 10000,        // How often to refresh the state (10 seconds)
    countdownUpdate: 1000       // How often to update the countdown (1 second)
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