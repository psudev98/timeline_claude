// Vercel serverless function. Keeps GROQ_API_KEY server-side only - unlike
// every VITE_-prefixed var in this app, this one must never reach client JS,
// since a leaked Groq key (even a free one) can be used to burn the shared
// rate limit. Called from AuthScreen's wrong-guess branch in src/main.tsx.
import type { VercelRequest, VercelResponse } from '@vercel/node';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT =
  "You write single one-line roasts for a private couple's relationship-timeline app. " +
  'A partner just answered a trivia question about their own relationship (first date, ' +
  'first kiss, or anniversary) incorrectly. Roast them for it - playful and affectionate, ' +
  'like a teasing partner, never mean or crude. Use their first name naturally. Keep it to ' +
  'one short sentence, under 20 words. Reply with ONLY the roast line - no quotation marks, ' +
  'no emoji, no preamble.';

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

  try {
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 1.05,
        max_tokens: 60,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Write one roast line for ${name}, who just guessed our relationship trivia wrong.` },
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
