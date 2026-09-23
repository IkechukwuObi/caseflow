import "./globals.css";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: "CaseFlow — case triage assistant (prototype)",
  description:
    "RAG + MCP prototype that retrieves and triages case documents (loan applications, account openings, disputes), with a lightweight compliance-trigger check.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
