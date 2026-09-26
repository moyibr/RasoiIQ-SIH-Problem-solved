"""
Train the Andaza demand-forecasting model and save it where the API expects it.

Output: models/andaza_xgb_poisson.json  (repo root)

This script is the reproducible version of `tune.py`, minus the Optuna/Scikit-learn
dependencies. It imports FEATURE_ORDER straight from the serving code
(`backend/app/services/andaza.py`) so the training features and the inference
features can never drift apart.

Feature engineering mirrors preprocess.py / tune.py:
  - drop Capacity_Utilization (target leakage: derived from Customer_Count)
  - lag features per Location_ID: Demand_Yesterday, Demand_7_Days_Ago, Demand_MA7
  - cyclical encodings: Month_sin/cos, DOW_sin/cos
  - one-hot Location_ID into Location_ID_Loc_1 .. Location_ID_Loc_26
  - drop rows that lack enough lag history

Run from the repo root:
    python train_andaza.py
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

REPO_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.services.andaza import FEATURE_ORDER  # noqa: E402

DATASET = REPO_ROOT / "restaurant_demand_28k.csv"
MODEL_DIR = REPO_ROOT / "models"
MODEL_PATH = MODEL_DIR / "andaza_xgb_poisson.json"

TWO_PI = 2.0 * math.pi


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["Date"] = pd.to_datetime(df["Date"])
    df = df.sort_values(["Location_ID", "Date"])

    df = df.drop(columns=["Capacity_Utilization"])

    grouped = df.groupby("Location_ID")["Customer_Count"]
    df["Demand_Yesterday"] = grouped.shift(1)
    df["Demand_7_Days_Ago"] = grouped.shift(7)
    df["Demand_MA7"] = grouped.transform(lambda s: s.shift(1).rolling(7).mean())

    df["Month_sin"] = np.sin(TWO_PI * df["Month"] / 12)
    df["Month_cos"] = np.cos(TWO_PI * df["Month"] / 12)
    df["DOW_sin"] = np.sin(TWO_PI * df["Day_of_Week"] / 7)
    df["DOW_cos"] = np.cos(TWO_PI * df["Day_of_Week"] / 7)

    df = df.dropna(subset=["Demand_Yesterday", "Demand_7_Days_Ago", "Demand_MA7"])
    df = df.drop(columns=["Date"])

    df = pd.get_dummies(df, columns=["Location_ID"], dtype=int)

    missing = [c for c in FEATURE_ORDER if c not in df.columns]
    if missing:
        raise SystemExit(f"Missing expected feature columns: {missing}")

    return df[FEATURE_ORDER].reset_index(drop=True)


def main() -> None:
    if not DATASET.exists():
        raise SystemExit(f"Dataset not found: {DATASET}")

    print(f"Loading {DATASET.name} ...")
    df = pd.read_csv(DATASET)

    print("Engineering features ...")
    features = build_features(df)
    target = pd.to_numeric(df["Customer_Count"], errors="coerce")

    aligned = features.join(target.rename("target")).dropna(subset=["target"])
    X = aligned.drop(columns=["target"])
    y = aligned["target"].astype(float)

    print(f"Rows: {len(X)}  Features: {X.shape[1]}")

    # Chronological split on unique dates (70 / 15 / 15)
    date_key = pd.to_datetime(df.loc[aligned.index, "Date"])
    unique_dates = np.sort(date_key.unique())
    n_dates = len(unique_dates)
    train_end = int(n_dates * 0.70)
    val_end = int(n_dates * 0.85)

    date_values = date_key.values
    train_mask = date_values < unique_dates[train_end]
    val_mask = (date_values >= unique_dates[train_end]) & (date_values < unique_dates[val_end])
    test_mask = date_values >= unique_dates[val_end]

    X_train, y_train = X[train_mask], y[train_mask]
    X_val, y_val = X[val_mask], y[val_mask]
    X_test, y_test = X[test_mask], y[test_mask]

    print(f"Train {len(X_train)} | Val {len(X_val)} | Test {len(X_test)}")
    print("Training XGBoost (objective=count:poisson) ...")

    dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=FEATURE_ORDER)
    dval = xgb.DMatrix(X_val, label=y_val, feature_names=FEATURE_ORDER)
    dtest = xgb.DMatrix(X_test, label=y_test, feature_names=FEATURE_ORDER)

    params = {
        "objective": "count:poisson",
        "eval_metric": "mae",
        "eta": 0.03,
        "max_depth": 6,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "min_child_weight": 5,
        "tree_method": "hist",
        "seed": 42,
        "nthread": -1,
    }

    evals_result: dict = {}
    booster = xgb.train(
        params,
        dtrain,
        num_boost_round=3000,
        evals=[(dtrain, "train"), (dval, "val")],
        early_stopping_rounds=50,
        verbose_eval=100,
        evals_result=evals_result,
    )

    def mae(dmatrix: "xgb.DMatrix") -> float:
        predicted = booster.predict(dmatrix, iteration_range=(0, booster.best_iteration + 1))
        return float(np.mean(np.abs(dmatrix.get_label() - predicted)))

    val_mae = mae(dval)
    test_mae = mae(dtest)
    print(f"\nValidation MAE: {val_mae:.2f}")
    print(f"Test MAE      : {test_mae:.2f}")
    print(f"Best iteration: {booster.best_iteration}")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    booster.save_model(str(MODEL_PATH))
    print(f"\nModel saved to: {MODEL_PATH}")


if __name__ == "__main__":
    main()
