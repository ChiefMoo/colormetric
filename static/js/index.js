(() => {
  "use strict";

  const VERSION = "filters-20260808-10";
  const DEFAULT_HIDDEN_COLORMAPS = new Set(["spectral", "blueyellow"]);
  const SWATCH_COLORS = {
    greyscale: ["#777777"],
    singlehue: ["#2878b8"],
    cubehelix: ["#23104f", "#2b8c87", "#f2d8a7"],
    bodyheat: ["#461220", "#d8401e", "#ffd166"],
    coolwarm: ["#3b6fc4", "#d9584f"],
    spectral: ["#d53e4f", "#fdae61", "#66c2a5", "#3288bd"],
    rainbow: ["#ef3b3b", "#f4d03f", "#36ad63", "#3478d4"],
    blueyellow: ["#2864b7", "#f2d64b"]
  };
  const state = {
    manifest: null,
    index: 0,
    metric: "DE2000",
    ranking: "D",
    rankAnimationTimer: null,
    rankReturnTimer: null,
    rotating: false,
    selectedColormaps: new Set()
  };
  const elements = {};

  function requireElement(id) {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Required page element #${id} is missing`);
    return element;
  }

  function setStatus(message) {
    if (elements.status) elements.status.textContent = message;
  }

  function prettyName(name) {
    return name.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
  }

  function wrapIndex(index) {
    const count = state.manifest.datasets.length;
    return (index + count) % count;
  }

  function imageElement(src, alt, eager = false) {
    const image = document.createElement("img");
    image.src = src;
    image.alt = alt;
    image.loading = eager ? "eager" : "lazy";
    image.decoding = "async";
    return image;
  }

  function selectedColormaps() {
    return state.manifest.colormaps.filter(colormap => state.selectedColormaps.has(colormap));
  }

  function configureGrid(grid) {
    grid.style.setProperty("--column-count", String(selectedColormaps().length));
    return grid;
  }

  function renderColorbars() {
    elements.colorbarGrid.replaceChildren();
    selectedColormaps().forEach(colormap => {
      const cell = document.createElement("div");
      cell.className = "colorbar-cell";
      cell.append(imageElement(
        `static/gallery/colormaps/${colormap}.png?v=${VERSION}`,
        `${prettyName(colormap)} colorbar`,
        true
      ));
      elements.colorbarGrid.append(cell);
    });
    configureGrid(elements.colorbarGrid);
  }

  function fieldGrid(dataset, eager) {
    const grid = document.createElement("div");
    grid.className = "eight-grid";
    selectedColormaps().forEach(colormap => {
      const cell = document.createElement("div");
      cell.className = "field-cell";
      cell.dataset.colormap = colormap;
      cell.append(imageElement(
        `${dataset.images[colormap]}?v=${VERSION}`,
        `${dataset.label} rendered with ${prettyName(colormap)}`,
        eager
      ));
      grid.append(cell);
    });
    return configureGrid(grid);
  }

  function createDepthCard(offset) {
    const datasetIndex = wrapIndex(state.index + offset);
    const dataset = state.manifest.datasets[datasetIndex];
    const depth = offset;
    const card = document.createElement("article");
    card.className = "depth-card";
    card.dataset.offset = String(offset);
    card.dataset.depth = String(depth);
    card.dataset.datasetIndex = String(datasetIndex);
    card.style.setProperty("--offset", String(offset));
    card.style.setProperty("--depth", String(depth));

    card.append(fieldGrid(dataset, depth <= 1));
    return card;
  }

  function renderDepthStack() {
    elements.depthTrack.replaceChildren();
    [0, 1, 2, 3].forEach(offset => {
      elements.depthTrack.append(createDepthCard(offset));
    });
    window.requestAnimationFrame(syncStageHeight);
  }

  function syncStageHeight() {
    const frontCard = elements.depthTrack.querySelector('.depth-card[data-depth="0"]');
    if (!frontCard) return;
    const sampleCell = frontCard.querySelector(".field-cell");
    const thumbnailHeight = (sampleCell?.getBoundingClientRect().height || 0) * .2;
    const depthStackOffset = 30;
    const rowClearance = 24;
    elements.stage.style.height = `${Math.ceil(
      frontCard.getBoundingClientRect().height + depthStackOffset + thumbnailHeight + rowClearance
    )}px`;
  }

  function rotateDataset() {
    if (state.rotating || !state.manifest?.datasets.length) return;
    resetRankAnimation();
    state.rotating = true;
    elements.stage.setAttribute("aria-disabled", "true");

    const incomingCard = createDepthCard(4);
    elements.depthTrack.append(incomingCard);
    void incomingCard.offsetWidth;

    const cards = [...elements.depthTrack.querySelectorAll(".depth-card")];
    cards.forEach(card => {
      const newOffset = Number(card.dataset.offset) - 1;
      const newDepth = newOffset;
      card.dataset.offset = String(newOffset);
      card.dataset.depth = String(newDepth);
      card.style.setProperty("--offset", String(newOffset));
      card.style.setProperty("--depth", String(newDepth));
    });

    window.setTimeout(() => {
      state.index = wrapIndex(state.index + 1);
    }, 210);
    window.setTimeout(() => {
      renderDepthStack();
      state.rotating = false;
      elements.stage.removeAttribute("aria-disabled");
    }, 440);
  }

  function rankingDefinitionFor(ranking) {
    return {
      D: { key: "descPower", direction: -1, label: "Descriptive Power, high to low" },
      U: { key: "uniformity", direction: 1, label: "Uniformity, low to high" },
      S: { key: "smoothness", direction: 1, label: "Smoothness, low to high" }
    }[ranking];
  }

  function rankingDefinition() {
    return rankingDefinitionFor(state.ranking);
  }

  function resetRankAnimation() {
    window.clearTimeout(state.rankAnimationTimer);
    window.clearTimeout(state.rankReturnTimer);
    state.rankAnimationTimer = null;
    state.rankReturnTimer = null;
    elements.depthTrack?.querySelectorAll(".field-cell").forEach(cell => {
      cell.classList.remove("is-ranked-sequence", "is-rank-returning");
      cell.style.removeProperty("--rank-delay");
      cell.style.removeProperty("--rank-x");
      cell.style.removeProperty("--rank-y");
      cell.style.removeProperty("transform");
      cell.style.removeProperty("z-index");
    });
    elements.depthTrack?.querySelectorAll(".rank-tray").forEach(tray => tray.remove());
  }

  function animateRankedFields() {
    if (state.rotating) return;
    resetRankAnimation();
    const card = elements.depthTrack.querySelector('.depth-card[data-depth="0"]');
    const values = state.manifest.datasets[state.index]?.values?.[state.metric];
    const definition = rankingDefinition();
    if (!card || !values || !definition) return;

    const cells = [...card.querySelectorAll(".field-cell")];
    const ranked = cells
      .map((cell, originalIndex) => ({
        cell,
        originalIndex,
        value: values[cell.dataset.colormap]?.[definition.key]
      }))
      .filter(item => Number.isFinite(item.value))
      .sort((a, b) => definition.direction * (a.value - b.value) || a.originalIndex - b.originalIndex);

    if (!ranked.length) return;

    const stageRect = elements.stage.getBoundingClientRect();
    const sampleRect = ranked[0].cell.getBoundingClientRect();
    const thumbnailWidth = sampleRect.width * .2;
    const thumbnailHeight = sampleRect.height * .2;
    const thumbnailGap = Math.max(3, Math.min(7, sampleRect.width * .06));
    const rowWidth = thumbnailWidth * ranked.length + thumbnailGap * (ranked.length - 1);
    const rowLeft = (stageRect.width - rowWidth) / 2;
    const targetCenterY = stageRect.height - thumbnailHeight / 2 - 4;

    const tray = document.createElement("div");
    tray.className = "rank-tray";
    tray.setAttribute("aria-hidden", "true");
    tray.style.left = `${rowLeft - 11}px`;
    tray.style.top = `${targetCenterY - thumbnailHeight / 2 - 16}px`;
    tray.style.width = `${rowWidth + 22}px`;
    tray.style.height = `${thumbnailHeight + 20}px`;
    tray.style.setProperty("--rank-columns", String(ranked.length));
    tray.style.setProperty("--rank-slot-width", `${thumbnailWidth}px`);
    tray.style.setProperty("--rank-slot-gap", `${thumbnailGap}px`);
    ranked.forEach((_, rank) => {
      const slot = document.createElement("span");
      slot.className = "rank-slot";
      slot.textContent = String(rank + 1).padStart(2, "0");
      tray.append(slot);
    });
    card.append(tray);
    window.requestAnimationFrame(() => tray.classList.add("is-visible"));

    ranked.forEach((item, rank) => {
      const cellRect = item.cell.getBoundingClientRect();
      const currentCenterX = cellRect.left - stageRect.left + cellRect.width / 2;
      const currentCenterY = cellRect.top - stageRect.top + cellRect.height / 2;
      const targetCenterX = rowLeft + thumbnailWidth / 2 + rank * (thumbnailWidth + thumbnailGap);
      item.cell.style.setProperty("--rank-delay", `${rank * 740}ms`);
      item.cell.style.setProperty("--rank-x", `${targetCenterX - currentCenterX}px`);
      item.cell.style.setProperty("--rank-y", `${targetCenterY - currentCenterY}px`);
      item.cell.style.zIndex = String(100 + rank);
      item.cell.classList.add("is-ranked-sequence");
    });

    const sequenceDuration = 720 + (ranked.length - 1) * 740;
    state.rankAnimationTimer = window.setTimeout(() => {
      tray.classList.add("is-leaving");
      ranked.forEach(item => {
        item.cell.style.transform = window.getComputedStyle(item.cell).transform;
        item.cell.classList.remove("is-ranked-sequence");
        item.cell.classList.add("is-rank-returning");
      });
      void card.offsetWidth;
      ranked.forEach(item => item.cell.style.removeProperty("transform"));
      state.rankReturnTimer = window.setTimeout(() => {
        resetRankAnimation();
        setStatus("");
      }, 620);
    }, sequenceDuration + 2000);
    setStatus(`${definition.label} · ${state.metric}`);
  }

  function buildMetricSelector() {
    elements.metricSelector.replaceChildren();
    const legend = document.createElement("legend");
    legend.textContent = "Color difference";
    elements.metricSelector.append(legend);
    const metricOrder = ["DE76", "DE94", "DE2000", "OKLAB"];
    const metricLabels = { DE76: "ΔE76", DE94: "ΔE94", DE2000: "ΔE2k", OKLAB: "Oklab" };
    const metricsByKey = new Map(state.manifest.metrics.map(metric => [metric.key, metric]));
    metricOrder.forEach(metricKey => {
      const metric = metricsByKey.get(metricKey);
      if (!metric) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "metric-action";
      button.textContent = metricLabels[metric.key];
      button.setAttribute("aria-label", metric.label);
      button.title = metric.label;
      button.addEventListener("click", () => {
        state.metric = metric.key;
        animateRankedFields();
      });
      elements.metricSelector.append(button);
    });
  }

  function buildRankingSelector() {
    elements.rankingSelector.replaceChildren();
    const legend = document.createElement("legend");
    legend.textContent = "Ranking statistic";
    elements.rankingSelector.append(legend);
    ["D", "S", "U"].forEach(ranking => {
      const label = document.createElement("label");
      label.className = "control-option ranking-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "ranking-statistic";
      input.value = ranking;
      input.checked = ranking === state.ranking;
      input.setAttribute("aria-label", rankingDefinitionFor(ranking).label);
      const text = document.createElement("span");
      text.textContent = ranking;
      text.title = rankingDefinitionFor(ranking).label;
      input.addEventListener("click", () => {
        state.ranking = input.value;
        animateRankedFields();
      });
      label.append(input, text);
      elements.rankingSelector.append(label);
    });
  }

  function swatchBackground(colormap) {
    const colors = SWATCH_COLORS[colormap] || ["#777777"];
    if (colors.length === 1) return colors[0];
    const stops = colors.map((color, index) => {
      const start = Math.round(index * 100 / colors.length);
      const end = Math.round((index + 1) * 100 / colors.length);
      return `${color} ${start}%, ${color} ${end}%`;
    });
    return `linear-gradient(135deg, ${stops.join(", ")})`;
  }

  function renderColormapSelection() {
    [...elements.colormapSelector.children].forEach(button => {
      const selected = state.selectedColormaps.has(button.dataset.colormap);
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function toggleColormap(colormap, button) {
    if (state.rotating) return;
    resetRankAnimation();
    if (state.selectedColormaps.has(colormap)) {
      if (state.selectedColormaps.size === 1) {
        button.classList.remove("is-required");
        void button.offsetWidth;
        button.classList.add("is-required");
        return;
      }
      state.selectedColormaps.delete(colormap);
    } else {
      state.selectedColormaps.add(colormap);
    }
    renderColormapSelection();
    renderColorbars();
    renderDepthStack();
  }

  function buildColormapSelector() {
    elements.colormapSelector.replaceChildren();
    state.manifest.colormaps.forEach(colormap => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "colormap-swatch";
      button.dataset.colormap = colormap;
      button.style.setProperty("--swatch", swatchBackground(colormap));
      button.setAttribute("aria-label", `Toggle ${prettyName(colormap)}`);
      button.title = prettyName(colormap);
      button.addEventListener("click", () => toggleColormap(colormap, button));
      elements.colormapSelector.append(button);
    });
    renderColormapSelection();
  }

  function bindElements() {
    elements.shell = requireElement("gallery-shell");
    elements.stage = requireElement("gallery-stage");
    elements.depthTrack = requireElement("depth-track");
    elements.colormapSelector = requireElement("colormap-selector");
    elements.rankingSelector = requireElement("ranking-selector");
    elements.metricSelector = requireElement("metric-selector");
    elements.colorbarGrid = requireElement("colorbar-grid");
    elements.status = requireElement("gallery-status");
  }

  function bindInteractions() {
    elements.stage.addEventListener("click", rotateDataset);
    elements.stage.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      rotateDataset();
    });
    window.addEventListener("resize", syncStageHeight);
  }

  async function loadGallery() {
    try {
      bindElements();
      state.manifest = window.COLORMETRIC_GALLERY || null;
      if (!state.manifest) {
        const response = await fetch(`static/gallery/manifest.json?v=${VERSION}`, { cache: "no-store" });
        if (!response.ok) throw new Error(`manifest request returned HTTP ${response.status}`);
        state.manifest = await response.json();
      }
      if (!Array.isArray(state.manifest.datasets) || !state.manifest.datasets.length) {
        throw new Error("manifest contains no complete datasets");
      }
      state.selectedColormaps = new Set(
        state.manifest.colormaps.filter(colormap => !DEFAULT_HIDDEN_COLORMAPS.has(colormap))
      );
      buildColormapSelector();
      buildRankingSelector();
      buildMetricSelector();
      renderColorbars();
      renderDepthStack();
      setStatus("");
      bindInteractions();
    } catch (error) {
      console.error("Gallery initialization failed", error);
      setStatus(`Gallery data could not be loaded: ${error.message}`);
      elements.shell?.classList.add("has-error");
    }
  }

  const copyButton = document.getElementById("copy-bibtex");
  copyButton?.addEventListener("click", async event => {
    const code = document.getElementById("bibtex-code");
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.textContent);
    } catch (_) {
      const area = document.createElement("textarea");
      area.value = code.textContent;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    event.currentTarget.textContent = "Copied";
    window.setTimeout(() => { event.currentTarget.textContent = "Copy"; }, 1600);
  });

  loadGallery();
})();
