(function(root){
  'use strict';
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  function assess(profile, published){
    if (published) return {eligible:published.eligible === true, status:published.coverage_status, notes:published.disclosures || [], taxYear:published.tax_year, transferYear:published.transfer_year};
    const taxes = Object.values(profile.tax_detail || {}).filter(finite);
    const levels = profile.government_levels || {};
    const recipients = Object.values(levels).filter(finite);
    const transfer = profile.municipal_transfers;
    const taxSum = taxes.reduce((a,b)=>a+b,0), recipientSum = recipients.reduce((a,b)=>a+b,0);
    const eligible = profile.latest_year >= 2020 && taxes.length >= 4 && taxSum >= 90 && taxSum <= 100.5 &&
      finite(levels.central) && (finite(levels.local) || finite(levels.state)) && recipientSum >= 95 && recipientSum <= 100.5 &&
      finite(transfer?.local_revenue_from_transfers_pct) && transfer.local_revenue_from_transfers_pct >= 0 && transfer.local_revenue_from_transfers_pct <= 100 &&
      Number.isInteger(transfer.year) && Math.abs(profile.latest_year-transfer.year) <= 5;
    return {eligible,status:eligible?'partial_disclosed':'excluded_low_coverage',taxYear:profile.latest_year,transferYear:transfer?.year,
      missingRecipients:['central','state','local','social_security'].filter(key=>!finite(levels[key])),notes:[]};
  }
  const api={assess};
  if(typeof module==='object' && module.exports) module.exports=api;
  else root.PSDRevenueCoverage=api;
})(typeof window==='object'?window:globalThis);
