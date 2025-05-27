// src/logic/prompts.js

module.exports = {
  generateScenario: `Generate a short real-world business challenge for a company.

Requirements:
- Write only ONE sentence.
- Keep the language simple and suitable for a high school reading level.
- Do NOT include explanations or markdown.
- Return ONLY the challenge string as plain text.`,

  generateOptions: (scenario) => `
The business faces this challenge: "${scenario}"

Suggest three distinct tactical responses.

Each response must:
- Be 4 to 8 words long.
- Be realistic and business-focused.
- Use clear, simple language (high school level).
- Be strategically aligned as follows:
  1. Option 1 — 100% aligned with current strategy.
  2. Option 2 — 40–75% aligned.
  3. Option 3 — 0–20% aligned, contrarian or off-the-wall.

Return the result in this exact format:
{
  "options": [
    "Option 1 text",
    "Option 2 text",
    "Option 3 text"
  ]
}`,

  scoreAlignment: (strategy, optionText) => `
Evaluate alignment of a business option against a given strategy.

Inputs:
- Company strategy: "${strategy}"
- Option: "${optionText}"

Return a JSON object with:
- alignment (score from 0 to 100)
- explanation (a brief reason why it fits or doesn't)

Output format:
{
  "alignment": 85,
  "explanation": "Brief explanation of the alignment"
}`,

  updateStrategy: (currentStrategy, decision) => `
Update the company strategy based on a new decision.

Inputs:
- Current strategy: "${currentStrategy}"
- Team decision: "${decision}"

Return a JSON object with this exact format:
{
  "newStrategy": {
    "ProductServiceStrategy": {
      "summary": "Brief summary of product/service strategy",
      "bullets": ["point 1", "point 2"]
    },
    "OperationsFinanceStrategy": {
      "summary": "Brief summary of operations and finance strategy",
      "bullets": ["point 1", "point 2"]
    },
    "MarketingStrategy": {
      "summary": "Brief summary of marketing strategy",
      "bullets": ["point 1", "point 2"]
    }
  },
  "commentary": "1-2 sentence explanation of the changes"
}

Language:
- Use clear and simple business English.
- Do NOT return markdown or extra formatting.
- Ensure the JSON is properly formatted with no trailing commas.`,

  generateCompanyProfile: (strategy, existingProfile) => `
#################### Update a company profile based on strategy changes.

Inputs:
- Strategy: "${strategy}"
- Existing profile: "${existingProfile}"

Write a new 2–3 sentence profile that:
- Reflects the updated strategy
- Maintains continuity with the original identity and tone

Return the profile as a single string in this format:
{
  "updatedProfile": "Revised company profile here"
}`,

  processRound: ({ currentStrategy, currentProfile, currentScenario, votes, wildcards, timeExpired }) => `
#################### Simulate the next round of business decision-making.

Current State:
- Strategy: "${currentStrategy}"
- Profile: "${currentProfile}"
- Scenario: "${currentScenario}"

//// Activity Log:
START->
${votes.map(v => `- ${v.user} voted for: ${v.option}`).join('\n')}
${wildcards.map(w => `- ${w.user} suggested: ${w.option}`).join('\n')}
${timeExpired ? '- Strategy timer expired' : ''}
END->

Instructions:

1. If there are NO votes or wildcards, DO NOT change the strategy or profile. Copy them forward.
2. If wildcards are present, their content must be integrated into the updated strategy.
3. The new strategy must:
   - Retain continuity with the current one.
   - Be based only on submitted votes/wildcards — do not invent new elements.
   - Be split into three sections:
     - ProductServiceStrategy
     - OperationsFinanceStrategy
     - MarketingStrategy
   - Each section should contain:
     - A "summary" (1–2 simple sentences)
     - A "bullets" array with 2–3 key points (if enough data)

4. Generate a new challenge scenario aligned to the updated strategy. Keep it short and simple.
5. Propose three new options and score their alignment to the updated strategy.

Return a valid JSON object ONLY — no markdown, headers, or explanations.

JSON format:
{
  "newStrategy": {
    "ProductServiceStrategy": {
      "summary": "Brief summary of product/service strategy.",
      "bullets": ["point 1", "point 2", "optional point 3"]
    },
    "OperationsFinanceStrategy": {
      "summary": "Brief summary of operations and finance strategy.",
      "bullets": ["point 1", "point 2", "optional point 3"]
    },
    "MarketingStrategy": {
      "summary": "Brief summary of marketing strategy.",
      "bullets": ["point 1", "point 2", "optional point 3"]
    }
  },
  "newCompany_Profile": "Revised company profile (2–3 sentences). Incremental updates only. Separate with carriage returns.  Speak in the first person as WE.  First line is a brand marketing strapline.  Second line is an ambitious mission statement, from the whole strategy.  Lines 3-4 if required expand on the strategy.",
  "newScenario": "New business challenge (1 sentence). Keep it simple.",
  "options": [
    {
      "text": "First option for new scenario",
      "alignment": 90,
      "explanation": "Brief reason for the score"
    },
    {
      "text": "Second option for new scenario",
      "alignment": 60,
      "explanation": "Brief reason for the score"
    },
    {
      "text": "Third option for new scenario",
      "alignment": 20,
      "explanation": "Brief reason for the score"
    }
  ]
}`

};
