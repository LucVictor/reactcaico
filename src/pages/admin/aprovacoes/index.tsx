import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Badge,
  Button,
  Card,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Pagination,
  Select,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
} from "flowbite-react";
import api from "../../../api";
import {
  fetchErpMatches,
  type ErpMatchRow,
  type ErpRecordType,
} from "../external/erp-matches";
import {
  ApprovalActions,
  ApprovalStatusCell,
  type ApprovalInfo,
  type ApprovalStatus,
} from "../../../components/Approval";

type TabKey = "damaged" | "conference" | "task";

interface Local {
  id: number;
  name: string;
}

interface ErpFields {
  erp_num_mov?: string | null;
  erp_dt_mov?: string | null;
  erp_quantity?: number | null;
  erp_cost_unit?: number | null;
  erp_cod_filial?: string | null;
  erp_local?: string | null;
}

interface Avaria extends ApprovalInfo, ErpFields {
  id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  cost_total: number;
  damaged_date: string;
  created_by: string;
  local: number;
  erp_avaria_match?: boolean;
}

interface Conferencia extends ApprovalInfo, ErpFields {
  id: number;
  product_code: string;
  product_name: string;
  quantity_system: number;
  quantity_real: number;
  diference: number;
  cost_total: number;
  date_: string;
  created_by: string;
  local: number;
  erp_adjustment_match?: boolean;
}

interface Tarefa extends ApprovalInfo {
  id: number;
  user_id: number;
  user_name: string;
  quantity: number;
  completed: boolean;
  branch_code: number;
  created_date: string;
  items_confirmed: number;
}

interface TaskItemErp extends ErpFields {
  id: number;
  code: string | null;
  product_name: string;
  erp_adjustment_match: boolean;
}

interface ErpTaskItem {
  id: number;
  code: string | null;
  product_name: string;
  matches: ErpMatchRow[];
}

interface ErpDisplayRow extends ErpMatchRow {
  item_code?: string | null;
  item_name?: string;
}

interface LoteAlvo {
  id: number;
  rotulo: string;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: "damaged", label: "Avarias" },
  { key: "conference", label: "Conferências" },
  { key: "task", label: "Tarefas" },
];

const ENDPOINTS: Record<TabKey, string> = {
  damaged: "/damaged/admin/",
  conference: "/conference/admin/",
  task: "/task/admin/tasks/",
};

const ITENS_POR_PAGINA = 10;

const PERIODOS = [
  { label: "Hoje", dias: 0 },
  { label: "7 dias", dias: 6 },
  { label: "30 dias", dias: 29 },
];

const formatarData = (valor?: string | null) =>
  valor ? dayjs(valor).format("DD/MM/YYYY") : "—";

const formatarMoeda = (valor?: number | string | null) => {
  if (valor === null || valor === undefined || valor === "") return "—";
  const numero = Number(valor);
  if (Number.isNaN(numero)) return "—";
  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

const formatarQuantidade = (valor?: number | string | null) => {
  if (valor === null || valor === undefined || valor === "") return "—";
  const numero = Number(valor);
  if (Number.isNaN(numero)) return "—";
  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
};

function ErpBadgeButton({
  onClick,
  title = "Ver movimentos ERP encontrados",
}: {
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-semibold text-green-800 transition-colors hover:bg-green-100 focus:ring-2 focus:ring-green-400 focus:outline-none dark:border-green-700 dark:bg-green-900/40 dark:text-green-200 dark:hover:bg-green-900/70"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden />
      ERP
    </button>
  );
}

function getErrorMessage(
  err: unknown,
  fallback = "Não foi possível concluir a operação.",
): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const data = (
      err as { response?: { data?: { detail?: unknown; message?: unknown } } }
    ).response?.data;
    const detail = data?.detail ?? data?.message;
    if (detail !== undefined && detail !== null) {
      return typeof detail === "string" ? detail : JSON.stringify(detail);
    }
  }
  return fallback;
}

