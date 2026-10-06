"""Small helpers shared by the notebooks: markdown report writing and figure style."""
from __future__ import annotations

import pandas as pd


INT_LIKE = {"trial", "num_leaves", "n_estimators", "min_child_samples", "hour", "zone_hours", "n_features", "n_train", "n_valid"}


class Report:
    """Collects markdown sections in notebook order and writes them to one file."""

    def __init__(self, title: str):
        self.parts = [f"# {title}\n"]

    def h(self, text: str, level: int = 2):
        self.parts.append(f"\n{'#' * level} {text}\n")

    def p(self, text: str):
        self.parts.append(text.strip() + "\n")

    def table(self, df: pd.DataFrame, index: bool = False, floatfmt: str = ".2f"):
        # Integer columns stay integers (a mixed frame would otherwise print them with decimals).
        df = df.copy()
        for c in df.columns:
            v = df[c]
            if pd.api.types.is_integer_dtype(v) or (pd.api.types.is_float_dtype(v) and v.notna().all() and (v % 1 == 0).all()
                                                     and str(c) in INT_LIKE):
                df[c] = v.astype("int64").astype(object)
        self.parts.append(df.to_markdown(index=index, floatfmt=floatfmt) + "\n")

    def code(self, text: str):
        self.parts.append("```\n" + text.rstrip() + "\n```\n")

    def img(self, rel_path: str, alt: str):
        self.parts.append(f"![{alt}]({rel_path})\n")

    def write(self, path):
        path.write_text("\n".join(self.parts), encoding="utf-8")
        print(f"wrote {path.name} ({sum(len(p) for p in self.parts):,} chars)")
