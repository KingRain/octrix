import type { Metadata } from "next";
import { Outfit, Ultra } from "next/font/google";
import "./globals.css";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";

const outfit = Outfit({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-outfit",
});

const ultra = Ultra({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-ultra",
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
        className={`${outfit.variable} ${ultra.variable} font-sans antialiased`}
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
