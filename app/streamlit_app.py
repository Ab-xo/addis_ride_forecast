"""Deliverable E — Addis ride-demand forecast demo.

Pick a zone and a date in 1–14 November 2025. Everything else (weather, events, the zone's average fare)
is looked up from the tables bundled in app/assets/, which were built by `python -m src.app_assets` from
the cleaned data and the final model. The app does no cleaning, joining or fitting.

Alternative Streamlit front end (the main demo is the Next.js app served by app/app.py).
Run from the repo root:  streamlit run app/streamlit_app.py
"""
from __future__ import annotations

from html import escape
from pathlib import Path

import altair as alt
import joblib
import numpy as np
import pandas as pd
import streamlit as st

ASSETS = Path(__file__).parent / "assets"
FIRST_DAY, LAST_DAY = pd.Timestamp("2025-11-01"), pd.Timestamp("2025-11-14")
TRIPS_PER_DRIVER_HOUR = 1.3

# One palette, shared with the figure pack (colourblind-checked).
NAVY, INK, MUTED, LINE = "#14213D", "#1F2A44", "#6B7B8C", "#E3E8EF"
ORANGE, BLUE, GREEN, GREY = "#EB6834", "#2A78D6", "#1BAF7A", "#9AA5B1"

EVENT_LABELS = {"football_match": "Football match", "concert": "Concert", "conference": "Conference",
                "exhibition": "Exhibition", "road_closure": "Road closure", "sports_run": "Road race",
                "public_holiday": "Public holiday", "school_break": "School break"}
EVENT_ICONS = {"football_match": "⚽", "concert": "🎵", "conference": "🎤", "exhibition": "🖼️",
               "road_closure": "🚧", "sports_run": "🏃", "public_holiday": "🎉", "school_break": "🎒"}
ZONE_TYPE_LABELS = {"business_district": "Business district", "residential": "Residential",
                    "transport_hub": "Transport hub", "market": "Market", "nightlife_airport": "Nightlife & airport"}

st.set_page_config(page_title="Addis Ride Demand Forecast", page_icon="🚕", layout="wide",
                   initial_sidebar_state="collapsed")

