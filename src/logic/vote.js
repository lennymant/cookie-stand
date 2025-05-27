// src/logic/policy.js
const { OpenAI } = require('openai');
require('dotenv').config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function scoreAlignment(policyText, reasoningText) {
  const prompt = `Evaluate how well this reasoning aligns with the corporate strategy.

Policy:
"${policyText}"

Reasoning:
"${reasoningText}"

Score from 0 to 100. Then explain in 1–2 sentences.`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
  });

  const output = res.choices[0].message.content.trim();
  const match = output.match(/(\d{1,3})/); // naive score extraction
  return {
    score: match ? parseInt(match[1]) : null,
    explanation: output,
  };
}

async function rewritePolicy(currentPolicy, decisions) {
  const prompt = `Current policy:\n${currentPolicy}\n\nUpdate the policy to incorporate the following decisions:\n\n${decisions.map(d => d.text).join('\n\n')}\n\nReturn a revised, coherent policy.`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
  });

  return res.choices[0].message.content.trim();
}

module.exports = { scoreAlignment, rewritePolicy };
