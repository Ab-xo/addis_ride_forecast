"""Deliverable A: cleaning, time standardization and joins for the three raw tables.

Every function returns cleaned data plus the evidence needed for the A1 cleaning log.
All tables leave this module on one clock: Addis Ababa local time (EAT, UTC+3), stored
as naive timestamps meaning "start of the hour in EAT".
"""
from __future__ import annotations

import re

import numpy as np
import pandas as pd

from src import config

# --------------------------------------------------------------------------------------
# Zone and event-type vocabularies
# --------------------------------------------------------------------------------------
ZONE_ALIASES = {
    "arat kilo": "Arat Kilo",
    "ayat": "Ayat",
    "bole": "Bole",
    "bole rd": "Bole",
    "bole subcity": "Bole",
    "c.m.c": "CMC",
    "cmc": "CMC",
    "gerji": "Gerji",
    "kazanches": "Kazanchis",
    "kazanchis": "Kazanchis",
    "kirkos": "Kazanchis",
    "kolfe": "Kolfe",
    "kolfe keranio": "Kolfe",
    "lideta": "Lideta",
    "megenaga": "Megenagna",
    "megenagna": "Megenagna",
    "mercato": "Merkato",
    "merkato": "Merkato",
    "piassa": "Piassa",
    "piazza": "Piassa",
    "arada": "Piassa",
    "sarbet": "Sarbet",
}
CITYWIDE_TOKENS = {"citywide", "city-wide", "city wide", "all", "all zones"}


def _norm_text(s: str) -> str:
    return re.sub(r"\s+", " ", str(s).strip().lower())


def canonical_zone(raw: str) -> str:
    """Map one raw zone spelling to one of the 12 canonical zone labels."""
    key = _norm_text(raw)
    if key not in ZONE_ALIASES:
        raise KeyError(f"Unknown zone spelling: {raw!r}")
    return ZONE_ALIASES[key]


def event_zones(raw) -> list[str]:
    """Expand an events-table zone cell into a list of canonical zones.

    Handles extra text in brackets ("Kazanchis (Kirkos)"), several zones ("Lideta & KAZANCHIS")
    and city-wide markers ("Citywide", "ALL", "All zones", "city-wide").
    """
    if pd.isna(raw) or not str(raw).strip():
        return []
    text = _norm_text(raw)
    if text in CITYWIDE_TOKENS:
        return list(config.ZONES)
    text = re.sub(r"\(.*?\)", "", text)
    parts = re.split(r"\s*(?:&|,|/|\band\b)\s*", text)
    zones = [canonical_zone(p) for p in parts if p.strip()]
    return sorted(set(zones))


def canonical_event_type(raw: str) -> str:
    key = _norm_text(raw).replace(" ", "_")
    if key not in config.EVENT_TYPES:
        raise KeyError(f"Unknown event type: {raw!r}")
    return key


# --------------------------------------------------------------------------------------
# Timestamp parsing (explicit formats, never inferred)
# --------------------------------------------------------------------------------------
TRIP_FORMATS = {
    "iso_offset": r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$",
    "ymd_hm": r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$",
    "dmy_hm": r"^\d{2}/\d{2}/\d{4} \d{2}:\d{2}$",
}


def classify_format(s: pd.Series, patterns: dict[str, str]) -> pd.Series:
    out = pd.Series("unknown", index=s.index, dtype=object)
    for name, pat in patterns.items():
        out[s.astype(str).str.match(pat)] = name
    return out


