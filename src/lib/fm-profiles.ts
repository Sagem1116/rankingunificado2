import type { AllData } from "./fm-db";
import {
  DEFAULT_CONFIG,
  cfgPositionPoints,
  cfgDivisionWeight,
  cfgTitleWeight,
  cfgDecay,
  type FmConfig,
} from "./fm-config";

export type Module = "superleague" | "national" | "continental";

export interface ClubSeasonRow {
  year: number;
  module: Module;
  division_num: number | null;
  position: number | null;
  is_champion: boolean;
  weighted: number;
}

export interface ContinentalAppearance {
  year: number;
  competition: string;
  opponent: string | null;
  won: boolean;
}

export interface ChartPoint {
  year: number;
  weighted: number;
  position: number | null;
}

export interface ClubProfile {
  name: string;
  country: string | null;
  seasons: ClubSeasonRow[];
  continental: ContinentalAppearance[];
  coaches: { name: string; year: number; module: Module }[];
  totalWeighted: number;
  totalRaw: number;
  titles: number;
  superleagueTitles: number;
  nationalTitles: number;
  continentalTitles: number;
  bestPosition: number | null;
  seasonsCount: number;
  chart: ChartPoint[];
}

export interface CoachSeasonRow {
  year: number;
  module: Module;
  club_name: string | null;
  champion: boolean;
  weighted: number;
}

export interface CoachContinentalTitle {
  year: number;
  competition: string;
  club: string;
  opponent: string | null;
  role: "winner" | "runner-up";
}

export interface CoachProfile {
  name: string;
  seasons: CoachSeasonRow[];
  clubs: string[];
  totalWeighted: number;
  titles: number;
  seasonsCount: number;
  chart: ChartPoint[];
  continentalTitles: CoachContinentalTitle[];
}

export interface CountryProfile {
  name: string;
  clubs: { name: string; weighted: number; titles: number }[];
  totalWeighted: number;
  titles: number;
  seasonsActive: number;
  chart: ChartPoint[];
}

function standingWeighted(
  cfg: FmConfig,
  latestYear: number,
  s: {
    season_year: number;
    module: Module;
    division_num: number | null;
    position: number | null;
    is_champion: boolean;
  },
): number {
  const base = cfgPositionPoints(cfg, s.position);
  const compW = cfg.competitionWeights[s.module as keyof typeof cfg.competitionWeights] ?? 1;
  const divW = s.module === "superleague" ? cfgDivisionWeight(cfg, s.division_num) : 1;
  const decay = cfgDecay(cfg, s.season_year, latestYear);
  let weighted = base * compW * divW * decay;
  if (s.is_champion) {
    const bonus = s.module === "superleague" ? cfg.superleagueChampionBonus : cfg.nationalChampionBonus;
    weighted += bonus * compW * decay;
  }
  return weighted;
}

function latestYearOf(data: AllData): number {
  const ys = [
    ...data.standings.map((s) => s.season_year),
    ...data.continental.map((c) => c.season_year),
  ];
  return ys.length ? Math.max(...ys) : 0;
}

type YearMap = Map<number, Map<string, number>>;
const addYM = (m: YearMap, year: number, name: string, w: number) => {
  let inner = m.get(year);
  if (!inner) { inner = new Map(); m.set(year, inner); }
  inner.set(name, (inner.get(name) ?? 0) + w);
};

interface YearMaps {
  clubYear: YearMap;
  countryYear: YearMap;
  coachYear: YearMap;
}

let _yearMapsCache: { key: unknown; maps: YearMaps } | null = null;
function buildYearMaps(data: AllData, cfg: FmConfig): YearMaps {
  if (_yearMapsCache && _yearMapsCache.key === data && (_yearMapsCache as { cfg?: unknown }).cfg === cfg) {
    return _yearMapsCache.maps;
  }
  const latestYear = latestYearOf(data);
  const clubYear: YearMap = new Map();
  for (const s of data.standings) {
    addYM(clubYear, s.season_year, s.club_name, standingWeighted(cfg, latestYear, s));
  }
  for (const c of data.continental) {
    const { weight } = cfgTitleWeight(cfg, c.competition);
    const compW = cfg.competitionWeights.continental * cfgDecay(cfg, c.season_year, latestYear);
    for (const team of [c.team1, c.team2]) {
      if (!team) continue;
      const won = c.winner === team;
      addYM(clubYear, c.season_year, team, weight * compW * (won ? 1 : 0.3));
    }
  }
  const countryYear: YearMap = new Map();
  for (const [year, inner] of clubYear) {
    for (const [club, w] of inner) {
      const country = data.clubCountry[club];
      if (!country) continue;
      addYM(countryYear, year, country, w);
    }
  }
  const sKey = new Map<string, number>();
  for (const s of data.standings) {
    const k = `${s.season_year}|${s.module}|${s.club_name}`;
    sKey.set(k, (sKey.get(k) ?? 0) + standingWeighted(cfg, latestYear, s));
  }
  const coachYear: YearMap = new Map();
  for (const a of data.coaches) {
    if (!a.club_name) continue;
    const k = `${a.season_year}|${a.module}|${a.club_name}`;
    addYM(coachYear, a.season_year, a.name, sKey.get(k) ?? 0);
  }
  const maps = { clubYear, countryYear, coachYear };
  _yearMapsCache = { key: data, maps } as unknown as { key: unknown; maps: YearMaps };
  (_yearMapsCache as { cfg?: unknown }).cfg = cfg;
  return maps;
}

