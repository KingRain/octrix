import type { Metadata } from "next";
import { Geist, Geist_Mono, Ultra } from "next/font/google";
import "./globals.css";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ultra = Ultra({
  variable: "--font-ultra",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Octrix - Kubernetes Monitoring & Auto-Healing",
  description: "Production-grade Kubernetes cluster monitoring, auto-healing, and simulation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${ultra.variable} antialiased`}
      >
        <SidebarProvider>
          <AppSidebar />
          <main className="flex-1 flex flex-col min-h-screen w-full">
            <Header />
            <div className="flex-1 p-6">
              {children}
            </div>
          </main>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