def parse_trip_hours(s: pd.Series) -> tuple[pd.Series, pd.Series]:
    """Parse the trip-table pickup_hour column (three formats) to naive EAT timestamps."""
    fmt = classify_format(s, TRIP_FORMATS)
    if (fmt == "unknown").any():
        raise ValueError(f"Unparsed pickup_hour values: {s[fmt == 'unknown'].unique()[:5]}")
    out = pd.Series(pd.NaT, index=s.index, dtype="datetime64[ns]")
    m = fmt == "iso_offset"
    out[m] = (pd.to_datetime(s[m], format="%Y-%m-%dT%H:%M:%S%z")
              .dt.tz_convert(config.LOCAL_TZ).dt.tz_localize(None).astype("datetime64[ns]"))
    m = fmt == "ymd_hm"
    out[m] = pd.to_datetime(s[m], format="%Y-%m-%d %H:%M")
    m = fmt == "dmy_hm"
    out[m] = pd.to_datetime(s[m], format="%d/%m/%Y %H:%M")
    return out, fmt


WEATHER_FORMATS = {
    "iso_z": r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$",
    "dmy_hm": r"^\d{2}/\d{2}/\d{4} \d{2}:\d{2}$",
}

EVENT_FORMATS = {
    "ymd_hm": r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$",
    "dmy_hm": r"^\d{2}/\d{2}/\d{4} \d{2}:\d{2}$",
    "mon_d_y_ampm": r"^[A-Z][a-z]{2} \d{2}, \d{4} \d{2}:\d{2} [AP]M$",
}


def parse_event_times(s: pd.Series) -> tuple[pd.Series, pd.Series]:
    fmt = classify_format(s.fillna(""), EVENT_FORMATS)
    fmt[s.isna()] = "missing"
    bad = fmt == "unknown"
    if bad.any():
        raise ValueError(f"Unparsed event times: {s[bad].unique()[:5]}")
    out = pd.Series(pd.NaT, index=s.index, dtype="datetime64[ns]")
    for name, f in [("ymd_hm", "%Y-%m-%d %H:%M"), ("dmy_hm", "%d/%m/%Y %H:%M"),
                    ("mon_d_y_ampm", "%b %d, %Y %I:%M %p")]:
        m = fmt == name
        out[m] = pd.to_datetime(s[m], format=f)
    return out, fmt


def day_first_check(s: pd.Series) -> dict:
    """Evidence that dd/mm/yyyy strings are day-first: count rows whose first field is > 12
    (impossible as a month) and rows whose second field is > 12 (would prove month-first)."""
    s = s.dropna().astype(str)
    s = s[s.str.match(r"^\d{2}/\d{2}/\d{4}")]
    first = s.str.slice(0, 2).astype(int)
    second = s.str.slice(3, 5).astype(int)
    return {"rows": int(len(s)), "first_field_gt_12": int((first > 12).sum()),
            "second_field_gt_12": int((second > 12).sum())}


# --------------------------------------------------------------------------------------
# Cleaning log helper
# --------------------------------------------------------------------------------------
class CleaningLog:
    def __init__(self):
        self.rows = []

    def add(self, file, columns, issue, n, total, fix, why):
        self.rows.append({"file": file, "columns": columns, "issue_type": issue,
                          "rows_affected": int(n), "pct_rows": round(100 * n / total, 2),
                          "fix_applied": fix, "why": why})

    def frame(self) -> pd.DataFrame:
        return pd.DataFrame(self.rows)


# --------------------------------------------------------------------------------------
# Trips
# --------------------------------------------------------------------------------------
SPIKE_RATIO = 4.0      # trips per active driver; normal hours sit at ~1.3 (99th pct 1.74)
SPIKE_FACTOR = 8       # inflated rows are ~8x the driver-implied level (99% exact multiples of 8)


