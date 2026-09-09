import assert from 'node:assert/strict';
import http from 'node:http';
import {before,after,test} from 'node:test';
process.env.NODE_ENV='test';
const {handler}=await import('../../server/index.mjs');
let server,base;
before(async()=>{server=http.createServer(handler);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{await new Promise(resolve=>server.close(resolve));});
test('admin routes reject anonymous requests and redirect only the HTML login',async()=>{
 process.env.AUTH_DISABLED_FOR_TESTS='0';
 for(const path of ['/api/admin/data-reports','/admin/reports/app.js','/admin/reports/style.css']){const response=await fetch(base+path);assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');}
 const response=await fetch(base+'/admin/reports',{redirect:'manual'});assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/developers/login?next=/admin/reports');
});
test('ordinary verified accounts cannot access review data',async()=>{
 process.env.AUTH_DISABLED_FOR_TESTS='1';process.env.REPORTS_ADMIN_EMAILS='';
 assert.equal((await fetch(base+'/api/admin/data-reports')).status,403);
});
test('allowlisted reviewers receive the admin, but cross-origin writes are refused',async()=>{
 process.env.REPORTS_ADMIN_EMAILS='test@example.test';
 const page=await fetch(base+'/admin/reports');assert.equal(page.status,200);assert.equal(page.headers.get('cache-control'),'no-store');assert.match(await page.text(),/EDITORIAL DESK/);
 const response=await fetch(base+'/api/admin/data-reports/11111111-1111-1111-1111-111111111111',{method:'POST',headers:{Origin:'https://evil.org','Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);
});
