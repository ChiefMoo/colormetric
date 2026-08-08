(() => {
  "use strict";

  const shell = document.getElementById("gallery-shell");
  const panel = document.getElementById("gallery-panel");
  const stage = document.getElementById("gallery-stage");
  const prevButton = document.getElementById("dataset-prev");
  const nextButton = document.getElementById("dataset-next");
  const status = document.getElementById("gallery-status");
  const state = {
    manifest: null,
    index: 0,
    metric: "DE2000",
    rotating: false,
    pointerStartY: null
  };

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
    const grid = document.getElementById("colorbar-grid");
    grid.replaceChildren();
    state.manifest.colormaps.forEach(colormap => {
      const cell = document.createElement("div");
      cell.className = "colorbar-cell";
      cell.append(
        imageElement(`static/gallery/colormaps/${colormap}.png`, `${prettyName(colormap)} colorbar`, true)
      );
      const label = document.createElement("span");
      label.textContent = prettyName(colormap);
      label.title = prettyName(colormap);
      cell.append(label);
      grid.append(cell);
    });
  }

  function renderFields(dataset) {
    const grid = document.getElementById("field-grid");
    grid.replaceChildren();
    state.manifest.colormaps.forEach(colormap => {
      const cell = document.createElement("div");
      cell.className = "field-cell";
      cell.append(imageElement(
        dataset.images[colormap],
        `${dataset.label} rendered with ${prettyName(colormap)}`,
        true
      ));
      grid.append(cell);
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
    const grid = document.getElementById("metric-grid");
    grid.replaceChildren();
    const metricValues = dataset.values[state.metric];
    state.manifest.colormaps.forEach(colormap => {
      const values = metricValues[colormap];
      const cell = document.createElement("div");
      cell.className = "metric-cell";
      cell.append(
        metricLine("Desc.", values.descPower),
        metricLine("Uniform.", values.uniformity),
        metricLine("Smooth.", values.smoothness)
      );
      grid.append(cell);
    });
  }

  function renderBackdrop(elementId, dataset) {
    const backdrop = document.getElementById(elementId);
    backdrop.replaceChildren();
    state.manifest.colormaps.forEach(colormap => {
      backdrop.append(imageElement(dataset.images[colormap], "", true));
    });
  }

  function renderDataset() {
    const datasets = state.manifest.datasets;
    const dataset = datasets[state.index];
    const previous = datasets[wrapIndex(state.index - 1)];
    const next = datasets[wrapIndex(state.index + 1)];

    document.getElementById("dataset-index").textContent = String(state.index + 1).padStart(2, "0");
    document.getElementById("dataset-total").textContent = `/ ${String(datasets.length).padStart(2, "0")}`;
    document.getElementById("dataset-id").textContent = dataset.id;
    document.getElementById("dataset-name").textContent = dataset.label;
    document.getElementById("dataset-shape").textContent = dataset.shape.length === 2
      ? `${dataset.shape[0]} × ${dataset.shape[1]}`
      : "";
    renderFields(dataset);
    renderMetrics(dataset);
    renderBackdrop("gallery-backdrop-prev", previous);
    renderBackdrop("gallery-backdrop-next", next);
    const metricLabel = state.manifest.metrics.find(item => item.key === state.metric)?.label || state.metric;
    status.textContent = `${dataset.label} · ${metricLabel}`;
  }

  function setNavigationDisabled(disabled) {
    prevButton.disabled = disabled;
    nextButton.disabled = disabled;
  }

  function rotateDataset(step) {
    if (state.rotating || !state.manifest?.datasets.length) return;
    state.rotating = true;
    setNavigationDisabled(true);
    const animationClass = step > 0 ? "slide-up" : "slide-down";
    panel.classList.add(animationClass);

    window.setTimeout(() => {
      state.index = wrapIndex(state.index + step);
      renderDataset();
    }, 205);
    window.setTimeout(() => {
      panel.classList.remove(animationClass);
      state.rotating = false;
      setNavigationDisabled(false);
    }, 430);
  }

  function buildMetricSelector() {
    const selector = document.getElementById("metric-selector");
    state.manifest.metrics.forEach(metric => {
      const label = document.createElement("label");
      label.className = "metric-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "color-difference";
      input.value = metric.key;
      input.checked = metric.key === state.metric;
      const text = document.createElement("span");
      text.textContent = metric.label;
      input.addEventListener("change", () => {
        if (!input.checked) return;
        state.metric = input.value;
        renderMetrics(state.manifest.datasets[state.index]);
        status.textContent = `${state.manifest.datasets[state.index].label} · ${metric.label}`;
      });
      label.append(input, text);
      selector.append(label);
    });
  }

  async function loadGallery() {
    if (!shell) return;
    try {
      const response = await fetch("static/gallery/manifest.json");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.manifest = await response.json();
      if (!state.manifest.datasets.length) throw new Error("No complete datasets found");
      renderColorbars();
      buildMetricSelector();
      renderDataset();
      prevButton.addEventListener("click", () => rotateDataset(-1));
      nextButton.addEventListener("click", () => rotateDataset(1));
    } catch (error) {
      status.textContent = `Gallery data could not be loaded: ${error.message}`;
      shell.classList.add("has-error");
    }
  }

  stage?.addEventListener("pointerdown", event => { state.pointerStartY = event.clientY; });
  stage?.addEventListener("pointerup", event => {
    if (state.pointerStartY === null) return;
    const delta = event.clientY - state.pointerStartY;
    state.pointerStartY = null;
    if (Math.abs(delta) > 45) rotateDataset(delta < 0 ? 1 : -1);
  });
  shell?.addEventListener("keydown", event => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === "ArrowUp") rotateDataset(-1);
    if (event.key === "ArrowDown") rotateDataset(1);
  });

  const copyButton = document.getElementById("copy-bibtex");
  copyButton?.addEventListener("click", async event => {
    const text = document.getElementById("bibtex-code").textContent;
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    const button = event.currentTarget;
    button.textContent = "Copied";
    window.setTimeout(() => { button.textContent = "Copy"; }, 1600);
  });

  loadGallery();
})();
