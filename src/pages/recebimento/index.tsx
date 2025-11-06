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
  "id" | "completed" | "approved" | "photo" | "time_stamp"
>;

type ReceiptProduct = {
  id?: number;
  product_code: number | string;
  receipt_id?: number;
  product_name: string;
  quantity_system?: number | null | string;
  quantity_real?: number | null | string;
  diference?: number | null;
};

/* ============================================================
   Componente principal
============================================================ */
export default function ReceiptPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [products, setProducts] = useState<ReceiptProduct[]>([]);
  const [newItems, setNewItems] = useState<ReceiptProduct[]>([
    {
      product_code: "",
      product_name: "",
      quantity_system: "",
      quantity_real: "",
    },
  ]);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openAddItemModal, setOpenAddItemModal] = useState(false);
  const [openModal, setOpenModal] = useState(false);

  const { idLocal } = useLocalDeEstoque();
  const user = useAuthStore((state) => state.user);

  const [newReceipt, setNewReceipt] = useState<CreateReceipt>({
    user_id: user?.id || 0,
    user_name: user?.name || "Usuário",
    local: idLocal || 0,
    created_date: dayjs().format("YYYY-MM-DD"),
  });

  // Paginação – 10 por página
  const PAGE_SIZE = 10;
  const [page, setPage] = useState(1);

  /* ============================================================
     Handlers de mensagens
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
     Fetchs
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

  const fetchProducts = useCallback(
    async (receiptId: number) => {
      try {
        const res = await api.get<ReceiptProduct[]>(
          `/receipt/products/${receiptId}`,
        );
        setProducts(res.data);
      } catch (err) {
        handleError("Erro ao carregar produtos.", err);
      }
    },
    [handleError],
  );

  /* ============================================================
     Criação / Exclusão
  ============================================================ */
  const handleCreateReceipt = async () => {
    try {
      await api.post("/receipt/", { ...newReceipt, local: idLocal });
      handleSuccess("Receipt criado com sucesso!");
      setOpenCreateModal(false);
      fetchReceipts();
    } catch (err) {
      handleError("Erro ao criar receipt.", err);
    }
  };

  const handleDeleteReceipt = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este receipt?")) return;
    try {
      await api.delete(`/receipt/${id}`);
      handleSuccess("Receipt excluído com sucesso!");
      fetchReceipts();
    } catch (err) {
      handleError("Erro ao excluir receipt.", err);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm("Excluir produto?")) return;
    try {
      await api.delete(`/receipt/product/${id}`);
      handleSuccess("Produto removido!");
      if (selectedReceipt) await fetchProducts(selectedReceipt.id);
    } catch (err) {
      handleError("Erro ao excluir produto.", err);
    }
  };

  /* ============================================================
     Upload de Foto (atualiza preview + lista)
  ============================================================ */
  const handleUploadPhoto = async () => {
    if (!selectedReceipt || !photoFile) return;

    const formData = new FormData();
    formData.append("photo", photoFile);

    try {
      await api.patch(`/receipt/${selectedReceipt.id}/photo/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      handleSuccess("Foto enviada com sucesso!");
      setPhotoFile(null);
      setPhotoPreview(null);
      await fetchReceipts(); // atualiza a lista (inclui nova URL da foto)
      await fetchProducts(selectedReceipt.id);
    } catch (err) {
      handleError("Erro ao enviar foto.", err);
    }
  };

  /* ============================================================
     Completar Receipt
  ============================================================ */
  const handleCompleteReceipt = async () => {
    if (!selectedReceipt) return;
    if (!confirm("Marcar receipt como completo?")) return;

    try {
      await api.patch(`/receipt/${selectedReceipt.id}`, { completed: true });
      handleSuccess("Receipt marcado como completo!");
      await fetchReceipts();
      setSelectedReceipt((prev) =>
        prev ? { ...prev, completed: true } : null,
      );
    } catch (err) {
      handleError("Erro ao completar receipt.", err);
    }
  };

  /* ============================================================
     Itens – Linhas
  ============================================================ */
  const handleAddLine = () => {
    setNewItems((prev) => [
      ...prev,
      {
        product_code: "",
        product_name: "",
        quantity_system: "",
        quantity_real: "",
      },
    ]);
  };

  const handleChangeLine = (
    index: number,
    field: keyof ReceiptProduct,
    value: string,
  ) => {
    setNewItems((prev) =>
      prev.map((i, idx) => (idx === index ? { ...i, [field]: value } : i)),
    );
  };

  const handleAddItems = async () => {
    if (!selectedReceipt) return;

    try {
      for (const item of newItems) {
        if (!item.product_code || !item.product_name) continue;

        await api.post("/receipt/product/", {
          receipt_id: selectedReceipt.id,
          product_code: Number(item.product_code),
          product_name: item.product_name,
          quantity_system: Number(item.quantity_system) || 0,
          quantity_real: Number(item.quantity_real) || 0,
          diference:
            Number(item.quantity_real || 0) - Number(item.quantity_system || 0),
          local: selectedReceipt.local,
          created_date: dayjs().format("YYYY-MM-DD"),
          new_product: false,
        });
      }
      handleSuccess("Itens adicionados!");
      setOpenAddItemModal(false);
      setNewItems([
        {
          product_code: "",
          product_name: "",
          quantity_system: "",
          quantity_real: "",
        },
      ]);
      await fetchProducts(selectedReceipt.id);
    } catch (err) {
      handleError("Erro ao adicionar itens.", err);
    }
  };

  /* ============================================================
     Modais
  ============================================================ */
  const openReceiptModal = async (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    await fetchProducts(receipt.id);
    setOpenModal(true);
  };

  const closeReceiptModal = async () => {
    setOpenModal(false);
    setSelectedReceipt(null);
    setProducts([]);
    setPhotoFile(null);
    setPhotoPreview(null);
    await fetchReceipts();
  };

  /* ============================================================
     Ordenação + Paginação (10 por página)
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
            Cadastrar
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
                        Gerenciar
                      </Button>

                      {/* Foto sempre visível se completed */}
                      {r.completed && (
                        <Button
                          size="xs"
                          color="info"
                          onClick={() => {
                            setSelectedReceipt(r);
                            setShowPhotoModal(true);
                          }}
                        >
                          Ver Foto
                        </Button>
                      )}

                      {/* Deletar só se NÃO completado */}
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
        <ModalHeader>Cadastrar recebimento</ModalHeader>
        <ModalBody>
          <Label>Data</Label>
          <TextInput
            type="date"
            value={newReceipt.created_date}
            onChange={(e) =>
              setNewReceipt((p) => ({ ...p, created_date: e.target.value }))
            }
            className="mt-2"
          />
        </ModalBody>
        <ModalFooter>
          <Button onClick={handleCreateReceipt}>Criar</Button>
          <Button color="gray" onClick={() => setOpenCreateModal(false)}>
            Cancelar
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal Itens */}
      <Modal show={openModal} onClose={closeReceiptModal} size="6xl">
        <ModalHeader className="flex items-center gap-2">
          Receipt #{selectedReceipt?.id} — {selectedReceipt?.user_name}
          {selectedReceipt?.completed && (
            <Badge color="success" size="sm">
              COMPLETO
            </Badge>
          )}
        </ModalHeader>
        <ModalBody>
          {/* Upload de Foto */}
          {!selectedReceipt?.completed && (
            <div className="mb-6 rounded-lg border border-gray-600 bg-gray-800 p-5">
              <Label className="mb-3 block text-lg font-semibold">
                Enviar foto da prancheta
              </Label>
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
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
                  className="block w-full text-sm text-gray-300 file:mr-4 file:rounded file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
                />
                {photoPreview && (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="h-24 w-24 rounded object-cover shadow"
                  />
                )}
                <Button
                  size="sm"
                  onClick={handleUploadPhoto}
                  disabled={!photoFile}
                >
                  Enviar
                </Button>
              </div>
            </div>
          )}

          {/* Tabela de Produtos */}
          {products.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-gray-700">
              <Table hoverable>
                <TableHead>
                  <TableRow className="bg-gray-900">
                    <TableHeadCell>Código</TableHeadCell>
                    <TableHeadCell>Produto</TableHeadCell>
                    <TableHeadCell className="text-center">
                      Qtd Sistema
                    </TableHeadCell>
                    <TableHeadCell className="text-center">
                      Qtd Real
                    </TableHeadCell>
                    <TableHeadCell className="text-center">
                      Diferença
                    </TableHeadCell>
                    {!selectedReceipt?.completed && (
                      <TableHeadCell className="text-center">
                        Ação
                      </TableHeadCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody className="divide-y divide-gray-700">
                  {products.map((p) => (
                    <TableRow key={p.id} className="bg-gray-800/50">
                      <TableCell>{p.product_code}</TableCell>
                      <TableCell>{p.product_name}</TableCell>
                      <TableCell className="text-center">
                        {p.quantity_system ?? "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {p.quantity_real ?? "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {p.diference ?? "-"}
                      </TableCell>
                      {!selectedReceipt?.completed && (
                        <TableCell className="text-center">
                          <Button
                            size="xs"
                            color="failure"
                            onClick={() => handleDeleteProduct(p.id!)}
                          >
                            Remover
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="py-8 text-center text-gray-400">
              Nenhum produto cadastrado.
            </p>
          )}
        </ModalBody>
        <ModalFooter className="flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">
            {!selectedReceipt?.completed && (
              <>
                <Button onClick={() => setOpenAddItemModal(true)} size="sm">
                  Adicionar produtos
                </Button>
                <Button color="green" size="sm" onClick={handleCompleteReceipt}>
                  Finalizar
                </Button>
              </>
            )}
            {selectedReceipt?.photo && (
              <Button
                color="purple"
                size="sm"
                onClick={() => setShowPhotoModal(true)}
              >
                Visualizar prancheta
              </Button>
            )}
          </div>
          <Button color="gray" size="sm" onClick={closeReceiptModal}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>

      {/* Adicionar Itens */}
      <Modal
        show={openAddItemModal}
        onClose={() => setOpenAddItemModal(false)}
        size="5xl"
      >
        <ModalHeader>Adicionar Itens ao Receipt</ModalHeader>
        <ModalBody>
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <Table hoverable>
              <TableHead>
                <TableRow className="bg-gray-900">
                  <TableHeadCell>Código</TableHeadCell>
                  <TableHeadCell>Produto</TableHeadCell>
                  <TableHeadCell className="text-center">
                    Qtd Sistema
                  </TableHeadCell>
                  <TableHeadCell className="text-center">
                    Qtd Real
                  </TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {newItems.map((item, idx) => (
                  <ProductRow
                    key={idx}
                    index={idx}
                    item={item}
                    onChange={handleChangeLine}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-5 flex justify-between">
            <Button color="gray" size="sm" onClick={handleAddLine}>
              + Nova Linha
            </Button>
            <Button onClick={handleAddItems} size="sm">
              Salvar Itens
            </Button>
          </div>
        </ModalBody>
      </Modal>

      {/* Visualizar Foto */}
      <Modal
        show={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        size="lg"
      >
        <ModalHeader>Foto do Receipt #{selectedReceipt?.id}</ModalHeader>
        <ModalBody className="flex justify-center p-6">
          {selectedReceipt?.photo ? (
            <img
              src={
                selectedReceipt.photo.startsWith("http")
                  ? selectedReceipt.photo
                  : `${
                      import.meta.env.VITE_API_URL || ""
                    }${selectedReceipt.photo}`
              }
              alt="Receipt"
              className="max-h-96 rounded-lg object-contain shadow-xl"
            />
          ) : (
            <div className="text-center">
              <p className="text-xl font-semibold text-red-400">
                Nenhuma foto enviada
              </p>
              <p className="mt-2 text-sm text-gray-400">
                O receipt foi marcado como completo, mas não possui foto.
              </p>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="gray" onClick={() => setShowPhotoModal(false)}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

/* ============================================================
   Linha de Produto com busca automática
============================================================ */
function ProductRow({
  index,
  item,
  onChange,
}: {
  index: number;
  item: ReceiptProduct;
  onChange: (i: number, f: keyof ReceiptProduct, v: string) => void;
}) {
  useEffect(() => {
    if (!item.product_code) return;

    const timeout = setTimeout(async () => {
      try {
        const { data } = await api.get(`/product/${item.product_code}`);
        onChange(index, "product_name", data.name || "");
      } catch {
        onChange(index, "product_name", "");
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [item.product_code, index, onChange]);

  return (
    <TableRow className="bg-gray-800/50">
      <TableCell>
        <TextInput
          value={item.product_code}
          onChange={(e) => onChange(index, "product_code", e.target.value)}
          placeholder="Código"
          className="w-full"
        />
      </TableCell>
      <TableCell>
        <TextInput
          value={item.product_name}
          readOnly
          placeholder="Nome do produto"
          className="min-w-64"
        />
      </TableCell>
      <TableCell>
        <TextInput
          type="number"
          onChange={(e) => onChange(index, "quantity_system", e.target.value)}
          placeholder="0"
          className="text-center"
        />
      </TableCell>
      <TableCell>
        <TextInput
          type="number"
          onChange={(e) => onChange(index, "quantity_real", e.target.value)}
          placeholder="0"
          className="text-center"
        />
      </TableCell>
    </TableRow>
  );
}
