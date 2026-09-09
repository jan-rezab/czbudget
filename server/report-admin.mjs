import crypto from 'node:crypto';
import { AuthError } from './auth.mjs';
import { DataError } from './data-store.mjs';
export const REPORT_STATUSES = ['new', 'reviewing', 'needs_information', 'accepted', 'rejected', 'duplicate', 'resolved'];
export function requireReportReviewer(claims, env = process.env) {
  const approved = (env.REPORTS_ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  if (claims?.email_verified !== true || !approved.includes(String(claims.email || '').toLowerCase())) throw new AuthError(403, 'reviewer_required', 'This account does not have report-review access.');
  return claims;
}
export function validateDecision(body) {
  if (!body || !REPORT_STATUSES.includes(body.status)) throw new DataError(400, 'invalid_status', 'Choose a valid status.');
  if (typeof body.note !== 'string' || body.note.trim().length < 10 || body.note.length > 4000) throw new DataError(400, 'invalid_note', 'Explain the decision in 10–4,000 characters.');
  if (typeof body.updateTime !== 'string' || !/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(body.updateTime)) throw new DataError(400, 'invalid_version', 'Reload the report before saving.');
  const release = body.release || '';
  if (typeof release !== 'string' || release.length > 300 || (body.status === 'resolved' && !release.trim())) throw new DataError(400, 'invalid_release', 'Resolved reports require the published correction or release reference.');
  return { status: body.status, note: body.note.trim(), release: release.trim(), updateTime: body.updateTime };
}
const unpack = doc => ({ id: doc.name.split('/').at(-1), updateTime: doc.updateTime, ...Object.fromEntries(Object.entries(doc.fields || {}).map(([k,v]) => [k,v.stringValue ?? v.timestampValue ?? null])) });
export function createReportAdmin({env = process.env, fetchImpl = fetch} = {}) {
  let identity = null;
  async function request(suffix, options = {}) {
    if (!env.REPORTS_PROJECT_ID) throw new DataError(503, 'reports_unconfigured', 'The report database is not configured yet.');
    if (!identity || identity.expiresAt < Date.now() + 60000) {
      const tokenResponse = await fetchImpl('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {headers:{'Metadata-Flavor':'Google'},signal:AbortSignal.timeout(5000)});
      if (!tokenResponse.ok) throw new DataError(503, 'reports_unavailable', 'Report storage is unavailable.');
      const token = await tokenResponse.json();
      if (!token.access_token) throw new DataError(503, 'reports_unavailable', 'Report storage identity is unavailable.');
      identity = { value: token.access_token, expiresAt: Date.now() + Number(token.expires_in || 300) * 1000 };
    }
    const response = await fetchImpl(`https://firestore.googleapis.com/v1/${root()}${suffix}`, {...options,headers:{Authorization:`Bearer ${identity.value}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(8000)});
    if (!response.ok) {
      if (response.status === 404) throw new DataError(404, 'report_not_found', 'Report not found.');
      const failure = await response.json().catch(() => ({}));
      if ([409,412].includes(response.status) || ['FAILED_PRECONDITION','ABORTED'].includes(failure.error?.status)) throw new DataError(409, 'report_changed', 'Another reviewer changed this report. Reload before saving.');
      throw new DataError(503, 'reports_unavailable', 'Report storage is unavailable. Your change has not been confirmed.');
    }
    return response.json();
  }
  const root = () => `projects/${env.REPORTS_PROJECT_ID}/databases/${env.REPORTS_DATABASE_ID || '(default)'}/documents`;
  const checkID = id => { if (!/^[a-f0-9-]{36}$/.test(id)) throw new DataError(400, 'invalid_id', 'Invalid report ID.'); };
  return {
    async list(cursor = '') {
      if (cursor.length > 4000) throw new DataError(400, 'invalid_cursor', 'Invalid page cursor.');
      const result = await request(`/dataReports?${new URLSearchParams({pageSize:'40',orderBy:'createdAt desc',...(cursor ? {pageToken:cursor}: {})})}`);
      return { reports:(result.documents || []).map(unpack), nextPageToken:result.nextPageToken || '' };
    },
    async detail(id) {
      checkID(id);
      const report = unpack(await request(`/dataReports/${id}`));
      let contact = null;
      try { contact = unpack(await request(`/dataReportContacts/${id}`)); } catch (error) { if (error.status !== 404) throw error; }
      const history = await request(`/dataReports/${id}/events?pageSize=100&orderBy=createdAt%20desc`);
      return { report, email:contact?.email || '', events:(history.documents || []).map(unpack), historyTruncated:!!history.nextPageToken };
    },
    async decide(id, body, claims) {
      checkID(id); const decision = validateDecision(body);
      const existing = unpack(await request(`/dataReports/${id}`));
      if (existing.updateTime !== decision.updateTime) throw new DataError(409, 'report_changed', 'Another reviewer changed this report. Reload before saving.');
      const now = new Date().toISOString();
      const strings = values => Object.fromEntries(Object.entries(values).map(([key,value]) => [key,{stringValue:value}]));
      const fields = {...strings({status:decision.status, resolutionReference:decision.release}),updatedAt:{timestampValue:now}};
      const event = {...strings({fromStatus:existing.status,toStatus:decision.status,note:decision.note,release:decision.release,reviewer:claims.email,reviewerId:claims.sub}),createdAt:{timestampValue:now}};
      await request(':commit',{method:'POST',body:JSON.stringify({writes:[
        {update:{name:`${root()}/dataReports/${id}`,fields},updateMask:{fieldPaths:Object.keys(fields)},currentDocument:{updateTime:decision.updateTime}},
        {update:{name:`${root()}/dataReports/${id}/events/${crypto.randomUUID()}`,fields:event},currentDocument:{exists:false}}
      ]})});
      return {id,status:decision.status};
    }
  };
}
