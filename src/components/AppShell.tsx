import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Upload,
  Trophy,
  Shield,
  Users,
  Globe2,
  Crown,
  Settings,
  Star,
  Medal,
  Award,
  TrendingUp,
  Goal,
} from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle, useThemeInit } from "./ThemeToggle";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/importar", label: "Importar Época", icon: Upload },
  { to: "/rankings", label: "Rankings Mundiais", icon: Trophy },
  { to: "/clubes", label: "Clubes", icon: Shield },
  { to: "/treinadores", label: "Treinadores", icon: Users },
  { to: "/paises", label: "Países", icon: Globe2 },
  { to: "/hall-of-fame", label: "Hall of Fame", icon: Crown },
  { to: "/configuracao", label: "Configuração", icon: Settings },
] as const;

const SUPER_LEAGUE_NAV = [
  { to: "/super-league/campeoes", label: "Histórico de Campeões", icon: Medal },
  { to: "/super-league/play-off-clubes", label: "Play-Off de Clubes", icon: TrendingUp },
  { to: "/super-league/treinador-campeoes", label: "Treinador Campeões", icon: Award },
  { to: "/super-league/play-off-treinadores", label: "Play-Off Treinadores", icon: Goal },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  useThemeInit();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <TooltipProvider delayDuration={150}>
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-2 px-5 h-16 border-b border-sidebar-border">
          <div className="flex size-9 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
            <Star className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">FM World</p>
            <p className="text-[11px] text-muted-foreground">Rankings</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
          <p className="px-3 pt-5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Super League
          </p>
          {SUPER_LEAGUE_NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-3 text-[11px] text-muted-foreground border-t border-sidebar-border">
          Base de dados histórica de Football Manager
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 md:px-6 backdrop-blur">
          <div className="md:hidden flex items-center gap-2">
            <Star className="size-5 text-primary" />
            <span className="font-bold text-sm">FM World</span>
          </div>
          <nav className="md:hidden flex items-center gap-1 overflow-x-auto">
            {[...NAV, ...SUPER_LEAGUE_NAV].map((item) => (
              <Link key={item.to} to={item.to} className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-foreground whitespace-nowrap">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
    </TooltipProvider>
  );
}