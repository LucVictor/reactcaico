import { useEffect, useState } from "react";
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

export interface PontosProps {
  user_id: number;
  name: string;
  action_id: number;
  created_date: string;
  id: number;
  value: number;
}

interface RankingProps {
  user_id: number;
  name: string;
  totalPoints: number;
}

const generateLast12Months = () => {
  const months: { label: string; value: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthValue = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = d.toLocaleString("pt-BR", {
      month: "long",
      year: "numeric",
    });
    months.push({ label: monthLabel, value: monthValue });
  }
  return months;
};

function PointsComponente() {
  const [pontos, setPontos] = useState<PontosProps[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
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

  const pontosDoUsuario = pontos.filter((p) => p.user_id === user?.id);

  const pontosFiltrados = pontosDoUsuario.filter((p) => {
    const d = new Date(p.created_date);
    const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return yearMonth === selectedMonth;
  });

  const totalPontos = pontosFiltrados.reduce(
    (acc, p) => acc + (Number(p.value) || 0),
    0,
  );

  const ultimos5 = [...pontosFiltrados]
    .sort(
      (a, b) =>
        new Date(b.created_date).getTime() - new Date(a.created_date).getTime(),
    )
    .slice(0, 5);

  const ranking = pontos
    .filter((p) => {
      const d = new Date(p.created_date);
      const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return yearMonth === selectedMonth;
    })
    .reduce((acc: { [key: number]: RankingProps }, ponto) => {
      if (!acc[ponto.user_id]) {
        acc[ponto.user_id] = {
          user_id: ponto.user_id,
          name: String(ponto.user_id),
          totalPoints: 0,
        };
      }
      acc[ponto.user_id].totalPoints += Number(ponto.value) || 0;
      return acc;
    }, {});

  // Converter o objeto de ranking em array e ordenar
  const rankingArray = Object.values(ranking).sort(
    (a, b) => b.totalPoints - a.totalPoints,
  );

  // Encontrar o valor máximo de pontos para normalizar as barras
  const maxPoints = Math.max(...rankingArray.map((r) => r.totalPoints), 1); // Evita divisão por zero

  return (
    <div className="flex items-start justify-start gap-3 self-center">
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
                          {new Date(ponto.created_date).toLocaleString(
                            "pt-BR",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
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
      <div className="flex flex-col gap-4 overflow-x-auto rounded-2xl bg-gray-100 p-5 shadow-lg dark:bg-gray-800">
        <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
          Ranking de Pontos (
          {months.find((m) => m.value === selectedMonth)?.label})
        </h3>
        {rankingArray.length > 0 ? (
          <div className="ranking-chart">
            {rankingArray.map((rank) => (
              <div key={rank.user_id} className="mt-5 flex items-center gap-2">
                <Avatar
                  alt="User profile"
                  img={
                    rank.user_id === user?.id && user?.profile_photo
                      ? `${API_URL}/${user.profile_photo}`
                      : avatar
                  }
                  rounded
                  className="h-6 w-8"
                />

                <div className="relative h-6 flex-1 rounded">
                  <div
                    className="h-6 rounded"
                    style={{
                      width: `${(rank.totalPoints / maxPoints) * 100}%`,
                      backgroundColor:
                        rank.user_id === user?.id ? "#10B981" : "#3B82F6",
                      transition: "width 0.5s ease-in-out",
                    }}
                  />

                  <span className="absolute top-1/2 left-2 -translate-y-1/2 transform text-sm font-bold text-white">
                    {rank.user_id === user?.id ? "Você: " : "Desconhecido: "}
                    {rank.totalPoints} pontos.
                  </span>
                </div>
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
