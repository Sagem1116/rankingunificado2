import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/paises")({
  head: () => ({
    meta: [
      { title: "Países — FM World Rankings" },
      { name: "description", content: "Perfis de países com clubes contribuintes e títulos." },
    ],
  }),
  component: Stub,
});

function Stub() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Construction className="size-10 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-bold">Países</h1>
      <p className="text-muted-foreground mt-2 max-w-md">Perfis de países com clubes contribuintes e títulos. Esta secção chega numa próxima fase.</p>
    </div>
  );
}
