import { useEffect, useState, useMemo } from "react";
import dayjs from "dayjs";
import {
  Card,
  Avatar,
  Button,
  Select,
  Spinner,
  Badge,
  Progress,
  Modal,
  ModalBody,
  ModalHeader,
} from "flowbite-react";
import api, { API_URL } from "../../../api";
import { useAuthStore } from "../../authStore";
import avatarFallback from "../../../static/user.png";

interface User {
  id: number;
  name: string;
  username: string;
  profile_photo: string | null;
  admin: number;
}

interface Target {
  id: number;
  moth: string;
  quantity: number;
  completed: boolean;
  user_id: number;
  user_name: string;
}

interface Conferencia {
  id: number;
  created_by: string;
  created_date: string;
}

export default function CreateTargetConference() {
  const user = useAuthStore((state) => state.user);

  const [moth, setMoth] = useState(dayjs().format("YYYY-MM"));
  const [quantity, setQuantity] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [userId, setUserId] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [conferencias, setConferencias] = useState<Conferencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [applyToAll, setApplyToAll] = useState(false);
  const [openModal, setOpenModal] = useState(false); // modal visibilidade
  const [filterMonth, setFilterMonth] = useState(dayjs().format("YYYY-MM")); // filtro mês

  // FETCH USERS
  useEffect(() => {
    if (!user?.admin) return;
    api.get("/admin/users").then((res) => setUsers(res.data));
  }, [user]);

  // FETCH TARGETS
  const fetchTargets = async () => {
    try {
      const res = await api.get(`/target/conference/${filterMonth}`);
      setTargets(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTargets();
  }, [filterMonth]);

  // FETCH CONFERENCIAS
  useEffect(() => {
    const fetchConfs = async () => {
      try {
        const res = await api.get("/conference/");
        setConferencias(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchConfs();
  }, []);

  // SUBMIT FORM
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.admin) {
      setMessage("Apenas administradores podem cadastrar metas.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const payload = {
        moth,
        quantity: Number(quantity),
        completed,
      };

      if (applyToAll) {
        for (const u of users) {
          await api.post("/target/conference", { ...payload, user_id: u.id });
        }
      } else {
        if (!userId) {
          setMessage("Selecione um usuário ou marque 'Aplicar para todos'.");
          setLoading(false);
          return;
        }
        await api.post("/target/conference", {
          ...payload,
          user_id: Number(userId),
        });
      }

      setMessage("Meta cadastrada com sucesso!");
      setQuantity(0);
      setCompleted(false);
      setUserId("");
      setApplyToAll(false);
      setOpenModal(false);
      fetchTargets();
    } catch (err) {
      console.error(err);
      setMessage(err.response?.data?.detail || "Erro ao cadastrar meta.");
    } finally {
      setLoading(false);
    }
  };

  const targetsGrouped: Record<number, Target[]> = useMemo(() => {
    const grouped: Record<number, Target[]> = {};
    targets.forEach((t) => {
      if (!grouped[t.user_id]) grouped[t.user_id] = [];
      grouped[t.user_id].push(t);
    });
    return grouped;
  }, [targets]);

  return (
    <div className="m-5 flex flex-col gap-8 rounded-2xl p-3 dark:bg-gray-800">
      {/* TOPO: Botão cadastrar e filtro mês */}
      <div className="mb-4 flex flex-col items-center justify-between gap-4 sm:flex-row dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <label className="font-medium text-gray-700 dark:text-gray-300">
            Filtrar por mês:
          </label>
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="rounded border px-2 py-1 focus:ring focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <Button onClick={() => setOpenModal(true)}>Cadastrar Meta</Button>
      </div>

      {/* MODAL DE CADASTRO */}
      <Modal
        show={openModal}
        size="md"
        popup
        onClose={() => setOpenModal(false)}
      >
        <div className="relative p-6">
          {/* Botão de fechar */}
          <button
            type="button"
            onClick={() => setOpenModal(false)}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <h2 className="mb-6 text-center text-2xl font-bold text-gray-800 dark:text-white">
            Cadastrar Meta de Conferência
          </h2>

          <form
            className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2"
            onSubmit={handleSubmit}
          >
            <div>
              <label className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
                Mês
              </label>
              <input
                type="month"
                value={moth}
                onChange={(e) => setMoth(e.target.value)}
                className="w-full rounded border px-2 py-1 focus:ring focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
                Quantidade
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full rounded border px-2 py-1 focus:ring focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                min={0}
                required
              />
            </div>

            <div className="mt-2 flex items-center">
              <label className="inline-flex items-center font-medium text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={completed}
                  onChange={(e) => setCompleted(e.target.checked)}
                  className="mr-2"
                />
                Concluído
              </label>
            </div>

            <div>
              <label className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
                Usuário
              </label>
              <Select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                disabled={applyToAll}
                className="dark:bg-gray-700 dark:text-white"
              >
                <option value="">Selecione um usuário</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.username})
                  </option>
                ))}
              </Select>

              <label className="mt-2 inline-flex items-center font-medium text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={applyToAll}
                  onChange={(e) => setApplyToAll(e.target.checked)}
                  className="mr-2"
                />
                Aplicar para todos
              </label>
            </div>

            <div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Spinner size="sm" /> : "Cadastrar"}
              </Button>
            </div>
          </form>

          {message && <p className="mt-4 text-red-600">{message}</p>}
        </div>
      </Modal>

      {/* CARDS DE USUÁRIOS */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {users.map((u) => {
          const userTargets = targetsGrouped[u.id] || [];

          return (
            <Card
              key={u.id}
              className="p-5 shadow-md transition-all duration-200 hover:shadow-lg"
            >
              <div className="mb-4 flex items-center gap-4">
                <Avatar
                  img={
                    u.profile_photo
                      ? `${API_URL}/${u.profile_photo}`
                      : avatarFallback
                  }
                  rounded
                  size="md"
                  className="ring-2 ring-indigo-200"
                />
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white">
                    {u.name}
                  </p>
                  <p className="text-sm text-gray-500">{u.username}</p>
                </div>
              </div>

              {userTargets.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-300">
                  Nenhuma meta cadastrada.
                </p>
              ) : (
                <div className="space-y-4">
                  {userTargets.map((t) => {
                    const confsNoMes = conferencias.filter(
                      (c) =>
                        c.created_by === u.name &&
                        dayjs(c.created_date).format("YYYY-MM") ===
                          dayjs(t.moth).format("YYYY-MM"),
                    ).length;

                    const percent = t.quantity
                      ? Math.min((confsNoMes / t.quantity) * 100, 100)
                      : 0;

                    return (
                      <div
                        key={t.id}
                        className="flex flex-col rounded bg-gray-50 p-3 shadow-inner dark:bg-gray-700"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {dayjs(t.moth).format("MMMM/YYYY")}
                          </span>
                          <Badge
                            className="m-1"
                            color={t.completed ? "success" : "failure"}
                            size="sm"
                          >
                            {t.completed ? "Concluído" : "Pendente"}
                          </Badge>
                        </div>

                        <div className="mb-1 flex items-center justify-between text-gray-700 dark:text-gray-300">
                          <span>Meta: {t.quantity}</span>
                          <span>Feito: {confsNoMes}</span>
                        </div>

                        <Progress
                          progress={percent}
                          color={percent === 100 ? "success" : "blue"}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
