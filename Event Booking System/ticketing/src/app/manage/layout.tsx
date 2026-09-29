import { Inter, DM_Serif_Display } from "next/font/google";
import { ReactNode } from "react";

const inter = Inter({ subsets: ["latin"], variable: "--font-eventpro-sans" });
const dmSerif = DM_Serif_Display({ subsets: ["latin"], weight: "400", variable: "--font-eventpro-serif" });

export default function ManageLayout({ children }: { children: ReactNode }) {
  return <div className={`${inter.variable} ${dmSerif.variable} eventpro-scope`}>{children}</div>;
}
