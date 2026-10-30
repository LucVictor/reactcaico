import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Label, Spinner, ToggleSwitch } from "flowbite-react";
import { useNavigate } from "react-router-dom";

import api from "../../api";
import { useAuthStore } from "../authStore";
import {
  META_SEMANAL_PADRAO,
  WeeklyConferenceProgress,
  WeeklyConferenceTable,
  formatarMesLabel,
  formatarNumero,
  getApiErrorMessage,
  type WeeklyConferenceSummary,
} from "./weeklyConference";

/* ============================================================
   Cartão de indicador
============================================================ */

type StatTone = "blue" | "green" | "yellow" | "gray";

const statToneClasses: Record<StatTone, string> = {
  blue: "text-blue-600 dark:text-blue-400",
  green: "text-green-600 dark:text-green-400",
  yellow: "text-yellow-600 dark:text-yellow-400",
  gray: "text-gray-800 dark:text-gray-100",
};

function StatCard({
  label,
  value,
  hint,
  tone = "gray",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: StatTone;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${statToneClasses[tone]}`}>
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
}

/* ============================================================
   Página operacional — /metas/conferencia
============================================================ */

export function ConferenciaCalendario() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.admin === 1;

  const [mesSelecionado, setMesSelecionado] = useState<string>(() => {
    const agora = new Date();
    const mes = String(agora.getMonth() + 1).padStart(2, "0");
    return `${agora.getFullYear()}-${mes}`;
  });

  const [metaSemanal] = useState(META_SEMANAL_PADRAO);
  const [todosUsuarios, setTodosUsuarios] = useState(false);

  const [resumo, setResumo] = useState<WeeklyConferenceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [recarregar, setRecarregar] = useState(0);

  const mesesOptions = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => {
        const data = new Date();
        data.setDate(1);
        data.setMonth(data.getMonth() - i);
        const valor = `${data.getFullYear()}-${String(
          data.getMonth() + 1,
        ).padStart(2, "0")}`;
        return { valor, label: formatarMesLabel(valor) };
      }),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    let ativo = true;

    // Ao trocar de mês, evita exibir o resumo do mês anterior.
    setResumo((anterior) =>
      anterior && anterior.mes === mesSelecionado ? anterior : null,
    );
    setLoading(true);
    setErro(null);

    const carregar = async () => {
      try {
        const { data } = await api.get<WeeklyConferenceSummary>(
          `/target/conference/weekly/${mesSelecionado}`,
          {
            params: {
              meta_semanal: metaSemanal,
              ...(todosUsuarios ? { all_users: true } : {}),
            },
            signal: controller.signal,
          },
        );

        if (ativo) setResumo(data);
      } catch (err) {
        if (!ativo || controller.signal.aborted) return;
        setErro(getApiErrorMessage(err));
      } finally {
        if (ativo) setLoading(false);
      }
    };

    carregar();

    return () => {
      ativo = false;
      controller.abort();
    };
  }, [mesSelecionado, metaSemanal, todosUsuarios, recarregar]);

  const semanas = resumo?.semanas ?? [];
  const totalConferencias = semanas.reduce(
    (total, semana) => total + semana.conferencias,
    0,
  );
  const totalTasks = semanas.reduce((total, semana) => total + semana.tasks, 0);

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5 rounded-xl bg-gray-50 p-4 shadow-md transition-colors duration-300 sm:p-6 dark:bg-gray-800">
      {/* ============================ Cabeçalho / filtros ============================ */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            Conferência Semanal de Produtos
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Semanas de sexta a quinta, com conferências avulsas e itens
            conferidos nas tarefas.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label
              htmlFor="mes"
              className="mr-3 mb-1 text-gray-700 dark:text-gray-300"
            >
              Mês:
            </Label>
            <select
              id="mes"
              value={mesSelecionado}
              onChange={(e) => setMesSelecionado(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-800 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
            >
              {mesesOptions.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <Button color="blue" onClick={() => navigate("/task/export")}>
            Exportar relatório
          </Button>
        </div>
      </div>

      {isAdmin && (
        <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700 dark:bg-gray-900/40">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
              Visão administrativa
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Agregue as conferências de todos os usuários no mesmo resumo.
            </p>
          </div>
          <ToggleSwitch
            checked={todosUsuarios}
            onChange={setTodosUsuarios}
            label="Todos os usuários"
            color="blue"
          />
        </div>
      )}

      {erro && (
        <Alert color="failure">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{erro}</span>
            {!loading && (
              <Button
                size="xs"
                color="failure"
                onClick={() => setRecarregar((valor) => valor + 1)}
              >
                Tentar novamente
              </Button>
            )}
          </div>
        </Alert>
      )}

      {loading && !resumo && (
        <div className="flex h-64 items-center justify-center">
          <Spinner size="xl" color="info" aria-label="Carregando dados..." />
        </div>
      )}

      {!loading && !resumo && !erro && (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">
          Nenhum dado encontrado para o período selecionado.
        </div>
      )}

      {resumo && (
        <>
          {/* ============================ Indicadores ============================ */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Total do mês"
              value={formatarNumero(resumo.total_mes)}
              hint="conferências dentro do mês"
              tone="blue"
            />
            <StatCard
              label="Meta semanal"
              value={formatarNumero(resumo.meta_semanal)}
              hint={`${resumo.total_semanas} semana(s) no período`}
            />
            <StatCard
              label="Semanas com meta"
              value={`${formatarNumero(
                resumo.semanas_com_meta_batida,
              )}/${formatarNumero(resumo.total_semanas)}`}
              hint={`${resumo.progresso_percentual}% do período`}
              tone={
                resumo.semanas_com_meta_batida >= resumo.total_semanas
                  ? "green"
                  : "yellow"
              }
            />
            <StatCard
              label="Origem no período"
              value={`${formatarNumero(totalConferencias)} + ${formatarNumero(
                totalTasks,
              )}`}
              hint="conferências + tarefas"
            />
          </div>

          <WeeklyConferenceProgress resumo={resumo} loading={loading} />

          <WeeklyConferenceTable semanas={semanas} />

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Total do mês considera apenas os dias do mês selecionado; as semanas
            podem incluir dias do mês anterior ou seguinte. Estoques negativos
            aparecem apenas para fins informativos.
            {todosUsuarios && " Exibindo dados agregados de todos os usuários."}
          </p>
        </>
      )}
    </section>
  );
}
