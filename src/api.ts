// src/api.ts
import axios from "axios";
import { useAuthStore } from "../src/pages/authStore";
export const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL,
});

// 🔹 Interceptor de request → injeta o token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 🔹 Interceptor de response → trata erro de autenticação
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      // pega função clearUser da store
      const clearUser = useAuthStore.getState().clearUser;

      console.warn("⛔ Sessão expirada ou token inválido.");
      clearUser();

      // redireciona se não estiver na página de login
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

export default api;
