// src/store/authStore.ts
import { create } from "zustand";
import { jwtDecode } from "jwt-decode";

interface UserPayload {
  sub: string;
  id: number;
  name: string;
  email: string;
  local: number;
  admin: number;
  exp: number;
  profile_photo: string;
}

interface AuthState {
  user: UserPayload | null;
  token: string | null;
  isAuthenticated: boolean;
  updateUser: (newData: Partial<UserPayload>) => void;
  setUserFromToken: (token: string) => void;
  clearUser: () => void;
  checkTokenValidity: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  setUserFromToken: (token) => {
    try {
      const decoded = jwtDecode<UserPayload>(token);

      const now = Date.now() / 1000; // segundos
      if (decoded.exp < now) {
        console.warn("⚠️ Token expirado");
        localStorage.removeItem("token");
        set({ user: null, token: null, isAuthenticated: false });
        return;
      }

      set({ user: decoded, token, isAuthenticated: true });
      localStorage.setItem("token", token);
      console.log(decoded);
    } catch (err) {
      console.error("Token inválido:", err);
      set({ user: null, token: null, isAuthenticated: false });
    }
  },
  updateUser: (newData: Partial<UserPayload>) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...newData } : null,
    })),
  clearUser: () => {
    localStorage.removeItem("token");
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkTokenValidity: () => {
    const token = localStorage.getItem("token");
    if (!token) {
      set({ user: null, token: null, isAuthenticated: false });
      return;
    }

    try {
      const decoded = jwtDecode<UserPayload>(token);
      const now = Date.now() / 1000;
      if (decoded.exp < now) {
        console.warn("⚠️ Token expirado");
        localStorage.removeItem("token");
        set({ user: null, token: null, isAuthenticated: false });
      } else {
        set({ user: decoded, token, isAuthenticated: true });
      }
    } catch {
      set({ user: null, token: null, isAuthenticated: false });
    }
  },
}));
