import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReadyNeighbor | Practical household preparedness",
  description: "Build a practical emergency checklist and household plan, one calm step at a time.",
  openGraph: { title: "ReadyNeighbor | Small steps. Steadier days.", description: "Practical household preparedness and community resilience.", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
