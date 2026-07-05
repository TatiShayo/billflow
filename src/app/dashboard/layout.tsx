"use client";

import { useAuth } from "@/lib/auth";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  FileText,
  Users,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  Sparkles,
  Loader2,
  ChevronRight,
} from "lucide-react";
import type { SubscriptionTier } from "@/lib/types";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    tiers: ["free", "pro", "business"],
  },
  {
    href: "/dashboard/invoices",
    label: "Invoices",
    icon: FileText,
    tiers: ["free", "pro", "business"],
  },
  {
    href: "/dashboard/clients",
    label: "Clients",
    icon: Users,
    tiers: ["free", "pro", "business"],
  },
  {
    href: "/dashboard/expenses",
    label: "Expenses",
    icon: Receipt,
    tiers: ["business"],
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: BarChart3,
    tiers: ["business"],
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    tiers: ["free", "pro", "business"],
  },
];

const tierLabels: Record<SubscriptionTier, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  const tier = (profile?.subscription_tier || "free") as SubscriptionTier;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-40 flex h-full w-60 flex-col border-r border-border bg-card">
        <div className="flex h-14 items-center border-b border-border px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20">
              <FileText className="h-4 w-4 text-emerald-400" />
            </div>
            <span className="font-bold tracking-tight">BillFlow</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {navItems
            .filter((item) => item.tiers.includes(tier))
            .map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start gap-3 font-normal"
                  >
                    <item.icon
                      className={`h-4 w-4 ${
                        isActive ? "text-emerald-400" : "text-muted-foreground"
                      }`}
                    />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
        </nav>

        <div className="border-t border-border p-3">
          {tier === "free" && (
            <Link href="/dashboard/settings/billing">
              <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400">
                    Upgrade to Pro $8/mo
                  </span>
                </div>
                <p className="mb-2 text-[11px] text-muted-foreground">
                  AI invoice generator, unlimited clients
                </p>
                <ChevronRight className="ml-auto h-3 w-3 text-emerald-400" />
              </div>
            </Link>
          )}

          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium uppercase">
              {(profile?.full_name || user.email || "U").charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">
                {profile?.full_name || "User"}
              </p>
              <Badge
                variant="secondary"
                className="h-4 px-1 text-[10px] font-normal"
              >
                {tierLabels[tier]}
              </Badge>
            </div>
          </div>

          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={signOut}
            size="sm"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-60 flex-1 min-h-screen">{children}</main>
    </div>
  );
}
