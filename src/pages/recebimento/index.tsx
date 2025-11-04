import { useEffect, useState } from "react";
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
} from "flowbite-react";
import api from "../../api";
import { useLocalDeEstoque } from "../localEstoque";
import { useAuthStore } from "../authStore";

interface Receipt {
  id: number;
  user_id: number;
  user_name: string;
  quantity: number;
  local: number;
  created_date: string;
}

interface CreateReceipt {
  user_id: number;
  user_name: string;
  quantity: number;
  local: number;
  created_date: string;
}

interface ReceiptProduct {
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
}

export default function ReceiptPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [products, setProducts] = useState<ReceiptProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [openModal, setOpenModal] = useState(false);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openAddItemModal, setOpenAddItemModal] = useState(false);

  const { idLocal } = useLocalDeEstoque();
  const user = useAuthStore((state) => state.user);

  const [newReceipt, setNewReceipt] = useState<CreateReceipt>({
    user_id: user?.id || 1,
    user_name: user?.name || "",
    quantity: 0,
    local: idLocal || 1,
    created_date: new Date().toISOString().split("T")[0],
  });

  // Paginação
  const [pagina, setPagina] = useState(1);
  const itensPorPagina = 5;
  const indiceInicial = (pagina - 1) * itensPorPagina;
  const indiceFinal = indiceInicial + itensPorPagina;
  const receiptsPagina = receipts.slice(indiceInicial, indiceFinal);
  const totalPaginas = Math.max(1, Math.ceil(receipts.length / itensPorPagina));

  // Buscar receipts
  async function fetchReceipts() {
    setIsLoading(true);
    try {
      const res = await api.get("/receipt/");
      setReceipts(res.data);
    } catch (err) {
      console.error("Erro ao carregar receipts:", err);
    } finally {
      setIsLoading(false);
    }
  }

  // Buscar produtos do receipt
  async function fetchProducts(receiptId: number) {
    try {
      const res = await api.get(`/receipt/products/${receiptId}`);
      const data = res.data.filter(
        (p: ReceiptProduct) => p.receipt_id === receiptId,
      );
      setProducts(data);
    } catch (err) {
      console.error(err);
    }
  }

  // Abrir modal de receipt
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

  // Criar receipt
  const handleCreateReceipt = async () => {
    try {
      if (newReceipt.quantity <= 0) {
        alert("Informe uma quantidade válida!");
        return;
      }

      const payload = { ...newReceipt, local: idLocal };
      await api.post("/receipt/", payload);
      alert("Receipt criado com sucesso!");
      setOpenCreateModal(false);
      fetchReceipts();
    } catch (err) {
      console.error(err);
      alert("Erro ao criar receipt");
    }
  };

  // Deletar receipt
  const handleDeleteReceipt = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este receipt?")) return;
    try {
      await api.delete(`/receipt/${id}`);
      alert("Receipt excluído com sucesso!");
      fetchReceipts();
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir receipt.");
    }
  };

  // Deletar produto
  const handleDeleteProduct = async (id: number) => {
    if (!confirm("Excluir produto deste receipt?")) return;
    try {
      await api.delete(`/receipt/product/${id}`);
      alert("Produto excluído!");
      if (selectedReceipt) await fetchProducts(selectedReceipt.id);
    } catch (err) {
      console.error(err);
    }
  };

  // Adicionar itens
  const [newItems, setNewItems] = useState<ReceiptProduct[]>([
    {
      product_code: "",
      product_name: "",
      quantity_system: "",
      quantity_real: "",
    },
  ]);

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

  const handleRemoveLine = (index: number) => {
    setNewItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChangeLine = (index: number, field: string, value: string) => {
    setNewItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  useEffect(() => {
    const fetchNames = async () => {
      for (const [index, item] of newItems.entries()) {
        if (item.product_code && !item.product_name) {
          try {
            const res = await api.get(`/product/${item.product_code}`);
            handleChangeLine(index, "product_name", res.data.name);
          } catch (error) {
            console.error(error);
          }
        }
      }
    };
    fetchNames();
  }, [newItems.map((i) => i.product_code).join(",")]);

  const handleSaveItems = async () => {
    if (!selectedReceipt) {
      alert("Selecione um receipt antes!");
      return;
    }

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

      alert("Itens adicionados com sucesso!");
      setOpenAddItemModal(false);
      await fetchProducts(selectedReceipt.id);
    } catch (err) {
      console.error(err);
      alert("Erro ao adicionar itens");
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const receiptTemProdutos = products.length > 0;

  return (
    <div className="m-5 rounded-2xl bg-gray-700 p-6 text-gray-100">
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="xl" />
        </div>
      ) : (
        <div className="m-5 mx-auto">
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

          {/* Modal de criar receipt */}
          <Modal
            show={openCreateModal}
            onClose={() => setOpenCreateModal(false)}
          >
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

          {/* Modal de itens */}
          <Modal show={openModal} onClose={handleCloseModal} size="4xl">
            <ModalHeader>
              Itens do Receipt #{selectedReceipt?.id} —{" "}
              {selectedReceipt?.user_name}
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
              {!receiptTemProdutos && (
                <Button onClick={() => setOpenAddItemModal(true)}>
                  Adicionar Itens
                </Button>
              )}
              <Button color="gray" onClick={handleCloseModal}>
                Fechar
              </Button>
            </ModalFooter>
          </Modal>
        </div>
      )}
    </div>
  );
}
