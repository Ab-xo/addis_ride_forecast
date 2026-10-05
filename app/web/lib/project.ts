// Project facts shown in the sidebar. Every number here is copied from a report produced by the notebooks:
// reports/A_cleaning_and_integration.md (A), reports/B_analysis_report.md (B),
// reports/D_model_evaluation.md (D) and reports/D_stretch_uncertainty.md (stretch).
// Live model metrics (RMSE, MAE, rolling RMSE) come from /api/meta instead.

export const TEAM = [
  { name: "Abraham Gebeyehu", id: "qiyas-2026-004484" },
  { name: "Bethelhem Legesse", id: "qiyas-2026-000286" },
  { name: "Eden Kibret", id: "qiyas-2026-000721" },
  { name: "Eleni Andualem", id: "qiyas-2026-000054" },
  { name: "Feven Abebe", id: "qiyas-2026-003641" },
  { name: "Surafel Solomon", id: "qiyas-2026-007128" },
];

export const DATASETS = [
  { icon: "🚕", name: "Trips (training)", rows: "85,460 rows", span: "1 Jan – 31 Oct 2025", note: "Hourly trips per zone, plus fares, waits and active drivers (history only, never model inputs)." },
  { icon: "🗓️", name: "Forecast grid", rows: "4,032 rows", span: "1 – 14 Nov 2025", note: "12 zones × 24 hours × 14 days. We predict trips for each." },
  { icon: "🌦️", name: "Weather", rows: "7,538 rows", span: "Hourly", note: "Temperature, rain, humidity, wind. Stored in UTC; shifted +3 h to Addis time." },
  { icon: "🎟️", name: "Events calendar", rows: "165 events", span: "8 types", note: "Football, concerts, conferences, holidays, road closures; messy names and dates." },
];

export const PIPELINE = [
  { name: "Clean", text: "28 data problems logged and fixed: ×8 export spikes, −9999 rain codes, a Fahrenheit block, duplicate hours." },
  { name: "Integrate", text: "Weather and events joined to every zone-hour (100% match) after the UTC → EAT clock fix." },
  { name: "Explore", text: "14 analysis questions answered with numbers: trend, rhythm, rain, events, holidays, data quality." },
  { name: "Engineer", text: "36 features known at forecast time: calendar, zone, weather, events, demand history." },
  { name: "Model", text: "10 approaches compared on chronological splits; LightGBM (Poisson) tuned on earlier folds only." },
  { name: "Deliver", text: "4,032 forecasts with 80% / 90% ranges, this dashboard, a report and slides." },
];

export const FINDINGS = [
  { icon: "🕒", value: "0.02 → 0.27", label: "Rain–demand correlation after the +3 h weather clock fix" },
  { icon: "📈", value: "+40%", label: "Demand growth from January to October" },
  { icon: "🌧️", value: "+64%", label: "Demand in heavy rain (most zones)" },
  { icon: "🛒", value: "−42%", label: "Demand in heavy rain at Merkato's open-air market" },
  { icon: "⚽", value: "+127%", label: "Demand in the 2 hours after a football match" },
  { icon: "🚧", value: "−34%", label: "Demand during road closures" },
];

export const MODELS = [
  { name: "Mean predictor", rmse: 27.53, baseline: true },
  { name: "Moving average (7 days)", rmse: 14.55, baseline: true },
  { name: "Ridge regression", rmse: 12.99 },
  { name: "ARIMA (per zone)", rmse: 10.41 },
  { name: "Seasonal naive", rmse: 9.94, baseline: true },
  { name: "Random forest", rmse: 8.79 },
  { name: "Gradient boosting", rmse: 8.63 },
  { name: "HistGradientBoosting", rmse: 8.20 },
  { name: "LightGBM (final)", rmse: 8.09, final: true },
];

export const ABLATION = [
  { name: "+ weather", change: "−8.9%" },
  { name: "+ events", change: "−3.5%" },
  { name: "+ both", change: "−11.7%" },
];

export const LIMITATIONS = [
  { title: "Holiday eves", text: "9 of the 10 biggest misses fall on the eve of a holiday the calendar does not list." },
  { title: "Surges are under-called", text: "The model catches 57% of peak hours; alerting on the top of the 80% range catches 92%." },
  { title: "Synthetic, short history", text: "Ten months of generated data; Ayat only opened on 15 March." },
  { title: "Inputs taken as given", text: "Uses the provided weather forecast; driver supply and pricing are not modelled." },
];
