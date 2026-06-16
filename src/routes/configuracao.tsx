import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/configuracao")({
  head: () => ({
    meta: [
      { title: "Configuração — FM World Rankings" },
      { name: "description", content: "Pesos de competições, divisões, títulos e fórmula mundial editáveis." },
    ],
  }),
  component: Stub,
});

function Stub() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Construction className="size-10 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-bold">Configuração</h1>
      <p className="text-muted-foreground mt-2 max-w-md">Pesos de competições, divisões, títulos e fórmula mundial editáveis. Esta secção chega numa próxima fase.</p>
    </div>
  );
}
