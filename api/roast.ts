// Vercel serverless function. Keeps GROQ_API_KEY server-side only - unlike
// every VITE_-prefixed var in this app, this one must never reach client JS,
// since a leaked Groq key (even a free one) can be used to burn the shared
// rate limit. Called from AuthScreen's wrong-guess branch in src/main.tsx.
import type { VercelRequest, VercelResponse } from '@vercel/node';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

const KNOWN_TOPICS = new Set(['our first date', 'our first kiss', 'our anniversary']);

const SYSTEM_PROMPT =
  "You write single one-line roasts for a private couple's relationship-timeline app. " +
  'A partner just answered a trivia question wrong. The user message tells you exactly ' +
  'which relationship fact they got wrong - roast them specifically about THAT one. Never ' +
  'substitute a different milestone (if the topic is "our first kiss", the roast must be ' +
  'about the first kiss, not the anniversary or first date). Be both brutal AND genuinely ' +
  'funny - sharp comedic timing, a real punchline, like a ruthless roast-battle comedian ' +
  "who's actually clever, not just mean. Go for maximum sting, minimum mercy. The only hard " +
  'rule: the target is ONLY their failure to remember the given topic - never their ' +
  'appearance, body, family, intelligence in general, or anything actually insecure-making. ' +
  'No slurs, no crude language. Use their first name naturally. One short sentence, under 20 ' +
  'words. Reply with ONLY the roast line - no quotation marks, no emoji, no preamble.';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GROQ_API_KEY is not configured' });
    return;
  }

  const name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim().slice(0, 40) : 'love';
  const topic = typeof req.body?.topic === 'string' && KNOWN_TOPICS.has(req.body.topic) ? req.body.topic : 'our relationship trivia';

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 1.1,
        max_tokens: 60,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Write one brutal, funny roast line for ${name}, who just got ${topic} wrong.` },
        ],
      }),
    });

    if (!groqResponse.ok) {
      res.status(502).json({ error: `Groq request failed with ${groqResponse.status}` });
      return;
    }

    const data = await groqResponse.json();
    const line = data?.choices?.[0]?.message?.content?.trim();
    if (!line) {
      res.status(502).json({ error: 'Empty response from Groq' });
      return;
    }

    res.status(200).json({ line });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
