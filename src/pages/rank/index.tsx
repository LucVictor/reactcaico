import { useEffect, useState } from "react";
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
} from "flowbite-react";
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

interface RankingProps {
  user_id: number;
  name: string;
  totalPoints: number;
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
  return months;
};

function PointsComponente() {
  const [pontos, setPontos] = useState<PontosProps[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
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

  // Filtrar pontos do usuário logado
  const pontosDoUsuario = pontos.filter((p) => p.user_id === user?.id);

  // Filtrar pontos do mês selecionado
  const pontosFiltrados = pontosDoUsuario.filter((p) =>
    dayjs(p.time_stamp).isSame(selectedMonth, "month"),
  );

  // Total de pontos do usuário
  const totalPontos = pontosFiltrados.reduce(
    (acc, p) => acc + (Number(p.value) || 0),
    0,
  );

  // Últimos 5 pontos
  const ultimos5 = [...pontosFiltrados]
    .sort(
      (a, b) => dayjs(b.time_stamp).valueOf() - dayjs(a.time_stamp).valueOf(),
    )
    .slice(0, 5);

  // Ranking geral
  const ranking = pontos
    .filter((p) => dayjs(p.time_stamp).isSame(selectedMonth, "month"))
    .reduce((acc: { [key: number]: RankingProps }, ponto) => {
      if (!acc[ponto.user_id]) {
        acc[ponto.user_id] = {
          user_id: ponto.user_id,
          name: `Usuário ${ponto.user_id}`,
          totalPoints: 0,
        };
      }
      acc[ponto.user_id].totalPoints += Number(ponto.value) || 0;
      return acc;
    }, {});

  const rankingArray = Object.values(ranking).sort(
    (a, b) => b.totalPoints - a.totalPoints,
  );

  const maxPoints = Math.max(...rankingArray.map((r) => r.totalPoints), 1);

  return (
    <div className="flex items-start justify-start gap-3 self-center">
      {/* Painel do usuário */}
      <div className="m-auto flex w-fit max-w-full flex-col gap-4 overflow-x-auto rounded-2xl bg-gray-100 p-5 shadow-lg dark:bg-gray-800">
        <h2 className="text-center text-3xl font-bold text-gray-900 dark:text-white">
          Sistema de Pontos
        </h2>

        <div className="mb-4 flex items-center justify-center gap-2">
          <label className="font-medium text-gray-700 dark:text-gray-200">
            Filtrar por mês:
          </label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 dark:bg-gray-700 dark:text-white"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label.charAt(0).toUpperCase() + m.label.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Spinner size="xl" />
          </div>
        ) : (
          <>
            <Card className="bg-gradient-to-r from-green-400 to-green-600 text-center text-white shadow-md">
              <h3 className="text-lg font-semibold">Total de Pontos</h3>
              <p className="text-5xl font-bold">{totalPontos}</p>
            </Card>

            <div className="mt-4">
              <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
                Últimos 5 pontos registrados
              </h3>

              {ultimos5.length > 0 ? (
                <Table striped hoverable>
                  <TableHead>
                    <TableHeadCell>Data</TableHeadCell>
                    <TableHeadCell>Ação</TableHeadCell>
                    <TableHeadCell>Pontos</TableHeadCell>
                  </TableHead>
                  <TableBody className="divide-y">
                    {ultimos5.map((ponto) => (
                      <TableRow
                        key={ponto.id}
                        className="bg-white dark:border-gray-700 dark:bg-gray-800"
                      >
                        <TableCell>
                          {dayjs(ponto.time_stamp).format("DD/MM/YYYY HH:mm")}
                        </TableCell>
                        <TableCell className="font-medium text-gray-900 dark:text-white">
                          {ponto.name}
                        </TableCell>
                        <TableCell className="font-semibold text-green-600">
                          +{ponto.value}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-gray-500">
                  Nenhum ponto registrado neste mês.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Ranking */}
      <div className="flex flex-col gap-4 overflow-x-auto rounded-2xl bg-gray-100 p-5 shadow-lg dark:bg-gray-800">
        <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
          Ranking de Pontos (
          {months.find((m) => m.value === selectedMonth)?.label})
        </h3>

        {rankingArray.length > 0 ? (
          <div className="ranking-chart w-96">
            {rankingArray.map((rank, index) => (
              <div
                key={rank.user_id}
                className="relative mt-5 flex items-center gap-2"
              >
                <Avatar
                  alt="User profile"
                  img={
                    rank.user_id === user?.id && user?.profile_photo
                      ? `${API_URL}/${user.profile_photo}`
                      : avatar
                  }
                  rounded
                  className="h-8 w-8"
                />

                <div className="relative h-6 flex-1 overflow-hidden rounded bg-gray-300 dark:bg-gray-700">
                  <div
                    className="h-6 rounded-l"
                    style={{
                      width: `${(rank.totalPoints / maxPoints) * 100}%`,
                      backgroundColor:
                        rank.user_id === user?.id ? "#10B981" : "#3B82F6",
                      transition: "width 0.5s ease-in-out",
                    }}
                  />
                  <span className="absolute top-1/2 left-2 -translate-y-1/2 text-sm font-bold whitespace-nowrap text-white">
                    {rank.user_id === user?.id
                      ? "Você"
                      : `Usuário ${rank.user_id}`}{" "}
                    — {rank.totalPoints} pts
                  </span>
                </div>

                <span className="ml-2 font-bold text-gray-500">
                  #{index + 1}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">
            Nenhum ponto registrado neste mês.
          </p>
        )}
      </div>
    </div>
  );
}

export default function IndexPoints() {
  return (
    <div className="m-5 flex w-full max-w-full justify-center">
      <PointsComponente />
    </div>
  );
}
