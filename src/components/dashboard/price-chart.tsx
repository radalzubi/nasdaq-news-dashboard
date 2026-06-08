"use client";

import type { Bar } from "@/lib/types";
import { fmtPrice } from "@/lib/utils";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";

export function PriceChart({
  bars,
  prevClose,
  height = 200,
}: {
  bars: Bar[];
  prevClose?: number | null;
  height?: number;
}) {
  if (!bars.length) {
    return <div className="flex h-40 items-center justify-center text-xs text-faint">No chart data available.</div>;
  }
  const data = bars.map((b) => ({ t: b.t, c: b.c }));
  const first = data[0].c;
  const last = data[data.length - 1].c;
  const up = last >= (prevClose ?? first);
  const color = up ? "hsl(var(--bull))" : "hsl(var(--bear))";
  const lows = Math.min(...data.map((d) => d.c));
  const highs = Math.max(...data.map((d) => d.c));
  const pad = (highs - lows) * 0.08 || 1;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="pc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis domain={[lows - pad, highs + pad]} hide />
        {prevClose ? <ReferenceLine y={prevClose} stroke="hsl(var(--border-strong))" strokeDasharray="3 3" /> : null}
        <Tooltip
          contentStyle={{
            background: "hsl(var(--bg-elevated))",
            border: "1px solid hsl(var(--border-strong))",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          formatter={(v: number) => [fmtPrice(v, true), "Price"]}
        />
        <Area type="monotone" dataKey="c" stroke={color} strokeWidth={1.8} fill="url(#pc)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
