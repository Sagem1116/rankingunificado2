import {
  DEFAULT_POSITION_POINTS,
  DEFAULT_DIVISION_WEIGHTS,
  DEFAULT_COMPETITION_WEIGHTS,
  DEFAULT_TITLE_WEIGHTS,
  NATIONAL_CHAMPION_BONUS,
  SUPERLEAGUE_CHAMPION_BONUS,
} from "./fm-defaults";

export interface DecayMultipliers {
  last: number;   // última época (age 0)
  age1: number;   // há 1 época
  age2: number;   // há 2 épocas
  age3: number;   // há 3 épocas
  older: number;  // épocas mais antigas (4+)
}

export interface FmConfig {
  positionPoints: Record<number, number>;
  divisionWeights: Record<number, number>;
  competitionWeights: { national: number; continental: number; superleague: number };
  titleWeights: { match: string; label: string; weight: number }[];
  nationalChampionBonus: number;
  superleagueChampionBonus: number;
  decayMultipliers: DecayMultipliers;
}

export const DEFAULT_DECAY: DecayMultipliers = {
  last: 1,
  age1: 0.85,
  age2: 0.7,
  age3: 0.55,
  older: 0.4,
};

export const DEFAULT_CONFIG: FmConfig = {
  positionPoints: { ...DEFAULT_POSITION_POINTS },
  divisionWeights: { ...DEFAULT_DIVISION_WEIGHTS },
  competitionWeights: { ...DEFAULT_COMPETITION_WEIGHTS },
  titleWeights: DEFAULT_TITLE_WEIGHTS.map((t) => ({ ...t })),
  nationalChampionBonus: NATIONAL_CHAMPION_BONUS,
  superleagueChampionBonus: SUPERLEAGUE_CHAMPION_BONUS,
  decayMultipliers: { ...DEFAULT_DECAY },
};

export function cloneConfig(c: FmConfig): FmConfig {
  return {
    positionPoints: { ...c.positionPoints },
    divisionWeights: { ...c.divisionWeights },
    competitionWeights: { ...c.competitionWeights },
    titleWeights: c.titleWeights.map((t) => ({ ...t })),
    nationalChampionBonus: c.nationalChampionBonus,
    superleagueChampionBonus: c.superleagueChampionBonus,
    decayMultipliers: { ...c.decayMultipliers },
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
  const age = Math.max(0, latestYear - seasonYear);
  const d = cfg.decayMultipliers;
  if (age === 0) return d.last;
  if (age === 1) return d.age1;
  if (age === 2) return d.age2;
  if (age === 3) return d.age3;
  return d.older;
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
  rows.push({ profile_id: profileId, category: "decay", key: "last", value: cfg.decayMultipliers.last });
  rows.push({ profile_id: profileId, category: "decay", key: "age1", value: cfg.decayMultipliers.age1 });
  rows.push({ profile_id: profileId, category: "decay", key: "age2", value: cfg.decayMultipliers.age2 });
  rows.push({ profile_id: profileId, category: "decay", key: "age3", value: cfg.decayMultipliers.age3 });
  rows.push({ profile_id: profileId, category: "decay", key: "older", value: cfg.decayMultipliers.older });
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
        // legacy single-value decay → spread across age buckets approximately
        if (r.key === "decayPerYear" && v < 1) {
          cfg.decayMultipliers = {
            last: 1,
            age1: Math.pow(v, 1),
            age2: Math.pow(v, 2),
            age3: Math.pow(v, 3),
            older: Math.pow(v, 4),
          };
        }
        break;
      case "decay":
        if (r.key in cfg.decayMultipliers) (cfg.decayMultipliers as unknown as Record<string, number>)[r.key] = v;
        break;
    }
  }
  return cfg;
}