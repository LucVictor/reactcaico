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
  Modal,
  Spinner,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Badge,
  Tooltip,
} from "flowbite-react";
import dayjs from "dayjs";
import api from "../../api";
import { useAuthStore } from "../authStore";

interface Log {
  id: number;
  action: string;
  description: string;
  user_id: number;
  time_stamp: string;
}

interface ProdutoConferidoProps {
  id: number;
  product_name: string;
  product_code: number;
  quantity_real: number;
  quantity_system: number;
  diference: number;
  cost_total: number;
  created_date: string;
  created_by: string;
}

interface ProdutoAvariaProps {
  id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  cost: number;
  damaged_date: string;
  cost_total: string;
  created_date: string;
  shelflife_date: string;
  last_mod: string;
  created_by: string;
  type: number;
  origin: number;
  local: number;
}

interface Receipt {
  id: number;
  user_id: number;
  user_name: string;
  quantity?: number;
  local: number;
  created_date: string;
  time_stamp?: string;
  completed: boolean;
  approved: boolean;
  photo?: string | null;
}

interface ChecklistItem {
  nome: string;
  registros: any[];
  status: Record<string, boolean>;
}

export default function ChecklistSemana() {
  const user = useAuthStore((state) => state.user);
  const [semanaSelecionada, setSemanaSelecionada] = useState("");
  const [diasSemana, setDiasSemana] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modoImpressao, setModoImpressao] = useState(false);

  // Modal
  const [openModal, setOpenModal] = useState(false);
  const [tarefaSelecionada, setTarefaSelecionada] =
    useState<ChecklistItem | null>(null);
  const [diaSelecionado, setDiaSelecionado] = useState("");

  // Metas por dia (para tooltip)
  const [metaPorDia, setMetaPorDia] = useState<Record<string, number>>({});
  const [conferidosPorDia, setConferidosPorDia] = useState<
    Record<string, number>
  >({});

  const gerarDiasSemana = (semana: string): string[] => {
    const inicio = dayjs(semana).startOf("week").add(1, "day");
    return Array.from({ length: 6 }, (_, i) =>
      inicio.add(i, "day").format("YYYY-MM-DD"),
    );
  };

  const carregarDados = async (): Promise<void> => {
    if (!user || !semanaSelecionada) return;
    setLoading(true);

    try {
      const dias = gerarDiasSemana(semanaSelecionada);
      setDiasSemana(dias);

      const inicio = dayjs(semanaSelecionada)
        .startOf("week")
        .add(1, "day")
        .format("YYYY-MM-DD");
      const fim = dayjs(semanaSelecionada)
        .endOf("week")
        .subtract(1, "day")
        .format("YYYY-MM-DD");

      // 🟢 Buscar meta mensal
      const mesSelecionado = dayjs(semanaSelecionada).format("YYYY-MM");
      const metaRes = await api.get(`/target/conference/${mesSelecionado}`);
      const metaMensal = metaRes.data?.[0]?.quantity ?? 400;

      // Buscar dados principais
      const [conferidosRes, logsRes, avariasRes, recebimentosRes] =
        await Promise.all([
          api.get<ProdutoConferidoProps[]>("/conference/between", {
            params: { date1: inicio, date2: fim, user: user.id },
          }),
          api.get<Log[]>("/logs/"),
          api.get<ProdutoAvariaProps[]>("/damaged/between", {
            params: { date1: inicio, date2: fim },
          }),
          api.get<Receipt[]>("/receipt/"),
        ]);

      const conferidos = conferidosRes.data || [];
      const logs = logsRes.data || [];
      const avariasAll = avariasRes.data || [];
      const recebimentosAll = recebimentosRes.data || [];

      const avarias = avariasAll.filter((a) => a.created_by === user.name);
      const recebimentos = recebimentosAll.filter((r) => r.user_id === user.id);

      const logsVencimentos = logs.filter(
        (log) =>
          log.user_id === user.id &&
          ["Cadastrar", "Editar", "Excluir"].includes(log.action) &&
          log.description.toLowerCase().includes("vencimento"),
      );

      // 🧮 Buscar conferências do mês
      const primeiroDiaMes = dayjs(semanaSelecionada)
        .startOf("month")
        .format("YYYY-MM-DD");
      const ultimoDiaMes = dayjs(semanaSelecionada)
        .endOf("month")
        .format("YYYY-MM-DD");

      const mesConferidosRes = await api.get(`/conference/between`, {
        params: { date1: primeiroDiaMes, date2: ultimoDiaMes, user: user.id },
      });
      const conferidosMes = mesConferidosRes.data || [];

      const confPorDia: Record<string, number> = {};
      conferidosMes.forEach((p: any) => {
        const dia = p.created_date.split("T")[0];
        confPorDia[dia] = (confPorDia[dia] || 0) + 1;
      });
      setConferidosPorDia(confPorDia);

      // 🗓️ Calcular meta diária (dias úteis)
      const [ano, mes] = mesSelecionado.split("-").map(Number);
      const diasNoMes = new Date(ano, mes, 0).getDate();

      const diasUteis = Array.from({ length: diasNoMes }, (_, i) => {
        const data = new Date(ano, mes - 1, i + 1);
        const diaSemana = data.getDay();
        return diaSemana !== 0 && diaSemana !== 6 ? data : null;
      }).filter(Boolean) as Date[];

      let restante = metaMensal;
      let diasRestantes = diasUteis.length;
      const metaPorDiaTemp: Record<string, number> = {};

      for (let i = 1; i <= diasNoMes; i++) {
        const data = new Date(ano, mes - 1, i);
        const formato = data.toISOString().split("T")[0];
        const diaSemana = data.getDay();
        const fimDeSemana = diaSemana === 0 || diaSemana === 6;

        const metaDia =
          diasRestantes > 0 && !fimDeSemana
            ? Math.round(restante / diasRestantes)
            : 0;
        const quantidade = confPorDia[formato] || 0;

        if (!fimDeSemana) {
          restante -= quantidade;
          diasRestantes--;
        }

        metaPorDiaTemp[formato] = metaDia;
      }

      setMetaPorDia(metaPorDiaTemp);

      // ✅ Status da conferência (com meta diária)
      const statusConferencia: Record<string, boolean> = {};
      dias.forEach((dia) => {
        const count = conferidos.filter(
          (c) => Boolean(c.created_date) && c.created_date.startsWith(dia),
        ).length;
        const metaDia = metaPorDiaTemp[dia] ?? 30;
        statusConferencia[dia] = count >= metaDia;
      });

      // 🔹 Demais status
      const gerarStatus = (
        dados: any[],
        campoData: string,
      ): Record<string, boolean> => {
        const status: Record<string, boolean> = {};
        dias.forEach((dia) => {
          const tem = dados.some(
            (d) => Boolean(d?.[campoData]) && d[campoData].startsWith(dia),
          );
          status[dia] = tem;
        });
        return status;
      };

      const statusVencimentos = gerarStatus(logsVencimentos, "time_stamp");
      const statusAvarias = gerarStatus(avarias, "created_date");
      const statusRecebimentos = gerarStatus(recebimentos, "created_date");

      const statusNegativos: Record<string, boolean> = {};
      dias.forEach((dia) => {
        const countNegativos = conferidos.filter(
          (c) =>
            Boolean(c.created_date) &&
            c.created_date.startsWith(dia) &&
            c.quantity_system < 0,
        ).length;
        statusNegativos[dia] = countNegativos >= 5;
      });

      const tarefas: ChecklistItem[] = [
        {
          nome: "Conferência",
          registros: conferidos,
          status: statusConferencia,
        },
        {
          nome: "Validades",
          registros: logsVencimentos,
          status: statusVencimentos,
        },
        { nome: "Avarias", registros: avarias, status: statusAvarias },
        {
          nome: "Recebimento",
          registros: recebimentos,
          status: statusRecebimentos,
        },
        {
          nome: "Negativos",
          registros: conferidos.filter((c) => c.quantity_system < 0),
          status: statusNegativos,
        },
      ];

      setChecklist(tarefas);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (semanaSelecionada && user) carregarDados();
  }, [semanaSelecionada, user]);

  const abrirModal = (tarefa: ChecklistItem, dia: string): void => {
    setTarefaSelecionada(tarefa);
    setDiaSelecionado(dia);
    setOpenModal(true);
  };

  const registrosDoDia = (t: ChecklistItem, dia: string) => {
    if (!t) return [];
    const campo = t.nome === "Validades" ? "time_stamp" : "created_date";
    return t.registros.filter(
      (r: any) => Boolean(r[campo]) && r[campo].startsWith(dia),
    );
  };

  const handlePrint = (): void => {
    setModoImpressao(true);
    setTimeout(() => {
      window.print();
      setModoImpressao(false);
    }, 100);
  };

  return (
    <div
      className={`m-5 space-y-6 rounded-2xl bg-gray-800 p-6 opacity-95 ${modoImpressao ? "bg-white" : "print:p-0"}`}
    >
      {!modoImpressao && (
        <div className="flex flex-col items-center justify-between print:hidden">
          <h1 className="w-full text-center text-2xl font-bold text-white">
            Checklist Semanal
          </h1>
          <div className="flex w-full items-end justify-end align-baseline">
            <Button color="gray" onClick={handlePrint}>
              🖨️ Imprimir
            </Button>
          </div>
        </div>
      )}

      {!modoImpressao && (
        <div className="flex justify-center print:hidden">
          <Select
            onChange={(e) => setSemanaSelecionada(e.target.value)}
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
        </div>
      )}

      {loading && (
        <div className="flex justify-center p-4">
          <Spinner size="lg" />
        </div>
      )}

      {!loading && semanaSelecionada && checklist.length > 0 && (
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

                    const meta = metaPorDia[dia] ?? 30;
                    const feitos = conferidosPorDia[dia] ?? 0;

                    return (
                      <TableCell key={dia}>
                        <Tooltip
                          content={`Conferidos: ${feitos} / Meta: ${meta}`}
                        >
                          <button
                            onClick={() => abrirModal(tarefa, dia)}
                            className={`flex h-10 w-10 items-center justify-center rounded-full text-xl leading-none transition-transform hover:scale-110 ${colorClass}`}
                          >
                            {icon}
                          </button>
                        </Tooltip>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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

              switch (tarefaSelecionada.nome) {
                case "Conferência":
                  return (
                    <Table>
                      <TableHead>
                        <TableHeadCell>Código</TableHeadCell>
                        <TableHeadCell>Produto</TableHeadCell>
                        <TableHeadCell>Diferença</TableHeadCell>
                        <TableHeadCell>Usuário</TableHeadCell>
                      </TableHead>
                      <TableBody>
                        {regs.map((r: ProdutoConferidoProps) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.product_code}</TableCell>
                            <TableCell>{r.product_name}</TableCell>
                            <TableCell>{r.diference}</TableCell>
                            <TableCell>{r.created_by}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  );
                case "Validades":
                  return (
                    <Table>
                      <TableHead>
                        <TableHeadCell>Ação</TableHeadCell>
                        <TableHeadCell>Descrição</TableHeadCell>
                        <TableHeadCell>Data</TableHeadCell>
                      </TableHead>
                      <TableBody>
                        {regs.map((r: Log) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <Badge
                                color={
                                  r.action === "Cadastrar"
                                    ? "success"
                                    : r.action === "Editar"
                                      ? "warning"
                                      : "failure"
                                }
                              >
                                {r.action}
                              </Badge>
                            </TableCell>
                            <TableCell>{r.description}</TableCell>
                            <TableCell>
                              {dayjs(r.time_stamp).format("DD/MM/YYYY HH:mm")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  );
                case "Avarias":
                  return (
                    <Table>
                      <TableHead>
                        <TableHeadCell>Código</TableHeadCell>
                        <TableHeadCell>Produto</TableHeadCell>
                        <TableHeadCell>Quantidade</TableHeadCell>
                        <TableHeadCell>Usuário</TableHeadCell>
                      </TableHead>
                      <TableBody>
                        {regs.map((r: ProdutoAvariaProps) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.product_code}</TableCell>
                            <TableCell>{r.product_name}</TableCell>
                            <TableCell>{r.quantity}</TableCell>
                            <TableCell>{r.created_by}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  );
                case "Negativos":
                  return (
                    <Table>
                      <TableHead>
                        <TableHeadCell>Código</TableHeadCell>
                        <TableHeadCell>Produto</TableHeadCell>
                        <TableHeadCell>Quantity System</TableHeadCell>
                      </TableHead>
                      <TableBody>
                        {regs.map((r: ProdutoConferidoProps) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.product_code}</TableCell>
                            <TableCell>{r.product_name}</TableCell>
                            <TableCell>{r.quantity_system}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  );
                default:
                  return (
                    <Table>
                      <TableHead>
                        <TableHeadCell>ID</TableHeadCell>
                        <TableHeadCell>Usuário</TableHeadCell>
                        <TableHeadCell>Quantidade</TableHeadCell>
                        <TableHeadCell>Data</TableHeadCell>
                      </TableHead>
                      <TableBody>
                        {regs.map((r: Receipt) => (
                          <TableRow key={r.id}>
                            <TableCell>{r.id}</TableCell>
                            <TableCell>{r.user_name}</TableCell>
                            <TableCell>{r.quantity ?? "—"}</TableCell>
                            <TableCell>
                              {dayjs(r.created_date).format("DD/MM/YYYY HH:mm")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  );
              }
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
