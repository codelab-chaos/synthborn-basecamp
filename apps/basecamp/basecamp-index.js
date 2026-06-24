(function basecampIndex() {
  const root = document.getElementById("basecamp-root");
  if (!root) return;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function renderAppCard(app, bannerSrc) {
    const link = el("a", `app-card app-card--${app.tile}`);
    link.href = app.href;
    link.setAttribute("aria-label", app.title);
    link.style.backgroundImage = `url("${app.image || bannerSrc}")`;

    const item = el("li");
    item.appendChild(link);
    return item;
  }

  function renderDocLink(item) {
    const link = el("a", "doc-link");
    link.href = item.href;
    link.appendChild(el("span", "doc-link__label", item.label));
    link.appendChild(el("span", "doc-link__desc", item.desc));
    const li = el("li");
    li.appendChild(link);
    return li;
  }

  function renderDocSection(section) {
    const wrap = el("section", "section");
    wrap.appendChild(el("h2", null, section.section));
    const list = el("ul", "doc-list");
    for (const item of section.items) {
      list.appendChild(renderDocLink(item));
    }
    wrap.appendChild(list);
    return wrap;
  }

  function render(config) {
    root.replaceChildren();
    root.removeAttribute("aria-busy");

    const bannerSrc = config.banner.src;

    const banner = document.createElement("img");
    banner.className = "banner";
    banner.src = bannerSrc;
    banner.alt = config.banner.alt;
    banner.width = 1920;
    banner.height = 220;
    root.appendChild(banner);

    const main = el("main");
    main.appendChild(el("p", "lead", config.lead));

    const appsSection = el("section", "section");
    appsSection.appendChild(el("h2", null, "Apps"));
    const appGrid = el("ul", "app-grid");
    for (const app of config.apps) {
      appGrid.appendChild(renderAppCard(app, bannerSrc));
    }
    appsSection.appendChild(appGrid);
    main.appendChild(appsSection);

    for (const section of config.docSections) {
      main.appendChild(renderDocSection(section));
    }

    const footer = el("footer");
    footer.textContent = config.footer;
    main.appendChild(footer);

    root.appendChild(main);
  }

  function showError(message) {
    root.replaceChildren();
    root.classList.add("basecamp-index--error");
    root.textContent = message;
    root.removeAttribute("aria-busy");
  }

  function configUrl() {
    const script = document.currentScript;
    return script?.getAttribute("data-config") || "./basecamp-index.json";
  }

  fetch(configUrl())
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(render)
    .catch((err) => {
      showError(`Failed to load basecamp-index.json (${err.message}). Run: node scripts/build-basecamp-index-json.js`);
    });
})();
