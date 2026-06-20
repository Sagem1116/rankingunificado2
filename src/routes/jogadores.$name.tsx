import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Loader2, User, ArrowLeft, Goal, Handshake } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useRankings } from "@/lib/useRankings";
import { buildPlayerProfile } from "@/lib/fm-players";

export const Route = createFileRoute("/jogadores/$name")({
  component: PlayerProfilePage,
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

function divisionText(h: { module: string | null; division: number | null; divisionLabel: string | null; league: string | null }) {
  if (h.module === "superleague" && h.division) return `Super League · Div. ${h.division}`;
  if (h.module === "national" && h.divisionLabel) return `Liga Nacional · ${h.divisionLabel}`;
  if (h.league) return h.league;
  return "—";
}

function PlayerProfilePage() {
  const { name } = Route.useParams();
  const { data, isLoading } = useRankings();
  const profile = useMemo(
    () => (data ? buildPlayerProfile(data.data.players, data.data.standings, name) : null),
    [data, name],
  );

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
        <Link to="/hall-of-fame" className="text-sm text-primary inline-flex items-center gap-1">
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <p className="text-muted-foreground">Jogador não encontrado: {name}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/hall-of-fame" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-4" /> Hall of Fame
      </Link>
      <div className="flex items-center gap-4">
        <div className="flex size-14 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
          <User className="size-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
          <p className="text-xs text-muted-foreground">
            {profile.idu ? `UID: ${profile.idu}` : "Sem UID (chave por nome+clube)"}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Épocas" value={profile.totals.seasons} />
        <Stat label="Golos" value={profile.totals.gls.toLocaleString("pt-PT")} />
        <Stat label="Assistências" value={profile.totals.ast.toLocaleString("pt-PT")} />
        <Stat label="G + A" value={(profile.totals.gls + profile.totals.ast).toLocaleString("pt-PT")} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="text-left p-3">Época</th>
                <th className="text-left p-3">Clube</th>
                <th className="text-left p-3">Divisão / Liga</th>
                <th className="text-right p-3">Idade</th>
                <th className="text-right p-3"><Goal className="inline size-3" /> Gls</th>
                <th className="text-right p-3"><Handshake className="inline size-3" /> Ast</th>
                <th className="text-right p-3">C.A.</th>
                <th className="text-right p-3">C.P.</th>
                <th className="text-right p-3">R.A.</th>
                <th className="text-right p-3">R.M.</th>
              </tr>
            </thead>
            <tbody>
              {profile.history.map((h) => (
                <tr key={h.year} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="p-3 font-semibold tabular-nums">{h.year}</td>
                  <td className="p-3 font-medium">
                    {h.club ? (
                      <Link to="/clubes/$name" params={{ name: h.club }} className="hover:text-primary hover:underline">
                        {h.club}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="p-3 text-muted-foreground">{divisionText(h)}</td>
                  <td className="p-3 text-right tabular-nums">{h.age ?? "—"}</td>
                  <td className="p-3 text-right tabular-nums">{h.gls}</td>
                  <td className="p-3 text-right tabular-nums">{h.ast}</td>
                  <td className="p-3 text-right tabular-nums">{h.ca}</td>
                  <td className="p-3 text-right tabular-nums">{h.cp}</td>
                  <td className="p-3 text-right tabular-nums">{h.ra}</td>
                  <td className="p-3 text-right tabular-nums">{h.rm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
