import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
// 1. Importa Day.js e o locale pt-br
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

// Configura o Day.js para usar o locale pt-br
dayjs.locale('pt-br');

interface ProdutoConferidoProps {
  id: number;
  product_name: string;
  product_code: number;
  created_date: string;
}

interface WorkItemProps {
  id: number;
  product_name: string;
  product_code: number;
  created_date: string;
}

interface DadosAgrupadosProps {
  dia: string;
  total_itens: number; // soma de itens conferidos + work items
}

export default function GraficoConferenciasDia({
  produtosConferidos,
  workItems,
}: {
  produtosConferidos: ProdutoConferidoProps[];
  workItems: WorkItemProps[];
}) {
  const [dados, setDados] = useState<DadosAgrupadosProps[]>([]);

  function agruparDados() {
    const agrupado: Record<string, DadosAgrupadosProps> = {};

    // Função auxiliar para processar e formatar a data
    const processarItem = (item: { created_date: string }) => {
      // 2. Chave de agrupamento e ordenação: YYYY-MM-DD
      const diaChave = dayjs(item.created_date).format("YYYY-MM-DD");
      
      // 3. Formato para exibição no gráfico: DD/MM/YYYY
      const diaExibicao = dayjs(item.created_date).format("DD/MM/YYYY");

      if (!agrupado[diaChave]) {
        // Usa a data de exibição (DD/MM/YYYY) como o valor final da propriedade 'dia'
        agrupado[diaChave] = { dia: diaExibicao, total_itens: 0 };
      }
      // A contagem é feita usando a chave YYYY-MM-DD
      agrupado[diaChave].total_itens += 1;
    };

    // Conta 1 item conferido por registro
    produtosConferidos.forEach(processarItem);

    // Conta 1 work item por registro
    workItems.forEach(processarItem);

    // 4. Ordenação: usa a data YYYY-MM-DD da chave para garantir a ordem cronológica
    return Object.keys(agrupado)
      .sort() // Ordena as chaves (datas YYYY-MM-DD) em ordem crescente
      .map(chave => agrupado[chave]); // Mapeia de volta para o array de valores
  }

  useEffect(() => {
    setDados(agruparDados());
  }, [produtosConferidos, workItems]);

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <LineChart
          data={dados}
          margin={{ top: 20, right: 24, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          {/* O XAxis usa a chave 'dia', que agora é formatada como DD/MM/YYYY */}
          <XAxis dataKey="dia" /> 
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="total_itens"
            stroke="#82ca9d"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Total de Itens"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}