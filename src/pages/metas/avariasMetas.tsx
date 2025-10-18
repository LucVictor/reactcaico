import { Suspense, useState, useMemo } from "react";
import { Progress, Label, Spinner } from "flowbite-react";
import api from "../../api";
import { useLocalDeEstoque } from "../localEstoque";

export interface ProdutoAvariaProps {
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

const META_AVARIA = 5000;

// 🔹 Função que cria um "resource" usado pelo Suspense
function fetchAvarias(idLocal: number, mesSelecionado: string) {
  let status = "pending";
  let result: ProdutoAvariaProps[] = [];
  let error: any;

  const [ano, mes] = mesSelecionado.split("-");
  const primeiroDia = `${ano}-${mes}-01`;
  const ultimoDia = new Date(parseInt(ano), parseInt(mes), 0)
    .toISOString()
    .split("T")[0];

  const promise = api
    .get(`/damaged/between?date1=${primeiroDia}&date2=${ultimoDia}`)
    .then((res) => {
      result = res.data.filter((e: ProdutoAvariaProps) => e.local === idLocal);
      status = "success";
    })
    .catch((err) => {
      error = err;
      status = "error";
    });

  return {
    read() {
      if (status === "pending") throw promise;
      if (status === "error") throw error;
      return result;
    },
  };
}

// 🔹 Componente que exibe os dados de avarias
function AvariasDisplay({
  resource,
}: {
  resource: ReturnType<typeof fetchAvarias>;
}) {
  const produtos = resource.read();

  const totalCustoAvaria = useMemo(
    () => produtos.reduce((acc, p) => acc + p.cost_total, 0),
    [produtos],
  );

  const progressoPercentual = Math.min(
    (totalCustoAvaria / META_AVARIA) * 100,
    100,
  );

  // Verde = bom (abaixo da meta), Amarelo = alerta, Vermelho = ruim (acima da meta)
  const corProgresso =
    progressoPercentual < 50
      ? "success"
      : progressoPercentual < 80
        ? "warning"
        : "failure";

  return (
    <div className="mb-6 text-center">
      <p className="mb-2 text-gray-800 dark:text-gray-100">
        Meta de custo máximo de avaria:{" "}
        <strong>
          {META_AVARIA.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}
        </strong>
      </p>
      <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
        Total de avarias no mês:{" "}
        <strong>
          {totalCustoAvaria.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL",
          })}
        </strong>
      </p>

      <Progress
        progress={progressoPercentual}
        textLabel="Custo"
        color={corProgresso}
        size="lg"
        labelProgress
        labelText
      />
    </div>
  );
}

// 🔹 Componente principal
export function IndicadorAvaria() {
  const idLocal = useLocalDeEstoque((s) => s.idLocal);
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const agora = new Date();
    const mes = String(agora.getMonth() + 1).padStart(2, "0");
    return `${agora.getFullYear()}-${mes}`;
  });

  const mesesOptions = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => {
        const data = new Date();
        data.setMonth(data.getMonth() - i);
        const valor = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
        const label = data.toLocaleString("pt-BR", {
          month: "long",
          year: "numeric",
        });
        return { valor, label };
      }),
    [],
  );

  // 🔹 Recria o recurso apenas quando mês ou local mudam
  const resource = useMemo(
    () => fetchAvarias(idLocal, mesSelecionado),
    [idLocal, mesSelecionado],
  );

  return (
    <div className="m-auto w-full max-w-3xl rounded-xl bg-gray-50 p-6 shadow-md dark:bg-gray-800">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          Indicador de Avaria
        </h2>

        <div className="flex flex-col items-end">
          <Label
            htmlFor="mes"
            className="mb-1 text-gray-700 dark:text-gray-300"
          >
            Filtro de mês
          </Label>
          <select
            id="mes"
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
          >
            {mesesOptions.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Carregamento global controlado pelo Suspense */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16">
            <Spinner aria-label="Carregando dados..." size="xl" />
          </div>
        }
      >
        <AvariasDisplay resource={resource} />
      </Suspense>
    </div>
  );
}
