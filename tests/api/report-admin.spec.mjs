import assert from 'node:assert/strict';
import {test} from 'node:test';
import {requireReportReviewer,validateDecision,createReportAdmin} from '../../server/report-admin.mjs';
const claims={email:'reviewer@example.org',email_verified:true,sub:'reviewer-id'};
const version='2026-09-09T10:00:00.000000Z';
const id='11111111-1111-1111-1111-111111111111';
const decision={status:'accepted',note:'Verified against the published source.',release:'',updateTime:version};
test('review access fails closed and requires verified allowlisted email',()=>{
 assert.throws(()=>requireReportReviewer(claims,{}));
 assert.throws(()=>requireReportReviewer({...claims,email_verified:false},{REPORTS_ADMIN_EMAILS:claims.email}));
 assert.throws(()=>requireReportReviewer({...claims,email:'outsider@example.org'},{REPORTS_ADMIN_EMAILS:claims.email}));
 assert.equal(requireReportReviewer(claims,{REPORTS_ADMIN_EMAILS:'REVIEWER@example.org'}),claims);
});
test('decisions require rationale and resolved decisions require release reference',()=>{
 assert.equal(validateDecision(decision).status,'accepted');
 for(const patch of [{status:'deleted'},{note:'ok'},{updateTime:''},{status:'resolved',release:''}])assert.throws(()=>validateDecision({...decision,...patch}));
 assert.equal(validateDecision({...decision,status:'resolved',release:'release-123'}).release,'release-123');
});
function fake(updateTime=version,commitStatus=200){
 const calls=[];const fetchImpl=async(url,options)=>{calls.push({url,options});if(url.includes('metadata.google'))return{ok:true,json:async()=>({access_token:'test'})};if(url.endsWith(':commit'))return{ok:commitStatus===200,status:commitStatus,json:async()=>({})};return{ok:true,json:async()=>({name:`projects/test/databases/reports/documents/dataReports/${id}`,updateTime,fields:{status:{stringValue:'new'}}})};};
 return{calls,admin:createReportAdmin({env:{REPORTS_PROJECT_ID:'test',REPORTS_DATABASE_ID:'reports'},fetchImpl})};
}
test('review and append-only history are written in one conditional commit',async()=>{
 const {calls,admin}=fake();await admin.decide(id,decision,claims);const commit=JSON.parse(calls.find(c=>c.url.endsWith(':commit')).options.body);
 assert.equal(commit.writes.length,2);assert.equal(commit.writes[0].currentDocument.updateTime,version);
 assert.equal(commit.writes[1].currentDocument.exists,false);assert.equal(commit.writes[1].update.fields.reviewerId.stringValue,claims.sub);
 assert.equal(commit.writes[0].update.fields.explanation,undefined);
});
test('stale reports and racing writes return conflicts',async()=>{
 const stale=fake('2026-09-09T11:00:00Z');await assert.rejects(stale.admin.decide(id,decision,claims),{status:409});assert.equal(stale.calls.some(c=>c.url.endsWith(':commit')),false);
 await assert.rejects(fake(version,409).admin.decide(id,decision,claims),{status:409});
});
