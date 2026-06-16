import { useMemo, useState } from "react";
import { ArrowDown, ChevronsUpDown } from "lucide-react";
import type { RankingEntry } from "@/lib/fm-rankings";

export type SortKey = "points" | "titles";

export function useEntrySort(entries: RankingEntry[], mode: "weighted" | "raw") {
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const sorted = useMemo(() => {
    const arr = [...entries];
    arr.sort((a, b) => {
      if (sortKey === "titles") {
        if (b.titles !== a.titles) return b.titles - a.titles;
        return (mode === "raw" ? b.raw - a.raw : b.weighted - a.weighted);
      }
      return mode === "raw" ? b.raw - a.raw : b.weighted - a.weighted;
    });
    return arr;
  }, [entries, sortKey, mode]);
  return { sorted, sortKey, setSortKey };
}

export function SortableTh({
  label,
  active,
  onClick,
  className = "",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={`p-3 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${active ? "text-foreground" : ""}`}
      >
        {label}
        {active ? <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-50" />}
      </button>
    </th>
  );
}
