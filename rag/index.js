/**
 * rag/index.js
 *
 * RAG layer — lexical retrieval with TF-IDF weighting + cosine similarity.
 *
 * The embedding is intentionally local and dependency-free so the POC
 * has zero external cost. Swap embed()/retrieve() for a real embedding
 * provider (OpenAI, Voyage, Cohere) in production — the seedCorpus /
 * retrieve / formatContext surface stays the same.
 */

let corpus = [];   // [{ id, tf, tfidf, metadata }]
let idf = {};      // term -> inverse document frequency

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function termFrequency(text) {
  const tokens = tokenize(text);
  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
  return freq;
}

function weightWithIdf(tf) {
  const weighted = {};
  for (const term of Object.keys(tf)) {
    const w = idf[term];
    if (w) weighted[term] = tf[term] * w;
  }
  return weighted;
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (const k of Object.keys(a)) {
    magA += a[k] * a[k];
    if (b[k]) dot += a[k] * b[k];
  }
  for (const k of Object.keys(b)) magB += b[k] * b[k];
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

async function seedCorpus(incidents) {
  console.log(`[RAG] Seeding corpus with ${incidents.length} documents...`);

  const tfPerDoc = incidents.map(inc => {
    const text = `${inc.short_description || ''} ${inc.close_notes || ''}`.trim();
    return { inc, text, tf: termFrequency(text) };
  });

  // Document frequency across the corpus, then IDF with add-one smoothing
  // so unseen terms don't produce Infinity if the query is embedded later.
  const df = {};
  for (const { tf } of tfPerDoc) {
    for (const term of Object.keys(tf)) df[term] = (df[term] || 0) + 1;
  }
  const N = tfPerDoc.length;
  idf = {};
  for (const term of Object.keys(df)) {
    idf[term] = Math.log((N + 1) / (df[term] + 1)) + 1;
  }

  corpus = tfPerDoc.map(({ inc, tf }) => ({
    id: inc.sys_id,
    tf,
    tfidf: weightWithIdf(tf),
    metadata: {
      number: inc.number,
      short_description: inc.short_description,
      close_notes: inc.close_notes,
      category: inc.category,
      priority: inc.priority,
    },
  }));

  console.log(`[RAG] Corpus ready. ${corpus.length} documents, ${Object.keys(idf).length} unique terms.`);
}

async function retrieve(query) {
  const topK = parseInt(process.env.RAG_TOP_K || '5', 10);
  const threshold = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.05');

  if (corpus.length === 0) {
    console.warn('[RAG] Corpus is empty.');
    return [];
  }

  const queryVec = weightWithIdf(termFrequency(query));

  return corpus
    .map(doc => ({
      id: doc.id,
      score: cosineSimilarity(queryVec, doc.tfidf),
      metadata: doc.metadata,
    }))
    .filter(r => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

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
