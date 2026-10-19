
from pathlib import Path
import json
import urllib.request
import urllib.error

import joblib
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]
CSV_FILE = PROJECT_ROOT / "data" / "processed" / "flows.csv"
METADATA_FILE = PROJECT_ROOT / "backend" / "models" / "model_metadata.joblib"
API_URL = "http://127.0.0.1:8000/api/predict"


def json_safe(value):
    """Convert pandas/numpy values into JSON-compatible values."""
    if pd.isna(value):
        return None

    if hasattr(value, "item"):
        value = value.item()

    return value


def main():
    if not CSV_FILE.exists():
        raise FileNotFoundError(f"CSV not found: {CSV_FILE}")

    metadata = joblib.load(METADATA_FILE)
    feature_columns = metadata["feature_columns"]

    df = pd.read_csv(CSV_FILE, low_memory=False)

    if df.empty:
        raise ValueError("The processed CSV has no rows.")

    # Select a row and send only the trained feature columns.
    sample = df.iloc[0]
    payload = {
        col: json_safe(sample[col])
        for col in feature_columns
    }

    request_data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        API_URL,
        data=request_data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
            print("API prediction response:")
            print(json.dumps(result, indent=2))
    except urllib.error.HTTPError as exc:
        print(f"HTTP error: {exc.code}")
        print(exc.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        print(f"Could not connect to API: {exc}")


if __name__ == "__main__":
    main()