import { useEffect, useState } from "react";
import { Spinner } from "flowbite-react";
import { ConferenciaCalendario } from "./conferenciaCalendario";
//* import { IndicadorAvaria } from "./avariasMetas";
declare global {
  interface Window {
    __carregarConferencia?: () => void;
    __carregarAvarias?: () => void;
  }
}

export default function IndexMetas() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Espera os dois componentes carregarem dados antes de renderizar
    async function carregarTudo() {
      setIsLoading(true);
      try {
        await Promise.all([
          // Os dois componentes precisam expor funções de carregamento (abaixo)
          window.__carregarConferencia?.(),
          window.__carregarAvarias?.(),
        ]);
      } catch (err) {
        console.error("Erro ao carregar dados das metas:", err);
      } finally {
        setIsLoading(false);
      }
    }
    carregarTudo();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner size="xl" color="info" aria-label="Carregando dados..." />
      </div>
    );
  }

  return (
    <main className="flex w-full justify-between opacity-95">
      <div className="m-auto flex justify-center gap-1 align-middle">
        <div>
          <ConferenciaCalendario />
        </div>
        <div>{/* <IndicadorAvaria /> */}</div>
      </div>
    </main>
  );
}
