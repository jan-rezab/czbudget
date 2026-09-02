(() => {
  const instances = new WeakMap();
  const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);

  class MunicipalityCountryPicker {
    constructor(select) {
      this.select = select;
      this.host = this.createHost();
      this.button = document.createElement("button");
      this.button.type = "button";
      this.button.className = "country-picker-readout";
      this.button.setAttribute("aria-haspopup", "listbox");
      this.button.setAttribute("aria-expanded", "false");

      this.popover = document.createElement("div");
      this.popover.className = "country-picker-popover";
      this.popover.hidden = true;
      this.host.append(this.button, this.popover);

      this.button.addEventListener("click", () => this.toggle());
      this.popover.addEventListener("click", (event) => {
        const option = event.target.closest("[data-country-picker-value]");
        if (!option) return;
        this.choose(option.dataset.countryPickerValue);
      });
      this.popover.addEventListener("input", (event) => {
        if (event.target.matches(".country-picker-search input")) this.filter(event.target.value);
      });
      this.host.addEventListener("keydown", (event) => this.onKeydown(event));
      document.addEventListener("pointerdown", (event) => {
        if (!this.host.contains(event.target)) this.close();
      });
    }

    createHost() {
      const original = this.select.closest("label");
      if (!original) return this.select.parentElement;
      const host = document.createElement("div");
      host.className = original.className;
      [...original.attributes].forEach((attribute) => {
        if (attribute.name !== "class" && attribute.name !== "for") host.setAttribute(attribute.name, attribute.value);
      });
      while (original.firstChild) host.append(original.firstChild);
      original.replaceWith(host);
      return host;
    }

    update(config) {
      this.config = config;
      this.host.classList.add("dynamic-country-picker", "municipality-country-picker");
      this.host.querySelector(":scope > span")?.classList.add("country-picker-label");
      const label = this.host.querySelector(":scope > span");
      if (label) label.textContent = config.label;

      this.select.innerHTML = config.options.map((option) => `<option value="${escapeHtml(option.value)}"${option.value === config.selected ? " selected" : ""}>${escapeHtml(option.label)}${option.meta ? ` · ${escapeHtml(option.meta)}` : ""}</option>`).join("");
      this.select.value = config.selected || "";
      this.select.tabIndex = -1;
      this.select.setAttribute("aria-hidden", "true");

      const selected = config.options.find((option) => option.value === config.selected);
      this.button.setAttribute("aria-label", selected ? `${config.label}: ${selected.label}` : config.label);
      this.button.innerHTML = selected
        ? `${this.flag(selected)}<span><strong>${escapeHtml(selected.label)}</strong>${selected.meta ? `<small>${escapeHtml(selected.meta)}</small>` : ""}</span><b aria-hidden="true"></b>`
        : `<span><strong>${escapeHtml(config.placeholder)}</strong><small>${escapeHtml(config.hint || "")}</small></span><b aria-hidden="true"></b>`;

      this.popover.innerHTML = `<label class="country-picker-search"><span>${escapeHtml(config.searchLabel)}</span><input type="search" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(config.searchPlaceholder)}"></label><output aria-live="polite"></output><div class="country-picker-options" role="listbox" aria-label="${escapeHtml(config.label)}">${config.options.map((option) => `<button type="button" role="option" aria-selected="${option.value === config.selected}" data-country-picker-value="${escapeHtml(option.value)}" data-country-picker-search="${escapeHtml(normalize(`${option.label} ${option.search || ""}`))}">${this.flag(option)}<span><strong>${escapeHtml(option.label)}</strong>${option.meta ? `<small>${escapeHtml(option.meta)}</small>` : ""}</span>${option.value === config.selected ? `<b aria-hidden="true">✓</b>` : ""}</button>`).join("")}</div><p class="country-picker-empty" hidden>${escapeHtml(config.emptyLabel)}</p>`;
      this.filter("");
    }

    flag(option) {
      return option.flag ? `<img src="${escapeHtml(option.flag)}" alt="">` : `<i class="country-picker-flag-placeholder" aria-hidden="true"></i>`;
    }

    toggle() {
      if (this.popover.hidden) this.open(); else this.close();
    }

    open() {
      this.popover.hidden = false;
      this.button.setAttribute("aria-expanded", "true");
      const input = this.popover.querySelector("input");
      input.value = "";
      this.filter("");
      requestAnimationFrame(() => input.focus());
    }

    close() {
      if (this.popover.hidden) return;
      this.popover.hidden = true;
      this.button.setAttribute("aria-expanded", "false");
    }

    choose(value) {
      if (!value || value === this.select.value) {
        this.close();
        return;
      }
      this.select.value = value;
      this.close();
      this.select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    filter(query) {
      const normalized = normalize(query.trim());
      const options = [...this.popover.querySelectorAll("[data-country-picker-value]")];
      let visible = 0;
      options.forEach((option) => {
        option.hidden = Boolean(normalized) && !option.dataset.countryPickerSearch.includes(normalized);
        if (!option.hidden) visible += 1;
      });
      this.popover.querySelector("output").textContent = `${visible} ${visible === 1 ? this.config.resultSingular : this.config.resultPlural}`;
      this.popover.querySelector(".country-picker-empty").hidden = visible > 0;
    }

    onKeydown(event) {
      if (event.key === "Escape") {
        this.close();
        this.button.focus();
      } else if (event.key === "ArrowDown" && event.target === this.button) {
        event.preventDefault();
        this.open();
      }
    }
  }

  window.PSDMunicipalityCountryPicker = {
    enhance(select, config) {
      if (!select) return null;
      let instance = instances.get(select);
      if (!instance) {
        instance = new MunicipalityCountryPicker(select);
        instances.set(select, instance);
      }
      instance.update(config);
      return instance;
    },
  };
})();
