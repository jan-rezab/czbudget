#!/usr/bin/env python3
import json,re,requests
from bs4 import BeautifulSoup
URL='https://www.data.gv.at/datasets/71cb70af-2d7a-4b6d-811c-489f254a0353?locale=de'
r=requests.get(URL,headers={'User-Agent':'Mozilla/5.0 (compatible; PublicSpendingData/1.0)'},timeout=120); r.raise_for_status()
script=re.search(r'src="([^"]+\.js)"',r.text).group(1)
j=requests.get('https://www.data.gv.at'+script,timeout=120); j.raise_for_status()
s=requests.Session()
u='https://www.offenerhaushalt.at/gemeinde/wien/download?from_downloads_list=1&origin=gemeinde&rechnungsabschluss=1&year=2025'
q=s.get(u,timeout=120); q.raise_for_status(); soup=BeautifulSoup(q.text,'html.parser')
forms=[]
for form in soup.find_all('form'):
 forms.append({'action':form.get('action'),'method':form.get('method'),'inputs':[[x.get('name'),x.get('value'),x.get('type')] for x in form.find_all('input')],'selects':[[x.get('name'),[[o.get('value'),o.get_text(' ',strip=True)] for o in x.find_all('option')]] for x in form.find_all('select')]})
token=soup.find('input',{'name':'_token'}).get('value')
auth=s.post('https://www.offenerhaushalt.at/downloads/get-token',data={'foo':'bar','_token':token},headers={'Referer':q.url,'X-Requested-With':'XMLHttpRequest','X-CSRF-TOKEN':token},timeout=120); auth.raise_for_status(); contract=auth.json()
downloads={}
for budget in ('fhh','ehh','vhh'):
 fields={'gkz':'90001','_token':token,'haushalt':budget,'rechnungsabschluss':'ra','year':'2025','origin':'gemeinde'}
 p=s.request(contract['method'],contract['action'],data=fields if contract['method'].lower()=='post' else None,params=fields if contract['method'].lower()=='get' else None,timeout=180)
 downloads[budget]={'status':p.status_code,'url':p.url,'type':p.headers.get('content-type'),'disposition':p.headers.get('content-disposition'),'bytes':len(p.content),'head':p.content[:500].decode('utf-8','replace')}
app=s.get('https://www.offenerhaushalt.at/js/app.js?id=91e4de2ccdec2735142c',timeout=120); app.raise_for_status()
contexts=[]
for pattern in (r'form\.download',r'haushalt',r'gkz',r'finanzdaten'):
 for m in re.finditer(pattern,app.text,re.I): contexts.append(app.text[max(0,m.start()-700):m.start()+1800])
print(json.dumps({'url':q.url,'bytes':len(q.content),'forms':forms,'download_contract':contract,'downloads':downloads},ensure_ascii=False))
