import { useCallback, useEffect, useState } from "react";
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
import api from "../../../api";
import { useAuthStore } from "../../authStore";

interface User {
  id: number;
  name: string;
  username: string;
}

interface Local {
  id: number;
  name: string;
}

interface GeneratedTask {
  id: number;
  user_id: number;
  user_name: string;
  quantity: number;
  completed: boolean;
  branch_code: number;
  created_date: string;
}

interface GeneratedItem {
  id: number;
  code: string;
  external_id: number;
  name: string;
  price: string;
  last_verification: string | null;
  stock_quantity: number | string | null;
}

interface AdminTaskProps {
  id: number;
  user_id: number;
  user_name: string;
  quantity: number;
  completed: boolean;
  branch_code: number;
  created_date: string;
  items_confirmed: number;
}

interface TaskItemProps {
  id: number;
  task_id: number;
  product_external_id: number;
  product_name: string;
  quantity_system: number | null;
  quantity_real: number | null;
  difference: number | null;
  cost_total: number | null;
  stock_quantity: number | string | null;
  created_date: string;
}

type Feedback = { type: "error" | "success"; text: string } | null;

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

export default function AdminTasks() {
  const user = useAuthStore((state) => state.user);

  const [users, setUsers] = useState<User[]>([]);
  const [locals, setLocals] = useState<Local[]>([]);

  // Acompanhamento de tasks (todos os usuários)
  const [adminTasks, setAdminTasks] = useState<AdminTaskProps[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [filterUserId, setFilterUserId] = useState("");
  const [filterCompleted, setFilterCompleted] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdminTaskProps | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<Feedback>(null);

  // Geração por quantidade
  const [genUserId, setGenUserId] = useState("");
  const [genQuantity, setGenQuantity] = useState<number>(0);
  const [genBranch, setGenBranch] = useState<number>(0);
  const [genLoading, setGenLoading] = useState(false);
  const [genFeedback, setGenFeedback] = useState<Feedback>(null);
  const [generated, setGenerated] = useState<{
    task: GeneratedTask;
    items: GeneratedItem[];
  } | null>(null);

  // Atribuição de códigos específicos
  const [customUserId, setCustomUserId] = useState("");
  const [customBranch, setCustomBranch] = useState<number>(0);
  const [customCodes, setCustomCodes] = useState("");
  const [customLoading, setCustomLoading] = useState(false);
  const [customFeedback, setCustomFeedback] = useState<Feedback>(null);
  const [customResult, setCustomResult] = useState<{
    task: GeneratedTask;
    items: GeneratedItem[];
  } | null>(null);

  // Visualização de itens por ID
  const [viewTaskId, setViewTaskId] = useState("");
  const [viewItems, setViewItems] = useState<TaskItemProps[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewFeedback, setViewFeedback] = useState<Feedback>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  useEffect(() => {
    if (user?.admin !== 1) return;
    api.get("/admin/users").then((res) => setUsers(res.data));
    api.get("/local/").then((res) => setLocals(res.data));
  }, [user]);

  const fetchAdminTasks = useCallback(async () => {
    try {
      setTasksLoading(true);
      const res = await api.get("/task/admin/tasks/", {
        params: {
          ...(filterUserId ? { user_id: Number(filterUserId) } : {}),
          ...(filterCompleted ? { completed: filterCompleted } : {}),
        },
      });
      setAdminTasks(res.data);
    } catch (err) {
      console.error("Erro ao listar tasks admin:", err);
    } finally {
      setTasksLoading(false);
    }
  }, [filterUserId, filterCompleted]);

  useEffect(() => {
    fetchAdminTasks();
  }, [fetchAdminTasks]);

  const handleGenerate = async () => {
    setGenFeedback(null);
    if (!genUserId) {
      setGenFeedback({ type: "error", text: "Selecione um usuário." });
      return;
    }
    if (genQuantity <= 0) {
      setGenFeedback({ type: "error", text: "Informe uma quantidade válida." });
      return;
    }
    if (!genBranch) {
      setGenFeedback({ type: "error", text: "Selecione a filial." });
      return;
    }

    setGenLoading(true);
    try {
      const res = await api.post("/task/admin/", {
        user_id: Number(genUserId),
        quantity: genQuantity,
        branch_code: Number(genBranch),
      });
      setGenerated(res.data);
      setGenFeedback({
        type: "success",
        text: `Task #${res.data.task.id} criada para ${res.data.task.user_name}.`,
      });
      setGenQuantity(0);
      fetchAdminTasks();
    } catch (err) {
      setGenFeedback({
        type: "error",
        text: getErrorMessage(err, "Erro ao gerar task."),
      });
    } finally {
      setGenLoading(false);
    }
  };

  const handleCustom = async () => {
    setCustomFeedback(null);
    if (!customUserId) {
      setCustomFeedback({ type: "error", text: "Selecione um usuário." });
      return;
    }
    if (!customBranch) {
      setCustomFeedback({ type: "error", text: "Selecione a filial." });
      return;
    }

    const codes = customCodes
      .split(/[,\n;]/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    const uniqueCodes = [...new Set(codes)];

    if (uniqueCodes.length === 0) {
      setCustomFeedback({
        type: "error",
        text: "Informe ao menos um código de produto.",
      });
      return;
    }

    setCustomLoading(true);
    try {
      const res = await api.post("/task/admin/custom/", {
        user_id: Number(customUserId),
        branch_code: Number(customBranch),
        product_codes: uniqueCodes,
      });
      setCustomResult(res.data);
      setCustomFeedback({
        type: "success",
        text: `Task #${res.data.task.id} atribuída com ${res.data.items.length} produto(s).`,
      });
      setCustomCodes("");
      fetchAdminTasks();
    } catch (err) {
      setCustomFeedback({
        type: "error",
        text: getErrorMessage(err, "Erro ao atribuir produtos."),
      });
    } finally {
      setCustomLoading(false);
    }
  };

  const openItems = async (taskId: number) => {
    setViewFeedback(null);
    setViewLoading(true);
    try {
      const res = await api.get(`/task/items/${taskId}`);
      setViewItems(res.data);
      setViewTaskId(String(taskId));
      setViewModalOpen(true);
    } catch (err) {
      setViewFeedback({
        type: "error",
        text: getErrorMessage(err, "Erro ao buscar os itens da task."),
      });
    } finally {
      setViewLoading(false);
    }
  };

  const handleViewItems = () => {
    const taskId = Number(viewTaskId);
    if (!taskId || taskId <= 0) {
      setViewFeedback({
        type: "error",
        text: "Informe um ID válido de task.",
      });
      return;
    }
    openItems(taskId);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteFeedback(null);
    try {
      const res = await api.delete(`/task/admin/tasks/${deleteTarget.id}/`);
      setDeleteFeedback({
        type: "success",
        text:
          res.data?.message ||
          `Task #${deleteTarget.id} excluída com sucesso.`,
      });
      setDeleteTarget(null);
      fetchAdminTasks();
    } catch (err) {
      setDeleteFeedback({
        type: "error",
        text: getErrorMessage(err, "Erro ao excluir a task."),
      });
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Gerenciamento de Tarefas
        </h1>
        <p className="text-sm text-gray-300">
          Acompanhe, gere e exclua conferências de todos os operadores.
        </p>
      </div>

      {/* Acompanhamento de tasks */}
      <Card className="shadow-md">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">
            Acompanhamento de Tarefas
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-56">
              <Label htmlFor="filter-usuario">Usuário</Label>
              <Select
                id="filter-usuario"
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
              >
                <option value="">Todos</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full sm:w-48">
              <Label htmlFor="filter-status">Status</Label>
              <Select
                id="filter-status"
                value={filterCompleted}
                onChange={(e) => setFilterCompleted(e.target.value)}
              >
                <option value="">Todas</option>
                <option value="false">Pendentes</option>
                <option value="true">Concluídas</option>
              </Select>
            </div>
          </div>
        </div>

        {tasksLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner aria-label="Carregando tasks..." size="xl" />
          </div>
        ) : adminTasks.length === 0 ? (
          <p className="py-6 text-center text-gray-500 dark:text-gray-300">
            Nenhuma task encontrada.
          </p>
        ) : (
          <Table hoverable className="text-center">
            <TableHead>
              <TableRow>
                <TableHeadCell>ID</TableHeadCell>
                <TableHeadCell>Usuário</TableHeadCell>
                <TableHeadCell>Data</TableHeadCell>
                <TableHeadCell>Itens</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
                <TableHeadCell>Ações</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {adminTasks.map((task) => (
                <TableRow key={task.id} className="bg-white dark:bg-gray-800">
                  <TableCell>{task.id}</TableCell>
                  <TableCell>{task.user_name}</TableCell>
                  <TableCell>
                    {new Date(task.created_date).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Badge color={task.items_confirmed > 0 ? "blue" : "gray"}>
                      {task.items_confirmed}/{task.quantity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {task.completed ? (
                      <Badge color="success">Concluída</Badge>
                    ) : (
                      <Badge color="warning">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="xs"
                        color="blue"
                        onClick={() => openItems(task.id)}
                      >
                        Ver Itens
                      </Button>
                      <Button
                        size="xs"
                        color="failure"
                        onClick={() => setDeleteTarget(task)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {deleteFeedback && (
          <p
            className={`mt-3 text-sm ${
              deleteFeedback.type === "error"
                ? "text-red-600"
                : "text-green-600"
            }`}
          >
            {deleteFeedback.text}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Geração por quantidade */}
        <Card className="shadow-md">
          <h2 className="mb-3 text-lg font-bold text-gray-800 dark:text-white">
            Gerar Tarefa (Sorteio)
          </h2>
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="gen-usuario">Usuário</Label>
              <Select
                id="gen-usuario"
                value={genUserId}
                onChange={(e) => setGenUserId(e.target.value)}
              >
                <option value="">Selecione</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.username})
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="gen-quantidade">Quantidade</Label>
                <TextInput
                  id="gen-quantidade"
                  type="number"
                  min={1}
                  value={genQuantity || ""}
                  onChange={(e) => setGenQuantity(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="gen-filial">Filial</Label>
                <Select
                  id="gen-filial"
                  value={genBranch}
                  onChange={(e) => setGenBranch(Number(e.target.value))}
                >
                  <option value={0}>Selecione</option>
                  {locals.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.id} - {l.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <Button onClick={handleGenerate} disabled={genLoading}>
              {genLoading ? <Spinner size="sm" /> : "Gerar Tarefa"}
            </Button>
            {genFeedback && (
              <p
                className={`text-sm ${
                  genFeedback.type === "error"
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {genFeedback.text}
              </p>
            )}
          </div>
        </Card>

        {/* Atribuição de códigos específicos */}
        <Card className="shadow-md">
          <h2 className="mb-3 text-lg font-bold text-gray-800 dark:text-white">
            Atribuir Produtos Específicos
          </h2>
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="custom-usuario">Usuário</Label>
              <Select
                id="custom-usuario"
                value={customUserId}
                onChange={(e) => setCustomUserId(e.target.value)}
              >
                <option value="">Selecione</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.username})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="custom-filial">Filial</Label>
              <Select
                id="custom-filial"
                value={customBranch}
                onChange={(e) => setCustomBranch(Number(e.target.value))}
              >
                <option value={0}>Selecione</option>
                {locals.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.id} - {l.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="custom-codigos">
                Códigos dos produtos (separados por vírgula ou quebra de linha)
              </Label>
              <Textarea
                id="custom-codigos"
                rows={3}
                placeholder='Ex.: C-003, C-001'
                value={customCodes}
                onChange={(e) => setCustomCodes(e.target.value)}
              />
            </div>
            <Button onClick={handleCustom} disabled={customLoading}>
              {customLoading ? <Spinner size="sm" /> : "Atribuir Tarefa"}
            </Button>
            {customFeedback && (
              <p
                className={`text-sm ${
                  customFeedback.type === "error"
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {customFeedback.text}
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Consulta de itens por ID */}
      <Card className="shadow-md">
        <h2 className="mb-3 text-lg font-bold text-gray-800 dark:text-white">
          Consultar Itens de uma Task
        </h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="w-full sm:max-w-xs">
            <Label htmlFor="view-id">ID da Task</Label>
            <TextInput
              id="view-id"
              type="number"
              min={1}
              placeholder="Ex.: 1"
              value={viewTaskId}
              onChange={(e) => setViewTaskId(e.target.value)}
            />
          </div>
          <Button onClick={handleViewItems} disabled={viewLoading}>
            {viewLoading ? <Spinner size="sm" /> : "Buscar Itens"}
          </Button>
        </div>
        {viewFeedback && (
          <p className="mt-3 text-sm text-red-600">{viewFeedback.text}</p>
        )}
      </Card>

      {/* Resultado da geração */}
      {generated && (
        <Card className="shadow-md">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">
              Task #{generated.task.id} gerada
            </h2>
            <Badge color={generated.task.completed ? "success" : "warning"}>
              {generated.task.completed ? "Concluída" : "Pendente"}
            </Badge>
          </div>
          <p className="mb-3 mt-1 text-sm text-gray-500">
            Usuário: {generated.task.user_name} — Quantidade:{" "}
            {generated.task.quantity} — Data:{" "}
            {new Date(generated.task.created_date).toLocaleDateString("pt-BR")}
          </p>
          <Table hoverable className="text-center">
            <TableHead>
              <TableRow>
                <TableHeadCell>Código</TableHeadCell>
                <TableHeadCell>Produto</TableHeadCell>
                <TableHeadCell>Qtd Estoque</TableHeadCell>
                <TableHeadCell>Última Verificação</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {generated.items.map((item) => (
                <TableRow key={item.id} className="bg-white dark:bg-gray-800">
                  <TableCell>{item.code}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>
                    {item.stock_quantity !== null &&
                    item.stock_quantity !== undefined
                      ? (Number(item.stock_quantity) || 0).toLocaleString(
                          "pt-BR",
                        )
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {item.last_verification
                      ? new Date(item.last_verification).toLocaleDateString(
                          "pt-BR",
                        )
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="mt-3 text-xs text-gray-500">
            Para conferir, use a task #{generated.task.id} na página de
            consulta acima ou no app do operador.
          </p>
        </Card>
      )}

      {/* Resultado da atribuição customizada */}
      {customResult && (
        <Card className="shadow-md">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">
              Task #{customResult.task.id} atribuída
            </h2>
            <Badge color={customResult.task.completed ? "success" : "warning"}>
              {customResult.task.completed ? "Concluída" : "Pendente"}
            </Badge>
          </div>
          <p className="mb-3 mt-1 text-sm text-gray-500">
            Usuário: {customResult.task.user_name} — Quantidade:{" "}
            {customResult.task.quantity}
          </p>
          <Table hoverable className="text-center">
            <TableHead>
              <TableRow>
                <TableHeadCell>Código</TableHeadCell>
                <TableHeadCell>Produto</TableHeadCell>
                <TableHeadCell>Qtd Estoque</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {customResult.items.map((item) => (
                <TableRow key={item.id} className="bg-white dark:bg-gray-800">
                  <TableCell>{item.code}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>
                    {item.stock_quantity !== null &&
                    item.stock_quantity !== undefined
                      ? (Number(item.stock_quantity) || 0).toLocaleString(
                          "pt-BR",
                        )
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Modal de exclusão */}
      <Modal
        show={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        size="md"
      >
        <ModalHeader>Excluir Task #{deleteTarget?.id}?</ModalHeader>
        <ModalBody>
          <p className="text-gray-700 dark:text-gray-300">
            A task de <b>{deleteTarget?.user_name}</b>, seus itens e os
            registros de verificação vinculados serão removidos. Os produtos
            voltarão a ser candidatos para novas conferências na filial.
          </p>
          {deleteFeedback && (
            <p
              className={`mt-3 text-sm ${
                deleteFeedback.type === "error"
                  ? "text-red-600"
                  : "text-green-600"
              }`}
            >
              {deleteFeedback.text}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            color="failure"
            onClick={confirmDelete}
            disabled={deleteLoading}
          >
            {deleteLoading ? <Spinner size="sm" /> : "Excluir"}
          </Button>
          <Button color="gray" onClick={() => setDeleteTarget(null)}>
            Cancelar
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal de itens */}
      <Modal
        show={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        size="5xl"
      >
        <ModalHeader>Itens da Task #{viewTaskId}</ModalHeader>
        <ModalBody>
          {viewItems.length === 0 ? (
            <p className="text-gray-500">Nenhum item encontrado.</p>
          ) : (
            <Table hoverable className="text-center">
              <TableHead>
                <TableRow>
                  <TableHeadCell>ID</TableHeadCell>
                  <TableHeadCell>Código</TableHeadCell>
                  <TableHeadCell>Produto</TableHeadCell>
                  <TableHeadCell>Qtd Estoque</TableHeadCell>
                  <TableHeadCell>Qtd Sistema</TableHeadCell>
                  <TableHeadCell>Qtd Real</TableHeadCell>
                  <TableHeadCell>Diferença</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {viewItems.map((item) => (
                  <TableRow
                    key={item.id}
                    className="bg-white dark:bg-gray-800"
                  >
                    <TableCell>{item.id}</TableCell>
                    <TableCell>{item.product_external_id}</TableCell>
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
                      {item.quantity_system !== null
                        ? (Number(item.quantity_system) || 0).toLocaleString(
                            "pt-BR",
                          )
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {item.quantity_real !== null
                        ? (Number(item.quantity_real) || 0).toLocaleString(
                            "pt-BR",
                          )
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {item.difference !== null
                        ? (Number(item.difference) || 0).toLocaleString(
                            "pt-BR",
                          )
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="gray" onClick={() => setViewModalOpen(false)}>
            Fechar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}