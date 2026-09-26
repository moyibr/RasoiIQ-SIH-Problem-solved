import pandas as pd
import numpy as np
import xgboost as xgb
import shap
import matplotlib.pyplot as plt

# ==========================================
# LOAD DATA
# ==========================================

df = pd.read_csv("restaurant_demand_28k.csv")

df["Date"] = pd.to_datetime(df["Date"])

df = df.sort_values(["Location_ID", "Date"])


# ==========================================
# SAME PREPROCESSING AS TRAINING
# ==========================================

# Remove leakage
df = df.drop(columns=["Capacity_Utilization"])


# Lag features
df["Demand_Yesterday"] = (
    df.groupby("Location_ID")["Customer_Count"]
      .shift(1)
)

df["Demand_7_Days_Ago"] = (
    df.groupby("Location_ID")["Customer_Count"]
      .shift(7)
)


# 7-day moving average
df["Demand_MA7"] = (
    df.groupby("Location_ID")["Customer_Count"]
      .transform(
          lambda x: x.shift(1).rolling(7).mean()
      )
)


# Cyclical features
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


# Remove rows without lag history
df = df.dropna().reset_index(drop=True)


# ==========================================
# CREATE MODEL FEATURES
# ==========================================

model_df = df.drop(columns=["Date"]).copy()

model_df = pd.get_dummies(
    model_df,
    columns=["Location_ID"],
    dtype=int
)

TARGET = "Customer_Count"

X = model_df.drop(columns=[TARGET])
y = model_df[TARGET]


# ==========================================
# CREATE SAME TEST SET
# ==========================================

dates = np.sort(df["Date"].unique())

n_dates = len(dates)

train_end = int(n_dates * 0.70)
val_end = int(n_dates * 0.85)

test_dates = dates[val_end:]

test_mask = df["Date"].isin(test_dates)

X_test = X.loc[test_mask]
y_test = y.loc[test_mask]


# ==========================================
# LOAD TRAINED ANDAZA MODEL
# ==========================================

model = xgb.XGBRegressor()

model.load_model(
    "models/Andaza_xgb_poisson.json"
)

print("Model loaded successfully.")
print("Test samples:", len(X_test))


# ==========================================
# CREATE SHAP EXPLAINER
# ==========================================

explainer = shap.TreeExplainer(model)

shap_values = explainer(X_test)

print("SHAP values calculated.")

# ==========================================
# STEP 22.4: SHAP SUMMARY PLOT
# ==========================================

print("\nGenerating SHAP summary plot...")

shap.summary_plot(
    shap_values,
    X_test,
    show=False
)

plt.title("Andaza - SHAP Feature Importance")
plt.tight_layout()

plt.savefig(
    "models/shap_summary.png",
    dpi=300,
    bbox_inches="tight"
)

plt.show()

print("SHAP summary plot saved to:")
print("models/shap_summary.png")

# ==========================================
# STEP 23: SHAP TEMPERATURE DEPENDENCE
# ==========================================

print("\nGenerating temperature dependence plot...")

shap.dependence_plot(
    "Temp_Celsius",
    shap_values.values,
    X_test,
    show=False
)

plt.title("Andaza - Temperature Impact on Demand")
plt.tight_layout()

plt.savefig(
    "models/shap_temperature_dependence.png",
    dpi=300,
    bbox_inches="tight"
)

plt.show()

print("Temperature dependence plot saved.")

# ==========================================
# STEP 24: SHAP WATERFALL PLOT
# ==========================================

print("\nGenerating SHAP waterfall plot...")

# Find the highest-demand observation in the test set
high_demand_idx = y_test.idxmax()

# Get that row
high_demand_row = X_test.loc[[high_demand_idx]]

# Calculate SHAP values for this row
high_demand_shap = explainer(high_demand_row)

# Show the actual and predicted values
actual_value = y_test.loc[high_demand_idx]
predicted_value = model.predict(high_demand_row)[0]

print("\nHigh-demand example:")
print("Actual customers:", actual_value)
print("Predicted customers:", round(predicted_value, 2))

# Create waterfall plot
shap.plots.waterfall(
    high_demand_shap[0],
    max_display=12,
    show=False
)

plt.tight_layout()

plt.savefig(
    "models/shap_waterfall_high_demand.png",
    dpi=300,
    bbox_inches="tight"
)

plt.show()

print("\nWaterfall plot saved to:")
print("models/shap_waterfall_high_demand.png")