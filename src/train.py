"""Deliverable D: fold-safe feature refits, baselines, candidate models and evaluation helpers."""
from __future__ import annotations

import time

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from src import config, features

TARGET = "trips"
CATEGORICAL = ["zone_code", "zone_type_code", "hour", "dow"]

FEATURE_SETS = {
    "calendar+zone+trend": features.CALENDAR_FEATURES + features.ZONE_FEATURES + features.LAG_FEATURES,
    "+weather": features.CALENDAR_FEATURES + features.ZONE_FEATURES + features.LAG_FEATURES
                + features.WEATHER_FEATURES,
    "+events": features.CALENDAR_FEATURES + features.ZONE_FEATURES + features.LAG_FEATURES
               + features.EVENT_FEATURES,
    "+both": features.BASE_FEATURES,
}
# Calendar-from-events columns (holiday, school break) are calendar knowledge; the ablation's
# "events" block is the venue-event features. Both are always known in advance.


def load_master_train() -> pd.DataFrame:
    m = pd.read_csv(config.PROCESSED / "master_train.csv", parse_dates=["pickup_hour"])
    return m


def load_master_test() -> pd.DataFrame:
    return pd.read_csv(config.PROCESSED / "master_test.csv", parse_dates=["pickup_hour"])


def trainable(m: pd.DataFrame) -> pd.DataFrame:
    return m[m["row_status"] == "observed"].copy()


def refit_fold(train: pd.DataFrame, other: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Re-learn the fitted features (zone types, zone x weekday x hour profile) on the training
    part only, then apply them to both parts (Rule 8: nothing is fitted on validation/test)."""
    zt = features.fit_zone_types(train)
    prof = features.fit_profile(train)
    out = []
    for d in (train, other):
        d = d.drop(columns=["profile_zone_dow_hour", "zone_type", "zone_type_code"], errors="ignore")
        d = features.encode_static(d, zt)
        d = d.merge(prof, on=["zone", "dow", "hour"], how="left")
        out.append(d)
    return out[0], out[1]


def split(m: pd.DataFrame, cut: str, days: int = 14):
    """Chronological split: train on everything before `cut`, validate on the next `days` days."""
    cut = pd.Timestamp(cut)
    obs = trainable(m)
    tr = obs[obs["pickup_hour"] < cut]
    va = obs[(obs["pickup_hour"] >= cut) & (obs["pickup_hour"] < cut + pd.Timedelta(days=days))]
    return refit_fold(tr, va)


def rmse(y, p):
    return float(np.sqrt(np.mean((np.asarray(y) - np.asarray(p)) ** 2)))


def mae(y, p):
    return float(np.mean(np.abs(np.asarray(y) - np.asarray(p))))


# --------------------------------------------------------------------------------------
# Baselines
# --------------------------------------------------------------------------------------
def mean_baseline(tr, va):
    return np.full(len(va), tr[TARGET].mean())


def seasonal_naive(tr, va, recent_weeks: int | None = None):
    """Average trips for the same zone, weekday and hour in the training period (or its most
    recent `recent_weeks` weeks)."""
    t = tr
    if recent_weeks:
        t = tr[tr["pickup_hour"] >= tr["pickup_hour"].max() - pd.Timedelta(weeks=recent_weeks)]
    prof = t.groupby(["zone", "dow", "hour"])[TARGET].mean().rename("p")
    p = va.join(prof, on=["zone", "dow", "hour"])["p"]
    return p.fillna(tr[TARGET].mean()).values


# --------------------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------------------
LGB_PARAMS = dict(objective="poisson", n_estimators=900, learning_rate=0.03, num_leaves=63,
                  min_child_samples=20, subsample=0.8, subsample_freq=1, colsample_bytree=0.8,
                  reg_lambda=1.0, random_state=config.RANDOM_STATE, verbose=-1, n_jobs=-1)


class LogTarget:
    """Fit on log1p(trips), predict back on the trips scale (demand is multiplicative)."""

    def __init__(self, model):
        self.model = model

    def fit(self, X, y):
        self.model.fit(X, np.log1p(y))
        return self

    def predict(self, X):
        return np.clip(np.expm1(self.model.predict(X)), 0, None)


def make_model(name: str, feats: list[str], params: dict | None = None):
    num = [f for f in feats if f not in CATEGORICAL]
    cat = [f for f in feats if f in CATEGORICAL]
    if name == "ridge":
        pre = ColumnTransformer([
            ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), num),
            ("cat", OneHotEncoder(handle_unknown="ignore"), cat),
        ])
        return LogTarget(make_pipeline(pre, Ridge(alpha=1.0)))
    if name == "random_forest":
        return LogTarget(make_pipeline(SimpleImputer(strategy="median"),
                                       RandomForestRegressor(n_estimators=300, min_samples_leaf=3,
                                                             max_features=0.5, n_jobs=-1,
                                                             random_state=config.RANDOM_STATE)))
    if name == "hist_gb":
        return LogTarget(HistGradientBoostingRegressor(max_iter=600, learning_rate=0.05,
                                                       max_leaf_nodes=63,
                                                       random_state=config.RANDOM_STATE))
    if name == "lightgbm":
        # Poisson objective on raw counts: demand is a count with variance growing with its mean.
        return lgb.LGBMRegressor(**{**LGB_PARAMS, **(params or {})})
    raise ValueError(name)


def fit_predict(name, tr, va, feats, params=None):
    model = make_model(name, feats, params)
    t0 = time.perf_counter()
    model.fit(tr[feats], tr[TARGET].values)
    secs = time.perf_counter() - t0
    return model, np.clip(model.predict(va[feats]), 0, None), secs


def rolling_origin(m, cuts, predict_fn):
    """predict_fn(tr, va) -> predictions. Returns one row per fold."""
    rows = []
    for c in cuts:
        tr, va = split(m, c)
        p = predict_fn(tr, va)
        rows.append({"cut": pd.Timestamp(c).date(), "valid_to": (pd.Timestamp(c) + pd.Timedelta(days=13)).date(),
                     "n_train": len(tr), "n_valid": len(va), "rmse": rmse(va[TARGET], p),
                     "mae": mae(va[TARGET], p), "mean_trips": va[TARGET].mean()})
    return pd.DataFrame(rows)
