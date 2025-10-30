import React, { useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  Spinner,
  Modal,
  ModalHeader,
  ModalBody,
  TableHeadCell,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
  Label,
  Select,
  TextInput,
} from "flowbite-react";
import api from "../../../api";

interface Log {
  id: number;
  action: string;
  description: string;
  user_id: number;
  time_stamp: string;
}

interface ActiveUser {
  id: number;
  name: string;
  username: string;
  ip: string;
  hostname: string;
  login_time: string;
  expires_at: string;
}

interface LoginHistory {
  id: number;
  user_id: number;
  username: string;
  ip_address: string;
  hostname: string;
  success: boolean;
  message: string;
  created_at: string;
}

interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  profile_photo: string | null;
  local: number;
  admin: number;
}

const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<string[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [openLoginModal, setOpenLoginModal] = useState(false);
  const [openActiveModal, setOpenActiveModal] = useState(false);

  // Filtros: inicializados para mês atual (YYYY-MM)
  const currentMonth = new Date().toISOString().slice(0, 10); // "YYYY-MM"
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [date1, setDate1] = useState<string>(currentMonth);
  const [date2, setDate2] = useState<string>(currentMonth);

  useEffect(() => {
    // No mount: busca users, active users e logs do mês atual
    const fetchAll = async () => {
      await Promise.all([
        fetchUsers(),
        fetchActiveUsers(),
        fetchLogs({
          date1: date1,
          date2: date2,
        }),
      ]);
    };
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLogs = async (params?: {
    user?: string;
    date1?: string;
    date2?: string;
  }) => {
    try {
      setLoading(true);
      let url = "/logs/";

      const queryParams = new URLSearchParams();
      if (params?.user) queryParams.append("user", params.user);
      if (params?.date1) queryParams.append("date1", params.date1);
      if (params?.date2) queryParams.append("date2", params.date2);

      if (queryParams.toString()) url += `?${queryParams.toString()}`;

      const res = await api.get(url);
      const resData: Log[] = await res.data;
      setLogs(resData.sort((a: Log, b: Log) => b.id - a.id));
    } catch (err) {
      console.error("Erro ao buscar logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data);
    } catch (err) {
      console.error("Erro ao buscar usuários:", err);
    }
  };

  const fetchActiveUsers = async () => {
    try {
      const res = await api.get("/admin/logged-users");
      setActiveUsers(res.data);
    } catch (err) {
      console.error("Erro ao buscar usuários ativos:", err);
    }
  };

  const fetchLoginHistory = async () => {
    try {
      const res = await api.get("/admin/login-history");
      setLoginHistory(res.data);
      setOpenLoginModal(true);
    } catch (err) {
      console.error("Erro ao buscar histórico de logins:", err);
    }
  };

  const handleFilter = () => {
    fetchLogs({
      user: selectedUser || undefined,
      date1: date1 || undefined,
      date2: date2 || undefined,
    });
  };

  const getUserName = (user_id: number) => {
    const user = users.find((u) => u.id === user_id);
    return user ? `${user.name} (${user.username})` : `Usuário #${user_id}`;
  };

  const analyzeLogs = () => {
    const suspicious: string[] = [];

    const grouped = logs.reduce(
      (acc, log) => {
        const match = log.description.match(/(\d+)/);
        if (match) {
          const code = parseInt(match[0]);
          acc[code] = acc[code] || [];
          acc[code].push(log);
        }
        return acc;
      },
      {} as Record<number, Log[]>,
    );

    for (const [code, entries] of Object.entries(grouped)) {
      if (entries.length > 3) {
        suspicious.push(
          `⚠️ Produto com código ${code} possui ${entries.length} ações no período.`,
        );
      }

      const sorted = entries.sort(
        (a, b) =>
          new Date(a.time_stamp).getTime() - new Date(b.time_stamp).getTime(),
      );

      for (let i = 1; i < sorted.length; i++) {
        const diff =
          new Date(sorted[i].time_stamp).getTime() -
          new Date(sorted[i - 1].time_stamp).getTime();
        if (diff < 60000) {
          suspicious.push(
            `⚠️ Ações seguidas para código ${code} — intervalo menor que 1 minuto.`,
          );
        }
      }
    }

    const repeatedActions = logs.filter((log) =>
      /(Cadastrar|Excluir)/i.test(log.action),
    );
    if (repeatedActions.length > 5) {
      suspicious.push(
        `⚠️ ${repeatedActions.length} ações de "Cadastrar" ou "Excluir" detectadas recentemente.`,
      );
    }

    setAnalysis(
      suspicious.length
        ? suspicious
        : ["✅ Nenhum comportamento suspeito encontrado."],
    );
  };

  return (
    <div className="min-h-screen p-8">
      {/* Filtros */}
      <Card className="mb-6 border border-gray-200 shadow-sm">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">
          📜 Logs de Servidor
        </h1>
        <h2 className="mb-3 text-lg font-semibold text-white">Filtros</h2>
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-4">
          <div>
            <Label htmlFor="user">Usuário</Label>
            <Select
              id="user"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="">Todos</option>
              {users.map((user) => (
                <option key={user.id} value={user.id.toString()}>
                  {user.name} ({user.username})
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="date1">Data inicial</Label>
            <TextInput
              id="date1"
              type="date"
              value={date1}
              onChange={(e) => setDate1(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="date2">Data final</Label>
            <TextInput
              id="date2"
              type="date"
              value={date2}
              onChange={(e) => setDate2(e.target.value)}
            />
          </div>

          <div>
            <Button onClick={handleFilter} className="w-full">
              🔎 Filtrar
            </Button>
          </div>
        </div>
        <div className="mt-6 mb-6 flex gap-4">
          <Button onClick={analyzeLogs}>🔍 Análise Antifraude</Button>

          {/* Botão Usuários Ativos (novo) */}
          <Button
            onClick={async () => {
              await fetchActiveUsers();
              setOpenActiveModal(true);
            }}
          >
            👥 Usuários Ativos
          </Button>

          <Button onClick={fetchLoginHistory} color="gray">
            🕓 Histórico de Logins
          </Button>
        </div>
      </Card>

      {analysis.length > 0 && (
        <Card className="mb-6 border border-yellow-300 bg-yellow-50 shadow-md">
          <h2 className="mb-2 text-lg font-semibold text-yellow-800">
            Resultado da Análise
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-yellow-700">
            {analysis.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </Card>
      )}

      {/* Logs */}
      <Card className="shadow-md">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner size="xl" />
          </div>
        ) : logs.length === 0 ? (
          <p className="py-5 text-center text-gray-500">
            Nenhum log encontrado.
          </p>
        ) : (
          <Table hoverable>
            <TableHead>
              <TableRow>
                <TableHeadCell>Ação</TableHeadCell>
                <TableHeadCell>Descrição</TableHeadCell>
                <TableHeadCell>Usuário</TableHeadCell>
                <TableHeadCell>Data</TableHeadCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.action}</TableCell>
                  <TableCell>{log.description}</TableCell>
                  <TableCell>{getUserName(log.user_id)}</TableCell>
                  <TableCell>
                    {new Date(log.time_stamp).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Modal de Histórico de Logins */}
      <Modal show={openLoginModal} onClose={() => setOpenLoginModal(false)}>
        <ModalHeader>🕓 Histórico de Logins</ModalHeader>
        <ModalBody>
          {loginHistory.length === 0 ? (
            <p className="text-gray-500">Nenhum histórico encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table hoverable>
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>IP</th>
                    <th>Hostname</th>
                    <th>Mensagem</th>
                    <th>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {loginHistory.map((item) => (
                    <tr key={item.id}>
                      <td>{item.username}</td>
                      <td>{item.ip_address}</td>
                      <td>{item.hostname}</td>
                      <td
                        className={
                          item.success ? "text-green-600" : "text-red-600"
                        }
                      >
                        {item.message}
                      </td>
                      <td>{new Date(item.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </ModalBody>
      </Modal>

      {/* Modal Usuários Ativos (aberto pelo botão) */}
      <Modal show={openActiveModal} onClose={() => setOpenActiveModal(false)}>
        <ModalHeader>👥 Usuários Ativos</ModalHeader>
        <ModalBody>
          {activeUsers.length === 0 ? (
            <p className="text-gray-500">Nenhum usuário ativo no momento.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table hoverable>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Usuário</th>
                    <th>IP</th>
                    <th>Hostname</th>
                    <th>Login</th>
                    <th>Expira</th>
                  </tr>
                </thead>
                <tbody>
                  {activeUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td>{user.username}</td>
                      <td>{user.ip}</td>
                      <td>{user.hostname}</td>
                      <td>{new Date(user.login_time).toLocaleString()}</td>
                      <td>{new Date(user.expires_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </ModalBody>
      </Modal>
    </div>
  );
};

export default LogsPage;
