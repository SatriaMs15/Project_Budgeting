"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatIDR } from "@/lib/format";
import { CHART } from "@/lib/chart-colors";

type Datum = { label: string; income: number; expense: number };

/**
 * Six-month income vs expense.
 *
 * Deliberately spare: no gridlines, no y-axis, a single hairline baseline and
 * thin square-cornered bars. The rounded-pill bars a chart library gives you
 * by default would read as UI chrome rather than as marks on a ledger page.
 */
export function MonthlyBarChart({ data }: { data: Datum[] }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={186}>
        <BarChart
          data={data}
          margin={{ left: 0, right: 0, top: 4, bottom: 0 }}
          barGap={3}
        >
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: CHART.grid }}
            tick={{ fill: CHART.muted, fontSize: 11.5 }}
            dy={6}
          />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: "color-mix(in srgb, #201f1d 4%, transparent)" }}
            contentStyle={{
              background: "#eae9e9",
              border: "1px solid #d7d3d3",
              borderRadius: 4,
              fontSize: 12,
            }}
            labelStyle={{ color: CHART.secondary }}
            formatter={(value, name) => [formatIDR(Number(value)), name]}
          />
          <Bar
            dataKey="income"
            name="Income"
            fill={CHART.income}
            barSize={15}
            radius={[1, 1, 0, 0]}
            isAnimationActive={false}
          />
          <Bar
            dataKey="expense"
            name="Expense"
            fill={CHART.expense}
            barSize={15}
            radius={[1, 1, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Swatch legend sits under the plot, in body type, not chart chrome. */}
      <div className="mt-4 flex gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ backgroundColor: CHART.income }}
          />
          Income
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ backgroundColor: CHART.expense }}
          />
          Expense
        </span>
      </div>
    </div>
  );
}
