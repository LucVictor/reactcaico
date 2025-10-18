import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "./authStore";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, checkTokenValidity } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    checkTokenValidity(); // verifica token ao montar o componente
  }, [checkTokenValidity]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    // você pode exibir um loading ou algo visual aqui
    return (
      <div className="flex h-screen items-center justify-center text-white">
        <p>Verificando autenticação...</p>
      </div>
    );
  }

  return <>{children}</>;
}
