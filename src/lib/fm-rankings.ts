import {
  DEFAULT_CONFIG,
  cfgPositionPoints,
  cfgDivisionWeight,
  cfgTitleWeight,
  cfgNationalLeagueWeight,
  cfgInternationalWeight,
  cfgDecay,
  type FmConfig,
} from "./fm-config";

const MODULE_NAME: Record<string, string> = {
  superleague: "Super League",
  national: "Liga Nacional",
  continental: "Continental",
};

export interface StandingRow {
  season_year: number;
  module: "superleague" | "national" | "continental";
  division_num: number | null;
  division_label?: string | null;
  position: number | null;
  club_name: string;
  is_champion: boolean;
  info?: string | null;
  points?: number | null;
  played?: number | null;
}

export interface ContinentalRow {
  season_year: number;
  competition: string;
  team1: string | null;
  team2: string | null;
  winner: string | null;
}

export interface InternationalRow {
  season_year: number;
  competition: string;
  team1: string | null;
  team2: string | null;
  coach1: string | null;
  coach2: string | null;
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

export type BreakdownSource =
  | "position"
  | "champion-bonus"
  | "league-points"
  | "continental-win"
  | "continental-loss";

export interface BreakdownItem {
  season_year: number;
  module: "superleague" | "national" | "continental";
  source: BreakdownSource;
  detail: string;
  raw: number;
  weighted: number;
  multipliers: { compW: number; divW: number; decay: number };
  division_num?: number | null;
  division_label?: string | null;
  position?: number | null;
  leagueWeightMatched?: boolean;
}

export interface ComputeResult {
  clubs: RankingEntry[];
  countries: RankingEntry[];
  coaches: RankingEntry[];
  clubSeasonPoints: Record<string, { raw: number; weighted: number; titles: number }>;
  evolution: {
    clubs: Record<string, Record<number, number>>;
    coaches: Record<string, Record<number, number>>;
    countries: Record<string, Record<number, number>>;
  };
  breakdown: {
    clubs: Record<string, BreakdownItem[]>;
    coaches: Record<string, BreakdownItem[]>;
    countries: Record<string, BreakdownItem[]>;
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

function pushBD(bd: Record<string, BreakdownItem[]>, name: string, item: BreakdownItem) {
  (bd[name] ??= []).push(item);
}

export function computeRankings(input: ComputeInput, config: FmConfig = DEFAULT_CONFIG): ComputeResult {
  const clubs = new Map<string, RankingEntry>();
  const countries = new Map<string, RankingEntry>();
  const clubSeasonPoints: Record<string, { raw: number; weighted: number; titles: number }> = {};
  const evoClubs: Record<string, Record<number, number>> = {};
  const evoCountries: Record<string, Record<number, number>> = {};
  const evoCoaches: Record<string, Record<number, number>> = {};
  const bdClubs: Record<string, BreakdownItem[]> = {};
  const bdCountries: Record<string, BreakdownItem[]> = {};
  const bdCoaches: Record<string, BreakdownItem[]> = {};
  const clubSeasonItems: Record<string, BreakdownItem[]> = {};

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

  const recordItem = (season: number, module: StandingRow["module"], club: string, item: BreakdownItem) => {
    pushBD(bdClubs, club, item);
    // National leagues do NOT contribute to country rankings.
    if (module !== "national") {
      const country = input.clubCountry[club];
      if (country) pushBD(bdCountries, country, item);
    }
    const k = `${season}|${module}|${club}`;
    (clubSeasonItems[k] ??= []).push(item);
  };

  for (const s of input.standings) {
    const compW = config.competitionWeights[s.module as keyof typeof config.competitionWeights] ?? 1;
    const nlMatched =
      s.module === "national" && cfgNationalLeagueWeight(config, s.division_label) !== 1;
    const divW =
      s.module === "superleague"
        ? cfgDivisionWeight(config, s.division_num)
        : s.module === "national"
          ? cfgNationalLeagueWeight(config, s.division_label)
          : 1;
    const decay = cfgDecay(config, s.season_year, latestYear);
    const mult = { compW, divW, decay };
    const leagueTag =
      s.module === "national" && s.division_label
        ? ` [${s.division_label}${nlMatched ? ` · peso liga ×${divW}` : " · sem peso definido"}]`
        : s.module === "superleague" && s.division_num
          ? ` [Div. ${s.division_num} · peso ×${divW}]`
          : "";

    // Position points
    const base = cfgPositionPoints(config, s.position);
    if (base > 0) {
      const w = base * compW * divW * decay;
      add(clubs, s.club_name, base, w);
      bump(s.season_year, s.module, s.club_name, base, w);
      bumpEvo(evoClubs, s.club_name, s.season_year, w);
      if (s.module !== "national") {
        const country = input.clubCountry[s.club_name];
        if (country) {
          add(countries, country, base, w);
          bumpEvo(evoCountries, country, s.season_year, w);
        }
      }
      recordItem(s.season_year, s.module, s.club_name, {
        season_year: s.season_year,
        module: s.module,
        source: "position",
        detail: `Posição ${s.position} → ${base} pts base${leagueTag}`,
        raw: base,
        weighted: w,
        multipliers: mult,
        division_num: s.division_num,
        division_label: s.division_label,
        position: s.position,
        leagueWeightMatched: nlMatched,
      });
    }

    // League points (Pnts column from standings) — optionally normalized by games played
    const rawLeaguePts = Number(s.points ?? 0) || 0;
    const gamesPlayed = Number(s.played ?? 0) || 0;
    const normalize = config.normalizePointsByGames && gamesPlayed > 0;
    const leaguePts = normalize ? rawLeaguePts / gamesPlayed : rawLeaguePts;
    if (leaguePts > 0 && (s.module === "superleague" || s.module === "national")) {
      const w = leaguePts * compW * divW * decay;
      add(clubs, s.club_name, leaguePts, w);
      bump(s.season_year, s.module, s.club_name, leaguePts, w);
      bumpEvo(evoClubs, s.club_name, s.season_year, w);
      if (s.module !== "national") {
        const country = input.clubCountry[s.club_name];
        if (country) {
          add(countries, country, leaguePts, w);
          bumpEvo(evoCountries, country, s.season_year, w);
        }
      }
      recordItem(s.season_year, s.module, s.club_name, {
        season_year: s.season_year,
        module: s.module,
        source: "league-points",
        detail: normalize
          ? `Pnts/jogo: ${rawLeaguePts}÷${gamesPlayed} = ${leaguePts.toFixed(3)}${leagueTag}`
          : `Pnts da liga: ${leaguePts}${leagueTag}`,
        raw: leaguePts,
        weighted: w,
        multipliers: mult,
        division_num: s.division_num,
        division_label: s.division_label,
        position: s.position,
        leagueWeightMatched: nlMatched,
      });
    }

    // Champion bonus
    if (s.is_champion) {
      const bonus = s.module === "superleague" ? config.superleagueChampionBonus : config.nationalChampionBonus;
      const rawB = bonus * 0.5;
      const w = bonus * compW * divW * decay;
      add(clubs, s.club_name, rawB, w, 1);
      bump(s.season_year, s.module, s.club_name, rawB, w, 1);
      bumpEvo(evoClubs, s.club_name, s.season_year, w);
      if (s.module !== "national") {
        const country = input.clubCountry[s.club_name];
        if (country) {
          add(countries, country, rawB, w, 1);
          bumpEvo(evoCountries, country, s.season_year, w);
        }
      }
      recordItem(s.season_year, s.module, s.club_name, {
        season_year: s.season_year,
        module: s.module,
        source: "champion-bonus",
        detail: `Campeão (${MODULE_NAME[s.module] ?? s.module}) → bónus ${bonus}${leagueTag}`,
        raw: rawB,
        weighted: w,
        multipliers: mult,
        division_num: s.division_num,
        division_label: s.division_label,
        position: s.position,
        leagueWeightMatched: nlMatched,
      });
    }
  }

  for (const c of input.continental) {
    const { weight, label } = cfgTitleWeight(config, c.competition);
    const compW = config.competitionWeights.continental;
    const decay = cfgDecay(config, c.season_year, latestYear);
    const mult = { compW, divW: 1, decay };
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
      recordItem(c.season_year, "continental", c.winner, {
        season_year: c.season_year,
        module: "continental",
        source: "continental-win",
        detail: `Vencedor ${label} (${c.competition})`,
        raw: 200,
        weighted: w,
        multipliers: mult,
      });
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
      recordItem(c.season_year, "continental", loser, {
        season_year: c.season_year,
        module: "continental",
        source: "continental-loss",
        detail: `Finalista vencido ${label} (${c.competition})`,
        raw: 50,
        weighted: w,
        multipliers: mult,
      });
    }
  }

  // Coaches inherit points & breakdown items from the club they managed.
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
      for (const item of clubSeasonItems[k] ?? []) {
        pushBD(bdCoaches, c.name, { ...item, detail: `${item.detail} · ${c.club_name}` });
      }
    }
    if (c.module !== "continental") {
      const contKey = `${c.season_year}|continental|${c.club_name}`;
      const dedupe = `${c.name}|${contKey}`;
      const contPts = clubSeasonPoints[contKey];
      if (contPts && !seenContinentalFor.has(dedupe)) {
        seenContinentalFor.add(dedupe);
        raw += contPts.raw;
        weighted += contPts.weighted;
        titles += contPts.titles;
        for (const item of clubSeasonItems[contKey] ?? []) {
          pushBD(bdCoaches, c.name, { ...item, detail: `${item.detail} · ${c.club_name}` });
        }
      }
    }
    if (raw === 0 && weighted === 0 && titles === 0) continue;
    add(coaches, c.name, raw, weighted, titles);
    bumpEvo(evoCoaches, c.name, c.season_year, weighted);
  }

