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
  Badge,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "flowbite-react";
import {
  HiTrendingUp,
  HiTrendingDown,
  HiMinus,
  HiChartBar,
  HiX,
} from "react-icons/hi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import api, { API_URL } from "../../../api";
import avatar from "../../../static/user.png";

dayjs.locale("pt-br");

interface PontosProps {
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
  return months.reverse();
};

export default function AdminPointsAnalytics() {
  const [users, setUsers] = useState<User[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [viewMode, setViewMode] = useState<"users" | "stores">("users");
  const [showChart, setShowChart] = useState(true);

  // Período 1
  const [p1Start, setP1Start] = useState<Date>(
    dayjs().subtract(30, "day").toDate(),
  );
  const [p1End, setP1End] = useState<Date>(
    dayjs().subtract(16, "day").toDate(),
  );

  // Período 2
  const [p2Start] = useState<Date>(dayjs().subtract(15, "day").toDate());
  const [p2End, setP2End] = useState<Date>(dayjs().toDate());

  // Modal
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userHistory, setUserHistory] = useState<
    Array<{ month: string; points: number }>
  >([]);
  const [openUserModal, setOpenUserModal] = useState(false);

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
      const res = await api.get("/local/");
      setLojas(res.data);
    } catch (err) {
      console.error("Erro ao buscar lojas:", err);
    }
  };

  const fetchUserHistory = async (userId: number) => {
    const history = [];
    const last6Months = months.slice(-6);
    for (const m of last6Months) {
      try {
        const res = await api.get(`/rank/points/${m.value}`);
        const pontos: PontosProps[] = res.data;
        const total = pontos
          .filter((p) => p.user_id === userId)
          .reduce((sum, p) => sum + Number(p.value), 0);
        history.push({ month: m.label, points: total });
      } catch (err) {
        history.push({ month: m.label, points: 0 });
      }
    }
    setUserHistory(history);
  };

  useEffect(() => {
    fetchUsers();
    fetchLojas();
  }, []);

  // Carregar todos os pontos
  const [allPoints, setAllPoints] = useState<PontosProps[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);

  useEffect(() => {
    const loadAllPoints = async () => {
      setLoadingAll(true);
      const points: PontosProps[] = [];
      for (const m of months) {
        try {
          const res = await api.get(`/rank/points/${m.value}`);
          points.push(...res.data);
        } catch (err) {
          console.error(`Erro ao carregar ${m.value}`, err);
        }
      }
      setAllPoints(points);
      setLoadingAll(false);
    };
    loadAllPoints();
  }, []);

  // Validação: p1End >= p1Start
  useEffect(() => {
    if (p1End < p1Start) setP1End(p1Start);
  }, [p1Start, p1End]);

  // Validação: p2End >= p2Start
  useEffect(() => {
    if (p2End < p2Start) setP2End(p2Start);
  }, [p2Start, p2End]);

  // Filtrar pontos por dois períodos
  const { pointsP1, pointsP2 } = useMemo(() => {
    if (loadingAll) return { pointsP1: [], pointsP2: [] };

    const s1 = dayjs(p1Start).startOf("day");
    const e1 = dayjs(p1End).endOf("day");
    const s2 = dayjs(p2Start).startOf("day");
    const e2 = dayjs(p2End).endOf("day");

    const p1: PontosProps[] = [];
    const p2: PontosProps[] = [];

    allPoints.forEach((point) => {
      const ts = dayjs(point.time_stamp);
      if (!ts.isValid()) return;

      if (ts.isAfter(s1) && ts.isBefore(e1)) p1.push(point);
      if (ts.isAfter(s2) && ts.isBefore(e2)) p2.push(point);
    });

    return { pointsP1: p1, pointsP2: p2 };
  }, [allPoints, p1Start, p1End, p2Start, p2End, loadingAll]);

  // Calcular analytics
  const analytics = useMemo(() => {
    const mapP1: Record<number, number> = {};
    const mapP2: Record<number, number> = {};
    const storeP1: Record<number, number> = {};
    const storeP2: Record<number, number> = {};

    pointsP1.forEach((p) => {
      mapP1[p.user_id] = (mapP1[p.user_id] || 0) + Number(p.value);
      storeP1[p.local_id] = (storeP1[p.local_id] || 0) + Number(p.value);
    });

    pointsP2.forEach((p) => {
      mapP2[p.user_id] = (mapP2[p.user_id] || 0) + Number(p.value);
      storeP2[p.local_id] = (storeP2[p.local_id] || 0) + Number(p.value);
    });

    const isUserMode = viewMode === "users";
    const p1Map = isUserMode ? mapP1 : storeP1;
    const p2Map = isUserMode ? mapP2 : storeP2;

    const allKeys = new Set([...Object.keys(p1Map), ...Object.keys(p2Map)]);

    const list = Array.from(allKeys).map((keyStr) => {
      const key = Number(keyStr);
      const p1 = p1Map[key] || 0;
      const p2 = p2Map[key] || 0;
      const percentChange =
        p1 === 0 ? (p2 > 0 ? 100 : 0) : ((p2 - p1) / p1) * 100;

      return {
        id: key,
        name: isUserMode
          ? users.find((u) => u.id === key)?.name || `Usuário #${key}`
          : lojas.find((l) => l.id === key)?.name || `Loja #${key}`,
        p1,
        p2,
        percentChange,
        avatar: isUserMode
          ? users.find((u) => u.id === key)?.profile_photo
          : null,
      };
    });

    const avgP1 =
      Object.values(p1Map).length > 0
        ? Object.values(p1Map).reduce((a, b) => a + b, 0) /
          Object.values(p1Map).length
        : 0;
    const avgP2 =
      Object.values(p2Map).length > 0
        ? Object.values(p2Map).reduce((a, b) => a + b, 0) /
          Object.values(p2Map).length
        : 0;

    return {
      list: list.sort((a, b) => b.p2 - a.p2),
      averages: { p1: avgP1, p2: avgP2 },
    };
  }, [pointsP1, pointsP2, viewMode, users, lojas]);

  // Gráfico
  const chartData = useMemo(() => {
    return analytics.list.map((item) => ({
      name:
        item.name.length > 12 ? item.name.substring(0, 9) + "..." : item.name,
      "Período 1": item.p1,
      "Período 2": item.p2,
    }));
  }, [analytics.list]);

  const handleUserClick = async (userId: number) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    setSelectedUser(user);
    await fetchUserHistory(userId);
    setOpenUserModal(true);
  };

  const getTrendIcon = (percent: number) => {
    if (percent > 0) return <HiTrendingUp className="h-4 w-4 text-green-600" />;
    if (percent < 0) return <HiTrendingDown className="h-4 w-4 text-red-600" />;
    return <HiMinus className="h-4 w-4 text-gray-500" />;
  };

  const getPerformanceBadge = (current: number, avg: number) => {
    if (current > avg * 1.1)
      return (
        <Badge color="success" size="sm">
          Acima
        </Badge>
      );
    if (current < avg * 0.9)
      return (
        <Badge color="failure" size="sm">
          Abaixo
        </Badge>
      );
    return (
      <Badge color="info" size="sm">
        Na média
      </Badge>
    );
  };

  const formatPercent = (val: number) => {
    if (val === 0) return "—";
    const sign = val > 0 ? "+" : "";
    return `${sign}${val.toFixed(1)}%`;
  };

  const formatDate = (date: Date) => dayjs(date).format("DD/MM/YYYY");

  /* ---------- RENDER ---------- */
  return (
    <div className="m-5 flex flex-col items-center gap-6">
      <Card className="w-full max-w-7xl bg-white p-6 shadow-md dark:bg-gray-700">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Análise por Período (Dois Períodos)
          </h2>
          <Button
            size="sm"
            color="gray"
            onClick={() => setShowChart(!showChart)}
            className="flex items-center gap-1"
          >
            {showChart ? (
              <HiX className="h-4 w-4" />
            ) : (
              <HiChartBar className="h-4 w-4" />
            )}
            Gráfico
          </Button>
        </div>

        {/* 4 INPUTS DE DATA */}
        <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Período 1 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Período 1 - Início
            </label>
            <input
              type="date"
              value={dayjs(p1Start).format("YYYY-MM-DD")}
              onChange={(e) => {
                const d = dayjs(e.target.value, "YYYY-MM-DD").toDate();
                setP1Start(d);
              }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Período 1 - Fim
            </label>
            <input
              type="date"
              value={dayjs(p1End).format("YYYY-MM-DD")}
              onChange={(e) => {
                const d = dayjs(e.target.value, "YYYY-MM-DD").toDate();
                setP1Start(d);
              }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          {/* Período 2 */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Período 2 - Início
            </label>
            <input
              type="date"
              value={dayjs(p2Start).format("YYYY-MM-DD")}
              onChange={(e) => {
                const d = dayjs(e.target.value, "YYYY-MM-DD").toDate();
                setP1Start(d);
              }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Período 2 - Fim
            </label>
            <input
              type="date"
              value={dayjs(p2End).format("YYYY-MM-DD")}
              onChange={(e) => {
                const d = dayjs(e.target.value, "YYYY-MM-DD").toDate();
                setP1Start(d);
              }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        {/* Exibição dos períodos */}
        <div className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          <p>
            <strong>Período 1:</strong> {formatDate(p1Start)} →{" "}
            {formatDate(p1End)}
          </p>
          <p>
            <strong>Período 2:</strong> {formatDate(p2Start)} →{" "}
            {formatDate(p2End)}
          </p>
        </div>

        {/* Botões de modo */}
        <div className="mb-6 flex gap-2">
          <Button
            size="sm"
            color={viewMode === "users" ? "purple" : "gray"}
            onClick={() => setViewMode("users")}
          >
            Usuários
          </Button>
          <Button
            size="sm"
            color={viewMode === "stores" ? "teal" : "gray"}
            onClick={() => setViewMode("stores")}
          >
            Lojas
          </Button>
        </div>

        {loadingAll ? (
          <div className="my-10 flex justify-center">
            <Spinner size="xl" />
            <span className="ml-3">Carregando todos os pontos...</span>
          </div>
        ) : (
          <>
            {/* GRÁFICO */}
            {showChart && (
              <div className="mt-6 overflow-x-auto rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                <h3 className="mb-3 text-lg font-semibold text-gray-800 dark:text-gray-200">
                  Todos os {viewMode === "users" ? "Usuários" : "Lojas"}
                </h3>
                {chartData.length > 0 ? (
                  <div
                    style={{
                      width: `${Math.max(800, chartData.length * 60)}px`,
                      height: 400,
                    }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 40, bottom: 100 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          angle={-45}
                          textAnchor="end"
                          height={100}
                          interval={0}
                        />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Período 1" fill="#8b5cf6" />
                        <Bar dataKey="Período 2" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-center text-gray-500">
                    Nenhum dado nos períodos.
                  </p>
                )}
              </div>
            )}

            {/* MÉDIAS */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Período 1
                </p>
                <p className="text-2xl font-bold text-gray-800 dark:text-white">
                  {analytics.averages.p1.toFixed(0)} pts
                </p>
              </Card>
              <Card className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Período 2
                </p>
                <p className="text-2xl font-bold text-gray-800 dark:text-white">
                  {analytics.averages.p2.toFixed(0)} pts
                </p>
              </Card>
              <Card className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Variação
                </p>
                <p
                  className={`flex items-center justify-center gap-1 text-2xl font-bold ${analytics.averages.p2 > analytics.averages.p1 ? "text-green-600" : "text-red-600"}`}
                >
                  {getTrendIcon(analytics.averages.p2 - analytics.averages.p1)}
                  {formatPercent(
                    ((analytics.averages.p2 - analytics.averages.p1) /
                      (analytics.averages.p1 || 1)) *
                      100,
                  )}
                </p>
              </Card>
            </div>

            {/* TABELA */}
            <div className="mt-6 overflow-x-auto">
              <Table hoverable striped>
                <TableHead>
                  <TableHeadCell>
                    {viewMode === "users" ? "Usuário" : "Loja"}
                  </TableHeadCell>
                  <TableHeadCell className="text-center">
                    Período 1
                  </TableHeadCell>
                  <TableHeadCell className="text-center">
                    Período 2
                  </TableHeadCell>
                  <TableHeadCell className="text-center">
                    Variação
                  </TableHeadCell>
                  <TableHeadCell className="text-center">
                    Desempenho
                  </TableHeadCell>
                </TableHead>
                <TableBody>
                  {analytics.list.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                      onClick={() =>
                        viewMode === "users" && handleUserClick(item.id)
                      }
                    >
                      <TableCell className="flex items-center gap-3 font-medium">
                        {viewMode === "users" && (
                          <Avatar
                            size="sm"
                            rounded
                            img={
                              item.avatar ? `${API_URL}/${item.avatar}` : avatar
                            }
                          />
                        )}
                        <span className="max-w-xs truncate">{item.name}</span>
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {item.p1}
                      </TableCell>
                      <TableCell className="text-center font-mono font-semibold">
                        {item.p2}
                      </TableCell>
                      <TableCell className="text-center">
                        <div
                          className={`flex items-center justify-center gap-1 font-medium ${item.percentChange > 0 ? "text-green-600" : item.percentChange < 0 ? "text-red-600" : "text-gray-500"}`}
                        >
                          {getTrendIcon(item.percentChange)}
                          <span>{formatPercent(item.percentChange)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {getPerformanceBadge(item.p2, analytics.averages.p2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      {/* MODAL DO USUÁRIO */}
      <Modal
        show={openUserModal}
        onClose={() => setOpenUserModal(false)}
        size="6xl"
      >
        <ModalHeader>
          <div className="flex items-center gap-3">
            <Avatar
              img={
                selectedUser?.profile_photo
                  ? `${API_URL}/${selectedUser.profile_photo}`
                  : avatar
              }
              rounded
              size="md"
            />
            <div>
              <p className="text-xl font-semibold">{selectedUser?.name}</p>
              <p className="text-sm text-gray-500">
                Evolução nos últimos 6 meses
              </p>
            </div>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={userHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="points"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => setOpenUserModal(false)}>Fechar</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
