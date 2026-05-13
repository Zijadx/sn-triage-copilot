/**
 * rag/index.js
 *
 * RAG layer — embedding + semantic search.
 *
 * Uses a TF-IDF style local embedding for zero external dependencies.
 * Swap embed() for OpenAI/Voyage/Cohere in production — interface unchanged.
 */

// In-memory corpus: [{ id, text, embedding, metadata }]
let corpus = [];

/**
 * Simple but effective local embedding using term frequency.
 * Tokenizes text, builds a frequency vector over shared vocabulary.
 * Good enough for demo-scale semantic search.
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function embed(text) {
  const tokens = tokenize(text);
  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
  return freq;
}

function cosineSimilarity(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, magA = 0, magB = 0;
  for (const k of keys) {
    const va = a[k] || 0;
    const vb = b[k] || 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Seed the in-memory corpus from a list of SN incidents.
 */
async function seedCorpus(incidents) {
  console.log(`[RAG] Seeding corpus with ${incidents.length} incidents...`);
  corpus = incidents.map(inc => {
    const text = `${inc.short_description} ${inc.close_notes || ''}`.trim();
    return {
      id: inc.sys_id,
      text,
      embedding: embed(text),
      metadata: {
        number: inc.number,
        short_description: inc.short_description,
        close_notes: inc.close_notes,
        category: inc.category,
        priority: inc.priority,
      },
    };
  });
  console.log(`[RAG] Corpus ready. ${corpus.length} documents indexed.`);
}

/**
 * Retrieve top-K most similar incidents for a query.
 */
async function retrieve(query) {
  const topK = parseInt(process.env.RAG_TOP_K || '5', 10);
  const threshold = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.01');

  if (corpus.length === 0) {
    console.warn('[RAG] Corpus is empty.');
    return [];
  }

  const queryEmbedding = embed(query);

  const scored = corpus
    .map(doc => ({
      score: cosineSimilarity(queryEmbedding, doc.embedding),
      metadata: doc.metadata,
    }))
    .filter(r => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

/**
 * Format retrieved results into a context string for the prompt.
 */
function formatContext(results) {
  if (results.length === 0) return 'No similar past incidents found.';
  return results
    .map((r, i) => {
      const { number, short_description, close_notes, category, priority } = r.metadata;
      return [
        `[Incident ${i + 1}] ${number} (similarity: ${(r.score * 100).toFixed(0)}%)`,
        `Category: ${category || 'N/A'} | Priority: ${priority || 'N/A'}`,
        `Issue: ${short_description}`,
        `Resolution: ${close_notes || 'No resolution notes'}`,
      ].join('\n');
    })
    .join('\n\n---\n\n');
}

module.exports = { seedCorpus, retrieve, formatContext };
