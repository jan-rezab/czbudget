import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assetData = async (name) => {
  const bytes = await readFile(join(root, "assets", name));
  return `data:image/svg+xml;base64,${bytes.toString("base64")}`;
};

const [lockupLight, lockupDark, czechFlag] = await Promise.all([
  assetData("logo-lockup.svg"),
  assetData("logo-lockup-dark.svg"),
  assetData("flags/cz.svg"),
]);

const palette = `
  --ink:#171918;--ink2:#242724;--paper:#f1ede3;--white:#faf7ef;
  --green:#a8b63f;--red:#c93237;--neutral:#8b8d83;--grid:#d2ccc1;
`;

const base = `
  *{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden}
  body{font-family:Arial,Helvetica,sans-serif;background:var(--paper);color:var(--ink)}
  .card{position:relative;width:1200px;height:630px;overflow:hidden}
  .lockup{position:absolute;z-index:4;width:238px;height:60px}
  .kicker{font:700 12px/1 monospace;letter-spacing:.12em;text-transform:uppercase}
  h1{margin:0;font:500 76px/.88 Georgia,serif;letter-spacing:-.055em}
  .rule{height:1px;background:var(--grid)}
`;

const cards = [
  {
    file: "og.png",
    html: `
      <div class="card home-card">
        <img class="lockup" src="${lockupDark}" alt="">
        <section class="home-copy"><span class="kicker">Otevřená fiskální data · Evropa</span><h1>Veřejné peníze.<br><em>V souvislostech.</em></h1><p>Srovnatelné rozpočty, národní zdroje a detail obcí.</p></section>
        <section class="ranking"><header><span>Výdaje vládních institucí / % HDP</span><span>2024</span></header>
          <div class="rank selected"><span class="flag"><img src="${czechFlag}" alt=""><b>CZE</b></span><strong>Česko</strong><i><b style="width:69%"></b></i><em>43.1</em></div>
          <div class="rank"><span class="iso">DEU</span><strong>Německo</strong><i><b style="width:79%"></b></i><em>49.5</em></div>
          <div class="rank"><span class="iso">FRA</span><strong>Francie</strong><i><b style="width:92%"></b></i><em>57.3</em></div>
          <div class="rank"><span class="iso">POL</span><strong>Polsko</strong><i><b style="width:76%"></b></i><em>47.4</em></div>
          <footer>Zdroj: IMF World Economic Outlook</footer>
        </section>
      </div>`,
    css: `
      .home-card{background:var(--ink);color:var(--white)}.home-card .lockup{left:64px;top:54px}
      .home-copy{position:absolute;left:64px;top:178px;width:500px}.home-copy .kicker{color:var(--green)}
      .home-copy h1{margin-top:25px;font-size:72px}.home-copy h1 em{color:var(--red);font-style:normal}.home-copy p{width:430px;margin:28px 0 0;color:var(--grid);font-size:17px;line-height:1.45}
      .ranking{position:absolute;right:0;top:0;width:560px;height:630px;padding:58px 45px;background:var(--paper);color:var(--ink)}
      .ranking header{display:flex;justify-content:space-between;padding-bottom:20px;border-bottom:1px solid var(--grid);color:var(--neutral);font:700 10px/1 monospace;text-transform:uppercase}
      .rank{height:94px;display:grid;grid-template-columns:48px 90px 1fr 42px;gap:12px;align-items:center;border-bottom:1px solid var(--grid)}
      .rank strong{font:500 14px/1 Georgia,serif}.rank>i{height:9px;background:var(--grid)}.rank>i>b{display:block;height:100%;background:var(--green)}.rank.selected>i>b{background:var(--red)}.rank em{font:10px/1 monospace;font-style:normal;text-align:right}
      .iso,.flag{width:40px;height:28px;display:grid;place-items:center;border:1px solid var(--grid);font:700 8px/1 monospace}.flag{position:relative}.flag img{width:38px;height:26px;object-fit:cover}.flag b{position:absolute;right:-4px;bottom:-4px;padding:3px;background:var(--green);font:700 6px/1 monospace}
      .ranking footer{position:absolute;left:45px;right:45px;bottom:31px;color:var(--neutral);font:9px/1 monospace;text-transform:uppercase}
    `,
  },
  {
    file: "og-cesko.png",
    html: `
      <div class="card czech-card">
        <img class="lockup" src="${lockupLight}" alt="">
        <section class="czech-copy"><span class="kicker">Česko · stát jako vlastník</span><h1>Zisk není<br>příjem rozpočtu<span>.</span></h1><p>Čistý výsledek a skutečné odvody jsou odlišné ukazatele.</p></section>
        <section class="owner-chart"><header><span>Výsledek</span><b>≠</b><span>Odvody</span></header><div class="columns"><div><i class="green"></i><strong>46,6</strong><small>mld. Kč výsledek</small></div><div><i class="red"></i><strong>29,9</strong><small>mld. Kč odvody</small></div></div></section>
      </div>`,
    css: `
      .czech-card{background:var(--paper)}.czech-card .lockup{left:52px;bottom:45px}
      .czech-copy{position:absolute;left:52px;top:54px;width:480px}.czech-copy .kicker{color:var(--red)}.czech-copy h1{margin-top:54px;font-size:78px}.czech-copy h1 span{color:var(--red)}.czech-copy p{width:410px;margin:28px 0 0;color:var(--neutral);font-size:16px;line-height:1.45}
      .owner-chart{position:absolute;right:28px;top:28px;width:570px;height:574px;padding:36px 48px;background:var(--ink);color:var(--white)}
      .owner-chart:before{content:"";position:absolute;inset:0;background:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:30px 30px;opacity:.08}
      .owner-chart header{position:relative;display:flex;justify-content:space-between;align-items:center;color:var(--grid);font:700 10px/1 monospace;text-transform:uppercase}.owner-chart header b{color:var(--white);font:500 52px/1 Georgia,serif}
      .columns{position:absolute;left:48px;right:48px;bottom:42px;height:410px;display:grid;grid-template-columns:1fr 1fr;gap:76px;align-items:end;border-bottom:1px solid var(--grid)}
      .columns>div{display:flex;flex-direction:column;align-items:center}.columns i{display:block;width:100%;border-bottom:55px solid var(--ink2)}.columns i.green{height:265px;background:var(--green)}.columns i.red{height:170px;background:var(--red)}
      .columns strong{margin-top:16px;font:500 53px/.9 Georgia,serif}.columns>div:first-child strong{color:var(--green)}.columns>div:last-child strong{color:var(--red)}.columns small{margin:10px 0 -34px;color:var(--grid);font:11px/1 monospace}
    `,
  },
  {
    file: "og-budget.png",
    html: `
      <div class="card budget-card">
        <img class="lockup" src="${lockupLight}" alt="">
        <section class="budget-copy"><span class="kicker">Česko · 2001–2045</span><h1>Český rozpočet.<br>Bez krátké paměti.</h1><p>Příjmy, výdaje, struktura a demografický model na jedné časové ose.</p></section>
        <section class="timeline"><div class="line"><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="stacks"><i style="height:130px"></i><i style="height:165px"></i><i style="height:205px"></i><i style="height:250px"></i><i style="height:300px"></i><i style="height:360px"></i></div><footer><span>2001</span><span>2045</span></footer></section>
      </div>`,
    css: `
      .budget-card{background:var(--paper)}.budget-card:after{content:"";position:absolute;right:-90px;top:-50px;width:650px;height:760px;background:var(--ink);transform:skewX(-9deg);transform-origin:bottom}
      .budget-card .lockup{left:56px;bottom:46px}.budget-copy{position:absolute;z-index:2;left:56px;top:56px;width:620px}.budget-copy .kicker{color:var(--red)}.budget-copy h1{margin-top:48px;font-size:70px}.budget-copy p{width:490px;margin:25px 0 0;color:var(--neutral);font-size:16px;line-height:1.45}
      .timeline{position:absolute;z-index:3;right:32px;top:48px;width:510px;height:534px;color:var(--white)}.timeline .line{position:absolute;left:20px;right:20px;top:50px;height:310px;border-bottom:5px solid var(--green);transform:skewY(-26deg)}.timeline .line i{position:absolute;bottom:-13px;width:24px;height:24px;border-radius:50%;background:var(--green)}.timeline .line i:nth-child(1){left:0}.timeline .line i:nth-child(2){left:19%}.timeline .line i:nth-child(3){left:39%}.timeline .line i:nth-child(4){left:59%}.timeline .line i:nth-child(5){left:79%}.timeline .line i:nth-child(6){right:0}
      .stacks{position:absolute;left:20px;right:20px;bottom:45px;height:390px;display:flex;align-items:end;justify-content:space-between}.stacks i{width:56px;background:linear-gradient(to top,var(--neutral) 0 28%,var(--red) 28% 65%,var(--green) 65%)}
      .timeline footer{position:absolute;left:20px;right:20px;bottom:0;display:flex;justify-content:space-between;color:var(--grid);font:10px/1 monospace}
    `,
  },
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const card of cards) {
  await page.setContent(`<style>:root{${palette}}${base}${card.css}</style>${card.html}`, { waitUntil: "load" });
  await page.screenshot({ path: join(root, "assets", card.file), clip: { x: 0, y: 0, width: 1200, height: 630 } });
}
await browser.close();