def clean_trips(raw: pd.DataFrame, log: CleaningLog) -> pd.DataFrame:
    """Clean the raw train file to one row per (zone, pickup_hour) with valid values."""
    f = "ride_demand_train.csv"
    n = len(raw)
    df = raw.copy()

    df["zone_raw"] = df["zone"]
    df["zone"] = df["zone_raw"].map(canonical_zone)
    nonstd = (df["zone_raw"] != df["zone"]).sum()
    log.add(f, "zone", "inconsistent zone spelling (55 variants: case, trailing spaces, "
            "C.M.C, Piazza, Mercato, Megenaga, Kazanches, Bole Rd, Kolfe Keranio)", nonstd, n,
            "mapped to 12 canonical labels via an explicit alias table",
            "zone is the join key to weather/events and the grouping key for every model")

    df["pickup_hour"], fmt = parse_trip_hours(df["pickup_hour"].astype(str))
    nonstd = (fmt != "ymd_hm").sum()
    log.add(f, "pickup_hour", "3 timestamp formats (YYYY-MM-DD HH:MM, DD/MM/YYYY HH:MM, "
            "ISO with +03:00)", nonstd, n,
            "parsed each format with an explicit format string; ISO offsets converted to EAT",
            "inferred parsing would read day-first dates as month-first")

    for col in ["trips", "avg_wait_min"]:
        m = df[col] == -1
        log.add(f, col, "sentinel value -1 (impossible for a count/duration)", m.sum(), n,
                "set to missing", "-1 is a 'no reading' code; keeping it biases means and "
                "the model target")
        df.loc[m, col] = np.nan

    m = raw["trips"].isna()
    log.add(f, "trips", "blank target", m.sum(), n,
            "kept as a missing zone-hour in the grid; excluded from training and scoring",
            "imputing the target would invent training labels")
    m = raw["avg_fare_birr"].isna()
    log.add(f, "avg_fare_birr", "blank fare", m.sum(), n,
            "left missing; zone medians used where a fare is needed (demo revenue)",
            "fare is analysis-only, never a model input")

    ratio = df["trips"] / df["active_drivers"]
    spike = ratio >= SPIKE_RATIO
    mult8 = (df.loc[spike, "trips"] % SPIKE_FACTOR == 0).mean()
    log.add(f, "trips", f"inflated counts: trips/active_drivers >= {SPIKE_RATIO} (normal ~1.3, "
            f"no valid row above 2.7); {mult8:.0%} are exact multiples of {SPIKE_FACTOR}",
            spike.sum(), n,
            f"divided by {SPIKE_FACTOR} (restores ~1.3 trips per driver)",
            "drivers, wait and fare stay normal on these rows, so the trip count was "
            "multiplied in export; a real surge would also raise active drivers")
    df["trips_spike_fixed"] = spike
    df.loc[spike, "trips"] = df.loc[spike, "trips"] / SPIKE_FACTOR

    # Duplicate zone-hours: exact copies and copies with conflicting values.
    key = ["zone", "pickup_hour"]
    dup = df.duplicated(key, keep=False)
    exact = df.duplicated(key + ["trips", "avg_fare_birr", "avg_wait_min", "active_drivers"],
                          keep="first")
    log.add(f, "zone, pickup_hour", "duplicate zone-hour keys (same hour written in "
            "different formats/spellings; some with conflicting trips)", dup.sum(), n,
            "collapsed to one row per zone-hour: mean of valid values per column",
            f"{int(exact.sum())} rows were exact copies; the rest differ by a trip or two, "
            "so the mean is the least-biased single value")
    agg = (df.groupby(key, as_index=False)
             .agg(trips=("trips", "mean"), avg_fare_birr=("avg_fare_birr", "mean"),
                  avg_wait_min=("avg_wait_min", "mean"),
                  active_drivers=("active_drivers", "mean"),
                  n_source_rows=("record_id", "size"),
                  trips_spike_fixed=("trips_spike_fixed", "max")))
    return agg


