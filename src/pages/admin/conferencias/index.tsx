import { useCallback, useEffect, useState } from "react";
import dayjs from "dayjs";
import {
  Card,
  Label,
  Pagination,
  Select,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from "flowbite-react";
import api from "../../../api";
import {
  ApprovalActions,
  ApprovalBadge,
  RejectionNote,
  type ApprovalInfo,
  type ApprovalStatus,
} from "../../../components/Approval";

interface Conferencia extends ApprovalInfo {
  id: number;
  product_code: string;
  product_name: string;
  quantity_system: number;
  quantity_real: number;
  diference: number;
  cost_total: number;
  date_: string;
  created_by: string;
  local: number;
}

interface Local {
  id: number;
  name: string;
}

const formatarData = (data: string) =>
  data ? dayjs(data).format("DD/MM/YYYY") : "-";

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);

export default function AdminConferencias() {
  const [conferencias, setConferencias] = useState<Conferencia[]>([]);
  const [locais, setLocais] = useState<Local[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | "">(
    "pending",
  );
  const [localFilter, setLocalFilter] = useState("");
  const [pagina, setPagina] = useState(1);

  const itensPorPagina = 10;

  useEffect(() => {
    api
      .get("/local/")
      .then((res) => setLocais(res.data))
      .catch((err) => console.error("Erro ao buscar filiais:", err));
  }, []);

  const fetchConferencias = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/conference/admin/", {
        params: {
          ...(statusFilter ? { approval_status: statusFilter } : {}),
          ...(localFilter ? { local: Number(localFilter) } : {}),
        },
      });
      setConferencias(res.data);
    } catch (err) {
      console.error("Erro ao listar conferências (admin):", err);
      setConferencias([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, localFilter]);

  useEffect(() => {
    fetchConferencias();
  }, [fetchConferencias]);

  useEffect(() => {
    setPagina(1);
  }, [statusFilter, localFilter]);

  const decidir = async (
    id: number,
    approved: boolean,
    rejection_reason?: string,
  ) => {
    await api.patch(`/conference/admin/${id}/approve`, {
      approved,
      rejection_reason: approved ? null : rejection_reason,
    });
    await fetchConferencias();
  };

  const totalPaginas = Math.max(
    1,
    Math.ceil(conferencias.length / itensPorPagina),
  );
  const indiceInicial = (pagina - 1) * itensPorPagina;
  const conferenciasPagina = conferencias.slice(
    indiceInicial,
    indiceInicial + itensPorPagina,
  );

  const nomeLocal = (id: number) =>
    locais.find((l) => l.id === id)?.name ?? String(id);

  return (
    <div className="mx-auto max-w-7xl rounded-2xl p-2 sm:p-6 dark:bg-gray-800">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white">
          Aprovação de Conferências
        </h1>
        <p className="text-sm text-gray-300">
          Aprove ou reprove as conferências cadastradas pelos operadores. Os
          pontos só são creditados após a aprovação.
        </p>
      </div>

      <Card className="shadow-md">
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-xl">
          <div>
            <Label htmlFor="filtro-status">Situação</Label>
            <Select
              id="filtro-status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as ApprovalStatus | "")
              }
            >
              <option value="">Todas</option>
              <option value="pending">Pendentes</option>
              <option value="approved">Aprovadas</option>
              <option value="rejected">Reprovadas</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="filtro-local">Filial</Label>
            <Select
              id="filtro-local"
              value={localFilter}
              onChange={(e) => setLocalFilter(e.target.value)}
            >
              <option value="">Todas</option>
              {locais.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.id} - {l.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner aria-label="Carregando conferências..." size="xl" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table hoverable className="min-w-[1000px] text-center">
                <TableHead>
                  <TableRow>
                    <TableHeadCell>Data</TableHeadCell>
                    <TableHeadCell>Código</TableHeadCell>
                    <TableHeadCell>Produto</TableHeadCell>
                    <TableHeadCell>Qtd. Sistema</TableHeadCell>
                    <TableHeadCell>Qtd. Real</TableHeadCell>
                    <TableHeadCell>Diferença</TableHeadCell>
                    <TableHeadCell>Custo</TableHeadCell>
                    <TableHeadCell>Operador</TableHeadCell>
                    <TableHeadCell>Filial</TableHeadCell>
                    <TableHeadCell>Aprovação</TableHeadCell>
                    <TableHeadCell>Ações</TableHeadCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {conferenciasPagina.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="py-6 text-center">
                        Nenhuma conferência encontrada para os filtros
                        selecionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    conferenciasPagina.map((conferencia) => (
                      <TableRow
                        key={conferencia.id}
                        className="bg-white dark:border-gray-700 dark:bg-gray-800"
                      >
                        <TableCell>
                          {formatarData(conferencia.date_)}
                        </TableCell>
                        <TableCell>{conferencia.product_code}</TableCell>
                        <TableCell className="max-w-[220px] overflow-hidden text-ellipsis">
                          {conferencia.product_name}
                        </TableCell>
                        <TableCell>{conferencia.quantity_system}</TableCell>
                        <TableCell>{conferencia.quantity_real}</TableCell>
                        <TableCell>{conferencia.diference}</TableCell>
                        <TableCell>
                          {formatarMoeda(conferencia.cost_total)}
                        </TableCell>
                        <TableCell>{conferencia.created_by}</TableCell>
                        <TableCell>{nomeLocal(conferencia.local)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col items-center gap-1">
                            <ApprovalBadge
                              status={conferencia.approval_status}
                            />
                            <RejectionNote
                              item={conferencia}
                              className="max-w-[200px]"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <ApprovalActions
                            onApprove={() => decidir(conferencia.id, true)}
                            onReject={(reason) =>
                              decidir(conferencia.id, false, reason)
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPaginas > 1 && (
              <div className="mt-4 flex justify-center">
                <Pagination
                  currentPage={pagina}
                  totalPages={totalPaginas}
                  onPageChange={setPagina}
                  showIcons
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
