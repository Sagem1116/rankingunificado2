import { createFileRoute } from "@tanstack/react-router";
import { Construction } from "lucide-react";

export const Route = createFileRoute("/hall-of-fame")({
  head: () => ({
    meta: [
      { title: "Hall of Fame — FM World Rankings" },
      { name: "description", content: "Os maiores clubes, treinadores e países da história." },
    ],
  }),
  component: Stub,
});

function Stub() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Construction className="size-10 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-bold">Hall of Fame</h1>
      <p className="text-muted-foreground mt-2 max-w-md">Os maiores clubes, treinadores e países da história. Esta secção chega numa próxima fase.</p>
    </div>
  );
}
