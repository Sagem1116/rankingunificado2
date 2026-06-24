import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Trophy, FileSpreadsheet, FileText, Info, ChevronDown, Globe2, Filter, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useRankings } from "@/lib/useRankings";
import { rankBy, computeRankings, computeInternationalRankings } from "@/lib/fm-rankings";
import { exportRankingsExcel, exportRankingsPDF, type ExportSection } from "@/lib/fm-export";
import type { ComputeResult } from "@/lib/fm-rankings";
import { SeasonsRankTable, type ExtraCol } from "@/components/SeasonsRankTable";
import {
  computeClubChampions,
  computeClubPlayoffs,
  computeCoachChampions,
  computeCoachPlayoffs,
} from "@/lib/fm-superleague";

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

type ModuleFilter = "all" | "superleague" | "national" | "continental" | "international";
const MODULE_FILTERS: { value: ModuleFilter; label: string }[] = [
  { value: "all", label: "Unificado" },
  { value: "superleague", label: "SuperLeague" },
  { value: "national", label: "Ligas Nacionais" },
  { value: "continental", label: "Continentais" },
  { value: "international", label: "Internacional" },
];

function RankingLegend() {
  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="inline-flex items-center gap-2 h-auto py-1.5">
          <Info className="size-4 text-primary" />
          <span>Como são calculados os pontos</span>
          <ChevronDown className="size-4 opacity-60 group-data-[state=open]:rotate-180 transition-transform" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="bg-muted/40 border-dashed mt-2">
          <div className="p-4 text-sm space-y-2 text-muted-foreground">
            <p>
              <strong className="text-foreground">Pontos brutos</strong> — soma dos pontos base de cada posição, pontos conquistados nas ligas, bónus de campeão e pontos de títulos continentais.
            </p>
            <p>
              <strong className="text-foreground">Pontos ponderados</strong> — pontos brutos multiplicados por vários fatores:
            </p>
            <ul className="list-disc ml-5 space-y-1">
              <li>
                <strong>Peso da competição</strong> — SuperLeague, Ligas Nacionais e Continentais têm pesos diferentes.
              </li>
              <li>
                <strong>Peso da divisão/liga</strong> — divisões mais altas da SuperLeague e ligas nacionais configuradas valem mais.
              </li>
              <li>
                <strong>Desvalorização por época</strong> — épocas mais recentes têm multiplicador maior; resultados antigos perdem peso progressivamente.
              </li>
            </ul>
            <p>
              O total e a ordenação respeitam o modo ativo ({""}
              <span className="text-foreground font-medium">Bruto</span> ou{" "}
              <span className="text-foreground font-medium">Ponderado</span>). Altera estes pesos em{" "}
              <Link to="/configuracao" className="underline hover:text-foreground">
                Configurações
              </Link>
              .
            </p>
          </div>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}

