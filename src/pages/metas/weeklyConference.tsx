import {
  Badge,
  Progress,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from "flowbite-react";

/* ============================================================
   Estruturas compartilhadas — Conferência Semanal
   Usadas pela página /metas/conferencia e pelo painel
   administrativo /admin/conferencia/semanal.
   (ver WEEKLY_CONFERENCE_DOCUMENTATION.md)
============================================================ */

export interface WeeklyConferenceStat {
  numero: number;
  inicio: string;
  fim: string;
  periodo: string;
  quantidade: number;
  conferencias: number;
  tasks: number;
  quantidade_negativos: number;
  meta_semana: number;
  faltam: number;
  atingiu_meta: boolean;
}

export interface WeeklyConferenceSummary {
  mes: string;
  meta_semanal: number;
  periodo_inicio: string;
  periodo_fim: string;
  total_mes: number;
  total_semanas: number;
  semanas_com_meta_batida: number;
  progresso_percentual: number;
  semanas: WeeklyConferenceStat[];
}

/** Resposta de GET /target/admin/conference/weekly/{month} */
export interface AdminWeeklyConferenceUser {
  user_id: number;
  user_name: string;
  local: number;
  resumo: WeeklyConferenceSummary;
}

export interface AdminWeeklyConferenceResponse {
  mes: string;
  meta_semanal: number;
  total_usuarios: number;
  consolidado: WeeklyConferenceSummary;
  usuarios: AdminWeeklyConferenceUser[];
}

export const META_SEMANAL_PADRAO = 150;

/* ============================================================
   Helpers
============================================================ */

const formatadorNumero = new Intl.NumberFormat("pt-BR");

export function formatarNumero(valor: number | null | undefined) {
  if (typeof valor !== "number" || Number.isNaN(valor)) return "0";
  return formatadorNumero.format(valor);
}

/** "2025-09-26" → "26/09/2025" */
export function formatarDataISO(data?: string | null) {
  if (!data) return "—";
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return data;
  return `${dia}/${mes}/${ano}`;
}

/** "2025-10" → "Outubro de 2025" */
export function formatarMesLabel(mes: string) {
  const [ano, numeroMes] = mes.split("-").map(Number);
  if (!ano || !numeroMes) return mes;
  const label = new Date(ano, numeroMes - 1, 1).toLocaleString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function getApiErrorMessage(
  err: unknown,
  fallback = "Não foi possível carregar o resumo semanal. Tente novamente.",
) {
  const detail = (
    err as { response?: { data?: { detail?: unknown } } } | undefined
  )?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) return fallback;
  return fallback;
}

export function corDoProgresso(percentual: number) {
  if (percentual < 50) return "failure" as const;
  if (percentual < 80) return "warning" as const;
  return "success" as const;
}

/** Remove acentos e normaliza para buscas por nome. */
export function normalizarTexto(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/* ============================================================
   Componentes compartilhados
============================================================ */

export function WeeklyConferenceProgress({
  resumo,
  loading = false,
}: {
  resumo: WeeklyConferenceSummary;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          Progresso do mês — {formatarMesLabel(resumo.mes)}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Período analisado: {formatarDataISO(resumo.periodo_inicio)} –{" "}
          {formatarDataISO(resumo.periodo_fim)}
        </p>
      </div>
      <Progress
        progress={resumo.progresso_percentual}
        color={corDoProgresso(resumo.progresso_percentual)}
        size="lg"
        labelProgress
        labelText
        textLabel={`${resumo.semanas_com_meta_batida} / ${resumo.total_semanas} semanas`}
      />
      {loading && (
        <p className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Spinner size="xs" color="info" />
          Atualizando dados...
        </p>
      )}
    </div>
  );
}

export function WeeklyConferenceTable({
  semanas,
  emptyMessage = "Nenhuma semana retornada pela API para este mês.",
}: {
  semanas: WeeklyConferenceStat[];
  emptyMessage?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <Table hoverable className="min-w-[940px] text-center">
        <TableHead className="bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
          <TableHeadCell className="px-3 py-3 whitespace-nowrap">
            Semana
          </TableHeadCell>
          <TableHeadCell className="px-3 py-3 whitespace-nowrap">
            Período
          </TableHeadCell>
          <TableHeadCell className="px-3 py-3 whitespace-nowrap">
            Conferências
          </TableHeadCell>
          <TableHeadCell className="px-3 py-3 whitespace-nowrap">
            Tarefas
          </TableHeadCell>
          <TableHeadCell className="px-3 py-3 whitespace-nowrap">
            Total
          </TableHeadCell>
          <TableHeadCell
            className="px-3 py-3 whitespace-nowrap"
            title="Estoque negativo — informativo, não conta para a meta"
          >
            Negativos
          </TableHeadCell>
          <TableHeadCell className="px-3 py-3 whitespace-nowrap">
            Meta da Semana
          </TableHeadCell>
          <TableHeadCell className="px-3 py-3 whitespace-nowrap">
            Faltam
          </TableHeadCell>
          <TableHeadCell className="px-3 py-3 whitespace-nowrap">
            Status
          </TableHeadCell>
        </TableHead>

        <TableBody className="divide-y divide-gray-200 dark:divide-gray-700">
          {semanas.length === 0 && (
            <TableRow className="bg-white dark:bg-gray-800">
              <TableCell colSpan={9} className="px-3 py-8 text-gray-500">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}

          {semanas.map((semana) => (
            <TableRow
              key={`${semana.numero}-${semana.inicio}`}
              className="bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <TableCell className="px-3 py-3 font-medium whitespace-nowrap">
                {semana.numero}
              </TableCell>
              <TableCell className="px-3 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                {semana.periodo || `${semana.inicio} - ${semana.fim}`}
              </TableCell>
              <TableCell className="px-3 py-3 whitespace-nowrap">
                {formatarNumero(semana.conferencias)}
              </TableCell>
              <TableCell className="px-3 py-3 whitespace-nowrap">
                {formatarNumero(semana.tasks)}
              </TableCell>
              <TableCell className="px-3 py-3 font-semibold whitespace-nowrap text-gray-900 dark:text-gray-100">
                {formatarNumero(semana.quantidade)}
              </TableCell>
              <TableCell className="px-3 py-3 whitespace-nowrap">
                {semana.quantidade_negativos > 0 ? (
                  <span
                    className="inline-block rounded-full bg-orange-100 px-2.5 py-1 text-sm font-semibold text-orange-700 dark:bg-orange-300 dark:text-orange-100"
                    title="Estoque negativo — não conta para a meta"
                  >
                    {formatarNumero(semana.quantidade_negativos)}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-3 whitespace-nowrap">
                {formatarNumero(semana.meta_semana)}
              </TableCell>
              <TableCell className="px-3 py-3 whitespace-nowrap">
                {semana.faltam > 0 ? (
                  <span className="inline-block rounded-full bg-yellow-100 px-2.5 py-1 text-sm font-semibold whitespace-nowrap text-yellow-700 dark:bg-yellow-700 dark:text-yellow-100">
                    {formatarNumero(semana.faltam)}
                  </span>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-3 whitespace-nowrap">
                <Badge
                  color={semana.atingiu_meta ? "success" : "failure"}
                  className="inline-flex w-fit justify-center"
                >
                  {semana.atingiu_meta
                    ? "✔️ Meta atingida"
                    : "✖️ Abaixo da meta"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
