import {readFileSync, writeFileSync} from 'node:fs';
import {productionPlan} from './release-verification.mjs';

const read = file => readFileSync(file, 'utf8').trim();
const files = read('.verification-files').split('\n').filter(Boolean);
const plan = productionPlan(files, read('.verification-base'), process.env.COMMIT_SHA, read('.verification-deployed'));
writeFileSync('.verification-plan.json', JSON.stringify(plan, null, 2));
console.log(JSON.stringify({event: 'production-verification-plan', ...plan}));
