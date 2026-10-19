from pathlib import Path
import joblib
import pandas as pd
import json

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
)

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BASE_DIR / "data" / "processed" / "flows.csv"

BASELINE_MODEL_PATH = (
    BASE_DIR / "backups" / "random_forest_scenario42.joblib"
)
EXPANDED_MODEL_PATH = (
    BASE_DIR / "backend" / "models" / "random_forest_expanded.joblib"
)
EXPANDED_METADATA_PATH = (
    BASE_DIR / "backend" / "models" / "model_metadata_expanded.joblib"
)
JSON_OUTPUT_PATH = BASE_DIR / "backend" / "ml" / "model_comparison_results.json"
CSV_OUTPUT_PATH = BASE_DIR / "backend" / "ml" / "model_comparison_results.csv"


def load_data():
    df = pd.read_csv(DATA_PATH)

    metadata = joblib.load(EXPANDED_METADATA_PATH)
    test_captures = metadata["test_captures"]

    df = df[df["capture"].isin(test_captures)].copy()
    df = df[df["target_id"].isin([0, 1])].copy()

    return df, metadata



def evaluate_model(name, model, X_test, y_test):
    predictions = model.predict(X_test)

    report = classification_report(
        y_test,
        predictions,
        labels=[0, 1],
        target_names=["normal", "botnet"],
        output_dict=True,
        zero_division=0,
    )

    matrix = confusion_matrix(y_test, predictions, labels=[0, 1])

    results = {
        "model": name,
        "accuracy": float(accuracy_score(y_test, predictions)),
        "precision_botnet": float(
            precision_score(y_test, predictions, pos_label=1, zero_division=0)
        ),
        "recall_botnet": float(
            recall_score(y_test, predictions, pos_label=1, zero_division=0)
        ),
        "f1_botnet": float(
            f1_score(y_test, predictions, pos_label=1, zero_division=0)
        ),
        "confusion_matrix": matrix.tolist(),
        "classification_report": report,
    }

    print(f"\n{'=' * 60}")
    print(name)
    print("=" * 60)
    print(f"Accuracy:  {results['accuracy']:.6f}")
    print(f"Botnet precision: {results['precision_botnet']:.6f}")
    print(f"Botnet recall:    {results['recall_botnet']:.6f}")
    print(f"Botnet F1-score:  {results['f1_botnet']:.6f}")
    print("Confusion matrix:")
    print(matrix)
    print("\nClassification report:")
    print(
        classification_report(
            y_test,
            predictions,
            labels=[0, 1],
            target_names=["normal", "botnet"],
            zero_division=0,
            digits=6,
        )
    )

    return results



def save_results(results, metadata, test_rows):
    output = {
        "evaluation_type": metadata["split_type"],
        "training_rows": metadata["training_rows"],
        "test_rows": int(test_rows),
        "train_captures": metadata["train_captures"],
        "test_captures": metadata["test_captures"],
        "models": results,
    }

    with open(JSON_OUTPUT_PATH, "w", encoding="utf-8") as file:
        json.dump(output, file, indent=2)

    rows = []

    for result in results:
        rows.append({
            "model": result["model"],
            "accuracy": result["accuracy"],
            "precision_botnet": result["precision_botnet"],
            "recall_botnet": result["recall_botnet"],
            "f1_botnet": result["f1_botnet"],
            "normal_correct": result["confusion_matrix"][0][0],
            "normal_predicted_botnet": result["confusion_matrix"][0][1],
            "botnet_predicted_normal": result["confusion_matrix"][1][0],
            "botnet_correct": result["confusion_matrix"][1][1],
        })

    pd.DataFrame(rows).to_csv(CSV_OUTPUT_PATH, index=False)

    print("\nComparison results saved:")
    print(JSON_OUTPUT_PATH)
    print(CSV_OUTPUT_PATH)


def main():
    df, metadata = load_data()

    features = metadata["feature_columns"]
    X_test = df[features]
    y_test = df["target_id"]

    baseline = joblib.load(BASELINE_MODEL_PATH)
    expanded = joblib.load(EXPANDED_MODEL_PATH)

    print(f"Test rows: {len(df)}")
    print(f"Test captures: {metadata['test_captures']}")
    print(f"Features: {features}")

    baseline_results = evaluate_model(
        "Baseline Random Forest", baseline, X_test, y_test
    )

    expanded_results = evaluate_model(
        "Expanded Random Forest", expanded, X_test, y_test
    )

    save_results(
        [baseline_results, expanded_results],
        metadata,
        len(df),
    )


if __name__ == "__main__":
    main()