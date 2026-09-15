import { useCallback, useEffect, useMemo, useState } from "react";
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

const META_SEMANAL = 150;

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
  date_: string; // espera 'YYYY-MM-DD' ou 'YYYY-MM-DDTHH:MM:SS'
}

export interface WorkItemProps {
  id: number;
  product_name: string;
  product_code: number;
  quantity_real: number | null;
  quantity_system: number | null;
  created_date: string;
  date_: string;
  work_conference_id: number;
}

function formatarDataLocal(ano: number, mes: number, dia: number) {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function adicionarDias(data: Date, dias: number) {
  const novaData = new Date(data);
  novaData.setDate(novaData.getDate() + dias);
  return novaData;
}

function formatarPeriodo(data: Date) {
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
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

  const [loading, setLoading] = useState<boolean>(false);
  const user = useAuthStore((state) => state.user);

  const mesesOptions = Array.from({ length: 12 }).map((_, i) => {
    const data = new Date();
    data.setMonth(data.getMonth() - i);
    const valor = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(
      2,
      "0",
    )}`;
    const label = data.toLocaleString("pt-BR", {
      month: "long",
      year: "numeric",
    });
    return { valor, label };
  });

  // Calcula, para o mês selecionado, o range de datas que cobre TODAS as
  // semanas exibidas na tabela (inclusive dias do mês anterior/seguinte que
  // pertencem à primeira/última semana). Isso é necessário porque uma
  // semana pode começar em agosto e terminar em setembro, por exemplo.
  const rangeBusca = useMemo(() => {
    const [ano, mes] = mesSelecionado.split("-").map(Number);
    const primeiroDiaMes = new Date(ano, mes - 1, 1);
    const ultimoDiaMes = new Date(ano, mes, 0);

    // Início da primeira semana (sexta-feira anterior ou igual ao dia 1)
    const inicioSemana = new Date(primeiroDiaMes);
    const diasAteSexta = (inicioSemana.getDay() - 5 + 7) % 7;
    inicioSemana.setDate(inicioSemana.getDate() - diasAteSexta);

    // Fim da última semana que contém o último dia do mês
    const diasDesdeUltimaSexta = (ultimoDiaMes.getDay() - 5 + 7) % 7;
    const inicioUltimaSemana = adicionarDias(
      ultimoDiaMes,
      -diasDesdeUltimaSexta,
    );
    const fimUltimaSemana = adicionarDias(inicioUltimaSemana, 6);

    return {
      inicio: formatarDataLocal(
        inicioSemana.getFullYear(),
        inicioSemana.getMonth() + 1,
        inicioSemana.getDate(),
      ),
      fim: formatarDataLocal(
        fimUltimaSemana.getFullYear(),
        fimUltimaSemana.getMonth() + 1,
        fimUltimaSemana.getDate(),
      ),
    };
  }, [mesSelecionado]);

  const buscarProdutosConferidos = useCallback(async () => {
    try {
      const response = await api.get("/conference/between", {
        params: {
          date1: rangeBusca.inicio,
          date2: rangeBusca.fim,
          user: user?.id,
        },
      });

      setProdutosConferidos(response.data ?? []);
    } catch (err) {
      console.error("Erro ao buscar produtos conferidos:", err);
      setProdutosConferidos([]);
    }
  }, [rangeBusca, user?.id]);

  const buscarWorkItems = useCallback(async () => {
    try {
      const response = await api.get("/work_conference/items/", {
        params: { date1: rangeBusca.inicio, date2: rangeBusca.fim },
      });

      setWorkItems(response.data ?? []);
    } catch (err) {
      console.error("Erro ao buscar Work Items:", err);
      setWorkItems([]);
    }
  }, [rangeBusca]);

  useEffect(() => {
    let mounted = true;

    const carregar = async () => {
      setLoading(true);
      await Promise.all([buscarProdutosConferidos(), buscarWorkItems()]);
      if (mounted) {
        setLoading(false);
      }
    };

    carregar();

    return () => {
      mounted = false;
    };
  }, [buscarProdutosConferidos, buscarWorkItems]);

  // Agora não filtramos mais por mês aqui: o backend já retorna somente o
  // range de datas que cobre exatamente as semanas exibidas (rangeBusca),
  // então todos os itens recebidos são relevantes.
  //
  // Itens com quantity_system < 0 (estoque negativo) NÃO entram na
  // contagem que vale para a meta de 150/semana. Eles são contabilizados
  // à parte, em `negativosPorDia`, apenas para exibição informativa.
  const { produtosPorDia, negativosPorDia } = useMemo(() => {
    const porDia: Record<string, number> = {};
    const negPorDia: Record<string, number> = {};

    const registrar = (
      dataStr: string | undefined,
      qtySystem: number | null | undefined,
    ) => {
      if (!dataStr) return;
      const dia = dataStr.slice(0, 10);

      const isNegativo = typeof qtySystem === "number" && qtySystem < 0;

      if (isNegativo) {
        // Não entra na meta, só é contado separadamente (informativo)
        negPorDia[dia] = (negPorDia[dia] || 0) + 1;
      } else {
        porDia[dia] = (porDia[dia] || 0) + 1;
      }
    };

    produtosConferidos.forEach(
      (p: {
        date_: string | undefined;
        quantity_system: number | null | undefined;
      }) => registrar(p?.date_, p?.quantity_system),
    );
    workItems.forEach((w) => registrar(w?.date_, w?.quantity_system));

    return { produtosPorDia: porDia, negativosPorDia: negPorDia };
  }, [produtosConferidos, workItems]);

  const semanasDoMes = useMemo(() => {
    const [ano, mes] = mesSelecionado.split("-").map(Number);
    const ultimoDia = new Date(ano, mes, 0);
    const primeiroDia = new Date(ano, mes - 1, 1);

    const inicioSemana = new Date(primeiroDia);
    const diasAteSexta = (inicioSemana.getDay() - 5 + 7) % 7;
    inicioSemana.setDate(inicioSemana.getDate() - diasAteSexta);

    const semanas: {
      numero: number;
      inicio: string;
      fim: string;
      quantidade: number;
      quantidadeNegativos: number;
      faltam: number;
      metaSemana: number;
      atingiuMeta: boolean;
    }[] = [];

    let semanaAtual = new Date(inicioSemana);
    let contador = 1;

    while (semanaAtual <= ultimoDia) {
      const semanaFim = adicionarDias(semanaAtual, 6);
      let quantidade = 0;
      let quantidadeNegativos = 0;

      // Soma TODOS os dias da semana (mesmo que caiam no mês anterior ou
      // seguinte), pois a semana é uma unidade fixa de 7 dias e não deve
      // ser recortada pelo mês selecionado. Antes, dias fora do mês eram
      // ignorados, fazendo a mesma semana aparecer com contagens diferentes
      // (e incompletas) em cada mês que ela toca.
      for (
        const data = new Date(semanaAtual);
        data <= semanaFim;
        data.setDate(data.getDate() + 1)
      ) {
        const chave = formatarDataLocal(
          data.getFullYear(),
          data.getMonth() + 1,
          data.getDate(),
        );

        quantidade += produtosPorDia[chave] || 0;
        quantidadeNegativos += negativosPorDia[chave] || 0;
      }

      semanas.push({
        numero: contador,
        inicio: formatarPeriodo(semanaAtual),
        fim: formatarPeriodo(semanaFim),
        quantidade,
        quantidadeNegativos,
        faltam: Math.max(META_SEMANAL - quantidade, 0),
        metaSemana: META_SEMANAL,
        atingiuMeta: quantidade >= META_SEMANAL,
      });

      semanaAtual = adicionarDias(semanaAtual, 7);
      contador += 1;
    }

    return semanas;
  }, [mesSelecionado, produtosPorDia, negativosPorDia]);

  const totalMensal = useMemo(() => {
    const [ano, mes] = mesSelecionado.split("-").map(Number);
    let total = 0;
    Object.entries(produtosPorDia).forEach(([chave, qtd]) => {
      const [anoChave, mesChave] = chave.split("-").map(Number);
      if (anoChave === ano && mesChave === mes) {
        total += qtd;
      }
    });
    return total;
  }, [produtosPorDia, mesSelecionado]);

  const semanasComMetaBatida = semanasDoMes.filter(
    (semana) => semana.atingiuMeta,
  ).length;

  const progressoPercentual =
    semanasDoMes.length === 0
      ? 0
      : Math.round(
          Math.min((semanasComMetaBatida / semanasDoMes.length) * 100, 100),
        );

  const corProgresso =
    progressoPercentual < 50
      ? "failure"
      : progressoPercentual < 80
        ? "warning"
        : "success";

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="xl" color="info" aria-label="Carregando dados..." />
      </div>
    );
  }

  return (
    <div className="m-auto w-full max-w-4xl rounded-xl bg-gray-50 p-6 shadow-md transition-colors duration-300 dark:bg-gray-800">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
          Conferência Semanal de Produtos
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

      <div className="mb-6 text-center">
        <p className="mb-2 text-gray-800 dark:text-gray-100">
          Meta mínima semanal: <strong>{META_SEMANAL}</strong> conferências
        </p>
        <p className="mb-2 text-gray-800 dark:text-gray-100">
          Total do mês: <strong>{totalMensal}</strong> conferências
        </p>
        <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
          Semanas com meta batida: <strong>{semanasComMetaBatida}</strong>/
          <strong>{semanasDoMes.length}</strong>
        </p>

        <Progress
          progress={progressoPercentual}
          color={corProgresso}
          size="lg"
          labelProgress
          labelText
          textLabel={`${semanasComMetaBatida} / ${semanasDoMes.length} semanas`}
        />
      </div>

      <div className="rounded-lg border border-gray-300 dark:border-gray-700">
        <Table hoverable className="min-w-[860px] text-center">
          <TableHead className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
            <TableHeadCell className="px-3 py-3 whitespace-nowrap">
              Semana
            </TableHeadCell>
            <TableHeadCell className="px-3 py-3 whitespace-nowrap">
              Período
            </TableHeadCell>
            <TableHeadCell className="px-3 py-3 whitespace-nowrap">
              Qtd Conferida
            </TableHeadCell>
            <TableHeadCell className="px-3 py-3 whitespace-nowrap">
              Estoques Negativos
            </TableHeadCell>
            <TableHeadCell className="px-3 py-3 whitespace-nowrap">
              Meta da Semana
            </TableHeadCell>
            <TableHeadCell className="px-3 py-3 whitespace-nowrap">
              Faltam
            </TableHeadCell>
            <TableHeadCell className="px-3 py-3 whitespace-nowrap">
              Status
            </TableHeadCell>
          </TableHead>
          <TableBody className="divide-y divide-gray-200 dark:divide-gray-700">
            {semanasDoMes.map((semana) => (
              <TableRow
                key={`${semana.numero}-${semana.inicio}`}
                className="bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                <TableCell className="px-3 py-3 font-medium whitespace-nowrap">
                  {semana.numero}
                </TableCell>
                <TableCell className="px-3 py-3 whitespace-nowrap">
                  {semana.inicio} - {semana.fim}
                </TableCell>
                <TableCell className="px-3 py-3 whitespace-nowrap">
                  {semana.quantidade}
                </TableCell>
                <TableCell className="px-3 py-3 whitespace-nowrap">
                  {semana.quantidadeNegativos > 0 ? (
                    <span className="whitespace-nowrapdark:text-orange-100 inline-block rounded-full px-2.5 py-1 text-sm font-semibold">
                      {semana.quantidadeNegativos}
                    </span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </TableCell>
                <TableCell className="px-3 py-3 whitespace-nowrap">
                  {semana.metaSemana}
                </TableCell>
                <TableCell className="px-3 py-3 whitespace-nowrap">
                  {semana.faltam > 0 ? (
                    <span className="inline-block rounded-full bg-yellow-100 px-2.5 py-1 text-sm font-semibold whitespace-nowrap text-yellow-700 dark:bg-yellow-700 dark:text-yellow-100">
                      {semana.faltam}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </TableCell>
                <TableCell className="px-3 py-3 whitespace-nowrap">
                  {semana.atingiuMeta ? (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-sm font-semibold whitespace-nowrap text-green-600 dark:bg-green-700 dark:text-green-100">
                      ✔️ Meta atingida
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-sm font-semibold whitespace-nowrap text-red-600 dark:bg-red-700 dark:text-red-100">
                      ✖️ Abaixo da meta
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
