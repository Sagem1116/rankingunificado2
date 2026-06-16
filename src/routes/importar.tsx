import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UploadCloud, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { parseWorkbook, type ParseResult, type Severity } from "@/lib/fm-parser";
import { importSeason } from "@/lib/fm-db";

export const Route = createFileRoute("/importar")({
  head: () => ({
    meta: [
      { title: "Importar Época — FM World Rankings" },
      { name: "description", content: "Importe ficheiros Excel do Football Manager para uma nova época." },
    ],
  }),
  component: ImportPage,
});

interface FileEntry {
  file: File;
  parse: ParseResult;
}

const SEV_ICON: Record<Severity, typeof CheckCircle2> = {
  green: CheckCircle2,
  yellow: AlertTriangle,
  red: XCircle,
};
const SEV_CLASS: Record<Severity, string> = {
  green: "text-success",
  yellow: "text-warning",
  red: "text-destructive",
};

function ImportPage() {
  const qc = useQueryClient();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter((f) => /\.xlsx?$/i.test(f.name));
    if (!arr.length) {
      toast.error("Selecione ficheiros Excel (.xlsx)");
      return;
    }
    const parsed: FileEntry[] = [];
    for (const file of arr) {
      const buf = await file.arrayBuffer();
      parsed.push({ file, parse: parseWorkbook(buf, file.name) });
    }
    setEntries((prev) => {
      const byName = new Map(prev.map((e) => [e.file.name, e]));
      parsed.forEach((p) => byName.set(p.file.name, p));
      return [...byName.values()];
    });
  }

  const anyBlocked = entries.some((e) => e.parse.blocked);
  const canImport = entries.length > 0 && !anyBlocked && year > 1900 && !importing;

  async function runImport() {
    setImporting(true);
    try {
      for (const e of entries) {
        if (e.parse.blocked) continue;
        const s = await importSeason(e.parse, year, e.file.name);
        toast.success(
          `${e.parse.kind === "superleague" ? "SuperLeague" : "Ligas Nacionais"} ${year}: ${s.standings} classificações, ${s.coaches} treinadores`,
        );
      }
      await qc.invalidateQueries();
      setEntries([]);
      toast.success(`Época ${year} importada com sucesso!`);
    } catch (err) {
      toast.error(`Erro ao importar: ${(err as Error).message}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar Época</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Carregue os ficheiros Excel exportados do Football Manager. Cada importação corresponde a uma época e nunca substitui épocas anteriores.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Época</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 max-w-xs">
            <div className="flex-1">
              <Label htmlFor="year">Ano da época</Label>
              <Input
                id="year"
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
          >
            <UploadCloud className="size-10 text-primary" />
            <div className="text-center">
              <p className="font-medium">Arraste os ficheiros ou clique para selecionar</p>
              <p className="text-sm text-muted-foreground">dados_superleague.xlsx, dados_ligas_nacionais.xlsx …</p>
            </div>
            <Input
              type="file"
              accept=".xlsx,.xls"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </label>
        </CardContent>
      </Card>

      {entries.map((e) => (
        <Card key={e.file.name}>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="size-4 text-primary" />
              {e.file.name}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {e.parse.kind === "superleague" ? "SuperLeague" : "Ligas Nacionais"}
              </Badge>
              {e.parse.blocked ? (
                <Badge variant="destructive">Bloqueado</Badge>
              ) : (
                <Badge className="bg-success text-success-foreground">Pronto</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Stat label="Classificações" value={e.parse.data.standings.length} />
              <Stat label="Treinadores" value={e.parse.data.coaches.length} />
              <Stat label="Continentais" value={e.parse.data.continental.length} />
              <Stat label="Clubes/País" value={e.parse.data.teamCountry.length} />
            </div>
            <ul className="space-y-1">
              {e.parse.messages.map((m, i) => {
                const Icon = SEV_ICON[m.level];
                return (
                  <li key={i} className={`flex items-center gap-2 text-sm ${SEV_CLASS[m.level]}`}>
                    <Icon className="size-4 shrink-0" />
                    <span>{m.text}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ))}

      {entries.length > 0 && (
        <div className="flex items-center gap-3">
          <Button onClick={runImport} disabled={!canImport} size="lg">
            {importing && <Loader2 className="size-4 animate-spin" />}
            Importar época {year}
          </Button>
          <Button variant="ghost" onClick={() => setEntries([])} disabled={importing}>
            Limpar
          </Button>
          {anyBlocked && (
            <span className="text-sm text-destructive">Corrija os erros vermelhos antes de importar.</span>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}