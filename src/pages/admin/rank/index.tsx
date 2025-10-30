import { useEffect, useState, useMemo } from "react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import {
  Card,
  Table,
  Spinner,
  TableHead,
  TableHeadCell,
  TableBody,
  TableCell,
  TableRow,
  Avatar,
  Modal,
  Button,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
} from "flowbite-react";
import { HiCalendar, HiOfficeBuilding, HiUserGroup } from "react-icons/hi";
import api, { API_URL } from "../../../api";
import avatar from "../../../static/user.png";

dayjs.locale("pt-br");

/* ---------- TIPOS ---------- */
export interface PontosProps {
  user_id: number;
  id: number;
  action_id: number;
  local_id: number;
  value: number;
  time_stamp: string;
  name: string;
  product_code: number;
}
interface User {
  id: number;
  name: string;
  username: string;
  profile_photo: string | null;
}
interface Loja {
  id: number;
  name: string;
}

/* ---------- FUNÇÃO DE MESES ---------- */
const generateLast12Months = () => {
  const months: { label: string; value: string }[] = [];
  const now = dayjs();
  for (let i = 0; i < 12; i++) {
    const d = now.subtract(i, "month");
    months.push({
      label: d.format("MMMM [de] YYYY"),
      value: d.format("YYYY-MM"),
    });
  }
  return months;
};

