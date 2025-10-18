import { useEffect, useState } from "react";
import { useLocalDeEstoque } from "../localEstoque";
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
  Checkbox,
  Pagination,
  Spinner,
} from "flowbite-react";
import api from "../../api";

interface Create_Work_Conference {
  quantity: number;
  local: number;
}

interface WorkConference {
  id: number;
  user_name: string;
  created_date: string;
  quantity: number;
  completed: boolean;
}

interface WorkItem {
  id: number;
  product_name: string;
  product_code: number;
  quantity_system: number | null;
  quantity_real: number | null;
  active?: boolean;
}

export default function Tarefas() {
  const [workList, setWorkList] = useState<WorkConference[]>([]);
  const [selectedWork, setSelectedWork] = useState<WorkConference | null>(null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const { idLocal } = useLocalDeEstoque();
  const [isLoading, setIsLoading] = useState<boolean>();

  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [quantidadeNova, setQuantidadeNova] = useState<number>(0);

  const [pagina, setPagina] = useState(1);
  const itensPorPagina = 5;
  const indiceInicial = (pagina - 1) * itensPorPagina;
  const indiceFinal = indiceInicial + itensPorPagina;
  const workPagina = workList.slice(indiceInicial, indiceFinal);
  const totalPaginas = Math.max(1, Math.ceil(workList.length / itensPorPagina));

  // 🔹 Buscar lista de Work_Conference
  async function fetchWorkList() {
    try {
      setIsLoading(true);
      const res = await api.get("/work_conference/");
      const data = await res.data;
      setWorkList(data);
      setIsLoading(false);
    } catch (err) {
      console.error(err);
    }
  }

  // 🔹 Buscar itens do work selecionado
  async function fetchWorkItems(workId: number) {
    try {
      const res = await api.get(`/work_conference/items/${workId}`);
      const data = await res.data;

      // Adiciona campo "active" (caso backend não envie)
      const itemsWithActive = data.map((i: any) => ({
        ...i,
        active: i.active ?? true,
      }));
      setWorkItems(itemsWithActive);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    fetchWorkList();
  }, []);

  const handleOpenModal = async (work: WorkConference) => {
    setSelectedWork(work);
    await fetchWorkItems(work.id);
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setSelectedWork(null);
    setWorkItems([]);
  };

  // 🔹 Atualizar valores localmente
  const handleChangeItem = (id: number, field: keyof WorkItem, value: any) => {
    setWorkItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  // 🔹 Salvar alterações no backend
  const handleSave = async () => {
    if (selectedWork?.completed) {
      alert("Não é possível alterar uma Work Conference já concluída.");
      return;
    }

    try {
      await api.patch("/work_conference/items/batch", workItems);
      alert("Alterações salvas!");
      handleCloseModal();
      fetchWorkList();
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar alterações.");
    }
  };

  // 🔹 Criar nova Work Conference
  const handleCreateWork = async () => {
    if (quantidadeNova <= 0) {
      alert("Informe uma quantidade válida!");
      return;
    }
    try {
      const new_conference: Create_Work_Conference = {
        quantity: quantidadeNova,
        local: idLocal,
      };
      const res = await api.post("/work_conference/", new_conference);

      if (!res) throw new Error("Erro ao criar Work Conference");

      alert("Work Conference criada!");
      setOpenCreateModal(false);
      setQuantidadeNova(0);
      fetchWorkList();
    } catch (err) {
      console.error(err);
      alert("Erro ao criar Work Conference.");
    }
  };

  const handlePrintWorkItems = () => {
    if (!selectedWork) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Conferência #${selectedWork.id}</title>
          <style>
            @media print {
              @page {
                size: A4 portrait;
                margin: 20mm;
              }
              body, table, th, td {
                font-family: Arial, sans-serif;
                font-size: 10px;
                color: #000;
              }
              h2, p {
                margin: 0 0 5px 0;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-to3p: 10px;
              }
              th, td {
                border: 1px solid #000;
                padding: 4px 6px;
                text-align: center;
              }
              th {
                background-color: #f0f0f0;
              }
            }
          </style>
        </head>
        <body>
          <h2>Work Conference #${selectedWork.id}</h2>
          <p>Usuário: ${selectedWork.user_name}</p>
          <p>Data: ${new Date(selectedWork.created_date).toLocaleDateString("pt-BR")}</p>

          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Produto</th>
                <th>Qtd Sistema</th>
                <th>Qtd Físico</th>
              </tr>
            </thead>
            <tbody>
              ${workItems
                .map(
                  (item) => `
                <tr>
                  <td>${item.product_code}</td>
                  <td>${item.product_name}</td>
                  <td>${item.quantity_system ?? ""}</td>
                  <td>${item.quantity_real ?? ""}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  return (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner aria-label="Carregando dados..." size="xl" />{" "}
        </div>
      ) : (
        <div className="mx-auto max-w-5xl p-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold">Lista de Conferências</h1>
            <Button onClick={() => setOpenCreateModal(true)}>
              Criar lista
            </Button>
          </div>

          <Table hoverable className="text-center">
            <TableHead>
              <TableRow>
                <TableHeadCell>ID</TableHeadCell>
                <TableHeadCell>Usuário</TableHeadCell>
                <TableHeadCell>Data</TableHeadCell>
                <TableHeadCell>Quantidade</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Ações</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workPagina.map((work) => (
                <TableRow key={work.id} className="bg-white dark:bg-gray-800">
                  <TableCell>{work.id}</TableCell>
                  <TableCell>{work.user_name}</TableCell>
                  <TableCell>
                    {new Date(work.created_date).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>{work.quantity}</TableCell>
                  <TableCell>
                    {work.completed ? "✅ Completo" : "🕓 Pendente"}
                  </TableCell>
                  <TableCell>
                    <Button size="xs" onClick={() => handleOpenModal(work)}>
                      Ver Itens
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

          {/* Modal de edição */}
          <Modal show={openModal} onClose={handleCloseModal} size="5xl">
            <ModalHeader>
              Itens do Work Conference #{selectedWork?.id}{" "}
              {selectedWork?.completed && "(Concluído)"}
            </ModalHeader>
            <ModalBody>
              <Table hoverable className="text-center">
                <TableHead>
                  <TableRow>
                    <TableHeadCell>Código</TableHeadCell>
                    <TableHeadCell>Produto</TableHeadCell>
                    <TableHeadCell>Qtd Sistema</TableHeadCell>
                    <TableHeadCell>Qtd Físico</TableHeadCell>
                    <TableHeadCell>Inativo(Sem Estoque)</TableHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workItems.map((item) => (
                    <TableRow
                      key={item.id}
                      className="bg-white dark:bg-gray-800"
                    >
                      <TableCell>{item.product_code}</TableCell>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>
                        <TextInput
                          type="number"
                          disabled={selectedWork?.completed}
                          value={item.quantity_system ?? ""}
                          onChange={(e) =>
                            handleChangeItem(
                              item.id,
                              "quantity_system",
                              Number(e.target.value),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <TextInput
                          type="number"
                          disabled={selectedWork?.completed}
                          value={item.quantity_real ?? ""}
                          onChange={(e) =>
                            handleChangeItem(
                              item.id,
                              "quantity_real",
                              Number(e.target.value),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {selectedWork?.completed ? (
                          // 🔹 Exibição quando concluído (sem edição)
                          item.active ? (
                            "Ativo"
                          ) : (
                            "Inativo"
                          )
                        ) : (
                          // 🔹 Checkbox invertido: marcado = produto inativo
                          <Checkbox
                            checked={!item.active} // invertido
                            onChange={
                              (e) =>
                                handleChangeItem(
                                  item.id,
                                  "active",
                                  !e.target.checked,
                                ) // invertido
                            }
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ModalBody>
            <ModalFooter>
              {!selectedWork?.completed && (
                <Button onClick={handleSave}>Salvar Alterações</Button>
              )}
              <Button color="gray" onClick={handleCloseModal}>
                Fechar
              </Button>
              <Button color="blue" onClick={handlePrintWorkItems}>
                Imprimir Itens
              </Button>
            </ModalFooter>
          </Modal>

          {/* Modal criar Work Conference */}
          <Modal
            show={openCreateModal}
            onClose={() => setOpenCreateModal(false)}
          >
            <ModalHeader>Criar Work Conference</ModalHeader>
            <ModalBody>
              <div className="flex flex-col gap-4">
                <Label htmlFor="quantidade">Quantidade</Label>
                <TextInput
                  id="quantidade"
                  type="number"
                  value={quantidadeNova}
                  onChange={(e) => setQuantidadeNova(Number(e.target.value))}
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button onClick={handleCreateWork}>Criar</Button>
              <Button color="gray" onClick={() => setOpenCreateModal(false)}>
                Cancelar
              </Button>
            </ModalFooter>
          </Modal>
        </div>
      )}
    </>
  );
}
