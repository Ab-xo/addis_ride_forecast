import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Addis Ride Demand · Forecast",
  description: "Hourly ride-hailing demand forecasts and driver planning for 12 Addis Ababa zones, 1–14 November 2025. Team teamdev, Qiyas Data Science & AI Hackathon.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-ink-950 font-sans">{children}</body>
    </html>
  );
}
