import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  Progress,
  Select,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  TextInput,
  ToggleSwitch,
} from "flowbite-react";
import { HiRefresh } from "react-icons/hi";

import api, { API_URL } from "../../../api";
import avatarFallback from "../../../static/user.png";
import {
  META_SEMANAL_PADRAO,
  WeeklyConferenceProgress,
  WeeklyConferenceTable,
  corDoProgresso,
  formatarMesLabel,
  formatarNumero,
  getApiErrorMessage,
  normalizarTexto,
  type AdminWeeklyConferenceResponse,
  type AdminWeeklyConferenceUser,
} from "../../metas/weeklyConference";

/* ============================================================
   Painel administrativo — /admin/conferencia/semanal
   Consome GET /target/admin/conference/weekly/{month}
============================================================ */

interface AdminUser {
  id: number;
  name: string;
  username?: string;
  profile_photo?: string | null;
}

type Aba = "consolidado" | "usuarios";
type Ordenacao = "total" | "nome" | "meta";

function urlFoto(profilePhoto?: string | null) {
  if (!profilePhoto) return avatarFallback;
  if (/^https?:\/\//i.test(profilePhoto)) return profilePhoto;
  return `${API_URL.replace(/\/$/, "")}/${profilePhoto.replace(/^\//, "")}`;
}

function StatCard({
  label,
  value,
  hint,
  tone = "gray",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "blue" | "green" | "yellow" | "gray";
}) {
  const tones = {
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-green-600 dark:text-green-400",
    yellow: "text-yellow-600 dark:text-yellow-400",
    gray: "text-gray-800 dark:text-gray-100",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {hint && (
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
}

export default function AdminWeeklyConference() {
  const [mes, setMes] = useState<string>(() => {
    const agora = new Date();
    const numeroMes = String(agora.getMonth() + 1).padStart(2, "0");
    return `${agora.getFullYear()}-${numeroMes}`;
  });

  const [metaInput, setMetaInput] = useState(String(META_SEMANAL_PADRAO));
  const [metaSemanal, setMetaSemanal] = useState(META_SEMANAL_PADRAO);
  const [userId, setUserId] = useState("");
  const [incluirVazios, setIncluirVazios] = useState(false);

  const [usuariosAdmin, setUsuariosAdmin] = useState<AdminUser[]>([]);
  const [data, setData] = useState<AdminWeeklyConferenceResponse | null>(null);

  const [aba, setAba] = useState<Aba>("consolidado");
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("total");
  const [detalhe, setDetalhe] = useState<AdminWeeklyConferenceUser | null>(
    null,
  );

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);

  /* ============================ Opções de mês ============================ */
  const mesesOptions = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => {
        const referencia = new Date();
        referencia.setDate(1);
        referencia.setMonth(referencia.getMonth() - i);
        const valor = `${referencia.getFullYear()}-${String(
          referencia.getMonth() + 1,
        ).padStart(2, "0")}`;
        return { valor, label: formatarMesLabel(valor) };
      }),
    [],
  );

  /* ============================ Usuários para o filtro ============================ */
  useEffect(() => {
    let ativo = true;

    api
      .get<AdminUser[]>("/admin/users")
      .then(({ data: usuarios }) => {
        if (ativo) setUsuariosAdmin(usuarios ?? []);
      })
      .catch(() => {
        // O filtro por usuário é opcional; a página continua funcionando.
        if (ativo) setUsuariosAdmin([]);
      });

    return () => {
      ativo = false;
    };
  }, []);

  const usuariosOrdenados = useMemo(
    () =>
      [...usuariosAdmin].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR"),
      ),
    [usuariosAdmin],
  );

  const usuariosPorId = useMemo(() => {
    const mapa = new Map<number, AdminUser>();
    usuariosAdmin.forEach((usuario) => mapa.set(usuario.id, usuario));
    return mapa;
  }, [usuariosAdmin]);

  const usuarioFiltrado = userId
    ? usuariosPorId.get(Number(userId))
    : undefined;

  /* ============================ Meta semanal ============================ */
  const aplicarMeta = useCallback(
    (forcarAtualizacao = false) => {
      const valor = Number.parseInt(metaInput, 10);

      if (!Number.isFinite(valor) || valor < 1) {
        setErro("Informe uma meta semanal válida (inteiro maior ou igual a 1).");
        return false;
      }

      setErro(null);
      setMetaInput(String(valor));

      if (valor === metaSemanal) {
        if (forcarAtualizacao) setRecarregar((contador) => contador + 1);
      } else {
        setMetaSemanal(valor);
      }

      return true;
    },
    [metaInput, metaSemanal],
  );

  /* ============================ Requisição ============================ */
  useEffect(() => {
    const controller = new AbortController();
    let ativo = true;

    // Fecha o modal e evita exibir dados de outro mês durante a troca.
    setDetalhe(null);
    setData((anterior) => (anterior && anterior.mes === mes ? anterior : null));
    setLoading(true);
    setErro(null);

    const params: Record<string, string | number | boolean> = {
      meta_semanal: metaSemanal,
    };

    if (userId) {
      params.user_id = Number(userId);
    } else if (incluirVazios) {
      params.include_empty = true;
    }

    const carregar = async () => {
      try {
        const { data: resposta } =
          await api.get<AdminWeeklyConferenceResponse>(
            `/target/admin/conference/weekly/${mes}`,
            { params, signal: controller.signal },
          );

        if (ativo) setData(resposta);
      } catch (err) {
        if (!ativo || controller.signal.aborted) return;
        setErro(
          getApiErrorMessage(
            err,
            "Não foi possível carregar a conferência administrativa.",
          ),
        );
      } finally {
        if (ativo) setLoading(false);
      }
    };

    carregar();

    return () => {
      ativo = false;
      controller.abort();
    };
  }, [mes, metaSemanal, userId, incluirVazios, recarregar]);

  /* ============================ Dados derivados ============================ */
  const consolidado = data?.consolidado ?? null;
  const usuarios = useMemo(() => data?.usuarios ?? [], [data]);

  const negativosConsolidado = useMemo(
    () =>
      (consolidado?.semanas ?? []).reduce(
        (total, semana) => total + semana.quantidade_negativos,
        0,
      ),
    [consolidado],
  );

  const usuariosFiltrados = useMemo(() => {
    const termo = normalizarTexto(busca);

    return [...usuarios]
      .filter(
        (usuario) =>
          !termo || normalizarTexto(usuario.user_name).includes(termo),
      )
      .sort((a, b) => {
        if (ordenacao === "nome") {
          return a.user_name.localeCompare(b.user_name, "pt-BR");
        }
        if (ordenacao === "meta") {
          return (
            b.resumo.semanas_com_meta_batida -
            a.resumo.semanas_com_meta_batida
          );
        }
        return b.resumo.total_mes - a.resumo.total_mes;
      });
  }, [usuarios, busca, ordenacao]);

  const escopoLabel = usuarioFiltrado
    ? usuarioFiltrado.name
    : "Todos os usuários";

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5">
      {/* ============================ Cabeçalho ============================ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            Conferência Semanal — Administração
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Consolidado de todos os usuários e detalhamento individual das
            semanas de sexta a quinta.
          </p>
        </div>

        <Button
          color="light"
          onClick={() => {
            aplicarMeta();
            setRecarregar((contador) => contador + 1);
          }}
          disabled={loading}
        >
          <HiRefresh className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* ============================ Filtros ============================ */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label
              htmlFor="mesAdmin"
              className="mb-1 text-gray-700 dark:text-gray-300"
            >
              Mês
            </Label>
            <Select
              id="mesAdmin"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
            >
              {mesesOptions.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label
              htmlFor="metaAdmin"
              className="mb-1 text-gray-700 dark:text-gray-300"
            >
              Meta semanal
            </Label>
            <TextInput
              id="metaAdmin"
              type="number"
              min={1}
              step={1}
              value={metaInput}
              onChange={(e) => setMetaInput(e.target.value)}
              onBlur={() => aplicarMeta()}
              onKeyDown={(e) => {
                if (e.key === "Enter") aplicarMeta(true);
              }}
            />
          </div>

          <div>
            <Label
              htmlFor="usuarioAdmin"
              className="mb-1 text-gray-700 dark:text-gray-300"
            >
              Usuário
            </Label>
            <Select
              id="usuarioAdmin"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="">Todos os usuários</option>
              {usuariosOrdenados.map((usuario) => (
                <option key={usuario.id} value={usuario.id}>
                  {usuario.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-end">
            <ToggleSwitch
              checked={incluirVazios}
              onChange={setIncluirVazios}
              disabled={Boolean(userId)}
              label="Incluir usuários sem movimento"
              color="blue"
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {userId
            ? `Exibindo apenas ${escopoLabel}. O filtro “sem movimento” é ignorado ao consultar um usuário.`
            : "Sem filtro de usuário, o consolidado soma todos e o detalhamento lista cada usuário com movimento."}
        </p>
      </div>

      {erro && (
        <Alert color="failure">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{erro}</span>
            {!loading && (
              <Button
                size="xs"
                color="failure"
                onClick={() => setRecarregar((contador) => contador + 1)}
              >
                Tentar novamente
              </Button>
            )}
          </div>
        </Alert>
      )}

      {loading && !data && (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="xl" color="info" aria-label="Carregando dados..." />
        </div>
      )}

      {!loading && !data && !erro && (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
          Nenhum dado encontrado para o período selecionado.
        </div>
      )}

      {data && consolidado && (
        <>
          {/* ============================ KPIs ============================ */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Total do mês"
              value={formatarNumero(consolidado.total_mes)}
              hint={escopoLabel}
              tone="blue"
            />
            <StatCard
              label="Usuários"
              value={formatarNumero(data.total_usuarios)}
              hint={
                incluirVazios && !userId
                  ? "incluindo sem movimento"
                  : "com movimento no período"
              }
            />
            <StatCard
              label="Semanas com meta"
              value={`${formatarNumero(
                consolidado.semanas_com_meta_batida,
              )}/${formatarNumero(consolidado.total_semanas)}`}
              hint={`${consolidado.progresso_percentual}% do período`}
              tone={
                consolidado.semanas_com_meta_batida >=
                consolidado.total_semanas
                  ? "green"
                  : "yellow"
              }
            />
            <StatCard
              label="Estoques negativos"
              value={formatarNumero(negativosConsolidado)}
              hint="informativo — fora da meta"
              tone={negativosConsolidado > 0 ? "yellow" : "gray"}
            />
          </div>

          <WeeklyConferenceProgress
            resumo={consolidado}
            loading={loading}
          />

          {/* ============================ Abas ============================ */}
          <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setAba("consolidado")}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                aba === "consolidado"
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              Consolidado
            </button>
            <button
              type="button"
              onClick={() => setAba("usuarios")}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                aba === "usuarios"
                  ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              Por usuário
              <Badge color="gray" className="w-fit">
                {formatarNumero(usuarios.length)}
              </Badge>
            </button>
          </div>

          {aba === "consolidado" && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Semanas consolidadas de{" "}
                <strong className="font-semibold">{escopoLabel}</strong>.
              </p>
              <WeeklyConferenceTable
                semanas={consolidado.semanas}
                emptyMessage={
                  usuarioFiltrado
                    ? `${usuarioFiltrado.name} não possui semanas no período.`
                    : "Nenhuma semana consolidada no período."
                }
              />
            </div>
          )}

          {aba === "usuarios" && (
            <div className="space-y-3">
              {/* Barra de busca / ordenação */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="w-full sm:max-w-xs">
                  <Label
                    htmlFor="buscaUsuario"
                    className="mb-1 text-gray-700 dark:text-gray-300"
                  >
                    Buscar usuário
                  </Label>
                  <TextInput
                    id="buscaUsuario"
                    placeholder="Nome do usuário..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>

                <div className="w-full sm:w-56">
                  <Label
                    htmlFor="ordenacaoUsuarios"
                    className="mb-1 text-gray-700 dark:text-gray-300"
                  >
                    Ordenar por
                  </Label>
                  <Select
                    id="ordenacaoUsuarios"
                    value={ordenacao}
                    onChange={(e) =>
                      setOrdenacao(e.target.value as Ordenacao)
                    }
                  >
                    <option value="total">Total do mês</option>
                    <option value="meta">Semanas com meta</option>
                    <option value="nome">Nome</option>
                  </Select>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <Table hoverable className="min-w-[900px]">
                  <TableHead className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                    <TableHeadCell className="px-4 py-3">Usuário</TableHeadCell>
                    <TableHeadCell className="px-4 py-3 text-center">
                      Total do mês
                    </TableHeadCell>
                    <TableHeadCell className="px-4 py-3 text-center">
                      Conferências
                    </TableHeadCell>
                    <TableHeadCell className="px-4 py-3 text-center">
                      Tasks
                    </TableHeadCell>
                    <TableHeadCell className="px-4 py-3 text-center">
                      Negativos
                    </TableHeadCell>
                    <TableHeadCell className="px-4 py-3 text-center">
                      Semanas com meta
                    </TableHeadCell>
                    <TableHeadCell className="px-4 py-3 text-center">
                      Progresso
                    </TableHeadCell>
                    <TableHeadCell className="px-4 py-3 text-center">
                      Detalhes
                    </TableHeadCell>
                  </TableHead>

                  <TableBody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {usuariosFiltrados.length === 0 && (
                      <TableRow className="bg-white dark:bg-gray-800">
                        <TableCell
                          colSpan={8}
                          className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                        >
                          {busca
                            ? "Nenhum usuário encontrado para a busca."
                            : incluirVazios || usuarioFiltrado
                              ? "Nenhum usuário retornado pela API."
                              : "Nenhum usuário com movimento no período. Ative “Incluir usuários sem movimento” para listar todos."}
                        </TableCell>
                      </TableRow>
                    )}

                    {usuariosFiltrados.map((usuario) => {
                      const info = usuariosPorId.get(usuario.user_id);
                      const resumo = usuario.resumo;
                      const totalOrigem = resumo.semanas.reduce(
                        (total, semana) => total + semana.conferencias,
                        0,
                      );
                      const totalTasks = resumo.semanas.reduce(
                        (total, semana) => total + semana.tasks,
                        0,
                      );
                      const negativos = resumo.semanas.reduce(
                        (total, semana) =>
                          total + semana.quantidade_negativos,
                        0,
                      );

                      return (
                        <TableRow
                          key={usuario.user_id}
                          className="bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"
                        >
                          <TableCell className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar
                                img={urlFoto(info?.profile_photo)}
                                alt={usuario.user_name}
                                rounded
                                size="sm"
                              />
                              <div>
                                <p className="font-medium whitespace-nowrap text-gray-900 dark:text-gray-100">
                                  {usuario.user_name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Local {usuario.local}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center font-semibold whitespace-nowrap">
                            {formatarNumero(resumo.total_mes)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center whitespace-nowrap">
                            {formatarNumero(totalOrigem)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center whitespace-nowrap">
                            {formatarNumero(totalTasks)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center whitespace-nowrap">
                            {negativos > 0 ? (
                              <span
                                className="inline-block rounded-full bg-orange-100 px-2.5 py-1 text-sm font-semibold text-orange-700 dark:bg-orange-700 dark:text-orange-100"
                                title="Estoque negativo — não conta para a meta"
                              >
                                {formatarNumero(negativos)}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center whitespace-nowrap">
                            {formatarNumero(resumo.semanas_com_meta_batida)}/
                            {formatarNumero(resumo.total_semanas)}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <div className="flex min-w-[130px] items-center gap-2">
                              <Progress
                                progress={resumo.progresso_percentual}
                                color={corDoProgresso(
                                  resumo.progresso_percentual,
                                )}
                                size="sm"
                                className="w-full"
                              />
                              <span className="w-10 text-right text-xs text-gray-600 dark:text-gray-300">
                                {resumo.progresso_percentual}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center">
                            <Button
                              size="xs"
                              color="light"
                              onClick={() => setDetalhe(usuario)}
                            >
                              Ver semanas
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Total do mês considera apenas os dias do mês selecionado; as semanas
            podem incluir dias do mês anterior ou seguinte. Estoques negativos
            são informativos e não entram na meta.
          </p>
        </>
      )}

      {/* ============================ Modal de detalhe ============================ */}
      <Modal
        show={Boolean(detalhe)}
        onClose={() => setDetalhe(null)}
        size="7xl"
        dismissible
      >
        <ModalHeader>
          {detalhe
            ? `${detalhe.user_name} — ${formatarMesLabel(detalhe.resumo.mes)}`
            : "Detalhe do usuário"}
        </ModalHeader>
        <ModalBody className="space-y-4">
          {detalhe && (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard
                  label="Total do mês"
                  value={formatarNumero(detalhe.resumo.total_mes)}
                  tone="blue"
                />
                <StatCard
                  label="Meta semanal"
                  value={formatarNumero(detalhe.resumo.meta_semanal)}
                  hint={`Local ${detalhe.local}`}
                />
                <StatCard
                  label="Semanas com meta"
                  value={`${formatarNumero(
                    detalhe.resumo.semanas_com_meta_batida,
                  )}/${formatarNumero(detalhe.resumo.total_semanas)}`}
                  hint={`${detalhe.resumo.progresso_percentual}% do período`}
                  tone={
                    detalhe.resumo.semanas_com_meta_batida >=
                    detalhe.resumo.total_semanas
                      ? "green"
                      : "yellow"
                  }
                />
                <StatCard
                  label="Estoques negativos"
                  value={formatarNumero(
                    detalhe.resumo.semanas.reduce(
                      (total, semana) =>
                        total + semana.quantidade_negativos,
                      0,
                    ),
                  )}
                  hint="informativo — fora da meta"
                />
              </div>

              <WeeklyConferenceProgress resumo={detalhe.resumo} />

              <WeeklyConferenceTable
                semanas={detalhe.resumo.semanas}
                emptyMessage={`${detalhe.user_name} não possui semanas no período.`}
              />
            </>
          )}
        </ModalBody>
      </Modal>
    </section>
  );
}
