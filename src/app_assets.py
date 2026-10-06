"""Build the lookup tables the Streamlit demo ships with (app/assets/).

Everything the app shows is produced here from the cleaned tables and the saved model, so the app itself
does no cleaning, no joining and no fitting — it only looks things up and calls the model.

Run from the repo root:  python -m src.app_assets
"""
from __future__ import annotations

import shutil

import pandas as pd

from src import config
from src import train as T
from src.predict import LEVELS, calibrate, load_bundle

KEEP_EVENT_COLS = ["event_id", "event_name", "event_type", "venue", "zones", "start", "end", "attendance", "status"]


def main():
    config.APP_ASSETS.mkdir(parents=True, exist_ok=True)
    bundle = load_bundle()

    # 1. The 14-day feature table the model scores (one row per zone-hour, already joined in notebook 01).
    test = T.load_master_test()
    test.to_csv(config.APP_ASSETS / "master_test.csv", index=False)

    # 2. Weather over the forecast fortnight, for the "what we looked up" line.
    w = pd.read_csv(config.PROCESSED / "weather_clean.csv", parse_dates=["pickup_hour"])
    w = w[(w.pickup_hour >= config.TEST_START) & (w.pickup_hour <= config.TEST_END)]
    w.to_csv(config.APP_ASSETS / "weather_forecast.csv", index=False)

    # 3. Confirmed events that overlap the fortnight.
    e = pd.read_csv(config.PROCESSED / "events_clean.csv", parse_dates=["start", "end"])
    e = e[(e.status == "confirmed") & (e.end >= config.TEST_START) & (e.start <= config.TEST_END)]
    e[KEEP_EVENT_COLS].to_csv(config.APP_ASSETS / "events.csv", index=False)

    # 4. Per-zone reference numbers: average fare (gross-fare estimate) and the typical weekday/weekend
    #    hourly profile from the last 8 weeks of history (the grey "usual" curve in the app).
    obs = T.trainable(T.load_master_train())
    recent = obs[obs.pickup_hour > obs.pickup_hour.max() - pd.Timedelta(weeks=8)]
    profile = (recent.assign(is_weekend=recent.is_weekend.astype(int))
               .groupby(["zone", "is_weekend", "hour"])["trips"].mean().round(2).reset_index()
               .rename(columns={"trips": "typical_trips"}))
    profile.to_csv(config.APP_ASSETS / "typical_profile.csv", index=False)
    pd.Series(bundle["zone_avg_fare"], name="avg_fare_birr").rename_axis("zone").round(1).to_csv(
        config.APP_ASSETS / "zone_avg_fare.csv")

    # 5. The interval widths (stretch goal), so the app can show a range as well as a number.
    _, q, _ = calibrate(T.load_master_train(), bundle["features"], bundle["params"])
    pd.DataFrame([{"level": lvl, "q_low": lo, "q_high": hi} for lvl, (lo, hi) in q.items()]).to_csv(
        config.APP_ASSETS / "interval_quantiles.csv", index=False)

    # 6. The model itself.
    shutil.copy(config.MODELS / "final_model.joblib", config.APP_ASSETS / "final_model.joblib")

    for f in sorted(config.APP_ASSETS.iterdir()):
        print(f"{f.relative_to(config.ROOT)}  {f.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
