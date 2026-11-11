import { BrowserRouter, Routes, Route } from "react-router-dom";
import { routes } from "./routes";
import ProtectedRoute from "./pages/protect";
import { useAuthStore } from "./pages/authStore";
import { ThemeEffects } from "./theme/ThemeEffects";

function App() {
  const checkToken = useAuthStore.getState().checkTokenValidity;
  checkToken();

  return (
    <BrowserRouter>
      <ThemeEffects />
      <Routes>
        {routes.map(({ path, element, protected: isProtected, adminOnly }) => {
          const routeElement = isProtected ? (
            <ProtectedRoute adminOnly={adminOnly}>{element}</ProtectedRoute>
          ) : (
            element
          );

          return <Route key={path} path={path} element={routeElement} />;
        })}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
