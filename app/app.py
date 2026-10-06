"""Deliverable E — Addis ride-demand forecast demo.

Pick a zone and a date in 1–14 November 2025. Everything else (weather, events, the zone's average fare)
is looked up from the tables bundled in app/assets/, which were built by `python -m src.app_assets` from
the cleaned data and the final model. The app does no cleaning, joining or fitting.

Run from the repo root:  streamlit run app/app.py
"""
from __future__ import annotations

from pathlib import Path

import altair as alt
import joblib
import numpy as np
import pandas as pd
import streamlit as st

ASSETS = Path(__file__).parent / "assets"
FIRST_DAY, LAST_DAY = pd.Timestamp("2025-11-01"), pd.Timestamp("2025-11-14")
TRIPS_PER_DRIVER_HOUR = 1.3
INK, FORECAST, TYPICAL, EVENT = "#1b1b1b", "#eb6834", "#9a9a9a", "#2a78d6"
EVENT_LABELS = {"football_match": "Football match", "concert": "Concert", "conference": "Conference",
                "exhibition": "Exhibition", "road_closure": "Road closure", "sports_run": "Road race",
                "public_holiday": "Public holiday", "school_break": "School break"}

st.set_page_config(page_title="Addis ride demand forecast", page_icon="🚗", layout="wide")


@st.cache_resource
def load_model():
    return joblib.load(ASSETS / "final_model.joblib")


@st.cache_data
def load_assets():
    test = pd.read_csv(ASSETS / "master_test.csv", parse_dates=["pickup_hour"])
    weather = pd.read_csv(ASSETS / "weather_forecast.csv", parse_dates=["pickup_hour"])
    events = pd.read_csv(ASSETS / "events.csv", parse_dates=["start", "end"])
    profile = pd.read_csv(ASSETS / "typical_profile.csv")
    fares = pd.read_csv(ASSETS / "zone_avg_fare.csv").set_index("zone")["avg_fare_birr"]
    quant = pd.read_csv(ASSETS / "interval_quantiles.csv").set_index("level")
    return test, weather, events, profile, fares, quant


def zone_events(events: pd.DataFrame, zone: str, day: pd.Timestamp) -> pd.DataFrame:
    """Events that touch this zone (or the whole city) on this day."""
    day_end = day + pd.Timedelta(hours=23, minutes=59)
    in_zone = events.zones.fillna("").str.split(";").apply(lambda zs: zone in zs or "Citywide" in zs)
    return events[in_zone & (events.end >= day) & (events.start <= day_end)].sort_values("start")


def forecast_day(bundle, test, zone, day):
    rows = test[(test.zone == zone) & (test.pickup_hour.dt.date == day.date())].sort_values("pickup_hour")
    pred = np.clip(bundle["model"].predict(rows[bundle["features"]]), 0, None)
    return rows.assign(forecast=pred)


def lookup_line(weather, evs, zone, day):
    w = weather[weather.pickup_hour.dt.date == day.date()]
    bits = []
    if not w.empty:
        rain = w.rain_mm.sum()
        wettest = w.loc[w.rain_mm.idxmax()]
        bits.append(f"{w.temp_c.min():.0f}–{w.temp_c.max():.0f} °C")
        bits.append(f"no rain forecast" if rain < 0.1 else
                    f"{rain:.1f} mm rain, heaviest {wettest.rain_mm:.1f} mm at {wettest.pickup_hour:%H:%M}")
    for _, e in evs.iterrows():
        label = EVENT_LABELS.get(e.event_type, e.event_type.replace("_", " "))
        where = f" at {e.venue}" if isinstance(e.venue, str) and e.venue not in ("(none)", "") else ""
        bits.append(f"{label}{where} {e.start:%H:%M}–{e.end:%H:%M}")
    return f"**Looked up for {zone}, {day:%A %d %B %Y}:** " + "; ".join(bits) + "."


def chart(day_df, typical, evs, day):
    base = day_df.rename(columns={"pickup_hour": "time"})
    band = alt.Chart(base).mark_area(opacity=0.18, color=FORECAST).encode(
        x=alt.X("time:T", title="hour (EAT)", axis=alt.Axis(format="%H:%M", tickCount=12)),
        y=alt.Y("lower_80:Q", title="trips per hour"), y2="upper_80:Q")
    line = alt.Chart(base).mark_line(color=FORECAST, strokeWidth=3, point=alt.OverlayMarkDef(size=45)).encode(
        x="time:T", y="forecast:Q",
        tooltip=[alt.Tooltip("time:T", title="hour", format="%H:%M"),
                 alt.Tooltip("forecast:Q", title="forecast", format=".0f"),
                 alt.Tooltip("lower_80:Q", title="80% low", format=".0f"),
                 alt.Tooltip("upper_80:Q", title="80% high", format=".0f"),
                 alt.Tooltip("typical:Q", title="usual", format=".0f")])
    usual = alt.Chart(base).mark_line(color=TYPICAL, strokeDash=[6, 4], strokeWidth=2).encode(
        x="time:T", y="typical:Q")
    layers = []
    if not evs.empty:
        windows = pd.DataFrame({
            "start": evs.start.clip(lower=day), "end": evs.end.clip(upper=day + pd.Timedelta(hours=23)),
            "label": [EVENT_LABELS.get(t, t) for t in evs.event_type]})
        layers.append(alt.Chart(windows).mark_rect(opacity=0.14, color=EVENT).encode(
            x="start:T", x2="end:T", tooltip=["label:N"]))
    return alt.layer(*layers, band, usual, line).properties(height=330).configure_view(strokeWidth=0)


