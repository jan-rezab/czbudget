import { createHash } from 'node:crypto';

export function retainUnavailableHistory(runs, previous, unavailableInputs) {
  if (!unavailableInputs.length) return { runs, retained: 0 };
  if (!Array.isArray(previous?.runs) || previous.schema_version !== '2.0.0'
      || previous.content_hash !== createHash('sha256').update(JSON.stringify(previous.runs)).digest('hex')) {
    throw new Error('Unavailable provenance inputs require a valid committed process ledger.');
  }
  const historical = new Map();
  for (const run of previous.runs) {
    if (!run.run_id || historical.has(run.run_id)) throw new Error('Invalid historical ledger event identity.');
    historical.set(run.run_id, run);
  }
  // A partial shard set cannot prove a reduction in a historical event's volume
  // or destinations. Preserve that event verbatim; append newly observed IDs.
  for (const run of runs) if (!historical.has(run.run_id)) historical.set(run.run_id, run);
  return { runs: [...historical.values()], retained: previous.runs.length };
}
