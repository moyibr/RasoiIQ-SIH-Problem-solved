import pandas as pd
import numpy as np
import xgboost as xgb
import optuna

# ==========================================
# LOAD DATA
# ==========================================

df = pd.read_csv("restaurant_demand_28k.csv")

print("Original shape:", df.shape)

# Convert Date
df["Date"] = pd.to_datetime(df["Date"])

# Sort by location and date
df = df.sort_values(["Location_ID", "Date"])


# ==========================================
# REMOVE TARGET LEAKAGE
# ==========================================

df = df.drop(columns=["Capacity_Utilization"])


# ==========================================
# CREATE LAG FEATURES
# ==========================================

df["Demand_Yesterday"] = (
    df.groupby("Location_ID")["Customer_Count"]
      .shift(1)
)

df["Demand_7_Days_Ago"] = (
    df.groupby("Location_ID")["Customer_Count"]
      .shift(7)
)


# ==========================================
# CREATE 7-DAY MOVING AVERAGE
# ==========================================

df["Demand_MA7"] = (
    df.groupby("Location_ID")["Customer_Count"]
      .transform(
          lambda x: x.shift(1).rolling(7).mean()
      )
)


# ==========================================
# CYCLICAL FEATURES
# ==========================================

df["Month_sin"] = np.sin(
    2 * np.pi * df["Month"] / 12
)

df["Month_cos"] = np.cos(
    2 * np.pi * df["Month"] / 12
)

df["DOW_sin"] = np.sin(
    2 * np.pi * df["Day_of_Week"] / 7
)

df["DOW_cos"] = np.cos(
    2 * np.pi * df["Day_of_Week"] / 7
)


# ==========================================
# REMOVE ROWS WITHOUT ENOUGH HISTORY
# ==========================================

df = df.dropna().reset_index(drop=True)

print("After preprocessing:", df.shape)

# ==========================================
# CHRONOLOGICAL TRAIN / VALIDATION / TEST SPLIT
# ==========================================

# Get unique dates in chronological order
dates = np.sort(df["Date"].unique())

n_dates = len(dates)

train_end = int(n_dates * 0.70)
val_end = int(n_dates * 0.85)

train_dates = dates[:train_end]
val_dates = dates[train_end:val_end]
test_dates = dates[val_end:]

# Create date masks
train_mask = df["Date"].isin(train_dates)
val_mask = df["Date"].isin(val_dates)
test_mask = df["Date"].isin(test_dates)

print("\n==========================================")
print("CHRONOLOGICAL SPLIT")
print("==========================================")

print("\nTraining dates:")
print(train_dates[0], "to", train_dates[-1])

print("\nValidation dates:")
print(val_dates[0], "to", val_dates[-1])

print("\nTest dates:")
print(test_dates[0], "to", test_dates[-1])

print("\nRows:")
print("Training:", train_mask.sum())
print("Validation:", val_mask.sum())
print("Test:", test_mask.sum())

# ==========================================
# PREPARE FEATURES FOR XGBOOST
# ==========================================

TARGET = "Customer_Count"

# Remove Date because XGBoost cannot directly use datetime
model_df = df.drop(columns=["Date"]).copy()

# Convert Location_ID into numerical one-hot columns
model_df = pd.get_dummies(
    model_df,
    columns=["Location_ID"],
    dtype=int
)

# Separate input features and target
X = model_df.drop(columns=[TARGET])
y = model_df[TARGET]

# Create train/validation/test sets
X_train = X.loc[train_mask]
X_val = X.loc[val_mask]
X_test = X.loc[test_mask]

y_train = y.loc[train_mask]
y_val = y.loc[val_mask]
y_test = y.loc[test_mask]

print("\n==========================================")
print("FEATURE PREPARATION")
print("==========================================")

print("\nNumber of features:", X.shape[1])

print("\nX shape:", X.shape)
print("y shape:", y.shape)

print("\nTraining:")
print("X_train:", X_train.shape)
print("y_train:", y_train.shape)

