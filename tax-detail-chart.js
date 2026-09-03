(() => {
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const colors = ["#a8b63f", "#687a2b", "#d6dd7a", "#b59f32", "#171918", "#92948b", "#d2ccc1"];
  const categories = [
    ["personal_income", "personalIncome"], ["corporate_income", "corporateIncome"], ["vat", "vat"],
    ["excise", "excise"], ["social_security", "social"], ["property", "property"], ["other", "other"]
  ];
  const polar = (cx, cy, radius, angle) => ({x:cx + radius * Math.cos(angle - Math.PI / 2), y:cy + radius * Math.sin(angle - Math.PI / 2)});
  function arcPath(cx, cy, outer, inner, start, end) {
    const p1=polar(cx,cy,outer,start),p2=polar(cx,cy,outer,end),p3=polar(cx,cy,inner,end),p4=polar(cx,cy,inner,start),large=end-start>Math.PI?1:0;
    return `M${p1.x.toFixed(2)},${p1.y.toFixed(2)} A${outer},${outer} 0 ${large} 1 ${p2.x.toFixed(2)},${p2.y.toFixed(2)} L${p3.x.toFixed(2)},${p3.y.toFixed(2)} A${inner},${inner} 0 ${large} 0 ${p4.x.toFixed(2)},${p4.y.toFixed(2)} Z`;
  }
  function render(root, detail, {labels, year, country, lang="en"}={}) {
    if (!root || !detail) return false;
    const fmt = value => new Intl.NumberFormat(lang === "cs" ? "cs-CZ" : "en-GB",{minimumFractionDigits:1,maximumFractionDigits:1}).format(value);
    const rows=categories.map(([key,label],index)=>({key,label:labels[label],value:Number(detail[key])||0,color:colors[index]}));
    const total=rows.reduce((sum,row)=>sum+row.value,0);
    if (Math.abs(total-100)>.2) return false;
    let angle=0;
    const slices=rows.map(row=>{const start=angle,end=angle+row.value/total*Math.PI*2;angle=end;return `<path d="${arcPath(154,154,116,67,start,end)}" fill="${row.color}" tabindex="0"><title>${esc(row.label)}: ${fmt(row.value)}%</title></path>`}).join("");
    const legend=rows.map((row,index)=>`<li style="--tax-color:${row.color}"><i></i><span>${esc(row.label)}</span><strong>${fmt(row.value)}%</strong></li>`).join("");
    root.innerHTML=`<div class="tax-detail-donut-figure"><svg viewBox="0 0 308 308" role="img" aria-label="${esc(country)} · ${esc(labels.chartLabel)} · ${year}">${slices}<text x="154" y="143" text-anchor="middle" class="tax-detail-total">100%</text><text x="154" y="169" text-anchor="middle" class="tax-detail-year">${year}</text></svg><ol class="tax-detail-legend">${legend}</ol></div>`;
    return true;
  }
  window.PSDTaxDetail={render,categories:categories.map(([key])=>key)};
})();
