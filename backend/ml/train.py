
from pathlib import Path

import joblib
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_FILE = PROJECT_ROOT / "data" / "processed" / "flows.csv"
MODEL_DIR = PROJECT_ROOT / "backend" / "models"

# Save separately so the original baseline remains untouched.
MODEL_FILE = MODEL_DIR / "random_forest_expanded.joblib"
METADATA_FILE = MODEL_DIR / "model_metadata_expanded.joblib"

TARGET_COLUMN = "target_id"
CAPTURE_COLUMN = "capture"

PREFERRED_NUMERIC = [
    "Dur", "Sport", "Dport", "sTos", "dTos",
    "TotPkts", "TotBytes", "SrcBytes",
]

PREFERRED_CATEGORICAL = ["Proto", "Dir", "State"]


def main():
    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Processed dataset not found: {DATA_FILE}"
        )

    df = pd.read_csv(DATA_FILE, low_memory=False)

    required_columns = [TARGET_COLUMN, CAPTURE_COLUMN]
    missing = [col for col in required_columns if col not in df.columns]
    if missing:
        raise ValueError(
            f"Missing required columns: {missing}. "
            f"Found columns: {list(df.columns)}"
        )

    numeric_features = [
        col for col in PREFERRED_NUMERIC if col in df.columns
    ]
    categorical_features = [
        col for col in PREFERRED_CATEGORICAL if col in df.columns
    ]
    feature_columns = numeric_features + categorical_features

    if not feature_columns:
        raise ValueError("None of the expected feature columns were found.")

    # Keep only valid binary targets and usable capture IDs.
    df = df[df[TARGET_COLUMN].isin([0, 1])].copy()
    df = df.dropna(subset=[CAPTURE_COLUMN])
    df[TARGET_COLUMN] = df[TARGET_COLUMN].astype(int)
    df[CAPTURE_COLUMN] = df[CAPTURE_COLUMN].astype(str)

    if df[TARGET_COLUMN].nunique() != 2:
        raise ValueError(
            "Training requires both classes (0=normal, 1=botnet)."
        )

    captures = sorted(df[CAPTURE_COLUMN].unique())
    if len(captures) < 2:
        raise ValueError(
            "Capture-level splitting requires at least two captures."
        )

    # Hold out complete captures, rather than randomly selected rows.
    # Try deterministic group splits until both classes appear in each set.
    splitter = GroupShuffleSplit(
        n_splits=100,
        test_size=0.2,
        random_state=42,
    )

    split = None
    for train_idx, test_idx in splitter.split(
        df, df[TARGET_COLUMN], groups=df[CAPTURE_COLUMN]
    ):
        train_labels = set(df.iloc[train_idx][TARGET_COLUMN].unique())
        test_labels = set(df.iloc[test_idx][TARGET_COLUMN].unique())

        if train_labels == {0, 1} and test_labels == {0, 1}:
            split = (train_idx, test_idx)
            break

    if split is None:
        capture_summary = (
            df.groupby(CAPTURE_COLUMN)[TARGET_COLUMN]
            .agg(["count", "nunique"])
            .to_string()
        )
        raise ValueError(
            "Could not find a group split with both classes in train "
            "and test after 100 attempts. Review class coverage per capture:\n"
            + capture_summary
        )

    train_idx, test_idx = split
    train_df = df.iloc[train_idx].copy()
    test_df = df.iloc[test_idx].copy()

    X_train = train_df[feature_columns].copy()
    y_train = train_df[TARGET_COLUMN].copy()
    X_test = test_df[feature_columns].copy()
    y_test = test_df[TARGET_COLUMN].copy()

    for col in numeric_features:
        X_train[col] = pd.to_numeric(X_train[col], errors="coerce")
        X_test[col] = pd.to_numeric(X_test[col], errors="coerce")

    for col in categorical_features:
        X_train[col] = X_train[col].fillna("Unknown").astype(str)
        X_test[col] = X_test[col].fillna("Unknown").astype(str)

    transformers = []

    if numeric_features:
        numeric_pipeline = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
        ])
        transformers.append(
            ("numeric", numeric_pipeline, numeric_features)
        )

    if categorical_features:
        categorical_pipeline = Pipeline([
            ("imputer", SimpleImputer(
                strategy="constant",
                fill_value="Unknown",
            )),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ])
        transformers.append(
            ("categorical", categorical_pipeline, categorical_features)
        )

    preprocessing = ColumnTransformer(transformers=transformers)

    model = Pipeline([
        ("preprocessing", preprocessing),
        ("classifier", RandomForestClassifier(
            n_estimators=200,
            random_state=42,
            class_weight="balanced",
            n_jobs=-1,
        )),
    ])

    train_captures = sorted(train_df[CAPTURE_COLUMN].unique())
    test_captures = sorted(test_df[CAPTURE_COLUMN].unique())

    print(f"Dataset: {DATA_FILE}")
    print(f"Rows used: {len(df):,}")
    print(f"Capture files represented: {len(captures)}")
    print(f"Features: {feature_columns}")
    print(f"Training rows: {len(X_train):,}")
    print(f"Test rows: {len(X_test):,}")
    print(f"Training captures: {train_captures}")
    print(f"Test captures: {test_captures}")

    print("\nFull dataset class counts:")
    print(
        df[TARGET_COLUMN].value_counts().sort_index().rename(
            index={0: "normal (0)", 1: "botnet (1)"}
        ).to_string()
    )

    print("\nTraining class counts:")
    print(y_train.value_counts().sort_index().to_string())

    print("\nTest class counts:")
    print(y_test.value_counts().sort_index().to_string())

    print("\nTraining Random Forest...")
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)

    print("\nEvaluation on held-out captures")
    print(f"Accuracy: {accuracy_score(y_test, predictions):.4f}")

    print("\nClassification report:")
    print(classification_report(
        y_test,
        predictions,
        labels=[0, 1],
        target_names=["normal", "botnet"],
        zero_division=0,
    ))

    print("Confusion matrix (rows=actual, columns=predicted)")
    print("Class order: normal (0), botnet (1)")
    print(confusion_matrix(y_test, predictions, labels=[0, 1]))

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_FILE)

    metadata = {
        "feature_columns": feature_columns,
        "numeric_features": numeric_features,
        "categorical_features": categorical_features,
        "target_column": TARGET_COLUMN,
        "class_names": {"0": "normal", "1": "botnet"},
        "training_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "split_type": "GroupShuffleSplit by capture",
        "train_captures": train_captures,
        "test_captures": test_captures,
        "random_state": 42,
    }
    joblib.dump(metadata, METADATA_FILE)

    print(f"\nSaved expanded model: {MODEL_FILE}")
    print(f"Saved expanded metadata: {METADATA_FILE}")
    print("\nThe original baseline model files were not modified.")


if __name__ == "__main__":
    main()