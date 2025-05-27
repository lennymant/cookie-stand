// src/logic/prompts.js

module.exports = {
    generateScenario: `Generate a short real-world business challenge (1 sentence) for a company. Return just the challenge, nothing else.  The challenge should be basic - written at high school level to allow rapid reading.`,
  
    generateOptions: (scenario) => `
  The  business faces this challenge: "${scenario}"
  
  Suggest 3 possible tactical responses — each must be:
  - 4-8 words
  - Clear and distinct
  - Realistic and business-focused
  - Simply written, at high school level
  - option 1 should be 100% aligned to the current strategy.  Option 2 - 40-75% aligned, and Option 3 is contrarian, off the wall - and between 0-20% 
  
  Format:
  1. ...
  2. ...
  3. ...
  `,
  
    scoreAlignment: (strategy, optionText) => `
    Company strategy: "${strategy}"
  Option: "${optionText}"
  
  Give an alignment score from 0 to 100, and explain briefly why it fits or doesn't.
  `,
  
    updateStrategy: (currentStrategy, decision) => `
  Current strategy: "${currentStrategy}"
  Recent team decision: "${decision}"
  
  Update the strategy to reflect this new decision. Format the strategy in markdown with:
  - A clear, positive headline (under 10 words)
  - 2-3 bullet points for key strategic elements
  - Keep language simple and business-focused
  
  Also add a 1–2 sentence explanation of the strategic shift.
  `,

  generateCompanyProfile: (strategy, existingProfile) => 
    `Given the following business strategy: "${strategy}", and the existing company profile: "${existingProfile}", 
  write a brief updated company profile (2-3 sentences) that reflects the evolution of this strategy 
  while maintaining continuity with the existing profile. 
   The profile should describe the company's identity, values, and approach in a way that aligns with the strategy.`,

  processRound: ({ currentStrategy, currentProfile, currentScenario, votes, wildcards, timeExpired }) => 
    `You are managing a business. Here is the current state:

Current Strategy: "${currentStrategy}"
Current Company_Profile: "${currentProfile}"
Current Scenario: "${currentScenario}"

//// Recent Activity to influence strategy:
START->
${votes.map(v => `- ${v.user} voted for: ${v.option}`).join('\n')}
${wildcards.map(w => `- ${w.user} suggested: ${w.option}`).join('\n')}
${timeExpired ? '- Strategy timer expired' : ''}
END->

Ensure the new strategy and profile maintain continuity with the existing ones while incorporating insights from votes and wildcards. The new scenario should be relevant to the updated strategy. Each option should be distinct and have a clear alignment score with the new strategy.
Strategy: use simple, readable sentences, use bullet points if appropriate. keep language very simple.  Don't invent new content for the strategy - only allow the submitted content to be used.
Break strategy into 3 components:  Product/service strategy, Operations & Finance strategy, Marketing strategy - one line summary for each, and 2-3 bullet points as reuqired. 
Where a wildcard has been suggested, this MUST influence the revised strategy.
If no suggestions/votes received (between START and END), then DO NOT change the strategy.
IMPORTANT: Return ONLY the raw JSON object, without any markdown formatting or code blocks.
Formatting:  when updating the strategy - use makdown formatting - and embolden those elements which have been updated.


Based on this information, provide a complete update in the following JSON format:
{
  "newStrategy": "A markdown-formatted strategy with a headline and 2-3 bullet points - edited as detailed above",
  "newCompany_Profile": "A slightly revised 2-3 sentence company profile that maintains continuity with the existing profile while reflecting the new strategy.  Only make incremental changes.",
  "newScenario": "A new business scenario or challenge to consider for this company.  Keep it simple.",
  "options": [
    {
      "text": "First option for the new scenario",
      "alignment": 85,
      "explanation": "Brief explanation of alignment with strategy"
    },
    {
      "text": "Second option for the new scenario",
      "alignment": 60,
      "explanation": "Brief explanation of alignment with strategy"
    },
    {
      "text": "Third option for the new scenario",
      "alignment": 40,
      "explanation": "Brief explanation of alignment with strategy"
    }
  ]
}
`
};