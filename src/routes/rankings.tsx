import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useRankings } from "@/lib/useRankings";
import { rankBy, computeRankings, type RankingEntry } from "@/lib/fm-rankings";

export const Route = createFileRoute("/rankings")({
  head: () => ({
    meta: [
      { title: "Rankings Mundiais — FM World Rankings" },
      { name: "description", content: "Rankings mundiais brutos e ponderados de clubes, treinadores e países." },
    ],
  }),
  component: RankingsPage,
});

type ModuleFilter = "all" | "superleague" | "national" | "continental";
const MODULE_FILTERS: { value: ModuleFilter; label: string }[] = [
  { value: "all", label: "Unificado" },
  { value: "superleague", label: "SuperLeague" },
  { value: "national", label: "Ligas Nacionais" },
  { value: "continental", label: "Continentais" },
];

function RankingsPage() {
  const { data, isLoading } = useRankings();
  const [mode, setMode] = useState<"weighted" | "raw">("weighted");
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");

  const ranks = useMemo(() => {
    if (!data) return null;
    if (moduleFilter === "all") return data.ranks;
    const d = data.data;
    return computeRankings({
      standings: d.standings.filter((s) => s.module === moduleFilter),
      continental: moduleFilter === "continental" ? d.continental : [],
      coaches: d.coaches.filter((c) => c.module === moduleFilter),
      clubCountry: d.clubCountry,
    });
  }, [data, moduleFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A calcular…
      </div>
    );
  }
  if (!data || data.ranks.clubs.length === 0 || !ranks) {
    return <p className="text-muted-foreground">Sem dados. Importe uma época primeiro.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="size-6 text-primary" /> Rankings Mundiais
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Rankings históricos por competição e unificados</p>
        </div>
        <div className="flex rounded-lg border border-border p-1">
          <Button size="sm" variant={mode === "weighted" ? "default" : "ghost"} onClick={() => setMode("weighted")}>
            Ponderado
          </Button>
          <Button size="sm" variant={mode === "raw" ? "default" : "ghost"} onClick={() => setMode("raw")}>
            Bruto
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {MODULE_FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={moduleFilter === f.value ? "secondary" : "outline"}
            onClick={() => setModuleFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Tabs defaultValue="clubs">
        <TabsList>
          <TabsTrigger value="clubs">Clubes</TabsTrigger>
          <TabsTrigger value="coaches">Treinadores</TabsTrigger>
          <TabsTrigger value="countries">Países</TabsTrigger>
        </TabsList>
        <TabsContent value="clubs">
          <RankTable entries={rankBy(ranks.clubs, mode)} mode={mode} kind="clubes" />
        </TabsContent>
        <TabsContent value="coaches">
          <RankTable entries={rankBy(ranks.coaches, mode)} mode={mode} kind="treinadores" />
        </TabsContent>
        <TabsContent value="countries">
          <RankTable entries={rankBy(ranks.countries, mode)} mode={mode} kind="paises" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RankTable({ entries, mode, kind }: { entries: RankingEntry[]; mode: "weighted" | "raw"; kind: "clubes" | "treinadores" | "paises" }) {
  const to = kind === "clubes" ? "/clubes/$name" : kind === "treinadores" ? "/treinadores/$name" : "/paises/$name";
  return (
    <Card className="mt-4">
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs uppercase">
              <th className="text-left p-3 w-12">#</th>
              <th className="text-left p-3">Nome</th>
              <th className="text-right p-3">Títulos</th>
              <th className="text-right p-3">Pontos</th>
            </tr>
          </thead>
          <tbody>
            {entries.slice(0, 300).map((e, i) => (
              <tr key={e.name} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                <td className={`p-3 font-bold ${i < 3 ? "text-gold" : "text-muted-foreground"}`}>{i + 1}</td>
                <td className="p-3 font-medium">
                  <Link to={to} params={{ name: e.name }} className="hover:text-primary hover:underline">
                    {e.name}
                  </Link>
                </td>
                <td className="p-3 text-right tabular-nums">{e.titles}</td>
                <td className="p-3 text-right font-semibold tabular-nums">
                  {Math.round(mode === "raw" ? e.raw : e.weighted).toLocaleString("pt-PT")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