/* ---------- COMPONENTE PRINCIPAL ---------- */
export default function AdminPoints() {
  const [pontos, setPontos] = useState<PontosProps[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLojas, setLoadingLojas] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    dayjs().format("YYYY-MM"),
  );
  const [viewMode, setViewMode] = useState<"users" | "stores">("users");

  // Detalhes do usuário
  const [selectedUser, setSelectedUser] = useState<PontosProps[] | null>(null);
  const [openModal, setOpenModal] = useState(false);

  // Detalhes da loja + ranking interno
  const [selectedStore, setSelectedStore] = useState<{
    local_id: number;
    name: string;
    totalPoints: number;
    pointsByType: Record<string, number>;
  } | null>(null);
  const [openStoreModal, setOpenStoreModal] = useState(false);

  const months = generateLast12Months();

  /* ---------- FETCHES ---------- */
  const fetchUsers = async () => {
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data);
    } catch (err) {
      console.error("Erro ao buscar usuários:", err);
    }
  };

  const fetchLojas = async () => {
    try {
      setLoadingLojas(true);
      const res = await api.get("/local/");
      setLojas(res.data);
    } catch (err) {
      console.error("Erro ao buscar lojas:", err);
    } finally {
      setLoadingLojas(false);
    }
  };

  const fetchPoints = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/rank/points/${selectedMonth}`);
      setPontos(res.data);
    } catch (err) {
      console.error("Erro ao buscar pontos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchLojas();
    fetchPoints();
  }, [selectedMonth]);

  /* ---------- MAPEAMENTOS ---------- */
  const usersMap = users.reduce((acc: Record<number, User>, u) => {
    acc[u.id] = u;
    return acc;
  }, {});

  const lojasMap = lojas.reduce((acc: Record<number, string>, loja) => {
    acc[loja.id] = loja.name;
    return acc;
  }, {});

  /* ---------- RANKING LOJAS ---------- */
  const rankingLojas = useMemo(() => {
    const grouped = pontos.reduce(
      (
        acc: Record<
          number,
          {
            local_id: number;
            name: string;
            totalPoints: number;
            pointsByType: Record<string, number>;
          }
        >,
        p,
      ) => {
        if (!acc[p.local_id]) {
          acc[p.local_id] = {
            local_id: p.local_id,
            name: lojasMap[p.local_id] || `Loja #${p.local_id}`,
            totalPoints: 0,
            pointsByType: {},
          };
        }
        acc[p.local_id].totalPoints += Number(p.value) || 0;
        if (!acc[p.local_id].pointsByType[p.name])
          acc[p.local_id].pointsByType[p.name] = 0;
        acc[p.local_id].pointsByType[p.name] += Number(p.value) || 0;
        return acc;
      },
      {},
    );
    return Object.values(grouped).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [pontos, lojasMap]);

  const maxPointsLoja = Math.max(...rankingLojas.map((r) => r.totalPoints), 1);

  /* ---------- RANKING USUÁRIOS ---------- */
  const rankingUsuarios = useMemo(() => {
    const grouped = pontos.reduce(
      (
        acc: Record<
          number,
          {
            user_id: number;
            name: string;
            totalPoints: number;
            pointsByType: Record<string, number>;
          }
        >,
        p,
      ) => {
        if (!acc[p.user_id]) {
          const u = usersMap[p.user_id];
          acc[p.user_id] = {
            user_id: p.user_id,
            name: u ? u.name : `Usuário #${p.user_id}`,
            totalPoints: 0,
            pointsByType: {},
          };
        }
        acc[p.user_id].totalPoints += Number(p.value) || 0;
        if (!acc[p.user_id].pointsByType[p.name])
          acc[p.user_id].pointsByType[p.name] = 0;
        acc[p.user_id].pointsByType[p.name] += Number(p.value) || 0;
        return acc;
      },
      {},
    );
    return Object.values(grouped).sort((a, b) => b.totalPoints - a.totalPoints);
  }, [pontos, usersMap]);

  const maxPointsUsuario = Math.max(
    ...rankingUsuarios.map((r) => r.totalPoints),
    1,
  );

  /* ---------- DETALHES DO USUÁRIO ---------- */
  const handleUserDetails = (user_id: number) => {
    const userPoints = pontos
      .filter((p) => p.user_id === user_id)
      .sort(
        (a, b) => dayjs(b.time_stamp).valueOf() - dayjs(a.time_stamp).valueOf(),
      )
      .slice(0, 20);
    setSelectedUser(userPoints);
    setOpenModal(true);
  };

  /* ---------- DETALHES DA LOJA (com ranking interno) ---------- */
  const handleStoreDetails = (local_id: number) => {
    const storeData = rankingLojas.find((l) => l.local_id === local_id);
    if (!storeData) return;

    setSelectedStore(storeData);
    setOpenStoreModal(true);
  };

  // Ranking interno da loja
  const rankingInternoLoja = useMemo(() => {
    if (!selectedStore) return [];

    const usersInStore = pontos
      .filter((p) => p.local_id === selectedStore.local_id)
      .reduce(
        (
          acc: Record<
            number,
            {
              user_id: number;
              name: string;
              totalPoints: number;
              pointsByType: Record<string, number>;
            }
          >,
          p,
        ) => {
          if (!acc[p.user_id]) {
            const u = usersMap[p.user_id];
            acc[p.user_id] = {
              user_id: p.user_id,
              name: u ? u.name : `Usuário #${p.user_id}`,
              totalPoints: 0,
              pointsByType: {},
            };
          }
          acc[p.user_id].totalPoints += Number(p.value) || 0;
          if (!acc[p.user_id].pointsByType[p.name])
            acc[p.user_id].pointsByType[p.name] = 0;
          acc[p.user_id].pointsByType[p.name] += Number(p.value) || 0;
          return acc;
        },
        {},
      );

    return Object.values(usersInStore).sort(
      (a, b) => b.totalPoints - a.totalPoints,
    );
  }, [selectedStore, pontos, usersMap]);

  const maxPointsInterno = Math.max(
    ...rankingInternoLoja.map((u) => u.totalPoints),
    1,
  );

  /* ---------- RENDER ---------- */
  return (
    <div className="m-5 flex flex-col items-center gap-6">
      {/* CABEÇALHO + FILTRO */}
      <Card className="w-full max-w-4xl bg-white p-6 shadow-md dark:bg-gray-700">
        <h2 className="mb-4 text-3xl font-bold text-gray-900 dark:text-white">
          Sistema de Pontos — Admin
        </h2>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <HiCalendar className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            <Select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label.charAt(0).toUpperCase() + m.label.slice(1)}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              color={viewMode === "users" ? "purple" : "gray"}
              onClick={() => setViewMode("users")}
              className="flex items-center gap-1 transition-all"
            >
              <HiUserGroup className="h-4 w-4" />
              Usuários
            </Button>
            <Button
              size="sm"
              color={viewMode === "stores" ? "teal" : "gray"}
              onClick={() => setViewMode("stores")}
              className="flex items-center gap-1 transition-all"
            >
              <HiOfficeBuilding className="h-4 w-4" />
              Lojas
            </Button>
          </div>
        </div>
      </Card>

      {/* ------------------- RANKING DINÂMICO ------------------- */}
      {viewMode === "stores" ? (
        /* ==== RANKING DE LOJAS ==== */
        <Card className="w-full bg-gradient-to-br from-teal-50 to-cyan-50 p-6 shadow-lg dark:bg-gray-800 dark:from-teal-900 dark:to-cyan-900">
          <h3 className="mb-4 text-xl font-semibold text-teal-800 dark:text-teal-100">
            Ranking por Loja (
            {months.find((m) => m.value === selectedMonth)?.label})
          </h3>

          {loading || loadingLojas ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner size="xl" />
            </div>
          ) : rankingLojas.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rankingLojas.map((loja, idx) => {
                const percentage = (loja.totalPoints / maxPointsLoja) * 100;
                return (
                  <div
                    key={loja.local_id}
                    className="relative flex flex-col rounded-xl bg-white p-5 shadow-md transition-all duration-300 hover:shadow-xl dark:bg-gray-700"
                  >
                    <div className="absolute -top-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-sm font-bold text-white shadow-lg">
                      #{idx + 1}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100 text-2xl font-medium dark:bg-teal-800">
                        {loja.local_id}
                      </div>
                      <div className="flex-1">
                        <p className="truncate font-semibold text-gray-800 dark:text-white">
                          {loja.name}
                        </p>
                        <p className="text-xl font-bold text-teal-600 dark:text-teal-400">
                          {loja.totalPoints} pts
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 transition-all duration-700"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Object.entries(loja.pointsByType).map(
                        ([type, value]) => (
                          <span
                            key={type}
                            className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-medium text-teal-800 dark:bg-teal-900 dark:text-teal-200"
                          >
                            {type}: {value}
                          </span>
                        ),
                      )}
                    </div>

                    <Button
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => handleStoreDetails(loja.local_id)}
                    >
                      Ver Ranking Interno
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-gray-500">
              Nenhuma loja com pontos neste mês.
            </p>
          )}
        </Card>
      ) : (
        /* ==== RANKING DE USUÁRIOS ==== */
        <Card className="w-full bg-gray-100 p-6 shadow-lg dark:bg-gray-800">
          <h3 className="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-100">
            Ranking por Usuário (
            {months.find((m) => m.value === selectedMonth)?.label})
          </h3>

          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner size="xl" />
            </div>
          ) : rankingUsuarios.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {rankingUsuarios.map((rank, idx) => {
                const user = usersMap[rank.user_id];
                const percentage = (rank.totalPoints / maxPointsUsuario) * 100;
                return (
                  <div
                    key={rank.user_id}
                    className="relative flex flex-col rounded-xl bg-white p-5 shadow-md transition-all duration-300 hover:shadow-2xl dark:bg-gray-700"
                  >
                    <div className="absolute -top-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-lg">
                      #{idx + 1}
                    </div>

                    <div className="flex items-center gap-3">
                      <Avatar
                        alt={rank.name}
                        img={
                          user?.profile_photo
                            ? `${API_URL}/${user.profile_photo}`
                            : avatar
                        }
                        rounded
                        size="md"
                        className="ring-2 ring-indigo-200 dark:ring-indigo-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-800 dark:text-white">
                          {rank.name}
                        </p>
                        <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                          {rank.totalPoints} pts
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-700"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Object.entries(rank.pointsByType).map(
                        ([type, value]) => (
                          <span
                            key={type}
                            className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          >
                            {type}: {value}
                          </span>
                        ),
                      )}
                    </div>

                    <Button
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => handleUserDetails(rank.user_id)}
                    >
                      Ver Detalhes
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-gray-500">
              Nenhum usuário com pontos neste mês.
            </p>
          )}
        </Card>
      )}

      {/* ------------------- MODAL USUÁRIO ------------------- */}
      <Modal show={openModal} onClose={() => setOpenModal(false)} size="5xl">
        <ModalHeader>
          {selectedUser && selectedUser.length > 0
            ? usersMap[selectedUser[0].user_id]?.name
            : "Detalhes do usuário"}
        </ModalHeader>
        <ModalBody>
          {selectedUser && selectedUser.length > 0 ? (
            <div className="overflow-x-auto">
              <Table hoverable striped>
                <TableHead>
                  <TableHeadCell>Tipo de ponto</TableHeadCell>
                  <TableHeadCell>Produto / Local</TableHeadCell>
                  <TableHeadCell>Local ID</TableHeadCell>
                  <TableHeadCell>Pontos</TableHeadCell>
                  <TableHeadCell>Data</TableHeadCell>
                </TableHead>
                <TableBody>
                  {selectedUser.map((ponto) => (
                    <TableRow key={ponto.id}>
                      <TableCell>{ponto.name}</TableCell>
                      <TableCell>{ponto.product_code}</TableCell>
                      <TableCell>
                        {lojasMap[ponto.local_id] || `Loja #${ponto.local_id}`}
                      </TableCell>
                      <TableCell className="font-semibold text-green-600">
                        +{ponto.value}
                      </TableCell>
                      <TableCell>
                        {dayjs(ponto.time_stamp).format("DD/MM/YYYY HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p>Nenhum ponto registrado neste mês.</p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => setOpenModal(false)}>Fechar</Button>
        </ModalFooter>
      </Modal>

      {/* ------------------- MODAL LOJA (RANK INTERNO) ------------------- */}
      <Modal
        show={openStoreModal}
        onClose={() => setOpenStoreModal(false)}
        size="6xl"
      >
        <ModalHeader>{selectedStore?.name} — Ranking Interno</ModalHeader>
        <ModalBody>
          {selectedStore && rankingInternoLoja.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rankingInternoLoja.map((user, idx) => {
                const percentage = (user.totalPoints / maxPointsInterno) * 100;
                const avatarUser = usersMap[user.user_id];
                return (
                  <div
                    key={user.user_id}
                    className="relative flex flex-col rounded-xl bg-white p-5 shadow-md transition-all duration-300 hover:shadow-xl dark:bg-gray-700"
                  >
                    <div className="absolute -top-3 -right-3 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-sm font-bold text-white shadow-lg">
                      #{idx + 1}
                    </div>

                    <div className="flex items-center gap-3">
                      <Avatar
                        alt={user.name}
                        img={
                          avatarUser?.profile_photo
                            ? `${API_URL}/${avatarUser.profile_photo}`
                            : avatar
                        }
                        rounded
                        size="md"
                        className="ring-2 ring-teal-200 dark:ring-teal-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-gray-800 dark:text-white">
                          {user.name}
                        </p>
                        <p className="text-xl font-bold text-teal-600 dark:text-teal-400">
                          {user.totalPoints} pts
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 transition-all duration-700"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Object.entries(user.pointsByType).map(
                        ([type, value]) => (
                          <span
                            key={type}
                            className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-medium text-teal-800 dark:bg-teal-900 dark:text-teal-200"
                          >
                            {type}: {value}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-gray-500">
              Nenhum usuário com pontos nesta loja no mês selecionado.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => setOpenStoreModal(false)}>Fechar</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
