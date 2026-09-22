import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {selectVerification} from './verification-plan.mjs';

export function releaseMode(plan) {
  for (const key of ['base', 'commit']) {
    if (!/^[a-f0-9]{40}$/.test(plan[key] || '')) throw new Error(`Invalid release ${key}`);
  }
  if (!Array.isArray(plan.files)) throw new Error('Release plan must name its changed files');
  const selected = selectVerification(plan.files);
  if (!['component', 'full'].includes(plan.lane)) throw new Error('Invalid release lane');
  if (plan.lane === 'component' && (selected.lane !== 'component' || plan.baseUnverified)) {
    throw new Error('Cannot narrow broad or unverified-base changes to component verification');
  }
  return plan.lane;
}

export function productionPlan(files, base, commit, deployedCommit) {
  const plan = {...selectVerification(files), base, commit};
  // Missing deployment provenance must require the exhaustive exact-commit gate.
  if (!deployedCommit) Object.assign(plan, {lane: 'full', baseUnverified: true});
  else if (deployedCommit !== base) throw new Error('Production diff must start at the deployed commit');
  releaseMode(plan);
  return plan;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(releaseMode(JSON.parse(readFileSync(process.argv[2], 'utf8'))));
}