# ----------------------------------------------------------------------------------------------------
# Styling
# ----------------------------------------------------------------------------------------------------
st.markdown(f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
html, body, [class*="css"], .stMarkdown, .stText, button, input, select, textarea {{
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}}
.stApp {{ background: #F5F7FA; }}
.block-container {{ padding-top: 1.6rem; padding-bottom: 3rem; max-width: 1280px; }}
header[data-testid="stHeader"] {{ background: transparent; }}
#MainMenu, footer, [data-testid="stToolbar"], [data-testid="stDecoration"] {{ visibility: hidden; }}

.hero {{
  background: radial-gradient(1200px 400px at 85% -20%, rgba(235,104,52,.35), transparent 60%),
              linear-gradient(135deg, {NAVY} 0%, #1C3A6B 100%);
  border-radius: 20px; padding: 30px 34px 26px; color: #fff; margin-bottom: 18px;
  box-shadow: 0 10px 30px rgba(20,33,61,.18);
}}
.hero-eyebrow {{ font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #F7B699; font-weight: 600; }}
.hero h1 {{ font-size: 34px; font-weight: 800; margin: 6px 0 6px; color: #fff; letter-spacing: -.02em; line-height: 1.15; }}
.hero p {{ color: #CBD5E1; margin: 0; font-size: 15px; }}
.pills {{ margin-top: 16px; display: flex; flex-wrap: wrap; gap: 8px; }}
.pill {{ background: rgba(255,255,255,.10); border: 1px solid rgba(255,255,255,.18); color: #fff;
        padding: 5px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 500; }}

.card {{ background: #fff; border: 1px solid {LINE}; border-radius: 16px; padding: 18px 20px;
        box-shadow: 0 1px 2px rgba(16,24,40,.04); }}
.kpi-label {{ color: {MUTED}; font-size: 12.5px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }}
.kpi-value {{ color: {INK}; font-size: 32px; font-weight: 800; letter-spacing: -.02em; margin-top: 6px; line-height: 1.1; }}
.kpi-sub {{ color: {MUTED}; font-size: 13px; margin-top: 6px; }}
.up {{ color: #0F7B53; font-weight: 600; }} .down {{ color: #B4232C; font-weight: 600; }}
.kpi-accent {{ display:inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }}

.section-title {{ color: {INK}; font-size: 18px; font-weight: 700; margin: 6px 0 2px; letter-spacing: -.01em; }}
.section-sub {{ color: {MUTED}; font-size: 13.5px; margin-bottom: 10px; }}

.lookup {{ background: #fff; border: 1px solid {LINE}; border-radius: 14px; padding: 12px 16px; margin: 4px 0 16px;
          display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }}
.lookup-title {{ color: {INK}; font-weight: 700; font-size: 13.5px; margin-right: 6px; }}
.chip {{ background: #F1F4F8; border: 1px solid {LINE}; color: {INK}; padding: 5px 11px; border-radius: 999px;
        font-size: 13px; font-weight: 500; }}
.chip-event {{ background: #EAF2FD; border-color: #C9DDF8; color: #174E92; }}
.chip-rain {{ background: #E8F7F1; border-color: #BFE8D7; color: #0F6B49; }}

div[data-testid="stSelectbox"] label, div[data-testid="stDateInput"] label {{ font-weight: 600; color: {INK}; }}
div[data-baseweb="select"] > div, div[data-testid="stDateInput"] input {{ border-radius: 10px !important; }}
.stTabs [role="tablist"] {{ gap: 8px; border-bottom: none !important; }}
.stTabs button[role="tab"] {{ background: #fff; border: 1px solid {LINE}; border-radius: 10px; padding: 8px 18px;
                             height: auto; }}
.stTabs button[role="tab"] p {{ font-weight: 600; font-size: 14px; }}
.stTabs button[role="tab"][aria-selected="true"] {{ background: {NAVY}; border-color: {NAVY}; }}
.stTabs button[role="tab"][aria-selected="true"] p {{ color: #fff; }}
.stTabs [data-baseweb="tab-highlight"], .stTabs [data-baseweb="tab-border"] {{ display: none; }}
div[data-testid="stDataFrame"] {{ border: 1px solid {LINE}; border-radius: 12px; overflow: hidden; }}
.footer {{ color: {MUTED}; font-size: 12.5px; text-align: center; margin-top: 28px; }}
</style>
""", unsafe_allow_html=True)


# ----------------------------------------------------------------------------------------------------
# Data
# ----------------------------------------------------------------------------------------------------
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
    return rows.assign(forecast=np.clip(bundle["model"].predict(rows[bundle["features"]]), 0, None))


def lookup_chips(weather, evs, day) -> list[tuple[str, str]]:
    """(text, css class) chips describing what was looked up; also used for the plain-text summary."""
    w = weather[weather.pickup_hour.dt.date == day.date()]
    chips = []
    if not w.empty:
        chips.append((f"🌡️ {w.temp_c.min():.0f}–{w.temp_c.max():.0f} °C", ""))
        rain = w.rain_mm.sum()
        if rain < 0.1:
            chips.append(("☀️ No rain forecast", ""))
        else:
            wettest = w.loc[w.rain_mm.idxmax()]
            chips.append((f"🌧️ {rain:.1f} mm rain · heaviest {wettest.rain_mm:.1f} mm at {wettest.pickup_hour:%H:%M}",
                          "chip-rain"))
    for _, e in evs.iterrows():
        label = EVENT_LABELS.get(e.event_type, str(e.event_type).replace("_", " "))
        where = f" at {e.venue}" if isinstance(e.venue, str) and e.venue not in ("(none)", "") else ""
        chips.append((f"{EVENT_ICONS.get(e.event_type, '📍')} {label}{where} · {e.start:%H:%M}–{e.end:%H:%M}",
                      "chip-event"))
    if evs.empty:
        chips.append(("📅 No listed events in or near this zone", ""))
    return chips


def kpi(label, value, sub, dot=None):
    dot_html = f'<span class="kpi-accent" style="background:{dot}"></span>' if dot else ""
    return (f'<div class="card"><div class="kpi-label">{dot_html}{escape(label)}</div>'
            f'<div class="kpi-value">{value}</div><div class="kpi-sub">{sub}</div></div>')


def forecast_chart(d, evs, day):
    base = d.rename(columns={"pickup_hour": "time"})
    x = alt.X("time:T", title=None, axis=alt.Axis(format="%H:%M", tickCount=12, labelColor=MUTED, grid=False,
                                                 domainColor=LINE, tickColor=LINE))
    y_axis = alt.Axis(labelColor=MUTED, titleColor=MUTED, gridColor="#EEF1F5", domain=False, ticks=False)
    layers = []
    if not evs.empty:
        windows = pd.DataFrame({
            "start": evs.start.clip(lower=day), "end": evs.end.clip(upper=day + pd.Timedelta(hours=23)),
            "event": [f"{EVENT_LABELS.get(t, t)}" for t in evs.event_type],
            "when": [f"{s:%H:%M}–{e:%H:%M}" for s, e in zip(evs.start, evs.end)]})
        layers.append(alt.Chart(windows).mark_rect(opacity=0.12, color=BLUE).encode(
            x="start:T", x2="end:T", tooltip=[alt.Tooltip("event:N", title="Event"), alt.Tooltip("when:N", title="Time")]))
        layers.append(alt.Chart(windows).mark_text(align="left", baseline="top", dx=6, dy=6, color="#174E92",
                                                   fontSize=11, fontWeight=600).encode(
            x="start:T", y=alt.value(0), text="event:N"))
    band = alt.Chart(base).mark_area(opacity=0.16, color=ORANGE, interpolate="monotone").encode(
        x=x, y=alt.Y("lower_80:Q", title="trips per hour", axis=y_axis), y2="upper_80:Q")
    usual = alt.Chart(base).mark_line(color=GREY, strokeDash=[5, 4], strokeWidth=2, interpolate="monotone").encode(
        x="time:T", y="typical:Q")
    line = alt.Chart(base).mark_line(color=ORANGE, strokeWidth=3, interpolate="monotone").encode(x="time:T", y="forecast:Q")
    hover = alt.selection_point(fields=["time"], nearest=True, on="pointerover", empty=False)
    points = alt.Chart(base).mark_circle(size=70, color=ORANGE, stroke="white", strokeWidth=2).encode(
        x="time:T", y="forecast:Q", opacity=alt.condition(hover, alt.value(1), alt.value(0)),
        tooltip=[alt.Tooltip("time:T", title="Hour", format="%H:%M"),
                 alt.Tooltip("forecast:Q", title="Forecast trips", format=".0f"),
                 alt.Tooltip("lower_80:Q", title="80% low", format=".0f"),
                 alt.Tooltip("upper_80:Q", title="80% high", format=".0f"),
                 alt.Tooltip("typical:Q", title="Usual day", format=".0f"),
                 alt.Tooltip("drivers:Q", title="Drivers needed")]).add_params(hover)
    rule = alt.Chart(base).mark_rule(color=LINE, strokeWidth=1).encode(
        x="time:T", opacity=alt.condition(hover, alt.value(1), alt.value(0)))
    peak = base.loc[[base.forecast.idxmax()]]
    peak_mark = alt.Chart(peak).mark_text(dy=-16, color=INK, fontSize=12, fontWeight=700).encode(
        x="time:T", y="forecast:Q", text=alt.value("Peak"))
    return (alt.layer(*layers, band, usual, line, rule, points, peak_mark)
            .properties(height=360).configure_view(strokeWidth=0).configure(background="white", padding=12))


def drivers_chart(d):
    base = d.rename(columns={"pickup_hour": "time"}).assign(
        is_peak=lambda x: np.where(x.forecast >= x.forecast.quantile(0.8), "Busiest hours", "Other hours"),
        drivers_hi=lambda x: np.ceil(x.upper_80 / TRIPS_PER_DRIVER_HOUR))
    bars = alt.Chart(base).mark_bar(cornerRadiusTopLeft=4, cornerRadiusTopRight=4, width=18).encode(
        x=alt.X("time:T", title=None, axis=alt.Axis(format="%H:%M", tickCount=12, labelColor=MUTED, grid=False,
                                                   domainColor=LINE)),
        y=alt.Y("drivers:Q", title="drivers needed", axis=alt.Axis(labelColor=MUTED, titleColor=MUTED,
                                                                   gridColor="#EEF1F5", domain=False, ticks=False)),
        color=alt.Color("is_peak:N", scale=alt.Scale(domain=["Busiest hours", "Other hours"], range=[ORANGE, "#C5D3E3"]),
                        legend=alt.Legend(orient="top", title=None, labelColor=MUTED)),
        tooltip=[alt.Tooltip("time:T", title="Hour", format="%H:%M"), alt.Tooltip("drivers:Q", title="Drivers needed"),
                 alt.Tooltip("drivers_hi:Q", title="Safe staffing (80% high)")])
    ticks = alt.Chart(base).mark_tick(color=INK, thickness=2, size=18).encode(x="time:T", y="drivers_hi:Q")
    return (alt.layer(bars, ticks).properties(height=300).configure_view(strokeWidth=0)
            .configure(background="white", padding=12))


# ----------------------------------------------------------------------------------------------------
# Page
# ----------------------------------------------------------------------------------------------------
test, weather, events, profile, fares, quant = load_assets()
bundle = load_model()
zones = sorted(test.zone.unique())
zone_type = test.drop_duplicates("zone").set_index("zone")["zone_type"]

st.markdown(f"""
<div class="hero">
  <div class="hero-eyebrow">Qiyas AI Hackathon · Team {escape(bundle['team'])}</div>
  <h1>Addis Ababa ride demand forecast</h1>
  <p>Hour-by-hour trip demand for any of 12 zones, 1–14 November 2025, with weather and events looked up for you.</p>
  <div class="pills">
    <span class="pill">LightGBM · {len(bundle['features'])} forecast-time features</span>
    <span class="pill">Validation RMSE {bundle['validation']['main_split_rmse']:.2f} trips / zone-hour</span>
    <span class="pill">Trained on {escape(bundle['trained_on'])}</span>
  </div>
</div>
""", unsafe_allow_html=True)

# A ?zone=Bole&date=2025-11-05 link opens the app on that zone and day; the two controls are still the only inputs.
qs = st.query_params
start_zone = qs.get("zone") if qs.get("zone") in zones else zones[0]
start_day, bad_link_date = FIRST_DAY, None
if "date" in qs:
    try:
        start_day = pd.Timestamp(qs["date"])
    except ValueError:
        bad_link_date = qs["date"]
    if bad_link_date is None and not FIRST_DAY <= start_day <= LAST_DAY:
        bad_link_date, start_day = f"{start_day:%d %B %Y}", FIRST_DAY
    elif bad_link_date is not None:
        start_day = FIRST_DAY

c1, c2, c3 = st.columns([1.2, 1.2, 1.6], vertical_alignment="bottom")
zone = c1.selectbox("Zone", zones, index=zones.index(start_zone))
day = c2.date_input("Date", value=start_day, min_value=FIRST_DAY, max_value=LAST_DAY, format="DD/MM/YYYY",
                    help="Forecasts are available for 1–14 November 2025.")
c3.markdown(f'<div class="section-sub" style="margin-bottom:12px">Zone type: <b>{ZONE_TYPE_LABELS.get(zone_type[zone], zone_type[zone])}</b>'
            f' · Average fare <b>{fares[zone]:.0f} birr</b></div>', unsafe_allow_html=True)

if bad_link_date:
    st.info(f"We only forecast 1–14 November 2025, so the link's date ({escape(str(bad_link_date))}) can't be shown. "
            "Showing 1 November instead — pick any day in the fortnight above.", icon="📅")

day = pd.Timestamp(day) if day is not None else FIRST_DAY
if not FIRST_DAY <= day <= LAST_DAY:
    st.warning(f"We only forecast 1–14 November 2025. Please pick a date in that range (you chose {day:%d %B %Y}).",
               icon="📅")
    st.stop()

d = forecast_day(bundle, test, zone, day)
if d.empty:
    st.warning(f"No forecast is available for {zone} on {day:%d %B %Y}.", icon="⚠️")
    st.stop()

evs = zone_events(events, zone, day)
q = quant.loc[80]
scale = np.sqrt(d.forecast + 1)
d["lower_80"] = np.clip(d.forecast + q.q_low * scale, 0, None)
d["upper_80"] = d.forecast + q.q_high * scale
d["typical"] = d.merge(profile[profile.zone == zone], on=["dow", "hour"], how="left")["typical_trips"].values
d["drivers"] = np.ceil(d.forecast / TRIPS_PER_DRIVER_HOUR).astype(int)
d["fares"] = d.forecast * fares[zone]

# What was looked up
chips = lookup_chips(weather, evs, day)
st.markdown(f'<div class="lookup"><span class="lookup-title">Looked up for {escape(zone)}, {day:%A %d %B}</span>'
            + "".join(f'<span class="chip {cls}">{escape(t)}</span>' for t, cls in chips) + "</div>",
            unsafe_allow_html=True)

# KPIs
total, usual_total = d.forecast.sum(), d.typical.sum()
delta = 100 * (total / usual_total - 1) if usual_total else 0.0
delta_html = f'<span class="{"up" if delta >= 0 else "down"}">{"▲" if delta >= 0 else "▼"} {abs(delta):.0f}%</span> vs a usual {day:%A}'
peak = d.loc[d.forecast.idxmax()]
peak_drivers = int(np.ceil(peak.forecast / TRIPS_PER_DRIVER_HOUR))
k1, k2, k3, k4 = st.columns(4)
k1.markdown(kpi("Trips expected", f"{total:,.0f}", delta_html, ORANGE), unsafe_allow_html=True)
k2.markdown(kpi("Peak hour", f"{peak.pickup_hour:%H:%M}",
                f"{peak.forecast:.0f} trips · range {peak.lower_80:.0f}–{peak.upper_80:.0f}", BLUE), unsafe_allow_html=True)
k3.markdown(kpi("Drivers at peak", f"{peak_drivers}", f"{d.drivers.sum():,} driver-hours across the day", GREEN),
            unsafe_allow_html=True)
k4.markdown(kpi("Gross fares", f"{d.fares.sum() / 1000:,.1f}k birr", f"at {fares[zone]:.0f} birr per trip", NAVY),
            unsafe_allow_html=True)

st.write("")
tab_fc, tab_drv, tab_tbl, tab_how = st.tabs(["📈  Forecast", "🚗  Driver plan", "📋  Hourly table", "ℹ️  How it works"])

with tab_fc:
    st.markdown('<div class="section-title">24-hour demand forecast</div>'
                '<div class="section-sub">Orange: forecast with its 80% range · grey dashed: a usual day in this zone '
                '(last 8 weeks of history)' + (" · blue: event windows" if not evs.empty else "") + "</div>",
                unsafe_allow_html=True)
    st.altair_chart(forecast_chart(d, evs, day), use_container_width=True)

with tab_drv:
    st.markdown('<div class="section-title">Drivers needed each hour</div>'
                f'<div class="section-sub">Bars: forecast ÷ {TRIPS_PER_DRIVER_HOUR} trips per driver-hour · '
                'black ticks: safe staffing for hours where running short is costly (top of the 80% range)</div>',
                unsafe_allow_html=True)
    st.altair_chart(drivers_chart(d), use_container_width=True)

with tab_tbl:
    table = pd.DataFrame({
        "Hour": d.pickup_hour.dt.strftime("%H:%M"),
        "Forecast trips": d.forecast.round(1),
        "80% range": [f"{lo:.0f} – {hi:.0f}" for lo, hi in zip(d.lower_80, d.upper_80)],
        "Usual day": d.typical.round(1),
        "Drivers needed": d.drivers,
        "Gross fares (birr)": d.fares.round(0).astype(int),
        "Temp (°C)": d.temp_c.round(1),
        "Rain (mm)": d.rain_mm.round(1),
        "Event window": np.where(d[[c for c in d.columns if c.startswith("ev_") and c.endswith("_window")]].sum(axis=1) > 0,
                                 "●", ""),
    })
    st.dataframe(table, use_container_width=True, hide_index=True, height=600,
                 column_config={
                     "Forecast trips": st.column_config.ProgressColumn("Forecast trips", format="%.1f", min_value=0,
                                                                       max_value=float(max(d.upper_80.max(), 1))),
                     "Gross fares (birr)": st.column_config.NumberColumn(format="%d"),
                 })
    st.download_button("⬇  Download this day as CSV", table.to_csv(index=False).encode(),
                       file_name=f"forecast_{zone.lower().replace(' ', '_')}_{day:%Y%m%d}.csv", mime="text/csv")

with tab_how:
    st.markdown(f"""
<div class="card">

**What you choose:** a zone and a day. Nothing else — the app never asks for weather or events.

**What the app looks up:** the hourly weather forecast for that day and every confirmed event in or near the zone,
from the cleaned tables bundled in `app/assets/`. These feed the same model that produced the submission.

**How to read the numbers**

- **Forecast trips** — the model's expectation for each hour. The **80% range** is where the actual count landed
  about 8 times out of 10 when we tested on 18–31 October.
- **Drivers needed** — forecast ÷ {TRIPS_PER_DRIVER_HOUR} trips per driver-hour, rounded up. For hours where running short
  is costly (evening peak, event windows, holiday eves), staff to the top of the 80% range instead.
- **Gross fares** — forecast trips × this zone's average fare in the history ({fares[zone]:.0f} birr).

**The model:** LightGBM with a Poisson objective on {len(bundle['features'])} forecast-time features (calendar, zone,
weather, events and history at least 14 days old), trained on {escape(bundle['trained_on'])}. Held-out RMSE
{bundle['validation']['main_split_rmse']:.2f} and MAE {bundle['validation']['main_split_mae']:.2f} trips per zone-hour;
{bundle['validation']['rolling_rmse_mean']:.2f} averaged over five rolling fortnights.

</div>
""", unsafe_allow_html=True)

st.markdown(f'<div class="footer">Team {escape(bundle["team"])} · Qiyas AI Hackathon #2 · '
            'synthetic training data, for demonstration only</div>', unsafe_allow_html=True)
