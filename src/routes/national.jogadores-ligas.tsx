import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useRankings } from "@/lib/useRankings";
import {
  computeNationalLeagueAggregates,
  listPlayerYears,
  type NationalLeagueAgg,
} from "@/lib/fm-players";
import { SeasonFilter } from "@/components/SeasonFilter";

export const Route = createFileRoute("/national/jogadores-ligas")({
  head: () => ({
    meta: [
      { title: "Jogadores por Liga Nacional — FM World Rankings" },
      {
        name: "description",
        content:
          "Médias de reputação, capacidade, idade, salários e valor agregados por liga nacional.",
      },
    ],
  }),
  component: Page,
});

type Key = keyof Pick<
  NationalLeagueAgg,
  "ra" | "rm" | "ca" | "cp" | "age" | "salary" | "vp" | "n"
>;
const COLS: { key: Key; label: string; money?: boolean }[] = [
  { key: "ra", label: "R.A." },
  { key: "rm", label: "R.M." },
  { key: "ca", label: "C.A." },
  { key: "cp", label: "C.P." },
  { key: "age", label: "Idade" },
  { key: "salary", label: "Salário", money: true },
  { key: "vp", label: "Valor", money: true },
  { key: "n", label: "Nº jog." },
];
const fmt = (n: number) => n.toLocaleString("pt-PT");

function Page() {
  const { data, isLoading } = useRankings();
  const years = useMemo(() => (data ? listPlayerYears(data.data.players) : []), [data]);
  const [year, setYear] = useState<"total" | number>("total");
  const rows = useMemo(
    () =>
      data
        ? computeNationalLeagueAggregates(data.data.players, data.data.standings, year)
        : [],
    [data, year],
  );
  const [sort, setSort] = useState<Key | "league">("ca");
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) =>
        sort === "league" ? a.league.localeCompare(b.league) : b[sort] - a[sort],
      ),
    [rows, sort],
  );

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A calcular…
      </div>
    );
  if (!rows.length)
    return (
      <p className="text-muted-foreground">
        Sem dados de jogadores em ligas nacionais. Importa um ficheiro de Liga Nacional
        com a folha "Jogadores".
      </p>
    );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
            Liga Nacional
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Layers className="size-6 text-primary" /> Jogadores por Liga Nacional
        </h1>
        <p className="text-sm text-muted-foreground max-w-3xl rounded-lg border border-border bg-muted/40 p-3 leading-relaxed">
          Indicadores de jogadores agregados por liga nacional: médias de R.A., R.M., C.A.
          e C.P. (28 melhores por clube), idade média e somas de salários e valor. Filtra
          por época ou vê o agregado total.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filtrar:</span>
        <SeasonFilter value={year} onChange={setYear} years={years} />
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="text-left p-3">
                  <button
                    onClick={() => setSort("league")}
                    className={`hover:text-foreground ${sort === "league" ? "text-foreground" : ""}`}
                  >
                    Liga
                  </button>
                </th>
                {COLS.map((c) => (
                  <th key={c.key} className="text-right p-3">
                    <button
                      onClick={() => setSort(c.key)}
                      className={`hover:text-foreground ${sort === c.key ? "text-foreground" : ""}`}
                    >
                      {c.label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.league} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="p-3 font-medium">{r.league}</td>
                  {COLS.map((c) => (
                    <td key={c.key} className="p-3 text-right tabular-nums">
                      {c.money ? fmt(r[c.key]) : r[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
