import { useEffect, useState, useMemo } from "react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import isBetween from "dayjs/plugin/isBetween";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
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
  ModalBody,
  ModalHeader,
} from "flowbite-react";
import { HiChartBar, HiX } from "react-icons/hi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import api, { API_URL } from "../../../api";
import avatar from "../../../static/user.png";

const META_SEMANAL = 150;

dayjs.locale("pt-br");
dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

interface Conferencia {
  id: number;
  product_name: string;
  product_code: number;
  quantity_real: number;
  quantity_system: number;
  created_date: string;
  created_by: string;
}

interface User {
  id: number;
  name: string;
  profile_photo: string | null;
  meta_mensal?: number; // meta mensal específica do usuário
}

interface Meta {
  user_id: number;
  user_name: string;
  quantity: number;
}

export default function AdminConferenciaAnalytics() {
  const [users, setUsers] = useState<User[]>([]);
  const [conferencias, setConferencias] = useState<Conferencia[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChart, setShowChart] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    dayjs().format("YYYY-MM"),
  );
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [uRes, mRes] = await Promise.all([
          api.get("/admin/users"), // usuários
          api.get(`/target/conference/${selectedMonth}`), // metas do mês
        ]);

        setUsers(uRes.data);
        setMetas(mRes.data);

        // Buscar conferências do mês usando between
        const startOfMonth = dayjs(`${selectedMonth}-01`).format("YYYY-MM-DD");
        const endOfMonth = dayjs(`${selectedMonth}-01`)
          .endOf("month")
          .format("YYYY-MM-DD");

        const cRes = await api.get(
          `/conference/between?date1=${startOfMonth}&date2=${endOfMonth}`,
        );
        setConferencias(cRes.data);
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedMonth]);

  const semanasDoMes = useMemo(() => {
    const mes = dayjs(`${selectedMonth}-01`);
    const ultimoDia = mes.endOf("month");
    const primeiroDia = mes.startOf("month");

    const primeiroSexta = primeiroDia.clone();
    const diferencaParaSexta = (primeiroSexta.day() - 5 + 7) % 7;
    primeiroSexta.subtract(diferencaParaSexta, "day");

    const semanas: {
      numero: number;
      inicio: dayjs.Dayjs;
      fim: dayjs.Dayjs;
      total: number;
      atingiuMeta: boolean;
    }[] = [];

    let semanaAtual = primeiroSexta;
    let numero = 1;

    while (
      semanaAtual.isBefore(ultimoDia, "day") ||
      semanaAtual.isSame(ultimoDia, "day")
    ) {
      const semanaFim = semanaAtual.clone().add(6, "day");

      const total = conferencias.filter((c) => {
        const data = dayjs(c.created_date);
        return data.isBetween(semanaAtual, semanaFim, "day", "[]");
      }).length;

      semanas.push({
        numero,
        inicio: semanaAtual,
        fim: semanaFim,
        total,
        atingiuMeta: total >= META_SEMANAL,
      });

      semanaAtual = semanaAtual.add(7, "day");
      numero += 1;
    }

    return semanas;
  }, [conferencias, selectedMonth]);

  const analytics = useMemo(() => {
    const mapTotal: Record<string, number> = {};
    conferencias.forEach((c) => {
      mapTotal[c.created_by] = (mapTotal[c.created_by] || 0) + 1;
    });

    return users.map((user) => {
      const total = mapTotal[user.name] || 0;
      const semanasBatidas = semanasDoMes.filter((semana) => {
        const semanaTotal = conferencias.filter((c) => {
          const data = dayjs(c.created_date);
          return (
            c.created_by === user.name &&
            data.isBetween(semana.inicio, semana.fim, "day", "[]")
          );
        }).length;

        return semanaTotal >= META_SEMANAL;
      }).length;

      const metaMensal =
        metas.find((m) => m.user_name === user.name)?.quantity ?? 500;

      const dentroMeta =
        total >= Math.max(metaMensal, META_SEMANAL * semanasDoMes.length);

      return {
        username: user.name,
        name: user.name,
        avatar: user.profile_photo,
        total,
        semanasBatidas,
        metaMensal,
        metaSemanal: META_SEMANAL,
        dentroMeta,
      };
    });
  }, [users, conferencias, metas, semanasDoMes, selectedMonth]);

  const chartData = useMemo(
    () =>
      analytics.map((a) => ({
        name: a.name.length > 10 ? a.name.slice(0, 8) + "..." : a.name,
        Total: a.total,
      })),
    [analytics],
  );

  const openUserModal = (user: User) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const userWeeklyData = useMemo(() => {
    if (!selectedUser) return [];

    return semanasDoMes.map((semana) => {
      const total = conferencias.filter((c) => {
        const data = dayjs(c.created_date);
        return (
          c.created_by === selectedUser.name &&
          data.isBetween(semana.inicio, semana.fim, "day", "[]")
        );
      }).length;

      return {
        semana: `Semana ${semana.numero}`,
        periodo: `${semana.inicio.format("DD/MM")} - ${semana.fim.format("DD/MM")}`,
        total,
        meta: META_SEMANAL,
        atingiuMeta: total >= META_SEMANAL,
      };
    });
  }, [selectedUser, conferencias, semanasDoMes]);

  return (
    <div className="m-5 flex flex-col items-center gap-6">
      <Card className="w-full max-w-7xl bg-white p-6 shadow-md dark:bg-gray-700">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Análise de Conferências (Admin)
          </h2>
          <Button
            size="sm"
            color="gray"
            onClick={() => setShowChart(!showChart)}
            className="flex items-center gap-1"
          >
            {showChart ? <HiX /> : <HiChartBar />}
            Gráfico
          </Button>
        </div>

        <div className="mb-6 flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Mês:
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded border-gray-300 shadow-sm focus:ring focus:ring-indigo-500 dark:bg-gray-600 dark:text-white"
          />
        </div>

        {loading ? (
          <div className="my-10 flex justify-center">
            <Spinner size="xl" />
          </div>
        ) : (
          <>
            {showChart && (
              <div className="mb-6">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="Total" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <Table hoverable striped>
              <TableHead>
                <TableHeadCell>Usuário</TableHeadCell>
                <TableHeadCell className="text-center">
                  Total do Mês
                </TableHeadCell>
                <TableHeadCell className="text-center">
                  Meta Semanal
                </TableHeadCell>
                <TableHeadCell className="text-center">
                  Semanas com Meta
                </TableHeadCell>
                <TableHeadCell className="text-center">
                  Status da Meta
                </TableHeadCell>
              </TableHead>
              <TableBody>
                {analytics.map((a) => (
                  <TableRow
                    key={a.username}
                    className="cursor-pointer"
                    onClick={() => {
                      const user = users.find((u) => u.name === a.username);
                      if (user) openUserModal(user);
                    }}
                  >
                    <TableCell className="flex items-center gap-3">
                      <Avatar
                        img={a.avatar ? `${API_URL}/${a.avatar}` : avatar}
                        rounded
                        size="sm"
                      />
                      {a.name}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {a.total}
                    </TableCell>
                    <TableCell className="text-center">
                      {a.metaSemanal}
                    </TableCell>
                    <TableCell className="text-center">
                      {a.semanasBatidas}/{semanasDoMes.length}
                    </TableCell>
                    <TableCell className="text-center">
                      {a.dentroMeta ? (
                        <Badge color="success">Dentro da meta</Badge>
                      ) : (
                        <Badge color="failure">Abaixo da meta</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Card>

      <Modal
        show={showUserModal}
        onClose={() => setShowUserModal(false)}
        size="6xl"
      >
        <ModalHeader>Detalhes por semana de {selectedUser?.name}</ModalHeader>
        <ModalBody>
          <Table hoverable striped>
            <TableHead>
              <TableHeadCell>Semana</TableHeadCell>
              <TableHeadCell className="text-center">Período</TableHeadCell>
              <TableHeadCell className="text-center">
                Conferências Feitas
              </TableHeadCell>
              <TableHeadCell className="text-center">
                Meta da Semana
              </TableHeadCell>
              <TableHeadCell className="text-center">Status</TableHeadCell>
            </TableHead>
            <TableBody>
              {userWeeklyData.map((d, i) => (
                <TableRow key={i}>
                  <TableCell>{d.semana}</TableCell>
                  <TableCell className="text-center">{d.periodo}</TableCell>
                  <TableCell className="text-center">{d.total}</TableCell>
                  <TableCell className="text-center">{d.meta}</TableCell>
                  <TableCell className="text-center">
                    {d.atingiuMeta ? (
                      <Badge color="success">Meta atingida</Badge>
                    ) : (
                      <Badge color="failure">Abaixo da meta</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ModalBody>
      </Modal>
    </div>
  );
}
