"""Small helpers shared by the notebooks: markdown report writing and figure style."""
from __future__ import annotations

import pandas as pd


class Report:
    """Collects markdown sections in notebook order and writes them to one file."""

    def __init__(self, title: str):
        self.parts = [f"# {title}\n"]

    def h(self, text: str, level: int = 2):
        self.parts.append(f"\n{'#' * level} {text}\n")

    def p(self, text: str):
        self.parts.append(text.strip() + "\n")

    def table(self, df: pd.DataFrame, index: bool = False, floatfmt: str = ".2f"):
        self.parts.append(df.to_markdown(index=index, floatfmt=floatfmt) + "\n")

    def code(self, text: str):
        self.parts.append("```\n" + text.rstrip() + "\n```\n")

    def img(self, rel_path: str, alt: str):
        self.parts.append(f"![{alt}]({rel_path})\n")

    def write(self, path):
        path.write_text("\n".join(self.parts), encoding="utf-8")
        print(f"wrote {path.name} ({sum(len(p) for p in self.parts):,} chars)")
