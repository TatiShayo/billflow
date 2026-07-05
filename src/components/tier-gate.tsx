"use client";

import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, ArrowRight } from "lucide-react";
import { TIER_LIMITS, type SubscriptionTier } from "@/lib/types";

interface TierGateProps {
  requiredTier: keyof typeof TIER_LIMITS;
  feature: string;
  children: React.ReactNode;
}

export function TierGate({ requiredTier, feature, children }: TierGateProps) {
  const { profile } = useAuth();
  const tier = (profile?.subscription_tier || "free") as SubscriptionTier;

  const tierRank = { free: 0, pro: 1, business: 2 };
  const requiredRank = tierRank[requiredTier];

  if (tierRank[tier] >= requiredRank) {
    return <>{children}</>;
  }

  const upgradeLabel =
    requiredTier === "pro" ? "Pro" : requiredTier === "business" ? "Business" : "Pro";

  return (
    <div className="flex items-center justify-center min-h-[50vh] p-6">
      <Card className="max-w-md w-full">
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10">
            <Sparkles className="h-7 w-7 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold mb-2">{feature}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Upgrade to the {upgradeLabel} plan to unlock {feature.toLowerCase()}
            {requiredTier === "business" ? ", plus custom branding and client portal" : ""}.
          </p>
          <Link href="/dashboard/settings?tab=billing">
            <Button className="bg-emerald-600 hover:bg-emerald-500 gap-2">
              Upgrade to {upgradeLabel}{" "}
              {requiredTier === "pro" ? "$8/mo" : "$16/mo"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
