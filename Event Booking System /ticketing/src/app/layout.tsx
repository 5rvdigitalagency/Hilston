import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hilston Park Tickets",
  description: "Event ticketing and operations for Hilston Park.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
