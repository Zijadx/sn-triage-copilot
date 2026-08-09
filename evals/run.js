#!/usr/bin/env node
/**
 * evals/run.js
 *
 * Offline retrieval eval for the RAG layer. Seeds the corpus with
 * fixture incidents, runs each labeled query through rag.retrieve(),
 * and reports hit@1, hit@3, hit@5, and MRR.
 *
 * No Claude API key required — this exercises the retrieval path only,
 * which is the load-bearing part of the "did we find the right past
 * incident" story. LLM-side evals (confidence calibration, answer
 * grounding) belong in a separate harness that hits the API.
 *
 * Usage:
 *   node evals/run.js
 *   MIN_HIT_AT_5=0.9 node evals/run.js   # fail CI if hit@5 drops below
 */

const path = require('path');
const fs = require('fs');

const rag = require('../rag');

const incidents = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/incidents.json'), 'utf8'));
const queries = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/queries.json'), 'utf8'));

const MIN_HIT_AT_5 = parseFloat(process.env.MIN_HIT_AT_5 || '0.8');

function hitAtK(results, expected, k) {
  const top = results.slice(0, k).map(r => r.id);
  return expected.some(id => top.includes(id));
}

function reciprocalRank(results, expected) {
  for (let i = 0; i < results.length; i++) {
    if (expected.includes(results[i].id)) return 1 / (i + 1);
  }
  return 0;
}

function pad(str, n) {
  const s = String(str);
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

async function main() {
  process.env.RAG_TOP_K = '5';
  process.env.RAG_SIMILARITY_THRESHOLD = '0';

  await rag.seedCorpus(incidents);

  const rows = [];
  let hit1 = 0, hit3 = 0, hit5 = 0, mrrSum = 0;

  for (const q of queries) {
    const results = await rag.retrieve(q.query);
    const h1 = hitAtK(results, q.expected, 1);
    const h3 = hitAtK(results, q.expected, 3);
    const h5 = hitAtK(results, q.expected, 5);
    const rr = reciprocalRank(results, q.expected);

    if (h1) hit1++;
    if (h3) hit3++;
    if (h5) hit5++;
    mrrSum += rr;

    const topId = results[0]?.id || '(none)';
    const topScore = results[0]?.score.toFixed(3) || '0';
    rows.push({ query: q.query, expected: q.expected[0], topId, topScore, h1, h3, h5, rr });
  }

  const n = queries.length;
  const hit1Rate = hit1 / n;
  const hit3Rate = hit3 / n;
  const hit5Rate = hit5 / n;
  const mrr = mrrSum / n;

  console.log('\n=== Retrieval Eval ===\n');
  console.log(pad('Query', 60) + pad('Expected', 26) + pad('Top-1', 26) + pad('Score', 8) + 'H1 H3 H5');
  console.log('-'.repeat(130));
  for (const r of rows) {
    const flag = (b) => (b ? ' Y' : ' .');
    console.log(
      pad(r.query.slice(0, 58), 60) +
      pad(r.expected, 26) +
      pad(r.topId, 26) +
      pad(r.topScore, 8) +
      flag(r.h1) + flag(r.h3) + flag(r.h5)
    );
  }

  console.log('\n--- Summary ---');
  console.log(`N queries : ${n}`);
  console.log(`hit@1     : ${(hit1Rate * 100).toFixed(1)}%   (${hit1}/${n})`);
  console.log(`hit@3     : ${(hit3Rate * 100).toFixed(1)}%   (${hit3}/${n})`);
  console.log(`hit@5     : ${(hit5Rate * 100).toFixed(1)}%   (${hit5}/${n})`);
  console.log(`MRR       : ${mrr.toFixed(3)}`);
  console.log(`threshold : hit@5 >= ${(MIN_HIT_AT_5 * 100).toFixed(0)}%`);

  if (hit5Rate < MIN_HIT_AT_5) {
    console.error(`\nFAIL: hit@5 (${(hit5Rate * 100).toFixed(1)}%) below threshold (${(MIN_HIT_AT_5 * 100).toFixed(0)}%)`);
    process.exit(1);
  }
  console.log('\nPASS');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
