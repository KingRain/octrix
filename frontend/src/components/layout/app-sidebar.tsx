"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Shield,
  FlaskConical,
  Settings,
  AlertTriangle,
  DollarSign,
  Loader2,
  Server,
  PieChart,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useBackendStatus } from "@/hooks/use-backend-status";

const navItems = [
  {
    title: "Overview",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Nodes",
    href: "/nodes",
    icon: Server,
  },
  {
    title: "Incidents",
    href: "/incidents",
    icon: AlertTriangle,
  },
  {
    title: "AutoHealing",
    href: "/healing",
    icon: Shield,
  },
  {
    title: "Cost & Efficiency",
    href: "/costs",
    icon: DollarSign,
  },
  {
    title: "Operational Cost Risk",
    href: "/cost-allocation",
    icon: PieChart,
  },
  {
    title: "Simulator",
    href: "/simulation",
    icon: FlaskConical,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { isConnected, isLoading, prometheusConnected, usingMockData } =
    useBackendStatus();

  const getStatusColor = () => {
    if (isLoading) return "bg-yellow-500 animate-pulse";
    if (!isConnected) return "bg-red-500";
    if (!prometheusConnected) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStatusText = () => {
    if (isLoading) return "Connecting...";
    if (!isConnected) return "Backend Offline";
    if (!prometheusConnected) return "Mock Data Mode";
    return "Connected";
  };

  const getStatusSubtext = () => {
    if (isLoading) return "Checking connection";
    if (!isConnected) return "Cannot reach backend";
    if (usingMockData) return "Prometheus unavailable";
    return "All services online";
  };

  return (
    <Sidebar className="border-r border-border bg-white">
      <SidebarHeader className="border-b border-border px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <LayoutDashboard className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold tracking-tight">Octrix</span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    className={cn(
                      "w-full justify-start gap-4 px-5 py-4",
                      pathname === item.href &&
                        "bg-accent text-accent-foreground",
                    )}
                  >
                    <Link href={item.href}>
                      <item.icon className="h-6 w-6" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
          ) : (
            <div className={cn("h-2 w-2 rounded-full", getStatusColor())} />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium">{getStatusText()}</p>
            <p className="text-xs text-muted-foreground">
              {getStatusSubtext()}
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
