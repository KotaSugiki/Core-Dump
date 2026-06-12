import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Core Dump",
  description: "News aggregator for IT engineers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
