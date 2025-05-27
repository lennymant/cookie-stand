let userId = localStorage.getItem("userId");
let lastVotedOption = localStorage.getItem("lastVotedOption");
let currentStrategy = null;
let currentCompanyProfile = null;

// Default config values (will be overridden by server config)
let config = {
  intervals: {
    stateRefresh: 5000,    // Will be updated from server config
    countdownUpdate: 1000  // Will be updated from server config
  }
};

// Set base path
const basePath = '/cookie-stand';

// Fetch config on startup
fetch(`${basePath}/api/config`)
  .then(res => res.json())
  .then(data => {
    // Update config with server values
    config = data;
    console.log('Using server config:', config.intervals);
    
    // Start intervals with server config values
    setInterval(updateCountdown, config.intervals.countdownUpdate);
    setInterval(fetchState, config.intervals.stateRefresh);
    setInterval(fetchVotingAnalysis, config.intervals.stateRefresh);
  })
  .catch(error => {
    console.error('Error fetching config:', error);
    // Use default values if config fetch fails
    console.log('Using default config values due to fetch error');
    setInterval(updateCountdown, 1000);
    setInterval(fetchState, 5000);
    setInterval(fetchVotingAnalysis, 5000);
  });

if (!userId) {
  userId = "user_" + Math.floor(Math.random() * 100000);
  const name = prompt("Enter your name:");
  localStorage.setItem("userId", userId); // Always set userId first
  
  let displayName = "Click to set name";
  if (name && !name.startsWith("user_")) {
    displayName = name;
  }
  
  // Always register with server, even with default name
  localStorage.setItem("userName", displayName);
  updateUserName(displayName);

  // Register new user
  fetch(`${basePath}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, name: displayName })
  });
} else {
  const storedName = localStorage.getItem("userName");
  if (storedName && !storedName.startsWith("user_")) {
    updateUserName(storedName);
  } else {
    updateUserName("Click to set name");
  }
}

// Add click handler for username
document.getElementById("userName")?.addEventListener("click", async function() {
  const currentName = localStorage.getItem("userName") || "User";
  const newName = prompt("Enter your new name:", currentName);
  
  if (newName && newName.trim() && !newName.startsWith("user_") && newName !== currentName) {
    try {
      console.log('Updating username:', { userId, newName: newName.trim() });
      const res = await fetch(`${basePath}/api/update-name`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: userId, 
          name: newName.trim() 
        })
      });

      if (res.ok) {
        localStorage.setItem("userName", newName.trim());
        updateUserName(newName.trim());
        // Force a state refresh to ensure server has the new name
        await fetchState();
        console.log('Username updated successfully');
      } else {
        console.error('Failed to update username');
      }
    } catch (error) {
      console.error('Error updating username:', error);
    }
  }
});

async function fetchState() {
  try {
    console.log('Fetching state...');
    const res = await fetch(`${basePath}/api/current?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();

    // Check if strategy has changed
    if (currentStrategy && data.strategy !== currentStrategy) {
      clearVoteState();
    }
    currentStrategy = data.strategy;

    // Update company profile
    if (data.companyProfile) {
      const profileElement = document.getElementById("company-profile");
      if (profileElement) {
        profileElement.textContent = data.companyProfile;
        currentCompanyProfile = data.companyProfile;
      }
    }

    // Update scenario
    const scenarioElement = document.getElementById("scenario");
    if (scenarioElement) {
      const monthText = data.currentMonth ? `Month ${data.currentMonth} - ` : '';
      const scenarioText = data.currentScenario || "Waiting for scenario...";
      scenarioElement.textContent = monthText + scenarioText;
      console.log('Updated scenario:', monthText + scenarioText);
    }

    // Update strategy
    const strategyElement = document.getElementById("strategy");
    if (strategyElement) {
      strategyElement.textContent = data.strategy || "Loading strategy...";
    }

    // Update strategy countdown
    const countdownElement = document.getElementById('refresh-timer');
    if (countdownElement) {
      const timeRemaining = data.strategyTimeRemaining;
      if (timeRemaining > 0) {
        const startTime = new Date().toLocaleTimeString();
        countdownElement.textContent = `Game started at ${startTime} - Strategy changes in ${timeRemaining}s`;
      } else {
        countdownElement.textContent = 'Strategy update pending...';
      }
    }

    // Update options - Optimized rendering
    const container = document.getElementById("options");
    if (!container) return;
    
    // If user has voted in this round, show the vote confirmation
    if (data.hasVoted) {
      // Get the stored vote text
      const storedVote = localStorage.getItem("lastVotedOption");
      console.log('Retrieved stored vote:', storedVote);
      
      if (!storedVote) {
        console.log('No stored vote found, checking lastVotedOption:', lastVotedOption);
      }
      
      const votedText = storedVote || lastVotedOption || "Your vote has been recorded";
      console.log('Using vote text:', votedText);
      
      container.innerHTML = `
        <div class="vote-confirmation">
          <h2>You voted to:</h2>
          <div class="voted-option">${votedText}</div>
        </div>
      `;
      return;
    }

    // If round is not in progress, show waiting message
    if (!data.roundInProgress) {
      container.innerHTML = '<p>Waiting for next round...</p>';
      return;
    }

    // Handle empty or invalid options
    if (!data.options || !Array.isArray(data.options) || data.options.length === 0) {
      container.innerHTML = '<p>Waiting for options...</p>';
      return;
    }

    // Only show options if we have valid options and the user hasn't voted
    const fragment = document.createDocumentFragment();
    
    data.options.forEach(option => {
      if (!option.id || !option.text) return;
      
      const div = document.createElement("div");
      div.className = "option";
      div.innerHTML = `
        <div class="option-text">${option.text}</div>
        <div class="option-controls">
          <button class="vote-button" onclick="vote('${option.id}')">Vote</button>
          <div class="alignment-bar">
            <div class="alignment-fill" style="width: ${option.alignment || 0}%"></div>
          </div>
          <div class="alignment-text">${option.alignment || 0}% aligned</div>
        </div>
      `;
      fragment.appendChild(div);
    });

    // Clear and update container in one operation
    container.innerHTML = '';
    container.appendChild(fragment);

    // Update user name if available in the response
    if (data.userName && data.userName !== "Loading..." && !data.userName.startsWith("user_")) {
      localStorage.setItem("userName", data.userName);
      updateUserName(data.userName);
    } else {
      const storedName = localStorage.getItem("userName");
      if (storedName && !storedName.startsWith("user_")) {
        updateUserName(storedName);
      } else {
        updateUserName("Click to set name");
      }
    }
  } catch (error) {
    console.error('Error fetching state:', error);
    const container = document.getElementById("options");
    if (container) {
      container.innerHTML = `<p>Error loading options: ${error.message}</p>`;
    }
  }
}