function RankingsPage() {
  const { data, isLoading } = useRankings();
  const [mode, setMode] = useState<"weighted" | "raw">("weighted");
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("all");

  // Internacional filters
  const [intlComp, setIntlComp] = useState<string>("all");
  const [intlTeam, setIntlTeam] = useState<string>("");
  const [intlCoach, setIntlCoach] = useState<string>("");
  const [intlYear, setIntlYear] = useState<string>("all");

  const intlOptions = useMemo(() => {
    const rows = data?.data.international ?? [];
    const comps = new Set<string>();
    const years = new Set<number>();
    for (const r of rows) {
      if (r.competition) comps.add(r.competition);
      if (r.season_year) years.add(r.season_year);
    }
    return {
      competitions: [...comps].sort(),
      years: [...years].sort((a, b) => b - a),
    };
  }, [data]);

  const intlFilteredRows = useMemo(() => {
    const rows = data?.data.international ?? [];
    const team = intlTeam.trim().toLowerCase();
    const coach = intlCoach.trim().toLowerCase();
    return rows.filter((r) => {
      if (intlComp !== "all" && r.competition !== intlComp) return false;
      if (intlYear !== "all" && String(r.season_year) !== intlYear) return false;
      if (team) {
        const t1 = (r.team1 ?? "").toLowerCase();
        const t2 = (r.team2 ?? "").toLowerCase();
        if (!t1.includes(team) && !t2.includes(team)) return false;
      }
      if (coach) {
        const c1 = (r.coach1 ?? "").toLowerCase();
        const c2 = (r.coach2 ?? "").toLowerCase();
        if (!c1.includes(coach) && !c2.includes(coach)) return false;
      }
      return true;
    });
  }, [data, intlComp, intlTeam, intlCoach, intlYear]);

  const ranks = useMemo(() => {
    if (!data) return null;
    if (moduleFilter === "international") return null; // handled separately below
    if (moduleFilter === "all") return data.ranks;
    const d = data.data;
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

  const intlRanks = useMemo(() => {
    if (!data || moduleFilter !== "international") return null;
    return computeInternationalRankings(intlFilteredRows, data.config);
  }, [data, moduleFilter, intlFilteredRows]);


  const clubNac = useMemo<Record<string, string | null>>(
    () => data?.data.clubCountry ?? {},
    [data],
  );
  const coachNac = useMemo<Record<string, string | null>>(() => {
    const m: Record<string, string | null> = {};
    for (const c of data?.data.coaches ?? []) {
      if (c.nationality && !m[c.name]) m[c.name] = c.nationality;
    }
    return m;
  }, [data]);

  const slExtras = useMemo(() => {
    if (!data || moduleFilter !== "superleague") return null;
    const slSt = data.data.standings.filter((s) => s.module === "superleague");
    const clubsCh = computeClubChampions(slSt);
    const clubsPo = computeClubPlayoffs(slSt);
    const coachesCh = computeCoachChampions(slSt, data.data.coaches);
    const coachesPo = computeCoachPlayoffs(slSt, data.data.coaches);
    const num = <T extends { name: string }>(rows: T[], pick: (r: T) => number) => {
      const m: Record<string, number> = {};
      for (const r of rows) m[r.name] = pick(r);
      return m;
    };
    const tip = <T extends { name: string }>(rows: T[], pick: (r: T) => string) => {
      const m: Record<string, string> = {};
      for (const r of rows) { const t = pick(r); if (t) m[r.name] = t; }
      return m;
    };
    const clubCols: ExtraCol[] = [
      { key: "promo", label: "Promovido", values: num(clubsCh, (r) => r.p), tips: tip(clubsCh, (r) => r.tipP) },
      { key: "despro", label: "Despromovido", values: num(clubsCh, (r) => r.d), tips: tip(clubsCh, (r) => r.tipD) },
      { key: "qsub", label: "Quase Subida", values: num(clubsPo, (r) => r.quaseSubida), tips: tip(clubsPo, (r) => r.tipQS) },
      { key: "qtit", label: "Quase Título", values: num(clubsPo, (r) => r.quaseTitulo), tips: tip(clubsPo, (r) => r.tipQT) },
    ];
    const coachCols: ExtraCol[] = [
      { key: "promo", label: "Promovido", values: num(coachesCh, (r) => r.p), tips: tip(coachesCh, (r) => r.tipP) },
      { key: "despro", label: "Despromovido", values: num(coachesCh, (r) => r.d), tips: tip(coachesCh, (r) => r.tipD) },
      { key: "qsub", label: "Quase Subida", values: num(coachesPo, (r) => r.quaseSubida), tips: tip(coachesPo, (r) => r.tipQS) },
      { key: "qtit", label: "Quase Título", values: num(coachesPo, (r) => r.quaseTitulo), tips: tip(coachesPo, (r) => r.tipQT) },
    ];
    return { clubCols, coachCols };
  }, [data, moduleFilter]);



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
  if (moduleFilter !== "international" && !ranks) {
    return <p className="text-muted-foreground">Sem dados para este filtro.</p>;
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
          {ranks && (
            <>
              <Button size="sm" variant="outline" onClick={() => exportRankingsExcel(buildSections(ranks, mode))}>
                <FileSpreadsheet className="size-4" /> Excel
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportRankingsPDF(buildSections(ranks, mode), "FM World Rankings")}>
                <FileText className="size-4" /> PDF
              </Button>
            </>
          )}
        </div>
      </div>

      <RankingLegend />

      {moduleFilter === "international" ? (
        <>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium">
              <Filter className="size-4 text-primary" /> Filtros
              {(intlComp !== "all" || intlYear !== "all" || intlTeam || intlCoach) && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-auto py-1"
                  onClick={() => { setIntlComp("all"); setIntlYear("all"); setIntlTeam(""); setIntlCoach(""); }}
                >
                  <X className="size-3.5" /> Limpar
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Competição</Label>
                <Select value={intlComp} onValueChange={setIntlComp}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {intlOptions.competitions.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Época</Label>
                <Select value={intlYear} onValueChange={setIntlYear}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {intlOptions.years.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Equipa / Seleção</Label>
                <Input value={intlTeam} onChange={(e) => setIntlTeam(e.target.value)} placeholder="ex: Portugal" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Treinador</Label>
                <Input value={intlCoach} onChange={(e) => setIntlCoach(e.target.value)} placeholder="ex: Martínez" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {intlFilteredRows.length} jogo(s) correspondem aos filtros.
            </p>
          </Card>

          {intlRanks && (intlRanks.countries.length > 0 || intlRanks.coaches.length > 0) ? (
            <Tabs defaultValue="countries">
              <TabsList>
                <TabsTrigger value="countries"><Globe2 className="size-3.5 mr-1" /> Seleções</TabsTrigger>
                <TabsTrigger value="coaches">Treinadores</TabsTrigger>
              </TabsList>
              <TabsContent value="countries">
                <SeasonsRankTable
                  entries={intlRanks.countries}
                  evolution={intlRanks.evolution.countries}
                  years={intlRanks.years}
                  mode={mode}
                  kind="paises"
                  breakdown={intlRanks.breakdown.countries}
                />
              </TabsContent>
              <TabsContent value="coaches">
                <SeasonsRankTable
                  entries={intlRanks.coaches}
                  evolution={intlRanks.evolution.coaches}
                  years={intlRanks.years}
                  mode={mode}
                  kind="treinadores"
                  breakdown={intlRanks.breakdown.coaches}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              {(data?.data.international?.length ?? 0) === 0
                ? <>Sem dados de competições internacionais. Importa um ficheiro de Ligas Nacionais que inclua a folha <em>Compts Seleções</em>.</>
                : "Nenhum resultado para os filtros selecionados."}
            </Card>
          )}
        </>

      ) : (
        ranks && (
          <Tabs defaultValue="clubs">
            <TabsList>
              <TabsTrigger value="clubs">Clubes</TabsTrigger>
              <TabsTrigger value="coaches">Treinadores</TabsTrigger>
              <TabsTrigger value="countries">Países</TabsTrigger>
            </TabsList>
            <TabsContent value="clubs">
              <SeasonsRankTable
                entries={ranks.clubs}
                evolution={ranks.evolution.clubs}
                years={ranks.years}
                mode={mode}
                kind="clubes"
                breakdown={ranks.breakdown.clubs}
                nacMap={clubNac}
                extraCols={slExtras?.clubCols}
              />
            </TabsContent>
            <TabsContent value="coaches">
              <SeasonsRankTable
                entries={ranks.coaches}
                evolution={ranks.evolution.coaches}
                years={ranks.years}
                mode={mode}
                kind="treinadores"
                breakdown={ranks.breakdown.coaches}
                nacMap={coachNac}
                extraCols={slExtras?.coachCols}
              />
            </TabsContent>
            <TabsContent value="countries">
              <SeasonsRankTable entries={ranks.countries} evolution={ranks.evolution.countries} years={ranks.years} mode={mode} kind="paises" breakdown={ranks.breakdown.countries} />
            </TabsContent>
          </Tabs>
        )
      )}
    </div>
  );
}

