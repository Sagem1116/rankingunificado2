import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GitCompareArrows, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRankings } from "@/lib/useRankings";
import { buildClubProfile, buildCoachProfile, buildCountryProfile, type ChartPoint } from "@/lib/fm-profiles";
import { EvolutionChart, type ChartMode, type EvoSeries } from "@/components/EvolutionChart";

export const Route = createFileRoute("/comparar")({
  head: () => ({
    meta: [
      { title: "Comparar — FM World Rankings" },
      { name: "description", content: "Compara lado a lado clubes, treinadores ou países e a sua evolução histórica." },
    ],
  }),
  component: CompararPage,
});

type Kind = "clubes" | "treinadores" | "paises";

function Stat({ label, a, b }: { label: string; a: string | number; b: string | number }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 border-b border-border/50 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right tabular-nums font-medium">{a}</span>
      <span className="text-right tabular-nums font-medium">{b}</span>
    </div>
  );
}

function CompararPage() {
  const { data, isLoading } = useRankings();
  const [kind, setKind] = useState<Kind>("clubes");
  const [a, setA] = useState<string>("");
  const [b, setB] = useState<string>("");
  const [mode, setMode] = useState<ChartMode>("weighted");

  const options = useMemo(() => {
    if (!data) return [] as string[];
    if (kind === "clubes") return data.ranks.clubs.map((c) => c.name);
    if (kind === "treinadores") return data.ranks.coaches.map((c) => c.name);
    return data.ranks.countries.map((c) => c.name);
  }, [data, kind]);

  const build = (name: string): { chart: ChartPoint[]; stats: { label: string; value: string | number }[] } | null => {
    if (!data || !name) return null;
    if (kind === "clubes") {
      const p = buildClubProfile(data.data, name, data.config);
      if (!p) return null;
      return {
        chart: p.chart,
        stats: [
          { label: "Pontos ponderados", value: Math.round(p.totalWeighted).toLocaleString("pt-PT") },
          { label: "Pontos brutos", value: Math.round(p.totalRaw).toLocaleString("pt-PT") },
          { label: "Títulos", value: p.titles },
          { label: "Épocas", value: p.seasonsCount },
          { label: "Melhor posição", value: p.bestPosition ?? "—" },
        ],
      };
    }
    if (kind === "treinadores") {
      const p = buildCoachProfile(data.data, name, data.config);
      if (!p) return null;
      return {
        chart: p.chart,
        stats: [
          { label: "Pontos ponderados", value: Math.round(p.totalWeighted).toLocaleString("pt-PT") },
          { label: "Pontos brutos", value: Math.round(p.totalRaw).toLocaleString("pt-PT") },
          { label: "Títulos", value: p.titles },
          { label: "Épocas", value: p.seasonsCount },
          { label: "Clubes", value: p.clubs.length },
        ],
      };
    }
    const p = buildCountryProfile(data.data, name, data.config);
    if (!p) return null;
    return {
      chart: p.chart,
      stats: [
        { label: "Pontos ponderados", value: Math.round(p.totalWeighted).toLocaleString("pt-PT") },
        { label: "Pontos brutos", value: Math.round(p.totalRaw).toLocaleString("pt-PT") },
        { label: "Títulos", value: p.titles },
        { label: "Épocas ativas", value: p.seasonsActive },
        { label: "Clubes", value: p.clubs.length },
      ],
    };
  };

  const pa = useMemo(() => build(a), [a, kind, data]); // eslint-disable-line react-hooks/exhaustive-deps
  const pb = useMemo(() => build(b), [b, kind, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const series: EvoSeries[] = [];
  if (pa) series.push({ name: a, data: pa.chart });
  if (pb) series.push({ name: b, data: pb.chart });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A carregar…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <GitCompareArrows className="size-6 text-primary" /> Comparar
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Compara dois clubes, treinadores ou países lado a lado.</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <Tabs value={kind} onValueChange={(v) => { setKind(v as Kind); setA(""); setB(""); }}>
            <TabsList>
              <TabsTrigger value="clubes">Clubes</TabsTrigger>
              <TabsTrigger value="treinadores">Treinadores</TabsTrigger>
              <TabsTrigger value="paises">Países</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Entidade A</Label>
              <Select value={a} onValueChange={setA}>
                <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {options.filter((n) => n !== b).map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Entidade B</Label>
              <Select value={b} onValueChange={setB}>
                <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {options.filter((n) => n !== a).map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {pa && pb && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução comparada</CardTitle>
            </CardHeader>
            <CardContent>
              <EvolutionChart series={series} mode={mode} onModeChange={setMode} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estatísticas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 pb-2 border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <span></span>
                <span className="text-right">{a}</span>
                <span className="text-right">{b}</span>
              </div>
              {pa.stats.map((row, i) => (
                <Stat key={row.label} label={row.label} a={row.value} b={pb.stats[i]?.value ?? "—"} />
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {(!pa || !pb) && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Seleciona duas entidades para iniciar a comparação.
        </p>
      )}
    </div>
  );
}
