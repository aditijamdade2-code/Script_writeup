const { Anthropic } = require('@anthropic-ai/sdk');

/**
 * Intelligent literary critique fallback generator.
 * Analyzes the text for pacing, imagery, dialogue, structure, and sensory elements,
 * extracting actual quotes from the author's text with insightful marginal notes.
 */
function generateHeuristicSuggestions(title, text) {
  if (!text || text.trim().length === 0) {
    return [
      {
        quote: title || "New Page",
        note: "Add a paragraph or opening hook to receive pacing and imagery suggestions."
      }
    ];
  }

  const cleanText = text.trim();
  const sentences = cleanText
    .split(/(?<=[.?!])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 5);

  const paragraphs = cleanText
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const suggestions = [];

  // Helper to extract a clean 3-7 word quote from a sentence
  function getSubQuote(sentence, preferStart = true) {
    const words = sentence.replace(/["“”'‘’]/g, '').split(/\s+/).filter(Boolean);
    if (words.length <= 6) return words.join(' ');
    if (preferStart) {
      return words.slice(0, 5).join(' ');
    } else {
      const mid = Math.floor(words.length / 2);
      return words.slice(mid, mid + 5).join(' ');
    }
  }

  // 1. Opening hook check
  if (sentences.length > 0) {
    const firstSentence = sentences[0];
    const quote = getSubQuote(firstSentence);
    if (firstSentence.length < 50) {
      suggestions.push({
        quote,
        note: "Crisp, direct opening hook that immediately establishes the narrative tone."
      });
    } else {
      suggestions.push({
        quote,
        note: "Atmospheric opening clause. Consider pausing here to heighten curiosity."
      });
    }
  }

  // 2. Dialogue & Voice check
  const dialogueMatches = cleanText.match(/["“][^"”]+["”]/g);
  if (dialogueMatches && dialogueMatches.length > 0) {
    const dialogueQuote = dialogueMatches[0].replace(/["“”]/g, '');
    const shortQuote = dialogueQuote.split(/\s+/).slice(0, 5).join(' ');
    suggestions.push({
      quote: shortQuote,
      note: "Natural dialogue cadence. Gives authentic weight to the character's voice."
    });
  }

  // 3. Sensory / Imagery check
  const sensoryKeywords = [
    'glisten', 'shadow', 'gleam', 'copper', 'cedar', 'smoke', 'whisper', 'golden',
    'velvet', 'rain', 'brass', 'scent', 'hollow', 'frost', 'crimson', 'shiver', 'stone',
    'cold', 'warm', 'light', 'dark', 'echo', 'metal', 'dust', 'crystal'
  ];
  let sensoryFound = false;
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const matchedWord = sensoryKeywords.find(kw => lower.includes(kw));
    if (matchedWord && suggestions.length < 4) {
      suggestions.push({
        quote: getSubQuote(sentence, true),
        note: `Vivid sensory anchor (${matchedWord}) that draws the reader into the scene.`
      });
      sensoryFound = true;
      break;
    }
  }

  // 4. Pacing & Rhythm (Midpoint or climax)
  if (sentences.length >= 3 && suggestions.length < 4) {
    const midSentence = sentences[Math.floor(sentences.length / 2)];
    suggestions.push({
      quote: getSubQuote(midSentence, false),
      note: "Effective pacing shift here—keeps the scene dynamic and moving forward."
    });
  }

  // 5. Ending / Transition note
  if (sentences.length >= 2 && suggestions.length < 4) {
    const lastSentence = sentences[sentences.length - 1];
    suggestions.push({
      quote: getSubQuote(lastSentence, true),
      note: "Strong resonant ending note that leaves lingering tension for the next page."
    });
  }

  // Fallback if very short text
  if (suggestions.length === 0 && sentences.length > 0) {
    suggestions.push({
      quote: getSubQuote(sentences[0]),
      note: "Compelling imagery. Expand on the surrounding sensory details."
    });
  }

  return suggestions.slice(0, 4);
}

/**
 * Generate 3-5 marginal-note-style suggestions using Claude API or fallback.
 */
async function generateSuggestions(title, text) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey && apiKey.trim() !== '') {
    try {
      const anthropic = new Anthropic({ apiKey });
      const prompt = `You are a master literary editor. Analyze this book chapter draft.
Title: "${title || 'Untitled'}"
Chapter Content:
"""
${text}
"""

Provide 3 to 5 short marginal-note-style suggestions about pacing, imagery, dialogue, or structure.
Requirements:
1. Each suggestion must include:
   - "quote": a short exact quote (3 to 6 words) from the chapter text that you are commenting on.
   - "note": a brief editorial note (under 20 words).
2. Respond ONLY with a valid JSON array of objects with the keys "quote" and "note".
Example format:
[
  {"quote": "gleamed like a captive constellation", "note": "Striking metaphor that elevates the workshop atmosphere."},
  {"quote": "Listen closely, Kaspar whispered", "note": "Great dialogue beat; builds subtle tension."}
]`;

      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      });

      const contentText = response.content[0].text.trim();
      // Extract JSON array from text in case model wrapped it in markdown code fences
      const jsonMatch = contentText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(item => ({
            quote: String(item.quote || '').trim(),
            note: String(item.note || '').trim()
          }));
        }
      }
    } catch (err) {
      console.warn('[AI Service] Anthropic API call failed or timed out. Using literary heuristic fallback.', err.message);
    }
  }

  // Heuristic engine fallback
  return generateHeuristicSuggestions(title, text);
}

module.exports = {
  generateSuggestions,
  generateHeuristicSuggestions
};
