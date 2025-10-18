import { BrowserRouter, Routes, Route } from "react-router-dom";
import IndexAvarias from "./pages/avarias";
import IndexConferencias from "./pages/conferencias";
import IndexVencimentos from "./pages/vencimentos";
import Layout from "./pages/layout";
import Login from "./pages/login/index";
import IndexProfile from "./pages/profile/index";
import ProtectedRoute from "./pages/protect";
import { ConferenciaCalendario } from "./pages/metas/conferenciaCalendario";
import { useAuthStore } from "./pages/authStore";
import { IndicadorAvaria } from "./pages/metas/avariasMetas";
import IndexMetas from "./pages/metas";
import Tarefas from "./pages/tarefas";
import VisualizarVencimentos from "./pages/vencimentos/visualizar";

function App() {
  const checkToken = useAuthStore.getState().checkTokenValidity;
  checkToken();
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota padrão */}

        {/* Outras rotas */}
        <Route
          path="/avarias"
          element={
            <ProtectedRoute>
              <Layout pagina={<IndexAvarias />} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/conferencias"
          element={
            <ProtectedRoute>
              <Layout pagina={<IndexConferencias />} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vencimentos"
          element={
            <ProtectedRoute>
              <Layout pagina={<IndexVencimentos />} />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout pagina={<IndexProfile />} />{" "}
            </ProtectedRoute>
          }
        />
        <Route
          path="/metas/conferencia"
          element={
            <Layout
              pagina={
                <ProtectedRoute>
                  <ConferenciaCalendario />{" "}
                </ProtectedRoute>
              }
            />
          }
        />
        <Route
          path="/metas/avarias"
          element={<Layout pagina={<IndicadorAvaria />} />}
        />
        <Route
          path="/metas"
          element={
            <Layout
              pagina={
                <ProtectedRoute>
                  <IndexMetas />
                </ProtectedRoute>
              }
            />
          }
        />
        {/* Rota "catch all" para não encontradas */}

        <Route
          path="/"
          element={
            <Layout
              pagina={
                <ProtectedRoute>
                  <IndexVencimentos />
                </ProtectedRoute>
              }
            />
          }
        />
        <Route
          path="/tarefas"
          element={
            <Layout
              pagina={
                <ProtectedRoute>
                  <Tarefas />
                </ProtectedRoute>
              }
            />
          }
        />
        <Route
          path="/vencimentos/visualizar"
          element={<VisualizarVencimentos />}
        />

        <Route path="*" element={<h1>404 - Página não encontrada</h1>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