# ----------------------------------------------------------------------------------------------------
test, weather, events, profile, fares, quant = load_assets()
bundle = load_model()

st.title("Addis Ababa ride demand — 24-hour forecast")
st.caption(f"Team {bundle['team']} · LightGBM trained on {bundle['trained_on']} · validation RMSE "
           f"{bundle['validation']['main_split_rmse']:.2f} trips per zone-hour")

# A ?zone=Bole&date=2025-11-05 link opens the app on that zone and day (handy for sharing a demo link);
# the two controls below are still the only inputs.
zones = sorted(test.zone.unique())
qs = st.query_params
start_zone = qs.get("zone") if qs.get("zone") in zones else zones[0]
try:
    start_day = pd.Timestamp(qs["date"]) if "date" in qs else FIRST_DAY
except ValueError:
    start_day = FIRST_DAY
if not FIRST_DAY <= start_day <= LAST_DAY:
    start_day = FIRST_DAY

left, right = st.columns(2)
zone = left.selectbox("Zone", zones, index=zones.index(start_zone))
day = right.date_input("Date", value=start_day, min_value=FIRST_DAY, max_value=LAST_DAY,
                       help="The forecast covers 1–14 November 2025.")
day = pd.Timestamp(day)

if not FIRST_DAY <= day <= LAST_DAY:
    st.warning(f"We only forecast 1–14 November 2025. Please pick a date in that range "
               f"(you chose {day:%d %B %Y}).")
    st.stop()

d = forecast_day(bundle, test, zone, day)
if d.empty:
    st.warning(f"No forecast is available for {zone} on {day:%d %B %Y}.")
    st.stop()

evs = zone_events(events, zone, day)
q = quant.loc[80]
scale = np.sqrt(d.forecast + 1)
d["lower_80"] = np.clip(d.forecast + q.q_low * scale, 0, None)
d["upper_80"] = d.forecast + q.q_high * scale
d["typical"] = d.merge(profile[profile.zone == zone], on=["is_weekend", "hour"], how="left")["typical_trips"].values
d["drivers"] = np.ceil(d.forecast / TRIPS_PER_DRIVER_HOUR).astype(int)
d["fares"] = d.forecast * fares[zone]

peak = d.loc[d.forecast.idxmax()]
a, b, c, e = st.columns(4)
a.metric("Trips expected", f"{d.forecast.sum():,.0f}", f"{d.forecast.sum() - d.typical.sum():+,.0f} vs usual day")
b.metric("Peak hour", f"{peak.pickup_hour:%H:%M}", f"{peak.forecast:.0f} trips")
c.metric("Drivers at the peak", f"{int(np.ceil(peak.forecast / TRIPS_PER_DRIVER_HOUR))}",
         f"{d.drivers.sum():,} driver-hours over the day")
e.metric("Gross fares", f"{d.fares.sum():,.0f} birr", f"at {fares[zone]:.0f} birr per trip")

st.markdown(lookup_line(weather, evs, zone, day))
st.altair_chart(chart(d, profile, evs, day), use_container_width=True)
st.caption("Orange: forecast, with the 80% range shaded. Grey dashed: a usual day in this zone over the last "
           "8 weeks of history. Blue bands: event windows." if not evs.empty else
           "Orange: forecast, with the 80% range shaded. Grey dashed: a usual day in this zone over the last "
           "8 weeks of history.")

table = pd.DataFrame({
    "Hour": d.pickup_hour.dt.strftime("%H:%M"),
    "Forecast trips": d.forecast.round(1),
    "80% range": [f"{lo:.0f} – {hi:.0f}" for lo, hi in zip(d.lower_80, d.upper_80)],
    "Usual day": d.typical.round(1),
    "Drivers needed": d.drivers,
    "Gross fares (birr)": d.fares.round(0),
    "Rain (mm)": d.rain_mm.round(1),
    "Event": np.where(d[[c for c in d.columns if c.startswith("ev_") and c.endswith("_window")]].sum(axis=1) > 0,
                      "yes", ""),
})
st.dataframe(table, use_container_width=True, hide_index=True)
st.download_button("Download this day as CSV", table.to_csv(index=False).encode(),
                   file_name=f"forecast_{zone.lower().replace(' ', '_')}_{day:%Y%m%d}.csv", mime="text/csv")

with st.expander("How to read this"):
    st.markdown(
        f"""
- **Forecast trips** is the model's expectation for that hour; the **80% range** is where the actual count
  lands about 8 times out of 10 (checked on 18–31 October).
- **Drivers needed** is the forecast divided by {TRIPS_PER_DRIVER_HOUR} trips per driver-hour, rounded up.
  For hours where running short is costly, staff to the top of the 80% range instead.
- **Gross fares** uses this zone's average fare from the history ({fares[zone]:.0f} birr).
- Weather and events are looked up from the tables bundled with the app — nothing to type in.
        """)
