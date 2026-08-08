# ColorMetric project page

Static academic project page for ColorMetric, adapted from the Academic Project Page Template.

## Page modules

- Video overview
- Abstract
- Interactive dataset gallery with four selectable color-difference metrics
- Copyable BibTeX citation

## Preview locally

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Before publication

Replace the placeholder author names, affiliation, venue, abstract, video, and BibTeX entry in `index.html` with the final paper metadata.

## Refresh gallery data

After adding new `../data_x` folders or updating the colormap CSV files, rebuild the publishable gallery assets with:

```bash
python build_gallery_assets.py
```

The builder copies one metric-independent visualization set per dataset and writes `static/gallery/manifest.json` with all metric values.
