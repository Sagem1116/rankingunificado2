import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Trophy, FileSpreadsheet, FileText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useRankings } from "@/lib/useRankings";
import { rankBy, computeRankings } from "@/lib/fm-rankings";
import { exportRankingsExcel, exportRankingsPDF, type ExportSection } from "@/lib/fm-export";
import type { ComputeResult } from "@/lib/fm-rankings";
import { SeasonsRankTable } from "@/components/SeasonsRankTable";

function buildSections(ranks: ComputeResult, mode: "weighted" | "raw"): ExportSection[] {
  return [
    { title: "Clubes", entries: rankBy(ranks.clubs, mode), mode },
    { title: "Treinadores", entries: rankBy(ranks.coaches, mode), mode },
    { title: "Paises", entries: rankBy(ranks.countries, mode), mode },
  ];
}

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
    // Continental wins are stored as a separate dataset (no "continental" coach assignments
    // exist — coaches are imported as national/superleague). To attribute continental
    // titles to coaches we must keep ALL coach assignments and only restrict standings.
    const isContinental = moduleFilter === "continental";
    return computeRankings(
      {
        standings: isContinental ? [] : d.standings.filter((s) => s.module === moduleFilter),
        continental: isContinental ? d.continental : [],
        coaches: isContinental ? d.coaches : d.coaches.filter((c) => c.module === moduleFilter),
        clubCountry: d.clubCountry,
      },
      data.config,
    );
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
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportRankingsExcel(buildSections(ranks, mode))}>
            <FileSpreadsheet className="size-4" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportRankingsPDF(buildSections(ranks, mode), "FM World Rankings")}>
            <FileText className="size-4" /> PDF
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
          <SeasonsRankTable entries={ranks.clubs} evolution={ranks.evolution.clubs} years={ranks.years} mode={mode} kind="clubes" />
        </TabsContent>
        <TabsContent value="coaches">
          <SeasonsRankTable entries={ranks.coaches} evolution={ranks.evolution.coaches} years={ranks.years} mode={mode} kind="treinadores" />
        </TabsContent>
        <TabsContent value="countries">
          <SeasonsRankTable entries={ranks.countries} evolution={ranks.evolution.countries} years={ranks.years} mode={mode} kind="paises" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

