"""Shared analysis helpers for the B report and the C figures."""
from __future__ import annotations

import numpy as np
import pandas as pd

from src import config


# Event flags that mark a zone-hour as "not ordinary" (school breaks are a season, not an event).
EVENT_WINDOW_COLS = ["ev_football_window", "ev_concert_window", "ev_conference_window",
                     "ev_exhibition_window", "ev_road_closure", "ev_sports_run_window"]


def load_master() -> pd.DataFrame:
    m = pd.read_csv(config.PROCESSED / "master_train.csv", parse_dates=["pickup_hour"])
    m["ev_ids"] = m["ev_ids"].fillna("")
    return m


def load_events() -> pd.DataFrame:
    ev = pd.read_csv(config.PROCESSED / "events_clean.csv", parse_dates=["start", "end"])
    ev["zones"] = ev["zones"].str.split(";")
    return ev


def load_weather() -> pd.DataFrame:
    return pd.read_csv(config.PROCESSED / "weather_clean.csv", parse_dates=["pickup_hour"])


def expected_demand(m: pd.DataFrame, exclude_rain: bool = True) -> pd.DataFrame:
    """Add a counterfactual 'normal hour' demand and the ratio trips / expected.

    expected(zone, t) = profile(zone, weekday, hour) x level(zone, week) / mean level(zone),
    both fitted on 'ordinary' observed hours only: no confirmed event window, no public holiday
    and (by default) no rain. The weekly level removes the growth trend, so a ratio of 1.25
    means 25% above a normal hour of the same zone, weekday and hour in the same week.
    """
    o = m[m["row_status"] == "observed"].copy()
    o["week"] = o["pickup_hour"].dt.to_period("W-SUN").dt.start_time
    ordinary = (o[EVENT_WINDOW_COLS].sum(axis=1) == 0) & (o["is_public_holiday"] == 0)
    if exclude_rain:
        ordinary &= o["rain_3h"] == 0
    o["ordinary"] = ordinary
    base = o[ordinary]
    level = base.groupby(["zone", "week"])["trips"].mean().rename("level")
    zmean = base.groupby("zone")["trips"].mean().rename("zmean")
    b = base.join(level, on=["zone", "week"]).join(zmean, on="zone")
    b["norm"] = b["trips"] / (b["level"] / b["zmean"])
    prof = b.groupby(["zone", "dow", "hour"])["norm"].mean().rename("prof")
    o = o.join(level, on=["zone", "week"]).join(zmean, on="zone").join(prof, on=["zone", "dow", "hour"])
    o["expected"] = o["prof"] * o["level"] / o["zmean"]
    o["ratio"] = o["trips"] / o["expected"]
    return o.drop(columns=["level", "zmean", "prof"])


def event_study(o: pd.DataFrame, events: pd.DataFrame, event_type: str, status="confirmed",
                anchor="start", offsets=range(-6, 9)) -> pd.DataFrame:
    """Mean demand ratio at each hour offset from event start (or end), in the event's zones."""
    idx = o.set_index(["zone", "pickup_hour"])["ratio"]
    e = events[(events["event_type"] == event_type) & (events["status"] == status)
               & (events["start"] <= pd.Timestamp(config.TRAIN_END))]
    rows = []
    for r in e.itertuples():
        t0 = (r.start if anchor == "start" else r.end - pd.Timedelta(seconds=1)).floor("h")
        for z in r.zones:
            for k in offsets:
                v = idx.get((z, t0 + pd.Timedelta(hours=k)), np.nan)
                rows.append({"event_id": r.event_id, "zone": z, "offset": k, "ratio": v})
    d = pd.DataFrame(rows)
    out = d.groupby("offset")["ratio"].agg(["mean", "count", "std"])
    out["se"] = out["std"] / np.sqrt(out["count"])
    out.attrs["n_events"] = len(e)
    return out


def bootstrap_ci(x, n=2000, seed=config.RANDOM_STATE):
    x = np.asarray(pd.Series(x).dropna())
    if len(x) < 2:
        return (np.nan, np.nan)
    rng = np.random.default_rng(seed)
    means = rng.choice(x, size=(n, len(x)), replace=True).mean(axis=1)
    return tuple(np.percentile(means, [2.5, 97.5]))