function rankIn(inner: Map<string, number> | undefined, name: string): number | null {
  if (!inner) return null;
  const w = inner.get(name);
  if (w == null) return null;
  let rank = 1;
  for (const [n, v] of inner) {
    if (n === name) continue;
    if (v > w) rank++;
  }
  return rank;
}

function chartWithRanks(
  yearWeights: Map<number, number>,
  yearMap: YearMap,
  name: string,
): ChartPoint[] {
  return [...yearWeights.entries()]
    .map(([year, weighted]) => ({ year, weighted, position: rankIn(yearMap.get(year), name) }))
    .sort((a, b) => a.year - b.year);
}

export function buildClubProfile(data: AllData, name: string, cfg: FmConfig = DEFAULT_CONFIG): ClubProfile | null {
  const latestYear = latestYearOf(data);
  const own = data.standings.filter((s) => s.club_name === name);
  const cont = data.continental.filter((c) => c.team1 === name || c.team2 === name);
  if (own.length === 0 && cont.length === 0) return null;

  const seasons: ClubSeasonRow[] = own.map((s) => ({
    year: s.season_year,
    module: s.module,
    division_num: s.division_num,
    position: s.position,
    is_champion: s.is_champion,
    weighted: standingWeighted(cfg, latestYear, s),
  }));

  const continental: ContinentalAppearance[] = cont.map((c) => {
    const opponent = c.team1 === name ? c.team2 : c.team1;
    return {
      year: c.season_year,
      competition: c.competition,
      opponent,
      won: c.winner === name,
    };
  });

  const coaches = data.coaches
    .filter((c) => c.club_name === name)
    .map((c) => ({ name: c.name, year: c.season_year, module: c.module }));

  let totalWeighted = 0;
  let totalRaw = 0;
  let superleagueTitles = 0;
  let nationalTitles = 0;
  let bestPosition: number | null = null;
  for (const s of seasons) {
    totalWeighted += s.weighted;
    totalRaw += cfgPositionPoints(cfg, s.position);
    if (s.is_champion) {
      if (s.module === "superleague") superleagueTitles++;
      else nationalTitles++;
    }
    if (s.position != null && (bestPosition == null || s.position < bestPosition)) bestPosition = s.position;
  }
  let continentalTitles = 0;
  for (const c of continental) {
    const { weight } = cfgTitleWeight(cfg, c.competition);
    const compW = cfg.competitionWeights.continental * cfgDecay(cfg, c.year, latestYear);
    if (c.won) {
      continentalTitles++;
      totalWeighted += weight * compW;
      totalRaw += 200;
    } else {
      totalWeighted += weight * compW * 0.3;
      totalRaw += 50;
    }
  }

  const byYear = new Map<number, number>();
  for (const s of seasons) byYear.set(s.year, (byYear.get(s.year) ?? 0) + s.weighted);
  for (const c of continental) {
    const { weight } = cfgTitleWeight(cfg, c.competition);
    const compW = cfg.competitionWeights.continental * cfgDecay(cfg, c.year, latestYear);
    byYear.set(c.year, (byYear.get(c.year) ?? 0) + weight * compW * (c.won ? 1 : 0.3));
  }
  const { clubYear } = buildYearMaps(data, cfg);

  return {
    name,
    country: data.clubCountry[name] ?? null,
    seasons: seasons.sort((a, b) => b.year - a.year),
    continental: continental.sort((a, b) => b.year - a.year),
    coaches: coaches.sort((a, b) => b.year - a.year),
    totalWeighted,
    totalRaw,
    titles: superleagueTitles + nationalTitles + continentalTitles,
    superleagueTitles,
    nationalTitles,
    continentalTitles,
    bestPosition,
    seasonsCount: new Set([...seasons.map((s) => s.year), ...continental.map((c) => c.year)]).size,
    chart: chartWithRanks(byYear, clubYear, name),
  };
}

