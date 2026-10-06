# Figure captions (team teamdev)

One caption per figure: what it shows and the takeaway. Figures 01-09 are drawn by `notebooks/03_visualizations.ipynb`, figures 10-12 by `notebooks/04_modeling_and_evaluation.ipynb`.

## fig01_gaps_and_missingness.png

Invalid or missing values per column in the three raw files (top; bar = % of rows, label = row count) and missing zone-hours per day (bottom). The dark vertical stripe is the 42-hour platform outage on 12-13 May and the dark block is Ayat before its 15 March launch; the remaining ~56 gaps per zone are scattered, so each gets its own treatment rather than a blanket fill.

## fig02_before_after_cleaning.png

Raw vs cleaned distributions. Left: 353 July temperatures were stored in degF (54-77), creating a second hump that disappears after conversion. Right: on a log scale, a separate cluster of zone-hours at 10-14 trips per driver (normal is ~1.3) is the x8 export error on 125 rows; after dividing by 8 it merges into the main distribution. Without these fixes the model would learn fake heat waves and fake demand spikes.

## fig03_demand_trend_with_holidays.png

Daily trips in the 11 zones open all year, with a 7-day mean and a linear trend. Demand grows steadily (the trend line adds about 10 trips/day every day, +42% from the first to the last 4 weeks), and most holidays show up as one-day dips. So what: November will be busier than any month in the training data, and the model needs a recent-level feature to keep up.

## fig04_hour_by_weekday_heatmap.png

Mean trips per zone-hour by hour and weekday, city-wide and for two contrasting zones. The city shows weekday commute peaks at 08:00 and 18:00; Kazanchis is a pure weekday-office zone that goes quiet at weekends, while Bole is busiest on Friday and Saturday nights and early mornings. So what: hour x weekday x zone interactions carry most of the predictable signal.

## fig05_zone_profiles.png

Mean hourly trips on weekdays and weekends for each zone type (each panel has its own y-axis starting at zero). Business districts lose their commute peaks at the weekend, residential zones barely change, the market is a midday plateau, and nightlife/airport (Bole) is higher at the weekend at almost every hour. So what: one city-wide daily curve would be wrong for every zone type.

## fig06_weather_timezone_check.png

Left: on the raw clock temperature peaks at 12:00, too early for Addis; shifted to EAT it peaks at 15:00. Right: rain only lines up with demand when the weather clock is shifted by exactly +3 h (correlation 0.27 vs 0.04 or less at any other shift). So what: joining on the raw timestamps would have thrown away almost all of the rain signal.

## fig07_rain_effect.png

Demand ratio in light, moderate and heavy rain vs matched dry hours (same zone, weekday, hour, month), by zone type. Rain lifts demand everywhere except the open-air market, and the lift grows with intensity (heavy rain: 1.63x outside the market, 0.58x in Merkato). So what: rain is worth joining, but only with a zone-type interaction.

## fig08_event_study.png

Average demand ratio in the event zone from 6 h before to 8 h after the start (1 = normal hour). Football peaks twice: arrivals (1.8x, 1-2 h before kick-off) and departures (2.5x right after the 2-hour match); concerts peak as the crowd leaves around +5 h (1.9x) and conferences add a smaller morning lift. So what: event features must be split into before/during/after phases, not a single in-event flag.

## fig09_holiday_effects.png

City-wide trips on each holiday relative to the same weekday in nearby weeks. Most weekday holidays cut demand by 10-26% (Good Friday is the deepest at 0.74), while the three Sunday holidays barely move it (Adwa Victory Day even rises to 1.10). So what: a holiday flag helps, but its effect depends on the weekday and (B3.1) the zone.

## fig10_model_comparison.png

Validation RMSE on 18-31 Oct for the baselines (mean, seasonal naive, moving average), six model families (ARIMA, ridge, random forest and three gradient-boosting variants) and the tuned/final LightGBM (bars, from zero), with the rolling-origin mean ± sd over 5 folds (diamonds). The final model (8.09) beats the best baseline (9.94) by 19% and does so in every fold. So what: boosted trees on well-joined features are the right tool here; tuning adds little.

## fig11_forecast_vs_actual.png

Hourly forecasts (model trained up to 17 Oct) against actual trips for three contrasting zones over the full validation fortnight. The model follows the daily and weekly shape in each zone, including Kazanchis' empty weekends and Bole's weekend nights; the misses are the tallest surge peaks, which it under-shoots. So what: plan for the forecast, keep a buffer at known peaks (see the stretch intervals).

## fig12_feature_importance.png

Permutation importance: how much the validation RMSE rises when each feature is shuffled; weather features in blue, event features in orange. The zone x weekday x hour profile dominates (its bar is cut off; it already encodes zone and hour, so those rank lower on their own), but the top weather feature ranks #3 and the top event feature #9. So what: the joins add real, if smaller, signal on top of the calendar.
