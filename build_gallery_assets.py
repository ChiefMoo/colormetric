"""Build the static gallery assets and manifest from ../data_x and ../*.csv."""

from __future__ import annotations

import csv
import json
import re
import shutil
from pathlib import Path


REPO_DIR = Path(__file__).resolve().parent
PAGE_DIR = REPO_DIR.parent
OUTPUT_DIR = REPO_DIR / "static" / "gallery"
COLORMAPS = [
    "greyscale",
    "singlehue",
    "cubehelix",
    "bodyheat",
    "coolwarm",
    "spectral",
    "rainbow",
    "blueyellow",
]
METRICS = [
    {"key": "DE76", "label": "ΔE76"},
    {"key": "DE2000", "label": "ΔE2000"},
    {"key": "DE94", "label": "ΔE94"},
    {"key": "OKLAB", "label": "OKLab"},
]


def data_number(data_id: str) -> int:
    match = re.fullmatch(r"data_(\d+)", data_id)
    return int(match.group(1)) if match else 10**9


def dataset_label(metadata: dict) -> str:
    field_func = str(metadata.get("field_func", "scalar field"))
    params = metadata.get("field_params", {}) or {}
    if field_func == "make_data_file" and params.get("addr"):
        return Path(str(params["addr"])).stem
    label = re.sub(r"^make_", "", field_func)
    label = re.sub(r"_example$", "", label)
    return label.replace("_", " ").title()


def read_metric_rows() -> dict:
    rows: dict[str, dict[str, dict[str, dict]]] = {}
    for colormap in COLORMAPS:
        csv_path = PAGE_DIR / f"{colormap}.csv"
        with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
            for row in csv.DictReader(handle):
                data_id = row["data_id"]
                metric = row["metric_type"]
                rows.setdefault(data_id, {}).setdefault(metric, {})[colormap] = row
    return rows


def main() -> None:
    metric_rows = read_metric_rows()
    if OUTPUT_DIR.exists():
        shutil.rmtree(OUTPUT_DIR)
    (OUTPUT_DIR / "colormaps").mkdir(parents=True)

    for colormap in COLORMAPS:
        shutil.copy2(
            PAGE_DIR / "colormaps" / f"{colormap}_colorbar.png",
            OUTPUT_DIR / "colormaps" / f"{colormap}.png",
        )

    datasets = []
    for data_id in sorted(metric_rows, key=data_number):
        metadata_path = PAGE_DIR / data_id / "metadata.json"
        if not metadata_path.exists():
            continue
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        dataset_dir = OUTPUT_DIR / data_id
        dataset_dir.mkdir(parents=True)

        image_paths = {}
        values = {metric["key"]: {} for metric in METRICS}
        complete = True
        for colormap in COLORMAPS:
            source_row = metric_rows[data_id].get("DE2000", {}).get(colormap)
            if not source_row:
                complete = False
                break
            source_image = PAGE_DIR / source_row["visualization_png"]
            if not source_image.exists():
                complete = False
                break
            output_image = dataset_dir / f"{colormap}.png"
            shutil.copy2(source_image, output_image)
            image_paths[colormap] = f"static/gallery/{data_id}/{colormap}.png"

            for metric in METRICS:
                row = metric_rows[data_id].get(metric["key"], {}).get(colormap)
                if not row:
                    complete = False
                    break
                values[metric["key"]][colormap] = {
                    "descPower": float(row["data_aware_descpower"]),
                    "uniformity": float(row["data_aware_uniformity"]),
                    "smoothness": float(row["data_aware_smoothness"]),
                }
        if not complete:
            shutil.rmtree(dataset_dir, ignore_errors=True)
            continue

        datasets.append({
            "id": data_id,
            "label": dataset_label(metadata),
            "fieldFunc": metadata.get("field_func", ""),
            "fieldParams": metadata.get("field_params", {}),
            "shape": metadata.get("shape", []),
            "images": image_paths,
            "values": values,
        })

    manifest = {
        "colormaps": COLORMAPS,
        "metrics": METRICS,
        "datasets": datasets,
    }
    (OUTPUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Built {len(datasets)} datasets in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
