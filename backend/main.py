from pathlib import Path
from io import BytesIO

import joblib
import pandas as pd

from fastapi import FastAPI, File, HTTPException, UploadFile, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware

import sqlite3
from datetime import datetime, timezone, timedelta

from contextlib import asynccontextmanager
import os

import jwt
from pwdlib import PasswordHash
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
)
import requests


def init_database():
    DATABASE_FILE.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(DATABASE_FILE) as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS prediction_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                created_at TEXT NOT NULL,
                total_flows INTEGER NOT NULL,
                normal_count INTEGER NOT NULL,
                botnet_count INTEGER NOT NULL,
                model_name TEXT NOT NULL,
                user_id INTEGER REFERENCES users(id)
            )
        """)

        # Safely update databases created before user ownership existed.
        columns = connection.execute(
            "PRAGMA table_info(prediction_history)"
        ).fetchall()

        column_names = [column[1] for column in columns]

        if "user_id" not in column_names:
            connection.execute("""
                ALTER TABLE prediction_history
                ADD COLUMN user_id INTEGER REFERENCES users(id)
            """)

        connection.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_database()
    yield


app = FastAPI(
    title="Sentinel Botnet Detection API",
    description=(
        "Backend API for the CTU-13 Random Forest "
        "network-flow botnet detection application."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "SENTINEL_CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = PROJECT_ROOT / "backend" / "models"
DATA_FILE = PROJECT_ROOT / "data" / "processed" / "flows.csv"
DATABASE_FILE = PROJECT_ROOT / "data" / "sentinel.db"
JWT_SECRET_KEY = os.getenv("SENTINEL_JWT_SECRET")

# Load the expanded model, leaving the baseline model untouched.
MODEL_FILE = MODEL_DIR / "random_forest_expanded.joblib"
METADATA_FILE = MODEL_DIR / "model_metadata_expanded.joblib"

MAX_UPLOAD_SIZE = 100 * 1024 * 1024

model = None
metadata = None

password_hashing = PasswordHash.recommended()
ACCESS_TOKEN_EXPIRE_MINUTES = 60
security = HTTPBearer()

def ensure_processed_dataset():
    """Download the processed dataset if it is missing."""
    if DATA_FILE.exists():
        return

    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        raise RuntimeError(
            "Processed dataset is missing and HF_TOKEN is not configured."
        )

    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

    dataset_url = (
        "https://huggingface.co/datasets/"
        "VamsiAkshaySanka/sentinel-processed-flows/resolve/main/flows.csv"
    )

    response = requests.get(
        dataset_url,
        headers={"Authorization": f"Bearer {hf_token}"},
        stream=True,
        timeout=(20, 300),
    )
    response.raise_for_status()

    temp_file = DATA_FILE.with_suffix(".csv.download")
    try:
        with open(temp_file, "wb") as output:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    output.write(chunk)

        temp_file.replace(DATA_FILE)
    finally:
        response.close()
        if temp_file.exists():
            temp_file.unlink()


if MODEL_FILE.exists() and METADATA_FILE.exists():
    model = joblib.load(MODEL_FILE)
    metadata = joblib.load(METADATA_FILE)


from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

@app.post("/api/auth/register", status_code=201)
async def register_user(request: RegisterRequest):
    email = str(request.email).strip().lower()

    password_hash = password_hashing.hash(request.password)

    created_at = datetime.now(timezone.utc).isoformat()

    try:
        with sqlite3.connect(DATABASE_FILE) as connection:
            cursor = connection.execute(
                """
                INSERT INTO users (email, password_hash, created_at)
                VALUES (?, ?, ?)
                """,
                (email, password_hash, created_at),
            )
            user_id = cursor.lastrowid
            connection.commit()

    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    return {
        "message": "Account created successfully.",
        "user_id": user_id,
        "email": email,
    }


def create_access_token(user_id: int) -> str:
    if not JWT_SECRET_KEY:
        raise HTTPException(
            status_code=500,
            detail="Authentication is not configured.",
        )

    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    return jwt.encode(
        {
            "sub": str(user_id),
            "exp": expires_at,
        },
        JWT_SECRET_KEY,
        algorithm="HS256",
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    if not JWT_SECRET_KEY:
        raise HTTPException(
            status_code=500,
            detail="Authentication is not configured.",
        )

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=["HS256"],
        )
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired login token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    with sqlite3.connect(DATABASE_FILE) as connection:
        connection.row_factory = sqlite3.Row
        user = connection.execute(
            "SELECT id, email FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User account not found.",
        )

    return {"id": user["id"], "email": user["email"]}


@app.post("/api/auth/login")
async def login_user(request: LoginRequest):
    email = str(request.email).strip().lower()

    with sqlite3.connect(DATABASE_FILE) as connection:
        connection.row_factory = sqlite3.Row
        user = connection.execute(
            """
            SELECT id, email, password_hash
            FROM users
            WHERE email = ?
            """,
            (email,),
        ).fetchone()

    if user is None or not password_hashing.verify(
        request.password,
        user["password_hash"] if user else password_hashing.hash(
            "dummy-password-for-timing"
        ),
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password.",
        )

    token = create_access_token(user["id"])

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user": {
            "id": user["id"],
            "email": user["email"],
        },
    }

@app.get("/")
def root():
    return {
        "message": "Sentinel Botnet Detection API is running",
        "status": "online",
        "version": "1.0.0",
    }


@app.get("/api/health")
def health_check():
    loaded = model is not None and metadata is not None
    return {
        "status": "healthy",
        "service": "sentinel-backend",
        "model_loaded": loaded,
        "message": (
            "Backend and expanded model are ready."
            if loaded
            else "Backend is running, but the expanded model is not loaded."
        ),
    }


@app.get("/api/model/status")
def model_status():
    if model is None or metadata is None:
        return {
            "loaded": False,
            "message": (
                "Expanded model files were not found. "
                "Run the expanded training script first."
            ),
        }

    return {
        "loaded": True,
        "model_type": "Random Forest",
        "model_version": "expanded",
        "feature_count": len(metadata["feature_columns"]),
        "split_type": metadata.get("split_type"),
        "training_rows": metadata.get("training_rows"),
        "test_rows": metadata.get("test_rows"),
        "train_captures": metadata.get("train_captures", []),
        "test_captures": metadata.get("test_captures", []),
        "message": "Expanded Random Forest loaded successfully.",
    }


@app.get("/api/model/features")
def model_features():
    if model is None or metadata is None:
        raise HTTPException(
            status_code=503,
            detail="The expanded model is not loaded.",
        )

    numeric = set(metadata["numeric_features"])

    return {
        "features": [
            {
                "name": name,
                "type": "number" if name in numeric else "text",
            }
            for name in metadata["feature_columns"]
        ]
    }


def prepare_features(frame):
    """Apply the same feature selection and type handling used in training."""
    feature_columns = metadata["feature_columns"]

    missing = [col for col in feature_columns if col not in frame.columns]
    if missing:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Required model features are missing.",
                "missing_fields": missing,
            },
        )

    frame = frame[feature_columns].copy()

    for col in metadata["numeric_features"]:
        frame[col] = pd.to_numeric(frame[col], errors="coerce")

    for col in metadata["categorical_features"]:
        frame[col] = frame[col].fillna("Unknown").astype(str)

    return frame


@app.post("/api/predict")
def predict_flow(flow: dict):
    if model is None or metadata is None:
        raise HTTPException(
            status_code=503,
            detail="The expanded model is not loaded.",
        )

    frame = prepare_features(pd.DataFrame([flow]))

    try:
        prediction = int(model.predict(frame)[0])
        probabilities = model.predict_proba(frame)[0]
        classes = model.named_steps["classifier"].classes_
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not process this flow: {exc}",
        ) from exc

    class_name = "botnet" if prediction == 1 else "normal"

    return {
        "prediction": class_name,
        "class_id": prediction,
        "model": "Random Forest (expanded)",
        "probabilities": {
            ("botnet" if int(label) == 1 else "normal"): round(
                float(probability), 6
            )
            for label, probability in zip(classes, probabilities)
        },
    }


@app.post("/api/predict/batch", dependencies=[Depends(security)])
async def predict_batch(file: UploadFile = File(...), current_user: dict = Depends(get_current_user), ):
    if model is None or metadata is None:
        raise HTTPException(
            status_code=503,
            detail="The expanded model is not loaded.",
        )

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file.",
        )

    contents = await file.read(MAX_UPLOAD_SIZE + 1)

    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File is too large. Maximum upload size is 100 MB.",
        )

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    try:
        original_frame = pd.read_csv(BytesIO(contents))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read CSV: {exc}",
        ) from exc

    if original_frame.empty:
        raise HTTPException(
            status_code=400,
            detail="The CSV contains no flow records.",
        )

    frame = prepare_features(original_frame)

    try:
        predictions = model.predict(frame)
        probabilities = model.predict_proba(frame)
        classes = list(model.named_steps["classifier"].classes_)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not classify CSV records: {exc}",
        ) from exc

    results = []
    counts = {"normal": 0, "botnet": 0}

    for index, prediction in enumerate(predictions):
        class_id = int(prediction)
        class_name = "botnet" if class_id == 1 else "normal"
        counts[class_name] += 1

        original_row = original_frame.iloc[index]
        flow_data = original_row.where(
            pd.notna(original_row), None
        ).to_dict()

        results.append({
            "row": index + 1,
            "prediction": class_name,
            "class_id": class_id,
            "flow": flow_data,
            "probabilities": {
                ("botnet" if int(label) == 1 else "normal"): round(
                    float(probability), 6
                )
                for label, probability in zip(
                    classes, probabilities[index]
                )
            },
        })

    
    model_name = "Random Forest (expanded)"

    created_at = datetime.now(timezone.utc).isoformat()

    with sqlite3.connect(DATABASE_FILE) as connection:
        connection.execute(
            """
            INSERT INTO prediction_history (
                filename,
                created_at,
                total_flows,
                normal_count,
                botnet_count,
                model_name,
                user_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                file.filename,
                created_at,
                len(results),
                counts["normal"],
                counts["botnet"],
                model_name,
                current_user["id"],
            ),
        )
        connection.commit()


    return {
        "filename": file.filename,
        "total_flows": len(results),
        "counts": counts,
        "model": model_name,
        "results": results,
    }


