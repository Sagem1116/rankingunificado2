import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function EvolutionChart({ data }: { data: { year: number; weighted: number; position?: number | null }[] }) {
  if (data.length < 2) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Dados insuficientes para gráfico de evolução.</p>;
  }
  const hasPos = data.some((d) => d.position != null);
  const chartData = data.map((d) => ({ ...d, position: d.position ?? null }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={chartData} margin={{ top: 8, right: hasPos ? 8 : 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="evoFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <YAxis yAxisId="pts" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={50} />
        {hasPos && (
          <YAxis
            yAxisId="pos"
            orientation="right"
            reversed
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            stroke="var(--muted-foreground)"
            width={36}
            domain={[1, "dataMax"]}
          />
        )}
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--foreground)" }}
          formatter={(v: number, name: string) => {
            if (name === "position") return [v ? `#${v}` : "—", "Posição"];
            return [Math.round(v).toLocaleString("pt-PT"), "Pontos"];
          }}
        />
        <Area yAxisId="pts" type="monotone" dataKey="weighted" stroke="var(--primary)" strokeWidth={2} fill="url(#evoFill)" />
        {hasPos && (
          <Line
            yAxisId="pos"
            type="monotone"
            dataKey="position"
            stroke="var(--gold, #d4af37)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--gold, #d4af37)" }}
            connectNulls
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export const MODULE_LABEL: Record<string, string> = {
  superleague: "SuperLeague",
  national: "Liga Nacional",
  continental: "Continental",
};