async function vote(optionId) {
  try {
    // Find the voted option's text BEFORE making the API call
    const optionElement = document.querySelector(`[onclick="vote('${optionId}')"]`).closest('.option');
    const votedOption = optionElement.querySelector('.option-text').textContent;
    console.log('Voting for option:', votedOption);

    const res = await fetch(`${basePath}/api/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, optionId })
    });

    if (res.ok) {
      // Store the voted option
      localStorage.setItem("lastVotedOption", votedOption);
      lastVotedOption = votedOption;
      console.log('Stored vote:', votedOption);

      // Update UI immediately
      const optionsContainer = document.getElementById("options");
      optionsContainer.innerHTML = `
        <div class="vote-confirmation">
          <h2>You voted to:</h2>
          <div class="voted-option">${votedOption}</div>
        </div>
      `;

      // Force a state refresh to ensure server has the vote
      await fetchState();
    }
  } catch (error) {
    console.error('Error voting:', error);
  }
}

async function submitWildcard() {
  const input = document.getElementById("wildcardInput");
  const text = input.value.trim();
  if (!text) return;

  try {
    const res = await fetch(`${basePath}/api/wildcard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, text })
    });

    if (res.ok) {
      // Store the wildcard text
      localStorage.setItem("lastVotedOption", text);
      lastVotedOption = text;
      console.log('Stored wildcard:', text);

      // Update UI immediately
      const optionsContainer = document.getElementById("options");
      optionsContainer.innerHTML = `
        <div class="vote-confirmation">
          <h2>You submitted a wildcard:</h2>
          <div class="voted-option">${text}</div>
        </div>
      `;

      input.value = "";
      await fetchState();
    }
  } catch (error) {
    console.error('Error submitting wildcard:', error);
  }
}

