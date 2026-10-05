"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Meta } from "@/lib/api";
import AppNav from "@/components/app-nav";
import AboutSections, { ABOUT_SECTIONS } from "@/components/about-sections";

export default function AboutPage() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => setMeta(null));
    setQuery(window.location.search);
    try { setCollapsed(localStorage.getItem("nav-collapsed") === "1"); } catch {}
  }, []);
  const toggleCollapsed = useCallback(() => setCollapsed((c) => {
    try { localStorage.setItem("nav-collapsed", c ? "0" : "1"); } catch {}
    return !c;
  }), []);

  return (
    <div className="bg-grid flex min-h-screen">
      <AppNav meta={meta} active="about" query={query} collapsed={collapsed} mobileOpen={mobileNav}
              onCollapse={toggleCollapsed} onCloseMobile={() => setMobileNav(false)} />
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-white/[.06] bg-ink-950/75 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3.5 md:px-7">
            <button onClick={() => setMobileNav(true)} aria-label="Open menu"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 lg:hidden">☰</button>
            <div className="min-w-0 leading-tight">
              <h1 className="truncate text-[19px] font-bold tracking-tight text-white">About This Project</h1>
              <div className="truncate text-[12px] font-medium text-slate-500">Team {meta?.team ?? "teamdev"} · Qiyas Data Science &amp; AI Hackathon</div>
            </div>
            <a href={`/${query}`} className="ml-auto shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-[12px] font-semibold text-orange-200 hover:bg-accent/20">
              ← Back to dashboard
            </a>
          </div>
          <nav className="scrollbar-thin flex gap-1 overflow-x-auto px-4 pb-2.5 md:px-7" aria-label="Sections">
            {ABOUT_SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`}
                 className="shrink-0 rounded-lg px-2.5 py-1 text-[12.5px] font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white">{s.label}</a>
            ))}
          </nav>
        </header>
        <div className="px-4 py-5 md:px-7">
          <AboutSections meta={meta} />
        </div>
      </main>
    </div>
  );
}
