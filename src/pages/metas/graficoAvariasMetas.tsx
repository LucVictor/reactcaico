import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LabelList,
  Cell,
} from "recharts";

const META_AVARIA = 5000;

export function GraficoAvarias() {
  // Últimos 6 meses simulados
  const mesesUltimos6 = Array.from({ length: 6 })
    .map((_, i) => {
      const data = new Date();
      data.setMonth(data.getMonth() - i);
      const totalSimulado = 1; // custo simulado
      return {
        label: data.toLocaleString("pt-BR", {
          month: "short",
          year: "numeric",
        }),
        total: totalSimulado,
        metaAtingida: totalSimulado <= META_AVARIA ? "Sim" : "Não",
      };
    })
    .reverse();

  return (
    <div className="m-auto w-full rounded-xl bg-gray-50 p-6 shadow-md dark:bg-gray-800">
      <h2 className="mb-4 text-center text-xl font-bold text-gray-800 dark:text-gray-100">
        Avarias Últimos 6 Meses (Sim/Não)
      </h2>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={mesesUltimos6}
          margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis hide={true} /> {/* só mostra Sim/Não */}
          <Tooltip
            formatter={(_value: number, _name: string, props?: unknown) => {
              // props é do tipo unknown, fazemos type assertion
              const payload = (props as { payload?: { metaAtingida: string } })
                ?.payload;
              return payload?.metaAtingida ?? "";
            }}
          />
          <Bar dataKey="total">
            {mesesUltimos6.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.metaAtingida === "Sim" ? "#22c55e" : "#ef4444"}
              />
            ))}
            <LabelList
              dataKey="metaAtingida"
              position="top"
              formatter={(label: React.ReactNode) => String(label)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
