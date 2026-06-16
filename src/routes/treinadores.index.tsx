import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Users, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRankings } from "@/lib/useRankings";

export const Route = createFileRoute("/treinadores/")({
  head: () => ({
    meta: [
      { title: "Treinadores — FM World Rankings" },
      { name: "description", content: "Perfis de treinadores com histórico de clubes e conquistas." },
    ],
  }),
  component: TreinadoresPage,
});

function TreinadoresPage() {
  const { data, isLoading } = useRankings();
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const coaches = data?.ranks.coaches ?? [];
    const term = q.trim().toLowerCase();
    return term ? coaches.filter((c) => c.name.toLowerCase().includes(term)) : coaches;
  }, [data, q]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A carregar…
      </div>
    );
  }
  if (!data || data.ranks.coaches.length === 0) {
    return <p className="text-muted-foreground">Sem dados. Importe uma época primeiro.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="size-6 text-primary" /> Treinadores
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{data.ranks.coaches.length} treinadores na base de dados</p>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar treinador…" className="pl-9" />
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="text-left p-3 w-12">#</th>
                <th className="text-left p-3">Treinador</th>
                <th className="text-right p-3">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 300).map((e, i) => (
                <tr key={e.name} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <td className={`p-3 font-bold ${i < 3 ? "text-gold" : "text-muted-foreground"}`}>{i + 1}</td>
                  <td className="p-3 font-medium">
                    <Link to="/treinadores/$name" params={{ name: e.name }} className="hover:text-primary hover:underline">
                      {e.name}
                    </Link>
                  </td>
                  <td className="p-3 text-right font-semibold tabular-nums">
                    {Math.round(e.weighted).toLocaleString("pt-PT")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
