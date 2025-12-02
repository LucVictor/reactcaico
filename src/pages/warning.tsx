// WarningBar.tsx
import { useEffect, useState } from "react";
import api from "../api";
import CongratsRank from "./parabens";

interface Warning {
  id: number;
  destination_user: number;
  message: string;
  read?: boolean;
  timestamp?: string;
  create_date?: string;
}

export default function WarningBar() {
  const [warning, setWarning] = useState<Warning | null>(null);

  useEffect(() => {
    async function fetchWarning() {
      try {
        const res = await api.get("/warning/");
        const data: Warning[] = Array.isArray(res.data) ? res.data : [];
        const unread = data.filter((w) => !w.read);
        if (unread.length > 0) {
          setWarning(unread[0]);
        }
      } catch (e) {
        console.error("Erro ao buscar warning:", e);
      }
    }
    fetchWarning();
  }, []);

  const marcarLida = async () => {
    if (!warning) return;
    try {
      await api.put(`/warning/read/${warning.id}`, { read: true });
      setWarning(null);

      // Recarrega para ver se tem mais mensagens não lidas
      const res = await api.get("/warning/");
      const data: Warning[] = Array.isArray(res.data) ? res.data : [];
      const unread = data.filter((w) => !w.read);
      if (unread.length > 0) {
        setWarning(unread[0]);
      }
    } catch (e) {
      console.error("Erro ao marcar como lido:", e);
    }
  };

  if (!warning) return null;

  // DETECTOR FINAL — FUNCIONA COM SUA MENSAGEM REAL
  const detectarRanking = (texto: string): number | null => {
    const msg = texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/[º°]/g, "º") // padroniza º e °
      .replace(/[^a-z0-9º\s]/g, " ") // remove emojis, !, etc.
      .replace(/\s+/g, " ");

    // Procura por qualquer número seguido de "º", "°", "o" + "lugar"
    const match = msg.match(/(\d+)\s*º?\s*lugar/);
    if (match) {
      const pos = parseInt(match[1], 10);
      return pos > 0 && pos < 1000 ? pos : null;
    }

    return null;
  };

  const position = detectarRanking(warning.message);

  // SE FOR PARABÉNS DE RANKING → mostra o componente lindo
  if (position !== null) {
    return (
      <CongratsRank
        position={position}
        fullMessage={warning.message} // mostra a mensagem completa e bonita do backend
        onClose={marcarLida}
      />
    );
  }

  // Caso contrário → warning normal amarelo
  return (
    <div className="fixed top-0 left-1/2 z-[9999] flex w-full max-w-[90%] -translate-x-1/2 items-center justify-between gap-4 rounded-b-lg bg-yellow-500 px-4 py-2 text-white shadow-lg">
      <p className="text-sm whitespace-pre-line">{warning.message}</p>
      <button
        onClick={marcarLida}
        className="rounded bg-yellow-700 px-2 py-1 text-xs font-medium transition hover:bg-yellow-800"
      >
        OK
      </button>
    </div>
  );
}
