import { supabase } from "@/integrations/supabase/client";
import type { ParseResult } from "./fm-parser";
import type { StandingRow, ContinentalRow, CoachRow } from "./fm-rankings";

async function chunkInsert(table: string, rows: Record<string, unknown>[]) {
  const size = 500;
  for (let i = 0; i < rows.length; i += size) {
    const slice = rows.slice(i, i + size);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from(table).insert(slice);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

export interface ImportSummary {
  seasonYear: number;
  module: string;
  standings: number;
  coaches: number;
  continental: number;
}

export async function importSeason(parse: ParseResult, year: number, filename: string): Promise<ImportSummary> {
  const module = parse.kind; // 'superleague' | 'national'

  // 1. Ensure season (never overwrite other seasons)
  let { data: season } = await supabase.from("seasons").select("id").eq("year", year).maybeSingle();
  if (!season) {
    const ins = await supabase.from("seasons").insert({ year, label: String(year) }).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    season = ins.data;
  }
  const seasonId = season!.id;

  // 2. Re-import of same module+season: clear that slice only
  await supabase.from("standings").delete().eq("season_id", seasonId).eq("module", module);
  await supabase.from("coach_assignments").delete().eq("season_id", seasonId).eq("module", module);
  if (module === "national") {
    await supabase.from("continental_results").delete().eq("season_id", seasonId);
  }

  // 3. Upsert countries
  const countryNames = [...new Set(parse.data.teamCountry.map((t) => t.country).filter(Boolean) as string[])];
  if (countryNames.length) {
    await supabase.from("countries").upsert(countryNames.map((name) => ({ name })), { onConflict: "name" });
  }
  const { data: countryRows } = await supabase.from("countries").select("id,name");
  const countryMap = new Map((countryRows ?? []).map((c) => [c.name, c.id]));

  // 4. Upsert clubs (from teamCountry + standings + continental)
  const clubNames = new Set<string>();
  parse.data.teamCountry.forEach((t) => clubNames.add(t.club));
  parse.data.standings.forEach((s) => clubNames.add(s.club_name));
  parse.data.continental.forEach((c) => {
    if (c.team1) clubNames.add(c.team1);
    if (c.team2) clubNames.add(c.team2);
  });
  const clubCountryLookup = new Map(parse.data.teamCountry.map((t) => [t.club, t.country]));
  const clubPayload = [...clubNames].map((name) => {
    const country = clubCountryLookup.get(name);
    const cid = country ? countryMap.get(country) : undefined;
    return cid ? { name, country_id: cid } : { name };
  });
  if (clubPayload.length) {
    await supabase.from("clubs").upsert(clubPayload, { onConflict: "name", ignoreDuplicates: false });
  }
  const { data: clubRows } = await supabase.from("clubs").select("id,name");
  const clubMap = new Map((clubRows ?? []).map((c) => [c.name, c.id]));

  // 5. Standings
  const standingsPayload = parse.data.standings.map((s) => ({
    season_id: seasonId,
    module,
    division_label: s.division_label,
    division_num: s.division_num,
    position: s.position,
    info: s.info,
    club_id: clubMap.get(s.club_name) ?? null,
    club_name: s.club_name,
    played: s.played,
    wins: s.wins,
    draws: s.draws,
    losses: s.losses,
    gf: s.gf,
    ga: s.ga,
    gd: s.gd,
    points: s.points,
    is_champion: s.is_champion,
  }));
  await chunkInsert("standings", standingsPayload);

  // 6. Continental
  if (module === "national" && parse.data.continental.length) {
    const contPayload = parse.data.continental.map((c) => ({
      season_id: seasonId,
      competition: c.competition,
      team1: c.team1,
      team2: c.team2,
      result: c.result,
      club1_id: c.team1 ? clubMap.get(c.team1) ?? null : null,
      club2_id: c.team2 ? clubMap.get(c.team2) ?? null : null,
      winner_club_id: c.winner ? clubMap.get(c.winner) ?? null : null,
    }));
    await chunkInsert("continental_results", contPayload);
  }

  // 7. Coaches + assignments
  const uniqueCoaches = new Map<string, { name: string; nationality: string | null }>();
  parse.data.coaches.forEach((c) => {
    uniqueCoaches.set(`${c.name}|${c.nationality ?? ""}`, { name: c.name, nationality: c.nationality });
  });
  if (uniqueCoaches.size) {
    await supabase.from("coaches").upsert([...uniqueCoaches.values()], { onConflict: "name,nationality" });
  }
  const { data: coachRows } = await supabase.from("coaches").select("id,name,nationality");
  const coachMap = new Map((coachRows ?? []).map((c) => [`${c.name}|${c.nationality ?? ""}`, c.id]));
  const assignPayload = parse.data.coaches
    .map((c) => {
      const coachId = coachMap.get(`${c.name}|${c.nationality ?? ""}`);
      if (!coachId) return null;
      return {
        season_id: seasonId,
        module,
        coach_id: coachId,
        coach_name: c.name,
        club_id: c.club_name ? clubMap.get(c.club_name) ?? null : null,
        club_name: c.club_name,
        info: c.info,
      };
    })
    .filter(Boolean) as Record<string, unknown>[];
  if (assignPayload.length) await chunkInsert("coach_assignments", assignPayload);

  // 8. Import log
  await supabase.from("imports").insert({
    season_id: seasonId,
    module,
    filename,
    status: parse.blocked ? "blocked" : "ok",
    warnings: parse.messages as unknown as object[],
  });

  return {
    seasonYear: year,
    module,
    standings: standingsPayload.length,
    coaches: assignPayload.length,
    continental: module === "national" ? parse.data.continental.length : 0,
  };
}

export interface AllData {
  seasons: { id: string; year: number }[];
  standings: StandingRow[];
  continental: ContinentalRow[];
  coaches: CoachRow[];
  clubCountry: Record<string, string | null>;
}

export async function fetchAllData(): Promise<AllData> {
  const [{ data: seasons }, { data: clubs }, { data: countries }] = await Promise.all([
    supabase.from("seasons").select("id,year").order("year"),
    supabase.from("clubs").select("name,country_id"),
    supabase.from("countries").select("id,name"),
  ]);
  const seasonMap = new Map((seasons ?? []).map((s) => [s.id, s.year]));
  const countryById = new Map((countries ?? []).map((c) => [c.id, c.name]));
  const clubCountry: Record<string, string | null> = {};
  (clubs ?? []).forEach((c) => {
    clubCountry[c.name] = c.country_id ? countryById.get(c.country_id) ?? null : null;
  });

  const [{ data: standings }, { data: continental }, { data: coachAssign }] = await Promise.all([
    supabase.from("standings").select("season_id,module,division_num,position,club_name,is_champion"),
    supabase.from("continental_results").select("season_id,competition,team1,team2,winner_club_id"),
    supabase.from("coach_assignments").select("season_id,module,coach_name,club_name"),
  ]);

  // map winner_club_id back to name
  const clubIdName = new Map<string, string>();
  // we only have names in clubCountry; fetch id->name
  const { data: clubIds } = await supabase.from("clubs").select("id,name");
  (clubIds ?? []).forEach((c) => clubIdName.set(c.id, c.name));

  const standingRows: StandingRow[] = (standings ?? []).map((s) => ({
    season_year: seasonMap.get(s.season_id) ?? 0,
    module: s.module,
    division_num: s.division_num,
    position: s.position,
    club_name: s.club_name,
    is_champion: s.is_champion,
  }));
  const continentalRows: ContinentalRow[] = (continental ?? []).map((c) => ({
    season_year: seasonMap.get(c.season_id) ?? 0,
    competition: c.competition,
    team1: c.team1,
    team2: c.team2,
    winner: c.winner_club_id ? clubIdName.get(c.winner_club_id) ?? null : null,
  }));
  const coachRows: CoachRow[] = (coachAssign ?? []).map((c) => ({
    season_year: seasonMap.get(c.season_id) ?? 0,
    module: c.module,
    name: c.coach_name,
    nationality: null,
    club_name: c.club_name,
  }));

  return {
    seasons: (seasons ?? []).map((s) => ({ id: s.id, year: s.year })),
    standings: standingRows,
    continental: continentalRows,
    coaches: coachRows,
    clubCountry,
  };
}