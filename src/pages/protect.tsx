import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "./authStore";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean; // se true, só admins podem acessar
}

export default function ProtectedRoute({
  children,
  adminOnly = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, user, checkTokenValidity } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    checkTokenValidity();
  }, [checkTokenValidity]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    } else if (adminOnly && user?.admin !== 1) {
      // redireciona para home se não for admin
      navigate("/");
    }
  }, [isAuthenticated, user, adminOnly, navigate]);

  if (!isAuthenticated || (adminOnly && user?.admin !== 1)) {
    return (
      <div className="flex h-screen items-center justify-center text-white">
        <p>Verificando autenticação...</p>
      </div>
    );
  }

  return <>{children}</>;
}
