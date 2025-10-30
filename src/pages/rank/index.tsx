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
  Select,
  Badge,
} from "flowbite-react";
import { HiTrendingUp, HiUser, HiClock } from "react-icons/hi";
import { HiTrophy } from "react-icons/hi2";
import { FaMedal } from "react-icons/fa";
import api, { API_URL } from "../../api";
import { useAuthStore } from "../authStore";
import avatar from "../../static/user.png";

dayjs.locale("pt-br");

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

function PointsComponente() {
  const [pontos, setPontos] = useState<PontosProps[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    dayjs().format("YYYY-MM"),
  );
  // Mês padrão do histórico = atual
  const [filterMonth, setFilterMonth] = useState<string>(() =>
    dayjs().format("YYYY-MM"),
  );
  const { user } = useAuthStore();
  const months = generateLast12Months();

  const handlePoints = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/rank/points/${selectedMonth}`);
      setPontos(response.data);
    } catch (error) {
      console.error("Erro ao buscar pontos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handlePoints();
  }, [selectedMonth]);

  /* ---------- DADOS DO USUÁRIO ---------- */
  const pontosDoUsuario = useMemo(
    () => pontos.filter((p) => p.user_id === user?.id),
    [pontos, user?.id],
  );

  const pontosFiltrados = useMemo(() => {
    if (filterMonth === "todos") return pontosDoUsuario;
    return pontosDoUsuario.filter((p) =>
      dayjs(p.time_stamp).isSame(filterMonth, "month"),
    );
  }, [pontosDoUsuario, filterMonth]);

  const totalPontos = useMemo(
    () => pontosFiltrados.reduce((acc, p) => acc + (Number(p.value) || 0), 0),
    [pontosFiltrados],
  );

  const ultimos5 = useMemo(
    () =>
      [...pontosDoUsuario]
        .sort(
          (a, b) =>
            dayjs(b.time_stamp).valueOf() - dayjs(a.time_stamp).valueOf(),
        )
        .slice(0, 5),
    [pontosDoUsuario],
  );

  /* ---------- RANKING GERAL ---------- */
  const ranking = useMemo(() => {
    const grouped = pontos
      .filter((p) => dayjs(p.time_stamp).isSame(selectedMonth, "month"))
      .reduce(
        (
          acc: {
            [key: number]: {
              user_id: number;
              name: string;
              totalPoints: number;
            };
          },
          p,
        ) => {
          if (!acc[p.user_id]) {
            acc[p.user_id] = {
              user_id: p.user_id,
              name: `Usuário ${p.user_id}`,
              totalPoints: 0,
            };
          }
          acc[p.user_id].totalPoints += Number(p.value) || 0;
          return acc;
        },
        {},
      );

    return Object.values(grouped)
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((r, idx) => ({ ...r, position: idx + 1 }));
  }, [pontos, selectedMonth]);

  const maxPoints = Math.max(...ranking.map((r) => r.totalPoints), 1);

  const getMedalIcon = (position: number) => {
    if (position === 1) return <FaMedal className="h-5 w-5 text-yellow-500" />;
    if (position === 2) return <FaMedal className="h-5 w-5 text-gray-400" />;
    if (position === 3) return <FaMedal className="h-5 w-5 text-orange-600" />;
    return null;
  };

  return (
    <div className="m-3 rounded-2xl py-8 opacity-98 dark:bg-gray-600">
      <div className="mx-auto max-w-7xl px-4">
        <h1 className="mb-8 text-center text-3xl font-bold text-gray-800 dark:text-white">
          Sistema de Pontos
        </h1>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ========== PAINEL DO USUÁRIO ========== */}
          <div className="space-y-6">
            {/* Total de Pontos */}
            <Card className="transform bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-xl transition-all hover:scale-105">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium opacity-90">
                    Seus Pontos
                  </h3>
                  <p className="mt-1 text-5xl font-extrabold tracking-tight">
                    {totalPontos}
                  </p>
                </div>
                <HiTrendingUp className="h-14 w-14 opacity-30" />
              </div>
            </Card>

            {/* Últimos 5 Pontos */}
            <Card className="p-5 shadow-lg">
              <div className="mb-4 flex items-center gap-2">
                <HiTrophy className="h-6 w-6 text-yellow-500" />
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                  Últimos Pontos
                </h3>
              </div>

              {loading ? (
                <div className="flex h-32 items-center justify-center">
                  <Spinner size="lg" />
                </div>
              ) : ultimos5.length > 0 ? (
                <div className="space-y-3">
                  {ultimos5.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-700"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
                          {dayjs(p.time_stamp).format("DD MMM")}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800 dark:text-white">
                            {p.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            Produto: {p.product_code}
                          </p>
                        </div>
                      </div>
                      <Badge color="success" size="sm" className="font-bold">
                        +{p.value}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-gray-500">
                  Nenhum ponto registrado.
                </p>
              )}
            </Card>
          </div>

          {/* ========== RANKING GERAL ========== */}
          <div className="lg:col-span-2">
            <Card className="p-6 shadow-xl">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HiUser className="h-6 w-6 text-indigo-600" />
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                    Ranking do Mês
                  </h3>
                </div>
                <Select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-48 text-sm"
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label.charAt(0).toUpperCase() + m.label.slice(1)}
                    </option>
                  ))}
                </Select>
              </div>

              {ranking.length > 0 ? (
                <div className="space-y-4">
                  {ranking.slice(0, 10).map((rank) => {
                    const isUser = rank.user_id === user?.id;
                    const medal = getMedalIcon(rank.position);
                    const percentage = (rank.totalPoints / maxPoints) * 100;

                    return (
                      <div
                        key={rank.user_id}
                        className={`flex items-center gap-3 rounded-xl p-3 transition-all ${
                          isUser
                            ? "bg-gradient-to-r from-emerald-50 to-teal-50 ring-2 ring-emerald-400 dark:from-emerald-900 dark:to-teal-900"
                            : "bg-gray-50 dark:bg-gray-700"
                        }`}
                      >
                        <div className="flex flex-1 items-center gap-2">
                          {medal ? (
                            medal
                          ) : (
                            <span className="w-5 text-center text-sm font-bold text-gray-500">
                              #{rank.position}
                            </span>
                          )}
                          <Avatar
                            img={
                              isUser && user?.profile_photo
                                ? `${API_URL}/${user.profile_photo}`
                                : avatar
                            }
                            rounded
                            size="sm"
                            className="ring-2 ring-gray-300 dark:ring-gray-600"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-800 dark:text-white">
                              {isUser ? "Você" : `Usuário ${rank.user_id}`}
                            </p>
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
                                <div
                                  className="h-full rounded-full transition-all duration-700"
                                  style={{
                                    width: `${percentage}%`,
                                    backgroundColor: isUser
                                      ? "#10b981"
                                      : "#6366f1",
                                  }}
                                />
                              </div>
                              <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                {rank.totalPoints} pts
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-gray-500">
                  Nenhum ponto registrado neste mês.
                </p>
              )}
            </Card>
          </div>
        </div>

        {/* ========== HISTÓRICO COMPLETO (com scroll) ========== */}
        <div className="mt-8">
          <Card className="p-6 shadow-xl">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <HiClock className="h-6 w-6 text-purple-600" />
                <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                  Histórico Completo de Pontos
                </h3>
              </div>
              <Select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full text-sm sm:w-48"
              >
                <option value="todos">Todos os meses</option>
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label.charAt(0).toUpperCase() + m.label.slice(1)}
                  </option>
                ))}
              </Select>
            </div>

            {pontosFiltrados.length > 0 ? (
              <div className="overflow-x-auto">
                {/* Scroll vertical com altura máxima */}
                <div className="scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-gray-800 max-h-96 overflow-y-auto">
                  <Table hoverable striped className="min-w-full">
                    <TableHead>
                      <TableHeadCell className="sticky top-0 bg-gray-50 text-xs font-semibold text-gray-600 uppercase dark:bg-gray-800">
                        Data
                      </TableHeadCell>
                      <TableHeadCell className="sticky top-0 bg-gray-50 text-xs font-semibold text-gray-600 uppercase dark:bg-gray-800">
                        Ação
                      </TableHeadCell>
                      <TableHeadCell className="sticky top-0 bg-gray-50 text-xs font-semibold text-gray-600 uppercase dark:bg-gray-800">
                        Produto
                      </TableHeadCell>
                      <TableHeadCell className="sticky top-0 bg-gray-50 text-xs font-semibold text-gray-600 uppercase dark:bg-gray-800">
                        Pontos
                      </TableHeadCell>
                    </TableHead>
                    <TableBody>
                      {pontosFiltrados
                        .sort(
                          (a, b) =>
                            dayjs(b.time_stamp).valueOf() -
                            dayjs(a.time_stamp).valueOf(),
                        )
                        .map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="text-sm">
                              {dayjs(p.time_stamp).format("DD/MM/YYYY HH:mm")}
                            </TableCell>
                            <TableCell className="text-sm font-medium">
                              {p.name}
                            </TableCell>
                            <TableCell className="text-sm">
                              {p.product_code}
                            </TableCell>
                            <TableCell>
                              <Badge
                                color="success"
                                size="sm"
                                className="font-bold"
                              >
                                +{p.value}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-gray-500">
                Nenhum ponto encontrado para o filtro selecionado.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function IndexPoints() {
  return <PointsComponente />;
}
