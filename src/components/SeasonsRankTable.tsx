import { Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ChevronsUpDown, TrendingDown, TrendingUp, Minus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { RankingEntry, BreakdownItem } from "@/lib/fm-rankings";
import { useEntrySort } from "@/components/SortableTh";

type Kind = "clubes" | "treinadores" | "paises";

export interface ExtraCol {
  key: string;
  label: string;
  values: Record<string, number>;
  tips?: Record<string, string>;
}

interface Props {
  entries: RankingEntry[];
  evolution: Record<string, Record<number, number>>;
  years: number[];
  mode?: "weighted" | "raw";
  kind: Kind;
  limit?: number;
  nameLabel?: string;
  showTitles?: boolean;
  breakdown?: Record<string, BreakdownItem[]>;
  nacMap?: Record<string, string | null | undefined>;
  extraCols?: ExtraCol[];
  enableSearch?: boolean;
}

const MODULE_LABEL: Record<string, string> = {
  superleague: "SuperLeague",
  national: "Liga Nacional",
  continental: "Continental",
};

function divisionText(item: BreakdownItem): string {
  if (item.module === "superleague" && item.division_num) return `Div. ${item.division_num}`;
  if (item.module === "national" && item.division_label) return item.division_label;
  return MODULE_LABEL[item.module] ?? item.module;
}

/** Try to extract the club name appended to breakdown.detail (" · Club Name") for coaches/countries. */
function extractClub(detail: string): string | null {
  const parts = detail.split(" · ");
  return parts.length > 1 ? parts[parts.length - 1] : null;
}

const ROW_H = 44;
const VIEWPORT_H = 640;

/** Rank table per year using the evolution map (memoised). */
function computeRanksByYear(
  evolution: Record<string, Record<number, number>>,
  years: number[],
): Record<number, Record<string, number>> {
  const out: Record<number, Record<string, number>> = {};
  for (const y of years) {
    const pairs: { n: string; v: number }[] = [];
    for (const name of Object.keys(evolution)) {
      const v = evolution[name]?.[y] ?? 0;
      if (v > 0) pairs.push({ n: name, v });
    }
    pairs.sort((a, b) => b.v - a.v);
    const m: Record<string, number> = {};
    pairs.forEach((p, i) => (m[p.n] = i + 1));
    out[y] = m;
  }
  return out;
}

function HeaderCell({
  children,
  onClick,
  active,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) {
  const inner = onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground" : ""}`}
    >
      {children}
      {active ? <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-50" />}
    </button>
  ) : (
    children
  );
  return <div className={`p-3 ${className}`}>{inner}</div>;
}

export function SeasonsRankTable({
  entries,
  evolution,
  years,
  mode = "weighted",
  kind,
  limit = 1000,
  nameLabel,
  showTitles = true,
  breakdown,
  nacMap,
  extraCols,
  enableSearch = true,
}: Props) {
  const extrasMap = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    for (const ec of extraCols ?? []) m[ec.key] = ec.values;
    return m;
  }, [extraCols]);
  const { sorted: sortedAll, sortKey, setSortKey } = useEntrySort(entries, mode, extrasMap, evolution);

  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedAll;
    return sortedAll.filter((e) => {
      if (e.name.toLowerCase().includes(q)) return true;
      const nac = nacMap?.[e.name];
      if (nac && nac.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [sortedAll, query, nacMap]);
  const sorted = useMemo(() => filtered.slice(0, limit), [filtered, limit]);

  const to = kind === "clubes" ? "/clubes/$name" : kind === "treinadores" ? "/treinadores/$name" : "/paises/$name";
  const label = nameLabel ?? (kind === "clubes" ? "Clube" : kind === "treinadores" ? "Treinador" : "País");
  const showNac = !!nacMap && kind !== "paises";

  const ranksByYear = useMemo(() => computeRanksByYear(evolution, years), [evolution, years]);

  /** Δ vs previous available season for each entity. */
  const deltas = useMemo(() => {
    const out: Record<string, { ptsDelta: number; rankDelta: number | null; lastYear: number; prevYear: number } | null> = {};
    for (const e of sorted) {
      const evo = evolution[e.name] ?? {};
      const yearsWithData = years.filter((y) => (evo[y] ?? 0) > 0);
      if (yearsWithData.length < 2) {
        out[e.name] = null;
        continue;
      }
      const lastYear = yearsWithData[yearsWithData.length - 1];
      const prevYear = yearsWithData[yearsWithData.length - 2];
      const ptsDelta = (evo[lastYear] ?? 0) - (evo[prevYear] ?? 0);
      const rLast = ranksByYear[lastYear]?.[e.name] ?? null;
      const rPrev = ranksByYear[prevYear]?.[e.name] ?? null;
      const rankDelta = rLast !== null && rPrev !== null ? rPrev - rLast : null;
      out[e.name] = { ptsDelta, rankDelta, lastYear, prevYear };
    }
    return out;
  }, [sorted, evolution, years, ranksByYear]);

  // Grid template: # | Name | (Nac) | (Tít.) | (extras...) | Total | Δ | year × N
  const cols = useMemo(() => {
    const base: string[] = ["3rem", "minmax(14rem,1fr)"];
    if (showNac) base.push("5rem");
    if (showTitles) base.push("4rem");
    for (let i = 0; i < (extraCols?.length ?? 0); i++) base.push("6rem");
    base.push("6rem", "7rem");
    for (let i = 0; i < years.length; i++) base.push("5.5rem");
    return base.join(" ");
  }, [showNac, showTitles, extraCols, years.length]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 10,
  });
  const items = virtualizer.getVirtualItems();

  return (
    <Card className="mt-4 overflow-hidden">
      {enableSearch && (
        <div className="p-3 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(ev) => setQuery(ev.target.value)}
              placeholder={`Pesquisar ${label.toLowerCase()}${showNac ? " ou país" : ""}…`}
              className="pl-9 h-9"
            />
          </div>
        </div>
      )}
      <div ref={parentRef} className="overflow-auto" style={{ maxHeight: VIEWPORT_H }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, minWidth: "max-content" }}>
          {/* Header row */}
          <div
            className="contents text-muted-foreground text-xs uppercase"
            style={{ gridColumn: "1 / -1" }}
          />
          <div
            className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border text-muted-foreground text-xs uppercase grid"
            style={{ gridColumn: "1 / -1", gridTemplateColumns: cols }}
          >
            <HeaderCell className="text-left">#</HeaderCell>
            <HeaderCell className="text-left sticky left-0 bg-card/95 backdrop-blur z-10">{label}</HeaderCell>
            {showNac && <HeaderCell className="text-left">Nac</HeaderCell>}
            {showTitles && (
              <HeaderCell
                className="text-right"
                onClick={() => setSortKey("titles")}
                active={sortKey === "titles"}
              >
                Tít.
              </HeaderCell>
            )}
            {extraCols?.map((ec) => (
              <HeaderCell
                key={ec.key}
                className="text-right"
                onClick={() => setSortKey(`extra:${ec.key}`)}
                active={sortKey === `extra:${ec.key}`}
              >
                {ec.label}
              </HeaderCell>
            ))}
            <HeaderCell
              className="text-right"
              onClick={() => setSortKey("points")}
              active={sortKey === "points"}
            >
              Total
            </HeaderCell>
            <HeaderCell className="text-right" >Δ vs anterior</HeaderCell>
            {years.map((y) => (
              <HeaderCell
                key={y}
                className="text-right font-medium tabular-nums"
                onClick={() => setSortKey(`year:${y}`)}
                active={sortKey === `year:${y}`}
              >
                {y}
              </HeaderCell>
            ))}
          </div>


          {/* Virtualised body */}
          <div style={{ gridColumn: "1 / -1", position: "relative", height: virtualizer.getTotalSize() }}>
            {items.map((vi) => {
              const e = sorted[vi.index];
              const i = vi.index;
              const evo = evolution[e.name] ?? {};
              const d = deltas[e.name];
              const bdItems = breakdown?.[e.name] ?? [];
              const titleItems = bdItems.filter(
                (it) => it.source === "champion-bonus" || it.source === "continental-win",
              );
              return (
                <div
                  key={e.name}
                  className="absolute left-0 right-0 grid border-b border-border/40 hover:bg-muted/30 transition-colors text-sm"
                  style={{
                    transform: `translateY(${vi.start}px)`,
                    height: ROW_H,
                    gridTemplateColumns: cols,
                  }}
                >
                  <div className={`p-3 font-bold ${i < 3 ? "text-gold" : "text-muted-foreground"}`}>{i + 1}</div>
                  <div className="p-3 font-medium truncate sticky left-0 bg-background/95 backdrop-blur z-[1]">
                    <Link to={to} params={{ name: e.name }} className="hover:text-primary hover:underline">
                      {e.name}
                    </Link>
                  </div>
                  {showNac && (
                    <div className="p-3 text-muted-foreground text-xs truncate">
                      {nacMap?.[e.name] ?? "—"}
                    </div>
                  )}
                  {showTitles && (
                    <div className="p-3 text-right tabular-nums">
                      {e.titles > 0 && titleItems.length > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help underline decoration-dotted underline-offset-2">
                              {e.titles}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="space-y-1 text-xs">
                              {[...titleItems]
                                .sort((a, b) => a.season_year - b.season_year)
                                .map((it, idx) => {
                                  const club = kind === "clubes" ? null : extractClub(it.detail);
                                  return (
                                    <div key={idx}>
                                      <span className="font-semibold">{it.season_year}</span>
                                      {" · "}
                                      {divisionText(it)}
                                      {club ? ` · ${club}` : ""}
                                    </div>
                                  );
                                })}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        e.titles
                      )}
                    </div>
                  )}
                  {extraCols?.map((ec) => {
                    const v = ec.values[e.name] ?? 0;
                    const tip = ec.tips?.[e.name];
                    const inner = (
                      <span className={`tabular-nums ${v ? "" : "text-muted-foreground/30"} ${tip && v ? "underline decoration-dotted cursor-help" : ""}`}>
                        {v || "—"}
                      </span>
                    );
                    return (
                      <div key={ec.key} className="p-3 text-right">
                        {tip && v ? (
                          <Tooltip>
                            <TooltipTrigger asChild>{inner}</TooltipTrigger>
                            <TooltipContent className="max-w-xs text-xs">{tip}</TooltipContent>
                          </Tooltip>
                        ) : inner}
                      </div>
                    );
                  })}
                  <div className="p-3 text-right font-semibold tabular-nums">
                    {Math.round(mode === "raw" ? e.raw : e.weighted).toLocaleString("pt-PT")}
                  </div>
                  <div className="p-3 text-right">
                    {d ? <DeltaCell ptsDelta={d.ptsDelta} rankDelta={d.rankDelta} /> : <span className="text-muted-foreground/40">—</span>}
                  </div>
                  {years.map((y) => {
                    const v = evo[y] ?? 0;
                    const yearItems = bdItems.filter((it) => it.season_year === y);
                    const cell = (
                      <div className={`p-3 text-right tabular-nums ${v ? "" : "text-muted-foreground/30"}`}>
                        {v ? Math.round(v).toLocaleString("pt-PT") : "—"}
                      </div>
                    );
                    if (!v || yearItems.length === 0) return <div key={y}>{cell}</div>;
                    // Build lines: aggregate raw/weighted points per club/division.
                    type Line = { text: string; raw: number; weighted: number };
                    const groups = new Map<string, Line>();
                    for (const it of yearItems) {
                      if (it.module === "continental") {
                        const key = `c|${it.detail}`;
                        const existing = groups.get(key);
                        if (existing) {
                          existing.raw += it.raw;
                          existing.weighted += it.weighted;
                        } else {
                          groups.set(key, { text: it.detail, raw: it.raw, weighted: it.weighted });
                        }
                        continue;
                      }
                      const club = kind === "clubes" ? e.name : extractClub(it.detail) ?? "—";
                      const div = divisionText(it);
                      const key = `${club}|${div}`;
                      const text = kind === "clubes" ? div : `${club} · ${div}`;
                      const existing = groups.get(key);
                      if (existing) {
                        existing.raw += it.raw;
                        existing.weighted += it.weighted;
                      } else {
                        groups.set(key, { text, raw: it.raw, weighted: it.weighted });
                      }
                    }
                    const lines = [...groups.values()];
                    return (
                      <Tooltip key={y}>
                        <TooltipTrigger asChild>
                          <div className={`p-3 text-right tabular-nums cursor-help ${v ? "" : "text-muted-foreground/30"}`}>
                            {Math.round(v).toLocaleString("pt-PT")}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="space-y-1 text-xs">
                            {lines.map((l, idx) => (
                              <div key={idx}>
                                {l.text}
                                <span className="text-muted-foreground">
                                  {" · "}Bruto {Math.round(l.raw).toLocaleString("pt-PT")}
                                  {" · "}Ponderado {Math.round(l.weighted).toLocaleString("pt-PT")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

function DeltaCell({ ptsDelta, rankDelta }: { ptsDelta: number; rankDelta: number | null }) {
  const up = ptsDelta > 0;
  const flat = Math.abs(ptsDelta) < 0.5;
  const color = flat ? "text-muted-foreground" : up ? "text-emerald-500" : "text-rose-500";
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const sign = up ? "+" : "";
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${color}`}>
      <Icon className="size-3" />
      {sign}
      {Math.round(ptsDelta).toLocaleString("pt-PT")}
      {rankDelta !== null && rankDelta !== 0 && (
        <span className="text-[11px] opacity-80">({rankDelta > 0 ? "▲" : "▼"}{Math.abs(rankDelta)})</span>
      )}
    </span>
  );
}
