import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Settings, Save, Plus, Check, Trash2, RotateCcw, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useActiveConfig } from "@/lib/useRankings";
import { cloneConfig, DEFAULT_CONFIG, type FmConfig } from "@/lib/fm-config";
import { saveConfig, createProfile, activateProfile, deleteProfile, type WeightProfile } from "@/lib/fm-config-db";
import { wipeAllData } from "@/lib/fm-wipe";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/configuracao")({
  head: () => ({
    meta: [
      { title: "Configuração — FM World Rankings" },
      { name: "description", content: "Pesos de competições, divisões, títulos e fórmula mundial editáveis." },
    ],
  }),
  component: ConfigPage,
});

function NumField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 tabular-nums"
      />
    </div>
  );
}

function ConfigPage() {
  const { data, isLoading } = useActiveConfig();
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<FmConfig | null>(null);
  const [profiles, setProfiles] = useState<WeightProfile[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [wiping, setWiping] = useState(false);

  useEffect(() => {
    if (data) {
      setCfg(cloneConfig(data.config));
      setProfiles(data.profiles);
      setActiveId(data.activeId);
    }
  }, [data]);

  const upd = (fn: (c: FmConfig) => void) => setCfg((prev) => {
    if (!prev) return prev;
    const next = cloneConfig(prev);
    fn(next);
    return next;
  });

  const positions = useMemo(() => Array.from({ length: 100 }, (_, i) => i + 1), []);
  const divisions = useMemo(() => Array.from({ length: 11 }, (_, i) => i + 1), []);

  if (isLoading || !cfg) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="size-6 animate-spin mr-2" /> A carregar configuração…
      </div>
    );
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["fm-config"] });
    qc.invalidateQueries({ queryKey: ["fm-all-data"] });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConfig(activeId, cfg);
      toast.success("Configuração guardada. Rankings recalculados.");
      refresh();
    } catch (e) {
      toast.error("Erro ao guardar: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleNewProfile = async () => {
    const name = window.prompt("Nome do novo perfil de configuração:");
    if (!name) return;
    try {
      const id = await createProfile(name, cfg);
      await activateProfile(id);
      toast.success(`Perfil "${name}" criado e ativado.`);
      refresh();
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activateProfile(id);
      toast.success("Perfil ativado.");
      refresh();
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (profiles.length <= 1) {
      toast.error("Não é possível eliminar o único perfil.");
      return;
    }
    if (!window.confirm("Eliminar este perfil de configuração?")) return;
    try {
      await deleteProfile(id);
      if (id === activeId && profiles[0]) await activateProfile(profiles.find((p) => p.id !== id)!.id);
      toast.success("Perfil eliminado.");
      refresh();
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const profileName = profiles.find((p) => p.id === activeId)?.name ?? "config";
    a.href = url;
    a.download = `fm-config-${profileName.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Configuração exportada.");
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const merged = cloneConfig(DEFAULT_CONFIG);
        if (parsed.positionPoints) merged.positionPoints = { ...parsed.positionPoints };
        if (parsed.divisionWeights) merged.divisionWeights = { ...parsed.divisionWeights };
        if (parsed.competitionWeights) merged.competitionWeights = { ...merged.competitionWeights, ...parsed.competitionWeights };
        if (Array.isArray(parsed.titleWeights)) merged.titleWeights = parsed.titleWeights.map((t: { match?: string; label?: string; weight?: number }) => ({ match: t.match ?? "", label: t.label ?? "", weight: Number(t.weight) || 0 }));
        if (Array.isArray(parsed.nationalLeagueWeights)) merged.nationalLeagueWeights = parsed.nationalLeagueWeights.map((t: { match?: string; label?: string; weight?: number }) => ({ match: t.match ?? "", label: t.label ?? "", weight: Number(t.weight) || 1 }));
        if (typeof parsed.nationalChampionBonus === "number") merged.nationalChampionBonus = parsed.nationalChampionBonus;
        if (typeof parsed.superleagueChampionBonus === "number") merged.superleagueChampionBonus = parsed.superleagueChampionBonus;
        if (parsed.decayMultipliers) merged.decayMultipliers = { ...merged.decayMultipliers, ...parsed.decayMultipliers };
        if (typeof parsed.normalizePointsByGames === "boolean") merged.normalizePointsByGames = parsed.normalizePointsByGames;
        setCfg(merged);
        toast.success("Configuração importada. Clica em Guardar para aplicar.");
      } catch (e) {
        toast.error("JSON inválido: " + (e as Error).message);
      }
    };
    reader.readAsText(file);
  };

  const handleWipe = async () => {
    const phrase = window.prompt(
      "ATENÇÃO: esta ação apaga TODOS os dados importados (épocas, classificações, treinadores, países, jogadores e continentais). Os perfis de configuração são mantidos.\n\nEscreve APAGAR para confirmar:",
    );
    if (phrase !== "APAGAR") {
      if (phrase !== null) toast.error("Confirmação incorreta. Nada foi apagado.");
      return;
    }
    setWiping(true);
    try {
      await wipeAllData();
      qc.removeQueries();
      await qc.invalidateQueries();
      toast.success("Todos os dados importados foram apagados.");
    } catch (e) {
      toast.error("Erro: " + (e as Error).message);
    } finally {
      setWiping(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="size-6 text-primary" /> Configuração
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Pesos, bónus, desvalorização e fórmula mundial</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleExport}>
            <Download className="size-4" /> Exportar JSON
          </Button>
          <Button variant="outline" asChild>
            <label className="cursor-pointer">
              <Upload className="size-4" /> Importar JSON
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImport(f);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          <Button variant="outline" onClick={() => setCfg(cloneConfig(DEFAULT_CONFIG))}>
            <RotateCcw className="size-4" /> Repor padrão
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Perfis de configuração</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <span className="flex-1 font-medium">{p.name}</span>
              {p.id === activeId ? (
                <span className="text-xs text-primary flex items-center gap-1"><Check className="size-3" /> Ativo</span>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => handleActivate(p.id)}>Ativar</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={handleNewProfile}>
            <Plus className="size-4" /> Novo perfil (a partir dos valores atuais)
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Pesos por competição (Fórmula Mundial)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <NumField label="SuperLeague" step={0.1} value={cfg.competitionWeights.superleague} onChange={(v) => upd((c) => { c.competitionWeights.superleague = v; })} />
            <NumField label="Continental" step={0.1} value={cfg.competitionWeights.continental} onChange={(v) => upd((c) => { c.competitionWeights.continental = v; })} />
            <NumField label="Nacional" step={0.1} value={cfg.competitionWeights.national} onChange={(v) => upd((c) => { c.competitionWeights.national = v; })} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Bónus de campeão</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <NumField label="Campeão SuperLeague" value={cfg.superleagueChampionBonus} onChange={(v) => upd((c) => { c.superleagueChampionBonus = v; })} />
            <NumField label="Campeão Nacional" value={cfg.nationalChampionBonus} onChange={(v) => upd((c) => { c.nationalChampionBonus = v; })} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decaimento do Ranking Mundial</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Multiplicador aplicado à pontuação consoante a antiguidade da época (1.00 = sem decaimento).</p>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <NumField label="Última época (×)" step={0.01} value={cfg.decayMultipliers.last} onChange={(v) => upd((c) => { c.decayMultipliers.last = Math.max(0, v); })} />
            <NumField label="Há 1 época (×)" step={0.01} value={cfg.decayMultipliers.age1} onChange={(v) => upd((c) => { c.decayMultipliers.age1 = Math.max(0, v); })} />
            <NumField label="Há 2 épocas (×)" step={0.01} value={cfg.decayMultipliers.age2} onChange={(v) => upd((c) => { c.decayMultipliers.age2 = Math.max(0, v); })} />
            <NumField label="Há 3 épocas (×)" step={0.01} value={cfg.decayMultipliers.age3} onChange={(v) => upd((c) => { c.decayMultipliers.age3 = Math.max(0, v); })} />
            <NumField label="Épocas mais antigas (×)" step={0.01} value={cfg.decayMultipliers.older} onChange={(v) => upd((c) => { c.decayMultipliers.older = Math.max(0, v); })} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Normalização de Pnts por jogos</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Quando ativo, os pontos da liga (coluna <em>Pnts</em>) são divididos pelo número de jogos
              disputados (coluna <em>Jgs</em>) antes de serem somados ao ranking — útil para comparar
              épocas com calendários diferentes. Aplica-se a Super League e Ligas Nacionais.
            </p>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <input
              id="normPts"
              type="checkbox"
              className="size-4 accent-primary"
              checked={cfg.normalizePointsByGames}
              onChange={(e) => upd((c) => { c.normalizePointsByGames = e.target.checked; })}
            />
            <Label htmlFor="normPts" className="text-sm cursor-pointer">
              Dividir Pnts pelo nº de jogos (Jgs) em todos os rankings
            </Label>
          </CardContent>
        </Card>
      </div>

      <Accordion type="multiple" className="space-y-3">
        <AccordionItem value="div" className="border rounded-lg px-4">
          <AccordionTrigger>Pesos por divisão (SuperLeague)</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 pb-2">
              {divisions.map((d) => (
                <NumField key={d} label={`Div. ${d}`} step={0.01} value={cfg.divisionWeights[d] ?? 1} onChange={(v) => upd((c) => { c.divisionWeights[d] = v; })} />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="pos" className="border rounded-lg px-4">
          <AccordionTrigger>Pontos por posição</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pb-2">
              {positions.map((p) => (
                <NumField key={p} label={`${p}.º lugar`} value={cfg.positionPoints[p] ?? 0} onChange={(v) => upd((c) => { c.positionPoints[p] = v; })} />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="titles" className="border rounded-lg px-4">
          <AccordionTrigger>Pesos de títulos continentais</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pb-2">
              <p className="text-xs text-muted-foreground">
                Peso base atribuído a cada competição continental. O nome é comparado (sem acentos/maiúsculas) com a coluna <em>Competição</em> dos dados continentais.
                A pontuação final = peso do título × peso Continental × decaimento por época.
                Competições sem entrada nesta lista usam peso padrão 150.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cfg.titleWeights.map((t, i) => (
                  <div key={i} className="flex items-end gap-2 rounded-lg border border-border p-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Nome da competição</Label>
                      <Input
                        value={t.label}
                        onChange={(e) => upd((c) => {
                          c.titleWeights[i].label = e.target.value;
                          c.titleWeights[i].match = e.target.value
                            .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                        })}
                        className="h-9"
                      />
                    </div>
                    <div className="w-24">
                      <NumField label="Peso base" value={t.weight} onChange={(v) => upd((c) => { c.titleWeights[i].weight = v; })} />
                    </div>
                    <Button size="icon" variant="ghost" className="shrink-0" onClick={() => upd((c) => { c.titleWeights.splice(i, 1); })}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => upd((c) => { c.titleWeights.push({ match: "", label: "Nova competição", weight: 150 }); })}>
                <Plus className="size-4" /> Adicionar competição
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="natleagues" className="border rounded-lg px-4">
          <AccordionTrigger>Pesos de Ligas Nacionais</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pb-2">
              <p className="text-xs text-muted-foreground">
                Multiplicador aplicado a pontos de posição, Pnts da liga e bónus de campeão das Ligas Nacionais.
                O nome é comparado (sem acentos/maiúsculas) com a coluna <em>Liga/Divisão</em> das classificações nacionais.
                Ligas sem entrada nesta lista usam multiplicador 1.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cfg.nationalLeagueWeights.map((t, i) => (
                  <div key={i} className="flex items-end gap-2 rounded-lg border border-border p-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Nome da liga</Label>
                      <Input
                        value={t.label}
                        onChange={(e) => upd((c) => {
                          c.nationalLeagueWeights[i].label = e.target.value;
                          c.nationalLeagueWeights[i].match = e.target.value
                            .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
                        })}
                        className="h-9"
                      />
                    </div>
                    <div className="w-24">
                      <NumField label="Peso (×)" step={0.05} value={t.weight} onChange={(v) => upd((c) => { c.nationalLeagueWeights[i].weight = v; })} />
                    </div>
                    <Button size="icon" variant="ghost" className="shrink-0" onClick={() => upd((c) => { c.nationalLeagueWeights.splice(i, 1); })}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={() => upd((c) => { c.nationalLeagueWeights.push({ match: "", label: "Nova liga", weight: 1 }); })}>
                <Plus className="size-4" /> Adicionar liga nacional
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" /> Zona de perigo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Apaga permanentemente todas as épocas, classificações, treinadores, países, clubes, jogadores e
            resultados continentais já importados. Os perfis de configuração de pesos são preservados.
          </p>
          <Button variant="destructive" onClick={handleWipe} disabled={wiping}>
            {wiping ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Apagar todos os dados importados
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

