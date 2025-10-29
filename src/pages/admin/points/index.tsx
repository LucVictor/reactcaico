import React, { useEffect, useState } from "react";
import api from "../../../api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "flowbite-react";

interface Point {
  id: number;
  user_id: number;
  action_id: number;
  local_id: number;
  value: number;
  time_stamp?: string;
  name: string;
  product_code: number;
  product_name?: string;
}

interface FraudAlert {
  user_id: number;
  product_code: number;
  product_name: string;
  count: number;
  first_time: string;
  last_time: string;
}

const PointsPagina: React.FC = () => {
  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string>("");
  const [date1, setDate1] = useState<string>("");
  const [date2, setDate2] = useState<string>("");

  const [showFraudModal, setShowFraudModal] = useState(false);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);

  // Fetch points e produtos
  const fetchPoints = async (filters?: {
    user?: string;
    date1?: string;
    date2?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      let query = "";
      if (filters) {
        const params = new URLSearchParams();
        if (filters.user) params.append("user", filters.user);
        if (filters.date1) params.append("date1", filters.date1);
        if (filters.date2) params.append("date2", filters.date2);
        query = `?${params.toString()}`;
      }

      const response = await api.get(`/rank/${query}`);
      const fetchedPoints: Point[] = response.data;

      // Buscar nomes dos produtos
      const productNamesMap: Record<number, string> = {};
      await Promise.all(
        fetchedPoints.map(async (p) => {
          if (!productNamesMap[p.product_code]) {
            try {
              const res = await api.get(`/product/${p.product_code}`);
              productNamesMap[p.product_code] = res.data.name;
            } catch {
              productNamesMap[p.product_code] = "Produto não encontrado";
            }
          }
          p.product_name = productNamesMap[p.product_code];
        }),
      );

      setPoints(
        fetchedPoints.sort(
          (a, b) =>
            new Date(b.time_stamp ?? "").getTime() -
            new Date(a.time_stamp ?? "").getTime(),
        ),
      );
    } catch (err) {
      setError(`Erro ao carregar pontos do servidor: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoints();
  }, []);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPoints({ user: userId, date1, date2 });
  };

  // Função antifraude
  const verificarFraude = () => {
    const alerts: FraudAlert[] = [];

    // Agrupa por usuário e produto
    const grouped: Record<string, Point[]> = {};
    points.forEach((p) => {
      const key = `${p.user_id}-${p.product_code}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    });

    Object.values(grouped).forEach((arr) => {
      if (arr.length > 1) {
        // Ordena por timestamp
        const sorted = arr.sort(
          (a, b) =>
            new Date(a.time_stamp!).getTime() -
            new Date(b.time_stamp!).getTime(),
        );

        // Verifica sequências de ações dentro de 24h (ou outro período)
        let startIndex = 0;
        for (let i = 1; i < sorted.length; i++) {
          const prev = new Date(sorted[i - 1].time_stamp!).getTime();
          const curr = new Date(sorted[i].time_stamp!).getTime();
          const diffHours = (curr - prev) / (1000 * 60 * 60);

          if (diffHours > 24) {
            startIndex = i; // reinicia a contagem
          } else if (i - startIndex + 1 >= 3) {
            // 3 ou mais ações em 24h = alerta
            alerts.push({
              user_id: sorted[i].user_id,
              product_code: sorted[i].product_code,
              product_name: sorted[i].product_name!,
              count: i - startIndex + 1,
              first_time: sorted[startIndex].time_stamp!,
              last_time: sorted[i].time_stamp!,
            });
          }
        }
      }
    });

    setFraudAlerts(alerts);
    setShowFraudModal(true);
  };

  return (
    <div className="p-8">
      <h1 className="mb-6 text-center text-2xl font-bold">Ranking de Pontos</h1>

      {/* Filtros */}
      <div className="mb-4 flex w-fit justify-center rounded-2xl p-2 text-gray-200 dark:bg-gray-700">
        <form
          onSubmit={handleFilter}
          className="flex flex-wrap items-end gap-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium">User ID</label>
            <input
              type="number"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="rounded border px-3 py-1"
              placeholder="Ex: 1"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Data início
            </label>
            <input
              type="date"
              value={date1}
              onChange={(e) => setDate1(e.target.value)}
              className="rounded border px-3 py-1"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Data fim</label>
            <input
              type="date"
              value={date2}
              onChange={(e) => setDate2(e.target.value)}
              className="rounded border px-3 py-1"
            />
          </div>

          <Button type="submit">Filtrar</Button>
          <Button color="red" onClick={verificarFraude}>
            AntiFraude
          </Button>
        </form>
      </div>

      {/* Modal antifraude */}
      <Modal show={showFraudModal} onClose={() => setShowFraudModal(false)}>
        <ModalHeader>Produtos Suspeitos</ModalHeader>
        <ModalBody>
          {fraudAlerts.length === 0 ? (
            <p>Nenhum padrão suspeito encontrado.</p>
          ) : (
            <ul>
              {fraudAlerts.map((a, idx) => (
                <li key={idx} className="mb-2">
                  Usuário <strong>{a.user_id}</strong> registrou{" "}
                  <strong>{a.count}</strong> ações para o produto{" "}
                  <strong>{a.product_name}</strong> ({a.product_code}) entre{" "}
                  {new Date(a.first_time).toLocaleString("pt-BR")} e{" "}
                  {new Date(a.last_time).toLocaleString("pt-BR")}.
                </li>
              ))}
            </ul>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => setShowFraudModal(false)}>Fechar</Button>
        </ModalFooter>
      </Modal>

      {/* Tabela */}
      {loading ? (
        <div className="flex min-h-screen items-center justify-center text-lg font-semibold">
          Carregando pontos...
        </div>
      ) : error ? (
        <div className="flex min-h-screen items-center justify-center font-semibold text-red-500">
          {error}
        </div>
      ) : points.length === 0 ? (
        <p className="text-center text-white">Nenhum ponto encontrado.</p>
      ) : (
        <div className="mt-5 max-h-[600px] overflow-x-auto rounded">
          <Table className="min-w-full text-center">
            <TableHead>
              <TableRow>
                <TableHeadCell className="border-b px-4 py-2">
                  Usuário
                </TableHeadCell>
                <TableHeadCell className="border-b px-4 py-2">
                  Local ID
                </TableHeadCell>
                <TableHeadCell className="border-b px-4 py-2">
                  Valor
                </TableHeadCell>
                <TableHeadCell className="border-b px-4 py-2">
                  Nome Ação
                </TableHeadCell>
                <TableHeadCell className="border-b px-4 py-2">
                  Produto
                </TableHeadCell>
                <TableHeadCell className="border-b px-4 py-2">
                  Data
                </TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {points.map((point) => (
                <TableRow
                  key={point.id}
                  className="bg-white dark:border-gray-700 dark:bg-gray-800"
                >
                  <TableCell className="border-b px-4 py-2 text-center">
                    {point.user_id}
                  </TableCell>
                  <TableCell className="border-b px-4 py-2">
                    {point.local_id}
                  </TableCell>
                  <TableCell className="border-b px-4 py-2">
                    {point.value}
                  </TableCell>
                  <TableCell className="border-b px-4 py-2">
                    {point.name}
                  </TableCell>
                  <TableCell className="border-b px-4 py-2">
                    {point.product_name}
                  </TableCell>
                  <TableCell className="border-b px-4 py-2 text-center">
                    {point.time_stamp
                      ? new Date(point.time_stamp).toLocaleString("pt-BR")
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default PointsPagina;
