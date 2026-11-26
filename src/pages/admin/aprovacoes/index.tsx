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

  const colunas = tab === "damaged" ? 11 : tab === "conference" ? 12 : 8;

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

            <div className="flex items-center gap-3">
              <Badge color="blue" className="w-fit">
                {total} solicitação(ões)
              </Badge>
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
                      <TableHeadCell>ERP</TableHeadCell>
                      <TableHeadCell>Check ERP</TableHeadCell>
                      <TableHeadCell>Nº Mov.</TableHeadCell>
                      <TableHeadCell>Data Mov.</TableHeadCell>
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
                      <TableHeadCell>ERP</TableHeadCell>
                      <TableHeadCell>Check ERP</TableHeadCell>
                      <TableHeadCell>Nº Mov.</TableHeadCell>
                      <TableHeadCell>Data Mov.</TableHeadCell>
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
                      <TableHeadCell>ERP</TableHeadCell>
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
                      <TableCell>
                        {avaria.erp_avaria_match ? (
                          <Badge color="success">ERP</Badge>
                        ) : (
                          <Badge color="gray">—</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {avaria.erp_avaria_match ? (
                          <Button
                            size="xs"
                            color="blue"
                            outline
                            onClick={() =>
                              abrirErpRegistro(
                                "damaged",
                                avaria.id,
                                `Checks ERP — Avaria #${avaria.id}`,
                              )
                            }
                            title="Ver checks ERP encontrados"
                          >
                            Ver checks
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {avaria.erp_num_mov ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatarData(avaria.erp_dt_mov)}
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
                      <TableCell>
                        {conferencia.erp_adjustment_match ? (
                          <Badge color="success">ERP</Badge>
                        ) : (
                          <Badge color="gray">—</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {conferencia.erp_adjustment_match ? (
                          <Button
                            size="xs"
                            color="blue"
                            outline
                            onClick={() =>
                              abrirErpRegistro(
                                "conference",
                                conferencia.id,
                                `Checks ERP — Conferência #${conferencia.id}`,
                              )
                            }
                            title="Ver checks ERP encontrados"
                          >
                            Ver checks
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-500">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {conferencia.erp_num_mov ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatarData(conferencia.erp_dt_mov)}
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
                      <TableCell>
                        <Button
                          size="xs"
                          color="blue"
                          outline
                          onClick={() => abrirErpTarefa(tarefa)}
                          title="Ver checks ERP dos itens da tarefa"
                        >
                          Ver checks
                        </Button>
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
                ? "Nenhum item desta tarefa possui cruzamento ERP."
                : "Nenhum check ERP encontrado para este registro."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table
                hoverable
                className="min-w-[640px] text-center sm:min-w-full"
              >
                <TableHead>
                  <TableRow>
                    {exibirColunaItem && <TableHeadCell>Item</TableHeadCell>}
                    <TableHeadCell>Produto</TableHeadCell>
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
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.num_mov}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatarData(row.dt_mov)}
                      </TableCell>
                      <TableCell>{formatarQuantidade(row.quantity)}</TableCell>
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
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="gray" onClick={fecharErpModal}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