let countdown = 10;
function updateCountdown() {
  countdown--;
  if (countdown <= 0) {
    countdown = 10;
    fetchState();
  }
}

// Clear the last voted option when strategy changes
function clearVoteState() {
  localStorage.removeItem("lastVotedOption");
  lastVotedOption = null;
  // Clear the options container
  const optionsContainer = document.getElementById("options");
  if (optionsContainer) {
    optionsContainer.innerHTML = '<p>Waiting for next round...</p>';
  }
}

async function forceNextRound() {
  try {
    const res = await fetch(`${basePath}/api/force-next-round`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });

    if (res.ok) {
      // Refresh the state immediately
      await fetchState();
    } else {
      console.error('Failed to force next round');
    }
  } catch (error) {
    console.error('Error forcing next round:', error);
  }
}

function updateOptions(options) {
  const optionsDiv = document.getElementById('options');
  optionsDiv.innerHTML = options.map((option, index) => `
    <div class="option">
      <div class="option-text">${option.text}</div>
      <button class="vote-button" onclick="vote(${index})">Vote</button>
    </div>
  `).join('');
}

function updateCompanyProfile(profile) {
  const profileDiv = document.getElementById('company-profile');
  profileDiv.textContent = profile;
}

function updateStrategy(strategy) {
  const strategyDiv = document.getElementById('strategy');
  if (!strategyDiv) return;

  // Convert markdown to HTML
  const html = strategy
    .replace(/^# (.+)$/gm, '<h3>$1</h3>')  // Convert # Headline to h3
    .replace(/^- (.+)$/gm, '<li>$1</li>')  // Convert - bullet points to li
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');  // Wrap li elements in ul

  strategyDiv.innerHTML = html;
}

function updateScenario(scenario) {
  const scenarioDiv = document.getElementById('scenario');
  scenarioDiv.textContent = scenario;
}

function updateUserName(name) {
  // Update in main page
  const userNameElement = document.getElementById("userName");
  if (userNameElement) {
    userNameElement.textContent = name;
  }
  
  // Update in dashboard
  const dashboardUserNameElement = document.querySelector(".user-name");
  if (dashboardUserNameElement) {
    dashboardUserNameElement.textContent = name;
  }
}

async function fetchVotingAnalysis() {
    try {
        const res = await fetch(`${basePath}/api/current?userId=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        
        if (data.votingAnalysis) {
            const analysisContainer = document.getElementById('votingAnalysis');
            if (analysisContainer) {
                let analysisHtml = '<div class="analysis-section">';
                
                if (data.votingAnalysis.userPatterns && data.votingAnalysis.userPatterns.length > 0) {
                    analysisHtml += `
                        <h3>User Patterns</h3>
                        <ul>
                            ${data.votingAnalysis.userPatterns.map(pattern => `
                                <li><strong>${pattern.user}</strong>: ${pattern.pattern} (${pattern.frequency})</li>
                            `).join('')}
                        </ul>
                    `;
                }
                
                if (data.votingAnalysis.generalPatterns && data.votingAnalysis.generalPatterns.length > 0) {
                    analysisHtml += `
                        <h3>General Patterns</h3>
                        <ul>
                            ${data.votingAnalysis.generalPatterns.map(pattern => `
                                <li>${pattern}</li>
                            `).join('')}
                        </ul>
                    `;
                }
                
                if ((!data.votingAnalysis.userPatterns || data.votingAnalysis.userPatterns.length === 0) && 
                    (!data.votingAnalysis.generalPatterns || data.votingAnalysis.generalPatterns.length === 0)) {
                    analysisHtml += '<p>No voting analysis available yet...</p>';
                }
                
                analysisHtml += '</div>';
                analysisContainer.innerHTML = analysisHtml;
            }
        }
    } catch (error) {
        console.error('Error fetching voting analysis:', error);
    }
}

// Add initial call to fetchVotingAnalysis
fetchVotingAnalysis();

// Add event listener for wildcard submission
document.getElementById('wildcardForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    submitWildcard();
});