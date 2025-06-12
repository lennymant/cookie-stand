const { OpenAI } = require('openai');
require('dotenv').config();
const prompts = require('./prompts');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function scoreAlignment(strategy, optionText) {
  console.log('\n[ai.js] scoreAlignment: Scoring alignment for option:', optionText);
  const res = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompts.scoreAlignment(strategy, optionText) }]
  });

  const content = res.choices[0].message.content;
  const scoreMatch = content.match(/(\d{1,3})/);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : null;

  return {
    alignment: score,
    explanation: content.trim()
  };
}

async function updateStrategy(currentStrategy, decisionText) {
  console.log('\n[ai.js] updateStrategy: Updating strategy based on decision:', decisionText);
  const res = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompts.updateStrategy(currentStrategy, decisionText) }]
  });

  const output = res.choices[0].message.content.trim();
  
  console.log("\nupdateStrategy() gpt response:", output, "\n");
  
  try {
    // Parse the output as JSON
    const result = JSON.parse(output);
    return {
      newStrategy: result.newStrategy,
      commentary: result.commentary || ''
    };
  } catch (error) {
    console.error('Error parsing strategy update:', error);
    console.error('Raw output:', output);
    throw new Error(`Failed to parse strategy update: ${error.message}`);
  }
}

async function generateCompanyProfile(strategy, existingProfile) {
  console.log('\n[ai.js] generateCompanyProfile: Generating new company profile');
  const res = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompts.generateCompanyProfile(strategy, existingProfile) }]
  });

  return res.choices[0].message.content.trim();
}

async function processRound({
  currentStrategy,
  currentScenario,
  currentProfile,
  votes = [],
  wildcards = [],
  timeExpired = false
}) {
  console.log('\n\n\n\n\n\n\n\n\n[ai.js] processRound: Processing round :');
  // console.log('- Strategy:', JSON.stringify(currentStrategy, null, 2));
  // console.log('- Scenario:', currentScenario);
  // console.log('- Profile:', currentProfile);
  // console.log('- Votes:', votes.length);
  // console.log('- Wildcards:', wildcards.length);
  // console.log('- Time Expired:', timeExpired);

  try {
    const prompt = prompts.processRound({
      currentStrategy,
      currentProfile,
      currentScenario,
      votes,
      wildcards,
      timeExpired
    });

    // Log the prompt
    console.log('\n' + '='.repeat(80));
    console.log('PROMPT SENT TO GPT:');
    console.log('='.repeat(80));
    // console.log(prompt);
    // console.log('='.repeat(80) + '\n');

    const res = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }]
    });

    if (!res || !res.choices || !res.choices[0] || !res.choices[0].message) {
      console.error('Invalid response from OpenAI:', res);
      throw new Error('Invalid response from OpenAI API');
    }

    try {
      const content = res.choices[0].message.content.trim();
      
      // Sanitize the content before parsing
      const sanitizedContent = content
        // Remove any markdown code block formatting
        .replace(/```json\n?|\n?```/g, '')
        // Remove any control characters
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
        // Remove any BOM characters
        .replace(/^\uFEFF/, '')
        // Remove any non-breaking spaces
        .replace(/\u00A0/g, ' ')
        // Remove any trailing commas
        .replace(/,(\s*[}\]])/g, '$1')
        .trim();

      console.log('Sanitized content:', sanitizedContent);

      let result;
      try {
        result = JSON.parse(sanitizedContent);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.error('Failed content:', sanitizedContent);
        throw new Error(`Failed to parse GPT response: ${parseError.message}`);
      }

      // Log the parsed result
      // console.log('\nParsed result:', JSON.stringify(result, null, 2));
      console.log('result received');

      // Validate the result has all required fields
      if (!result.newStrategy) {
        console.warn('Missing newStrategy in response, using current strategy');
        result.newStrategy = currentStrategy;
      }
      if (!result.newCompany_Profile) {
        console.warn('Missing newCompany_Profile in response, using current profile');
        result.newCompany_Profile = currentProfile;
      }
      if (!result.newScenario) {
        console.warn('Missing newScenario in response, using current scenario');
        result.newScenario = currentScenario || "Waiting for first scenario...";
      }
      if (!result.options || !Array.isArray(result.options)) {
        console.warn('Invalid options in response, using default options');
        result.options = [
          {
            text: "Option 1",
            alignment: 0,
            explanation: "Waiting for AI response..."
          }
        ];
      }

      // Generate a new company profile based on the new strategy
      const newProfile = await generateCompanyProfile(result.newStrategy, result.newCompany_Profile);

      // Map newCompany_Profile to newProfile for consistency
      return {
        ...result,
        newProfile: newProfile || result.newCompany_Profile
      };
    } catch (error) {
      console.error('Failed to parse GPT response:', error);
      console.error('Raw response:', res.choices[0].message.content);
      throw new Error(`Failed to parse GPT response: ${error.message}`);
    }
  } catch (error) {
    console.error('Error in processRound:', error);
    // Return a valid response even if the API call fails
    return {
      newStrategy: currentStrategy,
      newProfile: currentProfile,
      newScenario: currentScenario || "Waiting for first scenario...",
      options: [
        {
          text: "Option 1",
          alignment: 0,
          explanation: `Error: ${error.message}`
        }
      ]
    };
  }
}

async function analyzeVotingPatterns(votes, wildcards) {
  console.log('\n[ai.js] analyzeVotingPatterns: Analyzing voting patterns');
  console.log('- Votes:', votes.length);
  console.log('- Wildcards:', wildcards.length);

  const prompt = `Analyze the following voting and wildcard history to identify patterns and trends:

Votes:
${votes.map(v => `- ${v.user}: "${v.option}"`).join('\n')}

Wildcards:
${wildcards.map(w => `- ${w.user}: "${w.option}"`).join('\n')}

Please provide a concise analysis in the following JSON format:

{
  "summary": "A brief summary of the overall voting patterns",
  "user_patterns": [
    { "user": "username", "pattern": "pattern description", "frequency": "frequency description" }
  ],
  "general_patterns": [
    "pattern description"
  ]
}

If there isn't enough data to identify patterns, return a JSON object with just a summary field:

{
  "summary": "Not enough voting data to identify patterns yet"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing voting patterns and user behavior. Always return valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const content = response.choices[0].message.content.trim();
    console.log("\nanalyzeVotingPatterns() gpt response:", content, "\n");

    try {
      // Parse the response as JSON
      const analysis = JSON.parse(content);
      
      // Ensure the response has the expected structure
      return {
        summary: analysis.summary || "No summary available",
        userPatterns: analysis.user_patterns || [],
        generalPatterns: analysis.general_patterns || []
      };
    } catch (parseError) {
      console.error('Error parsing GPT response:', parseError);
      return {
        summary: "Error analyzing patterns",
        userPatterns: [],
        generalPatterns: []
      };
    }
  } catch (error) {
    console.error('Error analyzing voting patterns:', error);
    return {
      summary: "Error analyzing patterns",
      userPatterns: [],
      generalPatterns: []
    };
  }
}

module.exports = {
  scoreAlignment,
  updateStrategy,
  generateCompanyProfile,
  processRound,
  analyzeVotingPatterns
};
