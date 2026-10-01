import { useEffect, useState } from "react";
import { AxiosError } from "axios";
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
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
} from "flowbite-react";
import api from "../../api";
import { useAuthStore } from "../authStore";
import { useLocalDeEstoque } from "../localEstoque";

interface TaskProps {
  id: number;
  user_id: number;
  user_name: string;
  quantity: number;
  completed: boolean;
  branch_code: number;
  created_date: string;
}

interface TaskItemProps {
  id: number;
  task_id: number;
  product_external_id: number;
  code: string | null;
  product_name: string;
  quantity_system: number | null;
  quantity_real: number | null;
  difference: number | null;
  cost_total: number | null;
  stock_quantity: number | null;
  created_date: string;
}

const toNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
};

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as
      | { detail?: string; message?: string }
      | undefined;
    const detail = data?.detail ?? data?.message;
    if (detail) return String(detail);
  }
  return fallback;
}

export default function Tasks() {
  const user = useAuthStore((state) => state.user);
  const { idLocal } = useLocalDeEstoque();

  const [tasks, setTasks] = useState<TaskProps[]>([]);
  const [loading, setLoading] = useState(true);

  const [openCreate, setOpenCreate] = useState(false);
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [createLoading, setCreateLoading] = useState(false);
  const [createMessage, setCreateMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const [selectedTask, setSelectedTask] = useState<TaskProps | null>(null);
  const [items, setItems] = useState<TaskItemProps[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const [pagina, setPagina] = useState(1);
  const itensPorPagina = 5;
  const indiceInicial = (pagina - 1) * itensPorPagina;
  const indiceFinal = indiceInicial + itensPorPagina;
  const tasksPagina = tasks.slice(indiceInicial, indiceFinal);
  const totalPaginas = Math.max(1, Math.ceil(tasks.length / itensPorPagina));

  const branchCode = idLocal || user?.local || 0;

  async function fetchTasks() {
    try {
      setLoading(true);
      const res = await api.get("/task/");
      setTasks(res.data);
    } catch (err) {
      console.error("Erro ao listar tasks:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  async function fetchItems(taskId: number) {
    setItemsLoading(true);
    try {
      const res = await api.get(`/task/items/${taskId}`);
      const data = res.data as TaskItemProps[];
      setItems(
        data.map((i) => ({
          ...i,
          quantity_system: toNumber(i.quantity_system),
          quantity_real: toNumber(i.quantity_real),
          stock_quantity: toNumber(i.stock_quantity),
        })),
      );
    } catch (err) {
      console.error("Erro ao buscar itens:", err);
    } finally {
      setItemsLoading(false);
    }
  }

  const handleOpenTask = async (task: TaskProps) => {
    setSelectedTask(task);
    setSaveMessage(null);
    await fetchItems(task.id);
  };

  const handleCloseTask = () => {
    setSelectedTask(null);
    setItems([]);
    setSaveMessage(null);
  };

  const handleChangeItem = (
    id: number,
    field: keyof TaskItemProps,
    value: number | boolean,
  ) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const handleCreateTask = async () => {
    setCreateMessage(null);
    if (newQuantity <= 0) {
      setCreateMessage({
        type: "error",
        text: "Informe uma quantidade válida (maior que zero).",
      });
      return;
    }
    if (!branchCode) {
      setCreateMessage({
        type: "error",
        text: "Local de estoque não identificado. Recarregue a página.",
      });
      return;
    }

    setCreateLoading(true);
    try {
      const res = await api.post("/task/", {
        quantity: newQuantity,
        branch_code: branchCode,
      });
      setCreateMessage({
        type: "success",
        text: `Task #${res.data.task.id} criada com ${res.data.items.length} produto(s) para conferir.`,
      });
      setNewQuantity(0);
      fetchTasks();
      setTimeout(() => setOpenCreate(false), 1500);
    } catch (err) {
      setCreateMessage({
        type: "error",
        text: getErrorMessage(err, "Erro ao criar task. Tente novamente."),
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedTask) return;
    setSaveMessage(null);

    const missing = items.filter(
      (item) =>
        item.quantity_system === null || item.quantity_real === null,
    );

    if (missing.length > 0) {
      setSaveMessage({
        type: "error",
        text: `Preencha as quantidades (Sistema e Real) de todos os ${items.length} item(ns). ${missing.length} ainda pendente(s).`,
      });
      return;
    }

    const payload = items.map((item) => ({
      id: item.id,
      quantity_system: item.quantity_system ?? 0,
      quantity_real: item.quantity_real ?? 0,
    }));

    setSaveLoading(true);
    try {
      await api.put("/task/items/", payload);
      setSaveMessage({
        type: "success",
        text: "Itens enviados com sucesso!",
      });
      handleCloseTask();
      fetchTasks();
    } catch (err) {
      console.error("Erro ao salvar itens:", err);
      setSaveMessage({
        type: "error",
        text: getErrorMessage(err, "Erro ao salvar as alterações."),
      });
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tarefas de Conferência</h1>
          <p className="text-sm text-gray-300">
            Gere uma lista de produtos e envie a conferência realizada.
          </p>
        </div>
        <Button onClick={() => setOpenCreate(true)}>Nova Tarefa</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner aria-label="Carregando dados..." size="xl" />
        </div>
      ) : tasks.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-gray-500 dark:text-gray-300">
            Nenhuma task encontrada. Clique em "Nova Tarefa" para gerar.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tasksPagina.map((task) => (
              <Card key={task.id} className="shadow-md">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-bold text-gray-800 dark:text-white">
                      Task #{task.id}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(task.created_date).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Badge color={task.completed ? "success" : "warning"}>
                    {task.completed ? "Concluída" : "Pendente"}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    Quantidade: <b>{task.quantity}</b>
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    Filial: <b>{task.branch_code}</b>
                  </span>
                </div>
                <div className="mt-4">
                  <Button
                    size="xs"
                    onClick={() => handleOpenTask(task)}
                    className="w-full"
                  >
                    {task.completed ? "Ver Itens" : "Conferir Itens"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-6 flex justify-center">
            <Pagination
              currentPage={pagina}
              totalPages={totalPaginas}
              onPageChange={setPagina}
              showIcons
            />
          </div>
        </>
      )}

      {/* Modal: Nova Tarefa */}
      <Modal show={openCreate} onClose={() => setOpenCreate(false)}>
        <ModalHeader>Nova Tarefa de Conferência</ModalHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-500">
              Serão sorteados <b>{newQuantity || 0}</b> produtos pendentes de
              conferência na filial{" "}
              <b>{branchCode || "—"}</b>.
            </p>
            <Label htmlFor="quantidade-nova">Quantidade de itens</Label>
            <TextInput
              id="quantidade-nova"
              type="number"
              min={1}
              value={newQuantity || ""}
              onChange={(e) => setNewQuantity(Number(e.target.value))}
            />
            {createMessage && (
              <p
                className={`text-sm ${
                  createMessage.type === "error"
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {createMessage.text}
              </p>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button onClick={handleCreateTask} disabled={createLoading}>
            {createLoading ? <Spinner size="sm" /> : "Gerar"}
          </Button>
          <Button color="gray" onClick={() => setOpenCreate(false)}>
            Cancelar
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal: Itens da task */}
      <Modal
        show={selectedTask !== null}
        onClose={handleCloseTask}
        size="5xl"
      >
        <ModalHeader>
          Itens da Task #{selectedTask?.id}{" "}
          {selectedTask?.completed ? "(Concluída)" : "(Em andamento)"}
        </ModalHeader>
        <ModalBody>
          {itemsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner aria-label="Carregando itens..." size="xl" />
            </div>
          ) : (
            <Table hoverable className="text-center">
              <TableHead>
                <TableRow>
                  <TableHeadCell>Código</TableHeadCell>
                  <TableHeadCell>Produto</TableHeadCell>
                  <TableHeadCell>Qtd Estoque</TableHeadCell>
                  <TableHeadCell>Qtd Sistema</TableHeadCell>
                  <TableHeadCell>Qtd Real</TableHeadCell>
                  <TableHeadCell>Diferença</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow
                    key={item.id}
                    className="bg-white dark:bg-gray-800"
                  >
                    <TableCell>{item.code || "—"}</TableCell>
                    <TableCell>{item.product_name}</TableCell>
                    <TableCell>
                      {item.stock_quantity !== null &&
                      item.stock_quantity !== undefined
                        ? (Number(item.stock_quantity) || 0).toLocaleString(
                            "pt-BR",
                          )
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {selectedTask?.completed ? (
                        item.quantity_system ?? "—"
                      ) : (
                        <TextInput
                          type="number"
                          value={item.quantity_system ?? ""}
                          onChange={(e) =>
                            handleChangeItem(
                              item.id,
                              "quantity_system",
                              Number(e.target.value),
                            )
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {selectedTask?.completed ? (
                        item.quantity_real ?? "—"
                      ) : (
                        <TextInput
                          type="number"
                          value={item.quantity_real ?? ""}
                          onChange={(e) =>
                            handleChangeItem(
                              item.id,
                              "quantity_real",
                              Number(e.target.value),
                            )
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {item.difference !== null && item.difference !== undefined
                        ? (Number(item.difference) || 0).toLocaleString("pt-BR")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {saveMessage && (
            <p
              className={`mt-4 text-sm ${
                saveMessage.type === "error"
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            >
              {saveMessage.text}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          {!selectedTask?.completed && (
            <Button onClick={handleSave} disabled={saveLoading}>
              {saveLoading ? <Spinner size="sm" /> : "Enviar Conferência"}
            </Button>
          )}
          <Button color="gray" onClick={handleCloseTask}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}