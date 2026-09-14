const fallback = (t) => {
  const s = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  const w = t.toLowerCase().match(/\b[\p{L}\p{N}]{5,}\b/gu) || [];
  const c = {};
  w.forEach(x => c[x] = (c[x] || 0) + 1);
  return {
    summary: s.slice(0, 4).join(' '),
    key_points: s.slice(0, 8),
    topics: Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]),
    interesting_points: s.slice(0, 3),
    presentation: 'Este documento apresenta e organiza o conteúdo principal do material analisado.',
    development: s.join('\n\n'),
    resolution: 'Síntese final: rever os pontos principais e aplicar as conclusões relevantes ao objetivo do documento.'
  };
};

const schema = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    key_points: { type: 'ARRAY', items: { type: 'STRING' } },
    topics: { type: 'ARRAY', items: { type: 'STRING' } },
    interesting_points: { type: 'ARRAY', items: { type: 'STRING' } },
    presentation: { type: 'STRING' },
    development: { type: 'STRING' },
    resolution: { type: 'STRING' }
  },
  required: ['summary', 'key_points', 'topics', 'interesting_points', 'presentation', 'development', 'resolution']
};

function normalize(result) {
  return {
    summary: String(result?.summary || ''),
    key_points: Array.isArray(result?.key_points) ? result.key_points.map(String) : [],
    topics: Array.isArray(result?.topics) ? result.topics.map(String) : [],
    interesting_points: Array.isArray(result?.interesting_points) ? result.interesting_points.map(String) : [],
    presentation: String(result?.presentation || ''),
    development: String(result?.development || ''),
    resolution: String(result?.resolution || '')
  };
}

export async function analyze(text, creator, title) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback(text);

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const prompt = `Analise o conteúdo abaixo em português e devolva SOMENTE um objeto JSON válido conforme o esquema solicitado. Seja fiel ao documento, não invente fatos e destaque o que realmente é importante, interessante e útil.\n\nCriador: ${creator}\nTítulo: ${title}\n\nConteúdo do documento:\n${text.slice(0, 120000)}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature: 0.2
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini API ${response.status}: ${body.slice(0, 1000)}`);
  }

  const data = await response.json();
  const textOutput = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
  if (!textOutput) throw new Error('Gemini não retornou conteúdo para análise.');

  return normalize(JSON.parse(textOutput));
}
