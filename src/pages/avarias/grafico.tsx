import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ProdutoAvariaProps, TypesProps, OriginProps } from "./index";

interface DadosProdutosAvariaProps {
  dia: string;
  custo_total: number;
}

interface DadosPizza {
  name: string;
  value: number;
  [key: string]: string | number;
}

export default function GraficoAvariasDia({
  produtosAvarias,
  tipos,
  origens,
}: {
  produtosAvarias: ProdutoAvariaProps[];
  tipos: TypesProps[];
  origens: OriginProps[];
}) {
  const [dadosLinha, setDadosLinha] = useState<DadosProdutosAvariaProps[]>([]);
  const [dadosPorTipo, setDadosPorTipo] = useState<DadosPizza[]>([]);

  const CORES = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#A020F0",
    "#FF6666",
    "#7FFF00",
    "#FF1493",
  ];

  function agruparPorData(produtos: ProdutoAvariaProps[]) {
    const agrupado: Record<string, number> = {};

    produtos.forEach((item) => {
      const dataFormatada = new Date(item.created_date).toLocaleDateString(
        "pt-BR",
      );
      if (!agrupado[dataFormatada]) agrupado[dataFormatada] = 0;
      agrupado[dataFormatada] += item.cost_total || item.quantity * item.cost;
    });

    return Object.entries(agrupado).map(([dia, custo_total]) => ({
      dia,
      custo_total,
    }));
  }

  function agruparPorCampo(
    produtos: ProdutoAvariaProps[],
    lista: (TypesProps | OriginProps)[],
    campo: "type" | "origin",
  ): DadosPizza[] {
    const agrupado: Record<string, number> = {};

    produtos.forEach((p) => {
      const nome =
        lista.find((e) => e.id === p[campo])?.name || `${campo} ${p[campo]}`;
      if (!agrupado[nome]) agrupado[nome] = 0;
      agrupado[nome] += p.cost_total || p.quantity * p.cost;
    });

    return Object.entries(agrupado).map(([name, value]) => ({
      name,
      value,
    }));
  }

  useEffect(() => {
    if (produtosAvarias.length === 0) {
      setDadosLinha([]);
      setDadosPorTipo([]);
      return;
    }

    const total = agruparPorData(produtosAvarias);
    const ordenados = total.sort((a, b) => {
      const [da, ma, aa] = a.dia.split("/").map(Number);
      const [db, mb, ab] = b.dia.split("/").map(Number);
      return (
        new Date(aa, ma - 1, da).getTime() - new Date(ab, mb - 1, db).getTime()
      );
    });
    setDadosLinha(ordenados);
    setDadosPorTipo(agruparPorCampo(produtosAvarias, tipos, "type"));
  }, [produtosAvarias, tipos, origens]);

  const renderGraficoLinha = () => (
    <div style={{ width: "50%", height: 320 }}>
      <h3 className="mb-2 text-center text-sm font-semibold text-white">
        Total Geral por Dia
      </h3>
      <ResponsiveContainer>
        <LineChart
          data={dadosLinha}
          margin={{ top: 20, right: 24, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="dia" tick={{ fontSize: 12, fill: "#fff" }} />
          <YAxis
            tick={{ fontSize: 12, fill: "#fff" }}
            tickFormatter={(value) =>
              new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(value)
            }
          />
          <Tooltip
            formatter={(value: number) =>
              new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(value)
            }
            labelFormatter={(label) => `Data: ${label}`}
          />
          <Legend />
          <Line
            name="Custo Total"
            type="monotone"
            dataKey="custo_total"
            stroke="oklch(60.9% 0.126 221.723)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  const renderGraficoPizza = (dados: DadosPizza[], titulo: string) => (
    <div style={{ width: "43%", height: 320 }}>
      <h3 className="mb-2 text-center text-sm font-semibold text-white">
        {titulo}
      </h3>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={dados}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={(entry) => `${entry.name}`}
          >
            {dados.map((_, index) => (
              <Cell key={`cell-${index}`} fill={CORES[index % CORES.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) =>
              new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(value)
            }
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="flex h-96 flex-row justify-between p-1">
      {renderGraficoLinha()}
      {renderGraficoPizza(dadosPorTipo, "Distribuição por Tipo")}
    </div>
  );
}
