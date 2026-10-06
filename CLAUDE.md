# Addis Ride Demand Forecasting — Qiyas AI Hackathon

Full instructions: `docs/ride_demand_instructions.pdf` (read it all before starting).

## Task
Forecast hourly `trips` for 12 Addis Ababa zones for 1–14 Nov 2025 (4,032 rows in
`data/raw/ride_demand_test.csv`) using history 1 Jan – 31 Oct 2025, plus hourly weather
and an events calendar. Fill `submission/team_<NAME>_submission.csv` (row_id, predicted_trips,
original order, no blanks/negatives).

## Data (data/raw — NEVER edit)
- ride_demand_train.csv: record_id, zone, pickup_hour (EAT, mixed formats), trips, avg_fare_birr,
  avg_wait_min, active_drivers (last 3 are NOT forecast-time features).
- ride_demand_test.csv: row_id, zone, pickup_hour (mixed formats incl. ISO with +03:00).
- weather_hourly.csv: timestamp (looks UTC "Z" — PROVE the clock from data, convert to EAT = UTC+3),
  temp_c, rain_mm, humidity_pct, wind_kmh, data_type (observed/forecast). Expect gaps, duplicate
  hours with conflicting values, sentinel codes, unit changes for part of the year.
- events_calendar.csv: intervals; messy zone/event_type spelling, multi-zone / Citywide, mixed date
  formats (day-first dd/mm/yyyy, "Feb 06, 2025 08:00 PM"), missing/inverted ends, free-text
  attendance, status (confirmed/cancelled, inconsistent case).

## Hard rules
- Final model uses ≥1 weather feature and ≥1 event feature.
- Only forecast-time features. Chronological validation only (e.g. train < 18 Oct, validate 18–31 Oct).
- Fit everything (medians, caps, encoders) on train only. Never score on test.
- Every number/figure produced by code in this repo. Relative paths only. random_state=42.
- Python 3.10+, pinned requirements.txt.

## Deliverables (all required) — see PDF Section 4 for full detail
- A (A1–A8): cleaning log, zone/time standardization + timezone proof, join map diagram, join audit,
  join proof (3 zone-hours), feature table (≥8 features), ≥6 PASS/FAIL integrity checks,
  data/processed/master_train.csv, master_test.csv, data_dictionary_master.csv.
- B (B1.1–B4.3): 14 analysis tasks, each with a number/table/chart + 1–2 sentence interpretation.
- C: 12 PNG figures (≥150 dpi, colorblind-safe, exact names fig01_…fig12_…) + figures/figure_captions.md.
- D (D1–D9): baselines (mean, seasonal-naive), ≥3 model families, rolling-origin ≥4 folds,
  leakage audit, ablation (calendar / +weather / +events / +both), tuning, error analysis,
  response to findings, plain-language metric (1.3 trips per driver-hour).
- E: Streamlit app `app/app.py` — input zone + date (1–14 Nov 2025) only; looks up bundled weather
  & events from app/assets/; outputs 24h table + curve, peak hour, drivers needed (trips/1.3),
  gross fares (trips × zone avg fare), lookup summary line, shaded event windows; friendly
  message for out-of-range dates.
- F: presentation/team_<NAME>_slides.pptx (5 slides, ≥2 figures from the pack).
- G: README.md (team, summary, setup/run commands, notebook order, deliverable locations,
  validation score, demo link), requirements.txt, layout per PDF Section 6.
- Stretch (optional): uncertainty intervals or drift memo.

## Layout
README.md, requirements.txt, submission/, data/raw, data/processed, notebooks/01_…04_….ipynb,
src/ (cleaning.py, features.py, train.py, predict.py), models/final_model.joblib, figures/,
reports/A_…, B_…, D_….md, app/ (app.py, requirements.txt, assets/), presentation/.
Lowercase names, no spaces. Exclude venvs, __pycache__, .ipynb_checkpoints, files >100 MB.
