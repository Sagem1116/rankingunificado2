import {
  positionPoints,
  divisionWeight,
  DEFAULT_COMPETITION_WEIGHTS,
  continentalTitleWeight,
  NATIONAL_CHAMPION_BONUS,
  SUPERLEAGUE_CHAMPION_BONUS,
} from "./fm-defaults";

export interface StandingRow {
  season_year: number;
  module: "superleague" | "national" | "continental";
  division_num: number | null;
  position: number | null;
  club_name: string;
  is_champion: boolean;
}

export interface ContinentalRow {
  season_year: number;
  competition: string;
  team1: string | null;
  team2: string | null;
  winner: string | null;
}

export interface CoachRow {
  season_year: number;
  module: "superleague" | "national" | "continental";
  name: string;
  nationality: string | null;
  club_name: string | null;
}

export interface RankingEntry {
  name: string;
  raw: number;
  weighted: number;
  titles: number;
  meta?: Record<string, unknown>;
}

export interface ComputeInput {
  standings: StandingRow[];
  continental: ContinentalRow[];
  coaches: CoachRow[];
  clubCountry: Record<string, string | null>;
}

export interface ComputeResult {
  clubs: RankingEntry[];
  countries: RankingEntry[];
  coaches: RankingEntry[];
  clubSeasonPoints: Record<string, { raw: number; weighted: number }>;
}

function add(map: Map<string, RankingEntry>, name: string, raw: number, weighted: number, titles = 0) {
  const e = map.get(name) ?? { name, raw: 0, weighted: 0, titles: 0 };
  e.raw += raw;
  e.weighted += weighted;
  e.titles += titles;
  map.set(name, e);
}

export function computeRankings(input: ComputeInput): ComputeResult {
  const clubs = new Map<string, RankingEntry>();
  const countries = new Map<string, RankingEntry>();
  const clubSeasonPoints: Record<string, { raw: number; weighted: number }> = {};

  const bump = (season: number, module: string, club: string, raw: number, weighted: number) => {
    const k = `${season}|${module}|${club}`;
    const cur = clubSeasonPoints[k] ?? { raw: 0, weighted: 0 };
    cur.raw += raw;
    cur.weighted += weighted;
    clubSeasonPoints[k] = cur;
  };

  for (const s of input.standings) {
    const base = positionPoints(s.position);
    const compW = DEFAULT_COMPETITION_WEIGHTS[s.module as keyof typeof DEFAULT_COMPETITION_WEIGHTS] ?? 1;
    const divW = s.module === "superleague" ? divisionWeight(s.division_num) : 1;
    let raw = base;
    let weighted = base * compW * divW;
    let titles = 0;
    if (s.is_champion) {
      const bonus = s.module === "superleague" ? SUPERLEAGUE_CHAMPION_BONUS : NATIONAL_CHAMPION_BONUS;
      raw += bonus * 0.5;
      weighted += bonus * compW;
      titles = 1;
    }
    add(clubs, s.club_name, raw, weighted, titles);
    bump(s.season_year, s.module, s.club_name, raw, weighted);
    const country = input.clubCountry[s.club_name];
    if (country) add(countries, country, raw, weighted, titles);
  }

  for (const c of input.continental) {
    const { weight } = continentalTitleWeight(c.competition);
    const compW = DEFAULT_COMPETITION_WEIGHTS.continental;
    if (c.winner) {
      add(clubs, c.winner, 200, weight * compW, 1);
      bump(c.season_year, "continental", c.winner, 200, weight * compW);
      const country = input.clubCountry[c.winner];
      if (country) add(countries, country, 200, weight * compW, 1);
    }
    const loser = c.winner === c.team1 ? c.team2 : c.team1;
    if (loser) {
      add(clubs, loser, 50, weight * compW * 0.3, 0);
      bump(c.season_year, "continental", loser, 50, weight * compW * 0.3);
      const country = input.clubCountry[loser];
      if (country) add(countries, country, 50, weight * compW * 0.3, 0);
    }
  }

  // Coaches inherit the points of the club they managed that season/module.
  const coaches = new Map<string, RankingEntry>();
  for (const c of input.coaches) {
    if (!c.club_name) continue;
    const k = `${c.season_year}|${c.module}|${c.club_name}`;
    const pts = clubSeasonPoints[k];
    if (!pts) continue;
    add(coaches, c.name, pts.raw, pts.weighted, 0);
  }

  const sortW = (a: RankingEntry, b: RankingEntry) => b.weighted - a.weighted;
  const sortR = (a: RankingEntry, b: RankingEntry) => b.raw - a.raw;
  void sortR;
  return {
    clubs: [...clubs.values()].sort(sortW),
    countries: [...countries.values()].sort(sortW),
    coaches: [...coaches.values()].sort(sortW),
    clubSeasonPoints,
  };
}

export function rankBy(entries: RankingEntry[], mode: "raw" | "weighted"): RankingEntry[] {
  return [...entries].sort((a, b) => (mode === "raw" ? b.raw - a.raw : b.weighted - a.weighted));
}