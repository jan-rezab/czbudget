import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
function run(source,options=[]){return spawnSync(process.execPath,['scripts/run-bounded.mjs',...options,'--',process.execPath,'-e',source],{encoding:'utf8',timeout:6000});}
test('watchdog preserves successful output and exit status',()=>{
  const result=run('console.log("contract passed")');assert.equal(result.status,0);assert.match(result.stdout,/contract passed/);
  assert.equal(run('process.exit(3)').status,3);
});
test('watchdog stops a silent hung child',()=>{
  const result=run('setInterval(()=>{},1000)',['--idle-ms=200','--max-ms=2000']);
  assert.equal(result.status,124);assert.match(result.stderr,/no output\/progress/);
});
test('progress cannot bypass the total deadline',()=>{
  const result=run('setInterval(()=>console.log("still running"),30)',['--idle-ms=1000','--max-ms=300']);
  assert.equal(result.status,124);assert.match(result.stderr,/total deadline/);
});
