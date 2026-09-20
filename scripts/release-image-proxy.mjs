// Cloud-only browser harness: localhost origin preserves the production CSP;
// the only upstream is the task-owned candidate image on Cloud Build's network.
import { createServer, request as upstreamRequest } from 'node:http';
const server=createServer((request,response)=>{
  const upstream=upstreamRequest({hostname:'psd-release-candidate',port:8080,path:request.url,method:request.method,headers:request.headers,timeout:15_000}, result=>{
    response.writeHead(result.statusCode,result.headers); result.pipe(response);
  });
  upstream.on('timeout',()=>upstream.destroy(new Error('Candidate timed out')));
  upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502);response.end('Candidate unavailable');});
  request.pipe(upstream);
});
server.listen(4173,'127.0.0.1');
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
