"""Column documentation for the master tables (A6 feature table, A8 data dictionary)."""
import pandas as pd

# column: (source, description, derivation / formula, why it should help, known at forecast time)
COLUMNS = {
    "row_id": ("test", "Test row identifier (join key for scoring)", "copied from raw", "", "yes"),
    "zone": ("trips/test", "One of 12 canonical pickup zones", "alias table over 55 raw spellings",
             "", "yes"),
    "pickup_hour": ("trips/test", "Start of the hour, Addis Ababa local time (EAT, naive)",
                    "3 explicit formats parsed; ISO +03:00 converted to EAT", "", "yes"),
    "row_status": ("trips", "observed / missing_value / random_gap / outage / prelaunch",
                   "full 12 x 7,296-hour grid vs cleaned records", "", "n/a"),
    "trips": ("trips", "TARGET: trips requested in the zone-hour",
              "-1 -> NaN; x8 spikes / 8; duplicates averaged", "", "no (target)"),
    "avg_fare_birr": ("trips", "Average fare (birr) - analysis/demo only", "duplicates averaged",
                      "", "no"),
    "avg_wait_min": ("trips", "Average wait (min) - analysis only", "-1 -> NaN; duplicates averaged",
                     "", "no"),
    "active_drivers": ("trips", "Active drivers - analysis only", "duplicates averaged", "", "no"),
    "trips_spike_fixed": ("trips", "1 if the raw count was an x8 export spike and was divided by 8",
                          "trips/active_drivers >= 4", "", "n/a"),
    "zone_type": ("derived (train)", "Zone group from weekday profile shape and weekend ratio",
                  "rules in features.fit_zone_types on train rows", "", "yes"),
    "weather_data_type": ("weather", "observed (history) or forecast (1-14 Nov)", "copied", "",
                          "yes"),
    "weather_imputed": ("weather", "1 if the weather hour was missing/blank and interpolated",
                        "reindex + time interpolation", "", "yes"),
    "ev_ids": ("events", "Confirmed event ids whose window covers the zone-hour",
               "interval join", "", "yes"),
    "ev_cancelled_window": ("events", "1 if a cancelled event's window covers the zone-hour "
                            "(analysis only, B3.4)", "interval join on cancelled events", "", "yes"),
    # ---- calendar
    "hour": ("calendar", "Hour of day 0-23", "pickup_hour.hour",
             "demand has strong commuter/market/nightlife hourly shapes", "yes"),
    "dow": ("calendar", "Day of week, 0 = Monday", "pickup_hour.dayofweek",
            "business zones empty at weekends, nightlife zones fill", "yes"),
    "is_weekend": ("calendar", "1 on Saturday/Sunday", "dow >= 5", "same as dow, simpler split",
                   "yes"),
    "month": ("calendar", "Month 1-12", "pickup_hour.month", "seasonal level shifts", "yes"),
    "day_of_month": ("calendar", "Day of month", "pickup_hour.day", "pay-cycle effects", "yes"),
    "is_payday_window": ("calendar", "1 in the last 5 days or first 2 days of a month",
                         "day > days_in_month - 5 or day <= 2",
                         "more spending money around payday (B4.3)", "yes"),
    "is_public_holiday": ("events", "1 if a confirmed public holiday covers the hour",
                          "interval join, public_holiday rows",
                          "holidays change the whole day's pattern", "yes"),
    "is_school_break": ("events", "1 inside a confirmed school break",
                        "interval join, school_break rows", "fewer school runs", "yes"),
    "trend_days": ("calendar", "Days since 1 Jan 2025", "(pickup_hour - 2025-01-01) / 1 day",
                   "city demand grows ~40% Jan-Oct (B1.4)", "yes"),
    "zone_code": ("zone", "Integer code of the zone", "index in config.ZONES",
                  "zone levels differ 2x", "yes"),
    "zone_type_code": ("zone", "Integer code of zone_type", "index in ZONE_TYPE_ORDER",
                       "shares hourly shape across similar zones", "yes"),
    # ---- weather
    "temp_c": ("weather", "Air temperature, degC (degF block converted)", "joined on EAT hour",
               "comfort affects walking vs riding", "yes (forecast)"),
    "rain_mm": ("weather", "Rain in the previous hour, mm", "joined on EAT hour; -9999 -> NaN -> "
                "interpolated", "rain pushes people into cars", "yes (forecast)"),
    "rain_3h": ("weather", "Rain over the current and previous 2 hours, mm",
                "rolling 3-hour sum of rain_mm", "people react to rain that has been falling",
                "yes (forecast)"),
    "rain_class": ("weather", "0 none, 1 light (<=2.5), 2 moderate (<=7.5), 3 heavy",
                   "bins of rain_mm", "response to rain may saturate (B2.3)", "yes (forecast)"),
    "humidity_pct": ("weather", "Relative humidity, %", "joined; blanks interpolated",
                     "proxy for rain risk", "yes (forecast)"),
    "wind_kmh": ("weather", "Wind speed, km/h", "joined", "minor comfort effect", "yes (forecast)"),
    # ---- events
    "ev_football_window": ("events", "1 if a confirmed football match window (2 h before start "
                           "to 2 h after end) covers the zone-hour", "interval join",
                           "match crowds arrive and leave by ride", "yes"),
    "ev_concert_window": ("events", "1 inside a confirmed concert window", "interval join",
                          "late-night concert crowds", "yes"),
    "ev_conference_window": ("events", "1 inside a confirmed conference window", "interval join",
                             "business travel to venues", "yes"),
    "ev_exhibition_window": ("events", "1 inside a confirmed exhibition window", "interval join",
                             "multi-day visitor flow", "yes"),
    "ev_road_closure": ("events", "1 during a confirmed road closure", "interval join",
                        "closures can suppress pickups", "yes"),
    "ev_sports_run_window": ("events", "1 inside a confirmed sports run window", "interval join",
                             "mass participation events", "yes"),
    "ev_pre": ("events", "1 in the 2 h before a venue event starts", "phase of window",
               "arrival rush", "yes"),
    "ev_during": ("events", "1 while a venue event runs", "phase of window",
                  "demand often dips while attendees are inside", "yes"),
    "ev_post": ("events", "1 in the 2 h after a venue event ends", "phase of window",
                "the leaving crowd is the biggest surge", "yes"),
    "ev_log_attendance": ("events", "log(1 + expected attendance) of the largest active venue "
                          "event", "free text -> number; blanks -> type median",
                          "bigger crowds, bigger surge", "yes"),
    "ev_hours_to_major_start": ("events", "Hours until the next football/concert start in the "
                                "zone, capped at 12", "searchsorted on event starts",
                                "ramp-up before big events", "yes"),
    "ev_hours_since_major_end": ("events", "Hours since the last football/concert ended in the "
                                 "zone, capped at 12", "searchsorted on event ends",
                                 "post-event surge decays over a few hours", "yes"),
    # ---- lags / trend
    "lag_14d": ("trips (history)", "Trips in the same zone and hour 14 days earlier",
                "shift by 336 h on the zone panel", "recent level including growth", "yes"),
    "lag_21d": ("trips (history)", "Same, 21 days earlier", "shift by 504 h", "robustness", "yes"),
    "lag_28d": ("trips (history)", "Same, 28 days earlier", "shift by 672 h", "robustness", "yes"),
    "lag_mean_2to4w": ("trips (history)", "Mean of lag_14d, lag_21d, lag_28d",
                       "row mean ignoring NaN", "smoother same-hour level", "yes"),
    "profile_zone_dow_hour": ("trips (train fit)", "Mean trips for zone x weekday x hour over "
                              "the training period", "groupby mean on training rows only",
                              "typical shape (seasonal-naive)", "yes"),
    "zone_level_2to4w": ("trips (history)", "Zone mean trips per hour over the 14 days that end "
                         "14 days before the row's day", "daily means, shift 14 d, rolling 14 d",
                         "captures the growth trend that trees cannot extrapolate", "yes"),
}


def data_dictionary(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for c in df.columns:
        src, desc, how, _, known = COLUMNS[c]
        rows.append({"column": c, "dtype": str(df[c].dtype), "source": src,
                     "description": desc, "derivation": how, "known_at_forecast_time": known})
    return pd.DataFrame(rows)


def feature_table(features: list[str]) -> pd.DataFrame:
    rows = []
    for c in features:
        src, desc, how, why, known = COLUMNS[c]
        rows.append({"feature": c, "group": src, "formula": how, "description": desc,
                     "why_it_should_help": why, "known_at_forecast_time": known})
    return pd.DataFrame(rows)
