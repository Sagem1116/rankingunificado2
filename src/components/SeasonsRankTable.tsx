import { Link } from "@tanstack/react-router";
import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ChevronsUpDown, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { RankingEntry } from "@/lib/fm-rankings";
import { useEntrySort } from "@/components/SortableTh";

type Kind = "clubes" | "treinadores" | "paises";

interface Props {
  entries: RankingEntry[];
  evolution: Record<string, Record<number, number>>;
  years: number[];
  mode?: "weighted" | "raw";
  kind: Kind;
  limit?: number;
  nameLabel?: string;
  showTitles?: boolean;
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
}: Props) {
  const { sorted: sortedAll, sortKey, setSortKey } = useEntrySort(entries, mode);
  const sorted = useMemo(() => sortedAll.slice(0, limit), [sortedAll, limit]);

  const to = kind === "clubes" ? "/clubes/$name" : kind === "treinadores" ? "/treinadores/$name" : "/paises/$name";
  const label = nameLabel ?? (kind === "clubes" ? "Clube" : kind === "treinadores" ? "Treinador" : "País");

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
      const rankDelta = rLast !== null && rPrev !== null ? rPrev - rLast : null; // positive = climbed
      out[e.name] = { ptsDelta, rankDelta, lastYear, prevYear };
    }
    return out;
  }, [sorted, evolution, years, ranksByYear]);

  // Grid template: # | Name | (Tít.) | Total | Δ | year × N
  const cols = useMemo(() => {
    const base: string[] = ["3rem", "minmax(14rem,1fr)"];
    if (showTitles) base.push("4rem");
    base.push("6rem", "7rem");
    for (let i = 0; i < years.length; i++) base.push("5.5rem");
    return base.join(" ");
  }, [showTitles, years.length]);

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
            {showTitles && (
              <HeaderCell
                className="text-right"
                onClick={() => setSortKey("titles")}
                active={sortKey === "titles"}
              >
                Tít.
              </HeaderCell>
            )}
            <HeaderCell
              className="text-right"
              onClick={() => setSortKey("points")}
              active={sortKey === "points"}
            >
              Total
            </HeaderCell>
            <HeaderCell className="text-right" >Δ vs anterior</HeaderCell>
            {years.map((y) => (
              <HeaderCell key={y} className="text-right font-medium tabular-nums">
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
                  {showTitles && <div className="p-3 text-right tabular-nums">{e.titles}</div>}
                  <div className="p-3 text-right font-semibold tabular-nums">
                    {Math.round(mode === "raw" ? e.raw : e.weighted).toLocaleString("pt-PT")}
                  </div>
                  <div className="p-3 text-right">
                    {d ? <DeltaCell ptsDelta={d.ptsDelta} rankDelta={d.rankDelta} /> : <span className="text-muted-foreground/40">—</span>}
                  </div>
                  {years.map((y) => {
                    const v = evo[y] ?? 0;
                    return (
                      <div key={y} className={`p-3 text-right tabular-nums ${v ? "" : "text-muted-foreground/30"}`}>
                        {v ? Math.round(v).toLocaleString("pt-PT") : "—"}
                      </div>
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
