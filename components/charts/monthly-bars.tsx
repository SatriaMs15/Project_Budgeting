"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatIDR, formatCompactIDR } from "@/lib/format";
import { CHART } from "@/lib/chart-colors";

type Datum = { label: string; income: number; expense: number };

export function MonthlyBarChart({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: CHART.grid }}
          tick={{ fill: CHART.muted, fontSize: 12 }}
        />
        <YAxis
          width={56}
          tickLine={false}
          axisLine={false}
          tick={{ fill: CHART.muted, fontSize: 11 }}
          tickFormatter={(value) => formatCompactIDR(Number(value))}
        />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
          formatter={(value, name) => [formatIDR(Number(value)), name]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey="income"
          name="Income"
          fill={CHART.income}
          radius={[4, 4, 0, 0]}
          maxBarSize={26}
        />
        <Bar
          dataKey="expense"
          name="Expense"
          fill={CHART.expense}
          radius={[4, 4, 0, 0]}
          maxBarSize={26}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
