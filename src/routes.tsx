// src/routes.ts
import IndexAvarias from "./pages/avarias";
import IndexConferencias from "./pages/conferencias";
import IndexVencimentos from "./pages/vencimentos";
import IndexProfile from "./pages/profile/index";
import Layout from "./pages/layout";
import Login from "./pages/login/index";
import Tarefas from "./pages/tarefas";
import VisualizarVencimentos from "./pages/vencimentos/visualizar";
import IndexPoints from "./pages/rank/index";
import IndexMetas from "./pages/metas";
import { ConferenciaCalendario } from "./pages/metas/conferenciaCalendario";
import { IndicadorAvaria } from "./pages/metas/avariasMetas";
import LogsPagina from "./pages/admin/logs";
import PointsPagina from "./pages/admin/points";
import type { JSX } from "react";
import AdminPoints from "./pages/admin/rank";
import AdminPointsAnalytics from "./pages/admin/points/analise";

export interface AppRoute {
  path: string;
  element: JSX.Element;
  protected?: boolean;
  adminOnly?: boolean;
}

export const routes: AppRoute[] = [
  { path: "/login", element: <Login /> },

  // Rotas protegidas
  {
    path: "/",
    element: <Layout pagina={<IndexVencimentos />} />,
    protected: true,
  },
  {
    path: "/avarias",
    element: <Layout pagina={<IndexAvarias />} />,
    protected: true,
  },
  {
    path: "/conferencias",
    element: <Layout pagina={<IndexConferencias />} />,
    protected: true,
  },
  {
    path: "/vencimentos",
    element: <Layout pagina={<IndexVencimentos />} />,
    protected: true,
  },
  {
    path: "/profile",
    element: <Layout pagina={<IndexProfile />} />,
    protected: true,
  },
  {
    path: "/metas",
    element: <Layout pagina={<IndexMetas />} />,
    protected: true,
  },
  {
    path: "/metas/conferencia",
    element: <Layout pagina={<ConferenciaCalendario />} />,
    protected: true,
  },
  {
    path: "/metas/avarias",
    element: <Layout pagina={<IndicadorAvaria />} />,
    protected: true,
  },
  {
    path: "/tarefas",
    element: <Layout pagina={<Tarefas />} />,
    protected: true,
  },
  {
    path: "/vencimentos/visualizar",
    element: <VisualizarVencimentos />,
    protected: false,
  },
  {
    path: "/pontos",
    element: <Layout pagina={<IndexPoints />} />,
    protected: true,
  },

  // Rotas admin
  {
    path: "/admin/logs",
    element: <Layout pagina={<LogsPagina />} />,
    protected: true,
    adminOnly: true,
  },
  {
    path: "/admin/pontos",
    element: <Layout pagina={<PointsPagina />} />,
    protected: true,
    adminOnly: true,
  },
  {
    path: "/admin/rank",
    element: <Layout pagina={<AdminPoints />} />,
    protected: true,
    adminOnly: true,
  },
  {
    path: "/admin/rank/analise",
    element: <Layout pagina={<AdminPointsAnalytics />} />,
    protected: true,
    adminOnly: true,
  },

  // Catch-all
  { path: "*", element: <h1>404 - Página não encontrada</h1> },
];
