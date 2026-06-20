import type { AllData } from "./fm-db";
import {
  DEFAULT_CONFIG,
  cfgPositionPoints,
  cfgDivisionWeight,
  cfgTitleWeight,
  cfgNationalLeagueWeight,
  cfgDecay,
  type FmConfig,
} from "./fm-config";

export type Module = "superleague" | "national" | "continental";

export interface ClubSeasonRow {
  year: number;
  module: Module;
  division_num: number | null;
  division_label: string | null;
  position: number | null;
  is_champion: boolean;
  weighted: number;
  raw: number;
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
  raw: number;
  positionWeighted: number | null;
  positionRaw: number | null;
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
  raw: number;
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
  totalRaw: number;
  titles: number;
  seasonsCount: number;
  chart: ChartPoint[];
  continentalTitles: CoachContinentalTitle[];
}

export interface CountryProfile {
  name: string;
  clubs: { name: string; weighted: number; raw: number; titles: number }[];
  totalWeighted: number;
  totalRaw: number;
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
    division_label?: string | null;
    position: number | null;
    is_champion: boolean;
    points?: number | null;
    played?: number | null;
  },
): number {
  const base = cfgPositionPoints(cfg, s.position);
  const compW = cfg.competitionWeights[s.module as keyof typeof cfg.competitionWeights] ?? 1;
  const divW =
    s.module === "superleague"
      ? cfgDivisionWeight(cfg, s.division_num)
      : s.module === "national"
        ? cfgNationalLeagueWeight(cfg, s.division_label)
        : 1;
  const decay = cfgDecay(cfg, s.season_year, latestYear);
  let weighted = base * compW * divW * decay;
  const rawLP = Number(s.points ?? 0) || 0;
  const gp = Number(s.played ?? 0) || 0;
  const leaguePts = cfg.normalizePointsByGames && gp > 0 ? rawLP / gp : rawLP;
  if (leaguePts > 0 && (s.module === "superleague" || s.module === "national")) {
    weighted += leaguePts * compW * divW * decay;
  }
  if (s.is_champion) {
    const bonus = s.module === "superleague" ? cfg.superleagueChampionBonus : cfg.nationalChampionBonus;
    weighted += bonus * compW * divW * decay;
  }
  return weighted;
}

