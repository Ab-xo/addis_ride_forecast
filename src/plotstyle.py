"""One visual style for every figure in the pack (validated colorblind-safe categorical order)."""
import matplotlib as mpl
import matplotlib.pyplot as plt

from src import config

# Categorical order (light-mode reference palette; adjacent pairs pass CVD dE >= 8).
SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"]
INK = "#0b0b0b"
INK_2 = "#52514e"
GRID = "#e4e3df"
SURFACE = "#fcfcfb"
NEUTRAL = "#8a8984"
SEQ_CMAP = "Blues"  # sequential: one hue, light -> dark

ZONE_TYPE_COLORS = {
    "business_district": SERIES[0], "residential": SERIES[1], "transport_hub": SERIES[2],
    "market": SERIES[3], "nightlife_airport": SERIES[4],
}
ZONE_TYPE_LABELS = {
    "business_district": "Business district", "residential": "Residential",
    "transport_hub": "Transport hub", "market": "Market", "nightlife_airport": "Nightlife / airport",
}


def apply():
    mpl.rcParams.update({
        "figure.dpi": 100, "savefig.dpi": 150, "figure.facecolor": SURFACE,
        "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
        "font.size": 12, "axes.titlesize": 14, "axes.titleweight": "bold",
        "axes.labelsize": 12, "xtick.labelsize": 10.5, "ytick.labelsize": 10.5,
        "legend.fontsize": 10.5, "legend.frameon": False,
        "axes.edgecolor": INK_2, "axes.labelcolor": INK, "text.color": INK,
        "xtick.color": INK_2, "ytick.color": INK_2,
        "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.8,
        "axes.spines.top": False, "axes.spines.right": False, "axes.axisbelow": True,
        "axes.prop_cycle": mpl.cycler(color=SERIES), "lines.linewidth": 2,
    })


def save(fig, name: str):
    path = config.FIGURES / name
    fig.savefig(path, dpi=150, bbox_inches="tight")
    w, h = fig.get_size_inches() * 150
    print(f"saved {name} ({int(w)}x{int(h)} px at 150 dpi)")
    plt.close(fig)
    return path
