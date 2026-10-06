"""Deliverable A (joins, features, master tables) on top of src/cleaning.py.

Left table = the complete zone x hour grid (train: 1 Jan-31 Oct, test: the 4,032 test rows).
Weather joins many-to-one on the EAT hour; events join as an interval join on (zone, hour).
Statistics that need fitting (zone types, typical profiles) are learned from train only.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from src import cleaning, config

# --------------------------------------------------------------------------------------
# Feature groups (used by the ablation in D5 and the leakage audit in D4)
# --------------------------------------------------------------------------------------
CALENDAR_FEATURES = ["hour", "dow", "is_weekend", "month", "day_of_month", "is_payday_window",
                     "is_public_holiday", "is_school_break", "trend_days"]
ZONE_FEATURES = ["zone_code", "zone_type_code"]
WEATHER_FEATURES = ["temp_c", "rain_mm", "rain_3h", "rain_class", "humidity_pct", "wind_kmh"]
EVENT_FEATURES = ["ev_football_window", "ev_concert_window", "ev_conference_window",
                  "ev_exhibition_window", "ev_road_closure", "ev_sports_run_window",
                  "ev_pre", "ev_during", "ev_post", "ev_log_attendance",
                  "ev_hours_to_major_start", "ev_hours_since_major_end"]
LAG_FEATURES = ["lag_14d", "lag_21d", "lag_28d", "lag_mean_2to4w", "profile_zone_dow_hour",
                "zone_level_2to4w"]
ALL_FEATURES = CALENDAR_FEATURES + ZONE_FEATURES + WEATHER_FEATURES + EVENT_FEATURES + LAG_FEATURES

# Columns in master_train that exist only in the history (never model inputs, Rule 6).
OPERATIONAL_COLUMNS = ["avg_fare_birr", "avg_wait_min", "active_drivers"]

MAJOR_EVENT_TYPES = ["football_match", "concert"]
VENUE_EVENT_TYPES = ["football_match", "concert", "conference", "exhibition", "sports_run"]
RAIN_BINS = [-np.inf, 0.0, 2.5, 7.5, np.inf]       # none | light | moderate | heavy (mm/h)
RAIN_LABELS = ["none", "light", "moderate", "heavy"]
EVENT_CAP_HOURS = 12

# --------------------------------------------------------------------------------------
# Zone types (B1.2) fitted on train
# --------------------------------------------------------------------------------------
ZONE_TYPE_ORDER = ["business_district", "residential", "transport_hub", "market",
                   "nightlife_airport"]


def fit_zone_types(train_obs: pd.DataFrame) -> pd.Series:
    """Group zones by the shape of their weekday hourly profile + weekend ratio.

    Rules on the train-only profile (each zone's hourly means divided by its daily mean):
      market: peak hour falls 10:00-15:00;
      nightlife_airport: weekend/weekday ratio > 1.2;
      business_district: weekend/weekday ratio < 0.6 (offices empty at the weekend);
      residential: morning peak at or before 07:00 (people leave home early);
      transport_hub: everything else (8:00 and 18:00 commuter peaks, mild weekend drop).
    """
    d = train_obs.assign(h=train_obs["pickup_hour"].dt.hour,
                         we=train_obs["pickup_hour"].dt.dayofweek >= 5)
    wd = d[~d["we"]].pivot_table(index="zone", columns="h", values="trips", aggfunc="mean")
    shape = wd.div(wd.mean(axis=1), axis=0)
    ratio = d.groupby(["zone", "we"])["trips"].mean().unstack()
    ratio = ratio[True] / ratio[False]
    am_peak = shape.loc[:, 5:10].idxmax(axis=1)
    out = {}
    for z in shape.index:
        if 10 <= shape.loc[z].idxmax() <= 15:
            out[z] = "market"
        elif ratio[z] > 1.2:
            out[z] = "nightlife_airport"
        elif ratio[z] < 0.6:
            out[z] = "business_district"
        elif am_peak[z] <= 7:
            out[z] = "residential"
        else:
            out[z] = "transport_hub"
    return pd.Series(out, name="zone_type")


# --------------------------------------------------------------------------------------
# Joins
# --------------------------------------------------------------------------------------
def weather_with_features(weather: pd.DataFrame) -> pd.DataFrame:
    w = weather.sort_values("pickup_hour").copy()
    # Rain in the current and previous 2 hours (rain_mm is "rain in the previous hour").
    w["rain_3h"] = w["rain_mm"].rolling(3, min_periods=1).sum()
    w["rain_class"] = pd.cut(w["rain_mm"], RAIN_BINS, labels=False).astype(int)
    return w


def join_weather(left: pd.DataFrame, weather: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Many-to-one join on pickup_hour (EAT). Returns the joined table and an audit dict."""
    w = weather_with_features(weather)
    cols = ["pickup_hour", "temp_c", "rain_mm", "rain_3h", "rain_class", "humidity_pct",
            "wind_kmh", "data_type", "weather_imputed", "temp_was_fahrenheit"]
    assert not w["pickup_hour"].duplicated().any(), "weather keys must be unique"
    before = len(left)
    out = left.merge(w[cols].rename(columns={"data_type": "weather_data_type"}),
                     on="pickup_hour", how="left", validate="many_to_one")
    audit = {
        "rows_before": before,
        "rows_after": len(out),
        "matched": int(out["temp_c"].notna().sum()),
        "match_rate_pct": round(100 * out["temp_c"].notna().mean(), 2),
        "matched_to_imputed_weather_hour": int(out["weather_imputed"].fillna(False).sum()),
        "unmatched": int(out["temp_c"].isna().sum()),
    }
    return out, audit


def event_hour_table(events: pd.DataFrame) -> pd.DataFrame:
    return cleaning.explode_event_hours(events)


def aggregate_event_features(keys: pd.DataFrame, eh: pd.DataFrame,
                             events: pd.DataFrame) -> pd.DataFrame:
    """Aggregate confirmed event-hours onto (zone, pickup_hour) keys. Cancelled events are
    kept only as an analysis flag (ev_cancelled_window), never as a model feature."""
    k = keys[["zone", "pickup_hour"]].drop_duplicates()
    conf = eh[eh["status"] == "confirmed"]
    venue = conf[conf["event_type"].isin(VENUE_EVENT_TYPES)]

    def flag(df, name):
        s = df.groupby(["zone", "pickup_hour"]).size().rename(name)
        return (s > 0).astype(int)

    parts = [
        flag(conf[conf["event_type"] == "public_holiday"], "is_public_holiday"),
        flag(conf[conf["event_type"] == "school_break"], "is_school_break"),
        flag(conf[conf["event_type"] == "football_match"], "ev_football_window"),
        flag(conf[conf["event_type"] == "concert"], "ev_concert_window"),
        flag(conf[conf["event_type"] == "conference"], "ev_conference_window"),
        flag(conf[conf["event_type"] == "exhibition"], "ev_exhibition_window"),
        flag(conf[conf["event_type"] == "road_closure"], "ev_road_closure"),
        flag(conf[conf["event_type"] == "sports_run"], "ev_sports_run_window"),
        flag(venue[venue["phase"] == "pre"], "ev_pre"),
        flag(venue[venue["phase"] == "during"], "ev_during"),
        flag(venue[venue["phase"] == "post"], "ev_post"),
        np.log1p(venue.groupby(["zone", "pickup_hour"])["attendance"].max())
        .rename("ev_log_attendance"),
        flag(eh[eh["status"] == "cancelled"], "ev_cancelled_window"),
        conf.groupby(["zone", "pickup_hour"])["event_id"]
        .agg(lambda s: ";".join(sorted(set(s)))).rename("ev_ids"),
    ]
    agg = pd.concat(parts, axis=1).reset_index()
    out = k.merge(agg, on=["zone", "pickup_hour"], how="left")
    num = [c for c in agg.columns if c not in ("zone", "pickup_hour", "ev_ids")]
    out[num] = out[num].fillna(0)
    out["ev_ids"] = out["ev_ids"].fillna("")

    # Hours to the next / since the last major (football, concert) confirmed event in the zone.
    major = events[(events["status"] == "confirmed")
                   & events["event_type"].isin(MAJOR_EVENT_TYPES)].explode("zones")
    out["ev_hours_to_major_start"] = float(EVENT_CAP_HOURS)
    out["ev_hours_since_major_end"] = float(EVENT_CAP_HOURS)
    for z, grp in out.groupby("zone"):
        m = major[major["zones"] == z]
        if m.empty:
            continue
        starts = np.sort(m["start"].values.astype("datetime64[h]"))
        ends = np.sort((m["end"] - pd.Timedelta(seconds=1)).dt.floor("h").values
                       .astype("datetime64[h]"))
        t = grp["pickup_hour"].values.astype("datetime64[h]")
        i = np.searchsorted(starts, t, side="left")
        nxt = np.where(i < len(starts), (starts[np.minimum(i, len(starts) - 1)] - t)
                       .astype(float), np.inf)
        j = np.searchsorted(ends, t, side="right") - 1
        prv = np.where(j >= 0, (t - ends[np.maximum(j, 0)]).astype(float), np.inf)
        out.loc[grp.index, "ev_hours_to_major_start"] = np.minimum(nxt, EVENT_CAP_HOURS)
        out.loc[grp.index, "ev_hours_since_major_end"] = np.minimum(prv, EVENT_CAP_HOURS)
    return out


def join_events(left: pd.DataFrame, events: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Interval join: every (zone, hour) gets the events whose window covers it."""
    eh = event_hour_table(events)
    feats = aggregate_event_features(left, eh, events)
    before = len(left)
    out = left.merge(feats, on=["zone", "pickup_hour"], how="left", validate="many_to_one")
    hrs_in_left = eh.merge(left[["zone", "pickup_hour"]].drop_duplicates(),
                           on=["zone", "pickup_hour"])
    matched_ids = set(hrs_in_left["event_id"])
    audit = {
        "rows_before": before,
        "rows_after": len(out),
        "zone_hours_in_any_confirmed_window": int((out["ev_ids"] != "").sum()),
        "events_total": len(events),
        "events_matched_any_zone_hour": len(matched_ids),
        "events_matched_confirmed": len(matched_ids & set(events.loc[events.status ==
                                                                     "confirmed", "event_id"])),
        "events_unmatched": sorted(set(events["event_id"]) - matched_ids),
    }
    return out, audit


# --------------------------------------------------------------------------------------
# Calendar, lag and profile features
# --------------------------------------------------------------------------------------
def add_calendar(df: pd.DataFrame) -> pd.DataFrame:
    t = df["pickup_hour"]
    df["hour"] = t.dt.hour
    df["dow"] = t.dt.dayofweek
    df["is_weekend"] = (df["dow"] >= 5).astype(int)
    df["month"] = t.dt.month
    df["day_of_month"] = t.dt.day
    days_in_month = t.dt.days_in_month
    # Payday window: last 5 days of the month and the first 2 days (B4.3).
    df["is_payday_window"] = ((df["day_of_month"] > days_in_month - 5)
                              | (df["day_of_month"] <= 2)).astype(int)
    df["trend_days"] = (t - pd.Timestamp(config.TRAIN_START)).dt.total_seconds() / 86400
    return df


def add_lags(panel: pd.DataFrame) -> pd.DataFrame:
    """Same-hour lags of 14, 21, 28 days. 14 days is the forecast horizon, so every lag is
    known when forecasting any hour of 1-14 November (the last observed hour is 31 Oct)."""
    p = panel.sort_values(["zone", "pickup_hour"]).copy()
    s = p.set_index(["zone", "pickup_hour"])["trips_for_lags"]
    for d in (14, 21, 28):
        shifted = s.copy()
        shifted.index = pd.MultiIndex.from_arrays(
            [s.index.get_level_values(0), s.index.get_level_values(1) + pd.Timedelta(days=d)])
        p[f"lag_{d}d"] = shifted.reindex(pd.MultiIndex.from_frame(p[["zone", "pickup_hour"]])
                                         ).values
    p["lag_mean_2to4w"] = p[["lag_14d", "lag_21d", "lag_28d"]].mean(axis=1)
    # Zone level: mean of all hours of the zone over days 14-27 before (a trend proxy).
    daily = (p.groupby(["zone", p["pickup_hour"].dt.floor("D")])["trips_for_lags"].mean()
             .rename("daily_mean").reset_index())
    daily["zone_level_2to4w"] = (daily.groupby("zone")["daily_mean"]
                                 .transform(lambda x: x.shift(14).rolling(14, min_periods=7)
                                            .mean()))
    p["_day"] = p["pickup_hour"].dt.floor("D")
    p = p.merge(daily[["zone", "pickup_hour", "zone_level_2to4w"]]
                .rename(columns={"pickup_hour": "_day"}), on=["zone", "_day"], how="left")
    return p.drop(columns="_day")


def fit_profile(train_obs: pd.DataFrame) -> pd.DataFrame:
    """Typical trips per zone x day-of-week x hour, learned from training rows only."""
    t = train_obs.assign(dow=train_obs["pickup_hour"].dt.dayofweek,
                         hour=train_obs["pickup_hour"].dt.hour)
    return (t.groupby(["zone", "dow", "hour"])["trips"].mean()
            .rename("profile_zone_dow_hour").reset_index())


def encode_static(df: pd.DataFrame, zone_types: pd.Series) -> pd.DataFrame:
    df["zone_type"] = df["zone"].map(zone_types)
    df["zone_code"] = df["zone"].map({z: i for i, z in enumerate(config.ZONES)}).astype(int)
    df["zone_type_code"] = df["zone_type"].map(
        {t: i for i, t in enumerate(ZONE_TYPE_ORDER)}).astype(int)
    return df


# --------------------------------------------------------------------------------------
# Orchestration
# --------------------------------------------------------------------------------------
def build_masters(train_grid: pd.DataFrame, test: pd.DataFrame, weather: pd.DataFrame,
                  events: pd.DataFrame) -> dict:
    """Return master_train, master_test, fitted objects and join audits."""
    obs = train_grid[train_grid["row_status"] == "observed"]
    zone_types = fit_zone_types(obs)
    profile = fit_profile(obs)

    tr = train_grid.copy()
    tr["split"] = "train"
    te = test[["row_id", "zone", "pickup_hour", "row_order"]].copy()
    te["split"] = "test"
    te["trips"] = np.nan
    te["row_status"] = "test"

    audits = {}
    out = {}
    for name, left in (("train", tr), ("test", te)):
        j, audits[f"weather_{name}"] = join_weather(left, weather)
        j, audits[f"events_{name}"] = join_events(j, events)
        out[name] = j

    # Lags need one continuous panel per zone (train target feeds test lags).
    lag_src = pd.concat([out["train"], out["test"]], ignore_index=True)
    lag_src["trips_for_lags"] = lag_src["trips"].where(lag_src["row_status"] == "observed")
    lagged = add_lags(lag_src[["zone", "pickup_hour", "split", "trips_for_lags"]])
    lag_cols = ["lag_14d", "lag_21d", "lag_28d", "lag_mean_2to4w", "zone_level_2to4w"]
    for name in ("train", "test"):
        n0 = len(out[name])
        out[name] = out[name].merge(
            lagged.loc[lagged["split"] == name, ["zone", "pickup_hour"] + lag_cols],
            on=["zone", "pickup_hour"], how="left", validate="one_to_one")
        assert len(out[name]) == n0
        out[name] = add_calendar(out[name])
        out[name] = encode_static(out[name], zone_types)
        out[name] = out[name].merge(profile, on=["zone", "dow", "hour"], how="left",
                                    validate="many_to_one")
        assert len(out[name]) == n0

    train_cols = (["zone", "pickup_hour", "row_status", "trips"] + OPERATIONAL_COLUMNS
                  + ["trips_spike_fixed", "zone_type", "weather_data_type", "weather_imputed",
                     "ev_ids", "ev_cancelled_window"] + ALL_FEATURES)
    test_cols = (["row_id", "zone", "pickup_hour", "zone_type", "weather_data_type",
                  "weather_imputed", "ev_ids", "ev_cancelled_window"] + ALL_FEATURES)
    master_train = out["train"].sort_values(["zone", "pickup_hour"])[train_cols]
    master_test = out["test"].sort_values("row_order")[test_cols]
    return {"master_train": master_train.reset_index(drop=True),
            "master_test": master_test.reset_index(drop=True),
            "zone_types": zone_types, "profile": profile, "audits": audits,
            "event_hours": event_hour_table(events)}


# --------------------------------------------------------------------------------------
# Integrity checks (A7)
# --------------------------------------------------------------------------------------
def validate(master_train: pd.DataFrame, master_test: pd.DataFrame, audits: dict,
             raw_test: pd.DataFrame) -> pd.DataFrame:
    checks = []

    def check(name, ok, detail=""):
        checks.append({"check": name, "result": "PASS" if ok else "FAIL", "detail": detail})

    n_hours = len(pd.date_range(config.TRAIN_START, config.TRAIN_END, freq="h"))
    check("train: one row per zone-hour (12 zones x 7,296 hours)",
          len(master_train) == 12 * n_hours
          and not master_train.duplicated(["zone", "pickup_hour"]).any(),
          f"{len(master_train):,} rows")
    check("test: 4,032 rows, row_ids unique and in original order",
          len(master_test) == 4032 and master_test["row_id"].is_unique
          and (master_test["row_id"].values == raw_test["row_id"].values).all(),
          f"{len(master_test):,} rows")
    check("test: no duplicate zone-hour keys",
          not master_test.duplicated(["zone", "pickup_hour"]).any())
    check("only the 12 canonical zone labels",
          set(master_train["zone"]) == set(config.ZONES)
          and set(master_test["zone"]) <= set(config.ZONES))
    check("timestamps on EAT and in expected range",
          master_train["pickup_hour"].between(config.TRAIN_START, config.TRAIN_END).all()
          and master_test["pickup_hour"].between(config.TEST_START, config.TEST_END).all()
          and (master_train["pickup_hour"].dt.minute == 0).all())
    obs = master_train[master_train["row_status"] == "observed"]
    check("no negative or sentinel values left (trips, wait, rain)",
          (obs["trips"] >= 0).all()
          and (master_train["avg_wait_min"].dropna() >= 0).all()
          and (master_train["rain_mm"] >= 0).all() and (master_test["rain_mm"] >= 0).all(),
          f"min trips {obs['trips'].min()}, min rain {master_train['rain_mm'].min()}")
    check("temperature physically plausible (0-35 degC) after unit fix",
          master_train["temp_c"].between(0, 35).all() and master_test["temp_c"].between(0, 35).all(),
          f"range {master_train['temp_c'].min():.1f}-{master_train['temp_c'].max():.1f}")
    check("no inflated trip spikes left (trips/driver <= 4)",
          ((obs["trips"] / obs["active_drivers"]) < cleaning.SPIKE_RATIO).all())
    for k in ("weather_train", "weather_test", "events_train", "events_test"):
        a = audits[k]
        check(f"row count unchanged by {k.replace('_', ' join, ')} split",
              a["rows_before"] == a["rows_after"], f"{a['rows_before']} -> {a['rows_after']}")
    check("every zone-hour matched a weather row",
          master_train["temp_c"].notna().all() and master_test["temp_c"].notna().all())
    check("test weather comes from the forecast rows",
          (master_test["weather_data_type"] == "forecast").all())
    check("train and test have the same feature columns",
          all(c in master_test.columns for c in ALL_FEATURES)
          and all(c in master_train.columns for c in ALL_FEATURES))
    check("no operational (history-only) column among model features",
          not set(OPERATIONAL_COLUMNS) & set(ALL_FEATURES))
    check("lags only reach >= 14 days back (horizon-safe)",
          min(int(c.split("_")[1][:-1]) for c in ["lag_14d", "lag_21d", "lag_28d"]) >= 14)
    check("test lag_14d fully populated from history",
          master_test["lag_14d"].notna().mean() > 0.95,
          f"{master_test['lag_14d'].notna().mean():.1%} non-missing")
    out = pd.DataFrame(checks)
    for r in out.itertuples():
        print(f"[{r.result}] {r.check}" + (f" ({r.detail})" if r.detail else ""))
    return out
