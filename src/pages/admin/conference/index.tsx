import { useEffect, useState, useMemo } from "react";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
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

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

interface Conferencia {
  id: number;
  product_name: string;
  product_code: string;
  quantity_real: number;
  quantity_system: number;
  created_date: string;
  created_by: string;
}

interface User {
  id: number;
  name: string;
  profile_photo: string | null;
  meta_mensal?: number;
}

interface Meta {
  user_id: number;
  user_name: string;
  quantity: number;
}

interface Semana {
  numero: number;
  inicio: dayjs.Dayjs;
  fim: dayjs.Dayjs;
  total: number;
  atingiuMeta: boolean;
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

  /*
   * ============================================================
   * CARREGAR DADOS
   * ============================================================
   */

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      try {
        /*
         * Primeiro descobrimos o intervalo das semanas.
         *
         * REGRA: SEXTA -> QUINTA
         *
         * Exemplo:
         *
         * Agosto/2026
         *
         * 01/08 sábado
         * sexta anterior: 31/07
         *
         * Portanto:
         *
         * primeira semana = 31/07 -> 06/08
         *
         * última semana (contém 31/08, uma segunda) = 28/08 -> 03/09
         */

        const mes = dayjs(`${selectedMonth}-01`);

        const primeiroDiaMes = mes.startOf("month");
        const ultimoDiaMes = mes.endOf("month");

        /*
         * Encontrar a sexta-feira da semana que contém
         * o primeiro dia do mês.
         *
         * day():
         *
         * 0 = domingo
         * 1 = segunda
         * 2 = terça
         * 3 = quarta
         * 4 = quinta
         * 5 = sexta
         * 6 = sábado
         */

        const diasDesdeSexta = (primeiroDiaMes.day() + 2) % 7;

        const primeiraSemanaInicio = primeiroDiaMes
          .subtract(diasDesdeSexta, "day")
          .startOf("day");

        /*
         * A última semana termina 6 dias depois
         * da sexta da semana que contém o último
         * dia do mês.
         */

        const diasDesdeSextaUltimoDia = (ultimoDiaMes.day() + 2) % 7;

        const ultimaSemanaInicio = ultimoDiaMes
          .subtract(diasDesdeSextaUltimoDia, "day")
          .startOf("day");

        const ultimaSemanaFim = ultimaSemanaInicio.add(6, "day").endOf("day");

        /*
         * Buscar usuários e metas.
         */

        const [uRes, mRes] = await Promise.all([
          api.get("/admin/users"),
          api.get(`/target/conference/${selectedMonth}`),
        ]);

        setUsers(uRes.data);
        setMetas(mRes.data);

        /*
         * IMPORTANTE:
         *
         * Não buscamos apenas:
         *
         * 01/08 -> 31/08
         *
         * porque a primeira/última semana podem
         * atravessar o mês.
         *
         * Buscamos o intervalo completo das semanas.
         */

        const startDate = primeiraSemanaInicio.format("YYYY-MM-DD");
        const endDate = ultimaSemanaFim.format("YYYY-MM-DD");

        const cRes = await api.get(
          `/conference/between?date1=${startDate}&date2=${endDate}`,
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

  /*
   * ============================================================
   * SEMANAS DO MÊS
   *
   * REGRA:
   *
   * SEXTA -> QUINTA
   * ============================================================
   */

  const semanasDoMes = useMemo<Semana[]>(() => {
    const mes = dayjs(`${selectedMonth}-01`);

    const primeiroDiaMes = mes.startOf("month");
    const ultimoDiaMes = mes.endOf("month");

    /*
     * Encontrar a sexta-feira da semana que contém
     * o primeiro dia do mês.
     */

    const diasDesdeSexta = (primeiroDiaMes.day() + 2) % 7;

    let semanaAtual = primeiroDiaMes
      .subtract(diasDesdeSexta, "day")
      .startOf("day");

    const semanas: Semana[] = [];

    let numero = 1;

    /*
     * Continuamos enquanto o início da semana
     * ainda estiver dentro ou antes do mês.
     */

    while (
      semanaAtual.isBefore(ultimoDiaMes, "day") ||
      semanaAtual.isSame(ultimoDiaMes, "day")
    ) {
      const semanaFim = semanaAtual.add(6, "day").endOf("day");

      const total = conferencias.filter((c) => {
        const data = dayjs(c.created_date);

        return (
          data.isSameOrAfter(semanaAtual.startOf("day")) &&
          data.isSameOrBefore(semanaFim)
        );
      }).length;

      semanas.push({
        numero,
        inicio: semanaAtual,
        fim: semanaFim,
        total,
        atingiuMeta: total >= META_SEMANAL,
      });

      semanaAtual = semanaAtual.add(7, "day");

      numero++;
    }

    return semanas;
  }, [conferencias, selectedMonth]);

  /*
   * ============================================================
   * ANALYTICS DOS USUÁRIOS
   * ============================================================
   */

  const analytics = useMemo(() => {
    /*
     * O total mensal NÃO deve usar todas as conferências
     * carregadas.
     *
     * Isso é importante porque carregamos alguns dias
     * do mês anterior/posterior para completar as semanas.
     *
     * Exemplo:
     *
     * Semana:
     * 28/08 -> 03/09
     *
     * As conferências de 01/09 -> 03/09 foram carregadas,
     * mas não pertencem ao "Total do Mês" de agosto.
     */

    const inicioMes = dayjs(`${selectedMonth}-01`).startOf("month");
    const fimMes = dayjs(`${selectedMonth}-01`).endOf("month");

    const conferenciasDoMes = conferencias.filter((c) => {
      const data = dayjs(c.created_date);

      return data.isSameOrAfter(inicioMes) && data.isSameOrBefore(fimMes);
    });

    /*
     * Total mensal por usuário.
     */

    const mapTotal: Record<string, number> = {};

    conferenciasDoMes.forEach((c) => {
      mapTotal[c.created_by] = (mapTotal[c.created_by] || 0) + 1;
    });

    /*
     * Montar analytics.
     */

    return users.map((user) => {
      const total = mapTotal[user.name] || 0;

      /*
       * Quantidade de semanas em que o usuário
       * atingiu pelo menos 150 conferências.
       */

      const semanasBatidas = semanasDoMes.filter((semana) => {
        const semanaTotal = conferencias.filter((c) => {
          const data = dayjs(c.created_date);

          return (
            c.created_by === user.name &&
            data.isSameOrAfter(semana.inicio.startOf("day")) &&
            data.isSameOrBefore(semana.fim.endOf("day"))
          );
        }).length;

        return semanaTotal >= META_SEMANAL;
      }).length;

      /*
       * Meta mensal personalizada.
       */

      const metaMensal =
        metas.find((m) => m.user_name === user.name)?.quantity ?? 500;

      /*
       * Meta mensal mínima baseada nas semanas.
       */

      const metaBaseadaNasSemanas = META_SEMANAL * semanasDoMes.length;

      const dentroMeta = total >= Math.max(metaMensal, metaBaseadaNasSemanas);

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

  /*
   * ============================================================
   * GRÁFICO
   * ============================================================
   */

  const chartData = useMemo(
    () =>
      analytics.map((a) => ({
        name: a.name.length > 10 ? a.name.slice(0, 8) + "..." : a.name,

        Total: a.total,
      })),
    [analytics],
  );

  /*
   * ============================================================
   * ABRIR MODAL DO USUÁRIO
   * ============================================================
   */

  const openUserModal = (user: User) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  /*
   * ============================================================
   * DADOS SEMANAIS DO USUÁRIO
   * ============================================================
   */

  const userWeeklyData = useMemo(() => {
    if (!selectedUser) {
      return [];
    }

    return semanasDoMes.map((semana) => {
      const total = conferencias.filter((c) => {
        const data = dayjs(c.created_date);

        return (
          c.created_by === selectedUser.name &&
          data.isSameOrAfter(semana.inicio.startOf("day")) &&
          data.isSameOrBefore(semana.fim.endOf("day"))
        );
      }).length;

      return {
        semana: `Semana ${semana.numero}`,

        periodo: `${semana.inicio.format(
          "DD/MM",
        )} - ${semana.fim.format("DD/MM")}`,

        total,

        meta: META_SEMANAL,

        atingiuMeta: total >= META_SEMANAL,
      };
    });
  }, [selectedUser, conferencias, semanasDoMes]);

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

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

                      if (user) {
                        openUserModal(user);
                      }
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
              {userWeeklyData.map((d) => (
                <TableRow key={d.semana}>
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
