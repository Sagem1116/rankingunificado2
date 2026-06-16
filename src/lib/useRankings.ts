import { useQuery } from "@tanstack/react-query";
import { fetchAllData } from "./fm-db";
import { computeRankings } from "./fm-rankings";

export function useRankings() {
  return useQuery({
    queryKey: ["fm-all-data"],
    queryFn: async () => {
      const data = await fetchAllData();
      const ranks = computeRankings({
        standings: data.standings,
        continental: data.continental,
        coaches: data.coaches,
        clubCountry: data.clubCountry,
      });
      return { data, ranks };
    },
  });
}