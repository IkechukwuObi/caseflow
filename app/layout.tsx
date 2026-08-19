import "./globals.css";

export const metadata = {
  title: "RegLens — SA financial compliance assistant (prototype)",
  description:
    "RAG + MCP prototype answering South African FICA/SARB/POPIA compliance questions with cited sources.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
