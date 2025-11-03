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

  const diasUteisNoMes = () => {
    const diasDoMes = dayjs(`${selectedMonth}-01`).daysInMonth();
    const diasUteis: dayjs.Dayjs[] = [];
    for (let i = 1; i <= diasDoMes; i++) {
      const dia = dayjs(`${selectedMonth}-01`).date(i);
      if (dia.day() !== 0 && dia.day() !== 6) diasUteis.push(dia);
    }
    return diasUteis;
  };

  const analytics = useMemo(() => {
    const mapTotal: Record<string, number> = {};
    conferencias.forEach((c) => {
      mapTotal[c.created_by] = (mapTotal[c.created_by] || 0) + 1;
    });

    const diasUteis = diasUteisNoMes();
    return users.map((user) => {
      const total = mapTotal[user.name] || 0;

      // Pegar meta específica do usuário para o mês
      const meta =
        metas.find((m) => m.user_name === user.name)?.quantity ?? 500;

      const mediaDiaria = diasUteis.length > 0 ? meta / diasUteis.length : meta;
      const feitoHoje = total; // já contabiliza total do mês até agora
      const dentroMeta =
        feitoHoje >=
        mediaDiaria *
          diasUteis.filter((d) => d.isBefore(dayjs(), "day")).length;

      return {
        username: user.name,
        name: user.name,
        avatar: user.profile_photo,
        total,
        metaMensal: meta,
        dentroMeta,
      };
    });
  }, [users, conferencias, metas, selectedMonth]);

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

  const userDailyData = useMemo(() => {
    if (!selectedUser) return [];

    const meta =
      metas.find((m) => m.user_name === selectedUser.name)?.quantity ?? 500;
    let restante = meta;

    return diasUteisNoMes().map((dia) => {
      const feitoHoje = conferencias.filter(
        (c) =>
          c.created_by === selectedUser.name &&
          dayjs(c.created_date).isSame(dia, "day"),
      ).length;

      const diasRestantes = diasUteisNoMes().filter((d) =>
        d.isSameOrAfter(dia),
      ).length;
      const mediaDiariaRestante =
        diasRestantes > 0 ? restante / diasRestantes : restante;

      restante -= feitoHoje;

      return {
        dia: dia.format("DD/MM"),
        feito: feitoHoje,
        mediaDiariaRestante,
        restante,
      };
    });
  }, [selectedUser, conferencias, metas, selectedMonth]);

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
                <TableHeadCell className="text-center">Total</TableHeadCell>
                <TableHeadCell className="text-center">
                  Meta Mensal
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
                      {a.metaMensal}
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
        <ModalHeader>Detalhes de {selectedUser?.name}</ModalHeader>
        <ModalBody>
          <Table hoverable striped>
            <TableHead>
              <TableHeadCell>Dia</TableHeadCell>
              <TableHeadCell className="text-center">
                Conferências Feitas
              </TableHeadCell>
              <TableHeadCell className="text-center">
                Média Diária Restante
              </TableHeadCell>
              <TableHeadCell className="text-center">
                Restante para Meta
              </TableHeadCell>
            </TableHead>
            <TableBody>
              {userDailyData.map((d, i) => (
                <TableRow key={i}>
                  <TableCell>{d.dia}</TableCell>
                  <TableCell className="text-center">{d.feito}</TableCell>
                  <TableCell className="text-center">
                    {d.mediaDiariaRestante.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-center">{d.restante}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ModalBody>
      </Modal>
    </div>
  );
}
