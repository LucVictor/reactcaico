import { Button, Label, TextInput } from "flowbite-react";
import { useState } from "react";
import TabelaRelatorio from "./tabelaRelatorio";
import api from "../../api";
import { useLocalDeEstoque } from "../localEstoque";

interface ProdutoAvariaProps {
  id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  cost: number;
  damaged_date: string;
  cost_total: number;
  created_date: string;
  shelflife_date: string;
  last_mod: string;
  created_by: string;
  type: number;
  origin: number;
  local: number;
}

interface DatasRelatorioProps {
  dataInicial: string;
  dataFinal: string;
}

export function RelatorioAvarias() {
  const [datas, setDatas] = useState<DatasRelatorioProps>({
    dataInicial: "",
    dataFinal: "",
  });
  const [relatorio, setRelatorio] = useState<ProdutoAvariaProps[]>();
  const { idLocal } = useLocalDeEstoque(); // ✅ pegar local atual

  const enviarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (datas.dataInicial == "" || datas.dataInicial == "") {
      return;
    }
    try {
      const res = await api.get(
        `/damaged/between?date1=${datas.dataInicial}&date2=${datas.dataFinal}`,
      );
      const data: ProdutoAvariaProps[] = await res.data;
      setRelatorio(data.filter((e) => e.local == idLocal) || []);
      console.log(data);
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar relatório");
    }
  };

  return (
    <div>
      {relatorio ? (
        <div>
          <TabelaRelatorio dadosRelatorio={relatorio} />
        </div>
      ) : (
        <form className="m-auto flex flex-col gap-4" onSubmit={enviarCadastro}>
          <div>
            <Label htmlFor="data_inicial">Data inicial</Label>
            <TextInput
              id="data_inicial"
              type="date"
              placeholder="Digite a data inicial"
              onChange={(e) =>
                setDatas({ ...datas, dataInicial: e.target.value })
              }
              required
            />
          </div>
          <div>
            <Label htmlFor="data_final">Data Final</Label>
            <TextInput
              id="data_final"
              type="date"
              placeholder="Digite a data final"
              onChange={(e) =>
                setDatas({ ...datas, dataFinal: e.target.value })
              }
              required
            />
          </div>

          <Button type="submit">Gerar</Button>
        </form>
      )}
    </div>
  );
}
