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

    // Conta 1 item conferido por registro
    produtosConferidos.forEach((item) => {
      const dia = new Date(item.created_date).toISOString().split("T")[0];
      if (!agrupado[dia]) agrupado[dia] = { dia, total_itens: 0 };
      agrupado[dia].total_itens += 1;
    });

    // Conta 1 work item por registro
    workItems.forEach((item) => {
      const dia = new Date(item.created_date).toISOString().split("T")[0];
      if (!agrupado[dia]) agrupado[dia] = { dia, total_itens: 0 };
      agrupado[dia].total_itens += 1;
    });

    return Object.values(agrupado).sort((a, b) => a.dia.localeCompare(b.dia));
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