export function buildCoachProfile(data: AllData, name: string, cfg: FmConfig = DEFAULT_CONFIG): CoachProfile | null {
  const latestYear = latestYearOf(data);
  const assigns = data.coaches.filter((c) => c.name === name);
  if (assigns.length === 0) return null;

  const championKey = new Set<string>();
  for (const s of data.standings) {
    if (s.is_champion) championKey.add(`${s.season_year}|${s.module}|${s.club_name}`);
  }

  const ptKey = new Map<string, number>();
  for (const s of data.standings) {
    const k = `${s.season_year}|${s.module}|${s.club_name}`;
    ptKey.set(k, (ptKey.get(k) ?? 0) + standingWeighted(cfg, latestYear, s));
  }

  const seasons: CoachSeasonRow[] = assigns.map((a) => {
    const k = `${a.season_year}|${a.module}|${a.club_name ?? ""}`;
    return {
      year: a.season_year,
      module: a.module,
      club_name: a.club_name,
      champion: a.club_name ? championKey.has(k) : false,
      weighted: a.club_name ? ptKey.get(k) ?? 0 : 0,
    };
  });

  const clubYears = new Set<string>();
  for (const a of assigns) {
    if (a.club_name) clubYears.add(`${a.season_year}|${a.club_name}`);
  }
  const continentalTitles: CoachContinentalTitle[] = [];
  for (const c of data.continental) {
    for (const club of [c.team1, c.team2]) {
      if (!club) continue;
      if (!clubYears.has(`${c.season_year}|${club}`)) continue;
      const won = c.winner === club;
      const opponent = c.team1 === club ? c.team2 : c.team1;
      continentalTitles.push({
        year: c.season_year,
        competition: c.competition,
        club,
        opponent,
        role: won ? "winner" : "runner-up",
      });
    }
  }
  continentalTitles.sort((a, b) => b.year - a.year || a.competition.localeCompare(b.competition));

  let totalWeighted = 0;
  let titles = 0;
  for (const s of seasons) {
    totalWeighted += s.weighted;
    if (s.champion) titles++;
  }
  for (const t of continentalTitles) if (t.role === "winner") titles++;

  const clubs = [...new Set(assigns.map((a) => a.club_name).filter(Boolean) as string[])];
  const byYear = new Map<number, number>();
  for (const s of seasons) byYear.set(s.year, (byYear.get(s.year) ?? 0) + s.weighted);

  const { coachYear } = buildYearMaps(data, cfg);

  return {
    name,
    seasons: seasons.sort((a, b) => b.year - a.year),
    clubs,
    totalWeighted,
    titles,
    seasonsCount: new Set(seasons.map((s) => s.year)).size,
    chart: chartWithRanks(byYear, coachYear, name),
    continentalTitles,
  };
}

export function buildCountryProfile(data: AllData, name: string, cfg: FmConfig = DEFAULT_CONFIG): CountryProfile | null {
  const latestYear = latestYearOf(data);
  const clubNames = Object.entries(data.clubCountry)
    .filter(([, c]) => c === name)
    .map(([club]) => club);
  if (clubNames.length === 0) return null;
  const clubSet = new Set(clubNames);

  const clubAgg = new Map<string, { weighted: number; titles: number }>();
  const byYear = new Map<number, number>();
  const years = new Set<number>();

  for (const s of data.standings) {
    if (!clubSet.has(s.club_name)) continue;
    const w = standingWeighted(cfg, latestYear, s);
    const cur = clubAgg.get(s.club_name) ?? { weighted: 0, titles: 0 };
    cur.weighted += w;
    if (s.is_champion) cur.titles++;
    clubAgg.set(s.club_name, cur);
    byYear.set(s.season_year, (byYear.get(s.season_year) ?? 0) + w);
    years.add(s.season_year);
  }
  for (const c of data.continental) {
    const club = clubSet.has(c.team1 ?? "") ? c.team1 : clubSet.has(c.team2 ?? "") ? c.team2 : null;
    if (!club) continue;
    const { weight } = cfgTitleWeight(cfg, c.competition);
    const compW = cfg.competitionWeights.continental * cfgDecay(cfg, c.season_year, latestYear);
    const won = c.winner === club;
    const w = weight * compW * (won ? 1 : 0.3);
    const cur = clubAgg.get(club) ?? { weighted: 0, titles: 0 };
    cur.weighted += w;
    if (won) cur.titles++;
    clubAgg.set(club, cur);
    byYear.set(c.season_year, (byYear.get(c.season_year) ?? 0) + w);
    years.add(c.season_year);
  }

  const clubs = [...clubAgg.entries()]
    .map(([n, v]) => ({ name: n, weighted: v.weighted, titles: v.titles }))
    .sort((a, b) => b.weighted - a.weighted);

  const { countryYear } = buildYearMaps(data, cfg);

  return {
    name,
    clubs,
    totalWeighted: clubs.reduce((a, c) => a + c.weighted, 0),
    titles: clubs.reduce((a, c) => a + c.titles, 0),
    seasonsActive: years.size,
    chart: chartWithRanks(byYear, countryYear, name),
  };
}
