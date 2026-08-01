"use client";

import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatIDR } from "@/lib/format";
import { CHART } from "@/lib/chart-colors";

type Datum = { name: string; amount: number };

export function CategoryBarChart({ data }: { data: Datum[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No spending this month yet.
      </p>
    );
  }

  const height = Math.max(140, data.length * 40 + 16);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ left: 8, right: 72, top: 4, bottom: 4 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={104}
          tickLine={false}
          axisLine={false}
          tick={{ fill: CHART.muted, fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
          formatter={(value) => [formatIDR(Number(value)), "Spent"]}
        />
        <Bar dataKey="amount" fill={CHART.single} radius={4} barSize={18}>
          <LabelList
            dataKey="amount"
            position="right"
            fill={CHART.secondary}
            fontSize={11}
            formatter={(value: React.ReactNode) => formatIDR(Number(value))}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
