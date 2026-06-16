import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Crown, Shield, Users, Globe2, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRankings } from "@/lib/useRankings";
import { rankBy, type RankingEntry } from "@/lib/fm-rankings";

export const Route = createFileRoute("/hall-of-fame")({
  head: () => ({
    meta: [
      { title: "Hall of Fame — FM World Rankings" },
      { name: "description", content: "Os maiores clubes, treinadores e países da história." },
    ],
  }),
  component: HallOfFame,
});

function Podium({ title, icon: Icon, entries, to }: {
  title: string;
  icon: typeof Shield;
  entries: RankingEntry[];
  to: "/clubes/$name" | "/treinadores/$name" | "/paises/$name";
}) {
  const medals = ["text-gold", "text-muted-foreground", "text-amber-700"];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Icon className="size-5 text-primary" /> {title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.slice(0, 10).map((e, i) => (
          <Link
            key={e.name}
            to={to}
            params={{ name: e.name }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/60 transition-colors"
          >
            <span className={`w-6 text-center font-bold ${i < 3 ? medals[i] : "text-muted-foreground"}`}>{i + 1}</span>
            <span className="flex-1 font-medium truncate">{e.name}</span>
            {e.titles > 0 && (
              <span className="text-xs text-gold flex items-center gap-1"><Crown className="size-3" /> {e.titles}</span>
            )}
            <span className="text-sm font-semibold tabular-nums">{Math.round(e.weighted).toLocaleString("pt-PT")}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

function HallOfFame() {
  const { data, isLoading } = useRankings();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A carregar…
      </div>
    );
  }
  if (!data || data.ranks.clubs.length === 0) {
    return <p className="text-muted-foreground">Sem dados. Importe uma época primeiro.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Trophy className="size-6 text-gold" /> Hall of Fame
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Os maiores de sempre, por pontuação ponderada</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Podium title="Clubes" icon={Shield} entries={rankBy(data.ranks.clubs, "weighted")} to="/clubes/$name" />
        <Podium title="Treinadores" icon={Users} entries={rankBy(data.ranks.coaches, "weighted")} to="/treinadores/$name" />
        <Podium title="Países" icon={Globe2} entries={rankBy(data.ranks.countries, "weighted")} to="/paises/$name" />
      </div>
    </div>
  );
}
