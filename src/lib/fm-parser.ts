import * as XLSX from "xlsx";

export type Severity = "green" | "yellow" | "red";

export interface ValidationMessage {
  level: Severity;
  text: string;
}

export interface ParsedStanding {
  module: "superleague" | "national";
  division_label: string | null;
  division_num: number | null;
  position: number | null;
  info: string | null;
  club_name: string;
  played: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  gf: number | null;
  ga: number | null;
  gd: number | null;
  points: number | null;
  is_champion: boolean;
}

export interface ParsedCoach {
  module: "superleague" | "national";
  name: string;
  nationality: string | null;
  club_name: string | null;
  info: string | null;
}

export interface ParsedContinental {
  competition: string;
  team1: string | null;
  team2: string | null;
  result: string | null;
  winner: string | null;
}

export interface ParsedPlayer {
  idu: string | null;
  name: string;
  league: string | null;
  club_name: string | null;
  age: number | null;
  gls: number;
  ast: number;
  salary: number;
  ra: number;
  rm: number;
  ca: number;
  cp: number;
  vp: number;
  info: string | null;
  rec: string | null;
}

export interface ParsedData {
  teamCountry: { club: string; country: string | null }[];
  divisionWeights: { division_num: number; weight: number }[];
  standings: ParsedStanding[];
  coaches: ParsedCoach[];
  continental: ParsedContinental[];
  players: ParsedPlayer[];
}

export interface ParseResult {
  kind: "superleague" | "national";
  data: ParsedData;
  messages: ValidationMessage[];
  blocked: boolean;
}

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

function findCol(row: Record<string, unknown>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const n = norm(cand);
    const hit = keys.find((k) => norm(k) === n);
    if (hit) return hit;
  }
  // partial match
  for (const cand of candidates) {
    const n = norm(cand);
    const hit = keys.find((k) => norm(k).includes(n));
    if (hit) return hit;
  }
  return null;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function num0(v: unknown): number {
  const n = toNum(v);
  return n == null ? 0 : n;
}

