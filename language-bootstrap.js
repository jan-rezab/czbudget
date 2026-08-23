(() => {
  if (window.__psdLanguageBootstrap) return;
  window.__psdLanguageBootstrap = true;

  const assetRoot = document.currentScript?.src ? new URL(".", document.currentScript.src).href : "/";
  if (!document.querySelector("link[data-portal-ui]")) { const styles = document.createElement("link"); styles.rel = "stylesheet"; styles.href = `${assetRoot}portal-ui.css?v=20260823`; styles.dataset.portalUi = "true"; document.head.append(styles); }
  if (!document.querySelector("script[data-portal-ui]")) { const script = document.createElement("script"); script.src = `${assetRoot}portal-ui.js?v=20260823`; script.defer = true; script.dataset.portalUi = "true"; document.head.append(script); }

  const supported = new Set(["cs", "en"]);
  const requested = new URLSearchParams(location.search).get("lang");
  let stored = null;
  try { stored = localStorage.getItem("psd-lang"); } catch {}

  const initial = document.documentElement.lang || "cs";
  const language = supported.has(requested) ? requested : (supported.has(stored) ? stored : initial);
  document.documentElement.lang = language;

  // The static HTML is Czech. When English is preferred, keep it out of the
  // first paint until the page-specific translator marks EN as active.
  if (language === initial) return;
  document.documentElement.dataset.languagePending = language;

  const style = document.createElement("style");
  style.id = "language-paint-guard";
  style.textContent = "html[data-language-pending] { visibility: hidden; }";
  document.head.append(style);

  const activeSelector = [
    `[data-lang="${language}"].active`,
    `[data-budget-lang="${language}"].active`,
    `[data-deep-lang="${language}"].active`,
    `[href*="lang=${language}"][aria-current="true"]`,
  ].join(",");

  let observer;
  let timeout;
  const reveal = () => {
    if (!document.documentElement.hasAttribute("data-language-pending")) return;
    document.documentElement.removeAttribute("data-language-pending");
    style.remove();
    observer?.disconnect();
    clearTimeout(timeout);
  };
  const revealWhenReady = () => {
    if (document.documentElement.lang === language && document.querySelector(activeSelector)) reveal();
  };

  window.psdLanguageReady = reveal;
  observer = new MutationObserver(revealWhenReady);
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "aria-current", "aria-pressed"] });
  addEventListener("psdlanguageready", reveal);
  timeout = setTimeout(reveal, 5000);
  queueMicrotask(revealWhenReady);
})();
