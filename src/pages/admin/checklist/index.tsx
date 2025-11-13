import { useEffect, useState } from "react";
import {
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Select,
  Spinner,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "flowbite-react";
import dayjs from "dayjs";
import api from "../../../api";

interface User {
  id: number;
  name: string;
}

interface ChecklistItem {
  nome: string;
  registros: any[];
  status: Record<string, boolean>;
}

export default function AdminChecklist() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | "">("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [diasSemana, setDiasSemana] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [openModal, setOpenModal] = useState(false);
  const [tarefaSelecionada, setTarefaSelecionada] =
    useState<ChecklistItem | null>(null);
  const [diaSelecionado, setDiaSelecionado] = useState("");

  useEffect(() => {
    api.get<User[]>("/admin/users").then((res) => setUsers(res.data || []));
  }, []);

  const gerarDiasSemana = (semana: string): string[] => {
    const inicio = dayjs(semana).startOf("week").add(1, "day");
    return Array.from({ length: 6 }, (_, i) =>
      inicio.add(i, "day").format("YYYY-MM-DD"),
    );
  };

  const carregarChecklist = async () => {
    if (!selectedUser || !selectedWeek) return;
    setLoading(true);

    try {
      const dias = gerarDiasSemana(selectedWeek);
      setDiasSemana(dias);

      const inicio = dayjs(selectedWeek)
        .startOf("week")
        .add(1, "day")
        .format("YYYY-MM-DD");
      const fim = dayjs(selectedWeek)
        .endOf("week")
        .subtract(1, "day")
        .format("YYYY-MM-DD");

      // 🟢 Buscar meta mensal de conferência
      const mesSelecionado = dayjs(selectedWeek).format("YYYY-MM");
      const metaRes = await api.get(`/target/conference/${mesSelecionado}`);
      const metaMensal = metaRes.data?.[0]?.quantity ?? 400;

      // Buscar dados necessários
      const [conferidosRes, logsRes, avariasRes, recebimentosRes] =
        await Promise.all([
          api.get(`/conference/between`, {
            params: { date1: inicio, date2: fim, user: selectedUser },
          }),
          api.get(`/logs/`),
          api.get(`/damaged/between`, {
            params: { date1: inicio, date2: fim },
          }),
          api.get(`/receipt/`),
        ]);

      const conferidos = conferidosRes.data || [];
      const logs = logsRes.data || [];
      const avariasAll = avariasRes.data || [];
      const recebimentosAll = recebimentosRes.data || [];

      // 🧮 Calcular total de conferências no mês (para meta diária)
      const primeiroDiaMes = dayjs(selectedWeek)
        .startOf("month")
        .toISOString()
        .slice(0, 10);
      const ultimoDiaMes = dayjs(selectedWeek)
        .endOf("month")
        .toISOString()
        .slice(0, 10);

      const mesConferidosRes = await api.get(`/conference/between`, {
        params: {
          date1: primeiroDiaMes,
          date2: ultimoDiaMes,
          user: selectedUser,
        },
      });
      const conferidosMes = mesConferidosRes.data || [];

      // Agrupar por dia
      const conferidosPorDia: Record<string, number> = {};
      conferidosMes.forEach((p: any) => {
        const dia = p.created_date.split("T")[0];
        conferidosPorDia[dia] = (conferidosPorDia[dia] || 0) + 1;
      });

      // Calcular metas diárias com base nos dias úteis do mês
      const [ano, mes] = mesSelecionado.split("-").map(Number);
      const diasNoMes = new Date(ano, mes, 0).getDate();

      const diasUteis = Array.from({ length: diasNoMes }, (_, i) => {
        const data = new Date(ano, mes - 1, i + 1);
        const diaSemana = data.getDay();
        return diaSemana !== 0 && diaSemana !== 6 ? data : null;
      }).filter(Boolean) as Date[];

      let restante = metaMensal;
      let diasRestantes = diasUteis.length;
      const metaPorDia: Record<string, number> = {};

      for (let i = 1; i <= diasNoMes; i++) {
        const data = new Date(ano, mes - 1, i);
        const formato = data.toISOString().split("T")[0];
        const diaSemana = data.getDay();
        const fimDeSemana = diaSemana === 0 || diaSemana === 6;

        const metaDia =
          diasRestantes > 0 && !fimDeSemana
            ? Math.round(restante / diasRestantes)
            : 0;
        const quantidade = conferidosPorDia[formato] || 0;

        if (!fimDeSemana) {
          restante -= quantidade;
          diasRestantes--;
        }

        metaPorDia[formato] = metaDia;
      }

      // 🧩 Substituir o cálculo fixo (>= 30) por meta diária
      const statusConferencia: Record<string, boolean> = {};
      dias.forEach((dia) => {
        const count = conferidos.filter(
          (c: any) => Boolean(c.created_date) && c.created_date.startsWith(dia),
        ).length;
        const metaDia = metaPorDia[dia] ?? 30; // fallback
        statusConferencia[dia] = count >= metaDia;
      });

      // Restante igual antes
      const gerarStatus = (dados: any[], campoData: string) => {
        const status: Record<string, boolean> = {};
        dias.forEach((dia) => {
          status[dia] = dados.some(
            (d) => Boolean(d?.[campoData]) && d[campoData].startsWith(dia),
          );
        });
        return status;
      };

      const statusVencimentos = gerarStatus(
        logs.filter((l: any) => l.user_id === selectedUser),
        "time_stamp",
      );
      const statusAvarias = gerarStatus(
        avariasAll.filter(
          (a: any) =>
            a.created_by === users.find((u) => u.id === selectedUser)?.name,
        ),
        "created_date",
      );
      const statusRecebimentos = gerarStatus(
        recebimentosAll.filter((r: any) => r.user_id === selectedUser),
        "created_date",
      );

      const statusNegativos: Record<string, boolean> = {};
      dias.forEach((dia) => {
        const countNegativos = conferidos.filter(
          (c: any) =>
            Boolean(c.created_date) &&
            c.created_date.startsWith(dia) &&
            c.quantity_system < 0,
        ).length;
        statusNegativos[dia] = countNegativos >= 5;
      });

      setChecklist([
        {
          nome: "Conferência",
          registros: conferidos,
          status: statusConferencia,
        },
        {
          nome: "Validades",
          registros: logs.filter((l: any) => l.user_id === selectedUser),
          status: statusVencimentos,
        },
        {
          nome: "Avarias",
          registros: avariasAll.filter(
            (a: any) =>
              a.created_by === users.find((u) => u.id === selectedUser)?.name,
          ),
          status: statusAvarias,
        },
        {
          nome: "Recebimento",
          registros: recebimentosAll.filter(
            (r: any) => r.user_id === selectedUser,
          ),
          status: statusRecebimentos,
        },
        {
          nome: "Negativos",
          registros: conferidos.filter((c: any) => c.quantity_system < 0),
          status: statusNegativos,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };
  const abrirModal = (tarefa: ChecklistItem, dia: string) => {
    setTarefaSelecionada(tarefa);
    setDiaSelecionado(dia);
    setOpenModal(true);
  };

  const registrosDoDia = (t: ChecklistItem, dia: string) => {
    if (!t) return [];
    const campo = t.nome === "Validades" ? "time_stamp" : "created_date";
    return t.registros.filter(
      (r) => Boolean(r[campo]) && r[campo].startsWith(dia),
    );
  };

  // 🟢 Função para gerar e baixar CSV
  const baixarCSV = () => {
    if (checklist.length === 0) return;

    let csv = "Tarefa,Data,Campo,Valor\n";

    checklist.forEach((t) => {
      t.registros.forEach((r) => {
        const data =
          r.created_date ||
          r.time_stamp ||
          r.damaged_date ||
          r.shelflife_date ||
          "";
        Object.entries(r).forEach(([campo, valor]) => {
          csv += `${t.nome},"${data}","${campo}","${String(valor).replace(/"/g, "'")}"\n`;
        });
      });
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const userName =
      users.find((u) => u.id === selectedUser)?.name?.replace(/\s/g, "_") ||
      "user";
    a.download = `checklist_${userName}_${dayjs(selectedWeek).format("YYYY-MM-DD")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-center text-2xl font-bold">Checklist Admin</h1>

      {/* Seleção e botões */}
      <div className="flex flex-wrap justify-center gap-4">
        <Select
          value={selectedUser}
          onChange={(e) => setSelectedUser(Number(e.target.value))}
          className="max-w-xs"
        >
          <option value="">Selecione um usuário</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>

        <Select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="max-w-xs"
        >
          <option value="">Selecione a semana</option>
          {[...Array(6)].map((_, i) => {
            const data = dayjs().subtract(i, "week").startOf("week");
            return (
              <option key={i} value={data.toISOString()}>
                Semana de {data.add(1, "day").format("DD/MM/YYYY")}
              </option>
            );
          })}
        </Select>

        <Button
          onClick={carregarChecklist}
          disabled={!selectedUser || !selectedWeek}
        >
          Buscar
        </Button>

        <Button
          color="success"
          disabled={checklist.length === 0}
          onClick={baixarCSV}
        >
          ⬇️ Baixar CSV
        </Button>
      </div>

      {/* Carregando */}
      {loading && (
        <div className="flex justify-center p-4">
          <Spinner size="lg" />
        </div>
      )}

      {/* Tabela */}
      {!loading && checklist.length > 0 && (
        <div className="overflow-x-auto rounded-xl shadow-md dark:bg-gray-800">
          <Table hoverable striped>
            <TableHead className="bg-gray-100 dark:bg-gray-700">
              <TableHeadCell className="w-48 text-center">Tarefa</TableHeadCell>
              {diasSemana.map((dia) => (
                <TableHeadCell key={dia} className="text-center">
                  {dayjs(dia).format("ddd DD/MM")}
                </TableHeadCell>
              ))}
            </TableHead>
            <TableBody>
              {checklist.map((tarefa, i) => (
                <TableRow key={i} className="text-center">
                  <TableCell className="font-semibold">{tarefa.nome}</TableCell>
                  {diasSemana.map((dia) => {
                    const status = tarefa.status[dia];
                    const icon = status ? "✅" : "❌";
                    const colorClass = status
                      ? "text-green-600 hover:bg-green-200"
                      : "text-red-500 hover:bg-red-200";
                    return (
                      <TableCell key={dia}>
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => abrirModal(tarefa, dia)}
                            className={`flex h-10 w-10 items-center justify-center rounded-full text-xl leading-none ${colorClass}`}
                          >
                            {icon}
                          </button>
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal de detalhes */}
      <Modal show={openModal} size="4xl" onClose={() => setOpenModal(false)}>
        <ModalHeader>
          {tarefaSelecionada?.nome} —{" "}
          {dayjs(diaSelecionado).format("DD/MM/YYYY")}
        </ModalHeader>
        <ModalBody>
          {tarefaSelecionada ? (
            (() => {
              const regs = registrosDoDia(tarefaSelecionada, diaSelecionado);
              if (regs.length === 0)
                return (
                  <p className="text-center text-gray-500">
                    Nenhum registro encontrado neste dia.
                  </p>
                );

              return (
                <Table>
                  <TableHead>
                    {Object.keys(regs[0]).map((c) => (
                      <TableHeadCell key={c}>{c}</TableHeadCell>
                    ))}
                  </TableHead>
                  <TableBody>
                    {regs.map((r: any) => (
                      <TableRow key={r.id}>
                        {Object.keys(r).map((c) => (
                          <TableCell key={c}>{String(r[c])}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              );
            })()
          ) : (
            <p>Nenhuma tarefa selecionada.</p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => setOpenModal(false)}>Fechar</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
