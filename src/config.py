"""Project-wide settings. Change TEAM_NAME here and re-run the notebooks to rename outputs."""
from pathlib import Path

TEAM_NAME = "teamdev"
RANDOM_STATE = 42

# Project root = parent of src/. All paths are relative to it.
ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
FIGURES = ROOT / "figures"
REPORTS = ROOT / "reports"
MODELS = ROOT / "models"
SUBMISSION = ROOT / "submission"
APP_ASSETS = ROOT / "app" / "assets"
PRESENTATION = ROOT / "presentation"

SUBMISSION_FILE = SUBMISSION / f"team_{TEAM_NAME}_submission.csv"
SLIDES_FILE = PRESENTATION / f"team_{TEAM_NAME}_slides.pptx"

LOCAL_TZ = "Africa/Addis_Ababa"  # EAT = UTC+3, no daylight saving

TRAIN_START = "2025-01-01 00:00"
TRAIN_END = "2025-10-31 23:00"
TEST_START = "2025-11-01 00:00"
TEST_END = "2025-11-14 23:00"
VALID_START = "2025-10-18 00:00"  # main chronological split: train < 18 Oct, validate 18-31 Oct

TRIPS_PER_DRIVER_HOUR = 1.3

ZONES = ["Arat Kilo", "Ayat", "Bole", "CMC", "Gerji", "Kazanchis",
         "Kolfe", "Lideta", "Megenagna", "Merkato", "Piassa", "Sarbet"]

EVENT_TYPES = ["public_holiday", "school_break", "football_match", "concert",
               "conference", "exhibition", "road_closure", "sports_run"]

# Hours an event window reaches before the start and after the end (A3 rule).
EVENT_PRE_HOURS = 2
EVENT_POST_HOURS = 2
