import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Job Application Copilot",
  description: "Phase 1 MVP for resume parsing, job matching, and application tracking."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="min-w-0 flex-1 px-6 py-6 lg:px-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