@app.get("/api/prediction-history")

@app.get("/api/prediction-history")
async def get_prediction_history(
    current_user: dict = Depends(get_current_user),
):
    with sqlite3.connect(DATABASE_FILE) as connection:
        connection.row_factory = sqlite3.Row

        rows = connection.execute(
            """
            SELECT
                id,
                filename,
                created_at,
                total_flows,
                normal_count,
                botnet_count,
                model_name
            FROM prediction_history
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 100
            """,
            (current_user["id"],),
        ).fetchall()

    return {
        "total_records": len(rows),
        "history": [dict(row) for row in rows],
    }


@app.get("/api/model/evaluation")
def model_evaluation():
    """Evaluate the model on the exact capture-level test set from training."""
    if model is None or metadata is None:
        raise HTTPException(
            status_code=503,
            detail="The expanded model is not loaded.",
        )

    if not DATA_FILE.exists():
        try:
            ensure_processed_dataset()
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Could not download the processed dataset: {exc}",
            ) from exc

    try:
        target = metadata["target_column"]
        capture_column = "capture"
        test_captures = metadata.get("test_captures", [])

        if not test_captures:
            raise ValueError("Test captures are missing from model metadata.")

        test_capture_set = {str(capture) for capture in test_captures}
        test_frames = []

        for chunk in pd.read_csv(DATA_FILE, low_memory=False, chunksize=10000):
            if target not in chunk.columns or capture_column not in chunk.columns:
                raise ValueError(
                    "Processed dataset must contain target_id and capture columns."
                )

            chunk = chunk[chunk[target].isin([0, 1])]
            chunk = chunk.dropna(subset=[capture_column]).copy()
            chunk[target] = chunk[target].astype(int)
            chunk[capture_column] = chunk[capture_column].astype(str)

            selected = chunk[chunk[capture_column].isin(test_capture_set)]

            if not selected.empty:
                test_frames.append(selected)

        if not test_frames:
            raise ValueError("No rows found for the saved test captures.")

        test_df = pd.concat(test_frames, ignore_index=True)

        X_test = prepare_features(test_df)
        y_test = test_df[target]
        predictions = model.predict(X_test)

        matrix = confusion_matrix(
            y_test, predictions, labels=[0, 1]
        )

        report = classification_report(
            y_test,
            predictions,
            labels=[0, 1],
            target_names=["normal", "botnet"],
            output_dict=True,
            zero_division=0,
        )

        return {
            "evaluation_type": metadata.get("split_type"),
            "training_rows": metadata.get("training_rows"),
            "test_rows": int(len(y_test)),
            "train_captures": metadata.get("train_captures", []),
            "test_captures": test_captures,
            "accuracy": round(
                float(accuracy_score(y_test, predictions)), 6
            ),
            "precision_botnet": round(
                float(precision_score(
                    y_test, predictions, pos_label=1, zero_division=0
                )), 6
            ),
            "recall_botnet": round(
                float(recall_score(
                    y_test, predictions, pos_label=1, zero_division=0
                )), 6
            ),
            "f1_botnet": round(
                float(f1_score(
                    y_test, predictions, pos_label=1, zero_division=0
                )), 6
            ),
            "confusion_matrix": matrix.tolist(),
            "classification_report": {
                label: {
                    metric: round(float(value), 6)
                    for metric, value in values.items()
                }
                for label, values in report.items()
                if isinstance(values, dict)
            },
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Evaluation failed: {exc}",
        ) from exc


@app.get("/api/model/feature-importance")
def get_feature_importance():
    if model is None or metadata is None:
        raise HTTPException(
            status_code=503,
            detail="The expanded model is not loaded.",
        )

    try:
        preprocessing = model.named_steps["preprocessing"]
        classifier = model.named_steps["classifier"]

        feature_names = preprocessing.get_feature_names_out()
        importances = classifier.feature_importances_

        if len(feature_names) != len(importances):
            raise HTTPException(
                status_code=500,
                detail="Feature names and importance values do not match.",
            )

        results = [
            {
                "feature": str(feature_name),
                "importance": float(importance),
            }
            for feature_name, importance in zip(
                feature_names, importances
            )
        ]

        results.sort(
            key=lambda item: item["importance"],
            reverse=True,
        )

        for rank, item in enumerate(results, start=1):
            item["rank"] = rank

        return {
            "model": "Random Forest (expanded)",
            "importance_type": "mean decrease in impurity",
            "total_features": len(results),
            "features": results,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not calculate feature importance: {exc}",
        ) from exc