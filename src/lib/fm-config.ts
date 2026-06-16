import {
  DEFAULT_POSITION_POINTS,
  DEFAULT_DIVISION_WEIGHTS,
  DEFAULT_COMPETITION_WEIGHTS,
  DEFAULT_TITLE_WEIGHTS,
  NATIONAL_CHAMPION_BONUS,
  SUPERLEAGUE_CHAMPION_BONUS,
} from "./fm-defaults";

export interface FmConfig {
  positionPoints: Record<number, number>;
  divisionWeights: Record<number, number>;
  competitionWeights: { national: number; continental: number; superleague: number };
  titleWeights: { match: string; label: string; weight: number }[];
  nationalChampionBonus: number;
  superleagueChampionBonus: number;
  decayPerYear: number; // 1 = sem desvalorização; 0.97 = -3%/época mais antiga
}

export const DEFAULT_CONFIG: FmConfig = {
  positionPoints: { ...DEFAULT_POSITION_POINTS },
  divisionWeights: { ...DEFAULT_DIVISION_WEIGHTS },
  competitionWeights: { ...DEFAULT_COMPETITION_WEIGHTS },
  titleWeights: DEFAULT_TITLE_WEIGHTS.map((t) => ({ ...t })),
  nationalChampionBonus: NATIONAL_CHAMPION_BONUS,
  superleagueChampionBonus: SUPERLEAGUE_CHAMPION_BONUS,
  decayPerYear: 1,
};

export function cloneConfig(c: FmConfig): FmConfig {
  return {
    positionPoints: { ...c.positionPoints },
    divisionWeights: { ...c.divisionWeights },
    competitionWeights: { ...c.competitionWeights },
    titleWeights: c.titleWeights.map((t) => ({ ...t })),
    nationalChampionBonus: c.nationalChampionBonus,
    superleagueChampionBonus: c.superleagueChampionBonus,
    decayPerYear: c.decayPerYear,
  };
}

// ---- scoring helpers driven by a config ----
export function cfgPositionPoints(cfg: FmConfig, pos: number | null | undefined): number {
  if (!pos || pos < 1) return 0;
  if (cfg.positionPoints[pos] != null) return cfg.positionPoints[pos];
  return Math.max(2, Math.round(16 - (pos - 20) * 1.2));
}

export function cfgDivisionWeight(cfg: FmConfig, div: number | null | undefined): number {
  if (!div) return 1;
  return cfg.divisionWeights[div] ?? 1;
}

export function cfgTitleWeight(cfg: FmConfig, competition: string): { label: string; weight: number } {
  const n = competition
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  for (const t of cfg.titleWeights) {
    if (n.includes(t.match)) return { label: t.label, weight: t.weight };
  }
  return { label: competition, weight: 150 };
}

export function cfgDecay(cfg: FmConfig, seasonYear: number, latestYear: number): number {
  if (cfg.decayPerYear >= 1) return 1;
  const age = Math.max(0, latestYear - seasonYear);
  return Math.pow(cfg.decayPerYear, age);
}

// ---- serialization to/from config_weights rows ----
export interface ConfigRow {
  profile_id: string;
  category: string;
  key: string;
  value: number;
}

export function configToRows(profileId: string, cfg: FmConfig): ConfigRow[] {
  const rows: ConfigRow[] = [];
  for (const [k, v] of Object.entries(cfg.positionPoints)) rows.push({ profile_id: profileId, category: "position", key: k, value: v });
  for (const [k, v] of Object.entries(cfg.divisionWeights)) rows.push({ profile_id: profileId, category: "division", key: k, value: v });
  for (const [k, v] of Object.entries(cfg.competitionWeights)) rows.push({ profile_id: profileId, category: "competition", key: k, value: v });
  for (const t of cfg.titleWeights) rows.push({ profile_id: profileId, category: "title", key: t.match, value: t.weight });
  rows.push({ profile_id: profileId, category: "bonus", key: "national", value: cfg.nationalChampionBonus });
  rows.push({ profile_id: profileId, category: "bonus", key: "superleague", value: cfg.superleagueChampionBonus });
  rows.push({ profile_id: profileId, category: "meta", key: "decayPerYear", value: cfg.decayPerYear });
  return rows;
}

export function rowsToConfig(rows: { category: string; key: string; value: number }[]): FmConfig {
  const cfg = cloneConfig(DEFAULT_CONFIG);
  if (!rows.length) return cfg;
  for (const r of rows) {
    const v = Number(r.value);
    switch (r.category) {
      case "position":
        cfg.positionPoints[Number(r.key)] = v;
        break;
      case "division":
        cfg.divisionWeights[Number(r.key)] = v;
        break;
      case "competition":
        if (r.key in cfg.competitionWeights) (cfg.competitionWeights as Record<string, number>)[r.key] = v;
        break;
      case "title": {
        const t = cfg.titleWeights.find((x) => x.match === r.key);
        if (t) t.weight = v;
        break;
      }
      case "bonus":
        if (r.key === "national") cfg.nationalChampionBonus = v;
        if (r.key === "superleague") cfg.superleagueChampionBonus = v;
        break;
      case "meta":
        if (r.key === "decayPerYear") cfg.decayPerYear = v;
        break;
    }
  }
  return cfg;
}