function standingRaw(
  cfg: FmConfig,
  s: { module: Module; position: number | null; is_champion: boolean; points?: number | null; played?: number | null },
): number {
  let raw = cfgPositionPoints(cfg, s.position);
  const rawLP = Number(s.points ?? 0) || 0;
  const gp = Number(s.played ?? 0) || 0;
  const leaguePts = cfg.normalizePointsByGames && gp > 0 ? rawLP / gp : rawLP;
  if (leaguePts > 0 && (s.module === "superleague" || s.module === "national")) {
    raw += leaguePts;
  }
  if (s.is_champion) {
    const bonus = s.module === "superleague" ? cfg.superleagueChampionBonus : cfg.nationalChampionBonus;
    raw += bonus * 0.5;
  }
  return raw;
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

export interface YearMaps {
  clubYearW: YearMap;
  clubYearR: YearMap;
  countryYearW: YearMap;
  countryYearR: YearMap;
  coachYearW: YearMap;
  coachYearR: YearMap;
}

export type RankingSource = "all" | "superleague" | "national" | "continental";

const _yearMapsCacheMap = new Map<string, { key: unknown; cfg: unknown; maps: YearMaps }>();
export function buildYearMaps(data: AllData, cfg: FmConfig = DEFAULT_CONFIG, source: RankingSource = "all"): YearMaps {
  const cached = _yearMapsCacheMap.get(source);
  if (cached && cached.key === data && cached.cfg === cfg) {
    return cached.maps;
  }
  const latestYear = latestYearOf(data);
  const clubYearW: YearMap = new Map();
  const clubYearR: YearMap = new Map();
  const includeStandings = source === "all" || source === "superleague" || source === "national";
  const includeContinental = source === "all" || source === "continental";
  if (includeStandings) {
    for (const s of data.standings) {
      if (source !== "all" && s.module !== source) continue;
      addYM(clubYearW, s.season_year, s.club_name, standingWeighted(cfg, latestYear, s));
      addYM(clubYearR, s.season_year, s.club_name, standingRaw(cfg, s));
    }
  }
  if (includeContinental) {
    for (const c of data.continental) {
      const { weight } = cfgTitleWeight(cfg, c.competition);
      const compW = cfg.competitionWeights.continental * cfgDecay(cfg, c.season_year, latestYear);
      for (const team of [c.team1, c.team2]) {
        if (!team) continue;
        const won = c.winner === team;
        addYM(clubYearW, c.season_year, team, weight * compW * (won ? 1 : 0.3));
        addYM(clubYearR, c.season_year, team, won ? 200 : 50);
      }
    }
  }
  const countryYearW: YearMap = new Map();
  const countryYearR: YearMap = new Map();
  for (const [year, inner] of clubYearW) {
    for (const [club, w] of inner) {
      const country = data.clubCountry[club];
      if (!country) continue;
      addYM(countryYearW, year, country, w);
    }
  }
  for (const [year, inner] of clubYearR) {
    for (const [club, w] of inner) {
      const country = data.clubCountry[club];
      if (!country) continue;
      addYM(countryYearR, year, country, w);
    }
  }
  const sKeyW = new Map<string, number>();
  const sKeyR = new Map<string, number>();
  if (includeStandings) {
    for (const s of data.standings) {
      if (source !== "all" && s.module !== source) continue;
      const k = `${s.season_year}|${s.module}|${s.club_name}`;
      sKeyW.set(k, (sKeyW.get(k) ?? 0) + standingWeighted(cfg, latestYear, s));
      sKeyR.set(k, (sKeyR.get(k) ?? 0) + standingRaw(cfg, s));
    }
  }
  const coachYearW: YearMap = new Map();
  const coachYearR: YearMap = new Map();
  for (const a of data.coaches) {
    if (!a.club_name) continue;
    if (source !== "all" && source !== "continental" && a.module !== source) continue;
    if (source === "continental") continue;
    const k = `${a.season_year}|${a.module}|${a.club_name}`;
    addYM(coachYearW, a.season_year, a.name, sKeyW.get(k) ?? 0);
    addYM(coachYearR, a.season_year, a.name, sKeyR.get(k) ?? 0);
  }
  const maps = { clubYearW, clubYearR, countryYearW, countryYearR, coachYearW, coachYearR };
  _yearMapsCacheMap.set(source, { key: data, cfg, maps });
  return maps;
}


export function rankIn(inner: Map<string, number> | undefined, name: string): number | null {
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
  yearW: Map<number, number>,
  yearR: Map<number, number>,
  yearMapW: YearMap,
  yearMapR: YearMap,
  name: string,
): ChartPoint[] {
  const years = new Set<number>([...yearW.keys(), ...yearR.keys()]);
  return [...years]
    .map((year) => ({
      year,
      weighted: yearW.get(year) ?? 0,
      raw: yearR.get(year) ?? 0,
      positionWeighted: rankIn(yearMapW.get(year), name),
      positionRaw: rankIn(yearMapR.get(year), name),
    }))
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
    division_label: s.division_label ?? null,
    position: s.position,
    is_champion: s.is_champion,
    weighted: standingWeighted(cfg, latestYear, s),
    raw: standingRaw(cfg, s),
  }));

  const continental: ContinentalAppearance[] = cont.map((c) => {
    const opponent = c.team1 === name ? c.team2 : c.team1;
    return { year: c.season_year, competition: c.competition, opponent, won: c.winner === name };
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
    totalRaw += s.raw;
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

  const byYearW = new Map<number, number>();
  const byYearR = new Map<number, number>();
  for (const s of seasons) {
    byYearW.set(s.year, (byYearW.get(s.year) ?? 0) + s.weighted);
    byYearR.set(s.year, (byYearR.get(s.year) ?? 0) + s.raw);
  }
  for (const c of continental) {
    const { weight } = cfgTitleWeight(cfg, c.competition);
    const compW = cfg.competitionWeights.continental * cfgDecay(cfg, c.year, latestYear);
    byYearW.set(c.year, (byYearW.get(c.year) ?? 0) + weight * compW * (c.won ? 1 : 0.3));
    byYearR.set(c.year, (byYearR.get(c.year) ?? 0) + (c.won ? 200 : 50));
  }
  const { clubYearW, clubYearR } = buildYearMaps(data, cfg);

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
    chart: chartWithRanks(byYearW, byYearR, clubYearW, clubYearR, name),
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

  const ptKeyW = new Map<string, number>();
  const ptKeyR = new Map<string, number>();
  for (const s of data.standings) {
    const k = `${s.season_year}|${s.module}|${s.club_name}`;
    ptKeyW.set(k, (ptKeyW.get(k) ?? 0) + standingWeighted(cfg, latestYear, s));
    ptKeyR.set(k, (ptKeyR.get(k) ?? 0) + standingRaw(cfg, s));
  }

  const seasons: CoachSeasonRow[] = assigns.map((a) => {
    const k = `${a.season_year}|${a.module}|${a.club_name ?? ""}`;
    return {
      year: a.season_year,
      module: a.module,
      club_name: a.club_name,
      champion: a.club_name ? championKey.has(k) : false,
      weighted: a.club_name ? ptKeyW.get(k) ?? 0 : 0,
      raw: a.club_name ? ptKeyR.get(k) ?? 0 : 0,
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
  let totalRaw = 0;
  let titles = 0;
  for (const s of seasons) {
    totalWeighted += s.weighted;
    totalRaw += s.raw;
    if (s.champion) titles++;
  }
  for (const t of continentalTitles) if (t.role === "winner") titles++;

  const clubs = [...new Set(assigns.map((a) => a.club_name).filter(Boolean) as string[])];
  const byYearW = new Map<number, number>();
  const byYearR = new Map<number, number>();
  for (const s of seasons) {
    byYearW.set(s.year, (byYearW.get(s.year) ?? 0) + s.weighted);
    byYearR.set(s.year, (byYearR.get(s.year) ?? 0) + s.raw);
  }

  const { coachYearW, coachYearR } = buildYearMaps(data, cfg);

  return {
    name,
    seasons: seasons.sort((a, b) => b.year - a.year),
    clubs,
    totalWeighted,
    totalRaw,
    titles,
    seasonsCount: new Set(seasons.map((s) => s.year)).size,
    chart: chartWithRanks(byYearW, byYearR, coachYearW, coachYearR, name),
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

  const clubAgg = new Map<string, { weighted: number; raw: number; titles: number }>();
  const byYearW = new Map<number, number>();
  const byYearR = new Map<number, number>();
  const years = new Set<number>();

  for (const s of data.standings) {
    if (!clubSet.has(s.club_name)) continue;
    const w = standingWeighted(cfg, latestYear, s);
    const r = standingRaw(cfg, s);
    const cur = clubAgg.get(s.club_name) ?? { weighted: 0, raw: 0, titles: 0 };
    cur.weighted += w;
    cur.raw += r;
    if (s.is_champion) cur.titles++;
    clubAgg.set(s.club_name, cur);
    byYearW.set(s.season_year, (byYearW.get(s.season_year) ?? 0) + w);
    byYearR.set(s.season_year, (byYearR.get(s.season_year) ?? 0) + r);
    years.add(s.season_year);
  }
  for (const c of data.continental) {
    const club = clubSet.has(c.team1 ?? "") ? c.team1 : clubSet.has(c.team2 ?? "") ? c.team2 : null;
    if (!club) continue;
    const { weight } = cfgTitleWeight(cfg, c.competition);
    const compW = cfg.competitionWeights.continental * cfgDecay(cfg, c.season_year, latestYear);
    const won = c.winner === club;
    const w = weight * compW * (won ? 1 : 0.3);
    const r = won ? 200 : 50;
    const cur = clubAgg.get(club) ?? { weighted: 0, raw: 0, titles: 0 };
    cur.weighted += w;
    cur.raw += r;
    if (won) cur.titles++;
    clubAgg.set(club, cur);
    byYearW.set(c.season_year, (byYearW.get(c.season_year) ?? 0) + w);
    byYearR.set(c.season_year, (byYearR.get(c.season_year) ?? 0) + r);
    years.add(c.season_year);
  }

  const clubs = [...clubAgg.entries()]
    .map(([n, v]) => ({ name: n, weighted: v.weighted, raw: v.raw, titles: v.titles }))
    .sort((a, b) => b.weighted - a.weighted);

  const { countryYearW, countryYearR } = buildYearMaps(data, cfg);

  return {
    name,
    clubs,
    totalWeighted: clubs.reduce((a, c) => a + c.weighted, 0),
    totalRaw: clubs.reduce((a, c) => a + c.raw, 0),
    titles: clubs.reduce((a, c) => a + c.titles, 0),
    seasonsActive: years.size,
    chart: chartWithRanks(byYearW, byYearR, countryYearW, countryYearR, name),
  };
}
