// Vercel serverless function. Keeps GROQ_API_KEY server-side only - unlike
// every VITE_-prefixed var in this app, this one must never reach client JS,
// since a leaked Groq key (even a free one) can be used to burn the shared
// rate limit. Called from AuthScreen's wrong-guess branch in src/main.tsx.
import type { VercelRequest, VercelResponse } from '@vercel/node';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

const KNOWN_TOPICS = new Set(['our first date', 'our first kiss', 'our anniversary']);
const KNOWN_GENDERS = new Set(['male', 'female']);
const PRONOUNS: Record<string, string> = { male: 'he/him', female: 'she/her' };

// The model kept defaulting to the same lawsuit/legal-threat joke on nearly
// every call, because that's what temperature alone couldn't reliably break
// it out of. Rather than hope the model self-diversifies, we pick one
// consequence category ourselves per request and hand it over - that
// guarantees actual variety across calls instead of relying on the model's
// own (biased) sense of randomness.
const CONSEQUENCE_CATEGORIES = [
  'banishment to the couch tonight',
  'the silent treatment, escalating by the hour',
  'a scathing one-star public review of them as a partner',
  'a mock trial or tribunal where the topic itself is the plaintiff',
  'the locks being changed',
  'a tell-all documentary made about the failure',
  'revoked snack/remote-control privileges',
  'a formal written complaint filed by the topic itself',
  'a dramatic reenactment of the failure performed for an audience',
  'having to grovel through a humiliating public apology tour',
];

const SYSTEM_PROMPT =
  "You write single one-line roasts for a private couple's relationship-timeline app. " +
  'A partner just answered a trivia question wrong. The user message tells you their name, ' +
  'their pronouns, which relationship fact they got wrong, and a specific consequence ' +
  'category to build the joke around - roast them about THAT topic using THAT consequence ' +
  'category, using their pronouns naturally if you refer to them in the third person. Never ' +
  'substitute a different milestone (if the topic is "our first kiss", the roast must be ' +
  'about the first kiss, not the anniversary or first date), and do not swap in a different ' +
  'consequence category than the one given - variety across roasts comes from the category ' +
  'changing each time, not from you picking your own.\n\n' +
  'Be genuinely FUNNY, not just harsh. A vague indignant tone with no actual joke in it ' +
  '("that is unforgivable", "I cannot believe you") is a failure - the line needs one ' +
  'specific, vivid, absurd image built from the given consequence category, delivered as a ' +
  'real punchline, not just an angry sentence. Ground the joke in the actual topic when you ' +
  'can. Make them regret forgetting.\n\n' +
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
  const category = CONSEQUENCE_CATEGORIES[Math.floor(Math.random() * CONSEQUENCE_CATEGORIES.length)];

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
            content: `Write one savage, brutal, funny roast line for ${name} (pronouns: ${pronouns}), who just got ${topic} wrong. Build the joke around this consequence category: ${category}.`,
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
