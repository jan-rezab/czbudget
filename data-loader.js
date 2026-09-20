// Bound stalled requests and retry transient failures once, including cached errors.
(() => {
  const pending = new Map();
  async function request(url, timeoutMs) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, { signal: controller.signal, cache: attempt ? "reload" : "default" });
        if (!response.ok) {
          const error = new Error(`${url}: ${response.status}`);
          error.permanent = response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status);
          throw error;
        }
        return await response.json();
      } catch (error) {
        if (attempt || error.permanent) throw error;
      } finally {
        clearTimeout(timer);
      }
    }
  }
  window.PSDData = {
    loadJson(url, { timeoutMs = 12000 } = {}) {
      const key = new URL(url, location.href).href;
      if (!pending.has(key)) pending.set(key, request(key, timeoutMs).finally(() => pending.delete(key)));
      return pending.get(key);
    },
    retryButton(container, language) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = language === "en" ? "Try again" : "Zkusit znovu";
      button.addEventListener("click", () => location.reload());
      container.append(button);
    },
  };
})();
