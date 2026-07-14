// Vercel serverless function. Keeps GROQ_API_KEY server-side only - unlike
// every VITE_-prefixed var in this app, this one must never reach client JS,
// since a leaked Groq key (even a free one) can be used to burn the shared
// rate limit. Called from AuthScreen's wrong-guess branch in src/main.tsx.
import type { VercelRequest, VercelResponse } from '@vercel/node';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

const KNOWN_TOPICS = new Set(['our first date', 'our first kiss', 'our anniversary']);
const KNOWN_GENDERS = new Set(['male', 'female']);
const PRONOUNS: Record<string, string> = { male: 'he/him', female: 'she/her' };

const SYSTEM_PROMPT =
  "You write single one-line roasts for a private couple's relationship-timeline app. " +
  'A partner just answered a trivia question wrong. The user message tells you exactly ' +
  'which relationship fact they got wrong and their pronouns - roast them specifically ' +
  'about THAT one, using those pronouns naturally if you refer to them in the third person. ' +
  'Never substitute a different milestone (if the topic is "our first kiss", the roast must ' +
  'be about the first kiss, not the anniversary or first date).\n\n' +
  'Be genuinely FUNNY, not just harsh. A vague indignant tone with no actual joke in it ' +
  '("that is unforgivable", "I cannot believe you") is a failure - every line needs one ' +
  'specific, vivid, absurd image or consequence, delivered as a real punchline, not just an ' +
  'angry sentence. Make them regret forgetting: invent a funny, escalating, made-up ' +
  'consequence for getting it wrong (banished to the couch, the relationship put on trial, ' +
  'the topic itself filing paperwork against them, changed locks, a strongly-worded review, ' +
  'a documentary made about the failure) rather than just calling the guess bad. Ground the ' +
  'joke in the actual topic when you can. Style targets (write an ORIGINAL line in this ' +
  'spirit - never reuse these): Sam, that guess about our first kiss was so wrong it just ' +
  "filed a restraining order. Or: Congratulations, Jess - you've been legally banned from " +
  'date-night trivia, and our anniversary is pressing charges.\n\n' +
  'Go completely off the leash on intensity: ruthless, savage, no mercy - but savage through ' +
  'wit and a sharp punchline, not through generic outrage. Do not soften it, do not hedge, do ' +
  'not add a kind aside at the end. This is the single funniest, most brutal version of this ' +
  'roast you are capable of writing. The one non-negotiable limit, regardless of how vicious ' +
  'the tone gets: attack ONLY their failure to remember the given topic - never their ' +
  'appearance, body, family, general intelligence, or anything that could land as a real ' +
  'insecurity. No slurs, no crude or sexual language. Use their first name naturally. One ' +
  'short sentence, under 20 words. Reply with ONLY the roast line - no quotation marks, no ' +
  'emoji, no preamble.';

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
  const gender = typeof req.body?.gender === 'string' && KNOWN_GENDERS.has(req.body.gender) ? req.body.gender : null;
  const pronouns = gender ? PRONOUNS[gender] : 'they/them';

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
          {
            role: 'user',
            content: `Write one savage, brutal, funny roast line for ${name} (pronouns: ${pronouns}), who just got ${topic} wrong.`,
          },
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