export default function AdminAprovacoes() {
  const hoje = dayjs().format("YYYY-MM-DD");

  const [tab, setTab] = useState<TabKey>("damaged");
  const [dataInicial, setDataInicial] = useState(hoje);
  const [dataFinal, setDataFinal] = useState(hoje);
  const [status, setStatus] = useState<ApprovalStatus | "">("pending");
  const [filial, setFilial] = useState("");

  const [locais, setLocais] = useState<Local[]>([]);
  const [avarias, setAvarias] = useState<Avaria[]>([]);
  const [conferencias, setConferencias] = useState<Conferencia[]>([]);
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const [aviso, setAviso] = useState<string | null>(null);

  const [lote, setLote] = useState<{
    open: boolean;
    loading: boolean;
    running: boolean;
    itens: LoteAlvo[];
    erro: string | null;
    falhas: string[];
  }>({
    open: false,
    loading: false,
    running: false,
    itens: [],
    erro: null,
    falhas: [],
  });

  const [erpModal, setErpModal] = useState<{
    open: boolean;
    title: string;
    loading: boolean;
    error: string | null;
    matches: ErpMatchRow[];
    taskItems: ErpTaskItem[] | null;
  }>({
    open: false,
    title: "",
    loading: false,
    error: null,
    matches: [],
    taskItems: null,
  });

  useEffect(() => {
    api
      .get("/local/")
      .then((res) => setLocais(Array.isArray(res.data) ? res.data : []))
      .catch((err) => console.error("Erro ao buscar filiais:", err));
  }, []);

  const buscar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const params: Record<string, string | number> = {
        date1: dataInicial,
        date2: dataFinal,
      };
      if (status) params.approval_status = status;
      if (filial) {
        params[tab === "task" ? "branch_code" : "local"] = Number(filial);
      }

      const res = await api.get(ENDPOINTS[tab], { params });
      const dados = Array.isArray(res.data) ? res.data : [];

      if (tab === "damaged") setAvarias(dados);
      else if (tab === "conference") setConferencias(dados);
      else setTarefas(dados);
    } catch (err) {
      console.error("Erro ao listar aprovações:", err);
      setErro(
        getErrorMessage(err, "Não foi possível carregar as solicitações."),
      );
      if (tab === "damaged") setAvarias([]);
      else if (tab === "conference") setConferencias([]);
      else setTarefas([]);
    } finally {
      setCarregando(false);
    }
  }, [tab, dataInicial, dataFinal, status, filial]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  useEffect(() => {
    setPagina(1);
  }, [tab, dataInicial, dataFinal, status, filial]);

  const fecharErpModal = () =>
    setErpModal((modal) => ({ ...modal, open: false }));

  const abrirErpRegistro = async (
    recordType: Exclude<ErpRecordType, "task_item">,
    recordId: number,
    title: string,
  ) => {
    setErpModal({
      open: true,
      title,
      loading: true,
      error: null,
      matches: [],
      taskItems: null,
    });
    try {
      const matches = await fetchErpMatches(recordType, recordId);
      setErpModal((modal) => ({ ...modal, loading: false, matches }));
    } catch (err) {
      setErpModal((modal) => ({
        ...modal,
        loading: false,
        error: getErrorMessage(
          err,
          "Não foi possível carregar os checks ERP deste registro.",
        ),
      }));
    }
  };

  const abrirErpTarefa = async (tarefa: Tarefa) => {
    setErpModal({
      open: true,
      title: `Checks ERP — Tarefa #${tarefa.id}`,
      loading: true,
      error: null,
      matches: [],
      taskItems: [],
    });
    try {
      const res = await api.get(`/task/items/${tarefa.id}`);
      const items: TaskItemErp[] = Array.isArray(res.data) ? res.data : [];
      const comMatch = items.filter((item) => item.erp_adjustment_match);

      const taskItems = await Promise.all(
        comMatch.map(async (item) => ({
          id: item.id,
          code: item.code,
          product_name: item.product_name,
          matches: await fetchErpMatches("task_item", item.id).catch(
            () => [] as ErpMatchRow[],
          ),
        })),
      );

      setErpModal((modal) => ({ ...modal, loading: false, taskItems }));
    } catch (err) {
      setErpModal((modal) => ({
        ...modal,
        loading: false,
        error: getErrorMessage(
          err,
          "Não foi possível carregar os itens e checks ERP desta tarefa.",
        ),
      }));
    }
  };

  const decidir = async (
    tipo: TabKey,
    id: number,
    approved: boolean,
    rejection_reason?: string,
  ) => {
    await api.patch(`${ENDPOINTS[tipo]}${id}/approve`, {
      approved,
      rejection_reason: approved ? null : rejection_reason,
    });
    await buscar();
  };

  const abrirLote = async () => {
    setAviso(null);
    setLote({
      open: true,
      loading: true,
      running: false,
      itens: [],
      erro: null,
      falhas: [],
    });

    try {
      let itens: LoteAlvo[] = [];
      let erroLeitura: string | null = null;

      if (tab === "task") {
        const pendentes = tarefas.filter(
          (tarefa) => tarefa.approval_status !== "approved",
        );
        const respostas = await Promise.allSettled(
          pendentes.map(async (tarefa) => {
            const res = await api.get(`/task/items/${tarefa.id}`);
            const items: TaskItemErp[] = Array.isArray(res.data) ? res.data : [];
            return items.some((item) => item.erp_adjustment_match)
              ? { id: tarefa.id, rotulo: `Tarefa #${tarefa.id}` }
              : null;
          }),
        );
        itens = respostas.reduce<LoteAlvo[]>((lista, resposta) => {
          if (resposta.status === "fulfilled" && resposta.value) {
            lista.push(resposta.value);
          }
          return lista;
        }, []);
        const falhasLeitura = respostas.filter(
          (resposta) => resposta.status === "rejected",
        ).length;
        if (falhasLeitura > 0) {
          erroLeitura = `${falhasLeitura} tarefa(s) não puderam ser verificadas e ficaram fora da aprovação em lote.`;
        }
      } else if (tab === "damaged") {
        itens = avarias
          .filter(
            (avaria) =>
              avaria.erp_avaria_match && avaria.approval_status !== "approved",
          )
          .map((avaria) => ({ id: avaria.id, rotulo: `Avaria #${avaria.id}` }));
      } else {
        itens = conferencias
          .filter(
            (conferencia) =>
              conferencia.erp_adjustment_match &&
              conferencia.approval_status !== "approved",
          )
          .map((conferencia) => ({
            id: conferencia.id,
            rotulo: `Conferência #${conferencia.id}`,
          }));
      }

      setLote((atual) => ({
        ...atual,
        loading: false,
        itens,
        erro: erroLeitura,
      }));
    } catch (err) {
      setLote((atual) => ({
        ...atual,
        loading: false,
        erro: getErrorMessage(
          err,
          "Não foi possível verificar quais solicitações possuem ERP.",
        ),
      }));
    }
  };

  const confirmarLote = async () => {
    const alvos = lote.itens;
    if (alvos.length === 0) return;

    setLote((atual) => ({ ...atual, running: true, erro: null, falhas: [] }));

    const falhas: string[] = [];
    for (const alvo of alvos) {
      try {
        await api.patch(`${ENDPOINTS[tab]}${alvo.id}/approve`, {
          approved: true,
          rejection_reason: null,
        });
      } catch (err) {
        falhas.push(
          `${alvo.rotulo}: ${getErrorMessage(err, "falha ao aprovar.")}`,
        );
      }
    }

    await buscar();

    const aprovadas = alvos.length - falhas.length;
    setLote((atual) => ({
      ...atual,
      running: false,
      open: falhas.length > 0,
      itens: [],
      falhas,
    }));
    setAviso(
      falhas.length === 0
        ? `${aprovadas} solicitação(ões) com ERP aprovada(s).`
        : `${aprovadas} solicitação(ões) aprovada(s); ${falhas.length} com falha.`,
    );
  };

  const total =
    tab === "damaged"
      ? avarias.length
      : tab === "conference"
        ? conferencias.length
        : tarefas.length;

  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas);
  }, [pagina, totalPaginas]);

  const inicio = (pagina - 1) * ITENS_POR_PAGINA;
  const fim = inicio + ITENS_POR_PAGINA;

  const avariasPagina = avarias.slice(inicio, fim);
  const conferenciasPagina = conferencias.slice(inicio, fim);
  const tarefasPagina = tarefas.slice(inicio, fim);

  const colunas = tab === "damaged" ? 8 : tab === "conference" ? 9 : 8;

  const aplicarPeriodo = (dias: number) => {
    setDataFinal(hoje);
    setDataInicial(dayjs().subtract(dias, "day").format("YYYY-MM-DD"));
  };

  const periodoAtivo = (dias: number) =>
    dataFinal === hoje &&
    dataInicial === dayjs().subtract(dias, "day").format("YYYY-MM-DD");

  const nomeFilial = (id: number) =>
    locais.find((l) => l.id === id)?.name ?? String(id);

  const exibirColunaItem = erpModal.taskItems !== null;
  const erpDisplayRows: ErpDisplayRow[] = erpModal.taskItems
    ? erpModal.taskItems.flatMap((item) =>
        item.matches.map((match) => ({
          ...match,
          item_code: item.code,
          item_name: item.product_name,
        })),
      )
    : erpModal.matches;

  /* O backend ordena os matches pela proximidade da data e aplica o primeiro;
     nas tarefas, o primeiro de cada item é o aplicado. */
  const pendentesComErp =
    tab === "damaged"
      ? avarias.filter(
          (avaria) =>
            avaria.erp_avaria_match && avaria.approval_status !== "approved",
        ).length
      : tab === "conference"
        ? conferencias.filter(
            (conferencia) =>
              conferencia.erp_adjustment_match &&
              conferencia.approval_status !== "approved",
          ).length
        : 0;

  const erpAplicados = new Set<number>(
    erpModal.taskItems
      ? erpModal.taskItems
          .map((item) => item.matches[0]?.match_id)
          .filter((id): id is number => id !== undefined)
      : erpModal.matches[0]
        ? [erpModal.matches[0].match_id]
        : [],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Cabeçalho com abas */}
      <div className="rounded-2xl border border-gray-600 bg-gray-800 p-4 shadow-lg sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Central de Aprovações
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-300">
              Aprove ou reprove avarias, conferências e tarefas em um só lugar.
              Os pontos só são creditados após a aprovação.
            </p>
            <p className="mt-1 max-w-2xl text-xs text-gray-400">
              Clique no selo <span className="font-semibold text-green-300">ERP</span>{" "}
              de cada solicitação para ver os movimentos do ERP encontrados.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {TABS.map((item) => {
              const ativo = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  aria-pressed={ativo}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    ativo
                      ? "border-blue-400 bg-blue-600 text-white shadow"
                      : "border-gray-500 bg-gray-700 text-gray-100 hover:bg-gray-600"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Card className="shadow-md">
        {/* Filtros: datas, situação e filial */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <Label htmlFor="data-inicial">Data inicial</Label>
              <TextInput
                id="data-inicial"
                type="date"
                value={dataInicial}
                max={dataFinal || undefined}
                onChange={(e) => setDataInicial(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="data-final">Data final</Label>
              <TextInput
                id="data-final"
                type="date"
                value={dataFinal}
                min={dataInicial || undefined}
                onChange={(e) => setDataFinal(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="filtro-situacao">Situação</Label>
              <Select
                id="filtro-situacao"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as ApprovalStatus | "")
                }
              >
                <option value="">Todas</option>
                <option value="pending">Pendentes</option>
                <option value="approved">Aprovadas</option>
                <option value="rejected">Reprovadas</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="filtro-filial">Filial</Label>
              <Select
                id="filtro-filial"
                value={filial}
                onChange={(e) => setFilial(e.target.value)}
              >
                <option value="">Todas</option>
                {locais.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.id} - {l.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-300">
                Período:
              </span>
              {PERIODOS.map((periodo) => {
                const ativo = periodoAtivo(periodo.dias);
                return (
                  <button
                    key={periodo.label}
                    type="button"
                    onClick={() => aplicarPeriodo(periodo.dias)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      ativo
                        ? "border-blue-500 bg-blue-600 text-white"
                        : "border-gray-400 bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                    }`}
                  >
                    {periodo.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Badge color="blue" className="w-fit">
                {total} solicitação(ões)
              </Badge>
              <Button
                size="xs"
                color="success"
                onClick={abrirLote}
                disabled={carregando || total === 0}
                title="Aprovar todas as solicitações da listagem que possuem movimento ERP"
              >
                {tab === "task"
                  ? "Aprovar todos com ERP"
                  : `Aprovar todos com ERP (${pendentesComErp})`}
              </Button>
              <Button
                size="xs"
                color="gray"
                outline
                onClick={() => buscar()}
                disabled={carregando}
              >
                Atualizar
              </Button>
            </div>
          </div>

          {erro && (
            <p className="rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500 dark:bg-red-900/40 dark:text-red-200">
              {erro}
            </p>
          )}

          {aviso && (
            <p className="rounded-lg border border-green-400 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-500 dark:bg-green-900/40 dark:text-green-200">
              {aviso}
            </p>
          )}

          <div className="overflow-x-auto">
            <Table
              hoverable
              className="min-w-[640px] text-center text-sm sm:min-w-full"
            >
              <TableHead>
                <TableRow>
                  {tab === "damaged" && (
                    <>
                      <TableHeadCell>Data</TableHeadCell>
                      <TableHeadCell>Produto</TableHeadCell>
                      <TableHeadCell>Qtd.</TableHeadCell>
                      <TableHeadCell>Custo</TableHeadCell>
                      <TableHeadCell>Operador / Filial</TableHeadCell>
                      <TableHeadCell title="Clique para ver os movimentos do ERP">
                        ERP
                      </TableHeadCell>
                      <TableHeadCell>Aprovação</TableHeadCell>
                      <TableHeadCell>Ações</TableHeadCell>
                    </>
                  )}
                  {tab === "conference" && (
                    <>
                      <TableHeadCell>Data</TableHeadCell>
                      <TableHeadCell>Produto</TableHeadCell>
                      <TableHeadCell>Sist. / Real</TableHeadCell>
                      <TableHeadCell>Dif.</TableHeadCell>
                      <TableHeadCell>Custo</TableHeadCell>
                      <TableHeadCell>Operador / Filial</TableHeadCell>
                      <TableHeadCell title="Clique para ver os movimentos do ERP">
                        ERP
                      </TableHeadCell>
                      <TableHeadCell>Aprovação</TableHeadCell>
                      <TableHeadCell>Ações</TableHeadCell>
                    </>
                  )}
                  {tab === "task" && (
                    <>
                      <TableHeadCell>ID</TableHeadCell>
                      <TableHeadCell>Operador</TableHeadCell>
                      <TableHeadCell>Data</TableHeadCell>
                      <TableHeadCell>Itens</TableHeadCell>
                      <TableHeadCell>Situação</TableHeadCell>
                      <TableHeadCell title="Clique para ver os movimentos do ERP">
                        ERP
                      </TableHeadCell>
                      <TableHeadCell>Aprovação</TableHeadCell>
                      <TableHeadCell>Ações</TableHeadCell>
                    </>
                  )}
                </TableRow>
              </TableHead>

              <TableBody>
                {carregando ? (
                  <TableRow>
                    <TableCell colSpan={colunas} className="py-10">
                      <div className="flex items-center justify-center">
                        <Spinner
                          aria-label="Carregando aprovações..."
                          size="xl"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : total === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={colunas}
                      className="py-8 text-gray-600 dark:text-gray-300"
                    >
                      Nenhuma solicitação encontrada para os filtros
                      selecionados.
                    </TableCell>
                  </TableRow>
                ) : tab === "damaged" ? (
                  avariasPagina.map((avaria) => (
                    <TableRow
                      key={avaria.id}
                      className="bg-white dark:border-gray-700 dark:bg-gray-800"
                    >
                      <TableCell className="whitespace-nowrap">
                        {formatarData(avaria.damaged_date)}
                      </TableCell>
                      <TableCell>
                        <div
                          className="w-[170px] truncate text-left sm:w-[210px]"
                          title={`${avaria.product_code} - ${avaria.product_name}`}
                        >
                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            {avaria.product_code}
                          </span>
                          <span className="block truncate">
                            {avaria.product_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatarQuantidade(avaria.quantity)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatarMoeda(avaria.cost_total)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="w-[110px] truncate text-left sm:w-[130px]">
                          <span className="block truncate">
                            {avaria.created_by}
                          </span>
                          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                            {nomeFilial(avaria.local)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        {avaria.erp_avaria_match ? (
                          <ErpBadgeButton
                            onClick={() =>
                              abrirErpRegistro(
                                "damaged",
                                avaria.id,
                                `Movimentos ERP — Avaria #${avaria.id}`,
                              )
                            }
                          />
                        ) : (
                          <Badge color="gray">—</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <ApprovalStatusCell item={avaria} />
                      </TableCell>
                      <TableCell>
                        <ApprovalActions
                          onApprove={() => decidir("damaged", avaria.id, true)}
                          onReject={(reason) =>
                            decidir("damaged", avaria.id, false, reason)
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : tab === "conference" ? (
                  conferenciasPagina.map((conferencia) => (
                    <TableRow
                      key={conferencia.id}
                      className="bg-white dark:border-gray-700 dark:bg-gray-800"
                    >
                      <TableCell className="whitespace-nowrap">
                        {formatarData(conferencia.date_)}
                      </TableCell>
                      <TableCell>
                        <div
                          className="w-[170px] truncate text-left sm:w-[210px]"
                          title={`${conferencia.product_code} - ${conferencia.product_name}`}
                        >
                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            {conferencia.product_code}
                          </span>
                          <span className="block truncate">
                            {conferencia.product_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatarQuantidade(conferencia.quantity_system)} /{" "}
                        {formatarQuantidade(conferencia.quantity_real)}
                      </TableCell>
                      <TableCell
                        className={`font-semibold whitespace-nowrap ${
                          conferencia.diference < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-green-700 dark:text-green-400"
                        }`}
                      >
                        {formatarQuantidade(conferencia.diference)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatarMoeda(conferencia.cost_total)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="w-[110px] truncate text-left sm:w-[130px]">
                          <span className="block truncate">
                            {conferencia.created_by}
                          </span>
                          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                            {nomeFilial(conferencia.local)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2">
                        {conferencia.erp_adjustment_match ? (
                          <ErpBadgeButton
                            onClick={() =>
                              abrirErpRegistro(
                                "conference",
                                conferencia.id,
                                `Movimentos ERP — Conferência #${conferencia.id}`,
                              )
                            }
                          />
                        ) : (
                          <Badge color="gray">—</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <ApprovalStatusCell item={conferencia} />
                      </TableCell>
                      <TableCell>
                        <ApprovalActions
                          onApprove={() =>
                            decidir("conference", conferencia.id, true)
                          }
                          onReject={(reason) =>
                            decidir("conference", conferencia.id, false, reason)
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  tarefasPagina.map((tarefa) => (
                    <TableRow
                      key={tarefa.id}
                      className="bg-white dark:border-gray-700 dark:bg-gray-800"
                    >
                      <TableCell>{tarefa.id}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {tarefa.user_name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatarData(tarefa.created_date)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          color={tarefa.items_confirmed > 0 ? "blue" : "gray"}
                        >
                          {tarefa.items_confirmed}/{tarefa.quantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {tarefa.completed ? (
                          <Badge color="success">Concluída</Badge>
                        ) : (
                          <Badge color="warning">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-2">
                        <ErpBadgeButton
                          onClick={() => abrirErpTarefa(tarefa)}
                          title="Ver movimentos ERP dos itens da tarefa"
                        />
                      </TableCell>
                      <TableCell>
                        <ApprovalStatusCell item={tarefa} />
                      </TableCell>
                      <TableCell>
                        <ApprovalActions
                          onApprove={() => decidir("task", tarefa.id, true)}
                          onReject={(reason) =>
                            decidir("task", tarefa.id, false, reason)
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPaginas > 1 && (
            <div className="flex justify-center">
              <Pagination
                currentPage={pagina}
                totalPages={totalPaginas}
                onPageChange={setPagina}
                showIcons
              />
            </div>
          )}
        </div>
      </Card>

      <Modal show={erpModal.open} onClose={fecharErpModal} size="4xl">
        <ModalHeader>{erpModal.title}</ModalHeader>
        <ModalBody>
          {erpModal.loading ? (
            <div className="flex justify-center py-8">
              <Spinner size="xl" />
            </div>
          ) : erpModal.error ? (
            <p className="rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500 dark:bg-red-900/40 dark:text-red-200">
              {erpModal.error}
            </p>
          ) : erpDisplayRows.length === 0 ? (
            <p className="py-4 text-center text-gray-600 dark:text-gray-300">
              {exibirColunaItem
                ? "Nenhum item desta tarefa possui movimento ERP."
                : "Nenhum movimento ERP encontrado para este registro."}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-left dark:border-gray-700 dark:bg-gray-800/60">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    color={erpDisplayRows.length > 1 ? "warning" : "success"}
                  >
                    {erpDisplayRows.length} movimento(s) ERP localizado(s)
                  </Badge>
                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    Movimentos do ERP que batem com produto, local e data do
                    registro.
                  </span>
                </div>
                {erpDisplayRows.length > 1 && (
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                    Mais de um movimento atende ao mesmo produto/local/data. O
                    mais próximo da data do registro foi aplicado (linha
                    destacada) e os demais ficam listados para conferência.
                  </p>
                )}
              </div>

              <div className="overflow-x-auto">
                <Table
                  hoverable
                  className="min-w-[640px] text-center sm:min-w-full"
                >
                  <TableHead>
                    <TableRow>
                      {exibirColunaItem && <TableHeadCell>Item</TableHeadCell>}
                      <TableHeadCell>Produto</TableHeadCell>
                      <TableHeadCell>Tipo</TableHeadCell>
                      <TableHeadCell>Nº Mov.</TableHeadCell>
                      <TableHeadCell>Data Mov.</TableHeadCell>
                      <TableHeadCell>Qtd.</TableHeadCell>
                      <TableHeadCell>Custo Unit.</TableHeadCell>
                      <TableHeadCell>Filial</TableHeadCell>
                      <TableHeadCell>Local</TableHeadCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {erpDisplayRows.map((row) => (
                      <TableRow
                        key={`${row.record_type}-${row.record_id}-${row.match_id}`}
                        className={
                          erpAplicados.has(row.match_id)
                            ? "bg-green-50/70 dark:bg-green-900/20"
                            : undefined
                        }
                      >
                        {exibirColunaItem && (
                          <TableCell className="text-left">
                            <div className="break-words">
                              <span className="font-medium">
                                {row.item_code ?? "—"}
                              </span>
                              <span className="mx-1 text-gray-500">—</span>
                              {row.item_name ?? "—"}
                            </div>
                          </TableCell>
                        )}
                        <TableCell className="text-left">
                          <div className="break-words">
                            <span className="font-medium">
                              {row.product_code}
                            </span>
                            <span className="mx-1 text-gray-500">—</span>
                            {row.product_name}
                            {erpAplicados.has(row.match_id) && (
                              <Badge color="success" className="ml-2 inline-flex">
                                Aplicado
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            color={
                              row.match_type === "ajuste" ? "blue" : "warning"
                            }
                          >
                            {row.match_type === "ajuste" ? "Ajuste" : "Avaria"}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {row.num_mov}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatarData(row.dt_mov)}
                        </TableCell>
                        <TableCell>
                          {formatarQuantidade(row.quantity)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatarMoeda(row.cost_unit)}
                        </TableCell>
                        <TableCell>{row.cod_filial ?? "—"}</TableCell>
                        <TableCell>{row.erp_local ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="gray" onClick={fecharErpModal}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>

      <Modal
        show={lote.open}
        onClose={() => {
          if (!lote.running) setLote((atual) => ({ ...atual, open: false }));
        }}
        size="md"
      >
        <ModalHeader>Aprovar solicitações com ERP</ModalHeader>
        <ModalBody>
          {lote.loading ? (
            <div className="flex justify-center py-8">
              <Spinner size="xl" />
            </div>
          ) : (
            <div className="space-y-3">
              {lote.erro && (
                <p className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500 dark:bg-amber-900/40 dark:text-amber-200">
                  {lote.erro}
                </p>
              )}

              {lote.falhas.length > 0 && (
                <div className="rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500 dark:bg-red-900/40 dark:text-red-200">
                  <p className="font-semibold">
                    {lote.falhas.length} solicitação(ões) não puderam ser
                    aprovadas:
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
                    {lote.falhas.map((falha) => (
                      <li key={falha}>{falha}</li>
                    ))}
                  </ul>
                </div>
              )}

              {lote.itens.length === 0 ? (
                lote.falhas.length === 0 && (
                  <p className="py-2 text-center text-gray-600 dark:text-gray-300">
                    Nenhuma solicitação da listagem possui movimento ERP para
                    aprovar.
                  </p>
                )
              ) : (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    <span className="font-semibold">{lote.itens.length}</span>{" "}
                    solicitação(ões) com ERP serão aprovadas. As demais não são
                    afetadas.
                  </p>
                  <ul className="max-h-40 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-gray-700 dark:text-gray-200">
                    {lote.itens.map((item) => (
                      <li key={item.id}>{item.rotulo}</li>
                    ))}
                  </ul>
                  {lote.falhas.length > 0 && (
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      Os itens já processados não serão aprovados novamente.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            color="success"
            disabled={lote.loading || lote.running || lote.itens.length === 0}
            onClick={confirmarLote}
          >
            {lote.running ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Aprovando...
              </>
            ) : (
              `Aprovar ${lote.itens.length}`
            )}
          </Button>
          <Button
            color="gray"
            disabled={lote.running}
            onClick={() => setLote((atual) => ({ ...atual, open: false }))}
          >
            Cancelar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
