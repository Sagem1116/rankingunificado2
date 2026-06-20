import { useQuery } from "@tanstack/react-query";
import { fetchAllData } from "./fm-db";
import { computeRankings } from "./fm-rankings";
import { fetchActiveConfig } from "./fm-config-db";

export function useRankings() {
  return useQuery({
    queryKey: ["fm-all-data"],
    queryFn: async () => {
      const [data, cfg] = await Promise.all([fetchAllData(), fetchActiveConfig()]);
      const ranks = computeRankings(
        {
          standings: data.standings,
          continental: data.continental,
          coaches: data.coaches,
          clubCountry: data.clubCountry,
        },
        cfg.config,
      );
      return { data, ranks, config: cfg.config, activeProfileId: cfg.activeId };
    },
    staleTime: 24 * 60 * 60 * 1000, // 24h — invalidated explicitly on import/config save
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });
}

export function useActiveConfig() {
  return useQuery({
    queryKey: ["fm-config"],
    queryFn: fetchActiveConfig,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}