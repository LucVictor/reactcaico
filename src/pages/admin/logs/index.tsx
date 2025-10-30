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
} from "flowbite-react";
import api from "../../../api";

interface Log {
  id: number;
  action: string;
  description: string;
  user_id: number;
  user_name: string;
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

const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<string[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [openModal, setOpenModal] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      await Promise.all([fetchLogs(), fetchActiveUsers()]);
    };
    fetchAll();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await api.get("/logs");
      if (Array.isArray(res.data)) {
        setLogs(res.data);
      } else {
        // Caso o backend retorne apenas um objeto
        setLogs([res.data]);
      }
    } catch (err) {
      console.error("Erro ao buscar logs:", err);
    } finally {
      setLoading(false);
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
      setOpenModal(true);
    } catch (err) {
      console.error("Erro ao buscar histórico de logins:", err);
    }
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
      <h1 className="mb-6 text-3xl font-bold text-gray-700">
        📜 Logs de Servidor
      </h1>

      <div className="mb-6 flex gap-4">
        <Button onClick={analyzeLogs}>🔍 Análise Antifraude</Button>
        <Button onClick={fetchLoginHistory} color="gray">
          🕓 Histórico de Logins
        </Button>
      </div>

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

      {/* Usuários Ativos */}
      <Card className="mb-6 shadow-md">
        <h2 className="mb-3 text-lg font-semibold text-gray-700">
          👥 Usuários Ativos
        </h2>
        {activeUsers.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhum usuário ativo no momento.
          </p>
        ) : (
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
        )}
      </Card>

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
                  <TableCell>{log.user_name}</TableCell>
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
      <Modal show={openModal} onClose={() => setOpenModal(false)}>
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
    </div>
  );
};

export default LogsPage;
