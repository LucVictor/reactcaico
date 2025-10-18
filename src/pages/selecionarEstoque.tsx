import { useEffect } from "react";
import { useAuthStore } from "./authStore";
import { useLocalDeEstoque } from "./localEstoque";

export default function Layout() {
  const user = useAuthStore((state) => state.user);
  const setLocal = useLocalDeEstoque((s) => s.setLocal);

  // Inicializa o local do usuário logado
  useEffect(() => {
    if (user) {
      setLocal(user.local, `Local #${user.local}`);
    }
  }, [user, setLocal]);

  // resto do layout...
}
