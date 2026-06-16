import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function EvolutionChart({ data }: { data: { year: number; weighted: number }[] }) {
  if (data.length < 2) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Dados insuficientes para gráfico de evolução.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="evoFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
        <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={50} />
        <Tooltip
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--foreground)" }}
          formatter={(v: number) => [Math.round(v).toLocaleString("pt-PT"), "Pontos"]}
        />
        <Area type="monotone" dataKey="weighted" stroke="var(--primary)" strokeWidth={2} fill="url(#evoFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export const MODULE_LABEL: Record<string, string> = {
  superleague: "SuperLeague",
  national: "Liga Nacional",
  continental: "Continental",
};