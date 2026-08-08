# Data-Aware Colormap Assessment project page

Static project page for “Beyond the Good, the Bad, and the Ugly: Colormap Assessment through Data-Aware Perceptual Metric,” accepted at IEEE VIS 2026.

## Page modules

- Paper teaser
- Abstract
- Video overview
- Interactive dataset gallery with four selectable color-difference metrics
- Copyable BibTeX citation

## Preview locally

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Publication status

Accepted at IEEE VIS 2026. The arXiv submission is pending; DOI, volume, issue, and page metadata should be added when assigned by IEEE.

## Refresh gallery data

After adding new `../data_x` folders or updating the colormap CSV files, rebuild the publishable gallery assets with:

```bash
python build_gallery_assets.py
```

The builder copies one metric-independent visualization set per dataset and writes `static/gallery/manifest.json` with all metric values.