def build_trip_grid(trips: pd.DataFrame, log: CleaningLog, n_raw: int) -> pd.DataFrame:
    """Expand to the complete 12-zone x hourly grid and classify every missing zone-hour."""
    hours = pd.date_range(config.TRAIN_START, config.TRAIN_END, freq="h")
    grid = pd.MultiIndex.from_product([config.ZONES, hours], names=["zone", "pickup_hour"])
    g = grid.to_frame(index=False).merge(trips, on=["zone", "pickup_hour"], how="left")
    g["has_record"] = g["n_source_rows"].notna()

    launch = trips.groupby("zone")["pickup_hour"].min()
    g["zone_launch"] = g["zone"].map(launch)
    prelaunch = g["pickup_hour"] < g["zone_launch"]

    # Outage: hours where no launched zone has any record.
    live = g[~prelaunch].groupby("pickup_hour")["has_record"].sum()
    outage_hours = live[live == 0].index
    outage = g["pickup_hour"].isin(outage_hours)

    status = np.select(
        [prelaunch, outage, ~g["has_record"], g["trips"].isna()],
        ["prelaunch", "outage", "random_gap", "missing_value"], default="observed")
    g["row_status"] = status

    total = len(g)
    log.add("ride_demand_train.csv", "(rows)", "zone not launched yet (Ayat starts "
            f"{launch['Ayat']:%d %b %Y})", prelaunch.sum(), total,
            "kept in grid as status 'prelaunch'; excluded from training and analysis means",
            "zero demand before launch is not a demand pattern")
    log.add("ride_demand_train.csv", "(rows)",
            f"platform outage: no zone has data {outage_hours.min():%d %b %H:%M}-"
            f"{outage_hours.max():%d %b %H:%M} ({len(outage_hours)} h)", outage.sum(), total,
            "kept in grid as status 'outage'; excluded from training",
            "missing because the platform was down, not because demand was zero")
    rg = (status == "random_gap").sum()
    log.add("ride_demand_train.csv", "(rows)", "random missing zone-hours (isolated records "
            "absent)", rg, total, "kept in grid as 'random_gap'; lag features leave them NaN",
            "scattered single hours; no evidence of a pattern")
    g = g.drop(columns=["has_record"])
    return g