function parseSalario(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const s = String(v).replace(/€/g, "").replace(/p\/?\s*a/gi, "").replace(/\s/g, "").replace(/,/g, "").trim();
  if (!s) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function parseVP(v: unknown): number {
  if (v === null || v === undefined) return 0;
  let s = String(v).replace(/€/g, "").replace(/\s/g, "").trim();
  if (!s) return 0;
  let mult = 1;
  if (s.endsWith("M")) { mult = 1_000_000; s = s.slice(0, -1); }
  else if (s.endsWith("m") || s.endsWith("k") || s.endsWith("K")) { mult = 1_000; s = s.slice(0, -1); }
  s = s.replace(/,/g, ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n * mult : 0;
}

function sheetRows(wb: XLSX.WorkBook, name: string): Record<string, unknown>[] | null {
  const target = wb.SheetNames.find((s) => norm(s) === norm(name));
  if (!target) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[target], { defval: null });
}

function parseScore(result: string | null, t1: string | null, t2: string | null): string | null {
  if (!result) return null;
  const m = String(result).match(/(\d+)\s*[-:xX]\s*(\d+)/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === b) return null;
  return a > b ? t1 : t2;
}

/** Detect whether a workbook is the SuperLeague file or the National leagues file. */
export function detectKind(wb: XLSX.WorkBook): "superleague" | "national" {
  const names = wb.SheetNames.map(norm);
  if (names.some((n) => n.includes("equipas_pais") || n.includes("pesos_fixos"))) return "superleague";
  if (names.some((n) => n.includes("ligas nacionais") || n.includes("continenta"))) return "national";
  // fall back: ranking sheet => superleague
  if (names.some((n) => n === "ranking")) return "superleague";
  return "national";
}

export function parseWorkbook(buffer: ArrayBuffer, filename = ""): ParseResult {
  const messages: ValidationMessage[] = [];
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "array" });
  } catch {
    return {
      kind: "national",
      data: { teamCountry: [], divisionWeights: [], standings: [], coaches: [], continental: [], players: [] },
      messages: [{ level: "red", text: "✖ Ficheiro corrompido ou ilegível" }],
      blocked: true,
    };
  }

  const kind = detectKind(wb);
  const data: ParsedData = {
    teamCountry: [],
    divisionWeights: [],
    standings: [],
    coaches: [],
    continental: [],
    players: [],
  };

  // --- Equipas_Pais (superleague) ---
  const ep = sheetRows(wb, "Equipas_Pais");
  if (ep && ep.length) {
    const clubCol = findCol(ep[0], ["Clube", "Equipa"]);
    const countryCol = findCol(ep[0], ["Pais", "País", "Country"]);
    if (clubCol) {
      for (const r of ep) {
        const club = String(r[clubCol] ?? "").trim();
        if (!club) continue;
        data.teamCountry.push({ club, country: countryCol ? (String(r[countryCol] ?? "").trim() || null) : null });
      }
    }
  }

  // --- Pesos_Fixos (superleague division weights) ---
  const pf = sheetRows(wb, "Pesos_Fixos");
  if (pf && pf.length) {
    const divCol = findCol(pf[0], ["Divisao", "Divisão"]);
    const wCol = findCol(pf[0], ["Peso", "Weight"]);
    if (divCol && wCol) {
      for (const r of pf) {
        const d = toNum(r[divCol]);
        const w = toNum(r[wCol]);
        if (d != null && w != null) data.divisionWeights.push({ division_num: d, weight: w });
      }
    }
  } else if (kind === "superleague") {
    messages.push({ level: "yellow", text: "⚠ Folha 'Pesos_Fixos' não encontrada — serão usados pesos padrão" });
  }

  // --- Ranking (superleague standings) ---
  if (kind === "superleague") {
    const rk = sheetRows(wb, "Ranking");
    if (!rk || !rk.length) {
      messages.push({ level: "red", text: "✖ Folha obrigatória 'Ranking' inexistente ou vazia" });
    } else {
      parseStandings(rk, "superleague", data, messages);
    }
  }

  // --- Ligas Nacionais (national standings) ---
  if (kind === "national") {
    const ln = sheetRows(wb, "Ligas Nacionais");
    if (!ln || !ln.length) {
      messages.push({ level: "red", text: "✖ Folha obrigatória 'Ligas Nacionais' inexistente ou vazia" });
    } else {
      parseStandings(ln, "national", data, messages);
    }

    // --- Compts Continentais ---
    const cc = sheetRows(wb, "Compts Continentais");
    if (cc && cc.length) {
      const compCol = findCol(cc[0], ["Competição", "Competicao", "Competition"]);
      const t1Col = findCol(cc[0], ["Equipa 1", "Equipa1"]);
      const t2Col = findCol(cc[0], ["Equipa 2", "Equipa2"]);
      const resCol = findCol(cc[0], ["Resultado", "Result"]);
      if (compCol) {
        for (const r of cc) {
          const competition = String(r[compCol] ?? "").trim();
          if (!competition) continue;
          const team1 = t1Col ? (String(r[t1Col] ?? "").trim() || null) : null;
          const team2 = t2Col ? (String(r[t2Col] ?? "").trim() || null) : null;
          const result = resCol ? (String(r[resCol] ?? "").trim() || null) : null;
          data.continental.push({ competition, team1, team2, result, winner: parseScore(result, team1, team2) });
        }
      }
    }
  }

  // --- Treinadores ---
  const tr = sheetRows(wb, "Treinadores");
  if (tr && tr.length) {
    const nameCol = findCol(tr[0], ["Nome", "Name"]);
    const nacCol = findCol(tr[0], ["Nac", "Nacionalidade"]);
    const clubCol = findCol(tr[0], ["Clube", "Equipa"]);
    const infCol = findCol(tr[0], ["Inf", "Info"]);
    if (nameCol) {
      for (const r of tr) {
        const name = String(r[nameCol] ?? "").trim();
        if (!name || name.startsWith("http")) continue;
        data.coaches.push({
          module: kind === "superleague" ? "superleague" : "national",
          name,
          nationality: nacCol ? (String(r[nacCol] ?? "").trim() || null) : null,
          club_name: clubCol ? (String(r[clubCol] ?? "").trim() || null) : null,
          info: infCol ? (String(r[infCol] ?? "").trim() || null) : null,
        });
      }
    }
  } else {
    messages.push({ level: "yellow", text: "⚠ Folha 'Treinadores' não encontrada — clubes ficam sem treinador associado" });
  }

  // --- Jogadores (superleague) ---
  if (kind === "superleague") {
    const jg = sheetRows(wb, "Jogadores");
    if (jg && jg.length) {
      const nameCol = findCol(jg[0], ["Nome", "Name"]);
      const iduCol = findCol(jg[0], ["IDU", "UID"]);
      const ligaCol = findCol(jg[0], ["Liga", "League"]);
      const clubCol = findCol(jg[0], ["Clube", "Equipa"]);
      const ageCol = findCol(jg[0], ["Idade", "Age"]);
      const glsCol = findCol(jg[0], ["Gls", "Golos"]);
      const astCol = findCol(jg[0], ["Ast", "Assist"]);
      const salCol = findCol(jg[0], ["Salário", "Salario", "Salary"]);
      const raCol = findCol(jg[0], ["R.A.", "RA"]);
      const rmCol = findCol(jg[0], ["R.M.", "RM"]);
      const caCol = findCol(jg[0], ["C.A.", "CA"]);
      const cpCol = findCol(jg[0], ["C.P.", "CP"]);
      const vpCol = findCol(jg[0], ["VP", "Valor"]);
      const infCol = findCol(jg[0], ["Inf", "Info"]);
      const recCol = findCol(jg[0], ["Rec"]);
      if (nameCol) {
        for (const r of jg) {
          const name = String(r[nameCol] ?? "").trim();
          if (!name || name.startsWith("http")) continue;
          data.players.push({
            idu: iduCol ? (String(r[iduCol] ?? "").trim() || null) : null,
            name,
            league: ligaCol ? (String(r[ligaCol] ?? "").trim() || null) : null,
            club_name: clubCol ? (String(r[clubCol] ?? "").trim() || null) : null,
            age: ageCol ? toNum(r[ageCol]) : null,
            gls: glsCol ? num0(r[glsCol]) : 0,
            ast: astCol ? num0(r[astCol]) : 0,
            salary: salCol ? parseSalario(r[salCol]) : 0,
            ra: raCol ? num0(r[raCol]) : 0,
            rm: rmCol ? num0(r[rmCol]) : 0,
            ca: caCol ? num0(r[caCol]) : 0,
            cp: cpCol ? num0(r[cpCol]) : 0,
            vp: vpCol ? parseVP(r[vpCol]) : 0,
            info: infCol ? (String(r[infCol] ?? "").trim() || null) : null,
            rec: recCol ? (String(r[recCol] ?? "").trim() || null) : null,
          });
        }
      }
    } else {
      messages.push({ level: "yellow", text: "⚠ Folha 'Jogadores' não encontrada — páginas de jogadores ficam vazias para esta época" });
    }
  }

  const blocked = messages.some((m) => m.level === "red");
  if (!blocked) {
    messages.unshift({ level: "green", text: "✓ Dados validados com sucesso" });
  }
  return { kind, data, messages, blocked };
}

