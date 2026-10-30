import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
  Textarea,
} from "flowbite-react";
import { HiPlus, HiRefresh } from "react-icons/hi";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import api from "../../../api";
import { useAuthStore } from "../../authStore";
import ReceiptPhotoGallery from "../../recebimento/photoGallery";
import {
  formatQuantity,
  getApiError,
  photoUrl,
  type AdminNewProductItem,
  type AdminReceiptSummary,
  type LocalOption,
  type Receipt,
  type UserOption,
} from "../../recebimento/types";

dayjs.locale("pt-br");

/* ============================================================
   Tipos auxiliares
============================================================ */
type Feedback = { type: "error" | "success"; text: string } | null;

interface Filters {
  local: string;
  userId: string;
  date: string;
  startDate: string;
  endDate: string;
  completed: string;
  approved: string;
}

const EMPTY_FILTERS: Filters = {
  local: "",
  userId: "",
  date: "",
  startDate: "",
  endDate: "",
  completed: "",
  approved: "",
};

const LIST_LIMIT = 20;
const NEW_PRODUCTS_LIMIT = 20;

export default function AdminReceipt() {
  const user = useAuthStore((state) => state.user);

  /* ============================================================
     Estado geral
  ============================================================ */
  const [tab, setTab] = useState<"receipts" | "new-products">("receipts");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const feedbackTimer = useRef<number | null>(null);

  const [locals, setLocals] = useState<LocalOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  // Filtros aplicados (snapshot) e em edição
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);

  // KPIs
  const [summary, setSummary] = useState<AdminReceiptSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Listagem
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  // Produtos novos
  const [newProducts, setNewProducts] = useState<AdminNewProductItem[]>([]);
  const [newProductsLoading, setNewProductsLoading] = useState(false);
  const [newProductsPage, setNewProductsPage] = useState(1);
  const [newProductsHasNext, setNewProductsHasNext] = useState(false);

  // Modais
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    user_id: "",
    local: "",
    created_date: dayjs().format("YYYY-MM-DD"),
    observations: "",
  });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<Receipt | null>(null);
  const [auditObservations, setAuditObservations] = useState("");
  const [awardPoints, setAwardPoints] = useState(true);

  const [deleteTarget, setDeleteTarget] = useState<Receipt | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* ============================================================
     Feedback
  ============================================================ */
  const showFeedback = useCallback(
    (type: "error" | "success", text: string) => {
      setFeedback({ type, text });
      if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = window.setTimeout(() => setFeedback(null), 5000);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    };
  }, []);

  const isAdmin = user?.admin === 1;

  /* ============================================================
     Cadastros auxiliares
  ============================================================ */
  useEffect(() => {
    if (!isAdmin) return;

    api
      .get<LocalOption[]>("/local/")
      .then((res) => setLocals(Array.isArray(res.data) ? res.data : []))
      .catch((err) =>
        showFeedback("error", getApiError(err, "Erro ao carregar filiais.")),
      );

    api
      .get<UserOption[]>("/admin/users")
      .then((res) => setUsers(Array.isArray(res.data) ? res.data : []))
      .catch((err) =>
        showFeedback("error", getApiError(err, "Erro ao carregar usuários.")),
      );
  }, [isAdmin, showFeedback]);

  /* ============================================================
     KPIs
  ============================================================ */
  const fetchSummary = useCallback(async () => {
    if (!isAdmin) return;
    setSummaryLoading(true);
    try {
      const res = await api.get<AdminReceiptSummary>("/receipt/admin/summary", {
        params: {
          ...(applied.local ? { local: Number(applied.local) } : {}),
          ...(applied.startDate ? { start_date: applied.startDate } : {}),
          ...(applied.endDate ? { end_date: applied.endDate } : {}),
        },
      });
      setSummary(res.data);
    } catch (err) {
      showFeedback(
        "error",
        getApiError(err, "Erro ao carregar os indicadores."),
      );
    } finally {
      setSummaryLoading(false);
    }
  }, [
    isAdmin,
    applied.local,
    applied.startDate,
    applied.endDate,
    showFeedback,
  ]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  /* ============================================================
     Listagem administrativa
  ============================================================ */
  const fetchReceipts = useCallback(async () => {
    if (!isAdmin) return;
    setListLoading(true);
    try {
      const res = await api.get<Receipt[]>("/receipt/admin/", {
        params: {
          ...(applied.local ? { local: Number(applied.local) } : {}),
          ...(applied.userId ? { user_id: Number(applied.userId) } : {}),
          ...(applied.date ? { date: applied.date } : {}),
          ...(applied.startDate ? { start_date: applied.startDate } : {}),
          ...(applied.endDate ? { end_date: applied.endDate } : {}),
          ...(applied.completed !== ""
            ? { completed: applied.completed === "true" }
            : {}),
          ...(applied.approved !== ""
            ? { approved: applied.approved === "true" }
            : {}),
          limit: LIST_LIMIT,
          offset: (page - 1) * LIST_LIMIT,
        },
      });
      const data = Array.isArray(res.data) ? res.data : [];
      setReceipts(data);
      setHasNext(data.length === LIST_LIMIT);
    } catch (err) {
      setReceipts([]);
      setHasNext(false);
      showFeedback(
        "error",
        getApiError(err, "Erro ao listar os recebimentos."),
      );
    } finally {
      setListLoading(false);
    }
  }, [isAdmin, applied, page, showFeedback]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  /* ============================================================
     Produtos novos
  ============================================================ */
  const fetchNewProducts = useCallback(async () => {
    if (!isAdmin) return;
    setNewProductsLoading(true);
    try {
      const res = await api.get<AdminNewProductItem[]>(
        "/receipt/admin/new-products",
        {
          params: {
            ...(applied.local ? { local: Number(applied.local) } : {}),
            ...(applied.startDate ? { start_date: applied.startDate } : {}),
            ...(applied.endDate ? { end_date: applied.endDate } : {}),
            limit: NEW_PRODUCTS_LIMIT,
            offset: (newProductsPage - 1) * NEW_PRODUCTS_LIMIT,
          },
        },
      );
      const data = Array.isArray(res.data) ? res.data : [];
      setNewProducts(data);
      setNewProductsHasNext(data.length === NEW_PRODUCTS_LIMIT);
    } catch (err) {
      setNewProducts([]);
      setNewProductsHasNext(false);
      showFeedback("error", getApiError(err, "Erro ao listar produtos novos."));
    } finally {
      setNewProductsLoading(false);
    }
  }, [
    isAdmin,
    applied.local,
    applied.startDate,
    applied.endDate,
    newProductsPage,
    showFeedback,
  ]);

  useEffect(() => {
    fetchNewProducts();
  }, [fetchNewProducts]);

  /* ============================================================
     Ações
  ============================================================ */
  const applyFilters = () => {
    setPage(1);
    setNewProductsPage(1);
    setApplied({ ...filters });
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
    setNewProductsPage(1);
    setApplied({ ...EMPTY_FILTERS });
  };

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchSummary(), fetchReceipts(), fetchNewProducts()]);
  }, [fetchSummary, fetchReceipts, fetchNewProducts]);

  const syncDetail = async (receiptId: number) => {
    try {
      const res = await api.get<Receipt>(`/receipt/admin/${receiptId}`);
      setDetail(res.data);
    } catch {
      // A listagem principal já é recarregada pelas ações.
    }
  };

  const openDetail = async (receiptId: number) => {
    setDetailOpen(true);
    setDetail(null);
    setAuditObservations("");
    setAwardPoints(true);
    setDetailLoading(true);
    try {
      const res = await api.get<Receipt>(`/receipt/admin/${receiptId}`);
      setDetail(res.data);
    } catch (err) {
      showFeedback(
        "error",
        getApiError(err, "Erro ao carregar o recebimento."),
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async (approved: boolean) => {
    if (!detail) return;
    try {
      await api.patch<Receipt>(`/receipt/admin/${detail.id}/approve`, {
        approved,
        observations: auditObservations || undefined,
      });
      await syncDetail(detail.id);
      setAuditObservations("");
      showFeedback(
        "success",
        approved
          ? "Recebimento aprovado com sucesso!"
          : "Recebimento reprovado.",
      );
      await refreshAll();
    } catch (err) {
      showFeedback("error", getApiError(err, "Erro ao registrar a auditoria."));
    }
  };

  const handleForceComplete = async () => {
    if (!detail) return;
    if (
      !confirm(
        `Forçar a finalização do recebimento #${detail.id}? ${
          awardPoints
            ? "Os +10 pontos serão concedidos."
            : "Nenhum ponto será concedido."
        }`,
      )
    )
      return;
    try {
      await api.patch<Receipt>(
        `/receipt/admin/${detail.id}/force-complete`,
        undefined,
        { params: { award_points: awardPoints } },
      );
      await syncDetail(detail.id);
      showFeedback("success", "Recebimento finalizado administrativamente.");
      await refreshAll();
    } catch (err) {
      showFeedback(
        "error",
        getApiError(err, "Erro ao finalizar o recebimento."),
      );
    }
  };

  const handleCreate = async () => {
    if (!createForm.user_id) {
      showFeedback("error", "Selecione o operador responsável.");
      return;
    }
    if (!createForm.local) {
      showFeedback("error", "Selecione a filial.");
      return;
    }
    if (!createForm.created_date) {
      showFeedback("error", "Informe a data do recebimento.");
      return;
    }

    setCreateLoading(true);
    try {
      await api.post("/receipt/admin/", {
        user_id: Number(createForm.user_id),
        local: Number(createForm.local),
        created_date: createForm.created_date,
        observations: createForm.observations || undefined,
      });
      showFeedback("success", "Recebimento aberto para o operador.");
      setCreateOpen(false);
      setCreateForm({
        user_id: "",
        local: "",
        created_date: dayjs().format("YYYY-MM-DD"),
        observations: "",
      });
      await refreshAll();
    } catch (err) {
      showFeedback("error", getApiError(err, "Erro ao abrir recebimento."));
    } finally {
      setCreateLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/receipt/admin/${deleteTarget.id}`);
      showFeedback("success", "Recebimento removido com sucesso.");
      setDeleteTarget(null);
      setDetailOpen(false);
      setDetail(null);
      await refreshAll();
    } catch (err) {
      showFeedback("error", getApiError(err, "Erro ao excluir o recebimento."));
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  /* ============================================================
     Derivados
  ============================================================ */
  const kpis = useMemo(() => {
    if (!summary) return [];
    return [
      { label: "Recebimentos", value: formatQuantity(summary.total_receipts) },
      {
        label: "Finalizados",
        value: formatQuantity(summary.completed_receipts),
      },
      { label: "Pendentes", value: formatQuantity(summary.pending_receipts) },
      { label: "Aprovados", value: formatQuantity(summary.approved_receipts) },
      {
        label: "Itens recebidos",
        value: formatQuantity(summary.total_items_received),
      },
      {
        label: "Unidades recebidas",
        value: formatQuantity(summary.total_units_received),
      },
      {
        label: "Produtos novos",
        value: formatQuantity(summary.total_new_products),
      },
    ];
  }, [summary]);

  const localsById = useMemo(() => {
    const map = new Map<number, string>();
    locals.forEach((local) => map.set(local.id, local.name));
    return map;
  }, [locals]);

  const statusBadge = (receipt: Receipt) =>
    receipt.completed ? (
      <Badge color="success">Finalizado</Badge>
    ) : (
      <Badge color="warning">Em andamento</Badge>
    );

  const approvalBadge = (approved: boolean) =>
    approved ? (
      <Badge color="blue">Aprovado</Badge>
    ) : (
      <Badge color="gray">Não aprovado</Badge>
    );

  /* ============================================================
     Guarda de acesso
  ============================================================ */
  if (!isAdmin) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-lg text-white">Acesso restrito a administradores.</p>
      </div>
    );
  }

  /* ============================================================
     Render
  ============================================================ */
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 text-gray-100">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Administração de Recebimento
          </h1>
          <p className="text-sm text-gray-300">
            KPIs, auditoria, aprovação e regularização de produtos sem cadastro.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button color="gray" onClick={refreshAll}>
            <HiRefresh className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <HiPlus className="mr-2 h-4 w-4" />
            Abrir Recebimento
          </Button>
        </div>
      </div>

      {feedback && (
        <Alert
          color={feedback.type === "error" ? "failure" : "success"}
          onDismiss={() => setFeedback(null)}
        >
          {feedback.text}
        </Alert>
      )}

      {/* KPIs */}
      <div>
        {summaryLoading && !summary ? (
          <div className="flex justify-center py-8">
            <Spinner size="xl" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {kpis.map((kpi) => (
              <Card key={kpi.label} className="text-center">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-300">
                  {kpi.label}
                </p>
                <p className="text-2xl font-bold text-gray-800 dark:text-white">
                  {kpi.value}
                </p>
              </Card>
            ))}
          </div>
        )}

        {summary && Object.keys(summary.receipts_by_local ?? {}).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(summary.receipts_by_local).map(
              ([localId, total]) => (
                <Badge key={localId} color="blue">
                  {localsById.get(Number(localId)) ?? `Filial ${localId}`}:{" "}
                  {total}
                </Badge>
              ),
            )}
          </div>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <div>
            <Label htmlFor="filter-local">Filial</Label>
            <Select
              id="filter-local"
              value={filters.local}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, local: e.target.value }))
              }
            >
              <option value="">Todas</option>
              {locals.map((local) => (
                <option key={local.id} value={local.id}>
                  {local.id} - {local.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="filter-user">Operador</Label>
            <Select
              id="filter-user"
              value={filters.userId}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, userId: e.target.value }))
              }
            >
              <option value="">Todos</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="filter-date">Data exata</Label>
            <TextInput
              id="filter-date"
              type="date"
              value={filters.date}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, date: e.target.value }))
              }
            />
          </div>

          <div>
            <Label htmlFor="filter-start">Data inicial</Label>
            <TextInput
              id="filter-start"
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, startDate: e.target.value }))
              }
            />
          </div>

          <div>
            <Label htmlFor="filter-end">Data final</Label>
            <TextInput
              id="filter-end"
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, endDate: e.target.value }))
              }
            />
          </div>

          <div>
            <Label htmlFor="filter-completed">Situação</Label>
            <Select
              id="filter-completed"
              value={filters.completed}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, completed: e.target.value }))
              }
            >
              <option value="">Todas</option>
              <option value="false">Em andamento</option>
              <option value="true">Finalizados</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="filter-approved">Auditoria</Label>
            <Select
              id="filter-approved"
              value={filters.approved}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, approved: e.target.value }))
              }
            >
              <option value="">Todas</option>
              <option value="true">Aprovados</option>
              <option value="false">Não aprovados</option>
            </Select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={applyFilters}>Aplicar filtros</Button>
          <Button color="gray" onClick={clearFilters}>
            Limpar
          </Button>
        </div>
      </Card>

      {/* Abas */}
      <div className="flex gap-2">
        <Button
          size="sm"
          color={tab === "receipts" ? "blue" : "gray"}
          onClick={() => setTab("receipts")}
        >
          Recebimentos
        </Button>
        <Button
          size="sm"
          color={tab === "new-products" ? "blue" : "gray"}
          onClick={() => setTab("new-products")}
        >
          Produtos Novos
        </Button>
      </div>

      {/* ==================== RECEBIMENTOS ==================== */}
      {tab === "receipts" && (
        <Card>
          {listLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="xl" />
            </div>
          ) : receipts.length === 0 ? (
            <p className="py-8 text-center text-gray-500 dark:text-gray-300">
              Nenhum recebimento encontrado para os filtros aplicados.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table hoverable>
                  <TableHead>
                    <TableRow>
                      <TableHeadCell>ID</TableHeadCell>
                      <TableHeadCell>Operador</TableHeadCell>
                      <TableHeadCell>Data</TableHeadCell>
                      <TableHeadCell className="text-center">
                        Filial
                      </TableHeadCell>
                      <TableHeadCell className="text-center">
                        Itens
                      </TableHeadCell>
                      <TableHeadCell className="text-center">
                        Qtd. física
                      </TableHeadCell>
                      <TableHeadCell className="text-center">
                        Novos
                      </TableHeadCell>
                      <TableHeadCell className="text-center">
                        Situação
                      </TableHeadCell>
                      <TableHeadCell className="text-center">
                        Auditoria
                      </TableHeadCell>
                      <TableHeadCell className="text-center">
                        Ações
                      </TableHeadCell>
                    </TableRow>
                  </TableHead>
                  <TableBody className="divide-y">
                    {receipts.map((receipt) => (
                      <TableRow key={receipt.id}>
                        <TableCell>#{receipt.id}</TableCell>
                        <TableCell>{receipt.user_name}</TableCell>
                        <TableCell>
                          {dayjs(receipt.created_date).format("DD/MM/YYYY")}
                        </TableCell>
                        <TableCell className="text-center">
                          {receipt.local}
                        </TableCell>
                        <TableCell className="text-center">
                          {receipt.items_count ?? receipt.quantity ?? 0}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatQuantity(receipt.total_physical_quantity)}
                        </TableCell>
                        <TableCell className="text-center">
                          {receipt.new_products_count ?? 0}
                        </TableCell>
                        <TableCell className="text-center">
                          {statusBadge(receipt)}
                        </TableCell>
                        <TableCell className="text-center">
                          {approvalBadge(receipt.approved)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-center gap-1">
                            <Button
                              size="xs"
                              color="blue"
                              outline
                              onClick={() => openDetail(receipt.id)}
                            >
                              Detalhes
                            </Button>
                            <Button
                              size="xs"
                              color="red"
                              outline
                              onClick={() => setDeleteTarget(receipt)}
                            >
                              Excluir
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-300">
                  Página {page}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    color="gray"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={!hasNext}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {/* ==================== PRODUTOS NOVOS ==================== */}
      {tab === "new-products" && (
        <Card>
          {newProductsLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="xl" />
            </div>
          ) : newProducts.length === 0 ? (
            <p className="py-8 text-center text-gray-500 dark:text-gray-300">
              Nenhum produto novo pendente de cadastro.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table hoverable>
                  <TableHead>
                    <TableRow>
                      <TableHeadCell>Produto</TableHeadCell>
                      <TableHeadCell>Código</TableHeadCell>
                      <TableHeadCell className="text-center">
                        Filial
                      </TableHeadCell>
                      <TableHeadCell>Operador</TableHeadCell>
                      <TableHeadCell className="text-center">
                        Qtd. física
                      </TableHeadCell>
                      <TableHeadCell>Recebido em</TableHeadCell>
                      <TableHeadCell className="text-center">
                        Fotos
                      </TableHeadCell>
                      <TableHeadCell className="text-center">
                        Ações
                      </TableHeadCell>
                    </TableRow>
                  </TableHead>
                  <TableBody className="divide-y">
                    {newProducts.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium text-gray-800 dark:text-white">
                            {item.product_name}
                          </div>
                          {item.observations && (
                            <div className="text-xs text-gray-500">
                              {item.observations}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{item.product_code || "—"}</TableCell>
                        <TableCell className="text-center">
                          {item.local}
                        </TableCell>
                        <TableCell>{item.user_name}</TableCell>
                        <TableCell className="text-center">
                          {formatQuantity(item.quantity_physical)}
                        </TableCell>
                        <TableCell>
                          {dayjs(item.received_at).format("DD/MM/YYYY HH:mm")}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs">
                            Baia {item.dock_photos?.length ?? 0} · Prateleira{" "}
                            {item.shelf_photos?.length ?? 0} · NF{" "}
                            {item.invoice_photo ? 1 : 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            <Button
                              size="xs"
                              color="blue"
                              outline
                              onClick={() => openDetail(item.receipt_id)}
                            >
                              Ver recebimento
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-300">
                  Página {newProductsPage}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    color="gray"
                    disabled={newProductsPage === 1}
                    onClick={() =>
                      setNewProductsPage((p) => Math.max(1, p - 1))
                    }
                  >
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    color="gray"
                    disabled={!newProductsHasNext}
                    onClick={() => setNewProductsPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}

      {/* ==================== MODAL: ABRIR RECEBIMENTO ==================== */}
      <Modal show={createOpen} onClose={() => setCreateOpen(false)}>
        <ModalHeader>Novo Recebimento Administrativo</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <Label htmlFor="admin-create-user">Operador responsável</Label>
              <Select
                id="admin-create-user"
                value={createForm.user_id}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    user_id: e.target.value,
                  }))
                }
              >
                <option value="">Selecione</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.username ? ` (${u.username})` : ""}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="admin-create-local">Filial</Label>
              <Select
                id="admin-create-local"
                value={createForm.local}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    local: e.target.value,
                  }))
                }
              >
                <option value="">Selecione</option>
                {locals.map((local) => (
                  <option key={local.id} value={local.id}>
                    {local.id} - {local.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="admin-create-date">Data do recebimento</Label>
              <TextInput
                id="admin-create-date"
                type="date"
                value={createForm.created_date}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    created_date: e.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label htmlFor="admin-create-obs">Observações (opcional)</Label>
              <Textarea
                id="admin-create-obs"
                rows={3}
                placeholder="Se omitida, o backend registra quem criou o lote."
                value={createForm.observations}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    observations: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button onClick={handleCreate} disabled={createLoading}>
            {createLoading ? <Spinner size="sm" /> : "Abrir Recebimento"}
          </Button>
          <Button color="gray" onClick={() => setCreateOpen(false)}>
            Cancelar
          </Button>
        </ModalFooter>
      </Modal>

      {/* ==================== MODAL: DETALHE / AUDITORIA ==================== */}
      <Modal
        show={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetail(null);
        }}
        size="5xl"
      >
        <ModalHeader>
          Recebimento #{detail?.id ?? "—"}
          {detail && (
            <span className="ml-3 text-sm font-normal text-gray-500">
              {detail.user_name}
            </span>
          )}
        </ModalHeader>
        <ModalBody className="max-h-[70vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="xl" />
            </div>
          ) : !detail ? (
            <p className="py-8 text-center text-gray-500">
              Não foi possível carregar o recebimento.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div>
                  <p className="text-xs text-gray-500">Data</p>
                  <p className="font-semibold text-gray-800 dark:text-white">
                    {dayjs(detail.created_date).format("DD/MM/YYYY")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Filial</p>
                  <p className="font-semibold text-gray-800 dark:text-white">
                    {localsById.get(detail.local) ?? detail.local}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Situação</p>
                  {statusBadge(detail)}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Auditoria</p>
                  {approvalBadge(detail.approved)}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Finalizado em</p>
                  <p className="font-semibold text-gray-800 dark:text-white">
                    {detail.completed_at
                      ? dayjs(detail.completed_at).format("DD/MM/YYYY HH:mm")
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-gray-100 p-3 dark:bg-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-300">
                    Itens
                  </p>
                  <p className="text-xl font-bold text-gray-800 dark:text-white">
                    {detail.items_count ?? detail.items?.length ?? 0}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-100 p-3 dark:bg-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-300">
                    Qtd. física
                  </p>
                  <p className="text-xl font-bold text-gray-800 dark:text-white">
                    {formatQuantity(detail.total_physical_quantity)}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-100 p-3 dark:bg-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-300">
                    Produtos novos
                  </p>
                  <p className="text-xl font-bold text-gray-800 dark:text-white">
                    {detail.new_products_count ??
                      (detail.items ?? []).filter((i) => i.is_new_product)
                        .length}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-100 p-3 dark:bg-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-300">
                    Abertura
                  </p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white">
                    {dayjs(detail.time_stamp ?? detail.created_date).format(
                      "DD/MM/YYYY HH:mm",
                    )}
                  </p>
                </div>
              </div>

              {detail.observations && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <strong>Observações:</strong> {detail.observations}
                </p>
              )}

              {(detail.items ?? []).length === 0 ? (
                <p className="py-6 text-center text-gray-500 dark:text-gray-300">
                  Este recebimento ainda não possui produtos.
                </p>
              ) : (
                <div className="space-y-3">
                  {(detail.items ?? []).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-800 dark:text-white">
                              {item.product_name}
                            </span>
                            {item.is_new_product && (
                              <Badge color="purple">Produto novo</Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            Código: {item.product_code || "—"} · Recebido por{" "}
                            {item.user_name} em{" "}
                            {dayjs(item.received_at).format("DD/MM/YYYY HH:mm")}
                          </p>
                          {item.observations && (
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                              {item.observations}
                            </p>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-3 text-center text-sm">
                          <div>
                            <p className="text-xs text-gray-500">Sistema</p>
                            <p className="font-semibold">
                              {formatQuantity(item.quantity_system)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Físico</p>
                            <p className="font-semibold">
                              {formatQuantity(item.quantity_physical)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Recebido</p>
                            <p className="font-semibold">
                              {formatQuantity(item.received_quantity)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Diferença</p>
                            <p className="font-semibold">
                              {formatQuantity(item.difference)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <ReceiptPhotoGallery
                          title="Baia"
                          photos={item.dock_photos ?? []}
                          emptyLabel="Sem fotos"
                        />
                        <ReceiptPhotoGallery
                          title="Prateleira"
                          photos={item.shelf_photos ?? []}
                          emptyLabel="Sem fotos"
                        />
                        {item.invoice_photo ? (
                          <div>
                            <p className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                              Nota fiscal
                            </p>
                            <a
                              href={photoUrl(item.invoice_photo) ?? "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="block w-fit overflow-hidden rounded-lg ring-1 ring-gray-300 transition hover:ring-blue-500 dark:ring-gray-600"
                            >
                              <img
                                src={photoUrl(item.invoice_photo) ?? ""}
                                alt="Nota fiscal"
                                className="h-20 w-20 object-cover"
                              />
                            </a>
                          </div>
                        ) : (
                          <div>
                            <p className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                              Nota fiscal
                            </p>
                            <p className="text-xs text-gray-400">Sem foto</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Auditoria */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                <h4 className="mb-2 font-semibold text-blue-900 dark:text-blue-100">
                  Auditoria administrativa
                </h4>
                <Label htmlFor="audit-obs">Justificativa (opcional)</Label>
                <Textarea
                  id="audit-obs"
                  rows={2}
                  placeholder="Ex.: fotos da baia e da prateleira em conformidade."
                  value={auditObservations}
                  onChange={(e) => setAuditObservations(e.target.value)}
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button color="green" onClick={() => handleApprove(true)}>
                    Aprovar
                  </Button>
                  <Button
                    color="red"
                    outline
                    onClick={() => handleApprove(false)}
                  >
                    Reprovar
                  </Button>
                  <div className="mx-2 h-6 w-px bg-blue-300 dark:bg-blue-700" />
                  <label className="flex items-center gap-2 text-sm text-blue-900 dark:text-blue-100">
                    <input
                      type="checkbox"
                      checked={awardPoints}
                      onChange={(e) => setAwardPoints(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    Conceder +10 pontos ao finalizar
                  </label>
                  <Button
                    color="purple"
                    onClick={handleForceComplete}
                    disabled={detail.completed}
                  >
                    Forçar Finalização
                  </Button>
                </div>
                {detail.completed && (
                  <p className="mt-2 text-xs text-blue-800 dark:text-blue-200">
                    Este recebimento já está finalizado.
                  </p>
                )}
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter className="flex flex-wrap gap-2">
          <Button
            color="red"
            outline
            onClick={() => detail && setDeleteTarget(detail)}
          >
            Excluir Recebimento
          </Button>
          <Button
            color="gray"
            onClick={() => {
              setDetailOpen(false);
              setDetail(null);
            }}
          >
            Fechar
          </Button>
        </ModalFooter>
      </Modal>

      {/* ==================== MODAL: CONFIRMAR EXCLUSÃO ==================== */}
      <Modal show={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <ModalHeader>Excluir Recebimento</ModalHeader>
        <ModalBody>
          <p className="text-gray-700 dark:text-gray-200">
            Tem certeza que deseja excluir o recebimento{" "}
            <strong>#{deleteTarget?.id}</strong> ({deleteTarget?.user_name})?
          </p>
          <p className="mt-2 text-sm text-red-600">
            Esta ação é definitiva: remove itens, fotos do servidor e estorna os
            pontos concedidos no ranking.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button color="red" onClick={confirmDelete} disabled={deleteLoading}>
            {deleteLoading ? <Spinner size="sm" /> : "Excluir"}
          </Button>
          <Button color="gray" onClick={() => setDeleteTarget(null)}>
            Cancelar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
