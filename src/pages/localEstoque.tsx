import { create } from "zustand";

interface LocalDeEstoqueSelecionadoProps {
  idLocal: number;
  localName: string;
  setIdLocal: (id: number) => void;
  setLocalName: (name: string) => void;
  setLocal: (id: number, name: string) => void; // atualizar os dois juntos
}

export const useLocalDeEstoque = create<LocalDeEstoqueSelecionadoProps>(
  (set) => ({
    idLocal: 0, // valor inicial será substituído pelo token do usuário
    localName: "Default",
    setIdLocal: (id) => set({ idLocal: id }),
    setLocalName: (name) => set({ localName: name }),
    setLocal: (id, name) => set({ idLocal: id, localName: name }),
  }),
);
