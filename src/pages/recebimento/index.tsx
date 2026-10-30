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
  Textarea,
} from "flowbite-react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { useNavigate } from "react-router-dom";
import api from "../../api";
import { useLocalDeEstoque } from "../localEstoque";
import { useAuthStore } from "../authStore";
import ReceiptPhotoGallery from "./photoGallery";
import {
  formatQuantity,
  getApiError,
  photoUrl,
  type PhotoType,
  type ProductInfo,
  type Receipt,
  type ReceiptItem,
} from "./types";

dayjs.locale("pt-br");

/* ============================================================
   Helpers
============================================================ */
type Feedback = { type: "error" | "success"; text: string } | null;

function useFilePreviews(files: File[]) {
  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  return previews;
}

/** Tenta primeiro JSON e, se a API antiga exigir, tenta multipart sem foto. */
async function createReceiptRequest(payload: Record<string, unknown>) {
  try {
    return await api.post<Receipt>("/receipt/", payload);
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response
      ?.status;
    if (status !== 422 && status !== 400) throw err;

    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        formData.append(key, String(value));
      }
    });
    return await api.post<Receipt>("/receipt/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  }
}

/* ============================================================
   Página operacional
============================================================ */
export default function ReceiptPage() {
  const user = useAuthStore((state) => state.user);
  const { idLocal, localName } = useLocalDeEstoque();
  const navigate = useNavigate();

  const [tab, setTab] = useState<"active" | "history">("active");
  const [activeReceipt, setActiveReceipt] = useState<Receipt | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Paginação do histórico
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  // Modais
  const [createOpen, setCreateOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Receipt | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<ReceiptItem | null>(null);
  const [photoTarget, setPhotoTarget] = useState<ReceiptItem | null>(null);

  // Formulário de abertura de lote
  const [createForm, setCreateForm] = useState({
    created_date: dayjs().format("YYYY-MM-DD"),
    observations: "",
  });

  // Formulário de produto
  const emptyItemForm = {
    code: "",
    isNew: false,
    productName: "",
    quantitySystem: "",
    quantityPhysical: "",
    receivedQuantity: "",
    observations: "",
  };
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [searching, setSearching] = useState(false);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [dockFiles, setDockFiles] = useState<File[]>([]);
  const [shelfFiles, setShelfFiles] = useState<File[]>([]);
  const invoicePreviews = useFilePreviews(invoiceFile ? [invoiceFile] : []);
  const dockPreviews = useFilePreviews(dockFiles);
  const shelfPreviews = useFilePreviews(shelfFiles);

  // Edição de item
  const [editForm, setEditForm] = useState({
    quantity_physical: "",
    received_quantity: "",
    observations: "",
  });

  // Fotos adicionais
  const [photoType, setPhotoType] = useState<PhotoType>("dock");
  const [extraPhotos, setExtraPhotos] = useState<File[]>([]);
  const [extraInvoice, setExtraInvoice] = useState<File | null>(null);
  const extraPreviews = useFilePreviews(extraPhotos);

  const feedbackTimer = useRef<number | null>(null);

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

  /* ============================================================
     Carregamento
  ============================================================ */
  const fetchActive = useCallback(async () => {
    try {
      const res = await api.get<Receipt | null>("/receipt/today", {
        params: { local: idLocal || user?.local || undefined },
      });
      const receipt = res.data;
      if (!receipt?.id) {
        setActiveReceipt(null);
        return;
      }
      try {
        const detail = await api.get<Receipt>(`/receipt/${receipt.id}`);
        setActiveReceipt(detail.data);
      } catch {
        setActiveReceipt(receipt);
      }
    } catch (err) {
      setActiveReceipt(null);
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status !== 404) {
        showFeedback(
          "error",
          getApiError(err, "Erro ao carregar o recebimento em andamento."),
        );
      }
    }
  }, [idLocal, user?.local, showFeedback]);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Receipt[]>("/receipt/", {
        params: { local: idLocal || user?.local || undefined },
      });
      const list = Array.isArray(res.data) ? res.data : [];
      // Lote é da filial/dia: qualquer usuário da filial deve vê-lo (mesma regra do app Android).
      setReceipts(list);
    } catch (err) {
      showFeedback("error", getApiError(err, "Erro ao carregar recebimentos."));
    } finally {
      setLoading(false);
    }
  }, [idLocal, user?.local, showFeedback]);

  useEffect(() => {
    fetchActive();
    fetchReceipts();
  }, [fetchActive, fetchReceipts]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchActive(), fetchReceipts()]);
  }, [fetchActive, fetchReceipts]);

  const refreshDetail = useCallback(
    async (receiptId: number) => {
      try {
        const res = await api.get<Receipt>(`/receipt/${receiptId}`);
        setDetailTarget(res.data);
        if (activeReceipt?.id === receiptId) setActiveReceipt(res.data);
        return res.data;
      } catch (err) {
        showFeedback("error", getApiError(err, "Erro ao atualizar o lote."));
        return null;
      }
    },
    [activeReceipt?.id, showFeedback],
  );

  /* ============================================================
     Abrir lote
  ============================================================ */
  const openReceipt = async () => {
    if (!user) return;
    const targetLocal = idLocal || user.local;
    if (!targetLocal) {
      showFeedback("error", "Selecione um local de estoque antes de abrir.");
      return;
    }
    const todayLocal = dayjs().format("YYYY-MM-DD");
    const targetDate = createForm.created_date || todayLocal;
    const isToday = targetDate === todayLocal;

    setBusy(true);
    try {
      // Reaproveita lote já aberto na filial/data (ex.: aberto pelo app Android),
      // evitando dois lotes abertos no mesmo dia. Para hoje usamos /receipt/today,
      // que compara a data em UTC — a mesma usada pelo backend ao criar o lote.
      let existing: Receipt | null = null;
      if (isToday) {
        const todayRes = await api.get<Receipt | null>("/receipt/today", {
          params: { local: targetLocal },
        });
        existing = todayRes.data;
      } else {
        const existingRes = await api.get<Receipt[]>("/receipt/", {
          params: { local: targetLocal, date: targetDate, completed: false },
        });
        existing =
          (Array.isArray(existingRes.data) ? existingRes.data : []).find(
            (r) => !r.completed,
          ) ?? null;
      }

      if (existing?.id) {
        setCreateOpen(false);
        setTab("active");
        await refreshAll();
        try {
          const detail = await api.get<Receipt>(`/receipt/${existing.id}`);
          setActiveReceipt(detail.data);
        } catch {
          setActiveReceipt(existing);
        }
        showFeedback(
          "success",
          `Já existe um recebimento aberto (#${existing.id}) nesta data. Continuando nele.`,
        );
        return;
      }

      const res = await createReceiptRequest({
        user_id: user.id,
        user_name: user.name,
        local: targetLocal,
        // Hoje: deixa o backend usar a data UTC, igual ao app Android e ao /receipt/today.
        ...(isToday ? {} : { created_date: targetDate }),
        observations: createForm.observations || undefined,
      });
      showFeedback("success", "Recebimento aberto com sucesso!");
      setCreateOpen(false);
      setCreateForm({
        created_date: dayjs().format("YYYY-MM-DD"),
        observations: "",
      });
      setTab("active");
      await refreshAll();
      // Garante que o lote recém-criado apareça mesmo fora da data de hoje.
      if (res.data?.id) {
        try {
          const detail = await api.get<Receipt>(`/receipt/${res.data.id}`);
          setActiveReceipt(detail.data);
        } catch {
          setActiveReceipt(res.data);
        }
      }
    } catch (err) {
      showFeedback("error", getApiError(err, "Erro ao abrir recebimento."));
    } finally {
      setBusy(false);
    }
  };

  /* ============================================================
     Buscar produto
  ============================================================ */
  const searchProduct = async (rawCode?: string) => {
    const code = (rawCode ?? itemForm.code).trim();
    if (!code) {
      showFeedback("error", "Informe o código do produto.");
      return;
    }

    setSearching(true);
    try {
      const res = await api.get<ProductInfo>(
        `/receipt/product-info/${encodeURIComponent(code)}`,
        { params: { local: idLocal || user?.local || undefined } },
      );
      const product = res.data;

      if (product.found) {
        setItemForm((prev) => ({
          ...prev,
          code: product.code || code,
          isNew: false,
          productName: product.name,
          quantitySystem: String(product.quantity_system ?? 0),
        }));
        showFeedback(
          "success",
          `Produto localizado: ${product.name || product.code}`,
        );
      } else {
        setItemForm((prev) => ({
          ...prev,
          code,
          isNew: true,
          productName: "",
          quantitySystem: "0",
        }));
        showFeedback(
          "success",
          "Produto não cadastrado. Preencha o nome (produto novo).",
        );
      }
    } catch (err) {
      showFeedback("error", getApiError(err, "Erro ao consultar produto."));
    } finally {
      setSearching(false);
    }
  };

  /* ============================================================
     Adicionar produto
  ============================================================ */
  const resetItemForm = () => {
    setItemForm(emptyItemForm);
    setInvoiceFile(null);
    setDockFiles([]);
    setShelfFiles([]);
  };

  const submitItem = async () => {
    if (!activeReceipt) {
      showFeedback("error", "Abra um recebimento antes de adicionar produtos.");
      return;
    }
    if (!itemForm.isNew && !itemForm.code.trim()) {
      showFeedback("error", "Informe o código do produto.");
      return;
    }
    if (itemForm.isNew && !itemForm.productName.trim()) {
      showFeedback("error", "Informe o nome do produto novo.");
      return;
    }

    const physical = Number(itemForm.quantityPhysical);
    if (itemForm.quantityPhysical === "" || Number.isNaN(physical)) {
      showFeedback("error", "Informe a quantidade física recebida.");
      return;
    }
    if (physical < 0) {
      showFeedback("error", "A quantidade física não pode ser negativa.");
      return;
    }

    const received =
      itemForm.receivedQuantity === ""
        ? physical
        : Number(itemForm.receivedQuantity);
    if (Number.isNaN(received) || received < 0) {
      showFeedback("error", "Quantidade recebida inválida.");
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      if (itemForm.code.trim())
        formData.append("product_code", itemForm.code.trim());
      formData.append("is_new_product", String(itemForm.isNew));
      if (itemForm.productName.trim())
        formData.append("product_name", itemForm.productName.trim());
      formData.append("quantity_physical", String(physical));
      if (itemForm.quantitySystem !== "")
        formData.append(
          "quantity_system",
          String(Number(itemForm.quantitySystem)),
        );
      formData.append("received_quantity", String(received));
      if (itemForm.observations.trim())
        formData.append("observations", itemForm.observations.trim());
      if (invoiceFile) formData.append("invoice_photo", invoiceFile);
      dockFiles.forEach((file) => formData.append("dock_photos", file));
      shelfFiles.forEach((file) => formData.append("shelf_photos", file));

      await api.post(
        `/receipt/items?receipt_id=${activeReceipt.id}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );

      showFeedback("success", "Produto adicionado ao recebimento!");
      setItemOpen(false);
      resetItemForm();
      await refreshAll();
      if (detailTarget?.id === activeReceipt.id) {
        await refreshDetail(activeReceipt.id);
      }
    } catch (err) {
      showFeedback("error", getApiError(err, "Erro ao salvar produto."));
    } finally {
      setBusy(false);
    }
  };

  /* ============================================================
     Editar / excluir item
  ============================================================ */
  const openEdit = (item: ReceiptItem) => {
    setEditTarget(item);
    setEditForm({
      quantity_physical: String(item.quantity_physical ?? 0),
      received_quantity: String(item.received_quantity ?? 0),
      observations: item.observations ?? "",
    });
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    const physical = Number(editForm.quantity_physical);
    if (editForm.quantity_physical === "" || Number.isNaN(physical)) {
      showFeedback("error", "Informe a quantidade física.");
      return;
    }
    const received =
      editForm.received_quantity === ""
        ? physical
        : Number(editForm.received_quantity);

    setBusy(true);
    try {
      await api.patch(`/receipt/items/${editTarget.id}`, {
        quantity_physical: physical,
        received_quantity: received,
        observations: editForm.observations || null,
      });
      showFeedback("success", "Produto atualizado!");
      setEditTarget(null);
      await refreshAll();
      await refreshDetail(editTarget.receipt_id);
    } catch (err) {
      showFeedback("error", getApiError(err, "Erro ao atualizar produto."));
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (item: ReceiptItem) => {
    if (!confirm(`Remover o produto "${item.product_name}" do recebimento?`))
      return;
    try {
      await api.delete(`/receipt/items/${item.id}`);
      showFeedback("success", "Produto removido.");
      await refreshAll();
      await refreshDetail(item.receipt_id);
    } catch (err) {
      showFeedback("error", getApiError(err, "Erro ao remover produto."));
    }
  };

  /* ============================================================
     Fotos adicionais
  ============================================================ */
  const openPhotos = (item: ReceiptItem) => {
    setPhotoTarget(item);
    setPhotoType("dock");
    setExtraPhotos([]);
    setExtraInvoice(null);
  };

  const uploadExtraPhotos = async () => {
    if (!photoTarget) return;
    if (extraPhotos.length === 0) {
      showFeedback("error", "Selecione ao menos uma foto.");
      return;
    }
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("photo_type", photoType);
      extraPhotos.forEach((file) => formData.append("photos", file));
      await api.post(`/receipt/items/${photoTarget.id}/photos`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      showFeedback("success", "Fotos enviadas!");
      setExtraPhotos([]);
      await refreshDetail(photoTarget.receipt_id);
    } catch (err) {
      showFeedback("error", getApiError(err, "Erro ao enviar fotos."));
    } finally {
      setBusy(false);
    }
  };

  const uploadExtraInvoice = async () => {
    if (!photoTarget) return;
    if (!extraInvoice) {
      showFeedback("error", "Selecione a foto da nota fiscal.");
      return;
    }
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("invoice_photo", extraInvoice);
      await api.post(
        `/receipt/items/${photoTarget.id}/invoice-photo`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      showFeedback("success", "Nota fiscal enviada!");
      setExtraInvoice(null);
      await refreshDetail(photoTarget.receipt_id);
    } catch (err) {
      showFeedback("error", getApiError(err, "Erro ao enviar nota fiscal."));
    } finally {
      setBusy(false);
    }
  };

  /* ============================================================
     Finalizar / reabrir / excluir lote
  ============================================================ */
  const completeReceipt = async (receipt: Receipt) => {
    if (!confirm("Finalizar este recebimento? Ele não poderá ser alterado."))
      return;
    setBusy(true);
    try {
      try {
        await api.patch(`/receipt/${receipt.id}/complete`);
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        if (status !== 404 && status !== 405) throw err;
        // Compatibilidade com APIs anteriores à rota /complete.
        await api.patch(`/receipt/${receipt.id}`, { completed: true });
      }
      showFeedback("success", "Recebimento finalizado! +10 pontos no ranking.");
      await refreshAll();
      await refreshDetail(receipt.id);
    } catch (err) {
      showFeedback("error", getApiError(err, "Erro ao finalizar recebimento."));
    } finally {
      setBusy(false);
    }
  };

  const reopenReceipt = async (receipt: Receipt) => {
    if (!confirm("Reabrir este recebimento para ajustes?")) return;
    setBusy(true);
    try {
      try {
        await api.patch(`/receipt/${receipt.id}/reopen`);
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        if (status !== 404 && status !== 405) throw err;
        await api.patch(`/receipt/${receipt.id}`, { completed: false });
      }
      showFeedback("success", "Recebimento reaberto.");
      await refreshAll();
      await refreshDetail(receipt.id);
    } catch (err) {
      showFeedback("error", getApiError(err, "Erro ao reabrir recebimento."));
    } finally {
      setBusy(false);
    }
  };

  const deleteReceipt = async (receipt: Receipt) => {
    if (
      !confirm(
        `Excluir o recebimento #${receipt.id}? Todos os itens, fotos e pontos serão removidos.`,
      )
    )
      return;
    try {
      await api.delete(`/receipt/${receipt.id}`);
      showFeedback("success", "Recebimento excluído.");
      setDetailOpen(false);
      setDetailTarget(null);
      await refreshAll();
    } catch (err) {
      showFeedback("error", getApiError(err, "Erro ao excluir recebimento."));
    }
  };

  const openDetail = async (receipt: Receipt) => {
    setDetailOpen(true);
    setDetailTarget(receipt);
    setDetailLoading(true);
    try {
      const res = await api.get<Receipt>(`/receipt/${receipt.id}`);
      setDetailTarget(res.data);
    } catch (err) {
      showFeedback("error", getApiError(err, "Erro ao carregar detalhes."));
    } finally {
      setDetailLoading(false);
    }
  };

  /* ============================================================
     Derivados
  ============================================================ */
  const sortedHistory = useMemo(
    () =>
      [...receipts].sort((a, b) => {
        const dateDiff = dayjs(b.created_date).diff(dayjs(a.created_date));
        return dateDiff !== 0 ? dateDiff : b.id - a.id;
      }),
    [receipts],
  );

  const paginatedHistory = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedHistory.slice(start, start + PAGE_SIZE);
  }, [sortedHistory, page]);

  const totalPages = Math.max(1, Math.ceil(sortedHistory.length / PAGE_SIZE));

  const activeItems = activeReceipt?.items ?? [];
  const activeTotalPhysical = activeItems.reduce(
    (sum, item) => sum + Number(item.quantity_physical || 0),
    0,
  );
  const activeNewProducts = activeItems.filter(
    (item) => item.is_new_product,
  ).length;

  /* ============================================================
     Render
  ============================================================ */
  return (
    <div className="mx-auto max-w-7xl space-y-6 rounded-2xl p-2 text-gray-100 dark:bg-gray-800">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Recebimento de Mercadorias
          </h1>
          <p className="text-sm text-gray-300">
            Filial: <strong>{localName}</strong> · Operador:{" "}
            <strong>{user?.name ?? "—"}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user?.admin === 1 && (
            <Button
              color="purple"
              outline
              onClick={() => navigate("/admin/receipt")}
            >
              Painel Admin
            </Button>
          )}
          {activeReceipt && !activeReceipt.completed && (
            <Button color="green" onClick={() => setItemOpen(true)}>
              Adicionar Produto
            </Button>
          )}
          {!activeReceipt && (
            <Button onClick={() => setCreateOpen(true)}>
              Abrir Recebimento
            </Button>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2">
        <Button
          size="sm"
          color={tab === "active" ? "blue" : "gray"}
          onClick={() => setTab("active")}
        >
          Em andamento
        </Button>
        <Button
          size="sm"
          color={tab === "history" ? "blue" : "gray"}
          onClick={() => setTab("history")}
        >
          Histórico ({sortedHistory.length})
        </Button>
      </div>

      {/* ==================== ABA EM ANDAMENTO ==================== */}
      {tab === "active" &&
        (loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="xl" />
          </div>
        ) : !activeReceipt ? (
          <Card className="text-center">
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-lg font-semibold text-gray-800 dark:text-white">
                Nenhum recebimento aberto hoje
              </p>
              <p className="max-w-lg text-sm text-gray-500 dark:text-gray-300">
                Abra o recebimento do dia para começar a registrar os produtos,
                fotos da baia, prateleira e nota fiscal.
              </p>
              <Button onClick={() => setCreateOpen(true)}>
                Abrir Recebimento
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Resumo do lote */}
            <Card>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                      Lote #{activeReceipt.id}
                    </h2>
                    {activeReceipt.completed ? (
                      <Badge color="success">Finalizado</Badge>
                    ) : (
                      <Badge color="warning">Em andamento</Badge>
                    )}
                    {activeReceipt.approved && (
                      <Badge color="blue">Aprovado</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                    Aberto em{" "}
                    {dayjs(
                      activeReceipt.time_stamp ?? activeReceipt.created_date,
                    ).format("DD/MM/YYYY HH:mm")}
                    {activeReceipt.completed_at
                      ? ` · Finalizado em ${dayjs(
                          activeReceipt.completed_at,
                        ).format("DD/MM/YYYY HH:mm")}`
                      : ""}
                  </p>
                  {activeReceipt.observations && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                      <strong>Observações:</strong> {activeReceipt.observations}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!activeReceipt.completed && (
                    <>
                      <Button
                        size="sm"
                        color="green"
                        onClick={() => setItemOpen(true)}
                      >
                        Adicionar Produto
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => completeReceipt(activeReceipt)}
                        disabled={busy || activeItems.length === 0}
                      >
                        Finalizar Recebimento
                      </Button>
                    </>
                  )}
                  {activeReceipt.completed && (
                    <Button
                      size="sm"
                      color="yellow"
                      onClick={() => reopenReceipt(activeReceipt)}
                      disabled={busy}
                    >
                      Reabrir
                    </Button>
                  )}
                  <Button
                    size="sm"
                    color="red"
                    outline
                    onClick={() => deleteReceipt(activeReceipt)}
                    disabled={busy}
                  >
                    Excluir Lote
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-gray-100 p-3 dark:bg-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-300">
                    Produtos
                  </p>
                  <p className="text-xl font-bold text-gray-800 dark:text-white">
                    {activeItems.length}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-100 p-3 dark:bg-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-300">
                    Qtd. física
                  </p>
                  <p className="text-xl font-bold text-gray-800 dark:text-white">
                    {formatQuantity(activeTotalPhysical)}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-100 p-3 dark:bg-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-300">
                    Produtos novos
                  </p>
                  <p className="text-xl font-bold text-gray-800 dark:text-white">
                    {activeNewProducts}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-100 p-3 dark:bg-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-300">
                    Filial
                  </p>
                  <p className="text-xl font-bold text-gray-800 dark:text-white">
                    {activeReceipt.local}
                  </p>
                </div>
              </div>
            </Card>

            {/* Itens do lote */}
            <Card>
              <h3 className="mb-3 text-lg font-bold text-gray-800 dark:text-white">
                Produtos Recebidos
              </h3>
              {activeItems.length === 0 ? (
                <p className="py-6 text-center text-gray-500 dark:text-gray-300">
                  Nenhum produto registrado. Clique em “Adicionar Produto”.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table hoverable>
                    <TableHead>
                      <TableRow>
                        <TableHeadCell>Produto</TableHeadCell>
                        <TableHeadCell>Código</TableHeadCell>
                        <TableHeadCell className="text-center">
                          Sistema
                        </TableHeadCell>
                        <TableHeadCell className="text-center">
                          Físico
                        </TableHeadCell>
                        <TableHeadCell className="text-center">
                          Recebido
                        </TableHeadCell>
                        <TableHeadCell className="text-center">
                          Diferença
                        </TableHeadCell>
                        <TableHeadCell className="text-center">
                          Fotos
                        </TableHeadCell>
                        <TableHeadCell className="text-center">
                          Ações
                        </TableHeadCell>
                      </TableRow>
                    </TableHead>
                    <TableBody className="divide-y">
                      {activeItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-800 dark:text-white">
                                {item.product_name}
                              </span>
                              {item.is_new_product && (
                                <Badge color="purple" className="mt-1 w-fit">
                                  Produto novo
                                </Badge>
                              )}
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {dayjs(item.received_at).format("DD/MM HH:mm")}{" "}
                                · {item.user_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{item.product_code || "—"}</TableCell>
                          <TableCell className="text-center">
                            {formatQuantity(item.quantity_system)}
                          </TableCell>
                          <TableCell className="text-center">
                            {formatQuantity(item.quantity_physical)}
                          </TableCell>
                          <TableCell className="text-center">
                            {formatQuantity(item.received_quantity)}
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={
                                Number(item.difference) === 0
                                  ? "text-gray-500"
                                  : Number(item.difference) > 0
                                    ? "font-semibold text-green-600"
                                    : "font-semibold text-red-600"
                              }
                            >
                              {formatQuantity(item.difference)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col text-xs">
                              <span>Baia: {item.dock_photos?.length ?? 0}</span>
                              <span>
                                Prateleira: {item.shelf_photos?.length ?? 0}
                              </span>
                              <span>NF: {item.invoice_photo ? "1" : "0"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap justify-center gap-1">
                              {!activeReceipt.completed && (
                                <>
                                  <Button
                                    size="xs"
                                    color="blue"
                                    outline
                                    onClick={() => openEdit(item)}
                                  >
                                    Editar
                                  </Button>
                                  <Button
                                    size="xs"
                                    color="purple"
                                    outline
                                    onClick={() => openPhotos(item)}
                                  >
                                    Fotos
                                  </Button>
                                  <Button
                                    size="xs"
                                    color="red"
                                    outline
                                    onClick={() => deleteItem(item)}
                                  >
                                    Excluir
                                  </Button>
                                </>
                              )}
                              {activeReceipt.completed && (
                                <Button
                                  size="xs"
                                  color="gray"
                                  outline
                                  onClick={() => {
                                    setDetailTarget(activeReceipt);
                                    setDetailOpen(true);
                                    setDetailLoading(false);
                                  }}
                                >
                                  Fotos
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </div>
        ))}

      {/* ==================== ABA HISTÓRICO ==================== */}
      {tab === "history" && (
        <Card>
          <h3 className="mb-3 text-lg font-bold text-gray-800 dark:text-white">
            Meus Recebimentos
          </h3>
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size="xl" />
            </div>
          ) : sortedHistory.length === 0 ? (
            <p className="py-6 text-center text-gray-500 dark:text-gray-300">
              Nenhum recebimento registrado.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table hoverable>
                  <TableHead>
                    <TableRow>
                      <TableHeadCell>Lote</TableHeadCell>
                      <TableHeadCell>Data</TableHeadCell>
                      <TableHeadCell className="text-center">
                        Produtos
                      </TableHeadCell>
                      <TableHeadCell className="text-center">
                        Qtd. física
                      </TableHeadCell>
                      <TableHeadCell className="text-center">
                        Status
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
                    {paginatedHistory.map((receipt) => (
                      <TableRow key={receipt.id}>
                        <TableCell>#{receipt.id}</TableCell>
                        <TableCell>
                          {dayjs(receipt.created_date).format("DD/MM/YYYY")}
                        </TableCell>
                        <TableCell className="text-center">
                          {receipt.items_count ?? receipt.quantity ?? 0}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatQuantity(receipt.total_physical_quantity)}
                        </TableCell>
                        <TableCell className="text-center">
                          {receipt.completed ? (
                            <Badge color="success">Finalizado</Badge>
                          ) : (
                            <Badge color="warning">Em andamento</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {receipt.approved ? (
                            <Badge color="blue">Aprovado</Badge>
                          ) : (
                            <Badge color="gray">Pendente</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Button
                              size="xs"
                              color="blue"
                              outline
                              onClick={() => openDetail(receipt)}
                            >
                              Detalhes
                            </Button>
                            {!receipt.completed && (
                              <Button
                                size="xs"
                                color="red"
                                outline
                                onClick={() => deleteReceipt(receipt)}
                              >
                                Excluir
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex justify-center">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    showIcons
                  />
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* ==================== MODAL: ABRIR LOTE ==================== */}
      <Modal show={createOpen} onClose={() => setCreateOpen(false)}>
        <ModalHeader>Abrir Recebimento</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-date">Data do recebimento</Label>
              <TextInput
                id="create-date"
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
              <Label htmlFor="create-obs">Observações (opcional)</Label>
              <Textarea
                id="create-obs"
                rows={3}
                placeholder="Ex.: carga agendada para as 08h"
                value={createForm.observations}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    observations: e.target.value,
                  }))
                }
              />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-300">
              Filial: <strong>{localName}</strong>
            </p>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button onClick={openReceipt} disabled={busy}>
            {busy ? <Spinner size="sm" /> : "Abrir"}
          </Button>
          <Button color="gray" onClick={() => setCreateOpen(false)}>
            Cancelar
          </Button>
        </ModalFooter>
      </Modal>

      {/* ==================== MODAL: ADICIONAR PRODUTO ==================== */}
      <Modal
        show={itemOpen}
        onClose={() => {
          setItemOpen(false);
          resetItemForm();
        }}
        size="4xl"
      >
        <ModalHeader>
          Adicionar Produto {activeReceipt ? `— Lote #${activeReceipt.id}` : ""}
          {feedback && (
            <Alert
              color={feedback.type === "error" ? "failure" : "success"}
              onDismiss={() => setFeedback(null)}
            >
              {feedback.text}
            </Alert>
          )}
        </ModalHeader>
        <ModalBody className="max-h-[70vh] overflow-y-auto">
          <div className="space-y-5">
            <div>
              <Label htmlFor="item-code">Código / código de barras</Label>
              <div className="flex gap-2">
                <TextInput
                  id="item-code"
                  className="flex-1"
                  placeholder="Digite ou escaneie o código"
                  value={itemForm.code}
                  onChange={(e) =>
                    setItemForm((prev) => ({ ...prev, code: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchProduct();
                    }
                  }}
                />
                <Button onClick={() => searchProduct()} disabled={searching}>
                  {searching ? <Spinner size="sm" /> : "Buscar"}
                </Button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                checked={itemForm.isNew}
                onChange={(e) =>
                  setItemForm((prev) => ({
                    ...prev,
                    isNew: e.target.checked,
                    quantitySystem: e.target.checked
                      ? "0"
                      : prev.quantitySystem,
                  }))
                }
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Produto novo (não cadastrado no sistema)
            </label>

            <div>
              <Label htmlFor="item-name">Nome do produto</Label>
              <TextInput
                id="item-name"
                value={itemForm.productName}
                disabled={!itemForm.isNew}
                placeholder={
                  itemForm.isNew
                    ? "Informe o nome do produto novo"
                    : "Preenchido automaticamente pela busca"
                }
                onChange={(e) =>
                  setItemForm((prev) => ({
                    ...prev,
                    productName: e.target.value,
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="item-system">Estoque no sistema</Label>
                <TextInput
                  id="item-system"
                  type="number"
                  step="0.001"
                  min={0}
                  value={itemForm.quantitySystem}
                  disabled={!itemForm.isNew}
                  onChange={(e) =>
                    setItemForm((prev) => ({
                      ...prev,
                      quantitySystem: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="item-physical">Quantidade física *</Label>
                <TextInput
                  id="item-physical"
                  type="number"
                  step="0.001"
                  min={0}
                  value={itemForm.quantityPhysical}
                  onChange={(e) =>
                    setItemForm((prev) => ({
                      ...prev,
                      quantityPhysical: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="item-received">Quantidade recebida</Label>
                <TextInput
                  id="item-received"
                  type="number"
                  step="0.001"
                  min={0}
                  placeholder="Padrão: qtd. física"
                  value={itemForm.receivedQuantity}
                  onChange={(e) =>
                    setItemForm((prev) => ({
                      ...prev,
                      receivedQuantity: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Nota fiscal */}
              <div>
                <Label htmlFor="item-invoice">Foto da nota fiscal</Label>
                <input
                  id="item-invoice"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                  className="mt-2 block w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700 dark:text-gray-300"
                />
                {invoicePreviews.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {invoicePreviews.map((p) => (
                      <div key={p.url} className="relative">
                        <img
                          src={p.url}
                          alt="Nota fiscal"
                          className="h-20 w-20 rounded-lg object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setInvoiceFile(null)}
                          className="absolute -top-2 -right-2 rounded-full bg-red-600 px-1.5 text-xs font-bold text-white"
                          aria-label="Remover nota fiscal"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fotos da baia */}
              <div>
                <Label htmlFor="item-dock">Fotos da baia</Label>
                <input
                  id="item-dock"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) =>
                    setDockFiles(Array.from(e.target.files ?? []))
                  }
                  className="mt-2 block w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700 dark:text-gray-300"
                />
                {dockPreviews.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {dockPreviews.map((p, index) => (
                      <div key={p.url} className="relative">
                        <img
                          src={p.url}
                          alt="Baia"
                          className="h-20 w-20 rounded-lg object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDockFiles((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                          className="absolute -top-2 -right-2 rounded-full bg-red-600 px-1.5 text-xs font-bold text-white"
                          aria-label="Remover foto"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fotos da prateleira */}
              <div>
                <Label htmlFor="item-shelf">Fotos da prateleira</Label>
                <input
                  id="item-shelf"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) =>
                    setShelfFiles(Array.from(e.target.files ?? []))
                  }
                  className="mt-2 block w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700 dark:text-gray-300"
                />
                {shelfPreviews.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {shelfPreviews.map((p, index) => (
                      <div key={p.url} className="relative">
                        <img
                          src={p.url}
                          alt="Prateleira"
                          className="h-20 w-20 rounded-lg object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShelfFiles((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                          className="absolute -top-2 -right-2 rounded-full bg-red-600 px-1.5 text-xs font-bold text-white"
                          aria-label="Remover foto"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="item-obs">Observações</Label>
              <Textarea
                id="item-obs"
                rows={2}
                placeholder="Ex.: caixas íntegras e lacradas"
                value={itemForm.observations}
                onChange={(e) =>
                  setItemForm((prev) => ({
                    ...prev,
                    observations: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button onClick={submitItem} disabled={busy || !activeReceipt}>
            {busy ? <Spinner size="sm" /> : "Salvar Produto"}
          </Button>
          <Button
            color="gray"
            onClick={() => {
              setItemOpen(false);
              resetItemForm();
            }}
          >
            Cancelar
          </Button>
        </ModalFooter>
      </Modal>

      {/* ==================== MODAL: DETALHES ==================== */}
      <Modal
        show={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailTarget(null);
        }}
        size="5xl"
      >
        <ModalHeader>Recebimento #{detailTarget?.id ?? "—"}</ModalHeader>
        <ModalBody className="max-h-[70vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="xl" />
            </div>
          ) : detailTarget ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-gray-500">Data</p>
                  <p className="font-semibold text-gray-800 dark:text-white">
                    {dayjs(detailTarget.created_date).format("DD/MM/YYYY")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Filial</p>
                  <p className="font-semibold text-gray-800 dark:text-white">
                    {detailTarget.local}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  {detailTarget.completed ? (
                    <Badge color="success">Finalizado</Badge>
                  ) : (
                    <Badge color="warning">Em andamento</Badge>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Auditoria</p>
                  {detailTarget.approved ? (
                    <Badge color="blue">Aprovado</Badge>
                  ) : (
                    <Badge color="gray">Pendente</Badge>
                  )}
                </div>
              </div>

              {detailTarget.observations && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <strong>Observações:</strong> {detailTarget.observations}
                </p>
              )}

              <div>
                <h4 className="mb-3 font-bold text-gray-800 dark:text-white">
                  Produtos ({(detailTarget.items ?? []).length})
                </h4>
                {(detailTarget.items ?? []).length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-500">
                    Nenhum produto registrado.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {(detailTarget.items ?? []).map((item) => (
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
                              {dayjs(item.received_at).format(
                                "DD/MM/YYYY HH:mm",
                              )}
                            </p>
                            {item.observations && (
                              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                                {item.observations}
                              </p>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-center text-sm">
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
                          />
                          <ReceiptPhotoGallery
                            title="Prateleira"
                            photos={item.shelf_photos ?? []}
                          />
                          {item.invoice_photo && (
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
                          )}
                        </div>

                        {!detailTarget.completed && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              size="xs"
                              color="purple"
                              outline
                              onClick={() => {
                                setDetailOpen(false);
                                openPhotos(item);
                              }}
                            >
                              Enviar Fotos
                            </Button>
                            <Button
                              size="xs"
                              color="red"
                              outline
                              onClick={() => deleteItem(item)}
                            >
                              Excluir Produto
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </ModalBody>
        <ModalFooter className="flex flex-wrap gap-2">
          {detailTarget && !detailTarget.completed && (
            <Button
              color="green"
              onClick={() => completeReceipt(detailTarget)}
              disabled={busy}
            >
              Finalizar
            </Button>
          )}
          {detailTarget?.completed && (
            <Button
              color="yellow"
              onClick={() => reopenReceipt(detailTarget)}
              disabled={busy}
            >
              Reabrir
            </Button>
          )}
          <Button
            color="red"
            outline
            onClick={() => detailTarget && deleteReceipt(detailTarget)}
            disabled={busy}
          >
            Excluir Lote
          </Button>
          <Button
            color="gray"
            onClick={() => {
              setDetailOpen(false);
              setDetailTarget(null);
            }}
          >
            Fechar
          </Button>
        </ModalFooter>
      </Modal>

      {/* ==================== MODAL: EDITAR PRODUTO ==================== */}
      <Modal show={!!editTarget} onClose={() => setEditTarget(null)}>
        <ModalHeader>Editar Produto #{editTarget?.id}</ModalHeader>
        <ModalBody>
          {editTarget && (
            <div className="space-y-4">
              <p className="font-semibold text-gray-800 dark:text-white">
                {editTarget.product_name}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-physical">Quantidade física</Label>
                  <TextInput
                    id="edit-physical"
                    type="number"
                    step="0.001"
                    min={0}
                    value={editForm.quantity_physical}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        quantity_physical: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-received">Quantidade recebida</Label>
                  <TextInput
                    id="edit-received"
                    type="number"
                    step="0.001"
                    min={0}
                    value={editForm.received_quantity}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        received_quantity: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-obs">Observações</Label>
                <Textarea
                  id="edit-obs"
                  rows={2}
                  value={editForm.observations}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      observations: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={submitEdit} disabled={busy}>
            {busy ? <Spinner size="sm" /> : "Salvar"}
          </Button>
          <Button color="gray" onClick={() => setEditTarget(null)}>
            Cancelar
          </Button>
        </ModalFooter>
      </Modal>

      {/* ==================== MODAL: FOTOS ADICIONAIS ==================== */}
      <Modal
        show={!!photoTarget}
        onClose={() => setPhotoTarget(null)}
        size="lg"
      >
        <ModalHeader>Fotos — {photoTarget?.product_name}</ModalHeader>
        <ModalBody className="space-y-6">
          {photoTarget && (
            <div className="grid grid-cols-1 gap-3 border-b border-gray-200 pb-4 sm:grid-cols-3 dark:border-gray-700">
              <ReceiptPhotoGallery
                title="Baia"
                photos={photoTarget.dock_photos ?? []}
                emptyLabel="Sem fotos"
              />
              <ReceiptPhotoGallery
                title="Prateleira"
                photos={photoTarget.shelf_photos ?? []}
                emptyLabel="Sem fotos"
              />
              <div>
                <p className="mb-2 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                  Nota fiscal
                </p>
                {photoTarget.invoice_photo ? (
                  <a
                    href={photoUrl(photoTarget.invoice_photo) ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-fit overflow-hidden rounded-lg ring-1 ring-gray-300 transition hover:ring-blue-500 dark:ring-gray-600"
                  >
                    <img
                      src={photoUrl(photoTarget.invoice_photo) ?? ""}
                      alt="Nota fiscal"
                      className="h-20 w-20 object-cover"
                    />
                  </a>
                ) : (
                  <p className="text-xs text-gray-400">Sem foto</p>
                )}
              </div>
            </div>
          )}

          <div>
            <h4 className="mb-2 font-semibold text-gray-800 dark:text-white">
              Fotos da baia / prateleira
            </h4>
            <div className="space-y-3">
              <div>
                <Label htmlFor="photo-type">Tipo da foto</Label>
                <Select
                  id="photo-type"
                  value={photoType}
                  onChange={(e) => setPhotoType(e.target.value as PhotoType)}
                >
                  <option value="dock">Baia de recebimento</option>
                  <option value="shelf">Prateleira</option>
                </Select>
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) =>
                  setExtraPhotos(Array.from(e.target.files ?? []))
                }
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700 dark:text-gray-300"
              />
              {extraPreviews.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {extraPreviews.map((p) => (
                    <img
                      key={p.url}
                      src={p.url}
                      alt="Prévia"
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
              <Button
                size="sm"
                onClick={uploadExtraPhotos}
                disabled={busy || extraPhotos.length === 0}
              >
                Enviar fotos
              </Button>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
            <h4 className="mb-2 font-semibold text-gray-800 dark:text-white">
              Foto da nota fiscal
            </h4>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setExtraInvoice(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700 dark:text-gray-300"
            />
            <Button
              size="sm"
              className="mt-3"
              onClick={uploadExtraInvoice}
              disabled={busy || !extraInvoice}
            >
              Enviar nota fiscal
            </Button>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="gray" onClick={() => setPhotoTarget(null)}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
