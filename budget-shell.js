(() => {
  const content = document.querySelector(".budget-workspace-content");
  const requestedOrder = ["cesko", "struktura", "utraceni", "benchmark", "demografie", "zdravotni-system", "nemocnice-benchmark", "statni-firmy", "metodika"];
  if (content) requestedOrder.forEach(id => {
    const section = document.getElementById(id);
    if (section) content.append(section);
  });
  const initialHashTarget = location.hash ? document.getElementById(location.hash.slice(1)) : null;
  let preserveInitialHash = Boolean(initialHashTarget);
  const restoreInitialHash = () => {
    if (preserveInitialHash) initialHashTarget?.scrollIntoView();
  };
  [0, 250, 750, 1500, 3000].forEach(delay => setTimeout(restoreInitialHash, delay));
  ["wheel", "touchstart", "pointerdown", "keydown"].forEach(eventName => {
    addEventListener(eventName, () => { preserveInitialHash = false; }, {once:true, passive:true});
  });

  const links = [...document.querySelectorAll(".budget-side-nav a[href^='#']")];
  const sections = links.map(link => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  const activate = id => links.forEach(link => {
    const current = link.getAttribute("href") === `#${id}`;
    link.classList.toggle("active", current);
    if (current) link.setAttribute("aria-current","location"); else link.removeAttribute("aria-current");
  });
  let scheduled = false;
  const sync = () => {
    scheduled = false;
    const marker = scrollY + (innerWidth <= 780 ? 192 : Math.max(96, innerHeight * .16));
    const current = sections.reduce((match, section) => section.offsetTop <= marker ? section : match, sections[0]);
    if (current) activate(current.id);
  };
  addEventListener("scroll", () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(sync); }
  }, {passive:true});
  addEventListener("resize", sync);
  links.forEach(link => link.addEventListener("click", () => activate(link.getAttribute("href").slice(1))));
  activate(location.hash.slice(1) || "overview");
  requestAnimationFrame(sync);
})();
