(() => {
  const statuses = ['new','reviewing','needs_information','accepted','rejected','duplicate','resolved'];
  const $ = selector => document.querySelector(selector);
  const label = value => value.replaceAll('_',' ');
  const element = (tag, text, className) => {const node=document.createElement(tag); if(text !== undefined) node.textContent=text; if(className) node.className=className; return node;};
  let reports=[], cursor='', current=null, selection=0;
  async function api(path='', options={}) {
    const response=await fetch(`/api/admin/data-reports${path}`,{...options,headers:{'Content-Type':'application/json'},cache:'no-store'});
    if(response.status===401){location.assign('/developers/login?next=/admin/reports');throw new Error('Please sign in again.');}
    const result=await response.json(); if(!response.ok) throw new Error(result.error?.message || 'Unable to load reports.'); return result;
  }
  const notice = text => {$('#notice').textContent=text;};
  for(const status of statuses){const option=element('option',label(status));option.value=status;$('#filter').append(option);}
  function renderQueue(){
    const list=$('#reports'); list.replaceChildren();
    const visible=reports.filter(report=>!$('#filter').value||report.status===$('#filter').value);
    for(const report of visible){const button=element('button',undefined,'report');button.setAttribute('aria-pressed',String(current?.id===report.id));button.append(element('span',label(report.status),'badge'),element('strong',report.title||report.page),element('small',`${report.reason} · ${new Date(report.createdAt).toLocaleDateString()}`));button.onclick=()=>loadDetail(report.id);list.append(button);}
    if(!visible.length) list.append(element('p',reports.length?'No matching reports on this page.':'No reports yet.','meta'));
  }
  function link(text, href){const a=element('a',text);try{const url=new URL(href,location.origin);if(!['http:','https:'].includes(url.protocol))return element('span',text);a.href=url.href;}catch{return element('span',text);}a.target='_blank';a.rel='noopener noreferrer';return a;}
  async function loadDetail(id){
    const request=++selection;notice('');
    try{const data=await api(`/${id}`);if(request!==selection)return;current=data.report;renderQueue();const detail=$('#detail');detail.replaceChildren();
      detail.append(element('span',label(current.status),'badge'),element('h2',current.title||'Data report'),element('p',`Reference ${current.id}`,'meta'),link('Open reported page ↗',current.page));
      if(current.target)detail.append(element('p',current.target,'prose'));
      detail.append(element('h3','What the reader noticed'),element('p',current.explanation,'prose evidence'));
      if(current.source)detail.append(link('Open supporting source ↗',current.source));
      detail.append(element('p',data.email?`Private contact: ${data.email}`:'No contact email supplied (or retention period expired).','meta'));
      const form=element('form');
      const stateLabel=element('label','Review status'),state=element('select');for(const value of statuses){const o=element('option',label(value));o.value=value;state.append(o);}state.value=current.status;stateLabel.append(state);
      const noteLabel=element('label','Decision and evidence'),note=element('textarea');note.required=true;note.minLength=10;note.maxLength=4000;note.rows=4;noteLabel.append(note);
      const releaseLabel=element('label','Published correction / release reference (required to resolve)'),release=element('input');release.maxLength=300;release.value=current.resolutionReference||'';releaseLabel.append(release);
      const save=element('button','Save review','primary');save.type='submit';
      const result=element('p');result.setAttribute('role','status');
      form.append(stateLabel,noteLabel,releaseLabel,element('p','Accepting a report does not change published data. Resolve it only after the correction has shipped. Contact details and review notes remain private.','warning'),save,result);
      const selectedReport=current;
      form.onsubmit=async event=>{event.preventDefault();save.disabled=true;result.textContent='Saving…';try{await api(`/${selectedReport.id}`,{method:'POST',body:JSON.stringify({status:state.value,note:note.value,release:release.value,updateTime:selectedReport.updateTime})});const row=reports.find(v=>v.id===selectedReport.id);if(row)row.status=state.value;await loadDetail(selectedReport.id);notice('Review saved with its history.');}catch(error){result.textContent=error.message;save.disabled=false;}};
      detail.append(form,element('h3','Review history'));
      if(!data.events.length)detail.append(element('p','No review decisions yet.','meta'));
      for(const event of data.events){const item=element('div',undefined,'event');item.append(element('strong',`${label(event.fromStatus)} → ${label(event.toStatus)}`),element('p',event.note,'prose'),element('p',`${event.reviewer} · ${new Date(event.createdAt).toLocaleString()}`,'meta'));if(event.release)item.append(element('p',event.release,'meta'));detail.append(item);}
      if(data.historyTruncated)detail.append(element('p','Showing the latest 100 review events.','meta'));
    }catch(error){if(request===selection)notice(error.message);}
  }
  async function load(next=false){$('#refresh').disabled=true;$('#more').disabled=true;notice('');try{const data=await api(next?`?cursor=${encodeURIComponent(cursor)}`:'');reports=data.reports;cursor=data.nextPageToken;$('#more').hidden=!cursor;renderQueue();}catch(error){notice(error.message);}finally{$('#refresh').disabled=false;$('#more').disabled=false;}}
  $('#filter').onchange=renderQueue;$('#refresh').onclick=()=>load();$('#more').onclick=()=>load(true);
  $('#logout').onclick=async()=>{try{const response=await fetch('/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw new Error('Sign out failed.');location.assign('/developers/login?next=/admin/reports');}catch(error){notice(error.message);}};
  load();
})();