function parseStandings(
  rows: Record<string, unknown>[],
  module: "superleague" | "national",
  data: ParsedData,
  messages: ValidationMessage[],
) {
  const first = rows[0];
  const teamCol = findCol(first, ["Equipa", "Clube", "Team"]);
  const posCol = findCol(first, ["Pos", "Posição", "Posicao"]);
  const ptsCol = findCol(first, ["Pts", "Pontos", "Points"]);
  const divCol = findCol(first, ["Divisao", "Divisão", "Liga"]);
  const infCol = findCol(first, ["Inf", "Info"]);
  const jCol = findCol(first, ["J", "Jogos"]);
  const vCol = findCol(first, ["Vitória", "Vitoria", "V"]);
  const eCol = findCol(first, ["E", "Empates"]);
  const dCol = findCol(first, ["D", "Derrotas"]);
  const gmCol = findCol(first, ["GM"]);
  const gsCol = findCol(first, ["GS"]);
  const dgCol = findCol(first, ["DG"]);

  if (!teamCol) messages.push({ level: "red", text: "✖ Coluna 'Equipa' não encontrada" });
  if (!posCol) messages.push({ level: "red", text: "✖ Coluna 'Posição' não encontrada" });
  if (!ptsCol) messages.push({ level: "red", text: "✖ Coluna 'Pontos' não encontrada" });
  if (!teamCol || !posCol || !ptsCol) return;

  let count = 0;
  for (const r of rows) {
    const club_name = String(r[teamCol] ?? "").trim();
    if (!club_name) continue;
    const info = infCol ? (String(r[infCol] ?? "").trim() || null) : null;
    const divRaw = divCol ? r[divCol] : null;
    const division_num = module === "superleague" ? toNum(divRaw) : null;
    const division_label = divRaw != null ? String(divRaw).trim() : null;
    data.standings.push({
      module,
      division_label,
      division_num,
      position: toNum(r[posCol]),
      info,
      club_name,
      played: jCol ? toNum(r[jCol]) : null,
      wins: vCol ? toNum(r[vCol]) : null,
      draws: eCol ? toNum(r[eCol]) : null,
      losses: dCol ? toNum(r[dCol]) : null,
      gf: gmCol ? toNum(r[gmCol]) : null,
      ga: gsCol ? toNum(r[gsCol]) : null,
      gd: dgCol ? toNum(r[dgCol]) : null,
      points: toNum(r[ptsCol]),
      // Champion = row flagged with "C" in Info, NOT necessarily position 1
      is_champion: norm(info) === "c",
    });
    count++;
  }
  if (count === 0) messages.push({ level: "red", text: "✖ Não existem classificações na folha" });
}