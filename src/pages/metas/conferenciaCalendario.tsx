import { useEffect, useMemo, useState } from "react";
import {
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  Progress,
  Label,
  Spinner,
} from "flowbite-react";
import api from "../../api";
import { useAuthStore } from "../authStore";

export interface ProdutoConferidoProps {
  id: number;
  product_name: string;
  product_code: number;
  quantity_real: number;
  quantity_system: number;
  diference: number;
  cost_total: number;
  created_date: string;
  created_by: string;
}

export interface WorkItemProps {
  id: number;
  product_name: string;
  product_code: number;
  quantity_real: number | null;
  quantity_system: number | null;
  created_date: string;
  work_conference_id: number;
}

export function ConferenciaCalendario() {
  const [produtosConferidos, setProdutosConferidos] = useState<
    ProdutoConferidoProps[]
  >([]);
  const [workItems, setWorkItems] = useState<WorkItemProps[]>([]);
  const [mesSelecionado, setMesSelecionado] = useState<string>(() => {
    const agora = new Date();
    const mes = String(agora.getMonth() + 1).padStart(2, "0");
    return `${agora.getFullYear()}-${mes}`;
  });
  const [meta, setMeta] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const user = useAuthStore((state) => state.user);

  // Opções de últimos 12 meses
  const mesesOptions = Array.from({ length: 12 }).map((_, i) => {
    const data = new Date();
    data.setMonth(data.getMonth() - i);
    const valor = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
    const label = data.toLocaleString("pt-BR", {
      month: "long",
      year: "numeric",
    });
    return { valor, label };
  });

  // 🔹 Buscar meta da API
  async function buscarMetaConferencia() {
    try {
      const response = await api.get(`/target/conference/${mesSelecionado}`);
      const dadosMetas = response.data;
      setMeta(dadosMetas[0]?.quantity ?? null);
    } catch (err) {
      console.error("Erro ao buscar meta:", err);
    }
  }

  // 🔹 Buscar produtos conferidos
  async function buscarProdutosConferidos() {
    try {
      const [ano, mes] = mesSelecionado.split("-").map(Number);
      const primeiroDia = new Date(ano, mes - 1, 1).toISOString().slice(0, 10);
      const ultimoDia = new Date(ano, mes, 0).toISOString().slice(0, 10);

      const response = await api.get("/conference/between", {
        params: { date1: primeiroDia, date2: ultimoDia, user: user?.id },
      });

      setProdutosConferidos(response.data);
    } catch (err) {
      console.error("Erro ao buscar produtos conferidos:", err);
    }
  }

  // 🔹 Buscar Work Items
  async function buscarWorkItems() {
    try {
      const [ano, mes] = mesSelecionado.split("-").map(Number);
      const primeiroDia = new Date(ano, mes - 1, 1).toISOString().slice(0, 10);
      const ultimoDia = new Date(ano, mes, 0).toISOString().slice(0, 10);

      const response = await api.get("/work_conference/items/", {
        params: { date1: primeiroDia, date2: ultimoDia },
      });

      setWorkItems(response.data);
    } catch (err) {
      console.error("Erro ao buscar Work Items:", err);
    }
  }

  // 🔹 Atualiza dados sempre que o mês mudar (sequencial)
  useEffect(() => {
    const carregarDados = async () => {
      setLoading(true);
      try {
        await buscarProdutosConferidos();
        await buscarWorkItems();
        await buscarMetaConferencia();
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    };
    carregarDados();
  }, [mesSelecionado]);

  // 🔹 Filtra conferências do mês selecionado
  const produtosFiltrados = useMemo(() => {
    const [ano, mes] = mesSelecionado.split("-").map(Number);
    return produtosConferidos.filter((p) => {
      const data = new Date(p.created_date);
      return data.getFullYear() === ano && data.getMonth() + 1 === mes;
    });
  }, [produtosConferidos, mesSelecionado]);

  const workItemsFiltrados = useMemo(() => {
    const [ano, mes] = mesSelecionado.split("-").map(Number);
    return workItems.filter((w) => {
      const data = new Date(w.created_date);
      return data.getFullYear() === ano && data.getMonth() + 1 === mes;
    });
  }, [workItems, mesSelecionado]);

  // 🔹 Contagem de itens por dia (produtos + work items)
  const produtosPorDia: Record<string, number> = {};
  produtosFiltrados.forEach((p) => {
    const dia = p.created_date.split("T")[0];
    produtosPorDia[dia] = (produtosPorDia[dia] || 0) + 1;
  });
  workItemsFiltrados.forEach((w) => {
    const dia = w.created_date.split("T")[0];
    produtosPorDia[dia] = (produtosPorDia[dia] || 0) + 1;
  });

  // 🔹 Calcula metas e status por dia
  const META_MENSAL = meta ?? 400;
  const dadosTabela = useMemo(() => {
    const [ano, mes] = mesSelecionado.split("-").map(Number);
    const diasNoMes = new Date(ano, mes, 0).getDate();

    const diasUteis = Array.from({ length: diasNoMes }, (_, i) => {
      const data = new Date(ano, mes - 1, i + 1);
      const diaSemana = data.getDay();
      return diaSemana !== 0 && diaSemana !== 6 ? data : null;
    }).filter(Boolean) as Date[];

    let restante = META_MENSAL;
    let diasRestantes = diasUteis.length;

    const resultado = [];
    for (let i = 1; i <= diasNoMes; i++) {
      const data = new Date(ano, mes - 1, i);
      const formato = data.toISOString().split("T")[0];
      const quantidade = produtosPorDia[formato] || 0;
      const diaSemana = data.getDay();
      const fimDeSemana = diaSemana === 0 || diaSemana === 6;

      const metaDia =
        diasRestantes > 0 ? Math.round(restante / diasRestantes) : 0;
      const atingiuMeta = quantidade >= metaDia && !fimDeSemana;

      if (!fimDeSemana) {
        restante -= quantidade;
        diasRestantes--;
      }

      resultado.push({
        dia: i,
        quantidade,
        metaDia: fimDeSemana ? 0 : metaDia,
        atingiuMeta,
        fimDeSemana,
      });
    }

    return resultado;
  }, [produtosPorDia, mesSelecionado, META_MENSAL]);

  const diasUteisTotais = dadosTabela.filter((d) => !d.fimDeSemana).length;
  const diasComMetaBatida = dadosTabela.filter(
    (d) => d.atingiuMeta && !d.fimDeSemana,
  ).length;
  const progressoPercentual = Math.min(
    (diasComMetaBatida / diasUteisTotais) * 100,
    100,
  );
  const corProgresso =
    progressoPercentual < 50
      ? "failure"
      : progressoPercentual < 80
        ? "warning"
        : "success";

  // 🔹 Loading
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="xl" color="info" aria-label="Carregando dados..." />
      </div>
    );
  }

  return (
    <div className="m-auto w-full max-w-3xl rounded-xl bg-gray-50 p-6 shadow-md transition-colors duration-300 dark:bg-gray-800">
      {/* Cabeçalho */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          Conferência Mensal de Produtos
        </h2>

        <div className="flex flex-col items-end">
          <Label
            htmlFor="mes"
            className="mb-1 text-gray-700 dark:text-gray-300"
          >
            Filtro de mês
          </Label>
          <select
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

      {/* Resumo e progresso */}
      <div className="mb-6 text-center">
        <p className="mb-2 text-gray-800 dark:text-gray-100">
          Meta mensal: <strong>{meta ?? "—"}</strong> produtos
        </p>
        <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
          Dias úteis com meta batida:{" "}
          <strong>
            {diasComMetaBatida}/{diasUteisTotais}
          </strong>
        </p>

        <Progress
          progress={progressoPercentual}
          color={corProgresso}
          size="lg"
          labelProgress
          labelText
          textLabel={`${diasComMetaBatida} / ${diasUteisTotais} dias úteis`}
          className="mb-2"
        />
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border border-gray-300 dark:border-gray-700">
        <Table hoverable className="text-center">
          <TableHead className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
            <TableHeadCell>Dia</TableHeadCell>
            <TableHeadCell>Qtd Conferida</TableHeadCell>
            <TableHeadCell>Meta do Dia</TableHeadCell>
            <TableHeadCell>Status</TableHeadCell>
          </TableHead>
          <TableBody className="divide-y divide-gray-200 dark:divide-gray-700">
            {dadosTabela.map((d) => (
              <TableRow
                key={d.dia}
                className={`transition-colors duration-200 ${d.fimDeSemana ? "bg-gray-100 text-gray-400 dark:bg-gray-700" : "bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"}`}
              >
                <TableCell className="font-medium">{d.dia}</TableCell>
                <TableCell>{d.quantidade}</TableCell>
                <TableCell>{d.metaDia || "-"}</TableCell>
                <TableCell>
                  {d.fimDeSemana ? (
                    d.quantidade > 0 ? (
                      <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:bg-blue-700 dark:text-blue-100">
                        ✔️ Extra
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )
                  ) : d.atingiuMeta ? (
                    <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-sm font-semibold text-green-600 dark:bg-green-700 dark:text-green-100">
                      ✔️
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-sm font-semibold text-red-600 dark:bg-red-700 dark:text-red-100">
                      ✖️
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
