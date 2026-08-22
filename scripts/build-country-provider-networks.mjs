#!/usr/bin/env node

import fs from "node:fs/promises";

const NRPZS = "https://datanzis.uzis.gov.cz/data/NR-01-NRPZS/NR-01-06/Otevrena-data-NR-01-06-nrpzs-mista-poskytovani-zdravotnich-sluzeb.csv";
const CMS_HOSPITALS = "https://data.cms.gov/provider-data/api/1/datastore/query/xubh-q36u/0?offset=0&limit=6000";

function csvRows(text) {
  const rows=[]; let row=[], field="", quoted=false;
  for(let i=0;i<text.length;i++) {
    const char=text[i], next=text[i+1];
    if(char==='"' && quoted && next==='"'){field+='"';i++;continue}
    if(char==='"'){quoted=!quoted;continue}
    if(char===","&&!quoted){row.push(field);field="";continue}
    if((char==="\n"||char==="\r")&&!quoted){if(char==="\r"&&next==="\n")i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field="";continue}
    field+=char;
  }
  if(field||row.length){row.push(field);rows.push(row)}
  const header=rows.shift();
  return rows.map(values=>Object.fromEntries(header.map((key,index)=>[key,values[index]||""])));
}

const response=await fetch(NRPZS,{headers:{"user-agent":"PublicSpendingData/1.0"}});
if(!response.ok)throw new Error(`NRPZS ${response.status}`);
const source=await response.text();
const all=csvRows(source);
const hospitalRows=all.filter(row=>row.ZZ_forma_pece.toLocaleLowerCase("cs").includes("lůžková"));
const facilities=new Map();
for(const row of hospitalRows) {
  const id=row.ZZ_misto_poskytovani_ID||row.ZZ_ID;
  const current=facilities.get(id)||{
    id:`CZE:${id}`,provider_id:row.poskytovatel_ICO||null,name:row.ZZ_nazev||row.poskytovatel_nazev,
    provider_name:row.poskytovatel_nazev,facility_type:row.ZZ_druh_nazev,legal_form:row.poskytovatel_pravni_forma_nazev||null,
    region:row.ZZ_kraj_nazev,district:row.ZZ_okres_nazev,municipality:row.ZZ_obec,
    address:[row.ZZ_ulice,row.ZZ_cislo_domovni_orientacni,row.ZZ_PSC,row.ZZ_obec].filter(Boolean).join(" "),
    coordinates:null,care_fields:new Set(),care_forms:new Set(),website:row.poskytovatel_web||null
  };
  const match=row.ZZ_GPS.match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
  if(match)current.coordinates={lat:Number(match[1]),lon:Number(match[2])};
  row.ZZ_obor_pece.split(",").map(item=>item.trim()).filter(Boolean).forEach(item=>current.care_fields.add(item));
  row.ZZ_forma_pece.split(",").map(item=>item.trim()).filter(Boolean).forEach(item=>current.care_forms.add(item));
  facilities.set(id,current);
}
const records=[...facilities.values()].map(item=>({...item,care_fields:[...item.care_fields].sort(),care_forms:[...item.care_forms].sort()})).sort((a,b)=>a.name.localeCompare(b.name,"cs"));
const providers=new Set(records.map(item=>item.provider_id).filter(Boolean));
const regions=Object.fromEntries(Object.entries(Object.groupBy(records,item=>item.region||"—")).map(([key,items])=>[key,items.length]));
const cmsResponse=await fetch(CMS_HOSPITALS,{headers:{accept:"application/json","user-agent":"PublicSpendingData/1.0"}});
if(!cmsResponse.ok)throw new Error(`CMS hospitals ${cmsResponse.status}`);
const cmsPayload=await cmsResponse.json();
const usRecords=(cmsPayload.results||[]).map(row=>({
  id:`USA:${row.facility_id}`,provider_id:row.facility_id,name:row.facility_name,provider_name:row.facility_name,
  facility_type:row.hospital_type,legal_form:row.hospital_ownership,region:row.state,district:row.countyparish,
  municipality:row.citytown,address:[row.address,row.citytown,row.state,row.zip_code].filter(Boolean).join(" "),
  coordinates:null,care_fields:[],care_forms:[],website:null,telephone:row.telephone_number||null,
  emergency_services:row.emergency_services==="Yes",overall_rating:row.hospital_overall_rating||null
})).sort((a,b)=>a.name.localeCompare(b.name,"en"));
const usRegions=Object.fromEntries(Object.entries(Object.groupBy(usRecords,item=>item.region||"—")).map(([key,items])=>[key,items.length]));
const payload={
  schema_version:"1.0.0",generated_at:new Date().toISOString(),
  methodology:{cs:"Síť obsahuje aktivní místa NRPZS, u nichž forma péče zahrnuje lůžkovou péči. Více řádků oborů stejného místa je sloučeno. Počet zařízení není počet budov ani počet nemocničních lůžek.",en:"The network contains active NRPZS locations whose care form includes inpatient care. Multiple specialty rows for the same location are merged. Facility count is neither a building count nor a bed count."},
  countries:{
    CZE:{coverage:"facility_register",facility_count:records.length,provider_count:providers.size,regions,facilities:records,source:{title:"ÚZIS NRPZS · Místa poskytování zdravotních služeb",url:NRPZS,license:"CC BY 4.0",update_frequency:"monthly"},payments:{coverage:"not_open_at_facility_level",note_cs:"NRHZS obsahuje individuální úhrady, veřejný otevřený export na úrovni poskytovatele však není publikován.",note_en:"NRHZS contains individual reimbursements, but no public facility-level open export is published."}},
    DEU:{coverage:"source_adapter_pending"},DNK:{coverage:"source_adapter_pending"},FRA:{coverage:"source_adapter_pending"},GBR:{coverage:"source_adapter_pending"},POL:{coverage:"source_adapter_pending"},SWE:{coverage:"source_adapter_pending"},CHE:{coverage:"source_adapter_pending"},
    USA:{coverage:"medicare_registered_hospitals",facility_count:usRecords.length,provider_count:usRecords.length,regions:usRegions,facilities:usRecords,source:{title:"CMS Provider Data Catalog · Hospital General Information",url:"https://data.cms.gov/provider-data/dataset/xubh-q36u",api_url:CMS_HOSPITALS,update_frequency:"quarterly"},payments:{coverage:"cost_reports_separate_adapter",note_cs:"Registr zařízení je načten; účetní výkazy Medicare HCRIS zůstávají samostatným účetním faktem.",note_en:"The facility register is loaded; Medicare HCRIS cost reports remain a separate accounting fact."}},
    UKR:{coverage:"source_adapter_pending"}
  }
};
await fs.writeFile(new URL("../data/country-provider-networks.v1.json",import.meta.url),`${JSON.stringify(payload,null,2)}\n`);
console.log(`Wrote ${records.length} Czech inpatient locations and ${usRecords.length} Medicare-registered U.S. hospitals`);
