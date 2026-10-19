
from pathlib import Path
import pandas as pd

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"
OUTPUT_FILE = PROCESSED_DIR / "flows.csv"

# Initial model features.
# We will use only columns that are present in the input data.
NUMERIC_FEATURES = [
    "Dur",
    "Sport",
    "Dport",
    "sTos",
    "dTos",
    "TotPkts",
    "TotBytes",
    "SrcBytes",
]

CATEGORICAL_FEATURES = [
    "Proto",
    "Dir",
    "State",
]

LABEL_COLUMN = "Label"


def normalize_label(value):
    """Map CTU-13 labels to botnet, normal, or other."""
    label = str(value).strip().lower()

    if "botnet" in label:
        return "botnet"

    if "normal" in label:
        return "normal"

    return "other"


def load_flow_file(file_path):
    """Read one comma-separated CTU-13 NetFlow file."""
    print(f"Reading: {file_path.name}")

    df = pd.read_csv(
        file_path,
        sep=",",
        low_memory=False,
        on_bad_lines="warn",
    )

    # Remove accidental spaces from column names.
    df.columns = [str(col).strip() for col in df.columns]

    if LABEL_COLUMN not in df.columns:
        raise ValueError(
            f"Required column '{LABEL_COLUMN}' was not found "
            f"in {file_path.name}. Columns: {list(df.columns)}"
        )

    # Keep only features available in this file.
    available_features = [
        col for col in NUMERIC_FEATURES + CATEGORICAL_FEATURES
        if col in df.columns
    ]

    if not available_features:
        raise ValueError(
            f"No expected feature columns found in {file_path.name}"
        )

    result = df[available_features + [LABEL_COLUMN]].copy()

    # Record the source capture for capture-level splitting later.
    result["capture"] = file_path.stem

    result["target"] = result[LABEL_COLUMN].apply(normalize_label)

    # This first classifier is binary: botnet vs normal.
    # Other/background traffic is deliberately excluded.
    result = result[result["target"].isin(["botnet", "normal"])].copy()

    # Convert numeric fields safely; invalid values become missing.
    for col in NUMERIC_FEATURES:
        if col in result.columns:
            result[col] = pd.to_numeric(result[col], errors="coerce")

    # Normalize categorical values and represent missing values.
    for col in CATEGORICAL_FEATURES:
        if col in result.columns:
            result[col] = (
                result[col]
                .fillna("Unknown")
                .astype(str)
                .str.strip()
            )

    # Keep a simple numeric label for model training.
    result["target_id"] = result["target"].map({
        "normal": 0,
        "botnet": 1,
    })

    return result


def main():
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    files = sorted(RAW_DIR.rglob("*.binetflow"))

    if not files:
        raise FileNotFoundError(
            f"No .binetflow files found in {RAW_DIR} or its subfolders. "
            "Copy your CTU-13 scenario files into data/raw first."
        )

    frames = []

    for file_path in files:
        frames.append(load_flow_file(file_path))

    combined = pd.concat(frames, ignore_index=True)

    if combined.empty:
        raise ValueError(
            "No botnet or normal records remained after filtering. "
            "Check the labels in your input files."
        )

    combined.to_csv(OUTPUT_FILE, index=False)

    print("\nPreprocessing complete.")
    print(f"Output file: {OUTPUT_FILE}")
    print(f"Rows retained: {len(combined):,}")
    print("\nClass counts:")
    print(combined["target"].value_counts().to_string())
    print("\nColumns:")
    print(", ".join(combined.columns))


if __name__ == "__main__":
    main()