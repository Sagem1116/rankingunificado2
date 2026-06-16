import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/clubes")({
  head: () => ({
    meta: [
      { title: "Clubes — FM World Rankings" },
      { name: "description", content: "Perfis detalhados de cada clube com histórico e estatísticas." },
    ],
  }),
  component: Stub,
});

function Stub() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Construction className="size-10 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-bold">Clubes</h1>
      <p className="text-muted-foreground mt-2 max-w-md">Perfis detalhados de cada clube com histórico e estatísticas. Esta secção chega numa próxima fase.</p>
    </div>
  );
}
