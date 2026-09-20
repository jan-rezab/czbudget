#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";

const [outcome, imageDigest, gitSha, buildId, prNumber = ""] = process.argv.slice(2);
if (!['deployed', 'skipped'].includes(outcome)) throw new Error('outcome must be deployed or skipped');
if (!/^[a-f0-9]{40}$/.test(gitSha || '')) throw new Error('git SHA is required');
if (!buildId) throw new Error('Cloud Build ID is required');
if (!/^sha256:[a-f0-9]{64}$/.test(imageDigest || '')) throw new Error('immutable image digest is required');

const readJSON = async (file) => JSON.parse(await readFile(file, 'utf8'));
const release = await readJSON('data/release-manifest.v1.json');
const municipal = await readJSON('/workspace/.public-serving-build/current.json').catch(() => null);
const cityvizor = await readJSON('data/cityvizor-current.v1.json').catch(() => null);
const dataReleaseIds = [
  `${gitSha}-${buildId}`,
  release.municipal_ingestion_run_id,
  municipal?.release_id,
  cityvizor?.release_id,
].filter((value, index, values) => value && values.indexOf(value) === index);

const event = {
  schema_version: '1.0.0',
  event_type: 'deployment',
  event_id: `deployment:${buildId}`,
  timestamp: new Date().toISOString(),
  outcome,
  git_sha: gitSha,
  pr_number: /^\d+$/.test(prNumber) ? Number(prNumber) : null,
  cloud_build_id: buildId,
  image_digest: imageDigest,
  data_release_ids: dataReleaseIds,
};
await writeFile('/workspace/.deployment-event.json', `${JSON.stringify(event, null, 2)}\n`);
console.log(`Recorded ${outcome} deployment event ${event.event_id}`);
