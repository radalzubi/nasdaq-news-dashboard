import { Badge } from "@/components/ui/badge";
import type { Bias, Mood } from "@/lib/types";
import { Activity, AlertTriangle, Minus, Shuffle, TrendingDown, TrendingUp } from "lucide-react";

const MOOD: Record<Mood, { tone: "bull" | "bear" | "info" | "caution" | "neutral"; Icon: typeof TrendingUp }> = {
  Bullish: { tone: "bull", Icon: TrendingUp },
  Bearish: { tone: "bear", Icon: TrendingDown },
  Mixed: { tone: "info", Icon: Shuffle },
  Cautious: { tone: "caution", Icon: AlertTriangle },
  Quiet: { tone: "neutral", Icon: Minus },
  Volatile: { tone: "caution", Icon: Activity },
};

export function MoodBadge({ mood }: { mood: Mood }) {
  const { tone, Icon } = MOOD[mood];
  return (
    <Badge tone={tone} className="px-2.5 py-1 text-xs">
      <Icon className="h-3.5 w-3.5" />
      {mood}
    </Badge>
  );
}

const BIAS_TONE: Record<Bias, "bull" | "bear" | "info" | "neutral"> = {
  Bullish: "bull",
  Bearish: "bear",
  Mixed: "info",
  Neutral: "neutral",
};

export function BiasBadge({ bias }: { bias: Bias }) {
  return (
    <Badge tone={BIAS_TONE[bias]} className="text-2xs">
      {bias}
    </Badge>
  );
}
