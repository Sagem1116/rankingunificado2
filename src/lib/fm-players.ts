import type { PlayerRow } from "./fm-db";
import type { StandingRow } from "./fm-rankings";

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface ClubAgg {
  club: string;
  league: string;
  division: number | null;
  n: number;
  ra: number;
  rm: number;
  ca: number;
  cp: number;
  age: number;
  salary: number;
  vp: number;
}

export interface DivisionAgg {
  division: number;
  n: number;
  ra: number;
  rm: number;
  ca: number;
  cp: number;
  age: number;
  salary: number;
  vp: number;
}

export interface PlayerStatRow {
  name: string;
  perSeason: Record<number, number>;
  perSeasonClub: Record<number, string>;
  total: number;
}

export interface PerformanceRow {
  name: string;
  club: string;
  league: string;
  age: number | null;
  gls: number;
  ast: number;
  total: number;
  salary: number;
  vp: number;
}

function latestYear(players: PlayerRow[]): number {
  return players.length ? Math.max(...players.map((p) => p.season_year)) : 0;
}

function clubDivisionMap(standings: StandingRow[], year: number): Map<string, number | null> {
  const m = new Map<string, number | null>();
  for (const s of standings) {
    if (s.module !== "superleague" || s.season_year !== year) continue;
    m.set(s.club_name, s.division_num);
  }
  return m;
}

function top28(arr: PlayerRow[]): PlayerRow[] {
  return [...arr].sort((a, b) => b.ca - a.ca).slice(0, 28);
}

export function computeClubAggregates(players: PlayerRow[], standings: StandingRow[]): ClubAgg[] {
  const year = latestYear(players);
  const divMap = clubDivisionMap(standings, year);
  const byClub = new Map<string, PlayerRow[]>();
  for (const p of players) {
    if (p.season_year !== year || !p.club_name) continue;
    if (!byClub.has(p.club_name)) byClub.set(p.club_name, []);
    byClub.get(p.club_name)!.push(p);
  }
  const rows: ClubAgg[] = [];
  for (const [club, arr] of byClub) {
    const t = top28(arr);
    rows.push({
      club,
      league: arr[0]?.league ?? "",
      division: divMap.get(club) ?? null,
      n: arr.length,
      ra: r2(avg(t.map((p) => p.ra))),
      rm: r2(avg(t.map((p) => p.rm))),
      ca: r2(avg(t.map((p) => p.ca))),
      cp: r2(avg(t.map((p) => p.cp))),
      age: r2(avg(arr.map((p) => p.age ?? 0).filter((x) => x > 0))),
      salary: Math.round(sum(arr.map((p) => p.salary))),
      vp: Math.round(sum(arr.map((p) => p.vp))),
    });
  }
  return rows.sort((a, b) => b.ca - a.ca);
}

export function computeDivisionAggregates(players: PlayerRow[], standings: StandingRow[]): DivisionAgg[] {
  const year = latestYear(players);
  const divMap = clubDivisionMap(standings, year);
  const byClub = new Map<string, PlayerRow[]>();
  for (const p of players) {
    if (p.season_year !== year || !p.club_name) continue;
    if (!byClub.has(p.club_name)) byClub.set(p.club_name, []);
    byClub.get(p.club_name)!.push(p);
  }
  const rows: DivisionAgg[] = [];
  for (let d = 1; d <= 11; d++) {
    const clubs = [...byClub.keys()].filter((c) => divMap.get(c) === d);
    const all: PlayerRow[] = [];
    const t28: PlayerRow[] = [];
    for (const c of clubs) {
      const arr = byClub.get(c) ?? [];
      all.push(...arr);
      t28.push(...top28(arr));
    }
    if (!all.length) continue;
    rows.push({
      division: d,
      n: all.length,
      ra: r2(avg(t28.map((p) => p.ra))),
      rm: r2(avg(t28.map((p) => p.rm))),
      ca: r2(avg(t28.map((p) => p.ca))),
      cp: r2(avg(t28.map((p) => p.cp))),
      age: r2(avg(all.map((p) => p.age ?? 0).filter((x) => x > 0))),
      salary: Math.round(sum(all.map((p) => p.salary))),
      vp: Math.round(sum(all.map((p) => p.vp))),
    });
  }
  return rows.sort((a, b) => a.division - b.division);
}

function buildStat(players: PlayerRow[], field: "gls" | "ast"): { rows: PlayerStatRow[]; years: number[] } {
  const years = [...new Set(players.map((p) => p.season_year))].sort((a, b) => a - b);
  const map = new Map<string, PlayerStatRow>();
  for (const p of players) {
    const key = p.idu || p.name;
    const row = map.get(key) ?? { name: p.name, perSeason: {}, perSeasonClub: {}, total: 0 };
    row.perSeason[p.season_year] = (row.perSeason[p.season_year] ?? 0) + p[field];
    if (p.club_name) row.perSeasonClub[p.season_year] = p.club_name;
    map.set(key, row);
  }
  const rows = [...map.values()].map((r) => {
    r.total = years.reduce((t, y) => t + (r.perSeason[y] ?? 0), 0);
    return r;
  }).filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  return { rows, years };
}

export const computeGoals = (players: PlayerRow[]) => buildStat(players, "gls");
export const computeAssists = (players: PlayerRow[]) => buildStat(players, "ast");

export function computePerformance(players: PlayerRow[]): PerformanceRow[] {
  const map = new Map<string, PerformanceRow>();
  const sorted = [...players].sort((a, b) => a.season_year - b.season_year);
  for (const p of sorted) {
    const key = p.idu || p.name;
    const row = map.get(key) ?? { name: p.name, club: "", league: "", age: null, gls: 0, ast: 0, total: 0, salary: 0, vp: 0 };
    row.gls += p.gls;
    row.ast += p.ast;
    row.total = row.gls + row.ast;
    if (p.club_name) row.club = p.club_name;
    if (p.league) row.league = p.league;
    if (p.age) row.age = p.age;
    if (p.salary) row.salary = p.salary;
    if (p.vp) row.vp = p.vp;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}
