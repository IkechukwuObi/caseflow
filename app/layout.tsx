import "./globals.css";

export const metadata = {
  title: "CaseFlow — case triage assistant (prototype)",
  description:
    "RAG + MCP prototype that retrieves and triages case documents (loan applications, account openings, disputes), with a lightweight compliance-trigger check.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
