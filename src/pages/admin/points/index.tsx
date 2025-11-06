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
  user_name?: string;
}

interface User {
  id: number;
  name: string;
}

interface FraudAlert {
  user_id: number;
  user_name: string;
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

  // 🧠 Data atual (YYYY-MM-DD)
  const getToday = () => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  };

  // 🚀 Busca pontos + produtos + usuários
  const fetchPoints = async (filters?: {
    user?: string;
    date1?: string;
    date2?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.user) params.append("user", filters.user);
      if (filters?.date1) params.append("date1", filters.date1);
      if (filters?.date2) params.append("date2", filters.date2);
      const query = params.toString() ? `?${params.toString()}` : "";

      const [pointsRes, usersRes] = await Promise.all([
        api.get(`/rank/${query}`),
        api.get(`/admin/users`),
      ]);

      const fetchedPoints: Point[] = pointsRes.data || [];
      const users: User[] = usersRes.data || [];

      if (!fetchedPoints.length) {
        setPoints([]);
        setLoading(false);
        return;
      }

      // 🧩 Mapear usuários e produtos
      const userMap: Record<number, string> = {};
      users.forEach((u) => (userMap[u.id] = u.name));

      const uniqueCodes = [
        ...new Set(fetchedPoints.map((p) => p.product_code)),
      ];
      const productNamesMap: Record<number, string> = {};

      await Promise.all(
        uniqueCodes.map(async (code) => {
          try {
            const res = await api.get(`/product/${code}`);
            productNamesMap[code] = res.data.name || "Sem nome";
          } catch {
            productNamesMap[code] = "Produto não encontrado";
          }
        }),
      );

      // Associa nomes de produto e usuário
      const enrichedPoints = fetchedPoints.map((p) => ({
        ...p,
        product_name: productNamesMap[p.product_code],
        user_name: userMap[p.user_id] || `Usuário ${p.user_id}`,
      }));

      // Ordenar por data (mais recente primeiro)
      enrichedPoints.sort(
        (a, b) =>
          new Date(b.time_stamp ?? "").getTime() -
          new Date(a.time_stamp ?? "").getTime(),
      );

      setPoints(enrichedPoints);
    } catch (err: any) {
      setError(`Erro ao carregar pontos: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // 🔄 Busca inicial (data do dia)
  useEffect(() => {
    const today = getToday();
    setDate1(today);
    setDate2(today);
    fetchPoints({ date1: today, date2: today });
  }, []);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPoints({ user: userId, date1, date2 });
  };

  // 🔎 Lógica antifraude
  const verificarFraude = () => {
    const alerts: FraudAlert[] = [];
    const grouped: Record<string, Point[]> = {};

    points.forEach((p) => {
      const key = `${p.user_id}-${p.product_code}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    });

    Object.values(grouped).forEach((arr) => {
      if (arr.length > 1) {
        const sorted = arr.sort(
          (a, b) =>
            new Date(a.time_stamp!).getTime() -
            new Date(b.time_stamp!).getTime(),
        );

        let startIndex = 0;
        for (let i = 1; i < sorted.length; i++) {
          const prev = new Date(sorted[i - 1].time_stamp!).getTime();
          const curr = new Date(sorted[i].time_stamp!).getTime();
          const diffHours = (curr - prev) / (1000 * 60 * 60);

          if (diffHours > 24) {
            startIndex = i;
          } else if (i - startIndex + 1 >= 3) {
            alerts.push({
              user_id: sorted[i].user_id,
              user_name: sorted[i].user_name || `Usuário ${sorted[i].user_id}`,
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

      {/* 🔍 Filtros */}
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

      {/* ⚠️ Modal antifraude */}
      <Modal show={showFraudModal} onClose={() => setShowFraudModal(false)}>
        <ModalHeader>Produtos Suspeitos</ModalHeader>
        <ModalBody>
          {fraudAlerts.length === 0 ? (
            <p>Nenhum padrão suspeito encontrado.</p>
          ) : (
            <ul>
              {fraudAlerts.map((a, idx) => (
                <li key={idx} className="mb-2">
                  <strong>{a.user_name}</strong> ({a.user_id}) registrou{" "}
                  <strong>{a.count}</strong> ações para{" "}
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

      {/* 📊 Tabela */}
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
                <TableHeadCell>Usuário</TableHeadCell>
                <TableHeadCell>Local ID</TableHeadCell>
                <TableHeadCell>Valor</TableHeadCell>
                <TableHeadCell>Nome Ação</TableHeadCell>
                <TableHeadCell>Produto</TableHeadCell>
                <TableHeadCell>Data</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {points.map((point) => (
                <TableRow
                  key={point.id}
                  className="bg-white dark:border-gray-700 dark:bg-gray-800"
                >
                  <TableCell>
                    {point.user_name} ({point.user_id})
                  </TableCell>
                  <TableCell>{point.local_id}</TableCell>
                  <TableCell>{point.value}</TableCell>
                  <TableCell>{point.name}</TableCell>
                  <TableCell>{point.product_name}</TableCell>
                  <TableCell>
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
