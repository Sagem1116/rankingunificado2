
# FM World Rankings — Plano de Construção

App web profissional e responsiva para Football Manager: base de dados histórica mundial de clubes, treinadores e países, com importação de Excel por época, validação automática, rankings (brutos e ponderados), perfis detalhados, Hall of Fame e sistema de pesos 100% configurável.

Dada a dimensão, divido em **fases**. Cada fase é entregável e utilizável. Começamos pela Fase 1; sigo para as seguintes na mesma ou em mensagens seguintes conforme o teu feedback.

## Estrutura de dados confirmada (dos teus ficheiros)

```text
dados_superleague.xlsx
  Equipas_Pais   -> Clube, Pais
  Ranking        -> Divisao(1-11), Pos, Inf(C/P/D), Equipa, J, Vitória, VP, Penáltis, D, GM, GS, DG, Pts
  Treinadores    -> Inf, Nome, Nac, Clube
  Pesos_Fixos    -> Divisao, Peso
  Jogadores      -> (estatísticas individuais)

dados_ligas_nacionais.xlsx
  Ligas Nacionais      -> Divisao(nome liga), Pos, Inf(C/P/D/UCL/UEL/UECL), Equipa, J,V,E,D,DG,Pts
  Compts Continentais  -> Competição, Equipa 1, Resultado, Equipa 2  (finais/jogos)
  Compts Seleções      -> Competição, Equipa 1, Treinador 1, Resultado, Equipa 2, Treinador 2
  Treinadores          -> Inf, Nome, Nac, Clube
  Marcadores / Assistentes / Melhor Jogador
```

Regra crítica: **Campeão = linha com `C` na coluna `Inf`**, não necessariamente `Pos=1`.

## Fase 1 — Fundação (esta fase)
- Ativar **Lovable Cloud** (base de dados persistente).
- Modelo de dados escalável para centenas de épocas: tabelas `seasons`, `clubs`, `coaches`, `countries`, `standings` (SuperLeague + Ligas Nacionais), `continental_results`, `titles`, `imports`, e tabelas de configuração (`weight_profiles`, `competition_weights`, `division_weights`, `title_weights`, `position_points`, `decay_settings`, `world_formula`).
- **Importação de Excel** no browser (parsing das folhas) + envio para o Cloud, com cada importação = 1 época (escolhida pelo utilizador, ex. 2030). Nunca substitui épocas anteriores.
- **Validação automática** com avisos Verdes / Amarelos (continua com defaults) / Vermelhos (bloqueia).
- **Dashboard** inicial com Melhor Clube / Treinador / País do Mundo (após primeira importação).
- Design system moderno (dark + light), inspirado em Sofascore/Fotmob, com tokens semânticos.

## Fase 2 — Rankings
- Módulos SuperLeague, Ligas Nacionais, Competições Continentais.
- Rankings Brutos e Ponderados para Clubes, Países e Treinadores.
- Rankings Mundiais Unificados (combina os 3 módulos via fórmula configurável).
- Recálculo automático ao alterar pesos (sem novo upload).

## Fase 3 — Perfis
- Páginas de Clube, Treinador e País: dados gerais, evolução histórica (gráficos), históricos de classificações/títulos, estatísticas.
- Hall of Fame (clubes, treinadores, países).

## Fase 4 — Configuração avançada e exportação
- Páginas de Configuração: Pesos Competições/Divisões/Títulos, Pontos por Posição, Desvalorização temporal, Fórmula Mundial.
- Perfis de configuração (UEFA, FIFA, FM, Personalizado) trocáveis num clique.
- Exportação para Excel e PDF; filtros avançados, pesquisa rápida.

## Notas técnicas
- React + TypeScript + TanStack Start + Lovable Cloud (Supabase).
- Parsing Excel com `xlsx` no cliente; escrita via server functions.
- Cálculos de ranking inicialmente no cliente/server function sobre dados do Cloud; otimizável com views/materialização se necessário para escala.

Confirmas este faseamento (e posso ativar o Lovable Cloud) para eu começar já a Fase 1?
