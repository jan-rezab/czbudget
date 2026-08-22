(() => {
  const text = (cell) => (cell?.dataset.sortValue || cell?.textContent || "").trim();
  const value = (cell) => {
    const raw = text(cell);
    if (!raw || raw === "—") return { type: "empty", value: null };
    const normalized = raw
      .replace(/[−–]/g, "-")
      .replace(/\u00a0/g, " ")
      .replace(/[^0-9,\.\-+]/g, "")
      .replace(/(?<=\d)[ .](?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".");
    const numeric = Number(normalized);
    return Number.isFinite(numeric) && /\d/.test(raw)
      ? { type: "number", value: numeric }
      : { type: "text", value: raw.toLocaleLowerCase(document.documentElement.lang) };
  };
  const compare = (a, b, direction) => {
    if (a.type === "empty") return 1;
    if (b.type === "empty") return -1;
    const result = a.type === "number" && b.type === "number"
      ? a.value - b.value
      : String(a.value).localeCompare(String(b.value), document.documentElement.lang, { numeric: true, sensitivity: "base" });
    return result * direction;
  };
  const enhance = (table) => {
    if (table.dataset.sortableReady || table.dataset.noSort === "true") return;
    const body = table.tBodies[0], headers = [...(table.tHead?.rows[0]?.cells || [])];
    if (!body || headers.length < 2) return;
    table.dataset.sortableReady = "true";
    table.classList.add("sortable-table");
    headers.forEach((header, column) => {
      if (header.dataset.noSort === "true" || !header.textContent.trim()) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sortable-header-button";
      button.textContent = header.textContent.trim();
      header.setAttribute("aria-sort", "none");
      button.title = document.documentElement.lang === "en" ? "Sort this column" : "Seřadit podle sloupce";
      header.replaceChildren(button);
      const sort = () => {
        const descending = header.getAttribute("aria-sort") !== "descending";
        headers.forEach((item) => item.setAttribute("aria-sort", "none"));
        header.setAttribute("aria-sort", descending ? "descending" : "ascending");
        [...body.rows]
          .map((row, index) => ({ row, index, key: value(row.cells[column]) }))
          .sort((a, b) => compare(a.key, b.key, descending ? -1 : 1) || a.index - b.index)
          .forEach(({ row }) => body.append(row));
      };
      button.addEventListener("click", sort);
    });
  };
  const scan = (root = document) => root.querySelectorAll?.("table").forEach(enhance);
  scan();
  new MutationObserver((records) => records.forEach(({ addedNodes }) => addedNodes.forEach((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches?.("table")) enhance(node);
    scan(node);
  }))).observe(document.body, { childList: true, subtree: true });
})();
