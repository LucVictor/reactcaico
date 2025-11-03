import { useEffect, useState, useMemo } from "react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import isBetween from "dayjs/plugin/isBetween";
import isSameOrAftet from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
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
} from "recharts";
import api, { API_URL } from "../../../api";
import avatar from "../../../static/user.png";

dayjs.locale("pt-br");
dayjs.extend(isBetween);
dayjs.extend(isSameOrAftet);
dayjs.extend(isSameOrBefore);

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
  meta_mensal?: number; // meta total do mês
}

export default function AdminConferenciaAnalytics() {
  const [users, setUsers] = useState<User[]>([]);
  const [conferencias, setConferencias] = useState<Conferencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChart, setShowChart] = useState(true);
  const [metaMensalPadrao, setMetaMensalPadrao] = useState(500);

  // Modal usuário
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  // Períodos de comparação
  const [p1Start, setP1Start] = useState<Date>(
    dayjs().subtract(30, "day").toDate(),
  );
  const [p1End, setP1End] = useState<Date>(
    dayjs().subtract(16, "day").toDate(),
  );
  const [p2Start, setP2Start] = useState<Date>(
    dayjs().subtract(15, "day").toDate(),
  );
  const [p2End, setP2End] = useState<Date>(dayjs().toDate());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [uRes, cRes, wRes] = await Promise.all([
          api.get("/admin/users"),
          api.get("/conference/"),
          api.get("/work_conference/items/"),
        ]);

        const workNormalized: Conferencia[] = wRes.data.map((w: any) => ({
          id: w.id,
          product_name: w.product_name,
          product_code: w.product_code,
          quantity_real: w.quantity_real,
          quantity_system: w.quantity_system,
          created_date: w.created_date,
          created_by: w.created_by,
        }));

        setUsers(uRes.data);
        setConferencias([...cRes.data, ...workNormalized]);
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Função para contar dias úteis entre dois dias
  const diasUteisAteHoje = (diaFinal: dayjs.Dayjs) => {
    const inicio = dayjs().startOf("month");
    let count = 0;
    let dia = inicio;
    while (dia.isSameOrBefore(diaFinal, "day")) {
      const weekday = dia.day(); // 0 = domingo, 6 = sábado
      if (weekday !== 0 && weekday !== 6) count++;
      dia = dia.add(1, "day");
    }
    return count;
  };

  // Filtrar conferências por período
  const { confP1, confP2 } = useMemo(() => {
    const s1 = dayjs(p1Start).startOf("day");
    const e1 = dayjs(p1End).endOf("day");
    const s2 = dayjs(p2Start).startOf("day");
    const e2 = dayjs(p2End).endOf("day");

    const p1 = conferencias.filter((c) =>
      dayjs(c.created_date).isBetween(s1, e1, null, "[]"),
    );
    const p2 = conferencias.filter((c) =>
      dayjs(c.created_date).isBetween(s2, e2, null, "[]"),
    );

    return { confP1: p1, confP2: p2 };
  }, [conferencias, p1Start, p1End, p2Start, p2End]);

  // Agrupar e calcular
  const analytics = useMemo(() => {
    const mapP1: Record<string, number> = {};
    const mapP2: Record<string, number> = {};

    confP1.forEach((c) => {
      mapP1[c.created_by] = (mapP1[c.created_by] || 0) + 1;
    });
    confP2.forEach((c) => {
      mapP2[c.created_by] = (mapP2[c.created_by] || 0) + 1;
    });

    const allUsers = new Set([
      ...Object.keys(mapP1),
      ...Object.keys(mapP2),
      ...users.map((u) => u.name),
    ]);

    return Array.from(allUsers)
      .map((username) => {
        const p1 = mapP1[username] || 0;
        const p2 = mapP2[username] || 0;
        const percent = p1 === 0 ? (p2 > 0 ? 100 : 0) : ((p2 - p1) / p1) * 100;

        const user = users.find((u) => u.name === username);
        const metaMensal = user?.meta_mensal ?? metaMensalPadrao;

        // Dias úteis até hoje
        const diasUteis = diasUteisAteHoje(dayjs());
        const totalMes = conferencias.filter(
          (c) =>
            c.created_by === username &&
            dayjs(c.created_date).isSame(dayjs(), "month"),
        ).length;

        // Meta dinâmica
        const restante = metaMensal - totalMes;
        const diasRestantes =
          diasUteisAteHoje(dayjs().endOf("month")) - diasUteis;
        const mediaDiariaRestante =
          diasRestantes > 0 ? restante / diasRestantes : restante;

        const dentroMeta =
          totalMes >=
          (metaMensal / diasUteisAteHoje(dayjs().endOf("month"))) * diasUteis;

        return {
          username,
          name: user?.name || username,
          avatar: user?.profile_photo,
          p1,
          p2,
          percent,
          metaMensal,
          totalMes,
          mediaDiariaRestante,
          dentroMeta,
        };
      })
      .sort((a, b) => b.p2 - a.p2);
  }, [confP1, confP2, users, conferencias, metaMensalPadrao]);

  // Gráfico
  const chartData = useMemo(
    () =>
      analytics.map((a) => ({
        name: a.name.length > 10 ? a.name.slice(0, 8) + "..." : a.name,
        "Período 1": a.p1,
        "Período 2": a.p2,
      })),
    [analytics],
  );

  const getTrendIcon = (p: number) =>
    p > 0 ? (
      <HiTrendingUp className="text-green-600" />
    ) : p < 0 ? (
      <HiTrendingDown className="text-red-600" />
    ) : (
      <HiMinus className="text-gray-500" />
    );

  const formatPercent = (v: number) =>
    v === 0 ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

  // Função para abrir modal do usuário
  const openUserModal = (user: User) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  // Tabela do usuário detalhada
  const userDailyData = useMemo(() => {
    if (!selectedUser) return [];

    const metaMensal = selectedUser.meta_mensal ?? metaMensalPadrao;
    const diasDoMes = dayjs().daysInMonth();

    // Contar dias úteis do mês
    const diasUteis = Array.from({ length: diasDoMes }, (_, i) => {
      const dia = dayjs().date(i + 1);
      return dia.day() !== 0 && dia.day() !== 6 ? dia : null;
    }).filter(Boolean) as dayjs.Dayjs[];

    const totalFeito = conferencias.filter(
      (c) =>
        c.created_by === selectedUser.name &&
        dayjs(c.created_date).isSame(dayjs(), "month"),
    ).length;

    let restante = metaMensal - totalFeito;

    return diasUteis.map((dia) => {
      const feitoHoje = conferencias.filter(
        (c) =>
          c.created_by === selectedUser.name &&
          dayjs(c.created_date).isSame(dia, "day"),
      ).length;

      const diasRestantes = diasUteis.filter((d) =>
        d.isSameOrAfter(dia),
      ).length;
      const mediaDiariaRestante =
        diasRestantes > 0 ? restante / diasRestantes : restante;

      restante -= feitoHoje;

      return {
        dia: dia.format("DD/MM"),
        feito: feitoHoje,
        mediaDiariaRestante: mediaDiariaRestante,
        restante,
      };
    });
  }, [selectedUser, conferencias, metaMensalPadrao]);

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

        {/* Períodos */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Período 1 - Início", p1Start, setP1Start],
            ["Período 1 - Fim", p1End, setP1End],
            ["Período 2 - Início", p2Start, setP2Start],
            ["Período 2 - Fim", p2End, setP2End],
          ].map(([label, val, set]) => (
            <div key={String(label)}>
              <label className="block text-sm text-gray-600 dark:text-gray-300">
                {label}
              </label>
              <input
                type="date"
                value={dayjs(val as Date).format("YYYY-MM-DD")}
                onChange={(e) => {
                  const d = new Date(e.target.value + "T00:00:00");
                  if (!isNaN(d.getTime())) (set as any)(d);
                }}
                className="w-full rounded border-gray-300 shadow-sm focus:ring focus:ring-indigo-500"
              />
            </div>
          ))}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Meta mensal padrão:
          </label>
          <input
            type="number"
            min={0}
            value={metaMensalPadrao}
            onChange={(e) => setMetaMensalPadrao(Number(e.target.value))}
            className="w-32 rounded border-gray-300 shadow-sm focus:ring focus:ring-indigo-500 dark:bg-gray-600 dark:text-white"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            (usada quando o usuário não tem meta definida)
          </span>
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
                    <Legend />
                    <Bar dataKey="Período 1" fill="#8b5cf6" />
                    <Bar dataKey="Período 2" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <Table hoverable striped>
              <TableHead>
                <TableHeadCell>Usuário</TableHeadCell>
                <TableHeadCell className="text-center">P1</TableHeadCell>
                <TableHeadCell className="text-center">P2</TableHeadCell>
                <TableHeadCell className="text-center">Variação</TableHeadCell>
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
                    <TableCell className="text-center">{a.p1}</TableCell>
                    <TableCell className="text-center font-semibold">
                      {a.p2}
                    </TableCell>
                    <TableCell className="flex items-center justify-center gap-1 text-center">
                      {getTrendIcon(a.percent)}
                      {formatPercent(a.percent)}
                    </TableCell>
                    <TableCell className="text-center">
                      {a.totalMes}/{a.metaMensal}
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

      {/* Modal do usuário */}
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
