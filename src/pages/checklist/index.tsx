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

// -------------------- TIPOS --------------------

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
  product_code: string;
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

// -------------------- COMPONENTE --------------------

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

  // Metas por dia
  const [metaPorDia, setMetaPorDia] = useState<Record<string, number>>({});
  const [conferidosPorDia, setConferidosPorDia] = useState<
    Record<string, number>
  >({});

  // -------------------- FUNÇÕES --------------------

  const gerarDiasSemana = (semana: string): string[] => {
    const inicio = dayjs(semana); // já é a segunda-feira correta
    return Array.from({ length: 6 }, (_, i) =>
      inicio.add(i, "day").format("YYYY-MM-DD"),
    );
  };

  const carregarDados = async () => {
    if (!user || !semanaSelecionada) return;

    setLoading(true);
    try {
      // -------------------- DIAS DA SEMANA --------------------
      const dias = gerarDiasSemana(semanaSelecionada);
      setDiasSemana(dias);

      const inicio = dayjs(semanaSelecionada).format("YYYY-MM-DD");

      const fim = dayjs(semanaSelecionada).add(5, "day").format("YYYY-MM-DD");

      // -------------------- META MENSAL --------------------
      const mesSelecionado = dayjs(semanaSelecionada).format("YYYY-MM");

      // API retorna metas de TODOS os usuários neste mês
      const metaRes = await api.get(`/target/conference/${mesSelecionado}`);
      console.log("Resposta da API de metas:", metaRes.data);

      // pegar a meta do usuário logado
      const metas = metaRes.data || [];
      const metaDoUsuario = metas.find((m: any) => m.user_id === user.id);
      console.log("Meta do usuário:", metaDoUsuario);

      // quantidade = meta mensal
      const metaMensal = metaDoUsuario ? metaDoUsuario.quantity : 0;
      console.log("Meta mensal do usuário:", metaMensal);
      // -------------------- BUSCAR DADOS --------------------
      const [conferidosRes, logsRes, avariasRes, recebimentosRes] =
        await Promise.all([
          api.get("/conference/between", {
            params: { date1: inicio, date2: fim, user: user.id },
          }),
          api.get("/logs/"),
          api.get("/damaged/between", {
            params: { date1: inicio, date2: fim },
          }),
          api.get("/receipt/"),
        ]);

      const conferidos = conferidosRes.data || [];
      const logs = logsRes.data || [];
      const avariasAll = avariasRes.data || [];
      const recebimentosAll = recebimentosRes.data || [];

      const avarias = avariasAll.filter((a: any) => a.created_by === user.name);
      const recebimentos = recebimentosAll.filter(
        (r: any) => r.user_id === user.id,
      );

      // -------------------- LOGS DE VALIDADE --------------------
      const logsVencimentos = logs.filter(
        (log: any) =>
          log.user_id === user.id &&
          ["Cadastrar", "Editar", "Excluir"].includes(log.action) &&
          log.description.toLowerCase().includes("vencimento"),
      );

      // -------------------- CONFERIDOS DO MÊS (META) --------------------
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

      // -------------------- META DIÁRIA --------------------
      const [ano, mes] = mesSelecionado.split("-").map(Number);
      const diasNoMes = new Date(ano, mes, 0).getDate();

      const diasUteis = Array.from({ length: diasNoMes }, (_, i) => {
        const d = new Date(ano, mes - 1, i + 1);
        const s = d.getDay();
        return s !== 0 && s !== 6 ? d : null;
      }).filter(Boolean) as Date[];

      let restante = metaMensal;
      let diasRestantes = diasUteis.length;

      const metaPorDiaTemp: Record<string, number> = {};

      for (let i = 1; i <= diasNoMes; i++) {
        const data = new Date(ano, mes - 1, i);
        const formato = dayjs(data).format("YYYY-MM-DD");

        const diaSemana = data.getDay();
        const fimDeSemana = diaSemana === 0 || diaSemana === 6;

        const metaDia =
          diasRestantes > 0 && !fimDeSemana
            ? Math.round(restante / diasRestantes)
            : 0;

        const feitos = confPorDia[formato] || 0;

        if (!fimDeSemana) {
          restante -= feitos;
          diasRestantes--;
        }

        metaPorDiaTemp[formato] = metaDia;
      }

      setMetaPorDia(metaPorDiaTemp);

      // -------------------- STATUS --------------------

      const statusConferencia: Record<string, boolean> = {};
      dias.forEach((dia) => {
        const count = conferidos.filter((c: any) =>
          c.created_date?.startsWith(dia),
        ).length;

        const meta = metaPorDiaTemp[dia] ?? 0;
        statusConferencia[dia] = count >= meta;
      });

      const gerarStatus = (dados: any[], campo: string) => {
        const status: Record<string, boolean> = {};
        dias.forEach((dia) => {
          status[dia] = dados.some((d) => d[campo]?.startsWith(dia));
        });
        return status;
      };

      const statusVencimentos = gerarStatus(logsVencimentos, "time_stamp");
      const statusAvarias = gerarStatus(avarias, "created_date");
      const statusRecebimentos = gerarStatus(recebimentos, "created_date");

      const isRegistroNegativo = (registro: any) =>
        Number(registro?.quantity_system ?? 0) < 0;

      const statusNegativos: Record<string, boolean> = {};
      dias.forEach((dia) => {
        const countNegativos = conferidos.filter(
          (c: any) => c.created_date?.startsWith(dia) && isRegistroNegativo(c),
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
          registros: conferidos.filter(isRegistroNegativo),
          status: statusNegativos,
        },
      ];

      setChecklist(tarefas);
    } finally {
      setLoading(false);
    }
  };

  // Atualizar ao selecionar semana
  useEffect(() => {
    if (semanaSelecionada && user) carregarDados();
  }, [semanaSelecionada, user]);

  // -------------------- MODAL --------------------

  const abrirModal = (tarefa: ChecklistItem, dia: string) => {
    setTarefaSelecionada(tarefa);
    setDiaSelecionado(dia);
    setOpenModal(true);
  };

  const registrosDoDia = (t: ChecklistItem, dia: string) => {
    const campo = t.nome === "Validades" ? "time_stamp" : "created_date";
    return t.registros.filter((r) => r[campo]?.startsWith(dia));
  };

  // -------------------- IMPRESSÃO --------------------

  const handlePrint = () => {
    setModoImpressao(true);
    setTimeout(() => {
      window.print();
      setModoImpressao(false);
    }, 150);
  };

  // -------------------- JSX --------------------

  return (
    <div
      className={`m-5 space-y-6 rounded-2xl bg-gray-800 p-6 opacity-95 ${modoImpressao ? "bg-white" : "print:p-0"}`}
    >
      {/* CABEÇALHO */}
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

      {/* SELECT DA SEMANA */}
      {!modoImpressao && (
        <div className="flex justify-center print:hidden">
          <Select
            onChange={(e) => setSemanaSelecionada(e.target.value)}
            className="max-w-xs"
          >
            <option value="">Selecione a semana</option>
            {[...Array(6)].map((_, i) => {
              const data = dayjs()
                .subtract(i, "week")
                .startOf("week")
                .add(1, "day");
              return (
                <option key={i} value={data.format("YYYY-MM-DD")}>
                  Semana de {data.format("DD/MM/YYYY")}
                </option>
              );
            })}
          </Select>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="flex justify-center p-4">
          <Spinner size="lg" />
        </div>
      )}

      {/* TABELA PRINCIPAL */}
      {!loading && semanaSelecionada && checklist.length > 0 && (
        <div className="overflow-x-auto rounded-xl shadow-md dark:bg-gray-800">
          <Table hoverable striped>
            <TableHead className="bg-gray-100 dark:bg-gray-700">
              <TableHeadCell className="w-48 text-center align-middle">
                Tarefa
              </TableHeadCell>
              {diasSemana.map((dia) => (
                <TableHeadCell key={dia} className="text-center align-middle">
                  {dayjs(dia).format("ddd DD/MM")}
                </TableHeadCell>
              ))}
            </TableHead>

            <TableBody>
              {checklist.map((tarefa, i) => (
                <TableRow key={i} className="text-center align-middle">
                  <TableCell className="text-center align-middle font-semibold">
                    {tarefa.nome}
                  </TableCell>

                  {diasSemana.map((dia) => {
                    const status = tarefa.status[dia];
                    const icon = status ? "✅" : "❌";
                    const colorClass = status
                      ? "text-green-600 hover:bg-green-200"
                      : "text-red-500 hover:bg-red-200";

                    const meta = metaPorDia[dia] ?? 0;
                    const feitos = conferidosPorDia[dia] ?? 0;

                    const conteudoTooltip =
                      tarefa.nome === "Conferência"
                        ? `Conferidos: ${feitos} / Meta: ${meta}`
                        : "";

                    const botao = (
                      <button
                        onClick={() => abrirModal(tarefa, dia)}
                        className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-xl leading-none transition-transform hover:scale-110 ${colorClass}`}
                      >
                        {icon}
                      </button>
                    );

                    return (
                      <TableCell key={dia} className="text-center align-middle">
                        <div className="flex items-center justify-center">
                          {tarefa.nome === "Conferência" ? (
                            <Tooltip content={conteudoTooltip} placement="top">
                              {botao}
                            </Tooltip>
                          ) : (
                            botao
                          )}
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

      {/* MODAL DE DETALHES */}
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
                        <TableHeadCell>Quantidade Sistema</TableHeadCell>
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
