import { useEffect, useState, useCallback } from "react";
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
} from "flowbite-react";
import api from "../../api";
import { useLocalDeEstoque } from "../localEstoque";
import { useAuthStore } from "../authStore";

type Receipt = {
  id: number;
  user_id: number;
  user_name: string;
  quantity: number;
  local: number;
  created_date: string;
};

type CreateReceipt = Omit<Receipt, "id">;

type ReceiptProduct = {
  id?: number;
  product_code: number | string;
  receipt_id?: number;
  product_name: string;
  new_product?: boolean;
  quantity_system?: number | null | string;
  quantity_real?: number | null | string;
  diference?: number | null;
  created_date?: string;
  local?: number;
};

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

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [openModal, setOpenModal] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openAddItemModal, setOpenAddItemModal] = useState(false);

  const { idLocal } = useLocalDeEstoque();
  const user = useAuthStore((state) => state.user);

  const [newReceipt, setNewReceipt] = useState<CreateReceipt>({
    user_id: user?.id || 0,
    user_name: user?.name || "Usuário",
    quantity: 0,
    local: idLocal || 0,
    created_date: new Date().toISOString().split("T")[0],
  });

  const [pagina, setPagina] = useState(1);
  const itensPorPagina = 5;
  const receiptsPagina = receipts.slice(
    (pagina - 1) * itensPorPagina,
    pagina * itensPorPagina,
  );
  const totalPaginas = Math.max(1, Math.ceil(receipts.length / itensPorPagina));

  const handleError = useCallback((msg: string, err?: unknown) => {
    console.error(msg, err);
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  }, []);

  const handleSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  }, []);

  const fetchReceipts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<Receipt[]>("/receipt/");
      setReceipts(res.data);
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
        handleError("Erro ao carregar produtos do receipt.", err);
      }
    },
    [handleError],
  );

  const handleCreateReceipt = async () => {
    if (newReceipt.quantity <= 0) {
      handleError("Informe uma quantidade válida!");
      return;
    }

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
    if (!confirm("Excluir produto deste receipt?")) return;
    try {
      await api.delete(`/receipt/product/${id}`);
      handleSuccess("Produto excluído!");
      if (selectedReceipt) await fetchProducts(selectedReceipt.id);
    } catch (err) {
      handleError("Erro ao excluir produto.", err);
    }
  };

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
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
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
          created_date: new Date().toISOString().split("T")[0],
          new_product: false,
        });
      }

      handleSuccess("Itens adicionados com sucesso!");
      setOpenAddItemModal(false);
      await fetchProducts(selectedReceipt.id);
    } catch (err) {
      handleError("Erro ao adicionar itens.", err);
    }
  };

  const handleOpenModal = async (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    await fetchProducts(receipt.id);
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setSelectedReceipt(null);
    setProducts([]);
  };

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  return (
    <div className="m-5 rounded-2xl bg-gray-700 p-6 text-gray-100">
      {errorMsg && <Alert color="failure">{errorMsg}</Alert>}
      {successMsg && <Alert color="success">{successMsg}</Alert>}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="xl" />
        </div>
      ) : (
        <>
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold">📦 Receipts</h1>
            <Button onClick={() => setOpenCreateModal(true)}>
              Novo Receipt
            </Button>
          </div>

          <Table hoverable className="border border-gray-600 text-center">
            <TableHead>
              <TableRow className="bg-gray-800">
                <TableHeadCell>ID</TableHeadCell>
                <TableHeadCell>Usuário</TableHeadCell>
                <TableHeadCell>Data</TableHeadCell>
                <TableHeadCell>Qtd</TableHeadCell>
                <TableHeadCell>Local</TableHeadCell>
                <TableHeadCell>Ações</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {receiptsPagina.map((r) => (
                <TableRow
                  key={r.id}
                  className="bg-gray-800/50 transition hover:bg-gray-800"
                >
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{r.user_name}</TableCell>
                  <TableCell>
                    {new Date(r.created_date).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>{r.quantity}</TableCell>
                  <TableCell>{r.local}</TableCell>
                  <TableCell className="flex justify-center gap-2">
                    <Button size="xs" onClick={() => handleOpenModal(r)}>
                      Ver Itens
                    </Button>
                    <Button
                      size="xs"
                      color="failure"
                      onClick={() => handleDeleteReceipt(r.id)}
                    >
                      Deletar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex justify-center">
            <Pagination
              currentPage={pagina}
              totalPages={totalPaginas}
              onPageChange={setPagina}
              showIcons
            />
          </div>
        </>
      )}

      {/* Modal Criar Receipt */}
      <Modal show={openCreateModal} onClose={() => setOpenCreateModal(false)}>
        <ModalHeader>Criar novo receipt</ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <Label>Quantidade total</Label>
            <TextInput
              type="number"
              value={newReceipt.quantity}
              onChange={(e) =>
                setNewReceipt((prev) => ({
                  ...prev,
                  quantity: Number(e.target.value),
                }))
              }
            />
            <Label>Data</Label>
            <TextInput
              type="date"
              value={newReceipt.created_date}
              onChange={(e) =>
                setNewReceipt((prev) => ({
                  ...prev,
                  created_date: e.target.value,
                }))
              }
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button onClick={handleCreateReceipt}>Criar</Button>
          <Button color="gray" onClick={() => setOpenCreateModal(false)}>
            Cancelar
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal Itens */}
      <Modal show={openModal} onClose={handleCloseModal} size="4xl">
        <ModalHeader>
          Itens do Receipt #{selectedReceipt?.id} — {selectedReceipt?.user_name}
        </ModalHeader>
        <ModalBody>
          {products.length > 0 ? (
            <Table hoverable className="border border-gray-600 text-center">
              <TableHead>
                <TableRow className="bg-gray-800">
                  <TableHeadCell>Código</TableHeadCell>
                  <TableHeadCell>Produto</TableHeadCell>
                  <TableHeadCell>Qtd Sistema</TableHeadCell>
                  <TableHeadCell>Qtd Real</TableHeadCell>
                  <TableHeadCell>Diferença</TableHeadCell>
                  <TableHeadCell>Ações</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id} className="bg-gray-800/50">
                    <TableCell>{p.product_code}</TableCell>
                    <TableCell>{p.product_name}</TableCell>
                    <TableCell>{p.quantity_system ?? "-"}</TableCell>
                    <TableCell>{p.quantity_real ?? "-"}</TableCell>
                    <TableCell>{p.diference ?? "-"}</TableCell>
                    <TableCell>
                      <Button
                        size="xs"
                        color="failure"
                        onClick={() => handleDeleteProduct(p.id!)}
                      >
                        Remover
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-gray-400">
              Nenhum produto cadastrado.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => setOpenAddItemModal(true)}>
            Adicionar Itens
          </Button>
          <Button color="gray" onClick={handleCloseModal}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal Adicionar Itens */}
      <Modal
        show={openAddItemModal}
        onClose={() => setOpenAddItemModal(false)}
        size="4xl"
      >
        <ModalHeader>Adicionar Itens ao Receipt</ModalHeader>
        <ModalBody>
          <Table hoverable className="border border-gray-600 text-center">
            <TableHead>
              <TableRow className="bg-gray-800">
                <TableHeadCell>Código</TableHeadCell>
                <TableHeadCell>Produto</TableHeadCell>
                <TableHeadCell>Qtd Sistema</TableHeadCell>
                <TableHeadCell>Qtd Real</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {newItems.map((item, index) => (
                <TableRow key={index} className="bg-gray-800/50">
                  <TableCell>
                    <TextInput
                      value={item.product_code}
                      onChange={(e) =>
                        handleChangeLine(index, "product_code", e.target.value)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TextInput
                      value={item.product_name}
                      readOnly
                      placeholder="Nome do produto"
                    />
                  </TableCell>
                  <TableCell>
                    <TextInput
                      type="number"
                      onChange={(e) =>
                        handleChangeLine(
                          index,
                          "quantity_system",
                          e.target.value,
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <TextInput
                      type="number"
                      onChange={(e) =>
                        handleChangeLine(index, "quantity_real", e.target.value)
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 flex justify-between">
            <Button color="gray" onClick={handleAddLine}>
              + Nova Linha
            </Button>
            <Button onClick={handleAddItems}>Salvar Itens</Button>
          </div>
        </ModalBody>
      </Modal>
    </div>
  );
}
