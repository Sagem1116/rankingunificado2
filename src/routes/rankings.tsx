import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useRankings } from "@/lib/useRankings";
import { rankBy, type RankingEntry } from "@/lib/fm-rankings";

export const Route = createFileRoute("/rankings")({
  head: () => ({
    meta: [
      { title: "Rankings Mundiais — FM World Rankings" },
      { name: "description", content: "Rankings mundiais brutos e ponderados de clubes, treinadores e países." },
    ],
  }),
  component: RankingsPage,
});

function RankingsPage() {
  const { data, isLoading } = useRankings();
  const [mode, setMode] = useState<"weighted" | "raw">("weighted");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A calcular…
      </div>
    );
  }
  if (!data || data.ranks.clubs.length === 0) {
    return <p className="text-muted-foreground">Sem dados. Importe uma época primeiro.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="size-6 text-primary" /> Rankings Mundiais
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Unificados (SuperLeague + Ligas Nacionais + Continentais)</p>
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

      <Tabs defaultValue="clubs">
        <TabsList>
          <TabsTrigger value="clubs">Clubes</TabsTrigger>
          <TabsTrigger value="coaches">Treinadores</TabsTrigger>
          <TabsTrigger value="countries">Países</TabsTrigger>
        </TabsList>
        <TabsContent value="clubs">
          <RankTable entries={rankBy(data.ranks.clubs, mode)} mode={mode} />
        </TabsContent>
        <TabsContent value="coaches">
          <RankTable entries={rankBy(data.ranks.coaches, mode)} mode={mode} />
        </TabsContent>
        <TabsContent value="countries">
          <RankTable entries={rankBy(data.ranks.countries, mode)} mode={mode} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RankTable({ entries, mode }: { entries: RankingEntry[]; mode: "weighted" | "raw" }) {
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
            {entries.map((e, i) => (
              <tr key={e.name} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                <td className={`p-3 font-bold ${i < 3 ? "text-gold" : "text-muted-foreground"}`}>{i + 1}</td>
                <td className="p-3 font-medium">{e.name}</td>
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