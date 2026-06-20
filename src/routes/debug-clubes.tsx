import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Bug, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRankings } from "@/lib/useRankings";
import { rankBy } from "@/lib/fm-rankings";

export const Route = createFileRoute("/debug-clubes")({
  head: () => ({ meta: [{ title: "Debug · Clubes — FM World Rankings" }] }),
  component: DebugClubes,
});

function DebugClubes() {
  const { data, isLoading } = useRankings();
  if (isLoading || !data) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> A carregar…</div>;
  }

  const { clubCountry, players, standings } = data.data;
  const allClubs = Object.keys(clubCountry);
  const clubsWithoutCountry = allClubs.filter((c) => !clubCountry[c]).sort();

  // Players per club (latest available season for that club)
  const latestYear = players.length ? Math.max(...players.map((p) => p.season_year)) : 0;
  const playersPerClub = new Map<string, number>();
  for (const p of players) {
    if (p.season_year !== latestYear || !p.club_name) continue;
    playersPerClub.set(p.club_name, (playersPerClub.get(p.club_name) ?? 0) + 1);
  }
  const playersPerClubRows = [...playersPerClub.entries()]
    .sort((a, b) => b[1] - a[1]);

  // Clubs that appear in standings/players but missing from clubs table or stats
  const clubsInStandings = new Set(standings.map((s) => s.club_name));
  const ghostClubs = [...clubsInStandings].filter((c) => !(c in clubCountry)).sort();

  const ranked = rankBy(data.ranks.clubs, "weighted");
  const rankedRaw = rankBy(data.ranks.clubs, "raw");
  const rankedTitles = [...data.ranks.clubs].sort((a, b) => b.titles - a.titles);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bug className="size-6 text-primary" /> Debug · Clubes
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Diagnóstico de dados e rankings de clubes</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Clubes (totais)" value={allClubs.length} />
        <Stat label="Sem país" value={clubsWithoutCountry.length} tone={clubsWithoutCountry.length ? "warn" : "ok"} />
        <Stat label="Em standings, fora da tabela 'clubs'" value={ghostClubs.length} tone={ghostClubs.length ? "warn" : "ok"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" /> Clubes sem país associado ({clubsWithoutCountry.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clubsWithoutCountry.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todos os clubes têm país associado.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {clubsWithoutCountry.map((c) => (
                <Link key={c} to="/clubes/$name" params={{ name: c }}>
                  <Badge variant="outline" className="hover:bg-muted">{c}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {ghostClubs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clubes em standings mas ausentes na tabela clubs ({ghostClubs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {ghostClubs.map((c) => <Badge key={c} variant="outline">{c}</Badge>)}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jogadores por clube (época {latestYear || "—"})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[480px]">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border sticky top-0 bg-background">
                <tr>
                  <th className="text-left py-2 pr-3">#</th>
                  <th className="text-left py-2 pr-3">Clube</th>
                  <th className="text-left py-2 pr-3">País</th>
                  <th className="text-right py-2 pr-3">Jogadores</th>
                </tr>
              </thead>
              <tbody>
                {playersPerClubRows.map(([c, n], i) => (
                  <tr key={c} className="border-b border-border/40 hover:bg-muted/40">
                    <td className="py-1.5 pr-3 text-muted-foreground">{i + 1}</td>
                    <td className="py-1.5 pr-3 font-medium">
                      <Link to="/clubes/$name" params={{ name: c }} className="hover:text-primary">{c}</Link>
                    </td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{clubCountry[c] ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <RankCard title="Por pontuação ponderada" rows={ranked.slice(0, 100).map((e) => ({ name: e.name, value: Math.round(e.weighted) }))} />
        <RankCard title="Por pontuação bruta" rows={rankedRaw.slice(0, 100).map((e) => ({ name: e.name, value: Math.round(e.raw) }))} />
        <RankCard title="Por títulos" rows={rankedTitles.slice(0, 100).map((e) => ({ name: e.name, value: e.titles }))} />
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "ok" | "warn" }) {
  const color = tone === "warn" ? "text-warning" : tone === "ok" ? "text-success" : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-6">
        <p className={`text-3xl font-bold tabular-nums ${color}`}>{value.toLocaleString("pt-PT")}</p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function RankCard({ title, rows }: { title: string; rows: { name: string; value: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.name + i} className="border-b border-border/30">
                  <td className="py-1 pr-2 text-muted-foreground w-8">{i + 1}</td>
                  <td className="py-1 pr-2 truncate">
                    <Link to="/clubes/$name" params={{ name: r.name }} className="hover:text-primary">{r.name}</Link>
                  </td>
                  <td className="py-1 text-right tabular-nums font-semibold">{r.value.toLocaleString("pt-PT")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