print("\nValidation:")
print("X_val:", X_val.shape)
print("y_val:", y_val.shape)

print("\nTest:")
print("X_test:", X_test.shape)
print("y_test:", y_test.shape)

# ==========================================
# STEP 19.6: OPTUNA OBJECTIVE FUNCTION
# ==========================================

def objective(trial):

    # Optuna chooses these values
    params = {
        "objective": "count:poisson",
        "eval_metric": "mae",

        "learning_rate": trial.suggest_float(
            "learning_rate",
            0.01,
            0.05
        ),

        "max_depth": trial.suggest_int(
            "max_depth",
            4,
            8
        ),

        "subsample": trial.suggest_float(
            "subsample",
            0.6,
            0.9
        ),

        "colsample_bytree": trial.suggest_float(
            "colsample_bytree",
            0.6,
            0.9
        ),

        "min_child_weight": trial.suggest_int(
            "min_child_weight",
            1,
            10
        ),

        "tree_method": "hist",
        "random_state": 42,
        "n_jobs": -1
    }

    # Create XGBoost model
    model = xgb.XGBRegressor(
        n_estimators=5000,
        early_stopping_rounds=50,
        **params
    )

    # Train on training data
    model.fit(
        X_train,
        y_train,

        eval_set=[
            (X_val, y_val)
        ],

        verbose=False
    )

    # Predict validation data
    val_pred = model.predict(X_val)

    # Calculate validation MAE
    mae = np.mean(
        np.abs(y_val.values - val_pred)
    )

    return mae
    # ==========================================
# TEST OPTUNA WITH 1 TRIAL
# ==========================================

print("\n==========================================")
print("TESTING OPTUNA")
print("==========================================")

study = optuna.create_study(
    direction="minimize"
)

study.optimize(
    objective,
    n_trials=50
)

print("\nOptuna test completed.")

print("Best MAE:", study.best_value)

print("Best parameters:")
print(study.best_params)

# ==========================================
# STEP 20: TRAIN TUNED MODEL
# ==========================================

from sklearn.metrics import mean_absolute_error, root_mean_squared_error

print("\n==========================================")
print("TRAINING TUNED MODEL")
print("==========================================")

best_params = study.best_params

tuned_model = xgb.XGBRegressor(
    objective="count:poisson",
    eval_metric="mae",

    n_estimators=5000,

    early_stopping_rounds=50,

    tree_method="hist",
    random_state=42,
    n_jobs=-1,

    **best_params
)

print("\nStarting tuned model training...")

tuned_model.fit(
    X_train,
    y_train,

    eval_set=[
        (X_val, y_val)
    ],

    verbose=100
)

print("\nTuned model training finished.")
print("Best iteration:", tuned_model.best_iteration)


# ==========================================
# EVALUATE TUNED MODEL
# ==========================================

val_pred_tuned = tuned_model.predict(X_val)
test_pred_tuned = tuned_model.predict(X_test)

val_mae_tuned = mean_absolute_error(
    y_val,
    val_pred_tuned
)

val_rmse_tuned = root_mean_squared_error(
    y_val,
    val_pred_tuned
)

test_mae_tuned = mean_absolute_error(
    y_test,
    test_pred_tuned
)

test_rmse_tuned = root_mean_squared_error(
    y_test,
    test_pred_tuned
)

print("\n==========================================")
print("TUNED MODEL PERFORMANCE")
print("==========================================")

print("\nValidation:")
print(f"MAE  : {val_mae_tuned:.2f}")
print(f"RMSE : {val_rmse_tuned:.2f}")

print("\nTest:")
print(f"MAE  : {test_mae_tuned:.2f}")
print(f"RMSE : {test_rmse_tuned:.2f}")

# ==========================================
# STEP 21: SAVE TUNED MODEL
# ==========================================

import os

os.makedirs("models", exist_ok=True)

model_path = "models/andaza_xgb_poisson.json"

tuned_model.save_model(model_path)

print("\n==========================================")
print("MODEL SAVED")
print("==========================================")

print("Saved to:", model_path)