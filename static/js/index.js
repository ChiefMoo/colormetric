(() => {
  "use strict";

  const canvas = document.getElementById("field-canvas");
  const legend = document.getElementById("legend-canvas");
  if (!canvas || !legend) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const legendCtx = legend.getContext("2d", { alpha: false });
  const width = canvas.width;
  const height = canvas.height;
  const field = new Float32Array(width * height);
  const image = ctx.createImageData(width, height);

  const palettes = {
    "uniform-rainbow": [
      [0.00, [28, 34, 238]], [0.16, [0, 157, 255]], [0.34, [0, 220, 192]],
      [0.51, [21, 244, 55]], [0.67, [199, 249, 0]], [0.83, [255, 174, 0]], [1.00, [255, 24, 10]]
    ],
    coolwarm: [
      [0.00, [59, 76, 192]], [0.25, [141, 176, 254]], [0.50, [221, 221, 221]],
      [0.75, [244, 152, 122]], [1.00, [180, 4, 38]]
    ],
    spectral: [
      [0.00, [158, 1, 66]], [0.20, [244, 109, 67]], [0.40, [254, 224, 139]],
      [0.50, [255, 255, 191]], [0.65, [171, 221, 164]], [0.82, [50, 136, 189]], [1.00, [94, 79, 162]]
    ],
    greyscale: [[0.00, [0, 0, 0]], [0.28, [84, 84, 84]], [0.58, [151, 151, 151]], [1.00, [255, 255, 255]]]
  };

  const paletteSelect = document.getElementById("palette-select");
  const valueInput = document.getElementById("paint-value");
  const brushInput = document.getElementById("brush-size");
  const valueOutput = document.getElementById("value-output");
  const brushOutput = document.getElementById("brush-output");
  const cursor = document.getElementById("brush-cursor");
  let drawing = false;
  let framePending = false;
  let seed = Math.random() * 1000;

  function clamp(value, low = 0, high = 1) {
    return Math.max(low, Math.min(high, value));
  }

  function colorAt(value, stops = palettes[paletteSelect.value]) {
    const t = clamp(value);
    let right = 1;
    while (right < stops.length && t > stops[right][0]) right += 1;
    if (right >= stops.length) return stops[stops.length - 1][1];
    const [t0, c0] = stops[right - 1];
    const [t1, c1] = stops[right];
    const u = (t - t0) / Math.max(1e-6, t1 - t0);
    return [
      Math.round(c0[0] + (c1[0] - c0[0]) * u),
      Math.round(c0[1] + (c1[1] - c0[1]) * u),
      Math.round(c0[2] + (c1[2] - c0[2]) * u)
    ];
  }

  function makeField() {
    seed = Math.random() * 1000;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const nx = x / width;
        const ny = y / height;
        const wave = Math.sin(nx * 13 + Math.sin(ny * 8 + seed) * 2.2);
        const fold = Math.cos(ny * 17 - nx * 5 + seed * 0.17);
        const radial = Math.sin(Math.hypot(nx - .68, ny - .42) * 28 - seed);
        field[y * width + x] = clamp(.5 + wave * .19 + fold * .12 + radial * .13);
      }
    }
    render();
  }

  function clearField() {
    field.fill(0);
    render();
  }

  function render() {
    for (let i = 0, p = 0; i < field.length; i += 1, p += 4) {
      const [r, g, b] = colorAt(field[i]);
      image.data[p] = r;
      image.data[p + 1] = g;
      image.data[p + 2] = b;
      image.data[p + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    drawLegend();
  }

  function scheduleRender() {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => {
      render();
      framePending = false;
    });
  }

  function drawLegend() {
    const gradient = legendCtx.createLinearGradient(0, 0, legend.width, 0);
    palettes[paletteSelect.value].forEach(([position, rgb]) => {
      gradient.addColorStop(position, `rgb(${rgb.join(",")})`);
    });
    legendCtx.fillStyle = gradient;
    legendCtx.fillRect(0, 0, legend.width, legend.height);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * width / rect.width,
      y: (event.clientY - rect.top) * height / rect.height,
      cssX: event.clientX - rect.left,
      cssY: event.clientY - rect.top
    };
  }

  function paint(event) {
    const { x, y } = pointerPosition(event);
    const radius = Number(brushInput.value) * width / canvas.getBoundingClientRect().width;
    const value = Number(valueInput.value);
    const x0 = Math.max(0, Math.floor(x - radius));
    const x1 = Math.min(width - 1, Math.ceil(x + radius));
    const y0 = Math.max(0, Math.floor(y - radius));
    const y1 = Math.min(height - 1, Math.ceil(y + radius));

    for (let py = y0; py <= y1; py += 1) {
      for (let px = x0; px <= x1; px += 1) {
        const distance = Math.hypot(px - x, py - y) / radius;
        if (distance <= 1) {
          const weight = Math.pow(1 - distance, .7);
          const index = py * width + px;
          field[index] += (value - field[index]) * weight;
        }
      }
    }
    scheduleRender();
  }

  function moveCursor(event) {
    const { cssX, cssY } = pointerPosition(event);
    cursor.style.display = "block";
    cursor.style.left = `${cssX}px`;
    cursor.style.top = `${cssY}px`;
  }

  canvas.addEventListener("pointerdown", event => {
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    moveCursor(event);
    paint(event);
  });
  canvas.addEventListener("pointermove", event => {
    moveCursor(event);
    if (drawing) paint(event);
  });
  canvas.addEventListener("pointerup", () => { drawing = false; });
  canvas.addEventListener("pointercancel", () => { drawing = false; });
  canvas.addEventListener("pointerleave", () => {
    if (!drawing) cursor.style.display = "none";
  });

  valueInput.addEventListener("input", () => { valueOutput.value = Number(valueInput.value).toFixed(2); });
  brushInput.addEventListener("input", () => {
    brushOutput.value = brushInput.value;
    cursor.style.width = `${brushInput.value}px`;
    cursor.style.height = `${brushInput.value}px`;
  });
  paletteSelect.addEventListener("change", render);
  document.getElementById("seed-button").addEventListener("click", makeField);
  document.getElementById("clear-button").addEventListener("click", clearField);

  document.getElementById("copy-bibtex").addEventListener("click", async event => {
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

  makeField();
})();
