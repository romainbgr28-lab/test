import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/app/components/ui/Toast";

export const metadata: Metadata = {
  title: "StudioAI — Crée des vidéos faceless virales",
  description: "Génère scripts, visuels et voix off pour tes vidéos faceless en quelques clics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