def clean_test(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.copy()
    df["zone_raw"] = df["zone"]
    df["zone"] = df["zone_raw"].map(canonical_zone)
    df["pickup_hour"], df["pickup_hour_format"] = parse_trip_hours(df["pickup_hour"].astype(str))
    df["row_order"] = np.arange(len(df))
    return df


# --------------------------------------------------------------------------------------
# Weather
# --------------------------------------------------------------------------------------
WEATHER_SENTINEL = -9999.0
FAHRENHEIT_DAY_MEDIAN = 35.0  # a daily median above 35 degC never happens in Addis (~2,400 m)


def parse_weather_raw_clock(s: pd.Series) -> tuple[pd.Series, pd.Series]:
    """Parse weather timestamps as written, without any clock conversion."""
    fmt = classify_format(s, WEATHER_FORMATS)
    if (fmt == "unknown").any():
        raise ValueError("Unparsed weather timestamps")
    out = pd.Series(pd.NaT, index=s.index, dtype="datetime64[ns]")
    m = fmt == "iso_z"
    out[m] = pd.to_datetime(s[m], format="%Y-%m-%dT%H:%M:%SZ")
    m = fmt == "dmy_hm"
    out[m] = pd.to_datetime(s[m], format="%d/%m/%Y %H:%M")
    return out, fmt


def weather_clock_evidence(raw: pd.DataFrame) -> dict:
    """Facts from the data that pin down the weather clock (A2c / B2.1)."""
    t, fmt = parse_weather_raw_clock(raw["timestamp"])
    df = raw.assign(t=t, fmt=fmt)
    plausible = df["temp_c"].between(-5, 35)
    peak = (df[plausible].assign(h=df["t"].dt.hour)
            .groupby(["fmt", "h"])["temp_c"].mean().unstack(0))
    first_fc = df.loc[df["data_type"] == "forecast", "t"].min()
    last_obs = df.loc[df["data_type"] == "observed", "t"].max()
    return {
        "first_row_raw": df["t"].min(),
        "last_row_raw": df["t"].max(),
        "first_forecast_raw": first_fc,
        "last_observed_raw": last_obs,
        "temp_peak_hour_raw_iso_z": int(peak["iso_z"].idxmax()),
        "temp_peak_hour_raw_dmy": int(peak["dmy_hm"].idxmax()),
        "temp_profile_by_format": peak,
    }


def clean_weather(raw: pd.DataFrame, log: CleaningLog) -> pd.DataFrame:
    """Return one row per EAT hour, 31 Dec 2024 00:00 to 14 Nov 2025 23:00."""
    f = "weather_hourly.csv"
    n = len(raw)
    df = raw.copy()
    df["t_raw"], fmt = parse_weather_raw_clock(df["timestamp"])
    log.add(f, "timestamp", "2 formats: ISO with 'Z' and DD/MM/YYYY HH:MM without a zone",
            (fmt == "dmy_hm").sum(), n,
            "parsed each with an explicit format; both shown to be on UTC (same temperature "
            "curve, see A2c)", "a missing 'Z' does not mean local time")
    df["pickup_hour"] = df["t_raw"] + pd.Timedelta(hours=3)
    log.add(f, "timestamp", "clock is UTC, trips are EAT (UTC+3)", n, n,
            "added 3 hours to every weather timestamp",
            "forecast rows start 31 Oct 21:00 raw = 1 Nov 00:00 EAT; temperature peaks 12:00 "
            "raw = 15:00 EAT")

    # Fahrenheit block, detected per raw (UTC) day.
    day = df["t_raw"].dt.floor("D")
    day_med = df.groupby(day)["temp_c"].transform("median")
    fahr = day_med > FAHRENHEIT_DAY_MEDIAN
    days = day[fahr]
    log.add(f, "temp_c", f"temperature recorded in degF for {days.nunique()} days "
            f"({days.min():%d %b}-{days.max():%d %b}, values 54-77)", fahr.sum(), n,
            "converted (F - 32) x 5/9 for every row of a day whose median exceeds 35",
            "a 60 degC hour is impossible in Addis; converted values join the neighbouring "
            "days smoothly")
    df["temp_was_fahrenheit"] = fahr
    df.loc[fahr, "temp_c"] = (df.loc[fahr, "temp_c"] - 32) * 5 / 9

    m = df["rain_mm"] == WEATHER_SENTINEL
    log.add(f, "rain_mm", "sentinel -9999 for 'no reading'", m.sum(), n,
            "set to missing, then interpolated (below)", "would wreck every rain average")
    df.loc[m, "rain_mm"] = np.nan

    for col in ["temp_c", "humidity_pct"]:
        m = raw[col].isna()
        log.add(f, col, "blank reading", m.sum(), n,
                "time-interpolated from neighbouring hours",
                "weather changes smoothly hour to hour")

    dup = df.duplicated("pickup_hour", keep=False)
    log.add(f, "timestamp", "duplicate hours with conflicting values", dup.sum(), n,
            "averaged to one row per hour (data_type kept)",
            "no way to know which reading is right; the mean halves the error")
    num = ["temp_c", "rain_mm", "humidity_pct", "wind_kmh"]
    df = (df.groupby("pickup_hour", as_index=False)
            .agg(**{c: (c, "mean") for c in num},
                 data_type=("data_type", "first"),
                 temp_was_fahrenheit=("temp_was_fahrenheit", "max"),
                 n_source_rows=("timestamp", "size")))

    hours = pd.date_range(df["pickup_hour"].min(), df["pickup_hour"].max(), freq="h")
    missing = hours.difference(df["pickup_hour"])
    log.add(f, "timestamp", "missing hours (gaps in the hourly series)", len(missing), n,
            "reindexed to a full hourly series and time-interpolated (rain: interpolated, "
            "never negative)", "every zone-hour needs a weather row for the many-to-one join")
    df = df.set_index("pickup_hour").reindex(hours)
    df.index.name = "pickup_hour"
    df["weather_imputed"] = df["n_source_rows"].isna() | df[num].isna().any(axis=1)
    df[num] = df[num].interpolate(method="time", limit_direction="both")
    df["rain_mm"] = df["rain_mm"].clip(lower=0)
    # Hours in the forecast fortnight are forecasts even when interpolated.
    df["data_type"] = np.where(df.index >= pd.Timestamp(config.TEST_START), "forecast",
                               "observed")
    df["temp_was_fahrenheit"] = df["temp_was_fahrenheit"].fillna(False).astype(bool)
    df = df.drop(columns="n_source_rows").reset_index()
    return df


# --------------------------------------------------------------------------------------
# Events
# --------------------------------------------------------------------------------------
def parse_attendance(s: pd.Series) -> pd.Series:
    def one(x):
        if pd.isna(x) or not str(x).strip():
            return np.nan
        digits = re.sub(r"[^\d]", "", str(x))
        return float(digits) if digits else np.nan
    return s.map(one)


def clean_events(raw: pd.DataFrame, log: CleaningLog) -> pd.DataFrame:
    """One row per (cleaned) event, with zones as a list and start/end on EAT."""
    f = "events_calendar.csv"
    n = len(raw)
    ev = raw.copy()

    ev["event_type_raw"] = ev["event_type"]
    ev["event_type"] = ev["event_type_raw"].map(canonical_event_type)
    log.add(f, "event_type", f"{ev['event_type_raw'].nunique()} spellings of 8 types "
            "(case, spaces vs underscores)", (ev["event_type_raw"] != ev["event_type"]).sum(), n,
            "lower-cased, spaces to underscores, validated against the 8-type list",
            "type drives the window rule and the per-type features")

    ev["zone_raw"] = ev["zone"]
    ev["zones"] = ev["zone_raw"].map(event_zones)
    ev["n_zones"] = ev["zones"].map(len)
    nonstd = ~ev["zone_raw"].isin(config.ZONES)
    log.add(f, "zone", "zone text not a clean label: case variants, extra text in brackets "
            "('Kazanchis (Kirkos)'), multi-zone 'A & B', Citywide/ALL/All zones/city-wide",
            nonstd.sum(), n, "parsed to a list of canonical zones; city-wide expands to all 12",
            "an event affects demand only in the zones it touches")

    ev["start"], sfmt = parse_event_times(ev["start_datetime"])
    ev["end"], efmt = parse_event_times(ev["end_datetime"])
    nonstd = ((sfmt != "ymd_hm") | ((efmt != "ymd_hm") & (efmt != "missing"))).sum()
    log.add(f, "start_datetime, end_datetime", "3 date formats (YYYY-MM-DD, day-first "
            "DD/MM/YYYY, 'Feb 06, 2025 08:00 PM')", nonstd, n,
            "explicit format per pattern; day-first confirmed (first field > 12 on many rows, "
            "second field never > 12)", "month-first parsing would move events by months")

    ev["status_raw"] = ev["status"]
    ev["status"] = ev["status_raw"].map(_norm_text)
    log.add(f, "status", "inconsistent case/whitespace (confirmed, Confirmed, CONFIRMED, "
            "'CONFIRMED ', CANCELLED)", (ev["status_raw"] != ev["status"]).sum(), n,
            "lower-cased and stripped", "cancelled events must be identified reliably")

    dup_cols = [c for c in raw.columns if c != "event_id"]
    dup = ev.duplicated(dup_cols, keep="first")
    log.add(f, "(rows)", "duplicate events re-entered under a new id (EVT-9xxx)", dup.sum(), n,
            "dropped the later copy", "a duplicated event would double its feature values")
    ev = ev[~dup].copy()

    dur = (ev["end"] - ev["start"]).dt.total_seconds() / 3600
    hist = ev["start"] <= pd.Timestamp(config.TRAIN_END)  # fit on history rows only (Rule 8)
    med = dur[(dur > 0) & hist].groupby(ev["event_type"]).median()
    miss = ev["end"].isna()
    inv = dur <= 0
    log.add(f, "end_datetime", "missing end time", miss.sum(), n,
            "filled with start + median duration of that event type",
            "every event needs an interval for the window join")
    log.add(f, "end_datetime", "end earlier than start", inv.sum(), n,
            "replaced with start + median duration of that event type",
            "a swap would give a 2 h exhibition, so the end itself is wrong")
    fix = miss | inv
    ev["end_imputed"] = fix
    ev.loc[fix, "end"] = ev.loc[fix, "start"] + pd.to_timedelta(
        ev.loc[fix, "event_type"].map(med), unit="h")

    ev["attendance"] = parse_attendance(ev["expected_attendance"])
    txt = ev["expected_attendance"].notna() & ~ev["expected_attendance"].astype(str).str.fullmatch(r"\d+")
    log.add(f, "expected_attendance", "free text ('approx 34000', '16,007')", txt.sum(), n,
            "kept digits only", "attendance becomes a numeric feature")
    blank = ev["attendance"].isna()
    att_med = ev[ev["start"] <= pd.Timestamp(config.TRAIN_END)].groupby("event_type")["attendance"].median()
    log.add(f, "expected_attendance", "blank attendance", blank.sum(), n,
            "filled with the median of the same event type (holidays, closures, breaks stay 0)",
            "most blanks are types where attendance is meaningless")
    ev["attendance_imputed"] = blank & ev["event_type"].map(att_med).notna()
    ev["attendance"] = ev["attendance"].fillna(ev["event_type"].map(att_med)).fillna(0)

    ev["venue"] = ev["venue"].fillna("(none)")
    keep = ["event_id", "event_name", "event_type", "venue", "zones", "n_zones", "start", "end",
            "attendance", "status", "end_imputed", "attendance_imputed", "zone_raw",
            "event_type_raw"]
    return ev[keep].reset_index(drop=True)


def window_bounds(ev: pd.DataFrame) -> pd.DataFrame:
    """Window rule (A3): venue events reach EVENT_PRE_HOURS before the start and
    EVENT_POST_HOURS after the end; day-level calendar items (holidays, school breaks) and road
    closures cover only their own interval."""
    ev = ev.copy()
    venue = ~ev["event_type"].isin(["public_holiday", "school_break", "road_closure"])
    ev["win_start"] = ev["start"].dt.floor("h") - pd.to_timedelta(
        np.where(venue, config.EVENT_PRE_HOURS, 0), unit="h")
    # An hour h is "during" when it overlaps [start, end): h < end.
    end_hour = (ev["end"] - pd.Timedelta(seconds=1)).dt.floor("h")
    ev["win_end"] = end_hour + pd.to_timedelta(np.where(venue, config.EVENT_POST_HOURS, 0),
                                               unit="h")
    return ev


def explode_event_hours(ev: pd.DataFrame) -> pd.DataFrame:
    """Interval join helper: one row per (event, zone, hour) inside the event window, with
    the window phase (pre / during / post)."""
    ev = window_bounds(ev)
    rows = []
    for r in ev.itertuples(index=False):
        hrs = pd.date_range(r.win_start, r.win_end, freq="h")
        start_h = r.start.floor("h")
        end_h = (r.end - pd.Timedelta(seconds=1)).floor("h")
        phase = np.where(hrs < start_h, "pre", np.where(hrs > end_h, "post", "during"))
        for z in r.zones:
            rows.append(pd.DataFrame({
                "event_id": r.event_id, "event_type": r.event_type, "zone": z,
                "pickup_hour": hrs, "phase": phase, "attendance": r.attendance,
                "status": r.status}))
    return pd.concat(rows, ignore_index=True)
