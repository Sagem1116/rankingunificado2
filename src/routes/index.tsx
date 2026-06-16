import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Shield, Users, Globe2, Trophy, UploadCloud, Loader2, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRankings } from "@/lib/useRankings";
import type { RankingEntry } from "@/lib/fm-rankings";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — FM World Rankings" },
      { name: "description", content: "Melhor Clube, Treinador e País do Mundo no Football Manager." },
      { property: "og:title", content: "FM World Rankings — Dashboard" },
      { property: "og:description", content: "Os melhores do mundo do Football Manager ao longo das épocas." },
    ],
  }),
  component: Index,
});

function Index() {
  const { data, isLoading } = useRankings();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A calcular rankings…
      </div>
    );
  }

  const seasons = data?.data.seasons ?? [];
  const hasData = seasons.length > 0 && (data?.ranks.clubs.length ?? 0) > 0;

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)] mb-5">
          <Trophy className="size-8" />
        </div>
        <h1 className="text-2xl font-bold">Bem-vindo ao FM World Rankings</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          Importe a sua primeira época de Football Manager para começar a gerar rankings mundiais de clubes, treinadores e países.
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link to="/importar">
            <UploadCloud className="size-4" /> Importar primeira época
          </Link>
        </Button>
      </div>
    );
  }

  const bestClub = data!.ranks.clubs[0];
  const bestCoach = data!.ranks.coaches[0];
  const bestCountry = data!.ranks.countries[0];
  const years = seasons.map((s) => s.year);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Mundial</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {seasons.length} época{seasons.length > 1 ? "s" : ""} analisada{seasons.length > 1 ? "s" : ""}: {Math.min(...years)}–{Math.max(...years)}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/rankings">
            <Trophy className="size-4" /> Ver rankings completos
          </Link>
        </Button>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <BestCard title="Melhor Clube do Mundo" icon={Shield} entry={bestClub} accent />
        <BestCard title="Melhor Treinador do Mundo" icon={Users} entry={bestCoach} />
        <BestCard title="Melhor País do Mundo" icon={Globe2} entry={bestCountry} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <TopList title="Top Clubes" icon={Shield} entries={data!.ranks.clubs} />
        <TopList title="Top Treinadores" icon={Users} entries={data!.ranks.coaches} />
        <TopList title="Top Países" icon={Globe2} entries={data!.ranks.countries} />
      </div>
    </div>
  );
}

function BestCard({
  title,
  icon: Icon,
  entry,
  accent,
}: {
  title: string;
  icon: typeof Shield;
  entry?: RankingEntry;
  accent?: boolean;
}) {
  return (
    <Card className={accent ? "relative overflow-hidden border-primary/40" : "relative overflow-hidden"}>
      {accent && <div className="absolute inset-0 bg-[image:var(--gradient-primary)] opacity-[0.08]" />}
      <CardHeader className="relative">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Icon className="size-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="relative">
        <div className="flex items-center gap-2">
          <Crown className="size-5 text-gold" />
          <span className="text-xl font-bold truncate">{entry?.name ?? "—"}</span>
        </div>
        <div className="mt-3 flex gap-4 text-sm">
          <div>
            <p className="font-bold">{Math.round(entry?.weighted ?? 0).toLocaleString("pt-PT")}</p>
            <p className="text-xs text-muted-foreground">Pontos ponderados</p>
          </div>
          <div>
            <p className="font-bold">{entry?.titles ?? 0}</p>
            <p className="text-xs text-muted-foreground">Títulos</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TopList({ title, icon: Icon, entries }: { title: string; icon: typeof Shield; entries: RankingEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="size-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {entries.slice(0, 8).map((e, i) => (
          <div key={e.name} className="flex items-center gap-3 py-1.5 text-sm border-b border-border/50 last:border-0">
            <span className={`w-5 text-center font-bold ${i < 3 ? "text-gold" : "text-muted-foreground"}`}>{i + 1}</span>
            <span className="flex-1 truncate">{e.name}</span>
            <span className="font-semibold tabular-nums">{Math.round(e.weighted).toLocaleString("pt-PT")}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
