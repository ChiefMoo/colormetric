(() => {
  "use strict";

  const VERSION = "depth-20260808-2";
  const state = {
    manifest: null,
    index: 0,
    metric: "DE2000",
    rotating: false,
    pointerStartY: null
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

  function formatValue(value) {
    if (!Number.isFinite(value)) return "—";
    const magnitude = Math.abs(value);
    if ((magnitude > 0 && magnitude < .01) || magnitude >= 10000) return value.toExponential(2);
    return value.toLocaleString("en-US", { maximumFractionDigits: 3 });
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

  function renderColorbars() {
    elements.colorbarGrid.replaceChildren();
    state.manifest.colormaps.forEach(colormap => {
      const cell = document.createElement("div");
      cell.className = "colorbar-cell";
      cell.dataset.label = prettyName(colormap);
      cell.append(imageElement(
        `static/gallery/colormaps/${colormap}.png?v=${VERSION}`,
        `${prettyName(colormap)} colorbar`,
        true
      ));
      elements.colorbarGrid.append(cell);
    });
  }

  function fieldGrid(dataset, eager) {
    const grid = document.createElement("div");
    grid.className = "eight-grid";
    state.manifest.colormaps.forEach(colormap => {
      const cell = document.createElement("div");
      cell.className = "field-cell";
      cell.append(imageElement(
        `${dataset.images[colormap]}?v=${VERSION}`,
        `${dataset.label} rendered with ${prettyName(colormap)}`,
        eager
      ));
      grid.append(cell);
    });
    return grid;
  }

  function createDepthCard(offset) {
    const datasetIndex = wrapIndex(state.index + offset);
    const dataset = state.manifest.datasets[datasetIndex];
    const depth = Math.abs(offset);
    const card = document.createElement("article");
    card.className = "depth-card";
    card.dataset.offset = String(offset);
    card.dataset.depth = String(depth);
    card.dataset.datasetIndex = String(datasetIndex);
    card.style.setProperty("--offset", String(offset));
    card.style.setProperty("--depth", String(depth));

    const header = document.createElement("header");
    header.className = "depth-card-header";
    const name = document.createElement("span");
    name.textContent = dataset.label;
    const id = document.createElement("span");
    id.textContent = dataset.id;
    header.append(name, id);
    card.append(header, fieldGrid(dataset, depth <= 1));
    return card;
  }

  function renderDepthStack() {
    elements.depthTrack.replaceChildren();
    [-2, -1, 0, 1, 2].forEach(offset => {
      elements.depthTrack.append(createDepthCard(offset));
    });
  }

  function metricLine(label, value) {
    const line = document.createElement("div");
    line.className = "metric-value";
    const name = document.createElement("span");
    name.textContent = label;
    const output = document.createElement("output");
    output.textContent = formatValue(value);
    output.title = String(value);
    line.append(name, output);
    return line;
  }

  function renderMetrics(dataset) {
    elements.metricGrid.replaceChildren();
    const metricValues = dataset.values[state.metric];
    if (!metricValues) throw new Error(`Metric ${state.metric} is missing for ${dataset.id}`);
    state.manifest.colormaps.forEach(colormap => {
      const values = metricValues[colormap];
      if (!values) throw new Error(`${state.metric}/${colormap} is missing for ${dataset.id}`);
      const cell = document.createElement("div");
      cell.className = "metric-cell";
      cell.append(
        metricLine("D", values.descPower),
        metricLine("U", values.uniformity),
        metricLine("S", values.smoothness)
      );
      elements.metricGrid.append(cell);
    });
  }

  function renderDatasetMeta() {
    const dataset = state.manifest.datasets[state.index];
    elements.datasetIndex.textContent = String(state.index + 1).padStart(2, "0");
    elements.datasetTotal.textContent = `·${String(state.manifest.datasets.length).padStart(2, "0")}`;
    elements.datasetId.textContent = dataset.id;
    elements.datasetName.textContent = dataset.label;
    elements.datasetShape.textContent = dataset.shape.length === 2
      ? `${dataset.shape[0]} × ${dataset.shape[1]}`
      : "";
    renderMetrics(dataset);
    const metric = state.manifest.metrics.find(item => item.key === state.metric);
    setStatus(`${dataset.label} · ${metric?.label || state.metric}`);
  }

  function setNavigationDisabled(disabled) {
    elements.prevButton.disabled = disabled;
    elements.nextButton.disabled = disabled;
  }

  function rotateDataset(step) {
    if (state.rotating || !state.manifest?.datasets.length) return;
    state.rotating = true;
    setNavigationDisabled(true);

    const cards = [...elements.depthTrack.querySelectorAll(".depth-card")];
    cards.forEach(card => {
      const newOffset = Number(card.dataset.offset) - step;
      const newDepth = Math.abs(newOffset);
      card.dataset.offset = String(newOffset);
      card.dataset.depth = String(newDepth);
      card.style.setProperty("--offset", String(newOffset));
      card.style.setProperty("--depth", String(newDepth));
    });

    window.setTimeout(() => {
      state.index = wrapIndex(state.index + step);
      renderDatasetMeta();
    }, 250);
    window.setTimeout(() => {
      renderDepthStack();
      state.rotating = false;
      setNavigationDisabled(false);
    }, 540);
  }

  function buildMetricSelector() {
    elements.metricSelector.replaceChildren();
    const legend = document.createElement("legend");
    legend.textContent = "Color difference";
    elements.metricSelector.append(legend);
    state.manifest.metrics.forEach(metric => {
      const label = document.createElement("label");
      label.className = "metric-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "color-difference";
      input.value = metric.key;
      input.checked = metric.key === state.metric;
      input.setAttribute("aria-label", metric.label);
      const text = document.createElement("span");
      text.textContent = ({ DE76: "76", DE2000: "00", DE94: "94", OKLAB: "OK" })[metric.key] || metric.label;
      text.title = metric.label;
      input.addEventListener("change", () => {
        if (!input.checked) return;
        state.metric = input.value;
        renderDatasetMeta();
      });
      label.append(input, text);
      elements.metricSelector.append(label);
    });
  }

  function bindElements() {
    elements.shell = requireElement("gallery-shell");
    elements.stage = requireElement("gallery-stage");
    elements.depthTrack = requireElement("depth-track");
    elements.prevButton = requireElement("dataset-prev");
    elements.nextButton = requireElement("dataset-next");
    elements.datasetIndex = requireElement("dataset-index");
    elements.datasetTotal = requireElement("dataset-total");
    elements.datasetId = requireElement("dataset-id");
    elements.datasetName = requireElement("dataset-name");
    elements.datasetShape = requireElement("dataset-shape");
    elements.metricSelector = requireElement("metric-selector");
    elements.colorbarGrid = requireElement("colorbar-grid");
    elements.metricGrid = requireElement("metric-grid");
    elements.status = requireElement("gallery-status");
  }

  function bindInteractions() {
    elements.prevButton.addEventListener("click", () => rotateDataset(-1));
    elements.nextButton.addEventListener("click", () => rotateDataset(1));
    elements.stage.addEventListener("pointerdown", event => { state.pointerStartY = event.clientY; });
    elements.stage.addEventListener("pointerup", event => {
      if (state.pointerStartY === null) return;
      const delta = event.clientY - state.pointerStartY;
      state.pointerStartY = null;
      if (Math.abs(delta) > 45) rotateDataset(delta < 0 ? 1 : -1);
    });
    elements.shell.addEventListener("keydown", event => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "ArrowUp") rotateDataset(-1);
      if (event.key === "ArrowDown") rotateDataset(1);
    });
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
      renderColorbars();
      buildMetricSelector();
      renderDepthStack();
      renderDatasetMeta();
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
