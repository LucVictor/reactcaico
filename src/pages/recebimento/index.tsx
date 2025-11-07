import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Label,
  TextInput,
  Pagination,
  Spinner,
  Alert,
  Badge,
} from "flowbite-react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
dayjs.locale("pt-br");
import api from "../../api";
import { useLocalDeEstoque } from "../localEstoque";
import { useAuthStore } from "../authStore";

/* ============================================================
   Tipos
============================================================ */
type Receipt = {
  id: number;
  user_id: number;
  user_name: string;
  quantity?: number;
  local: number;
  created_date: string;
  time_stamp?: string;
  completed: boolean;
  approved: boolean;
  photo?: string | null;
};

type CreateReceipt = Omit<
  Receipt,
  "id" | "completed" | "approved" | "time_stamp"
>;

/* ============================================================
   Componente principal
============================================================ */
export default function ReceiptPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openModal, setOpenModal] = useState(false);

  const { idLocal } = useLocalDeEstoque();
  const user = useAuthStore((state) => state.user);

  const [newReceipt, setNewReceipt] = useState<CreateReceipt>({
    user_id: user?.id || 0,
    user_name: user?.name || "Usuário",
    local: idLocal || 0,
    created_date: dayjs().format("YYYY-MM-DD"),
    quantity: 0,
    photo: null,
  });

  // Paginação
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  /* ============================================================
     Mensagens
  ============================================================ */
  const handleError = useCallback((msg: string, err?: unknown) => {
    console.error(msg, err);
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  }, []);

  const handleSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }, []);

  /* ============================================================
     Fetch
  ============================================================ */
  const fetchReceipts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<Receipt[]>("/receipt/");
      setReceipts(res.data.filter((e) => e.user_id == user?.id));
    } catch (err) {
      handleError("Erro ao carregar receipts.", err);
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  /* ============================================================
     Criar Receipt
  ============================================================ */
  const handleCreateReceipt = async () => {
    if (!photoFile) {
      handleError("É necessário enviar uma foto.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("user_id", String(newReceipt.user_id));
      formData.append("user_name", newReceipt.user_name);
      formData.append("local", String(newReceipt.local));
      formData.append("created_date", newReceipt.created_date);
      formData.append("quantity", String(newReceipt.quantity));
      formData.append("photo", photoFile);

      await api.post("/receipt/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      handleSuccess("Recebimento criado com sucesso!");
      setOpenCreateModal(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      setNewReceipt({
        user_id: user?.id || 0,
        user_name: user?.name || "Usuário",
        local: idLocal || 0,
        created_date: dayjs().format("YYYY-MM-DD"),
        quantity: 0,
        photo: null,
      });
      fetchReceipts();
    } catch (err) {
      handleError("Erro ao criar receipt.", err);
    }
  };

  /* ============================================================
     Deletar Receipt
  ============================================================ */
  const handleDeleteReceipt = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este recebimento?")) return;
    try {
      await api.delete(`/receipt/${id}`);
      handleSuccess("Recebimento excluído!");
      fetchReceipts();
    } catch (err) {
      handleError("Erro ao excluir receipt.", err);
    }
  };

  /* ============================================================
     Completar Receipt
  ============================================================ */
  const handleCompleteReceipt = async () => {
    if (!selectedReceipt) return;
    if (!confirm("Marcar este recebimento como completo?")) return;
    try {
      await api.patch(`/receipt/${selectedReceipt.id}`, { completed: true });
      handleSuccess("Recebimento finalizado!");
      fetchReceipts();
      setOpenModal(false);
    } catch (err) {
      handleError("Erro ao finalizar receipt.", err);
    }
  };

  /* ============================================================
     Ver Foto
  ============================================================ */
  const handleViewPhoto = () => {
    if (selectedReceipt?.photo) {
      const photoUrl = selectedReceipt.photo.startsWith("http")
        ? selectedReceipt.photo
        : `${import.meta.env.VITE_API_URL || ""}${selectedReceipt.photo}`;
      window.open(photoUrl, "_blank");
    } else {
      handleError("Nenhuma foto disponível para este recebimento.");
    }
  };

  /* ============================================================
     Modais
  ============================================================ */
  const openReceiptModal = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setOpenModal(true);
  };

  const closeReceiptModal = () => {
    setOpenModal(false);
    setSelectedReceipt(null);
  };

  /* ============================================================
     Ordenação + Paginação
  ============================================================ */
  const sortedReceipts = useMemo(() => {
    return [...receipts].sort((a, b) =>
      dayjs(b.created_date).diff(dayjs(a.created_date)),
    );
  }, [receipts]);

  const paginatedReceipts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedReceipts.slice(start, start + PAGE_SIZE);
  }, [sortedReceipts, page]);

  const totalPages = Math.max(1, Math.ceil(sortedReceipts.length / PAGE_SIZE));

  /* ============================================================
     Inicialização
  ============================================================ */
  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  /* ============================================================
     Render
  ============================================================ */
  return (
    <div className="m-4 min-h-screen rounded-2xl bg-gray-700 p-3 text-gray-100 opacity-95">
      {/* Mensagens */}
      {errorMsg && (
        <Alert color="failure" className="mb-4">
          {errorMsg}
        </Alert>
      )}
      {successMsg && (
        <Alert color="success" className="mb-4">
          {successMsg}
        </Alert>
      )}

      {/* Cabeçalho */}
      <div className="mb-8 flex flex-col justify-center align-middle">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Recebimentos</h1>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => setOpenCreateModal(true)} size="sm">
            Novo Recebimento
          </Button>
        </div>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="xl" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-700 bg-gray-800 shadow-lg">
            <Table hoverable className="min-w-full">
              <TableHead>
                <TableRow className="bg-gray-900 text-gray-300">
                  <TableHeadCell>Data</TableHeadCell>
                  <TableHeadCell className="text-center">Qtd</TableHeadCell>
                  <TableHeadCell className="text-center">Local</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                  <TableHeadCell className="text-center">Ações</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody className="divide-y divide-gray-700">
                {paginatedReceipts.map((r) => (
                  <TableRow
                    key={r.id}
                    className="bg-gray-800/50 transition hover:bg-gray-700"
                  >
                    <TableCell>
                      {dayjs(r.created_date).format("DD/MM/YYYY")}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.quantity ?? 0}
                    </TableCell>
                    <TableCell className="text-center">{r.local}</TableCell>
                    <TableCell>
                      {r.completed ? (
                        <Badge color="success" size="sm">
                          Completo
                        </Badge>
                      ) : (
                        <Badge color="warning" size="sm">
                          Em andamento
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="flex flex-wrap justify-center gap-1">
                      <Button
                        size="xs"
                        color="blue"
                        outline
                        onClick={() => openReceiptModal(r)}
                      >
                        Visualizar
                      </Button>

                      {!r.completed && (
                        <Button
                          size="xs"
                          color="red"
                          outline
                          onClick={() => handleDeleteReceipt(r.id)}
                        >
                          Deletar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Paginação */}
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

      {/* ==================== MODAIS ==================== */}

      {/* Criar Receipt */}
      <Modal show={openCreateModal} onClose={() => setOpenCreateModal(false)}>
        <ModalHeader>Novo Recebimento</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <Label>Data</Label>
              <TextInput
                type="date"
                value={newReceipt.created_date}
                onChange={(e) =>
                  setNewReceipt((p) => ({ ...p, created_date: e.target.value }))
                }
              />
            </div>

            <div>
              <Label>Quantidade</Label>
              <TextInput
                type="number"
                placeholder="0"
                value={newReceipt.quantity || ""}
                onChange={(e) =>
                  setNewReceipt((p) => ({
                    ...p,
                    quantity: Number(e.target.value),
                  }))
                }
              />
            </div>

            <div>
              <Label>Foto (obrigatória)</Label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPhotoFile(file);
                    setPhotoPreview(URL.createObjectURL(file));
                  }
                }}
                className="mt-2 block w-full text-sm text-gray-300 file:mr-4 file:rounded file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
              />
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Preview"
                  className="mt-3 h-32 w-32 rounded-lg object-cover shadow"
                />
              )}
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button onClick={handleCreateReceipt}>Criar</Button>
          <Button color="gray" onClick={() => setOpenCreateModal(false)}>
            Cancelar
          </Button>
        </ModalFooter>
      </Modal>

      {/* Visualizar Detalhes */}
      <Modal show={openModal} onClose={closeReceiptModal}>
        <ModalHeader>Recebimento #{selectedReceipt?.id}</ModalHeader>
        <ModalBody>
          {selectedReceipt && (
            <div className="space-y-3">
              <p>
                <strong>Data:</strong>{" "}
                {dayjs(selectedReceipt.created_date).format("DD/MM/YYYY")}
              </p>
              <p>
                <strong>Quantidade:</strong> {selectedReceipt.quantity ?? 0}
              </p>
              <p>
                <strong>Local:</strong> {selectedReceipt.local}
              </p>
            </div>
          )}
        </ModalBody>
        <ModalFooter className="flex gap-2">
          <Button color="purple" onClick={handleViewPhoto}>
            Ver Foto
          </Button>
          {!selectedReceipt?.completed && (
            <Button color="green" onClick={handleCompleteReceipt}>
              Marcar como Finalizado
            </Button>
          )}
          <Button color="gray" onClick={closeReceiptModal}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
