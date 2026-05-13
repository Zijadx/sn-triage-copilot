/**
 * rag/index.js
 *
 * RAG (Retrieval-Augmented Generation) layer.
 *
 * Responsibilities:
 *   1. Embed a query string using Anthropic's embedding endpoint
 *   2. Compare against an in-memory corpus of SN incident embeddings
 *   3. Return the top-K most similar incidents as context
 *
 * In production you'd swap the in-memory store for pgvector, Pinecone, etc.
 * The interface stays identical — that's the point of this abstraction.
 */

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic();

// In-memory corpus: [{ id, text, embedding, metadata }]
let corpus = [];

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (magA * magB);
}

/**
 * Embed a single text string.
 * Returns a float array.
 */
async function embed(text) {
  const response = await client.embeddings.create({
    model: 'voyage-3',
    input: text,
    input_type: 'query',
  });
  return response.data[0].embedding;
}

/**
 * Seed the in-memory corpus from a list of SN incidents.
 * Call this at server startup after fetching resolved incidents.
 *
 * incidents: [{ sys_id, number, short_description, close_notes, ... }]
 */
async function seedCorpus(incidents) {
  console.log(`[RAG] Seeding corpus with ${incidents.length} incidents...`);

  const embedPromises = incidents.map(async (inc) => {
    const text = `${inc.short_description}\n${inc.close_notes || ''}`.trim();
    const embedding = await embed(text);
    return {
      id: inc.sys_id,
      text,
      embedding,
      metadata: {
        number: inc.number,
        short_description: inc.short_description,
        close_notes: inc.close_notes,
        category: inc.category,
        priority: inc.priority,
      },
    };
  });

  corpus = await Promise.all(embedPromises);
  console.log(`[RAG] Corpus ready. ${corpus.length} documents indexed.`);
}

/**
 * Retrieve the top-K most similar incidents for a given query.
 *
 * Returns: [{ score, metadata }]
 */
async function retrieve(query) {
  const topK = parseInt(process.env.RAG_TOP_K || '5', 10);
  const threshold = parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.75');

  if (corpus.length === 0) {
    console.warn('[RAG] Corpus is empty. Returning no results.');
    return [];
  }

  const queryEmbedding = await embed(query);

  const scored = corpus
    .map((doc) => ({
      score: cosineSimilarity(queryEmbedding, doc.embedding),
      metadata: doc.metadata,
    }))
    .filter((r) => r.score >= threshold)
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
