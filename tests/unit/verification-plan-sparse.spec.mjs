import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contractDigest } from '../../scripts/verification-plan.mjs';

// This fixture requires Git. The full verifier and pre-push hook run it in
// Git-capable environments; the minimal production Node image runs the pure
// verification-plan contracts separately.
test('contract digest includes files omitted from a sparse checkout',()=>{
  const root=mkdtempSync(join(tmpdir(),'psd-sparse-contract-'));
  const previous=process.cwd();
  const gitVariables=Object.entries(process.env).filter(([name])=>name.startsWith('GIT_'));
  for(const [name] of gitVariables) delete process.env[name];
  try {
    execFileSync('git',['init','-q',root]);
    mkdirSync(join(root,'tests'));
    const file=join(root,'tests','country.spec.mjs');
    writeFileSync(file,'export const chapterCount = 8;\n');
    execFileSync('git',['-C',root,'add','tests/country.spec.mjs']);
    execFileSync('git',['-C',root,'-c','user.name=Contract Test','-c','user.email=contract@example.com','commit','-qm','fixture']);
    process.chdir(root);
    const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
    const present=contractDigest(commit);
    rmSync(file);
    assert.equal(contractDigest(commit),present);
  } finally {
    process.chdir(previous);
    for(const [name,value] of gitVariables) process.env[name]=value;
    rmSync(root,{recursive:true,force:true});
  }
});
