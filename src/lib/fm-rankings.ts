import {
  DEFAULT_CONFIG,
  cfgPositionPoints,
  cfgDivisionWeight,
  cfgTitleWeight,
  cfgDecay,
  type FmConfig,
} from "./fm-config";

export interface StandingRow {
  season_year: number;
  module: "superleague" | "national" | "continental";
  division_num: number | null;
  position: number | null;
  club_name: string;
  is_champion: boolean;
  info?: string | null;
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
  clubSeasonPoints: Record<string, { raw: number; weighted: number; titles: number }>;
  /** Per-entity per-year weighted points (years sorted ascending). */
  evolution: {
    clubs: Record<string, Record<number, number>>;
    coaches: Record<string, Record<number, number>>;
    countries: Record<string, Record<number, number>>;
  };
  years: number[];
}

function add(map: Map<string, RankingEntry>, name: string, raw: number, weighted: number, titles = 0) {
  const e = map.get(name) ?? { name, raw: 0, weighted: 0, titles: 0 };
  e.raw += raw;
  e.weighted += weighted;
  e.titles += titles;
  map.set(name, e);
}

function bumpEvo(evo: Record<string, Record<number, number>>, name: string, year: number, weighted: number) {
  const m = evo[name] ?? {};
  m[year] = (m[year] ?? 0) + weighted;
  evo[name] = m;
}

export function computeRankings(input: ComputeInput, config: FmConfig = DEFAULT_CONFIG): ComputeResult {
  const clubs = new Map<string, RankingEntry>();
  const countries = new Map<string, RankingEntry>();
  const clubSeasonPoints: Record<string, { raw: number; weighted: number; titles: number }> = {};
  const evoClubs: Record<string, Record<number, number>> = {};
  const evoCountries: Record<string, Record<number, number>> = {};
  const evoCoaches: Record<string, Record<number, number>> = {};

  const yearsAll = [
    ...input.standings.map((s) => s.season_year),
    ...input.continental.map((c) => c.season_year),
  ].filter((y) => y > 0);
  const latestYear = yearsAll.length ? Math.max(...yearsAll) : 0;
  const years = [...new Set(yearsAll)].sort((a, b) => a - b);

  const bump = (season: number, module: string, club: string, raw: number, weighted: number, titles = 0) => {
    const k = `${season}|${module}|${club}`;
    const cur = clubSeasonPoints[k] ?? { raw: 0, weighted: 0, titles: 0 };
    cur.raw += raw;
    cur.weighted += weighted;
    cur.titles += titles;
    clubSeasonPoints[k] = cur;
  };

  for (const s of input.standings) {
    const base = cfgPositionPoints(config, s.position);
    const compW = config.competitionWeights[s.module as keyof typeof config.competitionWeights] ?? 1;
    const divW = s.module === "superleague" ? cfgDivisionWeight(config, s.division_num) : 1;
    const decay = cfgDecay(config, s.season_year, latestYear);
    let raw = base;
    let weighted = base * compW * divW * decay;
    let titles = 0;
    if (s.is_champion) {
      const bonus = s.module === "superleague" ? config.superleagueChampionBonus : config.nationalChampionBonus;
      raw += bonus * 0.5;
      weighted += bonus * compW * decay;
      titles = 1;
    }
    add(clubs, s.club_name, raw, weighted, titles);
    bump(s.season_year, s.module, s.club_name, raw, weighted, titles);
    bumpEvo(evoClubs, s.club_name, s.season_year, weighted);
    const country = input.clubCountry[s.club_name];
    if (country) {
      add(countries, country, raw, weighted, titles);
      bumpEvo(evoCountries, country, s.season_year, weighted);
    }
  }

  for (const c of input.continental) {
    const { weight } = cfgTitleWeight(config, c.competition);
    const compW = config.competitionWeights.continental;
    const decay = cfgDecay(config, c.season_year, latestYear);
    if (c.winner) {
      const w = weight * compW * decay;
      add(clubs, c.winner, 200, w, 1);
      bump(c.season_year, "continental", c.winner, 200, w, 1);
      bumpEvo(evoClubs, c.winner, c.season_year, w);
      const country = input.clubCountry[c.winner];
      if (country) {
        add(countries, country, 200, w, 1);
        bumpEvo(evoCountries, country, c.season_year, w);
      }
    }
    const loser = c.winner === c.team1 ? c.team2 : c.team1;
    if (loser) {
      const w = weight * compW * decay * 0.3;
      add(clubs, loser, 50, w, 0);
      bump(c.season_year, "continental", loser, 50, w, 0);
      bumpEvo(evoClubs, loser, c.season_year, w);
      const country = input.clubCountry[loser];
      if (country) {
        add(countries, country, 50, w, 0);
        bumpEvo(evoCountries, country, c.season_year, w);
      }
    }
  }

  // Coaches inherit the points AND titles of the club they managed that season/module.
  // Continental results live under module "continental"; attribute them to whoever
  // coached the club in the national (or superleague) module for that season.
  const coaches = new Map<string, RankingEntry>();
  const seenContinentalFor = new Set<string>();
  for (const c of input.coaches) {
    if (!c.club_name) continue;
    const k = `${c.season_year}|${c.module}|${c.club_name}`;
    const pts = clubSeasonPoints[k];
    let raw = 0,
      weighted = 0,
      titles = 0;
    if (pts) {
      raw += pts.raw;
      weighted += pts.weighted;
      titles += pts.titles;
    }
    // Merge continental results once per (coach|season|club) — only for non-continental modules
    if (c.module !== "continental") {
      const contKey = `${c.season_year}|continental|${c.club_name}`;
      const dedupe = `${c.name}|${contKey}`;
      const contPts = clubSeasonPoints[contKey];
      if (contPts && !seenContinentalFor.has(dedupe)) {
        seenContinentalFor.add(dedupe);
        raw += contPts.raw;
        weighted += contPts.weighted;
        titles += contPts.titles;
      }
    }
    if (raw === 0 && weighted === 0 && titles === 0) continue;
    add(coaches, c.name, raw, weighted, titles);
    bumpEvo(evoCoaches, c.name, c.season_year, weighted);
  }

  const sortW = (a: RankingEntry, b: RankingEntry) => b.weighted - a.weighted;
  const sortR = (a: RankingEntry, b: RankingEntry) => b.raw - a.raw;
  void sortR;
  return {
    clubs: [...clubs.values()].sort(sortW),
    countries: [...countries.values()].sort(sortW),
    coaches: [...coaches.values()].sort(sortW),
    clubSeasonPoints,
    evolution: { clubs: evoClubs, coaches: evoCoaches, countries: evoCountries },
    years,
  };
}

export function rankBy(entries: RankingEntry[], mode: "raw" | "weighted"): RankingEntry[] {
  return [...entries].sort((a, b) => (mode === "raw" ? b.raw - a.raw : b.weighted - a.weighted));
}