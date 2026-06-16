import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2, Users, ArrowLeft, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRankings } from "@/lib/useRankings";
import { buildCoachProfile } from "@/lib/fm-profiles";
import { EvolutionChart, MODULE_LABEL } from "@/components/EvolutionChart";

export const Route = createFileRoute("/treinadores/$name")({
  component: CoachProfilePage,
});

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function CoachProfilePage() {
  const { name } = Route.useParams();
  const { data, isLoading } = useRankings();
  const profile = useMemo(() => (data ? buildCoachProfile(data.data, name, data.config) : null), [data, name]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A carregar…
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="space-y-4">
        <Link to="/treinadores" className="text-sm text-primary inline-flex items-center gap-1"><ArrowLeft className="size-4" /> Treinadores</Link>
        <p className="text-muted-foreground">Treinador não encontrado: {name}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/treinadores" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-4" /> Todos os treinadores
      </Link>
      <div className="flex items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
          <Users className="size-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Pontos" value={Math.round(profile.totalWeighted).toLocaleString("pt-PT")} />
        <Stat label="Títulos" value={profile.titles} />
        <Stat label="Épocas" value={profile.seasonsCount} />
        <Stat label="Clubes" value={profile.clubs.length} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Evolução histórica</CardTitle></CardHeader>
        <CardContent><EvolutionChart data={profile.chart} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de épocas</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="text-left p-3">Época</th>
                <th className="text-left p-3">Competição</th>
                <th className="text-left p-3">Clube</th>
                <th className="text-right p-3">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {profile.seasons.map((s, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="p-3">{s.year}</td>
                  <td className="p-3">{MODULE_LABEL[s.module]}</td>
                  <td className="p-3">
                    {s.club_name ? (
                      <Link to="/clubes/$name" params={{ name: s.club_name }} className="hover:text-primary hover:underline">
                        {s.club_name}
                      </Link>
                    ) : "—"}
                    {s.champion && <Crown className="size-3 inline ml-1 text-gold" />}
                  </td>
                  <td className="p-3 text-right tabular-nums">{Math.round(s.weighted).toLocaleString("pt-PT")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
