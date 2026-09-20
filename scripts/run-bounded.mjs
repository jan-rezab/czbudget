// Bound cloud test commands even if a browser stops reporting or teardown hangs.
import {spawn} from 'node:child_process';
const separator=process.argv.indexOf('--');
if(separator<0 || !process.argv[separator+1]) throw new Error('Usage: run-bounded.mjs [--idle-ms=N] [--max-ms=N] -- command [args]');
const options={idleMs:90_000,maxMs:480_000};
for(const flag of process.argv.slice(2,separator)) {
  const match=/^--(idle|max)-ms=(\d+)$/.exec(flag);
  if(!match || Number(match[2])<1) throw new Error('Invalid watchdog option: '+flag);
  options[match[1]+'Ms']=Number(match[2]);
}
const started=Date.now();let lastOutput=started,expired=false,killTimer;
const grouped=process.platform!=='win32';
const child=spawn(process.argv[separator+1],process.argv.slice(separator+2),{detached:grouped,stdio:['ignore','pipe','pipe']});
function signal(name){try{if(grouped)process.kill(-child.pid,name);else child.kill(name);}catch(error){if(error.code!=='ESRCH')throw error;}}
function stop(reason){
  if(expired)return;expired=true;
  process.stderr.write(`\nVerification watchdog: ${reason}; stopping owned test process group.\n`);
  signal('SIGTERM');killTimer=setTimeout(()=>signal('SIGKILL'),5000);
}
for(const [stream,target] of [[child.stdout,process.stdout],[child.stderr,process.stderr]]) {
  stream.on('data',chunk=>{lastOutput=Date.now();target.write(chunk);});
}
const timer=setInterval(()=>{
  if(Date.now()-started>=options.maxMs)stop('total deadline exceeded');
  else if(Date.now()-lastOutput>=options.idleMs)stop('no output/progress within '+options.idleMs+'ms');
},Math.min(1000,options.idleMs,options.maxMs));
child.on('error',error=>{clearInterval(timer);clearTimeout(killTimer);process.stderr.write(error.message+'\n');process.exitCode=1;});
child.on('close',code=>{clearInterval(timer);clearTimeout(killTimer);process.exitCode=expired?124:code??1;});
for(const name of ['SIGTERM','SIGINT'])process.on(name,()=>stop('parent received '+name));
