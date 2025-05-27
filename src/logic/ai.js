const { OpenAI } = require('openai');
require('dotenv').config();
const prompts = require('./prompts');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateScenario() {
  console.log('\n[ai.js] generateScenario: Generating new scenario');
  const res = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompts.generateScenario }]
  });
  return res.choices[0].message.content.trim();
}

// async function generateOptions(scenario) {
//   const res = await openai.chat.completions.create({
//     model: "gpt-4o",
//     messages: [{ role: "user", content: prompts.generateOptions(scenario) }]
//   });
// 
//   const lines = res.choices[0].message.content.split('\n').filter(l => l.trim());
//   
//   // Log the raw lines
//   console.log('\n' + '='.repeat(80));
//   console.log('RAW OPTIONS FROM GPT:');
//   console.log('='.repeat(80));
//   lines.forEach((line, i) => console.log(`${i + 1}. ${line}`));
//   console.log('='.repeat(80) + '\n');
// 
//   return lines.map(line => ({ text: line.replace(/^\d+\.\s*/, '') }));
// }

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
  const [newStrategy, ...commentaryParts] = output.split('\n');
  return {
    newStrategy: newStrategy.trim(),
    commentary: commentaryParts.join(' ').trim()
  };
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
  console.log('\n\n\n\n\n\n\n\n\n[ai.js] processRound: Processing round with:');
  console.log('- Strategy:', JSON.stringify(currentStrategy, null, 2));
  console.log('- Scenario:', currentScenario);
  console.log('- Profile:', currentProfile);
  console.log('- Votes:', votes.length);
  console.log('- Wildcards:', wildcards.length);
  console.log('- Time Expired:', timeExpired);

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
    console.log(prompt);
    console.log('='.repeat(80) + '\n');

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
      //console.log('\nParsed result:', JSON.stringify(result, null, 2));
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

Please provide a concise analysis in the following format:

User Patterns:
- [username]: [pattern description] (frequency)

General Patterns:
- [pattern description]

IMPORTANT: Format your response exactly as shown above, with "User Patterns:" and "General Patterns:" sections.
if there isn't enough data - simply return "Insufficient data for vote analysis.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing voting patterns and user behavior. Format your response with User Patterns and General Patterns sections."
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
    
    // Parse the response into structured data
    const analysis = {
      userPatterns: [],
      generalPatterns: []
    };

    const sections = content.split('\n\n');
    for (const section of sections) {
      if (section.startsWith('User Patterns:')) {
        const patterns = section.split('\n').slice(1);
        analysis.userPatterns = patterns.map(pattern => {
          const match = pattern.match(/^- (.+?): (.+) \((.+)\)$/);
          if (match) {
            return {
              user: match[1].trim(),
              pattern: match[2].trim(),
              frequency: match[3].trim()
            };
          }
          return null;
        }).filter(Boolean);
      } else if (section.startsWith('General Patterns:')) {
        const patterns = section.split('\n').slice(1);
        analysis.generalPatterns = patterns
          .map(pattern => pattern.replace(/^- /, '').trim())
          .filter(Boolean);
      }
    }
    
    console.log('ANALYSIS:', JSON.stringify(analysis, null, 2));
    return analysis;
  } catch (error) {
    console.error('Error analyzing voting patterns:', error);
    return {
      userPatterns: [],
      generalPatterns: ["Error analyzing patterns"]
    };
  }
}

module.exports = {
  generateScenario,
  // generateOptions,
  scoreAlignment,
  updateStrategy,
  generateCompanyProfile,
  processRound,
  analyzeVotingPatterns
};
