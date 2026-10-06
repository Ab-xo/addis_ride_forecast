# Addis Ababa ride demand forecasting — team teamdev

**Qiyas AI Hackathon.** Forecasting hourly ride demand for 12 Addis Ababa zones over 1–14 November 2025.

Team **teamdev** — Dina (Eleni Andualem).

## Summary

We rebuilt the three raw tables into one hourly zone grid, fixed 28 data problems along the way (a
Fahrenheit block in the weather file, `-9999` rain sentinels, 125 trip rows exported at 8× their true value,
duplicate and inverted event rows) and proved from the data itself that the weather export is on UTC while
the trips are on Addis time — the forecast rows begin at 21:00 on 31 October, which is midnight on 1
November locally, and shifting the clock by +3 h takes the rain-to-demand correlation from 0.02 to 0.27.
On the joined table, rain lifts demand by up to 63% everywhere except the open-air Merkato market, where
it falls by 42%, and events move demand in waves (football is 1.8× an hour before kick-off and 2.5× right
after the whistle), so weather carries a zone-type interaction and events are split into before / during /
after phases. The final model is LightGBM with a Poisson objective on 36 forecast-time features, validated
chronologically only. It scores **RMSE 8.09** on the held-out fortnight of 18–31 October against 9.94 for
the best baseline, and **8.68 ± 0.80** averaged over five rolling 14-day folds — about 5.6 trips, or roughly
4 drivers, off per zone-hour. Every number, table and figure in this repository is produced by the code in
it.

**Validation score: RMSE 8.09, MAE 5.60 (18–31 Oct 2025); rolling-origin RMSE 8.68 ± 0.80 over 5 folds.**

## Setup

Python 3.10 or newer (built and tested on 3.13).

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Run order

Run the notebooks in order from the `notebooks/` folder; each one writes the inputs the next one reads.

```bash
cd notebooks
jupyter nbconvert --to notebook --execute --inplace 01_cleaning_and_integration.ipynb
jupyter nbconvert --to notebook --execute --inplace 02_analysis_report.ipynb
jupyter nbconvert --to notebook --execute --inplace 03_visualizations.ipynb
jupyter nbconvert --to notebook --execute --inplace 04_modeling_and_evaluation.ipynb
cd ..
python -m src.predict        # submission file + prediction intervals
python -m src.app_assets     # lookup tables bundled with the demo app
```

| Notebook | What it produces |
|---|---|
| `01_cleaning_and_integration.ipynb` | Deliverable A: the cleaning log, the timezone proof, the join map and audit, the feature table, 18 integrity checks, and `data/processed/master_train.csv`, `master_test.csv`, `data_dictionary_master.csv` |
| `02_analysis_report.ipynb` | Deliverable B: the 14 analysis tasks, each with a number or table and an interpretation |
| `03_visualizations.ipynb` | Deliverable C: figures 1–9 and their captions |
| `04_modeling_and_evaluation.ipynb` | Deliverable D: baselines, six model families, rolling-origin validation, the leakage audit, the ablation, tuning, error analysis, figures 10–12, and `models/final_model.joblib` |

Expect about 10 minutes for notebook 04 (it fits every model family on five folds and runs a 16-trial
search); the other three take a couple of minutes each. Every path in the code is relative to the
repository root, and `random_state` is fixed at 42 throughout.

## Demo

The demo runs locally — one command, no hosting needed:

```bash
streamlit run app/app.py
```

Pick a zone and a date in 1–14 November 2025, and nothing else. The app looks up the weather forecast and
any events for that zone and day from the tables in `app/assets/`, then returns the 24-hour forecast as a
table and a curve (with the 80% range shaded, the zone's usual day behind it and event windows shaded in
blue), the peak hour, the drivers needed each hour (trips ÷ 1.3) and the expected gross fares, plus a line
saying exactly what was looked up. A `?zone=Kazanchis&date=2025-11-09` link opens it on that zone and day.
Dates outside the fortnight get a friendly message rather than an error.

## Where each deliverable lives

| Deliverable | Location |
|---|---|
| A — Cleaning and integration | `reports/A_cleaning_and_integration.md`, `reports/A1_cleaning_log.csv`, `reports/a3_join_map.png`, `data/processed/` |
| B — Data analysis | `reports/B_analysis_report.md` |
| C — Visualization pack | `figures/fig01…fig12*.png`, `figures/figure_captions.md` |
| D — Modeling and evaluation | `reports/D_model_evaluation.md`, `reports/D_permutation_importance.csv`, `models/final_model.joblib` |
| E — Demo app | `app/app.py`, `app/assets/`, `app/requirements.txt` |
| F — Slides | `presentation/team_teamdev_slides.pptx` |
| G — Structure and reproducibility | this README, `requirements.txt`, the layout below |
| Submission | `submission/team_teamdev_submission.csv` (4,032 rows: `row_id`, `predicted_trips`) |
| Stretch — uncertainty | `reports/D_stretch_uncertainty.md`, `submission/team_teamdev_prediction_intervals.csv` |

## Layout

```
README.md  requirements.txt
data/raw/              the three source files, never edited
data/processed/        master_train.csv, master_test.csv, data_dictionary_master.csv, cleaned weather & events
notebooks/             01_… 04_…  (run in this order)
src/                   cleaning.py  features.py  train.py  predict.py  (+ config, analysis, plotstyle, dictionary,
                       nbtools, app_assets)
models/                final_model.joblib, final_model_params.json
figures/               fig01…fig12 + figure_captions.md
reports/               A_…, B_…, D_… markdown reports
app/                   app.py, requirements.txt, assets/
presentation/          team_teamdev_slides.pptx
submission/            team_teamdev_submission.csv, team_teamdev_prediction_intervals.csv
```

## Method hygiene

- The final model uses 6 weather features and 12 event features (Rule 5).
- Only features known before the fortnight begins; `active_drivers`, `avg_wait_min` and `avg_fare_birr` are
  excluded, and all lags are at least 14 days old (Rule 6). The leakage audit in `reports/D_model_evaluation.md`
  shows what adding the forbidden columns would have done.
- Validation is chronological only: a held-out fortnight plus five rolling-origin folds. Medians, caps,
  encoders and the zone profile are re-fitted inside each fold on its training rows alone (Rules 7 and 8).
- Nothing is ever fitted on, or scored against, the test file.