  const sortW = (a: RankingEntry, b: RankingEntry) => b.weighted - a.weighted;
  return {
    clubs: [...clubs.values()].sort(sortW),
    countries: [...countries.values()].sort(sortW),
    coaches: [...coaches.values()].sort(sortW),
    clubSeasonPoints,
    evolution: { clubs: evoClubs, coaches: evoCoaches, countries: evoCountries },
    breakdown: { clubs: bdClubs, coaches: bdCoaches, countries: bdCountries },
    years,
  };
}

export function rankBy(entries: RankingEntry[], mode: "raw" | "weighted"): RankingEntry[] {
  return [...entries].sort((a, b) => (mode === "raw" ? b.raw - a.raw : b.weighted - a.weighted));
}

// =============================================================
// International (national-team) rankings — for the "Internacional" tab.
// Selections are treated as countries; coaches are credited per game.
// =============================================================
export interface InternationalResult {
  countries: RankingEntry[];
  coaches: RankingEntry[];
  evolution: {
    countries: Record<string, Record<number, number>>;
    coaches: Record<string, Record<number, number>>;
  };
  breakdown: {
    countries: Record<string, BreakdownItem[]>;
    coaches: Record<string, BreakdownItem[]>;
  };
  years: number[];
}

export function computeInternationalRankings(
  rows: InternationalRow[],
  config: FmConfig = DEFAULT_CONFIG,
): InternationalResult {
  const countries = new Map<string, RankingEntry>();
  const coaches = new Map<string, RankingEntry>();
  const evoCountries: Record<string, Record<number, number>> = {};
  const evoCoaches: Record<string, Record<number, number>> = {};
  const bdCountries: Record<string, BreakdownItem[]> = {};
  const bdCoaches: Record<string, BreakdownItem[]> = {};

  const yearsAll = rows.map((r) => r.season_year).filter((y) => y > 0);
  const latestYear = yearsAll.length ? Math.max(...yearsAll) : 0;
  const years = [...new Set(yearsAll)].sort((a, b) => a - b);

  for (const r of rows) {
    const { weight, label } = cfgInternationalWeight(config, r.competition);
    const decay = cfgDecay(config, r.season_year, latestYear);
    const mult = { compW: 1, divW: 1, decay };

    if (r.winner) {
      const w = weight * decay;
      add(countries, r.winner, 200, w, 1);
      bumpEvo(evoCountries, r.winner, r.season_year, w);
      const item: BreakdownItem = {
        season_year: r.season_year,
        module: "continental",
        source: "continental-win",
        detail: `Vencedor ${label} (${r.competition}) · ${r.winner}`,
        raw: 200,
        weighted: w,
        multipliers: mult,
      };
      pushBD(bdCountries, r.winner, item);
      const winnerCoach = r.winner === r.team1 ? r.coach1 : r.coach2;
      if (winnerCoach) {
        add(coaches, winnerCoach, 200, w, 1);
        bumpEvo(evoCoaches, winnerCoach, r.season_year, w);
        pushBD(bdCoaches, winnerCoach, item);
      }
    }

    const loser = r.winner === r.team1 ? r.team2 : r.team1;
    const loserCoach = r.winner === r.team1 ? r.coach2 : r.coach1;
    if (loser) {
      const w = weight * decay * 0.3;
      add(countries, loser, 50, w, 0);
      bumpEvo(evoCountries, loser, r.season_year, w);
      const item: BreakdownItem = {
        season_year: r.season_year,
        module: "continental",
        source: "continental-loss",
        detail: `Finalista vencido ${label} (${r.competition}) · ${loser}`,
        raw: 50,
        weighted: w,
        multipliers: mult,
      };
      pushBD(bdCountries, loser, item);
      if (loserCoach) {
        add(coaches, loserCoach, 50, w, 0);
        bumpEvo(evoCoaches, loserCoach, r.season_year, w);
        pushBD(bdCoaches, loserCoach, item);
      }
    }
  }

  const sortW = (a: RankingEntry, b: RankingEntry) => b.weighted - a.weighted;
  return {
    countries: [...countries.values()].sort(sortW),
    coaches: [...coaches.values()].sort(sortW),
    evolution: { countries: evoCountries, coaches: evoCoaches },
    breakdown: { countries: bdCountries, coaches: bdCoaches },
    years,
  };
}

