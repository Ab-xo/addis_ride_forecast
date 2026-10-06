# Addis Ababa Ride Demand Forecasting

**Team teamdev · Qiyas AI Hackathon #2 · Qiyas / IADE AI Training Program, Addis Ababa University**

Hourly ride-hailing demand forecasts for 12 Addis Ababa zones over 1–14 November 2025, built from trip
history, hourly weather and a city events calendar.

| | |
|---|---|
| **Validation RMSE** | **8.09** trips per zone-hour (18–31 Oct 2025, held out) |
| **Validation MAE** | **5.60** trips per zone-hour |
| **Rolling-origin RMSE** | **8.68 ± 0.80** over 5 folds of 14 days |
| **Best baseline** | 9.94 RMSE (seasonal naive, last 4 weeks) — the final model is 19% better |
| **Final model** | LightGBM, Poisson objective, 36 forecast-time features |
| **Demo** | Runs locally: `streamlit run app/app.py` (see [Demo](#demo)) |

---

## Contents

1. [Team](#team)
2. [Summary](#summary)
3. [Results](#results)
4. [Getting started](#getting-started)
5. [Reproducing the results](#reproducing-the-results)
6. [Demo](#demo)
7. [Repository structure](#repository-structure)
8. [Deliverables](#deliverables)
9. [Methodology](#methodology)
10. [Compliance with the hackathon rules](#compliance-with-the-hackathon-rules)

---

## Team

| Name | Student ID |
|---|---|
| Abraham Gebeyehu | qiyas-2026-004484 |
| Bethelhem Legesse | qiyas-2026-000286 |
| Eden Kibret | qiyas-2026-000721 |
| Eleni Andualem | qiyas-2026-000054 |
| Feven Abebe | qiyas-2026-003641 |
| Surafel Solomon | qiyas-2026-007128 |

---

## Summary

We combined three raw exports — ten months of hourly trips per zone, an hourly weather table and an
events calendar — into a single hourly zone grid, fixing 28 documented data problems along the way. These
include a Fahrenheit block in the weather data, `-9999` rain sentinels, 125 trip records exported at eight
times their true value, and duplicate, inverted and inconsistently spelled event rows.

The most important finding came before any join: the weather export is on **UTC**, while the trips are
on Addis Ababa time (EAT, UTC+3). We proved this from the data. The first forecast row is stamped 21:00
on 31 October, which is midnight on 1 November in Addis, and shifting the weather clock by +3 hours
raises the rain-to-demand correlation from 0.02 to 0.27.

On the joined data, rain lifts demand by up to 63% in every zone type except the open-air Merkato
market, where it falls by 42%. Events move demand in distinct waves: football demand reaches 1.8× an hour
before kick-off and 2.5× right after the final whistle. The model therefore uses rain with a zone-type
interaction, and event features split into before, during and after phases.

The final LightGBM model scores an RMSE of 8.09 on a held-out fortnight. That is about 5.6 trips — roughly
four drivers — off per zone-hour, against an average demand of 33 trips.

---

## Results

All scores are on chronological splits of the training file; the test file is never scored. Full
results are in [`reports/D_model_evaluation.md`](reports/D_model_evaluation.md).

| Model | RMSE (18–31 Oct) | MAE | Rolling-origin RMSE (5 folds) |
|---|---:|---:|---:|
| Mean predictor (baseline) | 27.53 | 20.69 | — |
| Moving average, last 7 days (baseline) | 14.55 | 9.49 | 15.09 |
| Seasonal naive, last 4 weeks (baseline) | 9.94 | 6.64 | 11.48 |
| Ridge regression | 12.99 | 7.80 | 13.95 |
| ARIMA, one per zone | 10.41 | 6.86 | 11.52 |
| Random forest | 8.79 | 5.97 | 9.60 |
| Gradient boosting (scikit-learn) | 8.63 | 5.92 | 9.16 |
| HistGradientBoosting | 8.20 | 5.65 | 8.99 |
| **LightGBM, tuned + holiday-eve feature (final)** | **8.09** | **5.60** | **8.68** |

**What each data source adds.** Rolling-origin ablation of the final model type: adding weather lowers
RMSE by 0.88 (−8.9%), adding events by 0.35 (−3.5%), and both together by 1.16 (−11.7%).

**Uncertainty (stretch goal).** Every forecast hour comes with an 80% and a 90% prediction interval. When
calibrated on 4–17 October and tested on 18–31 October, they covered 79.8% and 89.6% of actual hours. See
[`reports/D_stretch_uncertainty.md`](reports/D_stretch_uncertainty.md).

---

## Getting started

**Requirements:** Python 3.10 or newer (developed and tested on Python 3.13).

```bash
git clone https://github.com/EleniAndualem/hackathon.git
cd hackathon

python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

All package versions are pinned in [`requirements.txt`](requirements.txt).

---

## Reproducing the results

Run the four notebooks in order, then the two scripts. Each step writes the inputs the next step reads,
so the order matters.

```bash
cd notebooks
jupyter nbconvert --to notebook --execute --inplace 01_cleaning_and_integration.ipynb
jupyter nbconvert --to notebook --execute --inplace 02_analysis_report.ipynb
jupyter nbconvert --to notebook --execute --inplace 03_visualizations.ipynb
jupyter nbconvert --to notebook --execute --inplace 04_modeling_and_evaluation.ipynb
cd ..

python -m src.predict        # writes the submission file and the prediction intervals
python -m src.app_assets     # refreshes the lookup tables bundled with the demo app
```

| Step | Produces | Approx. time |
|---|---|---|
| `01_cleaning_and_integration.ipynb` | Deliverable A: cleaning log, timezone proof, join map and audit, join proof, feature table, 18 integrity checks, master tables and data dictionary | 2 min |
| `02_analysis_report.ipynb` | Deliverable B: all 14 analysis tasks | 2 min |
| `03_visualizations.ipynb` | Deliverable C: figures 1–9 and their captions | 1 min |
| `04_modeling_and_evaluation.ipynb` | Deliverable D: baselines, model comparison, rolling-origin validation, leakage audit, ablation, tuning, error analysis, figures 10–12, and the final model | 20 min |
| `python -m src.predict` | Submission file, prediction intervals, uncertainty report | < 1 min |
| `python -m src.app_assets` | Lookup tables in `app/assets/` | < 1 min |

Every number, table and figure in this repository is produced by this code. All paths are relative to
the repository root, and `random_state` is fixed at 42 throughout.

---

## Demo

The demo runs locally with one command:

```bash
streamlit run app/app.py
```

It then opens at <http://localhost:8501>. There is no hosted URL; the demo is run live from a laptop, as
the instructions allow.

**Inputs.** A zone and a date between 1 and 14 November 2025 — nothing else.

**What the app does.** It looks up the weather forecast and any events for that zone and day from the
cleaned tables in `app/assets/`, so the user never types in weather or event information. It then shows:

- the 24-hour forecast as a table and as a curve, with the 80% range shaded;
- the zone's usual day for comparison, with event windows shaded;
- the peak hour;
- the drivers needed each hour (forecast trips ÷ 1.3 trips per driver-hour);
- the expected gross fares (forecast trips × the zone's average fare from the history);
- a summary line of what was looked up, for example *"9–24 °C; no rain forecast; Road race at Meskel
  Square 06:00–11:00; Football match at Addis Ababa Stadium 15:00–17:00"*.

Dates outside 1–14 November get a friendly message instead of an error. A link such as
`http://localhost:8501/?zone=Kazanchis&date=2025-11-09` opens the app on that zone and day.

---

## Repository structure

```
hackathon/
├── README.md
├── requirements.txt                    pinned package versions
├── submission/
│   ├── team_teamdev_submission.csv     the scored file (row_id, predicted_trips)
│   └── team_teamdev_prediction_intervals.csv
├── data/
│   ├── raw/                            the five original CSVs, never edited
│   └── processed/
│       ├── master_train.csv
│       ├── master_test.csv
│       ├── data_dictionary_master.csv
│       └── weather_clean.csv, events_clean.csv, zone_types.csv
├── notebooks/
│   ├── 01_cleaning_and_integration.ipynb
│   ├── 02_analysis_report.ipynb
│   ├── 03_visualizations.ipynb
│   └── 04_modeling_and_evaluation.ipynb
├── src/
│   ├── cleaning.py                     parsing, standardisation, cleaning of all three tables
│   ├── features.py                     joins, feature engineering, integrity checks
│   ├── train.py                        baselines, models, fold-safe validation
│   ├── predict.py                      submission file and prediction intervals
│   ├── app_assets.py                   builds the demo's lookup tables
│   └── config.py, analysis.py, dictionary.py, plotstyle.py, nbtools.py
├── models/
│   ├── final_model.joblib              trained model, feature list and validation scores
│   └── final_model_params.json
├── figures/
│   ├── fig01_gaps_and_missingness.png … fig12_feature_importance.png
│   └── figure_captions.md
├── reports/
│   ├── A_cleaning_and_integration.md   (+ A1_cleaning_log.csv, a3_join_map.png)
│   ├── B_analysis_report.md
│   ├── D_model_evaluation.md           (+ D_permutation_importance.csv)
│   └── D_stretch_uncertainty.md
├── app/
│   ├── app.py
│   ├── requirements.txt
│   └── assets/                         cleaned weather, events, zone fares, typical profiles, model
└── presentation/
    └── team_teamdev_slides.pptx
```

---

## Deliverables

| Deliverable | Contents | Location |
|---|---|---|
| **Prediction file** | 4,032 forecasts in the original row order | [`submission/team_teamdev_submission.csv`](submission/team_teamdev_submission.csv) |
| **A — Cleaning & integration** | A1–A8: cleaning log, key and time standardisation with the timezone proof, join map, join audit, join proof, feature table, integrity checks, master tables | [`reports/A_cleaning_and_integration.md`](reports/A_cleaning_and_integration.md), [`notebooks/01_…`](notebooks/01_cleaning_and_integration.ipynb), [`data/processed/`](data/processed) |
| **B — Data analysis** | B1.1–B4.3: all 14 tasks, each with a result and an interpretation | [`reports/B_analysis_report.md`](reports/B_analysis_report.md), [`notebooks/02_…`](notebooks/02_analysis_report.ipynb) |
| **C — Visualisation pack** | 12 figures (150 dpi, colourblind-safe palette) with captions | [`figures/`](figures), [`figures/figure_captions.md`](figures/figure_captions.md), [`notebooks/03_…`](notebooks/03_visualizations.ipynb) |
| **D — Modelling & evaluation** | D1–D9: baselines, comparison of six model families, rolling-origin validation, leakage audit, ablation, tuning, error analysis, response to findings, plain-language metric | [`reports/D_model_evaluation.md`](reports/D_model_evaluation.md), [`notebooks/04_…`](notebooks/04_modeling_and_evaluation.ipynb), [`models/`](models) |
| **E — Demo** | Streamlit app with bundled lookup tables | [`app/`](app) |
| **F — Presentation** | 5 slides, using 4 figures from the pack | [`presentation/team_teamdev_slides.pptx`](presentation/team_teamdev_slides.pptx) |
| **G — Structure & reproducibility** | This README, pinned requirements, the layout above | repository root |
| **Stretch — Uncertainty** | 80% and 90% interval per zone-hour, with guidance for operations | [`reports/D_stretch_uncertainty.md`](reports/D_stretch_uncertainty.md), [`submission/team_teamdev_prediction_intervals.csv`](submission/team_teamdev_prediction_intervals.csv) |

---

## Methodology

**Data cleaning.** Zone names and event types are mapped to one canonical spelling. Every timestamp
format is parsed explicitly and checked for day-first versus month-first errors. Sentinel values,
the Fahrenheit block, export spikes and duplicate hours are all corrected, and each fix is recorded in
the cleaning log with the number of rows affected and the reason.

**Integration.** The zone × hour grid is the left table, so every forecast hour keeps exactly one row.
Weather joins many-to-one on the hour after the UTC → EAT shift; duplicate weather hours are averaged
first so the row count cannot change. Events join as intervals: a venue event's window opens 2 hours
before it starts and closes 3 hours after it ends. Holidays, school breaks and road closures use their
own dates.

**Features.** 36 features, all known before the forecast fortnight begins:

- **Calendar:** hour, weekday, weekend, month, payday window, public holiday, holiday eve, school break,
  trend.
- **Zone:** zone and zone type.
- **Weather:** temperature, rain, rain over the last 3 hours, rain class, humidity, wind.
- **Events:** in-window flags by event type, before/during/after phase, attendance, hours to the next
  major event and since the last one.
- **History:** lags of at least 14 days and a recent zone × weekday × hour profile.

**Modelling.** Two baselines and six model families are compared on the same chronological split.
LightGBM with a Poisson objective wins: demand is a count, and its variance grows with its level. The
hyperparameters come from a 16-trial random search on the four earlier rolling folds, so the main
validation fortnight never influenced tuning. Error analysis showed that most of the largest misses fell
on holiday eves, which led to the holiday-eve feature in the final model.

---

## Compliance with the hackathon rules

| Rule | How it is met |
|---|---|
| Weather and event features in the final model | 6 weather and 12 event features are model inputs; the ablation measures what each adds. |
| Forecast-time features only | `active_drivers`, `avg_wait_min` and `avg_fare_birr` are excluded, and every lag is at least 14 days old. The D4 leakage audit shows the inflated score a leaky model would have reported. |
| Chronological validation only | A held-out fortnight plus five rolling-origin folds. A random split appears only as a labelled contrast. |
| Nothing fitted on the test file | Medians, caps, encoders, zone types and profiles are fitted on training rows only, and re-fitted inside each validation fold. |
| Reproducibility | Pinned requirements, relative paths, `random_state = 42`, and notebooks that run top to bottom. |
| Raw data untouched | `data/raw/` is read-only; all cleaned outputs go to `data/processed/`. |

All data in this project is synthetic and was provided for training purposes by the hackathon organisers.
